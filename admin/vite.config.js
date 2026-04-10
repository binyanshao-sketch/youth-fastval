import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/admin/',
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: false
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: false
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-core': ['vue', 'vue-router', 'pinia'],
          'vendor-utils': ['axios', 'dayjs']
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
}))
