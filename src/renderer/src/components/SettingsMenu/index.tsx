import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog } from '@fortawesome/free-solid-svg-icons'
import './style.scss'

interface Settings {
  isTransparent: boolean
  opacity: number
  transparencyMode: 'always' | 'mouseover' | 'mouseout'
  isAlwaysOnTop: boolean
  alwaysOnTopLevel:
    | 'floating'
    | 'torn-off-menu'
    | 'modal-panel'
    | 'main-menu'
    | 'status'
    | 'pop-up-menu'
    | 'screen-saver'
  isSideDockEnabled: boolean
  sideDockVisibleWidth: number
  disableMouse: boolean
  openDevToolsOnStart: boolean
  whisperApiKey: string
  transcriptionProvider: 'remote' | 'local'
  isVisualizerEnabled: boolean
}

interface SettingsMenuProps {}

const SettingsMenu: React.FC<SettingsMenuProps> = () => {
  const [expanded, setExpanded] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchSettings = async (): Promise<void> => {
      const isTransparent = await window.api.getSetting('isTransparent', false)
      const opacity = await window.api.getSetting('opacity', 1)
      const transparencyMode = await window.api.getSetting('transparencyMode', 'always')
      const isAlwaysOnTop = await window.api.getSetting('isAlwaysOnTop', false)
      const alwaysOnTopLevel = await window.api.getSetting('alwaysOnTopLevel', 'floating')
      const isSideDockEnabled = await window.api.getSetting('isSideDockEnabled', false)
      const sideDockVisibleWidth = await window.api.getSetting('sideDockVisibleWidth', 50)
      const disableMouse = await window.api.getSetting('disableMouse', false)
      const openDevToolsOnStart = await window.api.getSetting('openDevToolsOnStart', false)
      const whisperApiKey = await window.api.getSetting('whisperApiKey', '')
      const transcriptionProvider = await window.api.getSetting('transcriptionProvider', 'remote')
      const isVisualizerEnabled = await window.api.getSetting('isVisualizerEnabled', false)

      setSettings({
        isTransparent,
        opacity,
        transparencyMode,
        isAlwaysOnTop,
        alwaysOnTopLevel,
        isSideDockEnabled,
        sideDockVisibleWidth,
        disableMouse,
        openDevToolsOnStart,
        whisperApiKey,
        transcriptionProvider,
        isVisualizerEnabled
      } as Settings)
    }
    fetchSettings()

    const cleanup = window.api.onSettingChanged(({ key, value }) => {
      setSettings((prev) => (prev ? { ...prev, [key]: value } : null))
    })

    return cleanup
  }, [])

  useEffect(() => {
    if (expanded) {
      menuRef.current?.focus()
    }
  }, [expanded])

  const handleSettingChange = (key: keyof Settings, value: unknown): void => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : null))
    window.api.setSetting(key, value)
  }

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>): void => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setExpanded(false)
    }
  }

  if (!settings) {
    return null
  }

  return (
    <div className="settings-wrap" ref={menuRef} tabIndex={-1} onBlur={handleBlur}>
      <div
        className={`settings-btn ${expanded ? 'btn-rotate' : ''}`}
        title="Toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <FontAwesomeIcon icon={faCog} />
      </div>
      {expanded && (
        <div className="settings-menu">
          <div className="settings-section">
            <h3>Transparency</h3>
            <label>
              <input
                type="checkbox"
                checked={settings.isTransparent}
                onChange={(e) => handleSettingChange('isTransparent', e.target.checked)}
              />
              Enabled
            </label>
            {settings.isTransparent && (
              <>
                <div className="settings-subsection">
                  <h4>Opacity</h4>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="10"
                    value={settings.opacity * 100}
                    onChange={(e) => handleSettingChange('opacity', parseInt(e.target.value) / 100)}
                  />
                  <span>{settings.opacity * 100}%</span>
                </div>
                <div className="settings-subsection">
                  <h4>Mode</h4>
                  {['always', 'mouseover', 'mouseout'].map((mode) => (
                    <label key={mode}>
                      <input
                        type="radio"
                        name="transparencyMode"
                        value={mode}
                        checked={settings.transparencyMode === mode}
                        onChange={() => handleSettingChange('transparencyMode', mode)}
                      />
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="settings-section">
            <h3>Always on Top</h3>
            <label>
              <input
                type="checkbox"
                checked={settings.isAlwaysOnTop}
                onChange={(e) => handleSettingChange('isAlwaysOnTop', e.target.checked)}
              />
              Enabled
            </label>
            {settings.isAlwaysOnTop && (
              <div className="settings-subsection">
                <h4>Level</h4>
                <select
                  value={settings.alwaysOnTopLevel}
                  onChange={(e) => handleSettingChange('alwaysOnTopLevel', e.target.value)}
                >
                  {[
                    'floating',
                    'torn-off-menu',
                    'modal-panel',
                    'main-menu',
                    'status',
                    'pop-up-menu',
                    'screen-saver'
                  ].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="settings-section">
            <h3>Side Dock</h3>
            <label>
              <input
                type="checkbox"
                checked={settings.isSideDockEnabled}
                onChange={(e) => handleSettingChange('isSideDockEnabled', e.target.checked)}
              />
              Enabled
            </label>
            {settings.isSideDockEnabled && (
              <div className="settings-subsection">
                <h4>Visible Width</h4>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="10"
                  value={settings.sideDockVisibleWidth}
                  onChange={(e) =>
                    handleSettingChange('sideDockVisibleWidth', parseInt(e.target.value))
                  }
                />
                <span>{settings.sideDockVisibleWidth}px</span>
              </div>
            )}
          </div>
          <div className="settings-section">
            <h3>General</h3>
            <div className="settings-subsection flex flex-col gap-2">
              <label>
                <input
                  type="checkbox"
                  checked={settings.disableMouse}
                  onChange={(e) => handleSettingChange('disableMouse', e.target.checked)}
                />
                Disable Mouse
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.openDevToolsOnStart}
                  onChange={(e) => handleSettingChange('openDevToolsOnStart', e.target.checked)}
                />
                Open DevTools on Start
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.isVisualizerEnabled}
                  onChange={(e) => handleSettingChange('isVisualizerEnabled', e.target.checked)}
                />
                Audio Visualizer
              </label>
            </div>
          </div>
          <div className="settings-section">
            <h3>Transcription</h3>
            <div className="settings-subsection">
              {['remote', 'local'].map((provider) => (
                <label key={provider}>
                  <input
                    type="radio"
                    name="transcriptionProvider"
                    value={provider}
                    checked={settings.transcriptionProvider === provider}
                    onChange={() => handleSettingChange('transcriptionProvider', provider)}
                  />
                  {provider === 'remote' ? 'Remote API' : 'Local Library'}
                </label>
              ))}
            </div>
            {settings.transcriptionProvider === 'remote' && (
              <div className="settings-subsection">
                <h4>API Key</h4>
                <input
                  type="text"
                  value={settings.whisperApiKey}
                  onChange={(e) => handleSettingChange('whisperApiKey', e.target.value)}
                  placeholder="Enter your API Key"
                  className="w-full p-2 mt-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsMenu
