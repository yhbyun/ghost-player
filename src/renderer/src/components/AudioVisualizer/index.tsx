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

    analyserNode.fftSize = 256

    // 부드러운 애니메이션을 위한 smoothing 설정
    // 0 = 즉각 반응, 1 = 매우 부드럽게 (기본값: 0.8)
    analyserNode.smoothingTimeConstant = 0.8

    const bufferLength = analyserNode.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const drawVisualizer = (): void => {
      animationFrameIdRef.current = requestAnimationFrame(drawVisualizer)

      // 주파수 데이터 가져오기
      analyserNode.getByteFrequencyData(dataArray)

      // 배경 지우기
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height)

      // 막대 그래프 설정
      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i]

        // 색상: 높이에 따라 변화
        const r = barHeight + 100
        const g = 50
        const b = 50

        canvasCtx.fillStyle = `rgb(${r}, ${g}, ${b})`

        // 막대 그리기 (아래에서 위로)
        canvasCtx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2)

        x += barWidth + 1
      }
    }

    // 애니메이션 시작
    drawVisualizer()

    // Cleanup 함수
    return () => {
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
