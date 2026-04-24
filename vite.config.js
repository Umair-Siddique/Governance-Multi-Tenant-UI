import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  // AUTH_BASE_URL can be set to your backend origin (e.g. http://localhost:5001 or https://api.example.com)
  // The proxy below uses it as the target for /api requests during local development to avoid CORS.
  const apiTarget = env.VITE_AUTH_BASE_URL || env.AUTH_BASE_URL || 'https://governance-multi-tenant-rag.onrender.com'

  return defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          // Always request identity encoding so SSE isn't buffered by proxy decompression.
          headers: {
            'Accept-Encoding': 'identity',
          },
          // Prevent proxy buffering so SSE / streaming responses reach the
          // browser progressively instead of all at once when the stream ends.
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Tell the backend not to compress the response – compression
              // forces http-proxy to buffer chunks before forwarding.
              proxyReq.setHeader('Accept-Encoding', 'identity');
            });
            proxy.on('proxyRes', (proxyRes) => {
              if ((proxyRes.headers['content-type'] || '').includes('text/event-stream')) {
                proxyRes.headers['cache-control'] = 'no-cache, no-store';
                proxyRes.headers['x-accel-buffering'] = 'no';
              }
            });
          },
        },
        '/auth': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  })
}
