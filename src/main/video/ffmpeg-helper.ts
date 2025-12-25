import { getFfmpegPath } from './ffmpeg-path'
import { exec, ExecException } from 'child_process'

/**
 * Represents the result of a video format support check.
 */
export interface VideoSupportResult {
  videoCodecSupport: boolean
  audioCodecSupport: boolean
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
 */
export const videoSupport = (videoPath: string): Promise<VideoSupportResult> => {
  return new Promise<VideoSupportResult>((resolve, reject) => {
    // Use quotes to handle paths with spaces
    const command = `"${getFfmpegPath()}" -i "${videoPath}"`

    // ffmpeg prints information to stderr and exits with a non-zero code when using -i without an output file.
    // Therefore, we parse stderr for information.
    exec(
      command,
      { encoding: 'utf-8' },
      (error: ExecException | null, stdout: string, stderr: string) => {
        const output = stderr || stdout // Information is in stderr

        const durationReg = /Duration: ([\d:.]+),/
        const durationStr = findVideoInfo(durationReg, output)

        // If we can't find duration, it's likely a real error (e.g., file not found).
        if (!durationStr) {
          reject(new Error(`Failed to get video info from ffmpeg. Output: ${output}`))
          return
        }

        const videoReg = /Stream #\d+:\d+.*: Video: (\w+)/
        const videoCodec = findVideoInfo(videoReg, output)?.toLowerCase()

        const audioReg = /Stream #\d+:\d+.*: Audio: (\w+)/
        const audioCodec = findVideoInfo(audioReg, output)?.toLowerCase()

        const durationSeconds = transformDuration(durationStr)

        console.log(
          `videoCodec: ${videoCodec}, audioCodec: ${audioCodec}, duration: ${durationSeconds}`
        )

        if (!videoCodec || !audioCodec || !durationSeconds) {
          reject(new Error(`Could not parse full codec/duration info for: ${videoPath}`))
          return
        }

        const checkResult: VideoSupportResult = {
          videoCodecSupport: ['h264', 'vp8', 'theora'].includes(videoCodec),
          audioCodecSupport: ['aac', 'vorbis', 'opus'].includes(audioCodec),
          duration: durationSeconds
        }

        resolve(checkResult)
      }
    )
  })
}
