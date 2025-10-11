import React, { useEffect, useRef } from 'react'
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

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose()
        playerRef.current = null
      }
    }
  }, [src, type, duration])

  return (
    <div data-vjs-player className="flex items-center w-full h-full">
      <div ref={videoRef} className="w-full" />
    </div>
  )
}

export default VideoPlayer
