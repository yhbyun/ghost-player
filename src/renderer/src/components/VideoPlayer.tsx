import React, { useEffect, useRef, useState } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import Player from 'video.js/dist/types/player'
import './StreamPlayTech'

interface VideoPlayerProps {
  src: string
  type: string
  duration?: number
  subtitleSrc?: string
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, type, duration, subtitleSrc }) => {
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const [seekIndicator, setSeekIndicator] = useState<'forward' | 'backward' | null>(null)
  const seekTimeoutRef = useRef<number | null>(null)
  const [volume, setVolume] = useState(100)
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false)
  const volumeTimeoutRef = useRef<number | null>(null)

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

    const player = videojs(videoElement, options, () => {
      console.log(`player is ready. duration: ${duration}`)
      player.on('error', () => {
        console.error('Video.js Error:', player.error())
      })

      // Set initial volume state
      setVolume(Math.round(player.volume() * 100))
    })

    playerRef.current = player

    const showSeekIndicator = (direction: 'forward' | 'backward'): void => {
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current)
      }
      setSeekIndicator(direction)
      seekTimeoutRef.current = window.setTimeout(() => {
        setSeekIndicator(null)
      }, 1000)
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
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current)
      }

      setVolume(Math.round(player.volume() * 100))
      setShowVolumeIndicator(true)

      volumeTimeoutRef.current = window.setTimeout(() => {
        setShowVolumeIndicator(false)
      }, 1500)
    }

    window.addEventListener('keydown', handleKeyDown)
    player.on('volumechange', handleVolumeChange)

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose()
        playerRef.current = null
      }
      window.removeEventListener('keydown', handleKeyDown)
      player.off('volumechange', handleVolumeChange)
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current)
      }
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current)
      }
    }
  }, [src, type, duration, subtitleSrc])

  return (
    <div data-vjs-player className="relative flex items-center w-full h-full">
      <div ref={videoRef} className="w-full" />
      {seekIndicator && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-60 text-white px-5 py-3 rounded-lg flex flex-col items-center">
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-60 text-white text-lg px-4 py-2 rounded-md">
          Volume: {volume}%
        </div>
      )}
    </div>
  )
}

export default VideoPlayer
