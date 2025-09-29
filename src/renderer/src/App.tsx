import { useState } from 'react'

function App(): React.JSX.Element {
  const [url, setUrl] = useState('https://youtube.com')

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* 주소 표시줄 */}
      <div className="hidden flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="Enter URL..."
        />
        <button
          onClick={() => {
            const webview = document.querySelector('webview') as any
            if (webview) webview.src = url
          }}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
        >
          Go
        </button>
      </div>

      {/* YouTube 뷰어 */}
      <webview src={url} className="flex-1 w-full" allowpopups="true" />
    </div>
  )
}

export default App
