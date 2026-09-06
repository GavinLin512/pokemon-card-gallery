import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [svelte()],
  build: {
    // three.js 的 WebGLRenderer 本體約 500KB（gzip 126KB），已獨立 chunk 且延後載入
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three']
        }
      }
    }
  }
})
