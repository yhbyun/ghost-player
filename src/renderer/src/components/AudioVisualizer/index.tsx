import React, { useEffect, useRef } from 'react'
import './style.scss'

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null
  isVisualizerEnabled: boolean
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyserNode, isVisualizerEnabled }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!analyserNode || !canvasRef.current || !isVisualizerEnabled) {
      // 정리: 이전 애니메이션 프레임 취소
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current)
        animationFrameIdRef.current = null
      }
      return
    }

    const canvas = canvasRef.current
    const canvasCtx = canvas.getContext('2d')

    if (!canvasCtx) {
      return
    }

    // Canvas 내부 실제 해상도 설정 함수
    const updateCanvasSize = (): void => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }

    updateCanvasSize()

    // ResizeObserver를 사용하여 크기 변경 감지 (창 크조 조절 등 대응)
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize()
    })
    resizeObserver.observe(canvas)

    // FFT 및 Smoothing 설정 로직 최적화
    // 2048 FFTSize는 주파수 해상도를 높여주며,
    // smoothingTimeConstant를 0.8로 조정하여 오디오 출력 지연(Latency)과의 시각적 간극을 메웁니다.
    analyserNode.fftSize = 2048
    analyserNode.smoothingTimeConstant = 0.8

    const bufferLength = analyserNode.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const sampleRate = analyserNode.context.sampleRate

    // 에너지 균형 가중치 (Refined Energy Curve)
    const getWeight = (freq: number): number => {
      // 저역대(Bass): 충분한 해상도가 확보되었으므로 가중치를 1.5배로 안정화
      if (freq < 150) return 1.5
      // 중저역(Low-Mid)
      if (freq < 500) return 1.25
      // 중간 대역(Mids): 귀가 예민한 구간, 포화 방지를 위해 0.7배로 하향
      if (freq < 3000) return 0.7
      // 고음 대역(Treble)
      if (freq < 8000) return 1.4
      // 초고역(Air)
      return 1.8
    }

    const drawVisualizer = (): void => {
      animationFrameIdRef.current = requestAnimationFrame(drawVisualizer)
      analyserNode.getByteFrequencyData(dataArray)

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height)

      const visualBars = 48
      const barWidth = canvas.width / visualBars

      // 음악적 대역 (35Hz ~ 16,000Hz)
      const minFreq = 35
      const maxFreq = 16000

      for (let i = 0; i < visualBars; i++) {
        // 로그 스케일 기반 범위 계산
        const fLow = minFreq * Math.pow(maxFreq / minFreq, i / visualBars)
        const fHigh = minFreq * Math.pow(maxFreq / minFreq, (i + 1) / visualBars)

        // 주파수를 FFT 인덱스로 변환
        // 인덱스 0, 1, 2(약 0~60Hz)는 DC 성분 및 노이즈가 많으므로 인덱스 3부터 시작
        let startIndex = Math.floor((fLow * analyserNode.fftSize) / sampleRate)
        let endIndex = Math.floor((fHigh * analyserNode.fftSize) / sampleRate)

        // 저음역대 막대들이 뭉치지 않도록 강제로 고유 인덱스 범위를 확보
        startIndex = Math.max(3 + i / 4, startIndex)
        endIndex = Math.max(startIndex + 1, endIndex)

        const finalStartIndex = Math.floor(startIndex)
        const finalEndIndex = Math.min(bufferLength - 1, Math.ceil(endIndex))

        // 피크값(Max) 추출
        let maxVal = 0
        for (let j = finalStartIndex; j < finalEndIndex; j++) {
          if (dataArray[j] > maxVal) maxVal = dataArray[j]
        }

        // 가중치 적용 및 높이 계산
        const centerFreq = Math.sqrt(fLow * fHigh)
        const weight = getWeight(centerFreq)

        // 최종 높이: 0~1 사이로 정규화 후 가중치 적용, 80% 정도를 기준 높이로 사용
        let barHeight = (maxVal / 255) * canvas.height * weight * 0.85
        barHeight = Math.min(canvas.height, barHeight)

        // 색상: 세련된 HSL (파랑 -> 에메랄드 -> 보라)
        const hue = (i / visualBars) * 230 + 180
        canvasCtx.fillStyle = `hsla(${hue}, 85%, 65%, 0.85)`

        const finalHeight = Math.max(2, barHeight)
        // 막대 그리기: 약간의 간격을 두어 선명하게
        canvasCtx.fillRect(i * barWidth, canvas.height - finalHeight, barWidth - 1.5, finalHeight)
      }
    }

    // 애니메이션 시작
    drawVisualizer()

    // Cleanup 함수
    return () => {
      resizeObserver.disconnect()
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current)
        animationFrameIdRef.current = null
      }
    }
  }, [analyserNode, isVisualizerEnabled])

  if (!isVisualizerEnabled) {
    return null
  }

  return <canvas ref={canvasRef} className="audio-visualizer" />
}

export default AudioVisualizer
