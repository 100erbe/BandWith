import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  // Production builds drop console.log/info/debug (they printed push tokens,
  // notification payloads and user ids: audit PR-116). warn/error stay.
  esbuild: mode === 'production' ? { pure: ['console.log', 'console.info', 'console.debug'] } : undefined,
  build: {
    rollupOptions: {
      // Second page: /unsubscribe.html (product news emails, migration 065).
      input: {
        main: path.resolve(__dirname, 'index.html'),
        unsubscribe: path.resolve(__dirname, 'unsubscribe.html'),
        // Third page: /deputy.html (deputy reply link, migration 084).
        deputy: path.resolve(__dirname, 'deputy.html'),
      },
    },
  },
  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      // Route all Lucide icon imports to BandWith's unified custom icon system
      'lucide-react': path.resolve(__dirname, './src/app/components/icons'),
    },
  },
}))
