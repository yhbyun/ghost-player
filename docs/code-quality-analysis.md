# GhostPlayer 코드 품질 분석 및 개선 제안

## 📊 프로젝트 통계

- **총 TypeScript 파일 수**: 33개
- **총 코드 라인 수**: ~4,474 라인
- **주요 언어**: TypeScript (100%)
- **프레임워크**: Electron + React
- **빌드 도구**: Electron Vite

## ✅ 코드 품질 장점

### 1. 구조적 강점
- **명확한 관심사 분리**: Main Process / Renderer Process / Preload 스크립트 분리
- **모듈화된 설계**: 각 기능이 별도 모듈로 분리 (video/, components/ 등)
- **타입 안전성**: TypeScript 사용으로 타입 체크
- **설정 관리**: electron-store 사용으로 체계적인 설정 관리

### 2. 개발 환경
- **최신 도구 사용**: Vite, React 19, TypeScript 5
- **린팅 및 포맷팅**: ESLint, Prettier 설정
- **핫 리로드**: Electron Vite의 HMR 지원

### 3. 기능적 강점
- **확장 가능한 서비스 구조**: services.ts로 새 서비스 추가 용이
- **유연한 설정 시스템**: store.onDidAnyChange로 반응형 설정
- **강력한 비디오 처리**: FFmpeg 통합

## ⚠️ 개선이 필요한 영역

### 1. 에러 처리

**현재 상황:**
```typescript
// 많은 곳에서 에러가 적절히 처리되지 않음
ipcMain.on('drop-files', async (_, filePaths: string[]) => {
  if (!mainWindow) return
  for (const filePath of filePaths) {
    await playVideo(mainWindow, filePath)  // 에러 처리 없음
  }
})
```

**개선 제안:**
```typescript
ipcMain.on('drop-files', async (_, filePaths: string[]) => {
  if (!mainWindow) return
  
  for (const filePath of filePaths) {
    try {
      await playVideo(mainWindow, filePath)
    } catch (error) {
      logger.error('drop-files', `Failed to play ${filePath}:`, error)
      dialog.showErrorBox('재생 오류', `파일을 재생할 수 없습니다: ${error.message}`)
    }
  }
})
```

### 2. 코드 중복

**video-playback.ts와 video-server.ts:**
```typescript
// 비슷한 파일 읽기 로직이 여러 곳에 중복
// 공통 유틸리티 함수로 추출 필요
```

**개선 제안:**
```typescript
// utils/file-utils.ts
export async function readFileWithRange(
  filePath: string, 
  range?: { start: number; end: number }
): Promise<Buffer> {
  // 공통 로직
}
```

### 3. 타입 정의

**현재 상황:**
```typescript
// App.tsx에서 많은 any 타입 사용
const customService: Service = {
  name: 'Custom URL',
  icon: '', // 타입 명확하지 않음
  url: url,
  color: '#4a90e2'
}
```

**개선 제안:**
```typescript
// types/index.ts
export interface CustomService extends Service {
  isCustom: true
  createdAt: number
}

// 더 명확한 타입 정의
export type IconType = string | React.ComponentType<{ size?: number }>
```

### 4. 상태 관리

**현재 상황:**
- React의 useState만 사용
- 복잡한 상태 로직이 App.tsx에 집중
- Props drilling 발생 가능성

**개선 제안:**
```typescript
// Context API 또는 상태 관리 라이브러리 도입
// contexts/PlayerContext.tsx
export const PlayerContext = createContext<PlayerContextType>({
  content: null,
  playlist: [],
  currentIndex: -1,
  setContent: () => {},
  // ...
})

// App.tsx
<PlayerContext.Provider value={playerState}>
  <RadialMenu />
  <SettingsMenu />
  {/* ... */}
</PlayerContext.Provider>
```

### 5. 테스트 부재

**현재 상황:**
- 단위 테스트 없음
- E2E 테스트 없음

**개선 제안:**
```typescript
// tests/unit/video-playback.test.ts
import { playVideo } from '../src/main/video/video-playback'

describe('playVideo', () => {
  it('should extract video metadata', async () => {
    const mockWindow = createMockBrowserWindow()
    const result = await playVideo(mockWindow, 'test.mp4')
    expect(result).toHaveProperty('duration')
  })
})

// tests/e2e/app.spec.ts
import { test, expect } from '@playwright/test'

test('should open file dialog', async ({ page }) => {
  await page.click('[data-testid="open-file"]')
  // ...
})
```

### 6. 성능 최적화

**문제점:**
```typescript
// App.tsx - 불필요한 리렌더링 가능성
const renderedContent = useMemo(() => {
  // ...
}, [content, handleTimeUpdate, playNext])

// handleTimeUpdate는 매 렌더링마다 새로 생성됨
```

**개선 제안:**
```typescript
// useCallback으로 최적화
const handleTimeUpdate = useCallback(
  (time: number): void => {
    // ...
  },
  [content, playlist, currentIndex]
)

// React.memo로 자식 컴포넌트 최적화
export const VideoPlayer = React.memo(({ src, type, ... }) => {
  // ...
})
```

### 7. 보안

**문제점:**
```typescript
// Player.tsx - webview 사용
// webview는 보안 취약점이 될 수 있음
<webview src={service.url} />
```

**개선 제안:**
```typescript
// BrowserView 사용 검토
const view = new BrowserView({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true
  }
})

// 또는 더 안전한 iframe 사용
<iframe 
  sandbox="allow-scripts allow-same-origin"
  src={service.url}
/>
```

### 8. 로깅 시스템

**현재 상황:**
```typescript
// logger.ts - 단순한 콘솔 로그
export const logger = {
  log: (category: string, ...args: unknown[]) => {
    console.log(`[${category}]`, ...args)
  }
}
```

**개선 제안:**
```typescript
// 구조화된 로깅
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'combined.log' 
    })
  ]
})

// 환경별 로그 레벨
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}
```

## 🔧 구체적인 개선 제안

### 1. 에러 바운더리 추가

```typescript
// components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('react', 'Uncaught error:', error, errorInfo)
    // Sentry 등 에러 트래킹 서비스에 전송
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    return this.props.children
  }
}

// App.tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

### 2. 설정 검증 추가

```typescript
// store.ts
import Ajv from 'ajv'

const schema = {
  type: 'object',
  properties: {
    opacity: { type: 'number', minimum: 0.1, maximum: 1.0 },
    windowBounds: {
      type: 'object',
      required: ['x', 'y', 'width', 'height']
    }
  }
}

const ajv = new Ajv()
const validate = ajv.compile(schema)

export const store = new Store({
  beforeEach: (key, value) => {
    if (!validate({ [key]: value })) {
      throw new Error(`Invalid config: ${ajv.errorsText(validate.errors)}`)
    }
  }
})
```

### 3. 메모리 누수 방지

```typescript
// App.tsx
useEffect(() => {
  // 이벤트 리스너 정리
  return () => {
    if (alwaysOnTopTimeoutRef.current) {
      clearTimeout(alwaysOnTopTimeoutRef.current)
    }
  }
}, [])

// VideoPlayer.tsx
useEffect(() => {
  return () => {
    // Video.js 인스턴스 정리
    if (playerRef.current) {
      playerRef.current.dispose()
      playerRef.current = null
    }
  }
}, [])
```

### 4. 접근성 개선

```typescript
// RadialMenu/index.tsx
<button
  aria-label="서비스 메뉴 열기"
  aria-expanded={isOpen}
  onClick={handleToggle}
>
  {/* ... */}
</button>

// SettingsMenu/index.tsx
<label htmlFor="opacity-slider">
  투명도: {opacity * 100}%
</label>
<input
  id="opacity-slider"
  type="range"
  min="0.1"
  max="1"
  step="0.1"
  value={opacity}
  aria-valuemin={10}
  aria-valuemax={100}
  aria-valuenow={opacity * 100}
/>
```

### 5. 국제화 (i18n) 추가

```typescript
// i18n/index.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {
          'settings.transparency': 'Transparency',
          'settings.opacity': 'Opacity'
        }
      },
      ko: {
        translation: {
          'settings.transparency': '투명도',
          'settings.opacity': '불투명도'
        }
      }
    },
    lng: 'ko',
    fallbackLng: 'en'
  })

// 컴포넌트에서 사용
import { useTranslation } from 'react-i18next'

function SettingsMenu() {
  const { t } = useTranslation()
  return <div>{t('settings.transparency')}</div>
}
```

### 6. 자동 업데이트 기능

```typescript
// main/updater.ts
import { autoUpdater } from 'electron-updater'

export function setupAutoUpdater() {
  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: '업데이트 사용 가능',
      message: '새 버전이 있습니다. 다운로드하시겠습니까?'
    })
  })

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: '업데이트 준비 완료',
      message: '업데이트가 다운로드되었습니다. 재시작하시겠습니까?',
      buttons: ['재시작', '나중에']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })
}
```

### 7. 성능 모니터링

```typescript
// main/performance.ts
import { powerMonitor, app } from 'electron'

export function setupPerformanceMonitoring() {
  // 전력 상태 모니터링
  powerMonitor.on('on-battery', () => {
    logger.info('performance', 'Running on battery')
    // 배터리 모드에서 성능 조정
  })

  // 메모리 사용량 모니터링
  setInterval(() => {
    const memory = process.memoryUsage()
    if (memory.heapUsed > 500 * 1024 * 1024) { // 500MB 초과
      logger.warn('performance', 'High memory usage:', memory)
    }
  }, 60000) // 1분마다

  // CPU 사용량 모니터링
  app.on('browser-window-focus', () => {
    const cpuUsage = process.cpuUsage()
    logger.info('performance', 'CPU usage:', cpuUsage)
  })
}
```

## 📈 코드 품질 메트릭 목표

### 현재 상태
- **테스트 커버리지**: 0%
- **TypeScript Strict Mode**: ❌
- **ESLint 에러**: ?
- **번들 크기**: 측정 필요

### 목표
- **테스트 커버리지**: 70% 이상
- **TypeScript Strict Mode**: ✅
- **ESLint 에러**: 0
- **번들 크기**: 최적화 (Code Splitting)

## 🛠️ 개발 워크플로우 개선

### 1. CI/CD 파이프라인

```yaml
# .github/workflows/main.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Type check
        run: npm run typecheck
      - name: Test
        run: npm test
      - name: Build
        run: npm run build

  release:
    needs: test
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    steps:
      - name: Build & Release
        run: npm run build:${{ matrix.os }}
```

### 2. Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

### 3. 커밋 메시지 컨벤션

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 변경
style: 코드 스타일 변경 (포맷팅)
refactor: 리팩토링
test: 테스트 추가/수정
chore: 빌드 프로세스, 도구 설정 변경

예:
feat(video): Add H.265 codec support
fix(playlist): Fix item deletion bug
docs(readme): Update installation instructions
```

## 📚 문서화 개선

### 1. API 문서

```typescript
/**
 * 비디오 파일을 재생합니다.
 * 
 * @param window - 메인 윈도우 인스턴스
 * @param filePath - 재생할 비디오 파일의 절대 경로
 * @param options - 재생 옵션
 * @returns 비디오 메타데이터를 포함한 Promise
 * 
 * @example
 * ```typescript
 * await playVideo(mainWindow, '/path/to/video.mp4', {
 *   autoplay: true,
 *   startTime: 0
 * })
 * ```
 * 
 * @throws {Error} 파일을 찾을 수 없거나 지원되지 않는 형식인 경우
 */
export async function playVideo(
  window: BrowserWindow,
  filePath: string,
  options?: PlayOptions
): Promise<VideoMetadata>
```

### 2. 아키텍처 결정 기록 (ADR)

```markdown
# ADR-001: Electron의 Castlabs Fork 사용

## 상태
채택됨

## 컨텍스트
Netflix 등 DRM 콘텐츠 재생을 위해 Widevine CDM 지원이 필요합니다.
표준 Electron은 Widevine 라이선스 문제로 직접 사용이 어렵습니다.

## 결정
Castlabs의 Electron fork를 사용하기로 결정했습니다.

## 결과
장점:
- Widevine CDM 즉시 사용 가능
- Netflix, Disney+ 등 주요 스트리밍 서비스 지원

단점:
- 표준 Electron 업데이트 지연 가능성
- 커뮤니티 지원 제한적
```

## 🔍 코드 리뷰 체크리스트

- [ ] 에러 처리가 적절한가?
- [ ] 타입이 명확하게 정의되었는가?
- [ ] 메모리 누수 가능성은 없는가?
- [ ] 보안 취약점은 없는가?
- [ ] 테스트 코드가 작성되었는가?
- [ ] 문서화가 충분한가?
- [ ] 접근성이 고려되었는가?
- [ ] 성능 최적화가 되었는가?

---

**문서 버전**: 1.0  
**작성일**: 2025-12-28  
**마지막 업데이트**: 2025-12-28
