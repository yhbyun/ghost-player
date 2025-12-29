import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { logger } from './logger'
import WebPlayer, { PlayerRef } from './components/Player'
import RadialMenu from './components/RadialMenu'
import SettingsMenu from './components/SettingsMenu'
import VideoPlayer from './components/VideoPlayer'
import PlaylistSidebar from './components/PlaylistSidebar'
import type Player from 'video.js/dist/types/player'
import { Service, services } from '../../config/services'
import { Content, PlaylistItem } from '../../types'

type ContentSource = Content

function App(): React.JSX.Element {
  const [content, setContent] = useState<ContentSource | undefined>(undefined)
  const [isHovering, setIsHovering] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isContextHovering, setIsContextHovering] = useState(false)
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false)
  const webPlayerRef = useRef<PlayerRef>(null)
  const videoPlayerRef = useRef<Player | null>(null)
  const [alwaysOnTopIndicator, setAlwaysOnTopIndicator] = useState<{
    status: boolean
    key: number
  } | null>(null)
  const alwaysOnTopTimeoutRef = useRef<number | null>(null)
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(-1)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const fetchInitialContent = async (): Promise<void> => {
      const initialContent = await window.api.getInitialContent()
      const initialPlaylist = (await window.api.getSetting('playlist', {
        items: [],
        currentIndex: -1
      })) as { items: PlaylistItem[]; currentIndex: number }

      setPlaylist(initialPlaylist.items || [])
      setCurrentIndex(initialPlaylist.currentIndex ?? -1)
      setIsLoaded(true)

      if (initialContent) {
        if (initialContent.type === 'service') {
          // Check if it's a custom URL
          if (initialContent.data.url) {
            const customService: Service = {
              name: 'Custom URL',
              icon: '',
              url: initialContent.data.url,
              color: '#4a90e2'
            }
            setContent({ type: 'service', data: customService })
          } else {
            // Built-in service
            const service = services.find((s) => s.name === initialContent.data.name)
            if (service) {
              setContent({ type: 'service', data: service })
            }
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

    const cleanupOnOpenUrl = window.api.onOpenUrl((url) => {
      // Create a custom service object for the URL
      const customService: Service = {
        name: 'Custom URL',
        icon: '', // Will use a default or empty icon
        url: url,
        color: '#4a90e2' // Default blue color
      }
      setContent({ type: 'service', data: customService })
      window.api.setLastContent({ type: 'service', data: { name: 'Custom URL', url: url } })
    })

    const cleanupOnOpenFile = window.api.onOpenFile((playParams) => {
      console.log('cleanupOnOpenFile', playParams)
      const fileName = playParams.videoSource.split('/').pop() || 'Untitled Video'
      const newItem: PlaylistItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        title: fileName,
        params: playParams
      }

      setPlaylist((prev) => {
        const alreadyExists = prev.some(
          (item) => item.params.videoSource === playParams.videoSource
        )
        if (alreadyExists) {
          // If already in playlist, play it immediately
          const existingIndex = prev.findIndex(
            (item) => item.params.videoSource === playParams.videoSource
          )
          const newContent = { type: 'video' as const, data: playParams }
          setContent(newContent)
          setCurrentIndex(existingIndex)
          window.api.setLastContent(newContent)
          return prev
        }

        const newPlaylist = [...prev, newItem]
        const newIndex = newPlaylist.length - 1

        // Always play the newly added video immediately
        const newContent = { type: 'video' as const, data: playParams }
        setContent(newContent)
        setCurrentIndex(newIndex)
        window.api.setLastContent(newContent)

        return newPlaylist
      })
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
      cleanupOnOpenUrl()
      cleanupOnOpenFile()
      cleanupOnPlaybackControl()
      cleanupOnAlwaysOnTopStatusChanged()
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) return

    window.api.setSetting('playlist', { items: playlist, currentIndex: currentIndex })

    if (content?.type === 'playlist') {
      window.api.setLastContent({
        type: 'playlist',
        data: {
          items: playlist,
          currentIndex: currentIndex
        }
      })
    }
  }, [playlist, currentIndex, content, isLoaded])

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
        startX: e.screenX,
        startY: e.screenY
      }
      setIsDragging(true)
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (dragRef.current.isDragging) {
        const deltaX = e.screenX - dragRef.current.startX
        const deltaY = e.screenY - dragRef.current.startY
        window.api.dragWindow(deltaX, deltaY)
        dragRef.current.startX = e.screenX
        dragRef.current.startY = e.screenY
      }
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

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsHovering(true)
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsHovering(false)
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const paths = files
      .map((f) => (f as unknown as { path: string }).path)
      .filter((p) => typeof p === 'string')

    if (paths.length > 0) {
      window.api.dropFiles(paths)
    }
  }

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
      webPlayerRef.current?.goBack()
    }
  }

  const handleReload = (): void => {
    if (content?.type === 'service') {
      webPlayerRef.current?.reload()
    }
  }

  const handleFileOpen = (): void => {
    window.api.openFile()
  }

  const playNext = useCallback(() => {
    if (currentIndex < playlist.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      const nextItem = playlist[nextIndex]
      setContent({ type: 'video', data: nextItem.params })
    }
  }, [currentIndex, playlist])

  const playPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      const prevItem = playlist[prevIndex]
      setContent({ type: 'video', data: prevItem.params })
    }
  }, [currentIndex, playlist])

  const selectPlaylistItem = useCallback(
    (index: number): void => {
      setCurrentIndex(index)
      setContent({ type: 'video', data: playlist[index].params })
    },
    [playlist]
  )

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
      } else if (content?.type === 'playlist') {
        const updatedPlaylist = [...playlist]
        if (currentIndex >= 0 && currentIndex < updatedPlaylist.length) {
          updatedPlaylist[currentIndex].params.currentTime = time
          setPlaylist(updatedPlaylist)
        }
      }
    },
    [content, playlist, currentIndex]
  )

  const renderedContent = useMemo(() => {
    if (!content) {
      return null
    }

    if (content.type === 'service') {
      return (
        <WebPlayer ref={webPlayerRef} key={content.data.name} service={content.data as Service} />
      )
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
          onEnded={playNext}
        />
      )
    }

    return null
  }, [content, handleTimeUpdate, playNext])

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
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
            onPlaylistToggle={() => setIsPlaylistOpen(!isPlaylistOpen)}
          />
        </div>
        <div className="absolute right-2 bottom-2">
          <SettingsMenu />
        </div>
        <PlaylistSidebar
          playlist={playlist}
          currentIndex={currentIndex}
          isOpen={isPlaylistOpen}
          onClose={() => setIsPlaylistOpen(false)}
          onSelectItem={selectPlaylistItem}
          onPlayNext={playNext}
          onPlayPrevious={playPrevious}
          onAddFile={handleFileOpen}
          onRemoveItem={(index: number) => {
            const newPlaylist = [...playlist]
            newPlaylist.splice(index, 1)
            setPlaylist(newPlaylist)
            if (index === currentIndex) {
              setCurrentIndex(-1)
              setContent(undefined)
            } else if (index < currentIndex) {
              setCurrentIndex(currentIndex - 1)
            }
          }}
        />
      </div>
    </div>
  )
}

export default App
