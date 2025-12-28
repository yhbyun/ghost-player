import { getFfmpegPath } from './ffmpeg-path'
import { exec, ExecException } from 'child_process'
import { FFmpegError, FileNotFoundError } from './errors'
import { logger } from '../logger'

/**
 * Represents the result of a video format support check.
 */
export interface VideoSupportResult {
  videoCodecSupport: boolean
  audioCodecSupport: boolean
  audioCodec?: string
  videoCodec?: string
  duration: number
}

/**
 * Finds a specific piece of information in a string using a regular expression.
 * @param reg The regular expression to use.
 * @param text The text to search within.
 * @returns The matched information or undefined if not found.
 */
function findVideoInfo(reg: RegExp, text: string): string | undefined {
  const matchArr = reg.exec(text)
  if (matchArr && matchArr.length > 1) {
    return matchArr[1].trim()
  }
  return undefined
}

/**
 * Transforms a duration string (HH:MM:SS.ms) into seconds.
 * @param duration The duration string.
 * @returns The total duration in seconds.
 */
function transformDuration(duration: string | undefined): number {
  if (!duration) {
    return 0
  }
  const arr = duration.split(':')
  if (arr.length === 3) {
    return parseInt(arr[0]) * 3600 + parseInt(arr[1]) * 60 + parseFloat(arr[2])
  }
  return 0
}

/**
 * Checks if a local video file is supported for direct playback in the browser.
 * It uses ffmpeg to get codec and duration information.
 * @param videoPath The absolute path to the video file.
 * @returns A promise that resolves with a VideoSupportResult object.
 * @throws {FileNotFoundError} If the video file cannot be found
 * @throws {FFmpegError} If ffmpeg fails to process the file
 */
export const videoSupport = (videoPath: string): Promise<VideoSupportResult> => {
  return new Promise<VideoSupportResult>((resolve, reject) => {
    // Validate input
    if (!videoPath || typeof videoPath !== 'string') {
      reject(new FFmpegError('Invalid video path provided'))
      return
    }

    const ffmpegPath = getFfmpegPath()
    if (!ffmpegPath) {
      reject(new FFmpegError('FFmpeg executable not found'))
      return
    }

    // Use quotes to handle paths with spaces
    const command = `"${ffmpegPath}" -i "${videoPath}"`

    logger.log('video', `Running ffmpeg command: ${command}`)

    // ffmpeg prints information to stderr and exits with a non-zero code when using -i without an output file.
    // Therefore, we parse stderr for information.
    exec(
      command,
      { encoding: 'utf-8', timeout: 30000 }, // 30 second timeout
      (error: ExecException | null, stdout: string, stderr: string) => {
        const output = stderr || stdout // Information is in stderr

        logger.log('video', `FFmpeg output received (${output.length} chars)`)

        // Check for file not found error
        if (output.includes('No such file or directory') || output.includes('does not exist')) {
          reject(new FileNotFoundError(videoPath))
          return
        }

        // Check for permission errors
        if (output.includes('Permission denied') || output.includes('Access is denied')) {
          reject(new FFmpegError('Permission denied when accessing file'))
          return
        }

        const durationReg = /Duration: ([\d:.]+),/
        const durationStr = findVideoInfo(durationReg, output)

        // If we can't find duration, it's likely a real error (e.g., corrupted file).
        if (!durationStr) {
          logger.error('video', 'Failed to extract duration from ffmpeg output', output)
          reject(new FFmpegError(`Failed to get video duration. The file may be corrupted.`))
          return
        }

        const videoReg = /Stream #\d+:\d+.*: Video: (\w+)/
        const videoCodec = findVideoInfo(videoReg, output)?.toLowerCase()

        const audioReg = /Stream #\d+:\d+.*: Audio: (\w+)/
        const audioCodec = findVideoInfo(audioReg, output)?.toLowerCase()

        const durationSeconds = transformDuration(durationStr)

        logger.log(
          'video',
          `Parsed info - videoCodec: ${videoCodec}, audioCodec: ${audioCodec}, duration: ${durationSeconds}s`
        )

        if (!videoCodec) {
          logger.error('video', 'No video stream found in file')
          reject(new FFmpegError('No video stream found. This may not be a valid video file.'))
          return
        }

        if (!durationSeconds || durationSeconds <= 0) {
          logger.error('video', 'Invalid duration detected')
          reject(new FFmpegError('Invalid or zero duration detected'))
          return
        }

        const checkResult: VideoSupportResult = {
          videoCodecSupport: ['h264', 'vp8', 'theora'].includes(videoCodec),
          audioCodecSupport: audioCodec ? ['aac', 'vorbis', 'opus'].includes(audioCodec) : false,
          videoCodec,
          audioCodec,
          duration: durationSeconds
        }

        logger.log('video', `Video support check result:`, checkResult)
        resolve(checkResult)
      }
    )
  })
}
