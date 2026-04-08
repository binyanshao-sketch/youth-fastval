<template>
  <div class="page-stack">
    <div>
      <h1 class="page-title">用户管理</h1>
      <p class="page-subtitle">查看并维护用户状态，支持按手机号和状态筛选。</p>
    </div>

    <div class="page-card" style="padding:16px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <el-input v-model="filters.phone" clearable placeholder="手机号" style="width:220px;" />
          <el-select v-model="filters.status" clearable placeholder="状态" style="width:140px;">
            <el-option label="正常" :value="1" />
            <el-option label="黑名单" :value="2" />
          </el-select>
        </div>
        <div style="display:flex;gap:12px;">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" @click="loadData(1)">查询</el-button>
        </div>
      </div>

      <el-table :data="list" v-loading="loading" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="openid" label="OpenID" min-width="220" show-overflow-tooltip />
        <el-table-column prop="province" label="省份" width="120" />
        <el-table-column prop="created_at" label="注册时间" min-width="180" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '正常' : '黑名单' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="danger" :disabled="row.status === 2" @click="blacklist(row.id)">拉黑</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <el-pagination
          background
          layout="total, prev, pager, next, sizes"
          :total="pagination.total"
          :current-page="pagination.page"
          :page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50]"
          @current-change="loadData"
          @size-change="changePageSize"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const list = ref([])
const filters = reactive({ phone: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

async function loadData(page = pagination.page) {
  pagination.page = page
  loading.value = true
  try {
    const res = await api.getUsers({
      page: pagination.page,
      pageSize: pagination.pageSize,
      phone: filters.phone || undefined,
      status: filters.status || undefined
    })
    if (res.success) {
      list.value = res.data.list
      pagination.total = res.data.total
    }
  } finally {
    loading.value = false
  }
}

function changePageSize(size) {
  pagination.pageSize = size
  loadData(1)
}

function resetFilters() {
  filters.phone = ''
  filters.status = ''
  loadData(1)
}

async function blacklist(id) {
  const res = await api.blacklistUser(id)
  if (res.success) {
    ElMessage.success('已拉黑')
    loadData()
  }
}

onMounted(loadData)
</script>
