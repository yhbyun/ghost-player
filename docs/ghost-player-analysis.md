# GhostPlayer 프로젝트 분석 문서

## 📋 프로젝트 개요

**프로젝트명**: GhostPlayer  
**버전**: 1.0.0  
**타입**: Electron 기반 데스크톱 비디오 플레이어  
**설명**: 투명하고 떠있는 데스크톱 비디오 플레이어로 멀티태스킹 환경에 최적화

## 🎯 주요 기능

### 1. 기본 기능
- **플로팅 윈도우**: 모든 애플리케이션 위에 떠있는 윈도우
- **조절 가능한 투명도**: 10%~100% 투명도 조절 가능
- **다중 서비스 지원**: YouTube, Netflix 등 스트리밍 서비스 지원
- **로컬 파일 재생**: mp4, webm, mkv, avi, mov 등 다양한 비디오 형식 지원
- **사이드 도크 모드**: 화면 측면에 도킹하여 사용 가능
- **클릭 투과 모드**: 플레이어를 클릭할 수 없게 하여 아래 애플리케이션과 상호작용
- **커스텀 단축키**: 전역 단축키로 플레이어 제어

### 2. 고급 기능
- **Widevine DRM 지원**: Netflix 등 DRM 콘텐츠 재생 지원
- **자막 변환**: SRT, WebVTT 자막 형식 지원 및 변환
- **오디오 시각화**: 오디오 파형 시각화 기능
- **실시간 자막 생성**: 음성을 텍스트로 변환 (STT)
- **광고 차단**: Ghostery 광고 차단 기능 내장
- **플레이리스트**: 여러 비디오를 플레이리스트로 관리

## 🏗️ 기술 스택

### 프론트엔드
- **React 19.1.1**: UI 컴포넌트 라이브러리
- **TypeScript 5.9.2**: 타입 안전성
- **Tailwind CSS 3.4.17**: 유틸리티 기반 CSS 프레임워크
- **Video.js 8.23.4**: 비디오 재생 라이브러리
- **FontAwesome 7.1.0**: 아이콘 라이브러리

### 백엔드 (Electron Main Process)
- **Electron**: Castlabs fork (v39.0.0+wvcus) - Widevine 지원
- **FFmpeg**: 비디오/오디오 처리
- **Fluent FFmpeg**: FFmpeg Node.js 래퍼

### 빌드 도구
- **Electron Vite 4.0.1**: 빌드 도구
- **Electron Builder 25.1.8**: 패키징 도구
- **Vite 7.1.6**: 프론트엔드 빌드 도구

### AI/ML
- **Xenova Transformers 2.17.2**: 로컬 음성 인식 모델

### 기타
- **Electron Store 11.0.2**: 설정 저장
- **Ghostery AdBlocker**: 광고 차단

## 📁 프로젝트 구조

```
ghost-player/
├── src/
│   ├── main/                    # Electron Main Process
│   │   ├── index.ts            # 메인 프로세스 엔트리포인트
│   │   ├── menu.ts             # 애플리케이션 메뉴
│   │   ├── store.ts            # 설정 저장소
│   │   ├── tray.ts             # 시스템 트레이
│   │   ├── shortcuts.ts        # 단축키 관리
│   │   ├── logger.ts           # 로깅
│   │   ├── SideDock.ts         # 사이드 도크 기능
│   │   ├── local-transcriber.ts # 로컬 음성 인식
│   │   └── video/              # 비디오 처리
│   │       ├── video-playback.ts    # 비디오 재생
│   │       ├── video-server.ts      # 로컬 비디오 서버
│   │       ├── subtitle-converter.ts # 자막 변환
│   │       ├── ffmpeg-helper.ts     # FFmpeg 헬퍼
│   │       └── ffmpeg-path.ts       # FFmpeg 경로
│   │
│   ├── renderer/               # Electron Renderer Process
│   │   └── src/
│   │       ├── App.tsx         # 메인 React 컴포넌트
│   │       ├── main.tsx        # React 엔트리포인트
│   │       ├── logger.ts       # 렌더러 로거
│   │       └── components/     # React 컴포넌트
│   │           ├── Player.tsx            # 웹 플레이어 (webview)
│   │           ├── VideoPlayer.tsx       # 로컬 비디오 플레이어
│   │           ├── PlaylistSidebar.tsx   # 플레이리스트
│   │           ├── RadialMenu/           # 래디얼 메뉴
│   │           ├── SettingsMenu/         # 설정 메뉴
│   │           ├── AudioVisualizer/      # 오디오 시각화
│   │           └── StreamPlayTech.ts     # 스트림 재생 기술
│   │
│   ├── preload/                # Preload Scripts
│   │   ├── index.ts            # 메인 preload
│   │   └── netflix.js          # Netflix 전용 preload
│   │
│   ├── config/                 # 설정
│   │   └── services.ts         # 스트리밍 서비스 정의
│   │
│   ├── types/                  # TypeScript 타입 정의
│   │   └── index.ts
│   │
│   └── utils/                  # 유틸리티
│       └── log-config.ts
│
├── build/                      # 빌드 리소스
│   ├── icon.png
│   └── entitlements.mac.plist
│
├── resources/                  # 애플리케이션 리소스
│   ├── icon.png
│   ├── icon.svg
│   ├── play.png
│   └── stop.png
│
├── docs/                       # 문서
│   └── screenshot.png
│
├── electron.vite.config.ts     # Electron Vite 설정
├── electron-builder.yml        # Electron Builder 설정
├── package.json                # 의존성 및 스크립트
├── tsconfig.json               # TypeScript 설정
├── tailwind.config.js          # Tailwind CSS 설정
└── README.md                   # 프로젝트 README
```

## 🔑 핵심 컴포넌트 분석

### 1. Main Process (`src/main/index.ts`)

메인 프로세스는 Electron 애플리케이션의 핵심으로, 다음 기능을 담당합니다:

**주요 기능:**
- 윈도우 생성 및 관리
- 설정 저장/로드 (electron-store)
- IPC 통신 핸들러
- 광고 차단 (Ghostery AdBlocker)
- 로컬 파일 프로토콜 등록 (`local-video://`, `local-subtitle://`)
- 메뉴 및 트레이 설정
- 단축키 등록
- 투명도 및 알웨이즈 온탑 제어

**핵심 코드:**
```typescript
// 윈도우 생성 시 투명도 설정
mainWindow = new BrowserWindow({
  transparent: true,
  frame: false,
  opacity: initialOpacity,
  webPreferences: {
    webviewTag: true  // 웹 서비스 임베딩용
  }
})

// 광고 차단 설정
const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch)
blocker.enableBlockingInSession(session.defaultSession)

// 로컬 파일 프로토콜 등록
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-video', privileges: { stream: true } }
])
```

### 2. Renderer Process (`src/renderer/src/App.tsx`)

React 기반 UI를 담당하며 다음을 관리합니다:

**상태 관리:**
- `content`: 현재 재생 중인 콘텐츠 (서비스 또는 비디오)
- `playlist`: 플레이리스트 항목들
- `currentIndex`: 현재 재생 중인 항목 인덱스
- `isHovering`: 마우스 호버 상태
- `isDragging`: 윈도우 드래그 상태

**주요 기능:**
- 드래그 앤 드롭으로 파일 추가
- 웹 서비스 전환
- 플레이리스트 관리
- 비디오 재생 제어

### 3. Video Playback (`src/main/video/`)

비디오 재생과 관련된 모든 기능을 담당:

**video-playback.ts:**
- 로컬 비디오 파일 재생
- 자막 처리
- 비디오 메타데이터 추출

**video-server.ts:**
- 로컬 HTTP 서버로 비디오 스트리밍
- Range 요청 지원 (시크 가능)

**subtitle-converter.ts:**
- SRT를 WebVTT로 변환
- 인코딩 감지 및 변환 (iconv-lite)

**ffmpeg-helper.ts:**
- FFmpeg를 사용한 자막 추출
- 오디오 추출
- 비디오 메타데이터 파싱

### 4. Side Dock (`src/main/SideDock.ts`)

화면 측면에 플레이어를 도킹하는 기능:

```typescript
class SideDock {
  enable() {
    // 윈도우를 화면 오른쪽에 배치
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    this.window.setBounds({
      x: screenWidth - this.visibleWidth,
      y: 0,
      width: this.fullWidth,
      height: screenHeight
    })
  }
  
  handleMouseEnter() {
    // 마우스 오버 시 전체 윈도우 표시
    this.window.setBounds({ x: screenWidth - this.fullWidth })
  }
}
```

### 5. Audio Visualizer (`src/renderer/src/components/AudioVisualizer/`)

실시간 오디오 시각화 및 음성 인식:

**기능:**
- 마이크 입력 캡처
- 실시간 오디오 파형 표시 (Canvas)
- 음성을 텍스트로 변환 (STT)
- 로컬 또는 원격 API 사용 가능

### 6. Settings Store (`src/main/store.ts`)

Electron Store를 사용한 설정 관리:

**저장되는 설정:**
```typescript
{
  windowBounds: { x, y, width, height },
  isTransparent: boolean,
  opacity: number,
  transparencyMode: 'always' | 'mouseover' | 'mouseout',
  isAlwaysOnTop: boolean,
  alwaysOnTopLevel: string,
  isSideDockEnabled: boolean,
  sideDockVisibleWidth: number,
  disableMouse: boolean,
  lastContent: Content,
  playlist: { items: [], currentIndex: -1 },
  shortcuts: { ... },
  transcriptionProvider: 'local' | 'remote'
}
```

## 🎨 UI 컴포넌트

### Radial Menu
- 래디얼 형태의 메뉴
- 서비스 전환, 뒤로가기, 새로고침, 파일 열기, 플레이리스트 토글
- SVG 기반 아이콘

### Settings Menu
- 톱니바퀴 아이콘 클릭 시 표시
- 투명도, 알웨이즈 온탑, 사이드 도크 등 설정
- 체크박스, 슬라이더 UI

### Playlist Sidebar
- 오른쪽에서 슬라이드되는 사이드바
- 플레이리스트 항목 표시
- 재생/삭제/추가 기능

### Video Player
- Video.js 기반
- 자막 지원
- 재생 컨트롤

### Web Player (webview)
- Electron webview 태그 사용
- YouTube, Netflix 등 웹 서비스 임베딩
- Netflix용 별도 preload 스크립트

## 🔐 보안 및 DRM

### Widevine DRM
- Castlabs Electron 사용
- Netflix 등 DRM 콘텐츠 재생 가능
- `electron-builder.yml`에 Widevine 미러 설정

```yaml
electronDownload:
  mirror: "https://github.com/castlabs/electron-releases/releases/download/v"
```

### Content Security Policy
- webview에서 각 서비스의 CSP 존중
- 광고 차단으로 추적 방지

## 🚀 빌드 및 배포

### 개발 모드
```bash
npm run dev
```

### 프로덕션 빌드
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### 빌드 설정 (`electron-builder.yml`)
```yaml
appId: com.electron.ghost-player
productName: GhostPlayer
directories:
  output: dist
  buildResources: build
files:
  - "!**/.vscode/*"
  - "!**/.git/*"
asarUnpack:
  - "**/node_modules/@ffmpeg-installer/ffmpeg/bin/**"
```

## 🧩 주요 의존성

### 핵심 라이브러리
- `electron`: Castlabs fork (Widevine 지원)
- `electron-vite`: 빌드 도구
- `electron-builder`: 패키징
- `react` / `react-dom`: UI 프레임워크

### 비디오 처리
- `video.js`: 비디오 플레이어
- `@ffmpeg-installer/ffmpeg`: FFmpeg 바이너리
- `fluent-ffmpeg`: FFmpeg Node.js API

### AI/ML
- `@xenova/transformers`: 로컬 음성 인식 모델

### 유틸리티
- `electron-store`: 설정 저장
- `electron-prompt`: 프롬프트 다이얼로그
- `@ghostery/adblocker-electron`: 광고 차단
- `iconv-lite`: 문자 인코딩 변환

## 🛠️ 개발 팁

### 1. 로깅
```typescript
// Main process
import { logger } from './logger'
logger.log('category', 'message', data)

// Renderer process
import { logger } from './logger'
logger.log('category', 'message', data)
```

### 2. IPC 통신
```typescript
// Main -> Renderer
mainWindow.webContents.send('event-name', data)

// Renderer -> Main
window.api.eventName(data)
```

### 3. 설정 저장
```typescript
// Main process
store.set('key', value)
const value = store.get('key', defaultValue)

// Renderer process
window.api.setSetting('key', value)
const value = await window.api.getSetting('key', defaultValue)
```

### 4. 비디오 프로토콜
```typescript
// 로컬 비디오 URL
'local-video://absolute/path/to/video.mp4'

// 로컬 자막 URL
'local-subtitle://absolute/path/to/subtitle.vtt'
```

## 📝 TODO 항목 (프로젝트에서 발견된 것들)

프로젝트에는 여러 TODO 파일이 있습니다:
- `todo.md`: 일반 TODO
- `yhbyun-todo.md`: 개발자별 TODO
- `netflix-dual-subs-task.md`: Netflix 이중 자막 기능
- `widevine.md`: Widevine 관련 문서
- `playback-error-on-production.md`: 프로덕션 재생 오류

## 🎯 향후 개선 방향

1. **성능 최적화**
   - 비디오 스트리밍 최적화
   - 메모리 사용량 감소

2. **기능 추가**
   - 더 많은 스트리밍 서비스 지원
   - 키보드 단축키 커스터마이징
   - 화면 녹화 기능
   - PiP (Picture-in-Picture) 모드

3. **UI/UX 개선**
   - 다크/라이트 테마
   - 더 많은 커스터마이징 옵션
   - 드래그 가능한 메뉴 위치

4. **버그 수정**
   - 프로덕션 환경 재생 오류
   - Netflix 이중 자막 안정화

## 🤝 기여 가이드

이 프로젝트는 다음과 같은 방식으로 기여할 수 있습니다:

1. **버그 리포트**: GitHub Issues에 버그 리포트 제출
2. **기능 제안**: 새로운 기능에 대한 아이디어 공유
3. **코드 기여**: Pull Request 제출
4. **문서 개선**: README 및 문서 업데이트

## 📄 라이선스

MIT License

---

**분석 작성일**: 2025-12-28  
**프로젝트 버전**: 1.0.0  
**Electron 버전**: v39.0.0+wvcus (Castlabs)
