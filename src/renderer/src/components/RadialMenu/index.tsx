import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faYoutube } from '@fortawesome/free-brands-svg-icons'
import { faArrowLeft, faRedo, faFolderOpen } from '@fortawesome/free-solid-svg-icons'
import IconBase from './IconBase'
import IconNetflix from './IconNetflix'
import './style.scss'

interface RadialMenuProps {
  reset: boolean
  onServiceChange: (service: string) => void
  onHistoryBack: () => void
  onReload: () => void
  onFileOpen: () => void
}

const RadialMenu: React.FC<RadialMenuProps> = ({
  reset,
  onServiceChange,
  onHistoryBack,
  onReload,
  onFileOpen
}) => {
  const [expanded, setExpanded] = useState(false)
  const [neverExpanded, setNeverExpanded] = useState(true)
  const [menuClicked, setMenuClicked] = useState(false)
  const [clickedItem, setClickedItem] = useState<string | null>(null)

  const resetMenu = (): void => {
    setExpanded(false)
    setMenuClicked(false)
    setNeverExpanded(true)
    setClickedItem(null)
  }

  useEffect(() => {
    if (reset) {
      resetMenu()
    }
  }, [reset])

  const toggleMenus = (): void => {
    setExpanded(!expanded)
    setNeverExpanded(false)
    setMenuClicked(false)
    setClickedItem(null)
  }

  const handleMenuClicked = (e: React.MouseEvent<HTMLAnchorElement>, service?: string): void => {
    e.preventDefault()
    setExpanded(!expanded)
    setMenuClicked(true)
    if (service) {
      setClickedItem(service)
    }

    setTimeout(() => resetMenu(), 500)

    switch (service) {
      case 'history-back':
        onHistoryBack()
        break
      case 'reload':
        onReload()
        break
      case 'file-open':
        onFileOpen()
        break
      case 'YouTube':
      case 'Netflix':
        if (service) onServiceChange(service)
        break
      default:
        break
    }
  }

  const menuItems = [
    {
      service: 'YouTube',
      icon: <FontAwesomeIcon icon={faYoutube} style={{ color: '#FF0000' }} />
    },
    {
      service: 'Netflix',
      icon: (
        <IconBase viewBox="0 0 512 512" width="24" height="24">
          <IconNetflix />
        </IconBase>
      )
    },
    { service: 'file-open', icon: <FontAwesomeIcon icon={faFolderOpen} /> },
    { service: 'history-back', icon: <FontAwesomeIcon icon={faArrowLeft} /> },
    { service: 'reload', icon: <FontAwesomeIcon icon={faRedo} /> },
    { service: 'empty1' },
    { service: 'empty2' }
  ]

  const radialClasses = [
    'radial',
    neverExpanded ? 'radial-init' : '',
    menuClicked ? 'fade' : '',
    expanded ? 'expand' : ''
  ]
    .join(' ')
    .trim()

  const menuRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (expanded) {
      menuRef.current?.focus()
    }
  }, [expanded])

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>): void => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setExpanded(false)
    }
  }

  return (
    <div className="radial-wrap" ref={menuRef} tabIndex={-1} onBlur={handleBlur}>
      <div
        className={`radial-btn ${expanded ? 'btn-rotate' : ''}`}
        title="Toggle"
        onClick={toggleMenus}
      >
        <div>+</div>
      </div>
      <ul className={radialClasses}>
        {menuItems.map((item, index) => (
          <li key={item.service || index}>
            {item.icon ? (
              <a
                href="#"
                onClick={(e) => handleMenuClicked(e, item.service)}
                className={clickedItem === item.service ? 'clicked' : ''}
              >
                <span>{item.icon}</span>
              </a>
            ) : (
              <a href="#" onClick={(e) => handleMenuClicked(e)}>
                <span />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default RadialMenu
