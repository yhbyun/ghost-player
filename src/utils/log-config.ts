// src/utils/log-config.ts

/**
 * An array of active log categories.
 * Only logs belonging to these categories will be displayed.
 */
export const activeCategories: string[] = [
  'dragging',
  'webview',
  'mouse-event',
  'video',
  'captioning',
  'LocalTranscriber',
  'adblocker',
  'error-handler'
  // 'ffmpeg',
  // 'lifecycle'
  // Add other categories here to enable them, e.g., 'api'
]
