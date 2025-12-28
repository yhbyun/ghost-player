# GhostPlayer 아키텍처 다이어그램

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GhostPlayer Application                      │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Main Process (Node.js)                    │   │
│  │                                                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │   │
│  │  │    Window    │  │     Menu     │  │  Tray & Shortcuts│  │   │
│  │  │   Manager    │  │   Manager    │  │     Manager      │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │   │
│  │                                                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │   │
│  │  │  Side Dock   │  │    Store     │  │     Logger       │  │   │
│  │  │   Manager    │  │   (Config)   │  │                  │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │          Video Processing Module                     │    │   │
│  │  │                                                       │    │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │    │   │
│  │  │  │ Video    │ │ Subtitle │ │ FFmpeg   │            │    │   │
│  │  │  │ Server   │ │ Converter│ │ Helper   │            │    │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘            │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │                                                               │   │
│  │  ┌──────────────┐  ┌─────────────────────────────────┐      │   │
│  │  │    Local     │  │      AdBlocker (Ghostery)       │      │   │
│  │  │ Transcriber  │  │                                 │      │   │
│  │  └──────────────┘  └─────────────────────────────────┘      │   │
│  │                                                               │   │
│  └───────────────────────────┬───────────────────────────────────┘  │
│                               │                                      │
│                               │ IPC (Inter-Process Communication)    │
│                               │                                      │
│  ┌───────────────────────────┴───────────────────────────────────┐  │
│  │                  Renderer Process (Chromium)                  │  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────┐    │  │
│  │  │                 React Application                     │    │  │
│  │  │                                                        │    │  │
│  │  │  ┌─────────────────────────────────────────────┐     │    │  │
│  │  │  │              App.tsx (Main)                 │     │    │  │
│  │  │  │                                              │     │    │  │
│  │  │  │  State: content, playlist, settings, etc.   │     │    │  │
│  │  │  └─────────────────────────────────────────────┘     │    │  │
│  │  │                                                        │    │  │
│  │  │  ┌──────────────┐  ┌──────────────┐                 │    │  │
│  │  │  │  Web Player  │  │Video Player  │                 │    │  │
│  │  │  │  (webview)   │  │  (Video.js)  │                 │    │  │
│  │  │  └──────────────┘  └──────────────┘                 │    │  │
│  │  │                                                        │    │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │    │  │
│  │  │  │Radial Menu   │  │Settings Menu │  │ Playlist │  │    │  │
│  │  │  └──────────────┘  └──────────────┘  └──────────┘  │    │  │
│  │  │                                                        │    │  │
│  │  │  ┌───────────────────────────────────────────┐       │    │  │
│  │  │  │        Audio Visualizer                   │       │    │  │
│  │  │  │  (Canvas + Web Audio API + STT)           │       │    │  │
│  │  │  └───────────────────────────────────────────┘       │    │  │
│  │  └──────────────────────────────────────────────────────┘    │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## 데이터 흐름도

### 1. 로컬 파일 재생 흐름

```
User Action (File Open)
        │
        ├─> Main Process: dialog.showOpenDialog()
        │
        ├─> playVideo(filePath)
        │      │
        │      ├─> FFmpeg: 메타데이터 추출 (duration, subtitles)
        │      │
        │      ├─> video-server: HTTP 서버 시작
        │      │      │
        │      │      └─> 'local-video://...' URL 생성
        │      │
        │      └─> subtitle-converter: SRT → WebVTT 변환
        │             │
        │             └─> 'local-subtitle://...' URL 생성
        │
        └─> IPC: 'open-file' event
               │
               └─> Renderer Process
                      │
                      ├─> Playlist에 추가
                      │
                      └─> VideoPlayer 컴포넌트
                             │
                             └─> Video.js 재생
```

### 2. 스트리밍 서비스 재생 흐름

```
User Action (Service Selection)
        │
        └─> Renderer: handleServiceChange()
               │
               ├─> setContent({ type: 'service', data: service })
               │
               └─> WebPlayer 컴포넌트
                      │
                      └─> <webview> 태그
                             │
                             ├─> preload 스크립트 실행
                             │      │
                             │      └─> (Netflix의 경우: netflix.js)
                             │
                             └─> service.url 로드
```

### 3. 설정 변경 흐름

```
User Action (Settings Menu)
        │
        ├─> Renderer: window.api.setSetting(key, value)
        │
        └─> IPC: 'set-setting'
               │
               └─> Main Process: store.set(key, value)
                      │
                      └─> store.onDidAnyChange() 트리거
                             │
                             ├─> applySetting(key, value)
                             │      │
                             │      ├─> Window 속성 변경
                             │      │   (opacity, alwaysOnTop, etc.)
                             │      │
                             │      └─> Menu 체크 상태 업데이트
                             │
                             └─> IPC: 'setting-changed' event
                                    │
                                    └─> Renderer: UI 업데이트
```

### 4. 음성 인식 (STT) 흐름

```
AudioVisualizer 컴포넌트
        │
        ├─> navigator.mediaDevices.getUserMedia()
        │      │
        │      └─> 마이크 오디오 스트림
        │
        ├─> Web Audio API
        │      │
        │      ├─> AudioContext
        │      │
        │      ├─> AnalyserNode (파형 시각화)
        │      │
        │      └─> ScriptProcessorNode (오디오 캡처)
        │
        ├─> 오디오 데이터 버퍼링
        │
        └─> window.api.transcribeAudio(audioData, apiKey)
               │
               └─> IPC: 'transcribe-audio'
                      │
                      └─> Main Process
                             │
                             ├─> Local Provider?
                             │      │
                             │      └─> local-transcriber.ts
                             │             │
                             │             └─> @xenova/transformers
                             │
                             └─> Remote Provider?
                                    │
                                    └─> API 요청 (lemonfox.ai)
```

## 컴포넌트 상호작용 다이어그램

### Main Process 컴포넌트

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                            │
│                                                               │
│  index.ts (Entry Point)                                      │
│     │                                                         │
│     ├──> BrowserWindow 생성                                  │
│     │      │                                                  │
│     │      └──> SideDock 인스턴스                            │
│     │                                                         │
│     ├──> setupMenu(getMainWindow)                            │
│     │      │                                                  │
│     │      └──> Menu 아이템 클릭 → IPC 또는 직접 실행       │
│     │                                                         │
│     ├──> createTray(mainWindow)                              │
│     │      │                                                  │
│     │      └──> 트레이 아이콘 + 컨텍스트 메뉴               │
│     │                                                         │
│     ├──> ShortcutManager                                     │
│     │      │                                                  │
│     │      └──> globalShortcut.register()                    │
│     │                                                         │
│     ├──> IPC Handlers 등록                                   │
│     │      │                                                  │
│     │      ├──> 'get-initial-content'                        │
│     │      ├──> 'get-setting'                                │
│     │      ├──> 'set-setting'                                │
│     │      ├──> 'open-file-dialog'                           │
│     │      ├──> 'transcribe-audio'                           │
│     │      └──> ...                                           │
│     │                                                         │
│     ├──> registerLocalFileProtocols()                        │
│     │      │                                                  │
│     │      ├──> 'local-video://'                             │
│     │      └──> 'local-subtitle://'                          │
│     │                                                         │
│     └──> ElectronBlocker (AdBlocker)                         │
│            │                                                  │
│            └──> session.defaultSession                       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Renderer Process 컴포넌트

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                          │
│                                                               │
│  App.tsx (Root Component)                                    │
│     │                                                         │
│     ├──> State Management                                    │
│     │      │                                                  │
│     │      ├──> content: ContentSource                       │
│     │      ├──> playlist: PlaylistItem[]                     │
│     │      ├──> currentIndex: number                         │
│     │      ├──> isHovering: boolean                          │
│     │      └──> isDragging: boolean                          │
│     │                                                         │
│     ├──> Event Handlers                                      │
│     │      │                                                  │
│     │      ├──> handleMouseDown() → 윈도우 드래그            │
│     │      ├──> handleDrop() → 파일 드롭                     │
│     │      ├──> handleServiceChange() → 서비스 전환          │
│     │      └──> playNext() / playPrevious()                  │
│     │                                                         │
│     └──> Child Components                                    │
│            │                                                  │
│            ├──> WebPlayer (ref)                              │
│            │      │                                           │
│            │      └──> <webview src={service.url} />         │
│            │                                                  │
│            ├──> VideoPlayer (ref)                            │
│            │      │                                           │
│            │      └──> Video.js Player                       │
│            │                                                  │
│            ├──> RadialMenu                                   │
│            │      │                                           │
│            │      ├──> onServiceChange                       │
│            │      ├──> onHistoryBack                         │
│            │      ├──> onReload                              │
│            │      ├──> onFileOpen                            │
│            │      └──> onPlaylistToggle                      │
│            │                                                  │
│            ├──> SettingsMenu                                 │
│            │      │                                           │
│            │      └──> Settings UI (투명도, 도크 등)         │
│            │                                                  │
│            └──> PlaylistSidebar                              │
│                   │                                           │
│                   ├──> playlist items                        │
│                   ├──> onSelectItem                          │
│                   ├──> onPlayNext / onPlayPrevious           │
│                   └──> onRemoveItem                          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## IPC 통신 맵

### Main → Renderer (Events)

| Event Name | Description | Data |
|-----------|-------------|------|
| `change-service` | 서비스 변경 | `Service` |
| `open-location` | URL 열기 | `string` |
| `open-url` | 커스텀 URL 열기 | `string` |
| `open-file` | 로컬 파일 열기 | `PlayParams` |
| `playback-control` | 재생 제어 | `'play' \| 'pause'` |
| `always-on-top-status-changed` | 알웨이즈 온탑 상태 변경 | `boolean` |
| `setting-changed` | 설정 변경 | `{ key, value }` |

### Renderer → Main (Invokes)

| Method Name | Description | Return |
|------------|-------------|--------|
| `getInitialContent()` | 초기 콘텐츠 가져오기 | `Content` |
| `getSetting(key, defaultValue)` | 설정 가져오기 | `any` |
| `openFile()` | 파일 열기 다이얼로그 | `void` |
| `transcribeAudio(audioData, apiKey)` | 음성 인식 | `string` |

### Renderer → Main (Sends)

| Event Name | Description | Data |
|-----------|-------------|------|
| `set-last-content` | 마지막 콘텐츠 저장 | `Content` |
| `set-setting` | 설정 저장 | `{ key, value }` |
| `mouse-event` | 마우스 이벤트 | `'enter' \| 'leave'` |
| `drag-window` | 윈도우 드래그 | `{ deltaX, deltaY }` |
| `drop-files` | 파일 드롭 | `string[]` |

## 모듈 의존성 그래프

```
Main Process:
  index.ts
    ├─> menu.ts
    ├─> store.ts
    ├─> tray.ts
    ├─> shortcuts.ts
    ├─> logger.ts
    ├─> SideDock.ts
    ├─> local-transcriber.ts
    └─> video/
          ├─> video-playback.ts
          │     ├─> video-server.ts
          │     ├─> subtitle-converter.ts
          │     └─> ffmpeg-helper.ts
          │           └─> ffmpeg-path.ts
          └─> ...

Renderer Process:
  main.tsx
    └─> App.tsx
          ├─> components/
          │     ├─> Player.tsx
          │     ├─> VideoPlayer.tsx
          │     ├─> RadialMenu/
          │     │     ├─> index.tsx
          │     │     ├─> IconNetflix.tsx
          │     │     └─> IconBase.tsx
          │     ├─> SettingsMenu/
          │     │     └─> index.tsx
          │     ├─> PlaylistSidebar.tsx
          │     └─> AudioVisualizer/
          │           └─> index.tsx
          ├─> logger.ts
          └─> config/services.ts

Shared:
  types/index.ts
  config/services.ts
  utils/log-config.ts
```

## 상태 관리 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│              Application State                           │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │          Persistent State (electron-store)     │     │
│  │                                                 │     │
│  │  - windowBounds                                 │     │
│  │  - isTransparent / opacity / transparencyMode   │     │
│  │  - isAlwaysOnTop / alwaysOnTopLevel             │     │
│  │  - isSideDockEnabled / sideDockVisibleWidth     │     │
│  │  - disableMouse                                 │     │
│  │  - lastContent                                  │     │
│  │  - playlist: { items, currentIndex }            │     │
│  │  - shortcuts                                    │     │
│  │  - transcriptionProvider                        │     │
│  │                                                 │     │
│  └────────────────────────────────────────────────┘     │
│                      ↕                                   │
│  ┌────────────────────────────────────────────────┐     │
│  │        React State (useState, useRef)          │     │
│  │                                                 │     │
│  │  - content: ContentSource                       │     │
│  │  - playlist: PlaylistItem[]                     │     │
│  │  - currentIndex: number                         │     │
│  │  - isHovering: boolean                          │     │
│  │  - isDragging: boolean                          │     │
│  │  - isContextHovering: boolean                   │     │
│  │  - isPlaylistOpen: boolean                      │     │
│  │  - alwaysOnTopIndicator: object | null          │     │
│  │  - isLoaded: boolean                            │     │
│  │                                                 │     │
│  │  Refs:                                          │     │
│  │  - webPlayerRef: PlayerRef                      │     │
│  │  - videoPlayerRef: Player                       │     │
│  │  - dragRef: { isDragging, startX, startY }      │     │
│  │  - alwaysOnTopTimeoutRef: number                │     │
│  │                                                 │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

**문서 버전**: 1.0  
**작성일**: 2025-12-28  
**작성자**: Architecture Documentation
