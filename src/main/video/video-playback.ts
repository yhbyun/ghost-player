import { BrowserWindow, dialog, protocol } from 'electron'
import { promises as fs, createReadStream } from 'fs'
import { videoSupport } from './ffmpeg-helper'
import VideoServer from './video-server'
import { PlayParams } from '../../types'
import { logger } from '../logger'

let httpServer: VideoServer | undefined

import { convertToVtt } from './subtitle-converter'

export const registerLocalFileProtocols = (): void => {
  // local-video 프로토콜: 대용량 비디오 파일을 스트리밍하기 위해 최적화된 Range 처리 로직 구현
  protocol.handle('local-video', async (request) => {
    try {
      // url.pathname을 쓰면 macOS에서 /Users/.. 의 Users 부분이 host로 오인되어 누락될 수 있습니다.
      let filePath = decodeURIComponent(request.url.slice(request.url.indexOf(':') + 1))
      filePath = filePath.replace(/^[/]+/, '/')
      if (process.platform !== 'win32' && !filePath.startsWith('/')) {
        filePath = '/' + filePath
      }

      const stat = await fs.stat(filePath)
      const fileSize = stat.size
      const range = request.headers.get('range')

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunksize = end - start + 1
        const file = createReadStream(filePath, { start, end })

        logger.log('video', `Serving range request: ${start}-${end}/${fileSize}`)

        const headers = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': 'video/mp4',
          'Access-Control-Allow-Origin': '*'
        }
        return new Response(file as any, { status: 206, headers })
      } else {
        logger.log('video', `Serving full file: ${fileSize} bytes`)
        const file = createReadStream(filePath)
        const headers = {
          'Content-Length': fileSize.toString(),
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        }
        return new Response(file as any, { status: 200, headers })
      }
    } catch (error) {
      logger.error('video', `Failed to handle local-video request: ${request.url}`, error)
      return new Response('Not Found', { status: 404 })
    }
  })

  // local-subtitle 프로토콜: SRT, SMI 자막을 VTT로 자동 변환하여 지원
  protocol.handle('local-subtitle', async (request) => {
    logger.log('video', `Received local-subtitle request: ${request.url}`)
    try {
      const filePath = decodeURIComponent(request.url.slice('local-subtitle:'.length))
      logger.log('video', `Converting subtitle: ${filePath}`)
      const vttContent = await convertToVtt(filePath)
      logger.log('video', `Conversion complete. VTT length: ${vttContent.length}`)

      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/vtt; charset=utf-8'
      }

      return new Response(vttContent, {
        status: 200,
        headers
      })
    } catch (error) {
      logger.error('video', `Failed to handle local-subtitle request: ${request.url}`, error)
      return new Response('Not Found', { status: 404 })
    }
  })
}

const findSubtitle = async (videoFile: string): Promise<string | undefined> => {
  const subtitleExtensions = ['.srt', '.vtt', '.smi', '.SRT', '.VTT', '.SMI']
  const videoFileWithoutExt = videoFile.substring(0, videoFile.lastIndexOf('.'))
  logger.log('video', `Searching subtitles for: ${videoFileWithoutExt}`)
  for (const ext of subtitleExtensions) {
    const subtitleFile = videoFileWithoutExt + ext
    try {
      await fs.access(subtitleFile)
      logger.log('video', `Found subtitle: ${subtitleFile}`)
      return subtitleFile
    } catch {
      // file not found
    }
  }
  logger.log('video', 'No subtitle file found.')
  return undefined
}

export const playVideo = async (mainWindow: BrowserWindow, videoFile: string): Promise<void> => {
  logger.log('video', `playVideo called for: ${videoFile}`)
  const subtitleFile = await findSubtitle(videoFile)

  try {
    const checkResult = await videoSupport(videoFile)
    if (checkResult.videoCodecSupport && checkResult.audioCodecSupport) {
      if (httpServer) {
        httpServer.closeServer()
        httpServer = undefined
      }
      const playParams: PlayParams = {
        type: 'native',
        videoSource: 'local-video:' + encodeURI(videoFile)
      }
      if (subtitleFile) {
        playParams.subtitleSource = 'local-subtitle:' + encodeURI(subtitleFile)
      }
      console.log(playParams)
      mainWindow?.webContents.send('open-file', playParams)
    } else {
      if (!httpServer) {
        httpServer = new VideoServer()
      }
      httpServer.videoSourceInfo = {
        videoSourcePath: videoFile,
        checkResult: checkResult
      }
      if (subtitleFile) {
        httpServer.subtitlePath = subtitleFile
      }

      httpServer.createServer(() => {
        console.log('createVideoServer success')

        const playParams: PlayParams = {
          type: 'stream',
          videoSource: 'http://127.0.0.1:8888/video.mp4',
          duration: checkResult.duration
        }
        if (subtitleFile) {
          playParams.subtitleSource = 'http://127.0.0.1:8888/subtitle'
        }
        console.log(playParams)
        mainWindow?.webContents.send('open-file', playParams)
      })
    }
  } catch (err: unknown) {
    console.error('video format error', err)
    const options = {
      type: 'info' as const,
      title: 'Error',
      message: 'It is not a video file!',
      buttons: ['OK']
    }

    dialog.showMessageBox(options).then((result) => {
      console.log('showMessageBox', result.response)
    })
  }
}
