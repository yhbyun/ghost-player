import React, { useEffect, useRef, useState, useCallback } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import Player from 'video.js/dist/types/player'
import './StreamPlayTech'
import AudioVisualizer from './AudioVisualizer'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClosedCaptioning } from '@fortawesome/free-solid-svg-icons'

// --- WAV Encoding Utility ---
const bufferToWav = (buffer: Float32Array[], sampleRate: number): Blob => {
  const numChannels = 1
  const totalLength = buffer.reduce((acc, val) => acc + val.length, 0)
  const result = new Float32Array(totalLength)

  let offset = 0
  for (const buf of buffer) {
    result.set(buf, offset)
    offset += buf.length
  }

  const dataView = encodeWAV(result, sampleRate, numChannels)
  return new Blob([dataView.buffer as ArrayBuffer], { type: 'audio/wav' })
}

const encodeWAV = (samples: Float32Array, sampleRate: number, numChannels: number): DataView => {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string): void => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array): void => {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]))
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2 * numChannels, true)
  view.setUint16(32, numChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  floatTo16BitPCM(view, 44, samples)

  return view
}
// --- End of WAV Utility ---

interface VideoPlayerProps {
  src: string
  type: string
  duration?: number
  subtitleSrc?: string
  currentTime?: number
  onTimeUpdate?: (time: number) => void
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  playerRef: React.MutableRefObject<Player | null>
  filename?: string
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  type,
  duration,
  subtitleSrc,
  currentTime,
  onTimeUpdate,
  onPlay,
  onPause,
  onEnded,
  playerRef,
  filename
}) => {
  const videoRef = useRef<HTMLDivElement>(null)
  const [seekIndicator, setSeekIndicator] = useState<{
    type: 'forward' | 'backward'
    key: number
  } | null>(null)
  const seekTimeoutRef = useRef<number | null>(null)
  const [volumeIndicator, setVolumeIndicator] = useState<{ volume: number; key: number } | null>(
    null
  )
  const volumeTimeoutRef = useRef<number | null>(null)
  const lastUpdateTimeRef = useRef<number>(0)
  const [playPauseIndicator, setPlayPauseIndicator] = useState<{
    type: 'play' | 'pause'
    key: number
  } | null>(null)
  const playPauseTimeoutRef = useRef<number | null>(null)

  // Audio capture refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const audioDataBufferRef = useRef<Float32Array[]>([])
  const isCapturingAudioRef = useRef(false)

  // Audio visualizer refs
  const analyserNodeRef = useRef<AnalyserNode | null>(null)
  const [isVisualizerEnabled, setIsVisualizerEnabled] = useState(false)

  useEffect(() => {
    const fetchSettings = async (): Promise<void> => {
      const visualizerEnabled = await window.api.getSetting('isVisualizerEnabled', false)
      setIsVisualizerEnabled(visualizerEnabled as boolean)
    }
    fetchSettings()

    const cleanup = window.api.onSettingChanged(({ key, value }) => {
      if (key === 'isVisualizerEnabled') {
        setIsVisualizerEnabled(value as boolean)
      }
    })

    return cleanup
  }, [])

  // Caption state
  const [isCaptioningEnabled, setIsCaptioningEnabled] = useState(false)
  const [captionText, setCaptionText] = useState('')
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)
  const captionIntervalRef = useRef<number | null>(null)

  // Filename display state
  const [showFilename, setShowFilename] = useState(false)
  const [isHoveringVideo, setIsHoveringVideo] = useState(false)
  const filenameTimeoutRef = useRef<number | null>(null)

  const processAudioForCaptioning = useCallback(async (): Promise<void> => {
    if (audioDataBufferRef.current.length === 0) {
      return
    }

    setIsProcessingAudio(true)

    const transcriptionProvider = (await window.api.getSetting(
      'transcriptionProvider',
      'remote'
    )) as string
    let apiKey = ''

    if (transcriptionProvider === 'remote') {
      apiKey = (await window.api.getSetting('whisperApiKey', '')) as string
      if (!apiKey) {
        setCaptionText('Whisper API key is not set.')
        setIsProcessingAudio(false)
        setIsCaptioningEnabled(false)
        return
      }
    }

    const audioBuffer = [...audioDataBufferRef.current]
    audioDataBufferRef.current = []

    const sampleRate = 16000
    const wavBlob = bufferToWav(audioBuffer, sampleRate)
    const wavBuffer = await wavBlob.arrayBuffer()
    const audioData = new Uint8Array(wavBuffer)

    try {
      const transcription = await window.api.transcribeAudio(audioData, apiKey)
      setCaptionText(transcription.trim())
    } catch (error: unknown) {
      console.error('[Captioning] Error transcribing audio:', error)
      const errMessage = error instanceof Error ? error.message : String(error)
      if (errMessage.includes('401')) {
        setCaptionText('Invalid Whisper API Key. Please check settings.')
        setIsCaptioningEnabled(false)
      } else if (!captionText.startsWith('Invalid')) {
        setCaptionText('Error transcribing audio.')
      }
    } finally {
      setIsProcessingAudio(false)
    }
  }, [captionText])

  const handleToggleCaptioning = (): void => {
    const willBeEnabled = !isCaptioningEnabled
    setIsCaptioningEnabled(willBeEnabled)
    if (willBeEnabled) {
      setCaptionText('Starting live captions...')
    }
  }

  useEffect(() => {
    workletNodeRef.current?.port.postMessage({
      type: 'TOGGLE_CAPTURE',
      isCapturing: isCaptioningEnabled
    })

    const runInterval = (): (() => void) => {
      processAudioForCaptioning()
      captionIntervalRef.current = window.setInterval(processAudioForCaptioning, 5000)
      return () => {
        if (captionIntervalRef.current) {
          clearInterval(captionIntervalRef.current)
          captionIntervalRef.current = null
        }
      }
    }

    if (isCaptioningEnabled) {
      const timeout = setTimeout(runInterval, 2000)
      return () => clearTimeout(timeout)
    } else {
      setCaptionText('')
      setIsProcessingAudio(false)
      audioDataBufferRef.current = []
      return () => {}
    }
  }, [isCaptioningEnabled, processAudioForCaptioning])

  // Filename display effect
  useEffect(() => {
    if (!filename) return

    // Show filename for 3 seconds on mount
    setShowFilename(true)
    const initialTimeout = window.setTimeout(() => {
      if (!isHoveringVideo) {
        setShowFilename(false)
      }
    }, 3000)

    return () => {
      window.clearTimeout(initialTimeout)
      if (filenameTimeoutRef.current) {
        window.clearTimeout(filenameTimeoutRef.current)
      }
    }
  }, [filename, isHoveringVideo])

  // Handle hover state for filename display
  useEffect(() => {
    if (!filename) return

    if (isHoveringVideo) {
      // Clear any existing timeout
      if (filenameTimeoutRef.current) {
        window.clearTimeout(filenameTimeoutRef.current)
        filenameTimeoutRef.current = null
      }
      // Show filename immediately on hover
      setShowFilename(true)
    } else {
      // Hide filename 3 seconds after mouse leaves
      filenameTimeoutRef.current = window.setTimeout(() => {
        setShowFilename(false)
      }, 3000)
    }
  }, [isHoveringVideo, filename])

  useEffect(() => {
    if (!videoRef.current) {
      return
    }

    const videoElement = document.createElement('video-js')
    videoRef.current.appendChild(videoElement)

    const options: videojs.PlayerOptions = {
      autoplay: true,
      controls: true,
      bigPlayButton: false,
      responsive: true,
      fluid: true,
      sources: [{ src, type: 'video/mp4' }]
    }

    if (subtitleSrc) {
      options.tracks = [
        {
          src: subtitleSrc,
          kind: 'subtitles',
          srclang: 'en',
          label: 'English',
          default: true
        }
      ]
    }

    if (duration) {
      options.techOrder = ['StreamPlay']
      options.StreamPlay = {
        duration
      }
    }

    const startAudioCapture = async (videoHtmlElement: HTMLVideoElement): Promise<void> => {
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) {
        console.error('Web Audio API is not supported in this browser')
        return
      }

      audioContextRef.current = new AudioContextClass()
      sourceNodeRef.current = audioContextRef.current.createMediaElementSource(videoHtmlElement)

      try {
        const workletUrl = new URL('./caption-processor.js', window.location.href).href
        await audioContextRef.current.audioWorklet.addModule(workletUrl)
        workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'caption-processor')

        workletNodeRef.current.port.onmessage = (event: MessageEvent<Float32Array>) => {
          audioDataBufferRef.current.push(event.data)
        }

        analyserNodeRef.current = audioContextRef.current.createAnalyser()

        const source = sourceNodeRef.current
        const analyser = analyserNodeRef.current
        const worklet = workletNodeRef.current
        const ctx = audioContextRef.current

        if (source && analyser && worklet && ctx) {
          source.connect(analyser)
          source.connect(worklet)
          analyser.connect(ctx.destination)
        }
      } catch (error) {
        console.error('Error adding AudioWorklet module or creating node:', error)
      }
    }

    const stopAudioCapture = (): void => {
      if (workletNodeRef.current) {
        workletNodeRef.current.port.onmessage = null
        workletNodeRef.current.disconnect()
      }
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect()
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
      isCapturingAudioRef.current = false
      audioDataBufferRef.current = []
    }

    // Check if a player already exists for this element
    const existingPlayer = (
      videojs as typeof videojs & { getPlayer: (id: string) => Player | undefined }
    ).getPlayer('video-player')
    if (existingPlayer) {
      // If player exists, dispose it first to reinitialize with new options
      existingPlayer.dispose()
    }

    const player = videojs(videoElement, options, () => {
      if (currentTime) {
        player.currentTime(currentTime)
      }

      player.on('timeupdate', () => {
        const now = Date.now()
        const currentPos = player.currentTime()
        if (
          onTimeUpdate &&
          typeof currentPos === 'number' &&
          now - lastUpdateTimeRef.current > 5000
        ) {
          onTimeUpdate(currentPos)
          lastUpdateTimeRef.current = now
        }
      })

      player.on('play', (): void => {
        onPlay?.()
      })

      player.on('pause', (): void => {
        onPause?.()
      })

      player.on('ended', () => {
        onEnded?.()
      })

      player.on('loadedmetadata', () => {
        const tracks = player.remoteTextTracks()
        if (tracks) {
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i]
            if (track.kind === 'subtitles') {
              track.mode = 'showing'
            }
          }
        }
      })

      if (!isCapturingAudioRef.current) {
        const videoHtmlElement = videoElement.querySelector('video')
        if (videoHtmlElement) {
          videoHtmlElement.crossOrigin = 'anonymous'
          startAudioCapture(videoHtmlElement)
          isCapturingAudioRef.current = true
        }
      }
    })

    playerRef.current = player

    const showSeekIndicator = (direction: 'forward' | 'backward'): void => {
      if (seekTimeoutRef.current) window.clearTimeout(seekTimeoutRef.current)
      setSeekIndicator({ type: direction, key: Date.now() })
      seekTimeoutRef.current = window.setTimeout(() => setSeekIndicator(null), 800)
    }

    const showPlayPauseIndicator = (type: 'play' | 'pause'): void => {
      if (playPauseTimeoutRef.current) window.clearTimeout(playPauseTimeoutRef.current)
      setPlayPauseIndicator({ type, key: Date.now() })
      playPauseTimeoutRef.current = window.setTimeout(() => setPlayPauseIndicator(null), 800)
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === ' ') {
        e.preventDefault()
        if (player.paused()) {
          player.play()
          showPlayPauseIndicator('play')
        } else {
          player.pause()
          showPlayPauseIndicator('pause')
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        player.currentTime(player.currentTime() - 5)
        showSeekIndicator('backward')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        player.currentTime(player.currentTime() + 5)
        showSeekIndicator('forward')
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        player.volume(Math.min(1, player.volume() + 0.1))
        handleVolumeChange()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        player.volume(Math.max(0, player.volume() - 0.1))
        handleVolumeChange()
      }
    }

    const handleVolumeChange = (): void => {
      if (volumeTimeoutRef.current) window.clearTimeout(volumeTimeoutRef.current)
      const currentVolume = player.volume()
      if (typeof currentVolume === 'number') {
        setVolumeIndicator({ volume: Math.round(currentVolume * 100), key: Date.now() })
      }
      volumeTimeoutRef.current = window.setTimeout(() => setVolumeIndicator(null), 800)
    }

    window.addEventListener('keydown', handleKeyDown)
    player.on('volumechange', handleVolumeChange)
    player.on('play', () => showPlayPauseIndicator('play'))
    player.on('pause', () => showPlayPauseIndicator('pause'))

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose()
        playerRef.current = null
      }
      window.removeEventListener('keydown', handleKeyDown)
      if (seekTimeoutRef.current) window.clearTimeout(seekTimeoutRef.current)
      if (volumeTimeoutRef.current) window.clearTimeout(volumeTimeoutRef.current)
      if (playPauseTimeoutRef.current) window.clearTimeout(playPauseTimeoutRef.current)
      stopAudioCapture()
    }
  }, [
    src,
    type,
    duration,
    subtitleSrc,
    onTimeUpdate,
    onPlay,
    onPause,
    onEnded,
    playerRef,
    currentTime
  ])

  const renderCaption = (): React.JSX.Element | null => {
    if (!isCaptioningEnabled && !captionText.startsWith('Invalid')) {
      return null
    }

    let textToShow = captionText
    if (isProcessingAudio) {
      textToShow = 'Captions generating...'
    }

    if (!textToShow) {
      return null
    }

    return (
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black bg-opacity-60 text-white text-xl px-4 py-2 rounded-md">
        {textToShow}
      </div>
    )
  }

  return (
    <div
      data-vjs-player
      className="relative flex items-center w-full h-full"
      onMouseEnter={() => setIsHoveringVideo(true)}
      onMouseLeave={() => setIsHoveringVideo(false)}
    >
      <div ref={videoRef} className="w-full relative">
        {playPauseIndicator && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div
              key={playPauseIndicator.key}
              className="bg-black bg-opacity-60 text-white p-5 w-20 h-20 rounded-full flex items-center justify-center animate-zoom-in-out"
            >
              {playPauseIndicator.type === 'play' ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-16 h-16"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-16 h-16"
                >
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              )}
            </div>
          </div>
        )}
      </div>
      {filename && showFilename && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-md transition-opacity duration-300">
          {filename}
        </div>
      )}
      {seekIndicator && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 ${
            seekIndicator.type === 'backward'
              ? 'left-[10%] -translate-x-1/2'
              : 'right-[10%] translate-x-1/2'
          }`}
        >
          <div
            key={seekIndicator.key}
            className="bg-black bg-opacity-60 text-white p-5 w-20 h-20 rounded-full flex items-center justify-center animate-zoom-in-out"
          >
            {seekIndicator.type === 'backward' ? (
              <div className="text-center flex flex-col items-center">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
                </svg>
                <div className="text-sm font-light">-5s</div>
              </div>
            ) : (
              <div className="text-center flex flex-col items-center">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
                </svg>
                <div className="text-sm font-light">+5s</div>
              </div>
            )}
          </div>
        </div>
      )}
      {volumeIndicator && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            key={volumeIndicator.key}
            className="bg-black bg-opacity-60 text-white text-lg p-5 w-20 h-20 rounded-full flex items-center justify-center animate-zoom-in-out"
          >
            <div className="text-center flex flex-col items-center">
              <div className="text-sm font-light">Volume</div>
              <div className="text-sm font-light">{volumeIndicator.volume}%</div>
            </div>
          </div>
        </div>
      )}
      {renderCaption()}
      <button
        onClick={handleToggleCaptioning}
        className={`cc-button absolute bottom-1 right-12 p-3 rounded-full transition-all duration-200
          ${
            isCaptioningEnabled
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg opacity-50 hover:opacity-100'
              : 'bg-black/50 hover:bg-black/70 text-white opacity-50 hover:opacity-100'
          }`}
        title="Toggle Live Captions"
      >
        <FontAwesomeIcon icon={faClosedCaptioning} className="w-5 h-5" />
      </button>
      <AudioVisualizer
        analyserNode={analyserNodeRef.current}
        isVisualizerEnabled={isVisualizerEnabled}
      />
    </div>
  )
}

export default VideoPlayer
