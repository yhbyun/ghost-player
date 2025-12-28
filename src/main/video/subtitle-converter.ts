import { promises as fs } from 'fs'
import path from 'path'
import iconv from 'iconv-lite'
import { SubtitleConversionError, FileNotFoundError, FileAccessError } from './errors'
import { logger } from '../logger'

/**
 * Converts SMI or SRT subtitle files to WebVTT format.
 * @throws {FileNotFoundError} If the subtitle file does not exist
 * @throws {FileAccessError} If the subtitle file cannot be read
 * @throws {SubtitleConversionError} If conversion fails
 */
export async function convertToVtt(filePath: string): Promise<string> {
  try {
    // Validate file path
    if (!filePath || typeof filePath !== 'string') {
      throw new SubtitleConversionError(filePath, new Error('Invalid file path'))
    }

    const ext = path.extname(filePath).toLowerCase()
    logger.log('subtitle', `Converting subtitle file: ${filePath} (${ext})`)

    // Check if file exists and is accessible
    let buffer: Buffer
    try {
      buffer = await fs.readFile(filePath)
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error) {
        const fsError = error as NodeJS.ErrnoException
        if (fsError.code === 'ENOENT') {
          throw new FileNotFoundError(filePath, error)
        } else if (fsError.code === 'EACCES' || fsError.code === 'EPERM') {
          throw new FileAccessError(filePath, error)
        }
      }
      throw new SubtitleConversionError(filePath, error)
    }

    logger.log('subtitle', `File read successfully, size: ${buffer.length} bytes`)

    let result: string
    if (ext === '.srt') {
      result = convertSrtToVtt(buffer)
    } else if (ext === '.smi') {
      result = convertSmiToVtt(buffer)
    } else if (ext === '.vtt') {
      result = buffer.toString('utf-8')
    } else {
      throw new SubtitleConversionError(filePath, new Error(`Unsupported subtitle format: ${ext}`))
    }

    logger.log('subtitle', `Conversion successful, output size: ${result.length} chars`)
    return result
  } catch (error) {
    // Re-throw custom errors as-is
    if (
      error instanceof FileNotFoundError ||
      error instanceof FileAccessError ||
      error instanceof SubtitleConversionError
    ) {
      throw error
    }

    // Wrap unexpected errors
    logger.error('subtitle', 'Unexpected error during conversion:', error)
    throw new SubtitleConversionError(filePath, error)
  }
}

function convertSrtToVtt(buffer: Buffer): string {
  try {
    let content = decodeBuffer(buffer)

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new Error('Empty subtitle file')
    }

    // Basic SRT to VTT:
    // 1. Add WEBWTT header
    // 2. Change , to . in timestamps
    content = content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')

    const result = `WEBVTT\n\n${content}`
    logger.log('subtitle', `SRT to VTT conversion complete`)
    return result
  } catch (error) {
    logger.error('subtitle', 'Failed to convert SRT to VTT:', error)
    throw error
  }
}

function convertSmiToVtt(buffer: Buffer): string {
  try {
    const content = decodeBuffer(buffer)

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new Error('Empty subtitle file')
    }

    // Split by <SYNC to avoid complex regex capture issues
    const parts = content.split(/<sync/gi)
    const rawCues: { start: number; text: string }[] = []

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]
      const match = part.match(/start\s*=\s*(?:"|')?(\d+)(?:"|')?/i)
      if (!match) continue

      const startMs = parseInt(match[1], 10)
      if (isNaN(startMs)) {
        logger.warn('subtitle', `Invalid timestamp in SMI file: ${match[1]}`)
        continue
      }

      const tagEndIndex = part.indexOf('>')
      if (tagEndIndex === -1) continue

      const rawText = part.substring(tagEndIndex + 1).replace(/<\/body>|<\/sami>.*/gi, '')

      // Process text
      const text = rawText
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&amp;/gi, '&')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[a-zA-Z0-9]+=[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (text) {
        rawCues.push({ start: startMs, text })
      }
    }

    if (rawCues.length === 0) {
      logger.warn('subtitle', 'No valid cues found in SMI file')
      return 'WEBVTT\n\n'
    }

    rawCues.sort((a, b) => a.start - b.start)

    let vtt = 'WEBVTT\n\n'
    for (let i = 0; i < rawCues.length; i++) {
      const cue = rawCues[i]
      if (!cue.text) continue

      const start = formatVttTime(cue.start)
      const nextStart = i + 1 < rawCues.length ? rawCues[i + 1].start : cue.start + 5000
      const endMs = Math.max(cue.start + 50, nextStart)
      const end = formatVttTime(endMs)

      vtt += `${start} --> ${end}\n${cue.text}\n\n`
    }

    logger.log('subtitle', `SMI to VTT conversion complete, ${rawCues.length} cues extracted`)
    return vtt
  } catch (error) {
    logger.error('subtitle', 'Failed to convert SMI to VTT:', error)
    throw error
  }
}

/**
 * Decodes buffer by trying UTF-16, UTF-8, then EUC-KR
 */
function decodeBuffer(buffer: Buffer): string {
  // BOM Check
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return iconv.decode(buffer, 'utf-16le')
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return iconv.decode(buffer, 'utf-16be')
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf)
    return buffer.toString('utf-8', 3)

  // Try decoding with EUC-KR first if it looks like SAMI in EUC-KR
  const eucKrString = iconv.decode(buffer, 'euc-kr')
  if (eucKrString.toLowerCase().includes('<sami>')) {
    const utf8String = buffer.toString('utf-8')
    if (utf8String.toLowerCase().includes('<sami>')) {
      const replacementMatch = utf8String.match(/\ufffd/g)
      if (!replacementMatch || replacementMatch.length < 5) {
        return utf8String
      }
    }
    return eucKrString
  }

  return buffer.toString('utf-8')
}

function formatVttTime(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = ms % 1000

  return (
    hours.toString().padStart(2, '0') +
    ':' +
    minutes.toString().padStart(2, '0') +
    ':' +
    seconds.toString().padStart(2, '0') +
    '.' +
    milliseconds.toString().padStart(3, '0')
  )
}
