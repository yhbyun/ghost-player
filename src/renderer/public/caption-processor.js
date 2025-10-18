class CaptionProcessor extends AudioWorkletProcessor {
  _isCapturing = false

  constructor() {
    super()
    this.port.onmessage = (event) => {
      if (event.data.type === 'TOGGLE_CAPTURE') {
        this._isCapturing = event.data.isCapturing
      }
    }
  }

  process(inputs) {
    if (!this._isCapturing) {
      return true // Keep processor alive but do nothing
    }

    const input = inputs[0]
    const channelData = input[0]

    if (channelData) {
      this.port.postMessage(channelData.slice(0))
    }

    return true
  }
}

registerProcessor('caption-processor', CaptionProcessor)