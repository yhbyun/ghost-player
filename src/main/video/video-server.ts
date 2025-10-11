import http from 'http'
import { logger } from '../logger'
import ffmpeg from 'fluent-ffmpeg'
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg'

ffmpeg.setFfmpegPath(ffmpegPath)

export interface VideoSourceInfo {
  videoSourcePath: string
  checkResult: {
    videoCodecSupport: boolean
    audioCodecSupport: boolean
  }
}

export default class VideoServer {
  private _videoServer: http.Server | undefined
  private _videoSourceInfo: VideoSourceInfo | undefined
  private _ffmpegCommand: ffmpeg.FfmpegCommand | undefined
  private static _canUseHardwareAcceleration: boolean | null = null

  public set videoSourceInfo(info: VideoSourceInfo | undefined) {
    this._videoSourceInfo = info
  }

  public get videoSourceInfo(): VideoSourceInfo | undefined {
    return this._videoSourceInfo
  }

  public killFfmpegCommand(): void {
    if (this._ffmpegCommand) {
      logger.log('video', 'Killing existing ffmpeg command.')
      this._ffmpegCommand.kill('SIGTERM')
      this._ffmpegCommand = undefined
    }
  }

  private static _checkHardwareAcceleration(callback: () => void): void {
    if (VideoServer._canUseHardwareAcceleration !== null) {
      return callback()
    }

    ffmpeg.getAvailableEncoders((err, encoders) => {
      if (err) {
        logger.error('Could not get available encoders:', err)
        VideoServer._canUseHardwareAcceleration = false
      } else {
        VideoServer._canUseHardwareAcceleration = !!encoders['h264_videotoolbox']
        logger.log(
          'video',
          `Hardware acceleration available: ${VideoServer._canUseHardwareAcceleration}`
        )
      }
      callback()
    })
  }

  public createServer(onReady: () => void): void {
    if (this._videoServer || !this.videoSourceInfo) {
      return
    }

    VideoServer._checkHardwareAcceleration(() => {
      this._videoServer = http
        .createServer((request, response) => {
          if (!this.videoSourceInfo || !this.videoSourceInfo.videoSourcePath) {
            response.statusCode = 400
            response.end('Video source info is not set.')
            return
          }

          const videoPath = this.videoSourceInfo.videoSourcePath
          const videoCodec = this.videoSourceInfo.checkResult.videoCodecSupport
            ? 'copy'
            : VideoServer._canUseHardwareAcceleration
              ? 'h264_videotoolbox'
              : 'libx264'
          const audioCodec = this.videoSourceInfo.checkResult.audioCodecSupport ? 'copy' : 'aac'

          // Set headers for streaming
          response.writeHead(200, {
            'Content-Type': 'video/mp4',
            Connection: 'keep-alive'
          })

          this.killFfmpegCommand()

          this._ffmpegCommand = ffmpeg(videoPath)
            .videoCodec(videoCodec)
            .audioCodec(audioCodec)
            .format('mp4')
            .addOptions(['-movflags frag_keyframe+empty_moov']) // Essential for streaming
            .on('start', (cmd) => logger.log('video', `[FFMPEG] Spawned: ${cmd}`))
            .on('error', (err, stdout, stderr) => {
              if (err.message.includes('SIGTERM')) {
                logger.log('video', '[FFMPEG] Process killed intentionally.')
              } else {
                logger.error('[FFMPEG] Error:', err.message)
                logger.error('[FFMPEG] STDOUT:', stdout)
                logger.error('[FFMPEG] STDERR:', stderr)
              }
            })
            .on('end', () => {
              logger.log('video', '[FFMPEG] Processing finished.')
            })

          // Pipe the ffmpeg output directly to the response
          const ffmpegStream = this._ffmpegCommand.pipe()
          ffmpegStream.pipe(response)

          // Handle client disconnect
          request.on('close', () => {
            logger.log('video', 'Client disconnected, killing ffmpeg.')
            this.killFfmpegCommand()
          })
        })
        .listen(8888, () => {
          logger.log('video', 'Video server (MP4 stream) listening on port 8888')
          onReady()
        })
    })
  }

  public closeServer(): void {
    logger.log('video', 'Closing video server.')
    this._videoServer?.close()
    this.killFfmpegCommand()
  }
}
