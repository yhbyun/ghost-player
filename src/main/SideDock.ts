import { BrowserWindow, screen, Rectangle } from 'electron'

const ANIMATION_DURATION = 200 // ms
const FRAME_RATE = 60 // fps

export class SideDock {
  private mainWindow: BrowserWindow
  private isEnabled = false
  private isDocked = false
  private originalBounds: Rectangle | null = null
  private animationInterval: NodeJS.Timeout | null = null
  private visibleWidth: number
  private isAnimating = false

  constructor(mainWindow: BrowserWindow, visibleWidth: number) {
    this.mainWindow = mainWindow
    this.visibleWidth = visibleWidth
  }

  getIsEnabled(): boolean {
    return this.isEnabled
  }

  setVisibleWidth(width: number): void {
    this.visibleWidth = width
    if (this.isEnabled && this.isDocked) {
      const targetBounds = this.getDockedBounds()
      this.animateMove(targetBounds.x)
    }
  }

  enable(): void {
    if (this.isEnabled) return
    this.isEnabled = true
    this.originalBounds = this.mainWindow.getBounds()
    this.dock()
  }

  disable(): void {
    if (!this.isEnabled) return
    this.isEnabled = false
    if (this.isDocked && this.originalBounds) {
      this.isDocked = false
      this.animateMove(this.originalBounds.x)
    }
  }

  handleMouseEnter(): void {
    if (this.isEnabled && !this.isAnimating) {
      this.undock()
    }
  }

  handleMouseLeave(): void {
    if (this.isEnabled && !this.isAnimating) {
      this.dock()
    }
  }

  toggleDocking(): void {
    if (this.isDocked) {
      this.undock()
    } else {
      this.dock()
    }
  }

  private getDockedBounds(): Rectangle {
    const currentBounds = this.originalBounds || this.mainWindow.getBounds()
    const display = screen.getDisplayMatching(currentBounds)
    const workArea = display.workArea

    const isRightSide = currentBounds.x + currentBounds.width / 2 > workArea.x + workArea.width / 2

    const dockedX = isRightSide
      ? workArea.x + workArea.width - this.visibleWidth
      : workArea.x - currentBounds.width + this.visibleWidth

    return {
      ...currentBounds,
      x: dockedX
    }
  }

  private getUndockedBounds(): Rectangle {
    const currentBounds = this.originalBounds || this.mainWindow.getBounds()
    const display = screen.getDisplayMatching(currentBounds)
    const workArea = display.workArea

    const isRightSide = currentBounds.x + currentBounds.width / 2 > workArea.x + workArea.width / 2

    const undockedX = isRightSide ? workArea.x + workArea.width - currentBounds.width : workArea.x

    return {
      ...currentBounds,
      x: undockedX
    }
  }

  private dock(): void {
    if (this.isDocked) return
    this.isDocked = true
    if (!this.originalBounds) {
      this.originalBounds = this.mainWindow.getBounds()
    }
    const targetBounds = this.getDockedBounds()
    this.animateMove(targetBounds.x)
  }

  private undock(): void {
    if (!this.isDocked || !this.originalBounds) return
    this.isDocked = false
    const targetBounds = this.getUndockedBounds()
    this.animateMove(targetBounds.x)
  }

  private animateMove(targetX: number): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval)
    }
    this.isAnimating = true

    const startBounds = this.mainWindow.getBounds()
    const startX = startBounds.x
    const distance = targetX - startX
    const stepCount = ANIMATION_DURATION / (1000 / FRAME_RATE)
    let currentStep = 0

    this.animationInterval = setInterval(() => {
      currentStep++
      if (currentStep >= stepCount) {
        if (this.animationInterval) clearInterval(this.animationInterval)
        this.mainWindow.setBounds({ ...startBounds, x: targetX })
        this.isAnimating = false
        return
      }

      const easeOutQuart = 1 - Math.pow(1 - currentStep / stepCount, 4)
      const newX = startX + distance * easeOutQuart
      this.mainWindow.setBounds({ ...startBounds, x: Math.round(newX) })
    }, 1000 / FRAME_RATE)
  }
}
