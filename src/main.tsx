import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App'
import { applyTheme, cachedTheme } from './utils/themes'

// Applied before the first render so the saved palette paints immediately.
applyTheme(cachedTheme())

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
