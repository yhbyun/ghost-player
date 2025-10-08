import React, { useState, useRef, useEffect } from 'react'
import { Service } from '../../../config/services'
import { logger } from '../logger'

interface PlayerProps {
  service: Service
}

const Player: React.FC<PlayerProps> = ({ service }) => {
  const webviewRef = useRef<HTMLWebViewElement>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) {
      return
    }

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

    webview.addEventListener('did-start-loading', handleStartLoading)
    webview.addEventListener('did-stop-loading', handleStopLoading)
    webview.addEventListener('did-finish-load', handleFinishLoad)
    webview.addEventListener('dom-ready', handleDomReady)

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading)
      webview.removeEventListener('did-stop-loading', handleStopLoading)
      webview.removeEventListener('did-finish-load', handleFinishLoad)
      webview.removeEventListener('dom-ready', handleDomReady)
    }
  }, [service])

  return (
    <>
      {loading && (
        <div className="loader">
          <div className="ripple" style={{ backgroundColor: service.color }} />
          <img src={service.icon} alt={service.name} />
        </div>
      )}
      <webview
        ref={webviewRef}
        src={service.url}
        className={`w-full h-full ${loading ? 'hidden' : ''}`}
      />
    </>
  )
}

export default Player
