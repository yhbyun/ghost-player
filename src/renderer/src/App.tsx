import { useState, useRef, useEffect } from 'react'
import { logger } from './logger'
import Player from './components/Player'
import { Service } from '../../config/services'

function App(): React.JSX.Element {
  const [service, setService] = useState<Service | undefined>(undefined)
  const [isHovering, setIsHovering] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const fetchInitialService = async (): Promise<void> => {
      const initialService = await window.api.getInitialService()
      setService(initialService)
    }
    fetchInitialService()

    const cleanup = window.api.onChangeService((newService) => {
      setService(newService)
    })

    return cleanup
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

  if (!service) {
    return null // Or a loading spinner
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
        className="w-full h-full rounded-lg overflow-hidden"
        onMouseEnter={() => setIsHovering(false)}
        onMouseLeave={() => setIsHovering(true)}
      >
        <Player key={service.name} service={service} />
      </div>
    </div>
  )
}

export default App
