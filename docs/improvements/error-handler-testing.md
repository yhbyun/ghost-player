# Global Error Handler - Testing Guide

## 개요

Global Error Handler가 정상적으로 작동하는지 테스트하는 방법입니다.

## 테스트 준비

1. 앱 실행:
```bash
npm run dev
```

2. 로그 디렉토리 확인:
- macOS/Linux: `~/Library/Application Support/GhostPlayer/crashes/`
- Windows: `%APPDATA%/GhostPlayer/crashes/`

## 테스트 시나리오

### 1. Uncaught Exception 테스트

**방법:** Chrome DevTools의 Console에서 실행

```javascript
// Main process에서 에러 발생시키기
// Electron DevTools (Main Process Console)에서 실행
throw new Error('Test uncaught exception')
```

**예상 결과:**
- ✅ 앱이 크래시되지 않음
- ✅ 에러 다이얼로그 표시
- ✅ Crash report 파일 생성 (`crashes/crash-*.json`)
- ✅ 로그 파일에 에러 기록

### 2. Unhandled Promise Rejection 테스트

```javascript
// Promise rejection 테스트
Promise.reject(new Error('Test unhandled rejection'))
```

**예상 결과:**
- ✅ 앱이 크래시되지 않음
- ✅ 로그에 에러 기록
- ⚠️ Critical error가 아니면 다이얼로그 표시 안 됨

### 3. Critical Error 테스트

```javascript
// Critical error 패턴 테스트
Promise.reject(new Error('ENOSPC: no space left on device'))
```

**예상 결과:**
- ✅ Critical error로 인식
- ✅ 에러 다이얼로그 표시
- ✅ Crash report 생성

### 4. File System Error 테스트

**테스트 코드 (`src/main/index.ts`에 임시 추가):**

```typescript
// 개발 모드에서만 활성화
if (is.dev) {
  ipcMain.handle('test-error', async (_, type: string) => {
    switch (type) {
      case 'uncaught':
        throw new Error('Test uncaught exception from IPC')
      
      case 'rejection':
        return Promise.reject(new Error('Test promise rejection'))
      
      case 'critical':
        throw new Error('ENOMEM: Cannot allocate memory')
      
      default:
        throw new Error('Unknown test type')
    }
  })
}
```

**Renderer에서 호출:**

```typescript
// DevTools Console (Renderer Process)
window.api.testError('uncaught')
window.api.testError('rejection')
window.api.testError('critical')
```

## Crash Report 형식

생성되는 crash report 예시:

```json
{
  "timestamp": "2025-12-28T03:00:00.000Z",
  "error": {
    "name": "Error",
    "message": "Test uncaught exception",
    "stack": "Error: Test uncaught exception\n    at ..."
  },
  "platform": "darwin",
  "appVersion": "1.0.0",
  "nodeVersion": "18.17.0",
  "electronVersion": "39.0.0"
}
```

## 로그 확인

### Main Process 로그

`~/Library/Application Support/GhostPlayer/logs/main.log`

```
[2025-12-28T03:00:00.000Z] [ERROR] [error-handler] Uncaught Exception: Error: Test uncaught exception
[2025-12-28T03:00:00.000Z] [INFO] [error-handler] Crash report saved: .../crash-2025-12-28T03-00-00.json
```

## 정상 동작 확인 체크리스트

- [ ] 앱이 uncaught exception으로 크래시되지 않음
- [ ] 에러 다이얼로그가 사용자에게 표시됨
- [ ] Crash report가 파일로 저장됨
- [ ] 에러가 로그 파일에 기록됨
- [ ] 오래된 crash report가 자동 정리됨 (10개 이상 시)
- [ ] 개발 모드에서 stack trace가 보임
- [ ] 프로덕션 모드에서 간단한 메시지만 보임

## 문제 해결

### Crash report가 생성되지 않음

**원인:** 디렉토리 권한 문제

**해결:**
```bash
# macOS/Linux
mkdir -p ~/Library/Application\ Support/GhostPlayer/crashes
chmod 755 ~/Library/Application\ Support/GhostPlayer/crashes
```

### 에러 다이얼로그가 표시되지 않음

**원인:** 개발 모드에서는 uncaught exception만 다이얼로그 표시

**확인:** `src/main/error-handler.ts`의 `showCrashDialog()` 로직 확인

### 에러가 로그에 기록되지 않음

**원인:** 로그 카테고리 필터링

**확인:** `src/utils/log-config.ts`에 'error-handler' 카테고리 추가

```typescript
export const activeCategories = [
  // ... existing categories
  'error-handler'
]
```

## 개발 팁

### Error Handler 비활성화 (테스트용)

```typescript
// src/main/index.ts
if (is.dev && process.env.DISABLE_ERROR_HANDLER) {
  // Skip error handler initialization
} else {
  errorHandler.initialize()
}
```

실행:
```bash
DISABLE_ERROR_HANDLER=1 npm run dev
```

### 커스텀 에러 다이얼로그

기본 `dialog.showErrorBox()` 대신 커스텀 BrowserWindow 사용:

```typescript
// error-handler.ts에서 수정
private showCrashDialog(error: Error, title: string): void {
  // 커스텀 에러 윈도우 생성
  const errorWindow = new BrowserWindow({
    width: 500,
    height: 300,
    // ...
  })
  
  errorWindow.loadFile('error.html')
}
```

## Next Steps

Phase 2-2: React Error Boundary 구현으로 이동

---

**작성일:** 2025-12-28  
**Phase:** 2-1 (Global Error Handler)
