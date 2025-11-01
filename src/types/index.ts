export interface PlayParams {
  type: 'native' | 'stream'
  videoSource: string
  subtitleSource?: string
  duration?: number
  currentTime?: number
}

export type Content =
  | { type: 'service'; data: { name: string } }
  | { type: 'video'; data: PlayParams }
