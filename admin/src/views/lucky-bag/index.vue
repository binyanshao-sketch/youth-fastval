<template>
  <div class="page-stack">
    <div class="page-card" style="padding: 22px;">
      <div class="section-heading">
        <div>
          <h3>青春福袋运营配置</h3>
          <p>统一配置活动时间、抽奖玩法、红包池与海报展示。</p>
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
        <el-form-item label="抽奖玩法">
          <el-radio-group v-model="config.lotteryMode">
            <el-radio-button label="wheel">大转盘</el-radio-button>
            <el-radio-button label="grid">九宫格</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="活动开关">
          <el-switch v-model="config.isActive" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="panel-grid">
      <div class="page-card" style="padding: 22px;">
        <div class="section-heading">
          <div>
            <h3>九选一红包墙预览</h3>
            <p>展示给用户的九宫格位文案。</p>
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
            <h3>红包金额池管理</h3>
            <p>支持新增、编辑、停用档位，变更后自动同步库存池。</p>
          </div>
          <el-button type="primary" @click="openCreatePoolDialog">新增档位</el-button>
        </div>
        <el-table :data="config.redpacketPool" border>
          <el-table-column label="金额(元)" width="120">
            <template #default="{ row }">¥{{ formatMoney(row.amount) }}</template>
          </el-table-column>
          <el-table-column label="库存" width="160">
            <template #default="{ row }">{{ row.usedCount }}/{{ row.totalCount }}</template>
          </el-table-column>
          <el-table-column prop="weight" label="权重" width="100" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <span :class="row.status === 1 ? 'status-pill active' : 'status-pill failed'">
                {{ row.status === 1 ? '启用' : '停用' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="blessing" label="祝福语" min-width="220" show-overflow-tooltip />
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openEditPoolDialog(row)">编辑</el-button>
              <el-button
                v-if="row.status === 1"
                size="small"
                type="danger"
                plain
                @click="disablePoolItem(row)"
              >
                停用
              </el-button>
              <el-button
                v-else
                size="small"
                type="success"
                plain
                @click="enablePoolItem(row)"
              >
                启用
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <div class="page-card" style="padding: 22px;">
      <div class="section-heading">
        <div>
          <h3>红包海报配置</h3>
          <p>每个红包档位可配置独立海报，领取福袋后展示给用户。</p>
        </div>
      </div>
      <div class="poster-grid">
        <div class="poster-card" v-for="item in config.redpacketPool" :key="'poster-' + item.id">
          <div class="poster-header">
            <strong>¥{{ formatMoney(item.amount) }}</strong>
            <span class="mini-note">{{ item.status === 1 ? '启用中' : '已停用' }}</span>
          </div>
          <div class="poster-preview">
            <img v-if="item.posterUrl" :src="item.posterUrl" class="poster-img" @error="$event.target.style.display='none'" />
            <div v-else class="poster-empty">暂未上传</div>
          </div>
          <div class="poster-actions">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="poster-file-input"
              :id="'poster-input-' + item.id"
              @change="(e) => handlePosterUpload(item.id, e)"
            />
            <label :for="'poster-input-' + item.id" class="el-button el-button--primary el-button--small">
              {{ item.posterUrl ? '更换海报' : '上传海报' }}
            </label>
            <el-button v-if="item.posterUrl" size="small" type="danger" plain @click="removePoster(item.id)">删除</el-button>
          </div>
          <div v-if="uploadProgress[item.id]" class="poster-progress">
            <el-progress :percentage="uploadProgress[item.id]" :stroke-width="4" />
          </div>
        </div>
      </div>
    </div>

    <div class="panel-grid">
      <div class="page-card" style="padding: 22px;">
        <div class="section-heading">
          <div>
            <h3>大转盘奖池预览</h3>
            <p>实时展示转盘奖项配置与落点视觉。</p>
          </div>
        </div>
        <div v-if="wheelPreviewPrizes.length" class="wheel-preview-wrap">
          <div class="wheel-preview-stage">
            <div class="wheel-preview-leds">
              <span
                v-for="n in 30"
                :key="'led-' + n"
                class="wheel-preview-led"
                :style="{ '--angle': `${(360 / 30) * (n - 1)}deg`, '--delay': `${(n - 1) * 0.04}s` }"
              />
            </div>
            <div class="wheel-preview-pointer">
              <span class="wheel-preview-pointer-core"></span>
            </div>
            <div class="wheel-preview-disc" :style="{ '--wheel-gradient': wheelPreviewGradient }">
              <div
                v-for="item in wheelPreviewPrizes"
                :key="item.key"
                class="wheel-preview-slot"
                :style="{ '--angle': `${item.angle}deg` }"
              >
                <div class="wheel-preview-slot-card" :style="{ background: item.bg, color: item.fg }">
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.value }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="wheel-preview-list">
            <div class="wheel-preview-list-item" v-for="item in wheelPreviewPrizes" :key="'list-' + item.key">
              <span class="wheel-preview-dot" :style="{ background: item.bg }"></span>
              <div>
                <strong>{{ item.label }}</strong>
                <p>{{ item.value }}</p>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-panel">暂无转盘奖项配置</div>
      </div>

      <div class="page-card" style="padding: 22px;">
        <div class="section-heading">
          <div>
            <h3>九宫格奖池预览</h3>
            <p>中心按钮固定为“开始”，外圈展示奖项格位。</p>
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
          <p>查看手机号、命中金额、红包位和抽奖结果。</p>
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
          <template #default="{ row }">¥{{ formatMoney(row.amount) }}</template>
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

    <el-dialog v-model="poolDialog.visible" :title="poolDialog.mode === 'create' ? '新增红包档位' : '编辑红包档位'" width="520px">
      <el-form :model="poolForm" label-width="110px">
        <el-form-item label="金额(元)">
          <el-input v-model="poolForm.amount" placeholder="例如 5.20" />
        </el-form-item>
        <el-form-item label="总库存">
          <el-input v-model="poolForm.totalCount" placeholder="例如 5000" />
        </el-form-item>
        <el-form-item label="权重">
          <el-input v-model="poolForm.weight" placeholder="例如 100" />
        </el-form-item>
        <el-form-item label="祝福语">
          <el-input v-model="poolForm.blessing" type="textarea" :rows="3" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            v-model="poolForm.status"
            :active-value="1"
            :inactive-value="0"
            active-text="启用"
            inactive-text="停用"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="poolDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="poolDialog.saving" @click="savePoolItem">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'
import { uploadToQiniu } from '@/utils/qiniuUpload'

const loading = ref(false)
const records = ref([])
const uploadProgress = reactive({})
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

const poolDialog = reactive({
  visible: false,
  mode: 'create',
  saving: false,
  editingId: null
})

const poolForm = reactive({
  amount: '',
  totalCount: '',
  weight: '1',
  blessing: '',
  status: 1
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

const wheelPreviewPrizes = computed(() => {
  const source = lotteryBoards.value.wheel || []
  if (!source.length) {
    return []
  }

  const count = source.length
  const segment = 360 / count
  return source.map((item, index) => {
    const fallbackBg = index % 2 === 0 ? '#1db7a4' : '#0d5fa8'
    const fallbackFg = '#ffffff'
    return {
      key: item.key || `wheel-${index}`,
      label: item.label || '-',
      value: item.value || '',
      bg: item.color || fallbackBg,
      fg: item.accent || fallbackFg,
      angle: (index * segment + segment / 2).toFixed(2)
    }
  })
})

const wheelPreviewGradient = computed(() => {
  if (!wheelPreviewPrizes.value.length) {
    return 'conic-gradient(from -90deg, #dce8f4 0deg 360deg)'
  }

  const count = wheelPreviewPrizes.value.length
  const segment = 360 / count
  const pieces = wheelPreviewPrizes.value.map((item, index) => {
    const start = (index * segment).toFixed(3)
    const end = ((index + 1) * segment).toFixed(3)
    return `${item.bg} ${start}deg ${end}deg`
  })
  return `conic-gradient(from -90deg, ${pieces.join(', ')})`
})

function formatMoney(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toFixed(2) : value
}

function resetPoolForm() {
  poolForm.amount = ''
  poolForm.totalCount = ''
  poolForm.weight = '1'
  poolForm.blessing = ''
  poolForm.status = 1
}

function openCreatePoolDialog() {
  poolDialog.mode = 'create'
  poolDialog.editingId = null
  resetPoolForm()
  poolDialog.visible = true
}

function openEditPoolDialog(item) {
  poolDialog.mode = 'edit'
  poolDialog.editingId = item.id
  poolForm.amount = formatMoney(item.amount)
  poolForm.totalCount = String(item.totalCount ?? '')
  poolForm.weight = String(item.weight ?? 1)
  poolForm.blessing = item.blessing || ''
  poolForm.status = Number(item.status) === 1 ? 1 : 0
  poolDialog.visible = true
}

async function savePoolItem() {
  const amount = Number(poolForm.amount)
  const totalCount = Number(poolForm.totalCount)
  const weight = Number(poolForm.weight || 1)
  if (!Number.isFinite(amount) || amount <= 0) {
    ElMessage.warning('请输入正确金额')
    return
  }
  if (!Number.isInteger(totalCount) || totalCount <= 0) {
    ElMessage.warning('总库存必须是正整数')
    return
  }
  if (!Number.isInteger(weight) || weight <= 0) {
    ElMessage.warning('权重必须是正整数')
    return
  }

  const payload = {
    amount: Number(amount.toFixed(2)),
    totalCount,
    weight,
    blessing: String(poolForm.blessing || '').trim(),
    status: poolForm.status
  }

  try {
    poolDialog.saving = true
    const response = poolDialog.mode === 'create'
      ? await api.createLuckyBagPoolItem(payload)
      : await api.updateLuckyBagPoolItem(poolDialog.editingId, payload)
    if (response.success) {
      ElMessage.success(poolDialog.mode === 'create' ? '红包档位已创建' : '红包档位已更新')
      poolDialog.visible = false
      await loadConfig()
    }
  } finally {
    poolDialog.saving = false
  }
}

async function disablePoolItem(item) {
  try {
    await ElMessageBox.confirm(`确认停用 ¥${formatMoney(item.amount)} 档位吗？`, '停用确认', { type: 'warning' })
  } catch (error) {
    return
  }

  const response = await api.deleteLuckyBagPoolItem(item.id)
  if (response.success) {
    ElMessage.success('红包档位已停用')
    await loadConfig()
  }
}

async function enablePoolItem(item) {
  const response = await api.updateLuckyBagPoolItem(item.id, { status: 1 })
  if (response.success) {
    ElMessage.success('红包档位已启用')
    await loadConfig()
  }
}

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
    ElMessage.success('福袋配置已保存')
    loadConfig()
  }
}

async function handlePosterUpload(poolId, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 5MB')
    return
  }

  try {
    uploadProgress[poolId] = 1
    const url = await uploadToQiniu(file, 'poster/', (pct) => {
      uploadProgress[poolId] = pct
    })
    const response = await api.updatePoolPoster(poolId, url)
    if (response.success) {
      ElMessage.success('海报上传成功')
      const item = config.redpacketPool.find((p) => p.id === poolId)
      if (item) item.posterUrl = url
    }
  } catch (error) {
    ElMessage.error(error.message || '上传失败')
  } finally {
    delete uploadProgress[poolId]
  }
}

async function removePoster(poolId) {
  try {
    const response = await api.updatePoolPoster(poolId, '')
    if (response.success) {
      ElMessage.success('海报已删除')
      const item = config.redpacketPool.find((p) => p.id === poolId)
      if (item) item.posterUrl = ''
    }
  } catch (error) {
    ElMessage.error(error.message || '删除失败')
  }
}

onMounted(loadData)
</script>

<style scoped>
.wheel-preview-wrap {
  display: grid;
  grid-template-columns: minmax(260px, 360px) minmax(180px, 1fr);
  gap: 20px;
  align-items: center;
}

.wheel-preview-stage {
  position: relative;
  width: min(72vw, 340px);
  height: min(72vw, 340px);
  margin: 0 auto;
  display: grid;
  place-items: center;
}

.wheel-preview-leds {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.wheel-preview-led {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  transform: translate(-50%, -50%) rotate(var(--angle)) translateY(calc(-1 * min(35vw, 160px)));
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.45), 0 0 12px rgba(40, 167, 215, 0.5);
  animation: wheel-led-pulse 1.2s steps(2, end) infinite;
  animation-delay: var(--delay);
}

.wheel-preview-pointer {
  position: absolute;
  left: 50%;
  top: -4px;
  transform: translateX(-50%);
  width: 26px;
  height: 42px;
  z-index: 3;
  clip-path: polygon(50% 100%, 0 0, 100% 0);
  background: linear-gradient(180deg, #ffd487 0%, #ef9d51 100%);
  filter: drop-shadow(0 10px 16px rgba(239, 157, 81, 0.35));
}

.wheel-preview-pointer-core {
  position: absolute;
  left: 50%;
  top: 22px;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff6dd;
}

.wheel-preview-disc {
  position: absolute;
  inset: 20px;
  border-radius: 50%;
  background: var(--wheel-gradient);
  border: 12px solid rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 30px rgba(13, 95, 168, 0.18), 0 0 0 6px rgba(29, 183, 164, 0.12);
}

.wheel-preview-disc::before {
  content: '';
  position: absolute;
  inset: 18%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.95), rgba(229, 242, 251, 0.95));
  box-shadow: inset 0 0 0 2px rgba(125, 189, 232, 0.35);
}

.wheel-preview-slot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  transform: rotate(var(--angle));
}

.wheel-preview-slot-card {
  transform: translate(-50%, -50%) translateY(calc(-1 * min(25vw, 110px))) rotate(calc(-1 * var(--angle)));
  width: min(18vw, 84px);
  min-height: 58px;
  border-radius: 14px;
  padding: 8px 6px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.68);
  box-shadow: 0 10px 18px rgba(8, 59, 118, 0.22);
}

.wheel-preview-slot-card strong {
  display: block;
  font-size: 12px;
  line-height: 1.25;
}

.wheel-preview-slot-card span {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  opacity: 0.95;
}

.wheel-preview-list {
  display: grid;
  gap: 10px;
}

.wheel-preview-list-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(13, 95, 168, 0.05);
}

.wheel-preview-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 4px;
  flex: 0 0 auto;
}

.wheel-preview-list-item strong {
  font-size: 13px;
  color: #1f2d3d;
}

.wheel-preview-list-item p {
  margin: 2px 0 0;
  font-size: 12px;
  color: #5b6675;
}

.empty-panel {
  padding: 18px;
  border-radius: 12px;
  background: rgba(13, 95, 168, 0.05);
  color: #5b6675;
  text-align: center;
}

@keyframes wheel-led-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

@media (max-width: 900px) {
  .wheel-preview-wrap {
    grid-template-columns: 1fr;
  }
}
</style>
