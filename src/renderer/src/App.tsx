import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { logger } from './logger'
import Player, { PlayerRef } from './components/Player'
import RadialMenu from './components/RadialMenu'
import SettingsMenu from './components/SettingsMenu'
import VideoPlayer from './components/VideoPlayer'
import { Service, services } from '../../config/services'
import { PlayParams } from '../../types'
import videojs from 'video.js'

type ContentSource = { type: 'service'; data: Service } | { type: 'video'; data: PlayParams }

function App(): React.JSX.Element {
  const [content, setContent] = useState<ContentSource | undefined>(undefined)
  const [isHovering, setIsHovering] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isContextHovering, setIsContextHovering] = useState(false)
  const playerRef = useRef<PlayerRef>(null)
  const videoPlayerRef = useRef<videojs.Player | null>(null)
  const [alwaysOnTopIndicator, setAlwaysOnTopIndicator] = useState<{
    status: boolean
    key: number
  } | null>(null)
  const alwaysOnTopTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const fetchInitialContent = async (): Promise<void> => {
      const initialContent = await window.api.getInitialContent()
      if (initialContent) {
        if (initialContent.type === 'service') {
          const service = services.find((s) => s.name === initialContent.data.name)
          if (service) {
            setContent({ type: 'service', data: service })
          }
        } else {
          setContent(initialContent)
        }
      }
    }
    fetchInitialContent()

    const cleanupOnChangeService = window.api.onChangeService((newService) => {
      setContent({ type: 'service', data: newService })
    })

    const cleanupOnOpenLocation = window.api.onOpenLocation((url) => {
      setContent({ type: 'video', data: { type: 'native', videoSource: url } })
    })

    const cleanupOnOpenFile = window.api.onOpenFile((playParams) => {
      console.log('cleanupOnOpenFile', playParams)
      const newContent = { type: 'video' as const, data: playParams }
      setContent(newContent)
      window.api.setLastContent(newContent)
    })

    const cleanupOnPlaybackControl = window.api.onPlaybackControl((action) => {
      if (action === 'play') {
        videoPlayerRef.current?.play()
      } else {
        videoPlayerRef.current?.pause()
      }
    })

    const cleanupOnAlwaysOnTopStatusChanged = window.api.onAlwaysOnTopStatusChanged((status) => {
      if (alwaysOnTopTimeoutRef.current) clearTimeout(alwaysOnTopTimeoutRef.current)
      setAlwaysOnTopIndicator({ status, key: Date.now() })
      alwaysOnTopTimeoutRef.current = window.setTimeout(() => setAlwaysOnTopIndicator(null), 800)
    })

    return () => {
      cleanupOnChangeService()
      cleanupOnOpenLocation()
      cleanupOnOpenFile()
      cleanupOnPlaybackControl()
      cleanupOnAlwaysOnTopStatusChanged()
    }
  }, [])

  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0
  })

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    // Ensure we are not clicking on the content area
    if (e.target === e.currentTarget) {
      logger.log('dragging', 'handleMouseDown', e.clientX, e.clientY)
      dragRef.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY
      }
      setIsDragging(true)
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!dragRef.current.isDragging) return

      const deltaX = e.clientX - dragRef.current.startX
      const deltaY = e.clientY - dragRef.current.startY
      logger.log('dragging', 'handleMouseMove', { deltaX, deltaY })

      window.api.dragWindow(deltaX, deltaY)
    }

    const handleMouseUp = (): void => {
      if (dragRef.current.isDragging) {
        logger.log('dragging', 'handleMouseUp')
        dragRef.current.isDragging = false
        setIsDragging(false)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleServiceChange = (serviceName: string): void => {
    const newService = services.find((s) => s.name === serviceName)
    if (newService) {
      const newContent = { type: 'service' as const, data: newService }
      setContent(newContent)
      window.api.setLastContent({
        type: 'service',
        data: {
          name: newService.name
        }
      })
    }
  }

  const handleHistoryBack = (): void => {
    if (content?.type === 'service') {
      playerRef.current?.goBack()
    }
  }

  const handleReload = (): void => {
    if (content?.type === 'service') {
      playerRef.current?.reload()
    }
  }

  const handleFileOpen = (): void => {
    window.api.openFile()
  }

  const handleTimeUpdate = useCallback(
    (time: number): void => {
      if (content?.type === 'video') {
        window.api.setLastContent({
          type: 'video',
          data: {
            ...content.data,
            currentTime: time
          }
        })
      }
    },
    [content]
  )

  const renderedContent = useMemo(() => {
    if (!content) {
      return null
    }

    if (content.type === 'service') {
      return <Player ref={playerRef} key={content.data.name} service={content.data} />
    }

    if (content.type === 'video') {
      const { videoSource, duration, subtitleSource, currentTime } = content.data
      const mimeType = content.data.videoSource.endsWith('.m3u8')
        ? 'application/x-mpegURL'
        : 'video/mp4'
      return (
        <VideoPlayer
          playerRef={videoPlayerRef}
          src={videoSource}
          type={mimeType}
          duration={duration}
          subtitleSrc={subtitleSource}
          currentTime={currentTime}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => window.api.sendPlaybackState(true)}
          onPause={() => window.api.sendPlaybackState(false)}
        />
      )
    }

    return null
  }, [content, handleTimeUpdate])

  return (
    <div
      className={`relative h-screen p-2 ${
        isHovering ? 'bg-blue-900 cursor-move' : 'bg-black'
      } transition-colors`}
      onMouseEnter={() => {
        setIsHovering(true)
        window.api.notifyMouseEvent('enter')
      }}
      onMouseLeave={() => {
        setIsHovering(false)
        window.api.notifyMouseEvent('leave')
      }}
      onMouseDown={handleMouseDown}
    >
      {isDragging && <div className="absolute inset-0 z-10" />}
      {/* Non-draggable content area */}
      <div
        className={`w-full h-full bg-black rounded-lg overflow-hidden ${
          isContextHovering ? 'hovering' : ''
        }`}
        onMouseEnter={() => {
          setIsHovering(false)
          setIsContextHovering(true)
        }}
        onMouseLeave={() => {
          setIsHovering(true)
          setIsContextHovering(false)
        }}
      >
        {renderedContent}
        {alwaysOnTopIndicator && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div
              key={alwaysOnTopIndicator.key}
              className="bg-black bg-opacity-60 text-white text-lg px-4 py-2 rounded-md animate-zoom-in-out"
            >
              Always On Top: {alwaysOnTopIndicator.status ? 'On' : 'Off'}
            </div>
          </div>
        )}
        <div className="absolute left-2 bottom-2">
          <RadialMenu
            reset={false}
            onServiceChange={handleServiceChange}
            onHistoryBack={handleHistoryBack}
            onReload={handleReload}
            onFileOpen={handleFileOpen}
          />
        </div>
        <div className="absolute right-2 bottom-2">
          <SettingsMenu />
        </div>
      </div>
    </div>
  )
}

export default App
