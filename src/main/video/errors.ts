/**
 * Custom error types for video playback
 */

export class VideoPlaybackError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'VideoPlaybackError'
  }
}

export class FileNotFoundError extends VideoPlaybackError {
  constructor(filePath: string, originalError?: unknown) {
    super(`Video file not found: ${filePath}`, 'FILE_NOT_FOUND', originalError)
    this.name = 'FileNotFoundError'
  }
}

export class FileAccessError extends VideoPlaybackError {
  constructor(filePath: string, originalError?: unknown) {
    super(`Cannot access video file: ${filePath}`, 'FILE_ACCESS_ERROR', originalError)
    this.name = 'FileAccessError'
  }
}

export class UnsupportedFormatError extends VideoPlaybackError {
  constructor(
    filePath: string,
    public videoCodec?: string,
    public audioCodec?: string
  ) {
    const details: string[] = []
    if (videoCodec) details.push(`video: ${videoCodec}`)
    if (audioCodec) details.push(`audio: ${audioCodec}`)
    const detailStr = details.length > 0 ? ` (${details.join(', ')})` : ''
    super(`Unsupported video format: ${filePath}${detailStr}`, 'UNSUPPORTED_FORMAT')
    this.name = 'UnsupportedFormatError'
  }
}

export class FFmpegError extends VideoPlaybackError {
  constructor(message: string, originalError?: unknown) {
    super(`FFmpeg error: ${message}`, 'FFMPEG_ERROR', originalError)
    this.name = 'FFmpegError'
  }
}

export class SubtitleConversionError extends VideoPlaybackError {
  constructor(filePath: string, originalError?: unknown) {
    super(`Failed to convert subtitle: ${filePath}`, 'SUBTITLE_CONVERSION_ERROR', originalError)
    this.name = 'SubtitleConversionError'
  }
}

export class ServerStartError extends VideoPlaybackError {
  constructor(message: string, originalError?: unknown) {
    super(`Failed to start video server: ${message}`, 'SERVER_START_ERROR', originalError)
    this.name = 'ServerStartError'
  }
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof FileNotFoundError) {
    return 'The video file could not be found. It may have been moved or deleted.'
  }

  if (error instanceof FileAccessError) {
    return 'Cannot access the video file. Please check file permissions.'
  }

  if (error instanceof UnsupportedFormatError) {
    const err = error as UnsupportedFormatError
    if (err.videoCodec && !['h264', 'vp8', 'theora'].includes(err.videoCodec)) {
      return `The video codec (${err.videoCodec}) is not supported. Supported codecs: H.264, VP8, Theora.`
    }
    if (err.audioCodec && !['aac', 'vorbis', 'opus'].includes(err.audioCodec)) {
      return `The audio codec (${err.audioCodec}) is not supported. Supported codecs: AAC, Vorbis, Opus.`
    }
    return 'This video format is not supported.'
  }

  if (error instanceof FFmpegError) {
    return 'Failed to process the video file. The file may be corrupted.'
  }

  if (error instanceof SubtitleConversionError) {
    return 'Failed to load subtitles. The subtitle file may be corrupted or in an unsupported format.'
  }

  if (error instanceof ServerStartError) {
    return 'Failed to start the video streaming server. Please try again.'
  }

  if (error instanceof VideoPlaybackError) {
    return error.message
  }

  if (error instanceof Error) {
    return `An unexpected error occurred: ${error.message}`
  }

  return 'An unknown error occurred while trying to play the video.'
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof FileNotFoundError) {
    return false // Cannot recover from missing file
  }

  if (error instanceof UnsupportedFormatError) {
    return false // Cannot recover from unsupported format
  }

  if (error instanceof ServerStartError) {
    return true // Can retry server start
  }

  if (error instanceof SubtitleConversionError) {
    return true // Can play video without subtitles
  }

  return true // Try to recover from other errors
}
