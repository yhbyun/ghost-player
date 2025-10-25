class CaptionProcessor extends AudioWorkletProcessor {
  _isCapturing = false
  _targetSampleRate = 16000
  _resampleBuffer = []

  constructor() {
    super()
    this.port.onmessage = (event) => {
      if (event.data.type === 'TOGGLE_CAPTURE') {
        this._isCapturing = event.data.isCapturing
        if (!this._isCapturing) {
          this._resampleBuffer = [] // Clear buffer when stopping
        }
      }
    }
  }

  // Resamples and converts to mono
  process(inputs) {
    if (!this._isCapturing || !inputs[0] || !inputs[0][0]) {
      return true
    }

    const inputData = inputs[0]
    const numChannels = inputData.length
    const inputLength = inputData[0].length

    // 1. Convert to Mono by averaging channels
    const monoData = new Float32Array(inputLength)
    if (numChannels > 1) {
      for (let i = 0; i < inputLength; i++) {
        let sum = 0
        for (let j = 0; j < numChannels; j++) {
          sum += inputData[j][i]
        }
        monoData[i] = sum / numChannels
      }
    } else {
      monoData.set(inputData[0])
    }

    // 2. Resample from source sampleRate to targetSampleRate
    const sourceSampleRate = sampleRate
    const ratio = sourceSampleRate / this._targetSampleRate
    const outputLength = Math.floor(inputLength / ratio)
    const resampledData = new Float32Array(outputLength)

    for (let i = 0; i < outputLength; i++) {
      // Simple linear interpolation
      const before = Math.floor(i * ratio)
      const after = before + 1
      const atPoint = i * ratio - before

      resampledData[i] = monoData[before] + (monoData[after] - monoData[before]) * atPoint
    }

    if (resampledData.length > 0) {
      this.port.postMessage(resampledData)
    }

    return true
  }
}

registerProcessor('caption-processor', CaptionProcessor)