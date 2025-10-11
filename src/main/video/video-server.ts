import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg'
import ffmpeg from 'fluent-ffmpeg'
import http from 'http'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { logger } from '../logger'

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
  private _hlsPath: string | undefined
  private _canUseHardwareAcceleration = false

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

  private _cleanupHlsFiles(): void {
    if (this._hlsPath && fs.existsSync(this._hlsPath)) {
      logger.log('video', `Cleaning up HLS files in ${this._hlsPath}`)
      fs.rmSync(this._hlsPath, { recursive: true, force: true })
    }
  }

  public createServer(onReady: () => void): void {
    if (this._videoServer || !this.videoSourceInfo) {
      logger.log(
        'video',
        'Server not created: server already exists or videoSourceInfo is missing.'
      )
      return
    }

    // Check for hardware acceleration support before starting the server
    ffmpeg.getAvailableEncoders((err, encoders) => {
      if (err) {
        console.error('Could not get available encoders:', err)
      } else {
        if (encoders['h264_videotoolbox']) {
          this._canUseHardwareAcceleration = true
          logger.log('video', 'Hardware acceleration (h264_videotoolbox) is available.')
        } else {
          logger.log(
            'video',
            'Hardware acceleration (h264_videotoolbox) is not available. Falling back to software encoding.'
          )
        }
      }

      this._cleanupHlsFiles()
      this._hlsPath = fs.mkdtempSync(path.join(os.tmpdir(), 'hls-'))
      logger.log('video', `Created HLS temporary directory: ${this._hlsPath}`)

      this._videoServer = http
        .createServer((request, response) => {
          if (!this.videoSourceInfo || !request.url || !this._hlsPath) {
            console.error('Bad Request: Missing video source info, URL, or HLS path.')
            response.statusCode = 400
            response.end('Video source info is not set.')
            return
          }

          logger.log('video', `[SERVER] Incoming request: ${request.url}`)
          const requestUrl = request.url.split('?')[0]

          if (requestUrl.endsWith('.m3u8')) {
            this._handleM3u8Request(request, response)
          } else if (requestUrl.endsWith('.ts')) {
            this._handleTsRequest(request, response)
          } else {
            console.error(`[SERVER] 404 Not Found: ${request.url}`)
            response.statusCode = 404
            response.end('Not Found')
          }
        })
        .listen(8888, () => {
          logger.log('video', 'Video server listening on port 8888')
          onReady()
        })
    })
  }

  private _handleM3u8Request(request: http.IncomingMessage, response: http.ServerResponse): void {
    if (!this.videoSourceInfo || !this._hlsPath || !request.url) return
    logger.log('video', `[M3U8] Handling playlist request.`)

    const outputPath = path.join(this._hlsPath, 'stream.m3u8')

    // Only start ffmpeg if it's not already running
    if (!this._ffmpegCommand) {
      logger.log('video', '[M3U8] No active ffmpeg command. Starting new one.')
      this.killFfmpegCommand() // Clean up any zombie process just in case

      const startTimeStr = getParam(request.url, 'startTime')
      const startTime = startTimeStr ? parseInt(startTimeStr, 10) : 0
      if (isNaN(startTime)) {
        console.error(`[M3U8] Invalid startTime parameter.`)
        response.statusCode = 400
        response.end('Invalid startTime parameter.')
        return
      }

      // Use hardware acceleration (VideoToolbox on macOS) if available for much faster transcoding.
      // This offloads the work from the CPU to the dedicated media engine.
      const videoCodec = this.videoSourceInfo.checkResult.videoCodecSupport
        ? 'copy'
        : this._canUseHardwareAcceleration
          ? 'h264_videotoolbox'
          : 'libx264'
      const audioCodec = this.videoSourceInfo.checkResult.audioCodecSupport ? 'copy' : 'aac'

      this._ffmpegCommand = ffmpeg(this.videoSourceInfo.videoSourcePath)
        .seekInput(startTime)
        .videoCodec(videoCodec)
        .audioCodec(audioCodec)
        .addOptions([
          '-sn', // Disable subtitle processing
          '-f hls',
          '-hls_time 2', // 2-second segments
          '-hls_list_size 6', // 6 segments in playlist
          '-hls_flags delete_segments'
        ])
        .on('start', (commandLine) => {
          logger.log('video', `[FFMPEG] Spawned: ${commandLine}`)
        })
        .on('stderr', (stderrLine) => {
          logger.log('video', `[FFMPEG STDERR] ${stderrLine}`)
        })
        .on('end', () => {
          logger.log('video', '[FFMPEG] Processing finished.')
          this._ffmpegCommand = undefined
        })
        .on('error', (err) => {
          console.error('[FFMPEG] Error:', err.message)
          this._ffmpegCommand = undefined
        })
        .output(outputPath)

      this._ffmpegCommand.run()
    } else {
      logger.log('video', '[M3U8] ffmpeg command already running. Serving existing playlist.')
    }

    // Wait for the m3u8 file to be created
    let waitTries = 0
    const maxWaitTries = 300 // 30 seconds
    const waitForFile = setInterval(() => {
      if (fs.existsSync(outputPath)) {
        clearInterval(waitForFile)
        logger.log('video', `[M3U8] Playlist found. Sending response.`)
        response.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*'
        })
        fs.createReadStream(outputPath).pipe(response)
      } else {
        waitTries++
        if (waitTries > maxWaitTries) {
          clearInterval(waitForFile)
          console.error(`[M3U8] Timeout: Playlist file not created at ${outputPath}`)
          response.statusCode = 500
          response.end('Playlist generation failed.')
        }
      }
    }, 100)
  }

  private _handleTsRequest(request: http.IncomingMessage, response: http.ServerResponse): void {
    if (!this._hlsPath || !request.url) return

    const fileName = path.basename(request.url.split('?')[0])
    const filePath = path.join(this._hlsPath, fileName)
    logger.log('video', `[TS] Handling segment request for: ${fileName}`)

    if (fs.existsSync(filePath)) {
      logger.log('video', `[TS] Found segment, sending: ${filePath}`)
      response.writeHead(200, {
        'Content-Type': 'video/mp2t',
        'Access-Control-Allow-Origin': '*'
      })
      fs.createReadStream(filePath).pipe(response)
    } else {
      console.error(`[TS] Segment not found: ${filePath}`)
      response.statusCode = 404
      response.end('Not Found')
    }
  }

  public closeServer(): void {
    logger.log('video', 'Closing video server.')
    this._videoServer?.close()
    this.killFfmpegCommand()
    this._cleanupHlsFiles()
  }
}
