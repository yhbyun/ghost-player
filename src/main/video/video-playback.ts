import { BrowserWindow, dialog } from 'electron'
import { videoSupport } from './ffmpeg-helper'
import VideoServer from './video-server'
import { PlayParams } from '../../types'

let httpServer: VideoServer | undefined

export const playVideo = (mainWindow: BrowserWindow, videoFile: string): void => {
  videoSupport(videoFile)
    .then((checkResult) => {
      if (checkResult.videoCodecSupport && checkResult.audioCodecSupport) {
        if (httpServer) {
          httpServer.killFfmpegCommand()
          httpServer = undefined
        }
        const playParams: PlayParams = {
          type: 'native',
          videoSource: 'local-video:' + videoFile
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

        httpServer.createServer()
        console.log('createVideoServer success')

        const playParams: PlayParams = {
          type: 'stream',
          videoSource: 'http://127.0.0.1:8888?startTime=0',
          duration: checkResult.duration
        }
        console.log(playParams)
        mainWindow?.webContents.send('open-file', playParams)
      }
    })
    .catch((err: Error) => {
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
    })
}
