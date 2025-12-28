# React Error Boundary - Testing Guide

## 개요

React Error Boundary가 정상적으로 작동하는지 테스트하는 방법입니다.

## 테스트 준비

1. 앱 실행:
```bash
npm run dev
```

2. Chrome DevTools 열기 (Renderer Process)

## 테스트 시나리오

### 1. 컴포넌트 렌더링 에러 테스트

**방법 1: DevTools Console에서 직접 에러 발생**

```javascript
// Renderer Process Console에서 실행
throw new Error('Test React error')
```

**예상 결과:**
- ❌ 이 방법은 Error Boundary가 캐치하지 못함
- 이유: Console에서 발생한 에러는 React 생명주기 밖

**방법 2: 테스트 컴포넌트 추가 (권장)**

`src/renderer/src/components/ErrorTester.tsx` 생성:

```tsx
import { useState } from 'react'

export function ErrorTester() {
  const [shouldThrow, setShouldThrow] = useState(false)

  if (shouldThrow) {
    throw new Error('Test error from ErrorTester component')
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setShouldThrow(true)}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Trigger Error
      </button>
    </div>
  )
}
```

`App.tsx`에 추가:

```tsx
import { ErrorTester } from './components/ErrorTester'

function App() {
  return (
    <>
      {process.env.NODE_ENV === 'development' && <ErrorTester />}
      {/* ... existing code ... */}
    </>
  )
}
```

**실행:**
1. 앱 화면 오른쪽 상단에 "Trigger Error" 버튼 표시됨
2. 버튼 클릭
3. Error Boundary fallback UI 표시됨

**예상 결과:**
- ✅ 전체 UI가 크래시되지 않음
- ✅ Error Boundary fallback UI 표시
- ✅ "Try Again" 버튼으로 복구 가능
- ✅ "Reload App" 버튼으로 앱 재시작 가능
- ✅ 개발 모드에서 에러 상세 정보 표시
- ✅ 로그에 에러 기록됨

### 2. 비동기 에러 테스트

**테스트 컴포넌트:**

```tsx
import { useEffect, useState } from 'react'

export function AsyncErrorTester() {
  const [shouldThrow, setShouldThrow] = useState(false)

  useEffect(() => {
    if (shouldThrow) {
      // Async error in useEffect
      setTimeout(() => {
        throw new Error('Async error from useEffect')
      }, 100)
    }
  }, [shouldThrow])

  return (
    <button onClick={() => setShouldThrow(true)}>
      Trigger Async Error
    </button>
  )
}
```

**예상 결과:**
- ⚠️ useEffect 내부의 비동기 에러는 Error Boundary가 캐치하지 못함
- ✅ 대신 Main Process의 Global Error Handler가 캐치

**해결 방법:**
비동기 에러는 try-catch로 처리:

```tsx
useEffect(() => {
  const fetchData = async () => {
    try {
      // async operation
    } catch (error) {
      setError(error)  // State로 관리
    }
  }
  fetchData()
}, [])
```

### 3. Event Handler 에러 테스트

**테스트 컴포넌트:**

```tsx
export function EventErrorTester() {
  const handleClick = () => {
    throw new Error('Error from event handler')
  }

  return (
    <button onClick={handleClick}>
      Trigger Event Error
    </button>
  )
}
```

**예상 결과:**
- ✅ Error Boundary가 에러 캐치
- ✅ Fallback UI 표시

### 4. 중첩된 Error Boundary 테스트

특정 컴포넌트만 에러 처리:

```tsx
// App.tsx
<div>
  <Header />
  
  <ErrorBoundary fallback={<VideoPlayerError />}>
    <VideoPlayer />
  </ErrorBoundary>
  
  <Footer />
</div>
```

**효과:**
- VideoPlayer에서 에러 발생 시 해당 영역만 fallback UI
- Header, Footer는 정상 작동

## Error Boundary 작동 범위

### ✅ 캐치 가능한 에러

1. **렌더링 중 에러**
```tsx
function Component() {
  throw new Error('Render error')  // ✅ 캐치됨
  return <div>...</div>
}
```

2. **생명주기 메서드 에러**
```tsx
componentDidMount() {
  throw new Error('Lifecycle error')  // ✅ 캐치됨
}
```

3. **자식 컴포넌트 트리의 에러**
```tsx
<ErrorBoundary>
  <Child>
    <GrandChild />  {/* 여기서 에러 발생 → ✅ 캐치됨 */}
  </Child>
</ErrorBoundary>
```

### ❌ 캐치 불가능한 에러

1. **Event Handler 내부**
```tsx
<button onClick={() => {
  throw new Error('Event error')  // ❌ 캐치 안됨
}}>
```
→ 해결: try-catch 사용

2. **비동기 코드**
```tsx
useEffect(() => {
  setTimeout(() => {
    throw new Error('Async error')  // ❌ 캐치 안됨
  }, 1000)
}, [])
```
→ 해결: try-catch 또는 Promise.catch()

3. **SSR (Server-side rendering)**
- Electron은 CSR이므로 해당 없음

4. **Error Boundary 자체의 에러**
```tsx
class ErrorBoundary extends Component {
  render() {
    throw new Error('Self error')  // ❌ 자기 자신은 캐치 못함
  }
}
```

## 개발 vs 프로덕션 차이

### 개발 모드 (npm run dev)
- ✅ 상세한 에러 스택 표시
- ✅ 컴포넌트 스택 표시
- ✅ "Show error details" 섹션 표시
- ✅ Console에도 에러 출력

### 프로덕션 모드 (npm run build)
- ✅ 사용자 친화적 메시지만 표시
- ❌ 에러 상세 정보 숨김
- ✅ 로그 파일에는 기록

## 테스트 체크리스트

- [ ] 컴포넌트 렌더링 에러 캐치 확인
- [ ] Fallback UI가 올바르게 표시됨
- [ ] "Try Again" 버튼으로 복구 가능
- [ ] "Reload App" 버튼으로 앱 재시작
- [ ] 개발 모드에서 에러 상세 정보 표시
- [ ] 프로덕션 모드에서 간단한 메시지만 표시
- [ ] 로그 파일에 에러 기록됨
- [ ] 중첩된 Error Boundary 정상 작동
- [ ] 나머지 UI는 정상 작동

## 로그 확인

렌더러 프로세스 에러는 다음 위치에 기록:

```javascript
logger.error('react', 'React Error Boundary caught an error:', error)
```

DevTools Console에서도 확인 가능.

## 커스텀 Fallback UI

특정 컴포넌트에 커스텀 fallback 제공:

```tsx
<ErrorBoundary 
  fallback={
    <div className="p-4 bg-red-100 text-red-800">
      <h2>Video Player Error</h2>
      <p>Failed to load video player</p>
      <button onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  }
>
  <VideoPlayer />
</ErrorBoundary>
```

## 에러 보고 통합 (선택 사항)

외부 서비스로 에러 전송:

```tsx
componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
  logger.error('react', 'Error:', error, errorInfo)
  
  // Send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    sendToSentry(error, errorInfo)
  }
}
```

## 문제 해결

### Fallback UI가 표시되지 않음

**원인:** 에러가 Error Boundary 범위 밖에서 발생

**확인:**
1. 에러가 Event Handler나 비동기 코드에서 발생하는지 확인
2. Error Boundary가 올바른 위치에 있는지 확인

### "Try Again" 버튼이 작동하지 않음

**원인:** State 초기화만으로 문제 해결 안됨

**해결:**
- 에러 원인을 근본적으로 해결
- 또는 "Reload App" 버튼 사용

### 에러 로그가 기록되지 않음

**원인:** 로그 카테고리 필터

**확인:** `src/utils/log-config.ts`에 'react' 카테고리 추가

```typescript
export const activeCategories = [
  // ... existing
  'react'
]
```

## Best Practices

1. **최상위에 하나, 중요 컴포넌트에 추가**
```tsx
<ErrorBoundary>              {/* 전체 앱 */}
  <App>
    <ErrorBoundary>          {/* 중요 영역만 */}
      <CriticalFeature />
    </ErrorBoundary>
  </App>
</ErrorBoundary>
```

2. **Event Handler는 try-catch**
```tsx
const handleClick = async () => {
  try {
    await dangerousOperation()
  } catch (error) {
    setError(error)
  }
}
```

3. **비동기 작업은 명시적 에러 처리**
```tsx
useEffect(() => {
  fetchData().catch(error => {
    logger.error('data', 'Failed to fetch:', error)
    setError(error)
  })
}, [])
```

## Next Steps

Phase 2-3: Structured Logging 개선으로 이동

---

**작성일:** 2025-12-28  
**Phase:** 2-2 (React Error Boundary)
