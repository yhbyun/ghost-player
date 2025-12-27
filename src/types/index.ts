export interface PlayParams {
  type: 'native' | 'stream'
  videoSource: string
  subtitleSource?: string
  duration?: number
  currentTime?: number
}

export interface PlaylistItem {
  id: string
  title: string
  params: PlayParams
}

export type Content =
  | { type: 'service'; data: { name: string; url?: string; icon?: string; color?: string } }
  | { type: 'video'; data: PlayParams }
  | { type: 'playlist'; data: { items: PlaylistItem[]; currentIndex: number } }
