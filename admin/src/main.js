import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  ArrowDown,
  DataLine,
  Lock,
  Present,
  Setting,
  Shop,
  Ticket,
  TrendCharts,
  User,
  Wallet
} from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import './styles/index.scss'

const app = createApp(App)

const requiredIcons = {
  ArrowDown,
  DataLine,
  Lock,
  Present,
  Setting,
  Shop,
  Ticket,
  TrendCharts,
  User,
  Wallet
}

for (const [key, component] of Object.entries(requiredIcons)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)

app.mount('#app')
