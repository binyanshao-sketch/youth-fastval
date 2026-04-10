<template>
  <div class="login-page">
    <div class="login-hero">
      <div class="login-copy">
        <span class="login-badge">青春福袋活动后台</span>
        <h1>统一管理红包领取、祝福海报和抽奖承接。</h1>
        <p>面向运营同学提供活动配置、用户记录、商家核销和资金统计的一体化看板。</p>
      </div>

      <div class="login-panel">
        <div class="login-panel-header">
          <h2>管理员登录</h2>
          <p>使用后台账号进入活动配置中心。</p>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="handleLogin">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" placeholder="请输入管理员账号" />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" />
          </el-form-item>
          <el-button type="primary" class="login-button" :loading="submitting" @click="handleLogin">
            进入后台
          </el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref(null)
const submitting = ref(false)

const form = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const res = await userStore.login(form.username, form.password)
    if (res.success) {
      ElMessage.success('登录成功')
      router.push('/dashboard')
    }
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (userStore.token) {
    router.replace('/dashboard')
  }
})
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  padding: 32px;
  background:
    radial-gradient(circle at top left, rgba(243, 183, 89, 0.26), transparent 26%),
    radial-gradient(circle at bottom right, rgba(208, 78, 37, 0.22), transparent 24%),
    linear-gradient(135deg, #fffaf2 0%, #f7ecdf 44%, #f1dfd0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-hero {
  width: min(1120px, 100%);
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 24px;
  align-items: stretch;
}

.login-copy,
.login-panel {
  border-radius: 32px;
  box-shadow: var(--shadow-panel);
}

.login-copy {
  padding: 48px;
  color: #fff7ef;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.18), transparent 26%),
    linear-gradient(145deg, #cb451e 0%, #e27c2a 48%, #f1b553 100%);
}

.login-badge {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 12px;
  font-weight: 700;
}

.login-copy h1 {
  margin: 22px 0 0;
  font-size: 42px;
  line-height: 1.12;
}

.login-copy p {
  margin: 18px 0 0;
  max-width: 520px;
  font-size: 15px;
  line-height: 1.9;
  color: rgba(255, 247, 239, 0.88);
}

.login-panel {
  padding: 32px;
  background: rgba(255, 252, 248, 0.92);
  border: 1px solid rgba(137, 102, 79, 0.12);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.login-panel-header h2 {
  margin: 0;
  font-size: 28px;
}

.login-panel-header p {
  margin: 8px 0 24px;
  color: var(--text-subtle);
  line-height: 1.7;
}

.login-button {
  width: 100%;
  margin-top: 12px;
  height: 46px;
  font-size: 15px;
  font-weight: 700;
}

@media (max-width: 960px) {
  .login-hero {
    grid-template-columns: 1fr;
  }

  .login-copy h1 {
    font-size: 32px;
  }
}
</style>
