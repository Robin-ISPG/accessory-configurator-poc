import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    // Avoid browser CORS when calling Gemini from localhost; production builds use full Google origin.
    proxy: {
      '/google-gemini-api': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/google-gemini-api/, ''),
      },
    },
  },
})
