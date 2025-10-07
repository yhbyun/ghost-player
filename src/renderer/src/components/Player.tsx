import React from 'react'

interface PlayerProps {
  url: string
}

const Player: React.FC<PlayerProps> = ({ url }) => {
  return <webview src={url} className="w-full h-full" />
}

export default Player
