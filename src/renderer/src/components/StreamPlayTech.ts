import videojs from 'video.js'

const Tech = videojs.getComponent('Tech')
const Html5 = Tech.getTech('Html5')

// Ensure the base class is available
if (!Html5) {
  throw new Error('The Html5 tech was not found. Is video.js loaded?')
}

class StreamPlayTech extends Html5 {
  private _actualDuration: number
  private _startTime: number

  constructor(options, ready: () => void) {
    super(options, ready)
    this._actualDuration = options.duration || 0
    this._startTime = 0
  }

  duration(): number {
    return this._actualDuration || 60
  }

  setCurrentTime(seconds: number): void {
    this._startTime = seconds
    try {
      // The source URL needs to be constructed based on the new start time
      const src = `http://127.0.0.1:8888?startTime=${seconds}`
      this.setSrc(src)
    } catch (e) {
      videojs.log.warn('Video is not ready to receive new source. (Video.js)', e)
    }
  }

  currentTime(): number {
    // The `el()` method returns the underlying HTMLVideoElement
    return this._startTime + this.el().currentTime
  }
}

// Register the new Tech if it's not already registered
if (Tech.getTech('StreamPlay')) {
  videojs.log.warn('Not registering videojs-StreamPlay as it appears to already be registered.')
} else {
  videojs.registerTech('StreamPlay', StreamPlayTech)
}

export default StreamPlayTech
