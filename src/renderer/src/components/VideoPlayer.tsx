import React, { useEffect, useRef } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import Player from 'video.js/dist/types/player'

interface VideoPlayerProps {
  src: string
  type: string
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, type }) => {
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    // Make sure Video.js player is only initialized once
    if (!playerRef.current && videoRef.current) {
      const videoElement = document.createElement('video-js')
      videoElement.classList.add('vjs-big-play-centered')
      videoRef.current.appendChild(videoElement)

      playerRef.current = videojs(
        videoElement,
        {
          autoplay: true,
          controls: true,
          responsive: true,
          fluid: true,
          sources: [
            {
              src,
              type
            }
          ]
        },
        () => {
          console.log('player is ready')
          playerRef.current?.on('error', () => {
            const error = playerRef.current?.error()
            console.error('Video.js Error:', error)
          })
        }
      )
    } else {
      // If the src changes, update the player's source
      const player = playerRef.current
      if (player) {
        player.src({ src, type })
      }
    }
  }, [src, type])

  // Dispose the Video.js player when the component unmounts
  useEffect(() => {
    const player = playerRef.current

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose()
        playerRef.current = null
      }
    }
  }, [])

  return (
    <div data-vjs-player className="flex items-center w-full h-full">
      <div ref={videoRef} className="w-full" />
    </div>
  )
}

export default VideoPlayer
