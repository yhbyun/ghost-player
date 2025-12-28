import React, { Component, ReactNode } from 'react'
import { logger } from '../logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child component tree and displays
 * a fallback UI instead of crashing the entire app.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error to our logging service
    logger.error('react', 'React Error Boundary caught an error:', error, errorInfo)

    // Update state with error details
    this.setState({
      error,
      errorInfo
    })

    // You could also send error to external service here
    // Example: sendErrorToService(error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI provided by parent
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="flex items-center justify-center h-screen bg-gray-900 text-white p-8">
          <div className="max-w-2xl w-full">
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
              {/* Error Icon */}
              <div className="flex items-center gap-3 mb-4">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <h1 className="text-2xl font-bold">Something went wrong</h1>
              </div>

              {/* Error Message */}
              <div className="mb-6">
                <p className="text-gray-300 mb-2">
                  The application encountered an error and couldn&apos;t continue.
                </p>
                {this.state.error && (
                  <div className="mt-4 bg-black/30 rounded p-3">
                    <p className="text-sm font-mono text-red-400">{this.state.error.toString()}</p>
                  </div>
                )}
              </div>

              {/* Error Details (Development only) */}
              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mb-6">
                  <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-300 mb-2">
                    Show error details
                  </summary>
                  <div className="bg-black/50 rounded p-3 overflow-auto max-h-64">
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                      {this.state.error?.stack}
                      {'\n\n'}
                      Component Stack:
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                </details>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={this.handleReset}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={this.handleReload}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
                >
                  Reload App
                </button>
              </div>

              {/* Help Text */}
              <div className="mt-6 pt-6 border-t border-gray-700">
                <p className="text-sm text-gray-400">
                  If this problem persists, try restarting the application or check the logs for
                  more information.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
