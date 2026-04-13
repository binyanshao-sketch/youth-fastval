<template>
  <div class="page-stack">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h1 class="page-title">消费券管理</h1>
        <p class="page-subtitle">新建、筛选并停用消费券，管理活动权益池。</p>
      </div>
      <el-button type="primary" @click="show = true">新建消费券</el-button>
    </div>

    <div class="page-card" style="padding:16px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <el-input v-model="filters.name" clearable placeholder="券名称" style="width:220px;" />
        <div style="display:flex;gap:12px;">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" @click="loadData(1)">查询</el-button>
        </div>
      </div>

      <el-table :data="list" v-loading="loading" border>
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="amount" label="面额" width="100">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column prop="min_spend" label="门槛" width="100">
          <template #default="{ row }">¥{{ row.min_spend }}</template>
        </el-table-column>
        <el-table-column prop="total_count" label="总量" width="100" />
        <el-table-column prop="used_count" label="已核销" width="100" />
        <el-table-column prop="valid_from" label="开始" width="120" />
        <el-table-column prop="valid_to" label="结束" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="danger" :disabled="row.status !== 1" @click="disableCoupon(row.id)">停用</el-button>
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

    <el-dialog v-model="show" title="新建消费券" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="面额" prop="amount"><el-input-number v-model="form.amount" :min="1" /></el-form-item>
        <el-form-item label="门槛" prop="minSpend"><el-input-number v-model="form.minSpend" :min="0" /></el-form-item>
        <el-form-item label="总量" prop="totalCount"><el-input-number v-model="form.totalCount" :min="1" /></el-form-item>
        <el-form-item label="有效期" prop="dateRange">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width:100%;"
          />
        </el-form-item>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="show = false">取消</el-button>
        <el-button type="primary" @click="create">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const show = ref(false)
const formRef = ref(null)
const list = ref([])
const filters = reactive({ name: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const form = reactive({
  name: '',
  amount: 20,
  minSpend: 50,
  totalCount: 100,
  validFrom: '2026-04-01',
  validTo: '2026-05-31',
  description: ''
})

const dateRange = computed({
  get: () => [form.validFrom, form.validTo],
  set: (value) => {
    if (Array.isArray(value)) {
      form.validFrom = value[0]
      form.validTo = value[1]
    }
  }
})

const rules = {
  name: [{ required: true, message: '请输入券名称', trigger: 'blur' }],
  amount: [{ required: true, message: '请输入面额', trigger: 'change' }],
  minSpend: [{ required: true, message: '请输入使用门槛', trigger: 'change' }],
  totalCount: [{ required: true, message: '请输入总量', trigger: 'change' }],
  dateRange: [{
    validator: (_, __, cb) => {
      if (!form.validFrom || !form.validTo) {
        cb(new Error('请选择有效期'))
        return
      }
      cb()
    },
    trigger: 'change'
  }]
}

async function loadData(page = pagination.page) {
  pagination.page = page
  loading.value = true
  try {
    const params = { page: pagination.page, pageSize: pagination.pageSize }
    if (filters.name) params.name = filters.name
    const res = await api.getCoupons(params)
    if (res.success) {
      list.value = res.data.list || []
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
  filters.name = ''
  loadData(1)
}

async function create() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  const res = await api.createCoupon(form)
  if (res.success) {
    ElMessage.success('消费券创建成功')
    show.value = false
    form.name = ''
    form.amount = 20
    form.minSpend = 50
    form.totalCount = 100
    form.validFrom = '2026-04-01'
    form.validTo = '2026-05-31'
    form.description = ''
    loadData()
  }
}

async function disableCoupon(id) {
  const res = await api.deleteCoupon(id)
  if (res.success) {
    ElMessage.success('消费券已停用')
    loadData()
  }
}

onMounted(loadData)
</script>
