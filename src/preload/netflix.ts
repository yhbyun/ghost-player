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
  }

  const capturedSubtitles: SubtitleLine[] = []
  const activeSecondarySubtitles: SubtitleLine[] = []

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
      const ps = xmlDoc.getElementsByTagName('p')
      capturedSubtitles.length = 0 // Clear previous
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]
        const begin = p.getAttribute('begin')
        const end = p.getAttribute('end')
        if (begin && end) {
          capturedSubtitles.push({
            start: parseTime(begin),
            end: parseTime(end),
            text: p.textContent || ''
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

  // UI Construction
  const constructUI = (): void => {
    if (document.getElementById('dual-sub-overlay')) return

    const overlay = document.createElement('div')
    overlay.id = 'dual-sub-overlay'
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '10%',
      left: '50%',
      transform: 'translateX(-50%)',
      color: 'white',
      fontSize: '16px',
      zIndex: '9999',
      pointerEvents: 'auto',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: '8px 12px',
      borderRadius: '6px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center'
    })

    overlay.innerHTML = `
      <div style="margin-bottom: 5px; opacity: 0.8; font-size: 12px;">
         Step 1: Select Language 1 (e.g. English) <br/>
         Step 2: Click 'Lock Secondary' <br/>
         Step 3: Select Language 2 (e.g. Korean)
      </div>
      <div style="margin-bottom: 8px;">
        <span id="dual-sub-count" style="margin-right: 10px;">Lines: 0</span>
        <button id="dual-sub-lock-btn" style="cursor: pointer; padding: 2px 6px;">Lock Secondary</button>
      </div>
      <div id="dual-sub-text" style="font-size: 24px; color: yellow; text-shadow: 2px 2px 2px black; min-height: 1.5em; white-space: pre-wrap;"></div>
    `
    document.body.appendChild(overlay)

    const btn = document.getElementById('dual-sub-lock-btn')
    btn?.addEventListener('click', () => {
      activeSecondarySubtitles.length = 0
      activeSecondarySubtitles.push(...capturedSubtitles)
      if (btn) btn.innerText = `Locked (${activeSecondarySubtitles.length})`
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
        textView.innerText = line.text
        textView.style.opacity = '1'
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
