import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // 상대 경로로 빌드해서 어떤 주소(예: github.io/저장소명/)에 올려도 동작하게 한다.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon-32.png'],
      manifest: {
        name: '자산 가계부',
        short_name: '가계부',
        description: '수입·지출을 기록하고 월별·연도별로 돌아보는 가계부',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f4ec',
        theme_color: '#f4f4ec',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        // 한글 폰트 조각(woff2)은 90여 개라 미리 받지 않고, 처음 쓸 때 받아서 보관한다.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 120 } },
          },
        ],
      },
    }),
  ],
})
