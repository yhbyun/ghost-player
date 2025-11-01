// src/main/local-transcriber.ts
import { pipeline, AutomaticSpeechRecognitionPipeline } from '@xenova/transformers'
import { logger } from './logger'
import wavefile from 'wavefile'

class LocalTranscriber {
  private static instance: LocalTranscriber | null = null
  private transcriber: AutomaticSpeechRecognitionPipeline | null = null
  private isModelLoading = false

  private constructor() {
    this.initializeModel()
  }

  public static getInstance(): LocalTranscriber {
    if (!LocalTranscriber.instance) {
      LocalTranscriber.instance = new LocalTranscriber()
    }
    return LocalTranscriber.instance
  }

  private async initializeModel(): Promise<void> {
    if (this.transcriber || this.isModelLoading) {
      return
    }

    this.isModelLoading = true

    logger.log('LocalTranscriber', 'Starting model initialization...')

    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Model initialization timed out after 60 seconds.')), 60000)
    )

    try {
      logger.log('LocalTranscriber', 'Calling pipeline for model loading...')

      this.transcriber = await Promise.race([
        pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny'),
        timeoutPromise
      ])

      logger.log('LocalTranscriber', 'Model initialized successfully.')
    } catch (error) {
      logger.error('LocalTranscriber', 'Failed to initialize model:', error)

      this.transcriber = null // Ensure transcriber is null on failure
    } finally {
      this.isModelLoading = false
    }
  }

  public async transcribe(audioBuffer: Buffer): Promise<string> {
    // This is a special case for pre-loading the model
    if (audioBuffer.length === 0) {
      if (!this.transcriber && !this.isModelLoading) {
        await this.initializeModel()
      }
      return ''
    }

    if (!this.transcriber) {
      if (this.isModelLoading) {
        logger.log('LocalTranscriber', 'Model is still loading. Waiting...')
        // Wait for the model to finish loading
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (!this.isModelLoading) {
              clearInterval(checkInterval)
              resolve()
            }
          }, 500)
        })
      } else {
        // In case loading failed, try one more time.
        await this.initializeModel()
      }
    }

    if (!this.transcriber) {
      throw new Error('Transcription model is not available.')
    }

    try {
      logger.log('LocalTranscriber', `Received audio buffer of size: ${audioBuffer.length}`)

      const wav = new wavefile.WaveFile(audioBuffer)

      // 디버깅: WAV 파일 정보 출력
      logger.log(
        'LocalTranscriber',
        `Original WAV - Sample Rate: ${wav.fmt.sampleRate}, Channels: ${wav.fmt.numChannels}, Bit Depth: ${wav.fmt.bitsPerSample}`
      )

      // Ensure audio is 16kHz
      wav.toSampleRate(16000)

      // Get audio samples as a Float32Array, interleaved if stereo
      const samples = wav.getSamples(true, Float32Array) as Float32Array

      let monoSamples: Float32Array

      // Convert to mono if necessary
      if (wav.fmt.numChannels > 1) {
        monoSamples = new Float32Array(samples.length / wav.fmt.numChannels)
        for (let i = 0; i < monoSamples.length; i++) {
          let sum = 0
          for (let j = 0; j < wav.fmt.numChannels; j++) {
            sum += samples[i * wav.fmt.numChannels + j]
          }
          monoSamples[i] = sum / wav.fmt.numChannels
        }
      } else {
        monoSamples = samples
      }

      // 디버깅: 정규화 전 샘플 값 범위 확인
      const minSampleBefore = Math.min(...Array.from(monoSamples).slice(0, 1000))
      const maxSampleBefore = Math.max(...Array.from(monoSamples).slice(0, 1000))
      logger.log(
        'LocalTranscriber',
        `Sample value range before normalization (first 1000): min=${minSampleBefore}, max=${maxSampleBefore}`
      )

      // Normalize to -1.0 to 1.0 range if needed
      const bitDepth = wav.fmt.bitsPerSample
      const maxValue = Math.pow(2, bitDepth - 1)

      logger.log(
        'LocalTranscriber',
        `Bit depth: ${bitDepth}, Max value for normalization: ${maxValue}`
      )

      // Check if normalization is needed
      const needsNormalization = Math.abs(maxSampleBefore) > 1.0 || Math.abs(minSampleBefore) > 1.0
      if (needsNormalization) {
        logger.log('LocalTranscriber', 'Normalizing samples to -1.0 ~ 1.0 range...')
        for (let i = 0; i < monoSamples.length; i++) {
          monoSamples[i] = monoSamples[i] / maxValue
        }
      }

      // 디버깅: 정규화 후 샘플 값 범위 확인
      const minSample = Math.min(...Array.from(monoSamples).slice(0, 1000))
      const maxSample = Math.max(...Array.from(monoSamples).slice(0, 1000))
      logger.log(
        'LocalTranscriber',
        `Sample value range after normalization (first 1000): min=${minSample}, max=${maxSample}`
      )

      // 오디오 길이 확인 (초 단위)
      const durationSeconds = monoSamples.length / 16000
      logger.log('LocalTranscriber', `Audio duration: ${durationSeconds.toFixed(2)} seconds`)

      logger.log(
        'LocalTranscriber',
        `Decoded audio. Sample rate: ${wav.fmt.sampleRate}, Channels: ${wav.fmt.numChannels}, Length: ${monoSamples.length}`
      )

      if (monoSamples.length === 0) {
        logger.log('LocalTranscriber', 'Audio samples are empty after processing. Skipping.')
        return ''
      }

      // 너무 짧은 오디오 체크 (0.1초 미만)
      if (durationSeconds < 0.1) {
        logger.log(
          'LocalTranscriber',
          'Audio is too short (< 0.1 seconds). Skipping transcription.'
        )
        return ''
      }

      logger.log('LocalTranscriber', 'Starting transcription...')

      // 트랜스크립션 옵션 추가
      // const output = await this.transcriber(monoSamples)
      const output = await this.transcriber(monoSamples, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'korean', // 또는 'english', 필요에 따라 변경
        task: 'transcribe'
      })

      // logger.log('LocalTranscriber', 'Transcription finished. Raw output:', output)
      logger.log(
        'LocalTranscriber',
        'Transcription finished. Raw output:',
        JSON.stringify(output, null, 2)
      )

      const text = typeof output === 'string' ? output : output.text
      return text.trim()
    } catch (error) {
      logger.error('LocalTranscriber', 'Error during transcription:', error)
      throw error
    }
  }
}

export const localTranscriber = LocalTranscriber.getInstance()
