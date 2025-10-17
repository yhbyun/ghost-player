import { useState, useRef, useEffect } from 'react'
import { logger } from './logger'
import Player, { PlayerRef } from './components/Player'
import RadialMenu from './components/RadialMenu'
import SettingsMenu from './components/SettingsMenu'
import VideoPlayer from './components/VideoPlayer'
import { Service, services } from '../../config/services'
import { PlayParams } from '../../types'

type ContentSource = { type: 'service'; data: Service } | { type: 'video'; data: PlayParams }

function App(): React.JSX.Element {
  const [content, setContent] = useState<ContentSource | undefined>(undefined)
  const [isHovering, setIsHovering] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isContextHovering, setIsContextHovering] = useState(false)
  const [isSettingsMenuExpanded, setIsSettingsMenuExpanded] = useState(false)
  const playerRef = useRef<PlayerRef>(null)

  useEffect(() => {
    const fetchInitialService = async (): Promise<void> => {
      const initialService = await window.api.getInitialService()
      if (initialService) {
        setContent({ type: 'service', data: initialService })
      }
    }
    fetchInitialService()

    const cleanupOnChangeService = window.api.onChangeService((newService) => {
      setContent({ type: 'service', data: newService })
    })

    const cleanupOnOpenLocation = window.api.onOpenLocation((url) => {
      setContent({ type: 'video', data: { type: 'native', videoSource: url } })
    })

    const cleanupOnOpenFile = window.api.onOpenFile((playParams) => {
      console.log('cleanupOnOpenFile', playParams)
      setContent({ type: 'video', data: playParams })
    })

    return () => {
      cleanupOnChangeService()
      cleanupOnOpenLocation()
      cleanupOnOpenFile()
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
      setContent({ type: 'service', data: newService })
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

  const renderContent = (): React.JSX.Element | null => {
    if (!content) {
      return null
    }

    if (content.type === 'service') {
      return <Player ref={playerRef} key={content.data.name} service={content.data} />
    }

    if (content.type === 'video') {
      const { videoSource, duration, subtitleSource } = content.data
      const mimeType = content.data.videoSource.endsWith('.m3u8')
        ? 'application/x-mpegURL'
        : 'video/mp4'
      return (
        <VideoPlayer
          src={videoSource}
          type={mimeType}
          duration={duration}
          subtitleSrc={subtitleSource}
        />
      )
    }

    return null
  }

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
        className={`w-full h-full bg-black rounded-lg overflow-hidden ${isContextHovering ? 'hovering' : ''}`}
        onMouseEnter={() => {
          setIsHovering(false)
          setIsContextHovering(true)
        }}
        onMouseLeave={() => {
          setIsHovering(true)
          setIsContextHovering(false)
        }}
      >
        {renderContent()}
        {isSettingsMenuExpanded && (
          <div
            className="absolute inset-0 z-50"
            onClick={() => setIsSettingsMenuExpanded(false)}
          />
        )}
        <div className="absolute left-2 bottom-2">
          <RadialMenu
            reset={false}
            onServiceChange={handleServiceChange}
            onHistoryBack={handleHistoryBack}
            onReload={handleReload}
          />
        </div>
        <div className="absolute right-2 bottom-2">
          <SettingsMenu
            expanded={isSettingsMenuExpanded}
            onToggle={() => setIsSettingsMenuExpanded(!isSettingsMenuExpanded)}
          />
        </div>
      </div>
    </div>
  )
}

export default App
