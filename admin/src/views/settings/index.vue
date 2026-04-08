<template>
  <div class="page-stack">
    <div>
      <h1 class="page-title">系统设置</h1>
      <p class="page-subtitle">维护活动参数与通用配置。</p>
    </div>
    <div class="page-card" style="padding:16px;">
      <el-form :model="form" label-width="140px">
        <el-form-item label="活动开始"><el-input v-model="form.activity_start_time" /></el-form-item>
        <el-form-item label="活动结束"><el-input v-model="form.activity_end_time" /></el-form-item>
        <el-form-item label="政策链接"><el-input v-model="form.policy_url" /></el-form-item>
        <el-form-item label="每日上限"><el-input v-model="form.daily_limit" /></el-form-item>
        <el-form-item label="活动开关"><el-switch v-model="isActive" /></el-form-item>
        <el-form-item><el-button type="primary" @click="save">保存设置</el-button></el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const form = reactive({ activity_start_time: '', activity_end_time: '', policy_url: '', daily_limit: '', is_active: 'false' })

const isActive = computed({
  get: () => form.is_active === 'true',
  set: (value) => { form.is_active = String(value) }
})

async function loadData() {
  const res = await api.getSettings()
  if (res.success) Object.assign(form, res.data)
}

async function save() {
  const res = await api.updateSettings(form)
  if (res.success) ElMessage.success('保存成功')
}

onMounted(loadData)
</script>
