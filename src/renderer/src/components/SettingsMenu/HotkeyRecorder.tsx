import React, { useState, useEffect, useRef } from 'react'

interface HotkeyRecorderProps {
  initialValue: string
  onSave: (value: string) => void
  onCancel: () => void
}

const HotkeyRecorder: React.FC<HotkeyRecorderProps> = ({ initialValue, onSave, onCancel }) => {
  const [recordedKeys, setRecordedKeys] = useState<string>(initialValue)
  const containerRef = useRef<HTMLDivElement>(null)

  // OS 감지 (Mac 여부 확인)
  const isMac = navigator.userAgent.includes('Mac')

  useEffect(() => {
    containerRef.current?.focus()
    window.api.suspendShortcuts()

    return () => {
      window.api.resumeShortcuts()
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    e.preventDefault()
    e.stopPropagation()

    const modifiers: string[] = []

    // Electron Accelerator 형식에 맞추되, 디스플레이는 OS별 선호 명칭 사용 가능
    // 다만 저장/등록 시에는 Electron이 인식하는 표준 키워드(Ctrl, Alt, Shift, Cmd) 사용 권장
    if (e.ctrlKey) modifiers.push('Ctrl')
    if (e.altKey) modifiers.push(isMac ? 'Option' : 'Alt')
    if (e.shiftKey) modifiers.push('Shift')
    if (e.metaKey) modifiers.push(isMac ? 'Cmd' : 'Super') // Cmd on Mac, Super/Win on others

    let key = e.key
    // Map some keys to Electron Accelerator format
    if (key === ' ') key = 'Space'
    if (key === 'ArrowUp') key = 'Up'
    if (key === 'ArrowDown') key = 'Down'
    if (key === 'ArrowLeft') key = 'Left'
    if (key === 'ArrowRight') key = 'Right'
    if (key === 'Escape') {
      onCancel()
      return
    }
    if (key === 'Enter') {
      onSave(recordedKeys)
      return
    }

    // Ignore if only modifiers are pressed
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      setRecordedKeys(modifiers.join('+'))
      return
    }

    // Format single key if no modifiers, or join with modifiers
    const finalKey = key.length === 1 ? key.toUpperCase() : key

    // Electron Accelerator 생성
    const accelerator = [...modifiers, finalKey].join('+')
    setRecordedKeys(accelerator)
  }

  return (
    <div ref={containerRef} className="hotkey-recorder-box" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="recording-status">{recordedKeys || 'Press any keys...'}</div>
      <div className="helper-text">
        Press <b>Enter</b> to Save, <b>Esc</b> to Cancel
      </div>
    </div>
  )
}

export default HotkeyRecorder
