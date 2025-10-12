export interface PlayParams {
  type: 'native' | 'stream'
  videoSource: string
  subtitleSource?: string
  duration?: number
}
