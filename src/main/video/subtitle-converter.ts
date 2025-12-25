import { promises as fs } from 'fs'
import path from 'path'
import iconv from 'iconv-lite'

/**
 * Converts SMI or SRT subtitle files to WebVTT format.
 */
export async function convertToVtt(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase()
  const buffer = await fs.readFile(filePath)

  if (ext === '.srt') {
    return convertSrtToVtt(buffer)
  } else if (ext === '.smi') {
    return convertSmiToVtt(buffer)
  } else if (ext === '.vtt') {
    return buffer.toString('utf-8')
  }

  throw new Error(`Unsupported subtitle format: ${ext}`)
}

function convertSrtToVtt(buffer: Buffer): string {
  let content = decodeBuffer(buffer)

  // Basic SRT to VTT:
  // 1. Add WEBWTT header
  // 2. Change , to . in timestamps
  content = content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')

  return `WEBVTT\n\n${content}`
}

function convertSmiToVtt(buffer: Buffer): string {
  const content = decodeBuffer(buffer)

  // Split by <SYNC to avoid complex regex capture issues
  const parts = content.split(/<sync/gi)
  const rawCues: { start: number; text: string }[] = []

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const match = part.match(/start\s*=\s*(?:"|')?(\d+)(?:"|')?/i)
    if (!match) continue

    const startMs = parseInt(match[1], 10)
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

    rawCues.push({ start: startMs, text })
  }

  if (rawCues.length === 0) return 'WEBVTT\n\n'

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

  return vtt
}

/**
 * Decodes buffer by trying UTF-16, UTF-8, then EUC-KR
 */
function decodeBuffer(buffer: Buffer): string {
  // BOM Check
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return iconv.decode(buffer, 'utf-16le')
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return iconv.decode(buffer, 'utf-16be')
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return buffer.toString('utf-8', 3)

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
