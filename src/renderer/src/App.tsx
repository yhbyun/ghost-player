import { useState } from 'react'

function App(): React.JSX.Element {
  const [url, setUrl] = useState('https://youtube.com')

  return (
    <div className="h-screen">
      <webview src={url} className="w-full h-full" allowpopups="true" />
    </div>
  )
}

export default App
