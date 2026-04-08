<template>
  <div class="page-stack">
    <div>
      <h1 class="page-title">财务管理</h1>
      <p class="page-subtitle">红包与消费券资金概览。</p>
    </div>
    <div class="page-card" style="padding:16px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
        />
        <div style="display:flex;gap:12px;">
          <el-button @click="resetFilters">重置</el-button>
          <el-button @click="exportCsv">导出CSV</el-button>
          <el-button type="primary" @click="loadRecords(1)">查询</el-button>
        </div>
      </div>

      <el-row :gutter="12">
        <el-col :span="6"><div><div>红包发放</div><strong>¥{{ summary.redPacketIssued }}</strong></div></el-col>
        <el-col :span="6"><div><div>红包提现</div><strong>¥{{ summary.redPacketWithdrawn }}</strong></div></el-col>
        <el-col :span="6"><div><div>券核销</div><strong>¥{{ summary.couponTotal }}</strong></div></el-col>
        <el-col :span="6"><div><div>总支出</div><strong>¥{{ summary.totalExpense }}</strong></div></el-col>
      </el-row>
    </div>
    <div class="page-card" style="padding:16px;">
      <el-table :data="records" v-loading="loading" border>
        <el-table-column prop="type" label="类型" width="120" />
        <el-table-column prop="title" label="对象" min-width="160" />
        <el-table-column prop="amount" label="金额" width="120" />
        <el-table-column prop="time" label="时间" min-width="180" />
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
import { onMounted, reactive, ref } from 'vue'
import api from '@/api'

const loading = ref(false)
const records = ref([])
const rawRecords = ref([])
const dateRange = ref([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const summary = reactive({ redPacketIssued: '0.00', redPacketWithdrawn: '0.00', couponTotal: '0.00', totalExpense: '0.00' })

function applyFilterAndPagination(page = pagination.page) {
  pagination.page = page
  const filtered = rawRecords.value.filter(item => {
    if (!dateRange.value || dateRange.value.length !== 2) return true
    const start = new Date(`${dateRange.value[0]} 00:00:00`).getTime()
    const end = new Date(`${dateRange.value[1]} 23:59:59`).getTime()
    const current = new Date(item.time).getTime()
    return current >= start && current <= end
  })

  pagination.total = filtered.length
  const startIndex = (pagination.page - 1) * pagination.pageSize
  records.value = filtered.slice(startIndex, startIndex + pagination.pageSize)
}

function changePageSize(size) {
  pagination.pageSize = size
  applyFilterAndPagination(1)
}

function resetFilters() {
  dateRange.value = []
  applyFilterAndPagination(1)
}

async function loadRecords(page = pagination.page) {
  const recordsRes = await api.getFinanceRecords({ page: 1, pageSize: 500 })
  if (recordsRes.success) {
    rawRecords.value = recordsRes.data.list
    applyFilterAndPagination(page)
  }
}

async function exportCsv() {
  const blob = await api.exportFinance()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finance-${Date.now()}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}

async function loadData() {
  loading.value = true
  try {
    const [summaryRes] = await Promise.all([api.getFinanceSummary()])
    if (summaryRes.success) Object.assign(summary, summaryRes.data)
    await loadRecords()
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>
