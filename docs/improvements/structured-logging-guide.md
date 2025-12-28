# Structured Logging System - User Guide

## 개요

GhostPlayer의 개선된 로깅 시스템은 로그 레벨, 파일 rotation, 환경별 설정을 지원합니다.

## 로그 레벨

로그는 심각도에 따라 4단계로 분류됩니다:

### 1. DEBUG (가장 낮음)
- 상세한 디버깅 정보
- 개발 중에만 사용
- 프로덕션에서는 비활성화

**사용 예:**
```typescript
logger.debug('video', 'Frame processing details:', frameData)
```

### 2. INFO
- 일반적인 정보성 메시지
- 정상적인 작동 흐름 추적
- 기본 로그 레벨

**사용 예:**
```typescript
logger.info('video', 'Video playback started')
logger.log('video', 'Video playback started')  // log는 info의 alias
```

### 3. WARN
- 경고 메시지
- 문제가 될 수 있지만 치명적이지 않음
- 주의가 필요한 상황

**사용 예:**
```typescript
logger.warn('video', 'Subtitle file not found, continuing without subtitles')
```

### 4. ERROR (가장 높음)
- 에러 메시지
- 작동 실패나 예외 상황
- 즉시 확인 필요

**사용 예:**
```typescript
logger.error('video', 'Failed to load video:', error)
```

## 로그 카테고리

로그는 카테고리로 필터링됩니다. `src/utils/log-config.ts`에서 관리:

```typescript
export const activeCategories: string[] = [
  'video',           // 비디오 재생
  'subtitle',        // 자막 처리
  'error-handler',   // 에러 핸들러
  'react',           // React 컴포넌트
  'ipc',             // IPC 통신
  'adblocker',       // 광고 차단
  // ... more
]
```

### 카테고리 추가 방법

```typescript
// 1. log-config.ts에 추가
export const activeCategories = [
  // ... existing
  'my-feature'
]

// 2. 코드에서 사용
logger.info('my-feature', 'Feature initialized')
```

## 환경별 설정

### 개발 모드 (npm run dev)
```typescript
{
  minLevel: LogLevel.DEBUG,  // DEBUG 이상 모두 표시
  enableConsole: true,       // Console 출력 활성화
  enableFile: true,          // 파일 저장 활성화
}
```

### 프로덕션 모드 (npm run build)
```typescript
{
  minLevel: LogLevel.INFO,   // INFO 이상만 표시
  enableConsole: true,       // Console 출력 활성화
  enableFile: true,          // 파일 저장 활성화
}
```

## 로그 파일 관리

### 파일 위치

**Main Process:**
- macOS: `~/Library/Application Support/GhostPlayer/logs/`
- Windows: `%APPDATA%/GhostPlayer/logs/`
- Linux: `~/.config/GhostPlayer/logs/`

**파일 구조:**
```
logs/
├── main.log       (현재 로그)
├── main.1.log     (이전 로그)
├── main.2.log
├── main.3.log
└── main.4.log     (가장 오래된 로그)
```

### 자동 Rotation

로그 파일이 5MB를 초과하면 자동으로 rotation:

1. `main.log` → `main.1.log`
2. `main.1.log` → `main.2.log`
3. ...
4. `main.4.log` → 삭제

최대 5개 파일 유지 (약 25MB).

### 수동 정리

```typescript
// 프로그램 시작 시 자동 실행
logger.cleanOldLogs()

// 또는 수동 실행
import { logger } from './logger'
logger.cleanOldLogs()
```

## Logger API

### Main Process (src/main/logger.ts)

```typescript
import { logger, LogLevel } from './logger'

// 로그 레벨별 메서드
logger.debug('category', 'Debug message')
logger.info('category', 'Info message')
logger.log('category', 'Info message')  // info의 alias
logger.warn('category', 'Warning message')
logger.error('category', 'Error message', errorObject)

// 설정 변경
logger.configure({
  minLevel: LogLevel.DEBUG,
  enableConsole: true,
  enableFile: true,
  maxFileSize: 10 * 1024 * 1024,  // 10MB
  maxFiles: 10
})

// 유틸리티 메서드
const logPath = logger.getLogFilePath()
const logsDir = logger.getLogsDirectory()
logger.cleanOldLogs()
```

### Renderer Process (src/renderer/src/logger.ts)

```typescript
import { logger, LogLevel } from './logger'

// 로그 레벨별 메서드 (파일 저장 없음, console만)
logger.debug('category', 'Debug message')
logger.info('category', 'Info message')
logger.log('category', 'Info message')  // info의 alias
logger.warn('category', 'Warning message')
logger.error('category', 'Error message')

// 설정 변경
logger.configure({
  minLevel: LogLevel.DEBUG,
  enableConsole: true
})
```

## 사용 예제

### 비디오 재생 로깅

```typescript
import { logger } from './logger'

async function playVideo(filePath: string) {
  logger.info('video', `Starting playback: ${filePath}`)
  
  try {
    // 상세한 디버그 정보
    logger.debug('video', 'Checking codec support...')
    const codec = await checkCodec(filePath)
    logger.debug('video', 'Codec info:', codec)
    
    // 정상 작동
    logger.info('video', 'Playback started successfully')
    
  } catch (error) {
    logger.error('video', 'Playback failed:', error)
    throw error
  }
}
```

### 에러 처리 로깅

```typescript
try {
  await riskyOperation()
} catch (error) {
  if (error instanceof FileNotFoundError) {
    logger.warn('video', 'File not found, using default')
  } else if (error instanceof CriticalError) {
    logger.error('video', 'Critical error occurred:', error)
  } else {
    logger.error('video', 'Unexpected error:', error)
  }
}
```

### IPC 통신 로깅

```typescript
ipcMain.handle('open-file', async (_, filePath) => {
  logger.info('ipc', 'Received open-file request:', filePath)
  
  try {
    const result = await openFile(filePath)
    logger.debug('ipc', 'File opened successfully')
    return result
  } catch (error) {
    logger.error('ipc', 'Failed to open file:', error)
    throw error
  }
})
```

## 로그 포맷

### 파일 로그 포맷

```
[2025-12-28T06:00:00.000Z] [INFO] [video] Starting playback: /path/to/video.mp4
[2025-12-28T06:00:01.000Z] [DEBUG] [video] Codec info: { video: 'h264', audio: 'aac' }
[2025-12-28T06:00:02.000Z] [ERROR] [video] Playback failed: Error: File not found
```

**포맷 설명:**
- `[Timestamp]` - ISO 8601 형식
- `[Level]` - 로그 레벨 (DEBUG, INFO, WARN, ERROR)
- `[Category]` - 로그 카테고리
- `Message` - 실제 로그 메시지

### Console 로그 포맷

```
[video] Starting playback: /path/to/video.mp4
[video] Codec info: { video: 'h264', audio: 'aac' }
[video] Playback failed: Error: File not found
```

## 로그 분석

### 특정 카테고리만 보기

```bash
# macOS/Linux
grep "\[video\]" ~/Library/Application\ Support/GhostPlayer/logs/main.log

# Windows (PowerShell)
Select-String -Pattern "\[video\]" $env:APPDATA\GhostPlayer\logs\main.log
```

### 에러만 보기

```bash
grep "\[ERROR\]" ~/Library/Application\ Support/GhostPlayer/logs/main.log
```

### 최근 로그 보기

```bash
tail -f ~/Library/Application\ Support/GhostPlayer/logs/main.log
```

### 특정 시간대 로그 필터링

```bash
grep "2025-12-28T06:" main.log
```

## 프로덕션 배포

### 로그 레벨 설정

프로덕션에서는 INFO 이상만 로깅:

```typescript
// main/logger.ts에서 자동 설정
minLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
```

### 로그 파일 크기 제한

기본값: 5MB per file, 5 files (총 25MB)

조정 방법:
```typescript
logger.configure({
  maxFileSize: 10 * 1024 * 1024,  // 10MB
  maxFiles: 3                      // 3 files (총 30MB)
})
```

### 사용자 프라이버시

⚠️ **중요:** 로그에 민감한 정보를 포함하지 마세요:
- 사용자 비밀번호
- API 키
- 개인 식별 정보
- 파일 전체 경로 (가능하면 파일명만)

**좋은 예:**
```typescript
logger.info('video', `Opening file: ${path.basename(filePath)}`)
```

**나쁜 예:**
```typescript
logger.info('video', `Full path: ${filePath}`)  // 사용자 경로 노출
```

## 성능 고려사항

### 로그 레벨 활용

```typescript
// ❌ 나쁜 예: 항상 문자열 생성
logger.debug('perf', `Heavy operation: ${JSON.stringify(largeObject)}`)

// ✅ 좋은 예: DEBUG 레벨이 활성화된 경우만 생성
if (logger.shouldLog(LogLevel.DEBUG)) {
  logger.debug('perf', 'Heavy operation:', largeObject)
}
```

### 과도한 로깅 피하기

```typescript
// ❌ 나쁜 예: 루프 내부에서 로깅
for (const item of items) {
  logger.debug('process', `Processing ${item}`)
}

// ✅ 좋은 예: 요약 정보만 로깅
logger.debug('process', `Processing ${items.length} items`)
```

## 문제 해결

### 로그가 파일에 기록되지 않음

**원인:** 파일 권한 또는 디스크 공간

**해결:**
```bash
# 로그 디렉토리 권한 확인
ls -la ~/Library/Application\ Support/GhostPlayer/logs/

# 디스크 공간 확인
df -h
```

### 로그 파일이 너무 큼

**해결:**
```typescript
// 설정 변경
logger.configure({
  maxFileSize: 2 * 1024 * 1024,  // 2MB
  maxFiles: 3                     // 3 files
})

// 또는 수동 정리
logger.cleanOldLogs()
```

### Console에 로그가 표시되지 않음

**원인:** 카테고리가 비활성화됨

**해결:** `src/utils/log-config.ts`에 카테고리 추가
```typescript
export const activeCategories = [
  // ... existing
  'my-category'
]
```

## 모범 사례

1. **적절한 로그 레벨 사용**
   - DEBUG: 개발 중 상세 정보
   - INFO: 정상 작동 흐름
   - WARN: 주의가 필요한 상황
   - ERROR: 실패나 예외

2. **의미 있는 카테고리**
   - 기능별로 카테고리 분리
   - 일관된 카테고리명 사용

3. **명확한 메시지**
   - 무엇이 일어났는지 명확히
   - 컨텍스트 정보 포함
   - 에러 객체 전달

4. **성능 고려**
   - 과도한 로깅 피하기
   - 민감한 정보 제외

---

**작성일:** 2025-12-28  
**Phase:** 2-3 (Structured Logging)
