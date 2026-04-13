import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig(({ command }) => {
  // VITE_CDN_URL 可设为七牛存储桶所绑定的 CDN 域名，如 https://cdn.yourdomain.com/admin/
  // 未设置时开发模式用 /，生产模式用 /admin/
  const cdnUrl = process.env.VITE_CDN_URL
  const base = cdnUrl || (command === 'serve' ? '/' : '/admin/')

  return {
    base,
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
      sourcemap: false,
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
  }
})
