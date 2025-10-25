import React, { useEffect, useRef, useState } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import Player from 'video.js/dist/types/player'
import './StreamPlayTech'
import AudioVisualizer from './AudioVisualizer'

interface VideoPlayerProps {
  src: string
  type: string
  duration?: number
  subtitleSrc?: string
  currentTime?: number
  onTimeUpdate?: (time: number) => void
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  type,
  duration,
  subtitleSrc,
  currentTime,
  onTimeUpdate
}) => {
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const [seekIndicator, setSeekIndicator] = useState<'forward' | 'backward' | null>(null)
  const seekTimeoutRef = useRef<number | null>(null)
  const [volume, setVolume] = useState(100)
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false)
  const volumeTimeoutRef = useRef<number | null>(null)
  const lastUpdateTimeRef = useRef<number>(0)

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
    return new Blob([dataView], { type: 'audio/wav' })
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

  const processAudioForCaptioning = async (): Promise<void> => {
    if (audioDataBufferRef.current.length === 0) {
      console.log('[Captioning] No audio data in buffer to process.')
      return
    }

    setIsProcessingAudio(true)
    console.log(
      `[Captioning] Processing audio buffer of size: ${audioDataBufferRef.current.length}`
    )

    const transcriptionProvider = await window.api.getSetting('transcriptionProvider', 'remote')
    let apiKey = ''

    if (transcriptionProvider === 'remote') {
      apiKey = (await window.api.getSetting('whisperApiKey', '')) as string
      if (!apiKey) {
        setCaptionText('Whisper API key is not set.')
        setIsProcessingAudio(false)
        setIsCaptioningEnabled(false)
        return
      }
      console.log('[Captioning] Remote API key found. Proceeding with API call.')
    } else {
      console.log('[Captioning] Using local transcription. API key not required.')
    }

    const audioBuffer = [...audioDataBufferRef.current]
    audioDataBufferRef.current = []

    const sampleRate = 16000 // The audio is now resampled to 16kHz in the worklet
    const wavBlob = bufferToWav(audioBuffer, sampleRate)
    const wavBuffer = await wavBlob.arrayBuffer()
    const audioData = new Uint8Array(wavBuffer)

    try {
      console.log('[Captioning] Calling main process for transcription...')
      const transcription = await window.api.transcribeAudio(audioData, apiKey)

      console.log('[Captioning] Transcription received:', transcription.trim())
      setCaptionText(transcription.trim())
    } catch (error) {
      console.error('[Captioning] Error transcribing audio:', error)
      if (error.message.includes('401')) {
        setCaptionText('Invalid Whisper API Key. Please check settings.')
        setIsCaptioningEnabled(false) // Turn off captioning
      } else if (!captionText.startsWith('Invalid')) {
        setCaptionText('Error transcribing audio.')
      }
    } finally {
      setIsProcessingAudio(false)
    }
  }

  const handleToggleCaptioning = (): void => {
    const willBeEnabled = !isCaptioningEnabled
    setIsCaptioningEnabled(willBeEnabled)
    if (willBeEnabled) {
      setCaptionText('Starting live captions...')
    }
    console.log(`[Captioning] Live captions ${willBeEnabled ? 'enabled' : 'disabled'}.`)
  }

  useEffect(() => {
    workletNodeRef.current?.port.postMessage({
      type: 'TOGGLE_CAPTURE',
      isCapturing: isCaptioningEnabled
    })

    const cleanup = (): void => {
      if (captionIntervalRef.current) {
        clearInterval(captionIntervalRef.current)
        captionIntervalRef.current = null
      }
    }

    if (isCaptioningEnabled) {
      const initialTimeout = setTimeout(() => {
        processAudioForCaptioning()
        captionIntervalRef.current = window.setInterval(processAudioForCaptioning, 5000)
      }, 2000)

      return () => {
        clearTimeout(initialTimeout)
        cleanup()
      }
    } else {
      cleanup()
      setCaptionText('')
      setIsProcessingAudio(false)
      audioDataBufferRef.current = []
    }
  }, [isCaptioningEnabled])

  useEffect(() => {
    if (!videoRef.current) {
      return
    }

    const videoElement = document.createElement('video-js')
    videoElement.classList.add('vjs-big-play-centered')
    videoRef.current.appendChild(videoElement)

    const options: videojs.PlayerOptions = {
      autoplay: true,
      controls: true,
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
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContext) {
        console.error('Web Audio API is not supported in this browser')
        return
      }

      audioContextRef.current = new AudioContext()
      sourceNodeRef.current = audioContextRef.current.createMediaElementSource(videoHtmlElement)

      try {
        await audioContextRef.current.audioWorklet.addModule('/caption-processor.js')
        workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'caption-processor')

        workletNodeRef.current.port.onmessage = (event: MessageEvent<Float32Array>) => {
          audioDataBufferRef.current.push(event.data)
        }

        analyserNodeRef.current = audioContextRef.current.createAnalyser()

        sourceNodeRef.current.connect(analyserNodeRef.current)
        sourceNodeRef.current.connect(workletNodeRef.current)
        analyserNodeRef.current.connect(audioContextRef.current.destination)
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

    const player = videojs(videoElement, options, () => {
      console.log(`player is ready. duration: ${duration}`)
      player.on('error', () => {
        console.error('Video.js Error:', player.error())
      })

      if (currentTime) {
        player.currentTime(currentTime)
      }

      player.on('timeupdate', () => {
        const now = Date.now()
        if (onTimeUpdate && now - lastUpdateTimeRef.current > 5000) {
          onTimeUpdate(player.currentTime())
          lastUpdateTimeRef.current = now
        }
      })

      setVolume(Math.round(player.volume() * 100))

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
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
      setSeekIndicator(direction)
      seekTimeoutRef.current = window.setTimeout(() => setSeekIndicator(null), 1000)
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft') {
        player.currentTime(player.currentTime() - 5)
        showSeekIndicator('backward')
      } else if (e.key === 'ArrowRight') {
        player.currentTime(player.currentTime() + 5)
        showSeekIndicator('forward')
      } else if (e.key === 'ArrowUp') {
        player.volume(Math.min(1, player.volume() + 0.1))
      } else if (e.key === 'ArrowDown') {
        player.volume(Math.max(0, player.volume() - 0.1))
      }
    }

    const handleVolumeChange = (): void => {
      if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current)
      setVolume(Math.round(player.volume() * 100))
      setShowVolumeIndicator(true)
      volumeTimeoutRef.current = window.setTimeout(() => setShowVolumeIndicator(false), 1500)
    }

    window.addEventListener('keydown', handleKeyDown)
    player.on('volumechange', handleVolumeChange)

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose()
        playerRef.current = null
      }
      window.removeEventListener('keydown', handleKeyDown)
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
      if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current)
      stopAudioCapture()
    }
  }, [src, type, duration, subtitleSrc, onTimeUpdate])

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
    <div data-vjs-player className="relative flex items-center w-full h-full">
      <div ref={videoRef} className="w-full" />
      {seekIndicator && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-12 bg-black bg-opacity-60 text-white px-5 py-3 rounded-lg flex flex-col items-center">
          {seekIndicator === 'backward' ? (
            <>
              <span className="text-4xl">◀◀◀</span>
              <span className="text-lg">-5 seconds</span>
            </>
          ) : (
            <>
              <span className="text-4xl">▶▶▶</span>
              <span className="text-lg">+5 seconds</span>
            </>
          )}
        </div>
      )}
      {showVolumeIndicator && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-12 bg-black bg-opacity-60 text-white text-lg px-4 py-2 rounded-md">
          Volume: {volume}%
        </div>
      )}
      {renderCaption()}
      <button
        onClick={handleToggleCaptioning}
        className={`absolute bottom-2 right-20 font-bold py-2 px-4 rounded ${
          isCaptioningEnabled
            ? 'bg-blue-700 text-white'
            : 'bg-gray-500 hover:bg-gray-600 text-white'
        }`}
        title="Toggle Live Captions"
      >
        CC
      </button>
      <AudioVisualizer
        analyserNode={analyserNodeRef.current}
        isVisualizerEnabled={isVisualizerEnabled}
      />
    </div>
  )
}

export default VideoPlayer
