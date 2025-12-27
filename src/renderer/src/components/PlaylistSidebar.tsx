import React from 'react'
import { PlaylistItem } from '../../../types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faTrash, faTimes, faStepForward, faStepBackward, faPlus } from '@fortawesome/free-solid-svg-icons'
import './PlaylistSidebar.scss'

interface PlaylistSidebarProps {
  playlist: PlaylistItem[]
  currentIndex: number
  onSelectItem: (index: number) => void
  onRemoveItem: (index: number) => void
  onPlayNext: () => void
  onPlayPrevious: () => void
  onClose: () => void
  onAddFile: () => void
  isOpen: boolean
}

const PlaylistSidebar: React.FC<PlaylistSidebarProps> = ({
  playlist,
  currentIndex,
  onSelectItem,
  onRemoveItem,
  onPlayNext,
  onPlayPrevious,
  onClose,
  onAddFile,
  isOpen
}) => {
  return (
    <div className={`playlist-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h3>Playlist ({playlist.length})</h3>
        <div className="header-actions">
          <button className="nav-btn" onClick={onAddFile} title="Add File">
            <FontAwesomeIcon icon={faPlus} />
          </button>
          <button
            className="nav-btn"
            onClick={onPlayPrevious}
            disabled={currentIndex <= 0}
            title="Previous"
          >
            <FontAwesomeIcon icon={faStepBackward} />
          </button>
          <button
            className="nav-btn"
            onClick={onPlayNext}
            disabled={currentIndex >= playlist.length - 1}
            title="Next"
          >
            <FontAwesomeIcon icon={faStepForward} />
          </button>
          <button className="close-btn" onClick={onClose} title="Close">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      </div>
      <ul className="playlist-items">
        {playlist.map((item, index) => (
          <li
            key={item.id}
            className={`playlist-item ${index === currentIndex ? 'active' : ''}`}
            onClick={() => onSelectItem(index)}
          >
            <div className="item-info">
              <span className="item-title">{item.title}</span>
            </div>
            <div className="item-actions">
              {index === currentIndex && <FontAwesomeIcon icon={faPlay} className="playing-icon" />}
              <button
                className="remove-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveItem(index)
                }}
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          </li>
        ))}
        {playlist.length === 0 && <li className="empty-msg">No items in playlist</li>}
      </ul>
    </div>
  )
}

export default PlaylistSidebar
