import { path as ffmpegInstallerPath } from '@ffmpeg-installer/ffmpeg'
import { is } from '@electron-toolkit/utils'
import fs from 'fs'
import { logger } from '../logger'

/**
 * Resolves the correct path to the FFmpeg binary.
 */
export const getFfmpegPath = (): string => {
  if (is.dev) {
    return ffmpegInstallerPath
  }

  // Production 환경에서는 app.asar.unpacked 폴더를 먼저 확인합니다.
  const unpackedPath = ffmpegInstallerPath.replace('app.asar', 'app.asar.unpacked')
  // 파일이 실제로 존재하는지 확인 후 반환
  if (fs.existsSync(unpackedPath)) {
    return unpackedPath
  }

  logger.error('ffmpeg', `Failure: FFmpeg unpacked path does not exist: ${unpackedPath}`)
  return ffmpegInstallerPath
}
