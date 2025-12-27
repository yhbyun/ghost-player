// Netflix Preload Script
// This script is injected into the Netflix webview.
// It injects a script tag into the main page to intercept Fetch/XHR in the main world.

console.log('[Netflix Preload] Preload script loaded.')

function mainWorldLogic(): void {
  console.log('[Netflix Dual Subtitles] Main world logic started.')

  interface SubtitleLine {
    start: number
    end: number
    text: string
    position?: 'top' | 'bottom'
  }

  const capturedSubtitles: SubtitleLine[] = []
  const activeSecondarySubtitles: SubtitleLine[] = []

  const resetSubtitles = (): void => {
    capturedSubtitles.length = 0
    activeSecondarySubtitles.length = 0
    const countSpan = document.getElementById('dual-sub-count')
    const btn = document.getElementById('dual-sub-lock-btn')
    if (countSpan) countSpan.innerText = '0 items'
    if (btn) btn.innerText = 'Lock Subtitles'
    const display = document.getElementById('dual-sub-text')
    if (display) {
      display.innerText = ''
      display.style.opacity = '0'
    }
  }

  const parseTime = (timeStr: string): number => {
    if (!timeStr) return 0

    // Handle HH:MM:SS.mmm
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':')
      let seconds = 0
      if (parts.length === 3) {
        seconds += parseFloat(parts[0]) * 3600
        seconds += parseFloat(parts[1]) * 60
        seconds += parseFloat(parts[2])
      } else if (parts.length === 2) {
        seconds += parseFloat(parts[0]) * 60
        seconds += parseFloat(parts[1])
      }
      return seconds
    }

    // Handle suffix
    if (timeStr.endsWith('s')) {
      return parseFloat(timeStr)
    }
    if (timeStr.endsWith('ms')) {
      return parseFloat(timeStr) / 1000
    }
    if (timeStr.endsWith('t')) {
      return parseFloat(timeStr) / 10000000
    }

    // Default to ticks if likely numeric string
    const val = parseFloat(timeStr)
    if (!isNaN(val)) {
      return val / 10000000
    }

    return 0
  }

  const parseTTML = (text: string): void => {
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(text, 'text/xml')

      // Parse Regions
      const regionMap = new Map<string, 'top' | 'bottom'>()
      const regions = xmlDoc.getElementsByTagName('region') // or ns? usually standard tag name
      for (let i = 0; i < regions.length; i++) {
        const r = regions[i]
        const id = r.getAttribute('xml:id') || r.id
        const origin = r.getAttribute('tts:origin')
        const displayAlign = r.getAttribute('tts:displayAlign')

        let pos: 'top' | 'bottom' = 'bottom'

        // Heuristic: displayAlign takes precedence
        if (displayAlign === 'before') {
          pos = 'top'
        } else if (displayAlign === 'after') {
          pos = 'bottom'
        } else if (origin) {
          // Fallback to origin
          const parts = origin.split(' ')
          if (parts.length === 2) {
            const yStr = parts[1]
            if (yStr.endsWith('%')) {
              const yVal = parseFloat(yStr)
              if (yVal < 40) pos = 'top'
              else pos = 'bottom'
            }
          }
        }

        regionMap.set(id, pos)
        // console.log(`[Netflix Dual Subtitles] Region ${id}: origin=${origin}, align=${displayAlign} => ${pos}`)
      }

      // Parse Styles
      const styleMap = new Map<string, boolean>()
      // Check both 'styling' and direct 'style' tags just in case
      const styles = xmlDoc.getElementsByTagName('style')
      for (let i = 0; i < styles.length; i++) {
        const s = styles[i]
        const id = s.getAttribute('xml:id') || s.getAttribute('id')
        const fs = s.getAttribute('tts:fontStyle') || s.getAttribute('fontStyle')
        if (id && fs === 'italic') {
          styleMap.set(id, true)
        }
      }

      const ps = xmlDoc.getElementsByTagName('p')
      capturedSubtitles.length = 0 // Clear previous

      const processNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.nodeValue || ''
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element
          let content = ''
          if (el.localName === 'br') return ' '

          for (let i = 0; i < el.childNodes.length; i++) {
            content += processNode(el.childNodes[i])
          }

          const styleId = el.getAttribute('style')
          const fontStyle = el.getAttribute('tts:fontStyle') || el.getAttribute('fontStyle')
          const isItalic = fontStyle === 'italic' || (styleId && styleMap.get(styleId))

          if (isItalic) {
            return `<i>${content}</i>`
          }
          return content
        }
        return ''
      }
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]
        const begin = p.getAttribute('begin')
        const end = p.getAttribute('end')
        const regionId = p.getAttribute('region')
        let pos: 'top' | 'bottom' = 'bottom'

        if (regionId && regionMap.has(regionId)) {
          pos = regionMap.get(regionId)!
        }

        const htmlContent = processNode(p)

        if (begin && end) {
          capturedSubtitles.push({
            start: parseTime(begin),
            end: parseTime(end),
            text: htmlContent,
            position: pos
          })
        }
      }
      console.log('[Netflix Dual Subtitles] Parsed subtitles:', capturedSubtitles.length)
      const countSpan = document.getElementById('dual-sub-count')
      if (countSpan) {
        const firstLine = capturedSubtitles[0]
        const debugInfo = firstLine ? `(First: ${firstLine.start.toFixed(2)}s)` : ''
        countSpan.innerText = `Captured: ${capturedSubtitles.length} lines ${debugInfo}`
      }
    } catch (e) {
      console.error('[Netflix Dual Subtitles] XML Parse error', e)
    }
  }

  // Hook Fetch
  const originalFetch = window.fetch
  window.fetch = async (...args): Promise<Response> => {
    const response = await originalFetch(...args)
    const clone = response.clone()
    clone
      .text()
      .then((text) => {
        // debug logs
        // if (text.length < 500) console.log('[Netflix Dual Subtitles] Fetch Text:', text)

        if (text.includes('<tt') || text.includes('netflix.com/ttml')) {
          // console.log('[Netflix Dual Subtitles] Fetch Captured potential subtitle')
          parseTTML(text)
        }
      })
      .catch(() => {})
    return response
  }

  // Hook XHR
  const originalOpen = XMLHttpRequest.prototype.open
  const originalSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    this['_url'] = url.toString()
    // @ts-ignore - arguments spread
    return originalOpen.apply(this, [method, url, ...args])
  }

  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener('load', () => {
      if (this.responseType === '' || this.responseType === 'text') {
        const text = this.responseText
        if (text && (text.includes('<tt') || text.includes('netflix.com/ttml'))) {
          // console.log('[Netflix Dual Subtitles] XHR Captured potential subtitle')
          parseTTML(text)
        }
      }
    })
    return originalSend.apply(this, [body])
  }

  // Hook History for navigation
  const wrapHistory = (type: 'pushState' | 'replaceState'): void => {
    const original = history[type]
    history[type] = function (...args) {
      const result = original.apply(this, args)
      resetSubtitles()
      return result
    }
  }
  wrapHistory('pushState')
  wrapHistory('replaceState')
  window.addEventListener('popstate', () => resetSubtitles())

  // UI Construction
  const constructUI = (): void => {
    if (document.getElementById('dual-sub-controls')) return

    // 1. Controls Container (Top Right)
    const controls = document.createElement('div')
    controls.id = 'dual-sub-controls'
    Object.assign(controls.style, {
      position: 'fixed',
      top: '100px', // Avoid Netflix top nav
      right: '20px',
      zIndex: '10000',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      padding: '8px 12px',
      borderRadius: '8px',
      color: 'white',
      fontFamily: 'sans-serif',
      fontSize: '13px',
      opacity: '0.1', // Almost invisible by default
      transition: 'opacity 0.3s',
      cursor: 'default',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      pointerEvents: 'auto'
    })

    controls.addEventListener('mouseenter', () => {
      controls.style.opacity = '1'
    })
    controls.addEventListener('mouseleave', () => {
      controls.style.opacity = '0.1'
    })

    controls.innerHTML = `
      <span id="dual-sub-count">0 items</span>
      <button id="dual-sub-lock-btn" style="
        background: #e50914;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 5px 10px;
        cursor: pointer;
        font-weight: bold;
        font-size: 12px;">
        Lock Subtitles
      </button>
    `
    document.body.appendChild(controls)

    // 2. Subtitle Display Container (Bottom Center)
    const display = document.createElement('div')
    display.id = 'dual-sub-text'
    Object.assign(display.style, {
      position: 'fixed',
      top: '87%', // Raised to avoid overlapping native subs (even 2 lines)
      left: '50%',
      transform: 'translateX(-50%)',
      width: '90%',
      textAlign: 'center',
      color: '#ffff00', // Bright yellow
      fontSize: '2.0vw',
      fontWeight: 'bold',
      textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8)', // Strong shadow for readability
      zIndex: '9999',
      pointerEvents: 'none', // Pass clicks through to video
      opacity: '0',
      transition: 'opacity 0.1s',
      whiteSpace: 'pre-wrap',
      lineHeight: '1.3'
    })
    document.body.appendChild(display)

    // Logic
    const btn = document.getElementById('dual-sub-lock-btn')
    btn?.addEventListener('click', (e) => {
      e.stopPropagation() // Prevent click from pausing video
      activeSecondarySubtitles.length = 0
      activeSecondarySubtitles.push(...capturedSubtitles)
      if (btn) btn.innerText = `Locked (${activeSecondarySubtitles.length})`
    })

    // Fullscreen Handling
    document.addEventListener('fullscreenchange', () => {
      const fsElement = document.fullscreenElement
      const target = fsElement || document.body
      if (controls.parentElement !== target) target.appendChild(controls)
      if (display.parentElement !== target) target.appendChild(display)
    })
  }

  // Run UI
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', constructUI)
  } else {
    constructUI()
  }

  // Sync Loop
  setInterval(() => {
    const video = document.querySelector('video')
    const textView = document.getElementById('dual-sub-text')

    if (video && textView && activeSecondarySubtitles.length > 0) {
      const time = video.currentTime
      const line = activeSecondarySubtitles.find((l) => time >= l.start && time <= l.end)
      if (line) {
        textView.innerHTML = line.text // Use innerHTML for italics/br
        textView.style.opacity = '1'

        // Position update
        if (line.position === 'top') {
          textView.style.top = '10%'
          textView.style.bottom = 'auto'
        } else {
          textView.style.top = '87%'
          textView.style.bottom = 'auto'
        }
      } else {
        textView.innerText = ''
        textView.style.opacity = '0'
      }
    }
  }, 100)
}

const injectScript = (): void => {
  const script = document.createElement('script')
  // Use function.toString() to extract code.
  // Note: capturedSubtitles etc are scoped inside mainWorldLogic, which is fine.
  script.textContent = `(${mainWorldLogic.toString()})();`
  ;(document.head || document.documentElement).appendChild(script)
}

window.addEventListener('DOMContentLoaded', injectScript)
