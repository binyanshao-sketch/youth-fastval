import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/index.vue'),
    meta: {
      title: '登录',
      public: true
    }
  },
  {
    path: '/',
    component: MainLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '数据总览', icon: 'DataLine' }
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/users/index.vue'),
        meta: { title: '用户管理', icon: 'User' }
      },
      {
        path: 'lucky-bag',
        name: 'lucky-bag',
        component: () => import('@/views/lucky-bag/index.vue'),
        meta: { title: '福袋管理', icon: 'Present' }
      },
      {
        path: 'coupons',
        name: 'coupons',
        component: () => import('@/views/coupons/index.vue'),
        meta: { title: '消费券管理', icon: 'Ticket' }
      },
      {
        path: 'merchants',
        name: 'merchants',
        component: () => import('@/views/merchants/index.vue'),
        meta: { title: '商家管理', icon: 'Shop' }
      },
      {
        path: 'finance',
        name: 'finance',
        component: () => import('@/views/finance/index.vue'),
        meta: { title: '财务管理', icon: 'Wallet' }
      },
      {
        path: 'statistics',
        name: 'statistics',
        component: () => import('@/views/statistics/index.vue'),
        meta: { title: '统计报表', icon: 'TrendCharts' }
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/settings/index.vue'),
        meta: { title: '系统设置', icon: 'Setting' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  const isPublicRoute = Boolean(to.meta?.public)

  if (isPublicRoute) {
    if (to.path === '/login' && userStore.token) {
      try {
        await userStore.getUserInfo()
        next('/dashboard')
        return
      } catch (error) {
        userStore.logout()
      }
    }
    next()
    return
  }

  if (!userStore.token) {
    next('/login')
    return
  }

  if (!userStore.userInfo) {
    try {
      await userStore.getUserInfo()
    } catch (error) {
      userStore.logout()
      next('/login')
      return
    }
  }

  next()
})

export default router
