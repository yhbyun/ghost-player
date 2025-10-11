import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg'
import ffmpeg from 'fluent-ffmpeg'
import http from 'http'
import { PassThrough } from 'stream'

ffmpeg.setFfmpegPath(ffmpegPath)

function getParam(url: string, key: string): string | null {
  const params = new URLSearchParams(url.split('?')[1])
  return params.get(key)
}

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

  public set videoSourceInfo(info: VideoSourceInfo | undefined) {
    this._videoSourceInfo = info
  }

  public get videoSourceInfo(): VideoSourceInfo | undefined {
    return this._videoSourceInfo
  }

  public killFfmpegCommand(): void {
    if (this._ffmpegCommand) {
      this._ffmpegCommand.kill()
    }
  }

  public createServer(): void {
    if (this._videoServer || !this.videoSourceInfo) {
      return
    }

    this._videoServer = http
      .createServer((request, response) => {
        if (!this.videoSourceInfo || !request.url) {
          response.statusCode = 400
          response.end('Video source info is not set.')
          return
        }
        console.log('on request', request.url)

        const startTimeStr = getParam(request.url, 'startTime')
        const startTime = startTimeStr ? parseInt(startTimeStr, 10) : 0

        if (isNaN(startTime)) {
          response.statusCode = 400
          response.end('Invalid startTime parameter.')
          return
        }

        const videoCodec = this.videoSourceInfo.checkResult.videoCodecSupport ? 'copy' : 'libx264'
        const audioCodec = this.videoSourceInfo.checkResult.audioCodecSupport ? 'copy' : 'aac'

        this.killFfmpegCommand()

        this._ffmpegCommand = ffmpeg()
          .input(this.videoSourceInfo.videoSourcePath)
          .nativeFramerate()
          .videoCodec(videoCodec)
          .audioCodec(audioCodec)
          .format('mp4')
          .seekInput(startTime)
          .outputOptions('-movflags', 'frag_keyframe+empty_moov+faststart', '-g', '18')
          .on('progress', function (progress) {
            console.log('time: ' + progress.timemark)
          })
          .on('error', function (err) {
            console.log('An error occurred: ' + err.message)
          })
          .on('end', function () {
            console.log('Processing finished !')
          })

        const videoStream: PassThrough = this._ffmpegCommand.pipe()
        videoStream.pipe(response)
      })
      .listen(8888, () => {
        console.log('Video server listening on port 8888')
      })
  }

  public closeServer(): void {
    this._videoServer?.close()
    this.killFfmpegCommand()
  }
}
