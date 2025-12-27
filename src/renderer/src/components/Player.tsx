import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Service } from '../../../config/services'
import { logger } from '../logger'

interface PlayerProps {
  service: Service
}

interface WebViewElement extends HTMLWebViewElement {
  goBack: () => void
  reload: () => void
}

export interface PlayerRef {
  goBack: () => void
  reload: () => void
}

const Player = forwardRef<PlayerRef, PlayerProps>(({ service }, ref) => {
  const webviewRef = useRef<WebViewElement>(null)
  const [loading, setLoading] = useState(true)
  const [netflixPreload, setNetflixPreload] = useState<string>('')

  useEffect(() => {
    if (service.name === 'Netflix') {
      window.api
        .getNetflixPreloadPath()
        .then((path) => {
          setNetflixPreload(`file://${path}`)
        })
        .catch((err) => {
          console.error('[Player] Failed to get preload path:', err)
        })
    } else {
      setNetflixPreload('')
    }
  }, [service.name])

  useImperativeHandle(ref, () => ({
    goBack: () => {
      webviewRef.current?.goBack()
    },
    reload: () => {
      webviewRef.current?.reload()
    }
  }))

  useEffect(() => {
    setLoading(true)
    const webview = webviewRef.current
    if (!webview) {
      return
    }

    window.api.setLastContent({
      type: 'service',
      data: {
        name: service.name,
        ...(service.url && service.name === 'Custom URL' ? { url: service.url } : {})
      }
    })

    const handleStartLoading = (): void => {
      logger.log('webview', 'webview loading started')
    }

    const handleStopLoading = (): void => {
      logger.log('webview', 'webview loading stopped')
    }

    const handleFinishLoad = (): void => {
      logger.log('webview', 'webview loading finished')
      setLoading(false)
    }

    const handleDomReady = (): void => {
      logger.log('webview', 'webview dom-ready')
      // if (import.meta.env.DEV) {
      //   webview.openDevTools()
      // }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown'
      ) {
        webview.sendInputEvent({ type: 'keyDown', keyCode: e.key })
      }
    }

    webview.addEventListener('did-finish-load', handleFinishLoad)
    webview.addEventListener('dom-ready', handleDomReady)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading)
      webview.removeEventListener('did-stop-loading', handleStopLoading)
      webview.removeEventListener('did-finish-load', handleFinishLoad)
      webview.removeEventListener('dom-ready', handleDomReady)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [service, netflixPreload])

  return (
    <>
      {loading && (
        <div className="loader">
          <div className="ripple" style={{ backgroundColor: service.color }} />
          {service.icon && <img src={service.icon} alt={service.name} />}
        </div>
      )}
      <webview
        key={service.name + (service.name === 'Netflix' ? netflixPreload : '')}
        ref={webviewRef}
        src={service.url}
        className={`w-full h-full ${loading ? 'hidden' : ''}`}
        {...(service.name === 'Netflix' && netflixPreload ? { preload: netflixPreload } : {})}
      />
    </>
  )
})

Player.displayName = 'Player'

export default Player
