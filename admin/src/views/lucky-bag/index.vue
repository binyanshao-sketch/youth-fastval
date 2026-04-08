<template>
  <div class="page-stack">
    <div>
      <h1 class="page-title">福袋管理</h1>
      <p class="page-subtitle">活动配置与领取记录。</p>
    </div>
    <div class="page-card" style="padding:16px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <el-input v-model="filters.phone" clearable placeholder="手机号" style="width:220px;" />
        <div style="display:flex;gap:12px;">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" @click="loadRecords(1)">查询</el-button>
        </div>
      </div>

      <el-form :model="config" label-width="120px">
        <el-form-item label="活动时间">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            style="width:100%;"
          />
        </el-form-item>
        <el-form-item label="政策链接"><el-input v-model="config.policyUrl" /></el-form-item>
        <el-form-item label="每日上限"><el-input v-model="config.dailyLimit" /></el-form-item>
        <el-form-item label="活动开启"><el-switch v-model="config.isActive" /></el-form-item>
        <el-form-item><el-button type="primary" @click="save">保存</el-button></el-form-item>
      </el-form>
    </div>
    <div class="page-card" style="padding:16px;">
      <el-table :data="records" v-loading="loading" border>
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="amount" label="红包" width="100" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column prop="receivedAt" label="领取时间" min-width="180" />
      </el-table>

      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <el-pagination
          background
          layout="total, prev, pager, next, sizes"
          :total="pagination.total"
          :current-page="pagination.page"
          :page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50]"
          @current-change="loadRecords"
          @size-change="changePageSize"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const records = ref([])
const filters = reactive({ phone: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const config = reactive({ activityStartTime: '', activityEndTime: '', policyUrl: '', dailyLimit: '', isActive: false })
const dateRange = computed({
  get: () => [config.activityStartTime, config.activityEndTime],
  set: (value) => {
    if (Array.isArray(value)) {
      config.activityStartTime = value[0]
      config.activityEndTime = value[1]
    }
  }
})

async function loadRecords(page = pagination.page) {
  pagination.page = page
  const recordsRes = await api.getLuckyBagRecords({
    page: pagination.page,
    pageSize: pagination.pageSize,
    phone: filters.phone || undefined
  })
  if (recordsRes.success) {
    records.value = recordsRes.data.list
    pagination.total = recordsRes.data.total
  }
}

async function loadConfig() {
  const configRes = await api.getLuckyBagConfig()
  if (configRes.success) Object.assign(config, configRes.data)
}

async function loadData() {
  loading.value = true
  try {
    await Promise.all([loadRecords(), loadConfig()])
  } finally {
    loading.value = false
  }
}

function changePageSize(size) {
  pagination.pageSize = size
  loadRecords(1)
}

function resetFilters() {
  filters.phone = ''
  loadRecords(1)
}

async function save() {
  const res = await api.updateLuckyBagConfig(config)
  if (res.success) ElMessage.success('保存成功')
}

onMounted(loadData)
</script>
