<template>
  <el-container class="main-layout">
    <el-aside width="256px" class="sidebar">
      <div class="brand-card">
        <div class="brand-mark">青</div>
        <div>
          <div class="brand-title">青春福袋后台</div>
          <div class="brand-subtitle">围绕九选一红包墙与抽奖链路统一运营</div>
        </div>
      </div>

      <el-menu :default-active="activeMenu" router class="menu-panel">
        <el-menu-item
          v-for="routeItem in menuRoutes"
          :key="routeItem.path"
          :index="'/' + routeItem.path"
        >
          <el-icon><component :is="routeItem.meta?.icon" /></el-icon>
          <span>{{ routeItem.meta?.title }}</span>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-note">
        <div class="sidebar-note-title">当前重点</div>
        <div class="sidebar-note-copy">
          首页入口、九选一红包、海报结果页、抽奖奖池和红包发放状态，都在这里统一查看。
        </div>
      </div>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div>
          <div class="header-title">{{ currentRoute?.meta?.title || '后台首页' }}</div>
          <div class="header-subtitle">配置活动节奏，核对用户领取结果，跟踪红包与抽奖转化。</div>
        </div>

        <div class="header-actions">
          <div class="user-chip">
            <el-avatar :size="34">{{ userInitial }}</el-avatar>
            <div>
              <div class="user-name">{{ userStore.userInfo?.name || userStore.userInfo?.username || '管理员' }}</div>
              <div class="user-role">{{ userStore.userInfo?.role || 'admin' }}</div>
            </div>
          </div>

          <el-dropdown @command="handleCommand">
            <span class="dropdown-trigger">
              更多
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="settings">系统设置</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const activeMenu = computed(() => route.path)
const currentRoute = computed(() => route)
const menuRoutes = computed(() => {
  const rootRoute = router.options.routes.find((item) => item.path === '/')
  return rootRoute?.children || []
})
const userInitial = computed(() => {
  const name = userStore.userInfo?.name || userStore.userInfo?.username || '管理'
  return String(name).slice(0, 1)
})

onMounted(() => {
  if (!userStore.userInfo && userStore.token) {
    userStore.getUserInfo().catch(() => {})
  }
})

function handleCommand(command) {
  if (command === 'settings') {
    router.push('/settings')
    return
  }

  if (command === 'logout') {
    userStore.logout()
    router.push('/login')
  }
}
</script>

<style lang="scss" scoped>
.main-layout {
  min-height: 100vh;
}

.sidebar {
  padding: 18px 16px;
  background:
    radial-gradient(circle at top, rgba(247, 199, 109, 0.18), transparent 28%),
    linear-gradient(180deg, #261813 0%, #1f1511 100%);
  color: #fff5ed;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.brand-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-mark {
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background: linear-gradient(145deg, #d84b20 0%, #f6a332 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 800;
}

.brand-title {
  font-size: 20px;
  font-weight: 700;
}

.brand-subtitle {
  margin-top: 6px;
  color: rgba(255, 245, 237, 0.72);
  font-size: 12px;
  line-height: 1.6;
}

.menu-panel {
  border: none;
  background: transparent;
  --el-menu-bg-color: transparent;
  --el-menu-text-color: rgba(255, 245, 237, 0.74);
  --el-menu-active-color: #fff;
}

.menu-panel :deep(.el-menu-item) {
  margin-bottom: 6px;
  border-radius: 16px;
}

.menu-panel :deep(.el-menu-item.is-active) {
  background: linear-gradient(145deg, rgba(216, 75, 32, 0.88), rgba(246, 163, 50, 0.82));
}

.sidebar-note {
  margin-top: auto;
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.06);
}

.sidebar-note-title {
  font-size: 13px;
  font-weight: 700;
}

.sidebar-note-copy {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(255, 245, 237, 0.72);
}

.header {
  height: auto;
  min-height: 92px;
  padding: 22px 28px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-title {
  font-size: 24px;
  font-weight: 700;
}

.header-subtitle {
  margin-top: 6px;
  color: var(--text-subtle);
  font-size: 13px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--line);
}

.user-name {
  font-size: 13px;
  font-weight: 700;
}

.user-role {
  margin-top: 4px;
  color: var(--text-subtle);
  font-size: 12px;
}

.dropdown-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 11px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--line);
  cursor: pointer;
}

.main-content {
  padding: 20px 28px 28px;
}
</style>
