import React, { useEffect, useRef, useState } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import Player from 'video.js/dist/types/player'
import './StreamPlayTech'

interface VideoPlayerProps {
  src: string
  type: string
  duration?: number
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, type, duration }) => {
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const [seekIndicator, setSeekIndicator] = useState<'forward' | 'backward' | null>(null)
  const seekTimeoutRef = useRef<number | null>(null)

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
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose()
        playerRef.current = null
      }
      window.removeEventListener('keydown', handleKeyDown)
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current)
      }
    }
  }, [src, type, duration])

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
    </div>
  )
}

export default VideoPlayer
