import { BrowserWindow, dialog, protocol } from 'electron'
import { promises as fs, createReadStream } from 'fs'
import { videoSupport } from './ffmpeg-helper'
import VideoServer from './video-server'
import { PlayParams } from '../../types'
import { logger } from '../logger'

let httpServer: VideoServer | undefined

export const registerLocalFileProtocols = (): void => {
  protocol.handle('local-video', async (request) => {
    const filePath = decodeURIComponent(request.url.slice('local-video:'.length))

    try {
      const stat = await fs.stat(filePath)
      const fileSize = stat.size
      const range = request.headers.get('range')

      if (range) {
        logger.log('video', `Serving range request: ${range} for ${filePath}`)
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunksize = end - start + 1
        const file = createReadStream(filePath, { start, end })
        const headers = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': 'video/mp4'
        }
        return new Response(file, { status: 206, headers })
      } else {
        logger.log('video', `Serving full file: ${filePath}`)
        const headers = {
          'Content-Length': fileSize.toString(),
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes'
        }
        const file = createReadStream(filePath)
        return new Response(file, { status: 200, headers })
      }
    } catch (error) {
      logger.error('video', `Failed to fetch local video at path: ${filePath}`, error)
      return new Response('Not Found', { status: 404 })
    }
  })

  protocol.handle('local-subtitle', async (request) => {
    const filePath = decodeURIComponent(request.url.slice('local-subtitle:'.length))
    try {
      const data = await fs.readFile(filePath)
      const headers = {
        'Content-Type': 'text/vtt',
        'Access-Control-Allow-Origin': '*'
      }
      return new Response(data, { status: 200, headers })
    } catch (error) {
      logger.error('video', `Failed to fetch local subtitle at path: ${filePath}`, error)
      return new Response('Not Found', { status: 404 })
    }
  })
}

const findSubtitle = async (videoFile: string): Promise<string | undefined> => {
  const subtitleExtensions = ['.srt', '.vtt', '.smi']
  const videoFileWithoutExt = videoFile.substring(0, videoFile.lastIndexOf('.'))
  for (const ext of subtitleExtensions) {
    const subtitleFile = videoFileWithoutExt + ext
    try {
      await fs.access(subtitleFile)
      return subtitleFile
    } catch {
      // file not found
    }
  }
  return undefined
}

export const playVideo = async (mainWindow: BrowserWindow, videoFile: string): Promise<void> => {
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
        videoSource: 'local-video:' + videoFile
      }
      if (subtitleFile) {
        playParams.subtitleSource = 'local-subtitle:' + subtitleFile
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
