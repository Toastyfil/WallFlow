/// <reference types="vite/client" />

import type { WallFlowApi } from './types/ipc'

declare global {
  interface Window {
    wallflow: WallFlowApi
  }
}

export {}
