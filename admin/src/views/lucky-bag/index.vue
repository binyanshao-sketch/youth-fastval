<template>
  <div class="page-stack">
    <div class="page-card" style="padding: 22px;">
      <div class="section-heading">
        <div>
          <h3>青春福袋运营配置</h3>
          <p>围绕九选一红包墙、随机金额、祝福海报和抽奖承接做统一配置。</p>
        </div>
        <div class="chip-row">
          <span :class="config.isActive ? 'status-pill active' : 'status-pill pending'">
            {{ config.isActive ? '活动进行中' : '活动已关闭' }}
          </span>
          <span class="status-pill pending">待发放 {{ overview.pendingCount || 0 }}</span>
        </div>
      </div>

      <div class="metric-grid" style="margin-bottom: 20px;">
        <div class="metric-card">
          <span>已领取福袋</span>
          <strong>{{ overview.receivedCount || 0 }}</strong>
        </div>
        <div class="metric-card">
          <span>微信红包已到账</span>
          <strong>{{ overview.sentCount || 0 }}</strong>
        </div>
        <div class="metric-card">
          <span>九选一屏幕</span>
          <strong>9 宫格</strong>
        </div>
        <div class="metric-card">
          <span>抽奖承接玩法</span>
          <strong>{{ lotteryModeLabel }}</strong>
        </div>
      </div>

      <el-form :model="config" label-width="128px">
        <el-form-item label="活动时间">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="政策链接">
          <el-input v-model="config.policyUrl" placeholder="用于结果页和政策福利页跳转" />
        </el-form-item>
        <el-form-item label="每日领取上限">
          <el-input v-model="config.dailyLimit" placeholder="例如 5000" />
        </el-form-item>
        <el-form-item label="&#25277;&#22870;&#29609;&#27861;">
          <el-radio-group v-model="config.lotteryMode">
            <el-radio-button label="wheel">&#22823;&#36716;&#30424;</el-radio-button>
            <el-radio-button label="grid">&#20061;&#23467;&#26684;</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="活动开关">
          <el-switch v-model="config.isActive" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveConfig">保存青春福袋配置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="panel-grid">
      <div class="page-card" style="padding: 22px;">
        <div class="section-heading">
          <div>
            <h3>九选一红包墙预览</h3>
            <p>第一屏展示给用户的红包矩阵，用于核对运营文案。</p>
          </div>
        </div>
        <div class="preview-grid">
          <div class="preview-card" v-for="item in slotPreview" :key="item.index">
            <h4>{{ item.label }}</h4>
            <p>{{ item.tag }}</p>
          </div>
        </div>
      </div>

      <div class="page-card" style="padding: 22px;">
        <div class="section-heading">
          <div>
            <h3>红包金额池</h3>
            <p>随机金额档位、库存和祝福语预览。</p>
          </div>
        </div>
        <div class="page-stack">
          <div class="soft-block" v-for="item in config.redpacketPool" :key="item.id">
            <strong>¥{{ item.amount }} · 权重 {{ item.weight }}</strong>
            <div class="mini-note">库存 {{ item.usedCount }}/{{ item.totalCount }}</div>
            <div class="mini-note" style="margin-top: 8px;">{{ item.blessing }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-grid">
      <div class="page-card" style="padding: 22px;">
        <div class="section-heading">
          <div>
            <h3>大转盘奖池预览</h3>
            <p>所见即所得地展示转盘奖项本身。</p>
          </div>
        </div>
        <div class="lottery-grid">
          <div class="lottery-tile" v-for="item in lotteryBoards.wheel || []" :key="item.key">
            <strong>{{ item.label }}</strong>
            <span>{{ item.value }}</span>
          </div>
        </div>
      </div>

      <div class="page-card" style="padding: 22px;">
        <div class="section-heading">
          <div>
            <h3>九宫格奖池预览</h3>
            <p>中心按钮固定为“开始”，外围展示奖项格位。</p>
          </div>
        </div>
        <div class="board-grid">
          <template v-for="(cell, index) in gridPreview" :key="index">
            <div v-if="cell.isCenter" class="board-cell center">
              <strong>开始抽奖</strong>
            </div>
            <div v-else class="board-cell">
              <strong>{{ cell.label }}</strong>
              <span class="mini-note">{{ cell.value }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div class="page-card" style="padding: 22px;">
      <div class="section-heading">
        <div>
          <h3>领取记录</h3>
          <p>查看手机号、命中金额、所选红包位和后续抽奖结果。</p>
        </div>
      </div>

      <div class="table-toolbar">
        <el-input v-model="filters.phone" clearable placeholder="按手机号搜索" style="width: 220px;" />
        <div style="display: flex; gap: 12px;">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" @click="loadRecords(1)">查询</el-button>
        </div>
      </div>

      <el-table :data="records" v-loading="loading" border>
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="nickname" label="昵称" width="120" />
        <el-table-column prop="selectedSlot" label="红包位" width="90">
          <template #default="{ row }">{{ row.selectedSlot == null ? '-' : row.selectedSlot + 1 }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="100">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column prop="blessing" label="祝福语" min-width="220" show-overflow-tooltip />
        <el-table-column label="红包状态" width="120">
          <template #default="{ row }">
            <span :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="lotteryPrizeName" label="抽奖结果" min-width="160">
          <template #default="{ row }">{{ row.lotteryPrizeName || '未抽奖' }}</template>
        </el-table-column>
        <el-table-column prop="receivedAt" label="领取时间" min-width="180" />
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 18px;">
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
const overview = ref({ receivedCount: 0, sentCount: 0, pendingCount: 0 })
const slotPreview = ref([])
const lotteryBoards = ref({ wheel: [], grid: [] })
const config = reactive({
  activityStartTime: '',
  activityEndTime: '',
  policyUrl: '',
  dailyLimit: '',
  lotteryMode: 'wheel',
  isActive: false,
  redpacketPool: []
})

const lotteryModeLabel = computed(() => (
  config.lotteryMode === 'grid' ? '九宫格' : '大转盘'
))

const dateRange = computed({
  get: () => [config.activityStartTime, config.activityEndTime],
  set: (value) => {
    if (Array.isArray(value)) {
      ;[config.activityStartTime, config.activityEndTime] = value
    }
  }
})

const gridPreview = computed(() => {
  const source = lotteryBoards.value.grid || []
  const mapping = [0, 1, 2, 7, null, 3, 6, 5, 4]
  return mapping.map((index) => {
    if (index == null) return { isCenter: true }
    return source[index]
  })
})

function statusLabel(status) {
  if (status === 2) return '已到账'
  if (status === 3) return '待处理'
  return '发放中'
}

function statusClass(status) {
  if (status === 2) return 'status-pill active'
  if (status === 3) return 'status-pill failed'
  return 'status-pill pending'
}

async function loadRecords(page = pagination.page) {
  pagination.page = page
  const response = await api.getLuckyBagRecords({
    page: pagination.page,
    pageSize: pagination.pageSize,
    phone: filters.phone || undefined
  })
  if (response.success) {
    records.value = response.data.list
    pagination.total = response.data.total
  }
}

async function loadConfig() {
  const response = await api.getLuckyBagConfig()
  if (response.success) {
    Object.assign(config, {
      activityStartTime: response.data.activityStartTime,
      activityEndTime: response.data.activityEndTime,
      policyUrl: response.data.policyUrl,
      dailyLimit: response.data.dailyLimit,
      lotteryMode: response.data.lotteryMode || 'wheel',
      isActive: response.data.isActive,
      redpacketPool: response.data.redpacketPool || []
    })
    overview.value = response.data.overview || overview.value
    slotPreview.value = response.data.slotPreview || []
    lotteryBoards.value = response.data.lotteryBoards || { wheel: [], grid: [] }
  }
}

async function loadData() {
  loading.value = true
  try {
    await Promise.all([loadConfig(), loadRecords()])
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

async function saveConfig() {
  const response = await api.updateLuckyBagConfig({
    activityStartTime: config.activityStartTime,
    activityEndTime: config.activityEndTime,
    policyUrl: config.policyUrl,
    dailyLimit: config.dailyLimit,
    lotteryMode: config.lotteryMode,
    isActive: config.isActive
  })

  if (response.success) {
    ElMessage.success('青春福袋配置已保存')
    loadConfig()
  }
}

onMounted(loadData)
</script>
