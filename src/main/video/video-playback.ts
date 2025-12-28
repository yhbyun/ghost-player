import { BrowserWindow, dialog, protocol } from 'electron'
import { promises as fs, createReadStream } from 'fs'
import { videoSupport } from './ffmpeg-helper'
import VideoServer from './video-server'
import { PlayParams } from '../../types'
import { logger } from '../logger'
import {
  FileNotFoundError,
  FileAccessError,
  SubtitleConversionError,
  getUserFriendlyErrorMessage,
  isRecoverableError
} from './errors'

let httpServer: VideoServer | undefined

import { convertToVtt } from './subtitle-converter'

export const registerLocalFileProtocols = (): void => {
  // local-video 프로토콜: 대용량 비디오 파일을 스트리밍하기 위해 최적화된 Range 처리 로직 구현
  protocol.handle('local-video', async (request) => {
    let filePath = ''
    try {
      // url.pathname을 쓰면 macOS에서 /Users/.. 의 Users 부분이 host로 오인되어 누락될 수 있습니다.
      filePath = decodeURIComponent(request.url.slice(request.url.indexOf(':') + 1))
      filePath = filePath.replace(/^[/]+/, '/')
      if (process.platform !== 'win32' && !filePath.startsWith('/')) {
        filePath = '/' + filePath
      }

      logger.log('video', `Handling local-video request: ${filePath}`)

      // Check if file exists and get stats
      let stat
      try {
        stat = await fs.stat(filePath)
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error) {
          const fsError = error as NodeJS.ErrnoException
          if (fsError.code === 'ENOENT') {
            logger.error('video', `File not found: ${filePath}`)
            return new Response('File not found', { status: 404 })
          } else if (fsError.code === 'EACCES' || fsError.code === 'EPERM') {
            logger.error('video', `Permission denied: ${filePath}`)
            return new Response('Permission denied', { status: 403 })
          }
        }
        throw error
      }

      const fileSize = stat.size
      const range = request.headers.get('range')

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

        // Validate range
        if (isNaN(start) || isNaN(end) || start < 0 || end >= fileSize || start > end) {
          logger.error('video', `Invalid range: ${range}`)
          return new Response('Invalid range', { status: 416 })
        }

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
        return new Response(file as unknown as BodyInit, { status: 206, headers })
      } else {
        logger.log('video', `Serving full file: ${fileSize} bytes`)
        const file = createReadStream(filePath)
        const headers = {
          'Content-Length': fileSize.toString(),
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        }
        return new Response(file as unknown as BodyInit, { status: 200, headers })
      }
    } catch (error) {
      logger.error('video', `Failed to handle local-video request: ${request.url}`, error)
      return new Response('Internal Server Error', { status: 500 })
    }
  })

  // local-subtitle 프로토콜: SRT, SMI 자막을 VTT로 자동 변환하여 지원
  protocol.handle('local-subtitle', async (request) => {
    const requestUrl = request.url
    logger.log('video', `Received local-subtitle request: ${requestUrl}`)

    let filePath = ''
    try {
      filePath = decodeURIComponent(requestUrl.slice('local-subtitle:'.length))
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
      // Handle specific subtitle errors
      if (error instanceof SubtitleConversionError) {
        logger.error('video', `Subtitle conversion failed: ${filePath}`, error)
        return new Response('Subtitle conversion failed', { status: 500 })
      }

      if (error instanceof FileNotFoundError) {
        logger.error('video', `Subtitle file not found: ${filePath}`)
        return new Response('Subtitle file not found', { status: 404 })
      }

      if (error instanceof FileAccessError) {
        logger.error('video', `Cannot access subtitle file: ${filePath}`)
        return new Response('Permission denied', { status: 403 })
      }

      logger.error('video', `Failed to handle local-subtitle request: ${requestUrl}`, error)
      return new Response('Internal Server Error', { status: 500 })
    }
  })
}

const findSubtitle = async (videoFile: string): Promise<string | undefined> => {
  try {
    const subtitleExtensions = ['.srt', '.vtt', '.smi', '.SRT', '.VTT', '.SMI']
    const videoFileWithoutExt = videoFile.substring(0, videoFile.lastIndexOf('.'))

    if (!videoFileWithoutExt) {
      logger.warn('video', 'Cannot determine video filename without extension')
      return undefined
    }

    logger.log('video', `Searching subtitles for: ${videoFileWithoutExt}`)

    for (const ext of subtitleExtensions) {
      const subtitleFile = videoFileWithoutExt + ext
      try {
        await fs.access(subtitleFile)
        logger.log('video', `Found subtitle: ${subtitleFile}`)
        return subtitleFile
      } catch {
        // File not found, continue to next extension
      }
    }

    logger.log('video', 'No subtitle file found.')
    return undefined
  } catch (error) {
    logger.error('video', 'Error while searching for subtitles:', error)
    return undefined
  }
}

export const playVideo = async (mainWindow: BrowserWindow, videoFile: string): Promise<void> => {
  logger.log('video', `playVideo called for: ${videoFile}`)

  try {
    // Validate inputs
    if (!mainWindow) {
      throw new Error('mainWindow is required')
    }

    if (!videoFile || typeof videoFile !== 'string') {
      throw new Error('Invalid video file path')
    }

    // Check if file exists
    try {
      await fs.access(videoFile)
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error) {
        const fsError = error as NodeJS.ErrnoException
        if (fsError.code === 'ENOENT') {
          throw new FileNotFoundError(videoFile, error)
        } else if (fsError.code === 'EACCES' || fsError.code === 'EPERM') {
          throw new FileAccessError(videoFile, error)
        }
      }
      throw error
    }

    // Find subtitle file (non-critical, don't fail if not found)
    let subtitleFile: string | undefined
    try {
      subtitleFile = await findSubtitle(videoFile)
    } catch (error) {
      logger.warn('video', 'Failed to search for subtitles, continuing without them:', error)
    }

    // Check video codec support
    let checkResult
    try {
      checkResult = await videoSupport(videoFile)
      logger.log('video', 'Video format check result:', checkResult)
    } catch (error) {
      // Re-throw known errors
      if (error instanceof FileNotFoundError || error instanceof FileAccessError) {
        throw error
      }

      // Show user-friendly error for unsupported formats
      throw error
    }

    // Determine playback strategy based on codec support
    const needsTranscoding = !checkResult.videoCodecSupport || !checkResult.audioCodecSupport

    if (!needsTranscoding) {
      // Native playback - codecs are supported
      logger.log('video', 'Using native playback (codecs supported)')

      // Clean up any existing HTTP server
      if (httpServer) {
        try {
          httpServer.closeServer()
        } catch (error) {
          logger.warn('video', 'Error closing existing server:', error)
        }
        httpServer = undefined
      }

      const playParams: PlayParams = {
        type: 'native',
        videoSource: 'local-video:' + encodeURI(videoFile)
      }

      if (subtitleFile) {
        playParams.subtitleSource = 'local-subtitle:' + encodeURI(subtitleFile)
      }

      logger.log('video', 'Sending play params:', playParams)
      mainWindow.webContents.send('open-file', playParams)
    } else {
      // Transcoding playback - start HTTP server
      logger.log('video', 'Using transcoded playback (unsupported codecs)', {
        videoCodec: checkResult.videoCodec,
        audioCodec: checkResult.audioCodec,
        videoSupported: checkResult.videoCodecSupport,
        audioSupported: checkResult.audioCodecSupport
      })

      try {
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

        // Create server with error handling
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Server start timeout after 10 seconds'))
          }, 10000)

          httpServer!.createServer(() => {
            clearTimeout(timeout)
            logger.log('video', 'Video server created successfully')
            resolve()
          })
        })

        const playParams: PlayParams = {
          type: 'stream',
          videoSource: 'http://127.0.0.1:8888/video.mp4',
          duration: checkResult.duration
        }

        if (subtitleFile) {
          playParams.subtitleSource = 'http://127.0.0.1:8888/subtitle'
        }

        logger.log('video', 'Sending play params:', playParams)
        mainWindow.webContents.send('open-file', playParams)
      } catch (error) {
        logger.error('video', 'Failed to start video server:', error)
        throw new Error('Failed to start video streaming server')
      }
    }
  } catch (error: unknown) {
    logger.error('video', 'Error in playVideo:', error)

    // Get user-friendly error message
    const userMessage = getUserFriendlyErrorMessage(error)
    const isRecoverable = isRecoverableError(error)

    // Show error dialog to user
    const options = {
      type: 'error' as const,
      title: 'Video Playback Error',
      message: userMessage,
      detail: isRecoverable
        ? 'You can try again with a different file.'
        : 'Please check the file and try again.',
      buttons: ['OK']
    }

    try {
      await dialog.showMessageBox(options)
    } catch (dialogError) {
      logger.error('video', 'Failed to show error dialog:', dialogError)
    }

    // Re-throw if it's a critical error that caller should know about
    if (!isRecoverable) {
      throw error
    }
  }
}
