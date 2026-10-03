import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const password = env.VITE_OPENCODE_SERVER_PASSWORD || ''
  const username = env.VITE_OPENCODE_SERVER_USERNAME || 'opencode'
  
  let authHeader = ''
  if (password) {
    authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
  }
  
  const proxyConfig: Record<string, any> = {}
  const apiPaths = ['session', 'event', 'config', 'form', 'project', 'location', 'agent', 'provider']
  
  for (const path of apiPaths) {
    const config: any = {
      target: 'http://127.0.0.1:4096',
      changeOrigin: true,
      secure: false,
    }
    if (authHeader) {
      config.headers = {
        Authorization: authHeader,
      }
    }
    proxyConfig[`/api/${path}`] = config
  }
  
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5174,
      proxy: proxyConfig,
    },
  }
})
