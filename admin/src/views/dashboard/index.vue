<template>
  <div class="page-stack">
    <div class="warm-block">
      <div class="section-heading">
        <div>
          <h3>青春福袋主链路看板</h3>
          <p>围绕领取入口、九选一红包、祝福海报、抽奖承接和商家核销，统一观察活动运行状态。</p>
        </div>
        <div class="chip-row">
          <span class="status-pill active">活动看板</span>
          <span class="status-pill pending">实时概览</span>
        </div>
      </div>
      <div class="metric-grid">
        <div class="metric-card" v-for="card in statCards" :key="card.key">
          <el-icon :size="24"><component :is="card.icon" /></el-icon>
          <strong>{{ card.value }}</strong>
          <span>{{ card.label }}</span>
        </div>
      </div>
    </div>

    <div class="panel-grid">
      <div class="page-card" style="padding: 22px;">
        <div class="section-heading">
          <div>
            <h3>领取与发放趋势</h3>
            <p>基于最近 10 条福袋记录，快速观察红包发放节奏。</p>
          </div>
        </div>
        <div ref="trendChartRef" style="height: 320px;"></div>
      </div>

      <div class="page-stack">
        <div class="page-card" style="padding: 22px;">
          <div class="section-heading">
            <div>
              <h3>红包金额池</h3>
              <p>当前启用的随机红包档位和库存情况。</p>
            </div>
          </div>
          <div class="chip-row">
            <span v-for="item in dashboard.redpacketPool" :key="item.id" class="status-pill pending">
              ¥{{ item.amount }} / {{ item.totalCount }}
            </span>
          </div>
          <div ref="poolChartRef" style="height: 220px; margin-top: 16px;"></div>
        </div>

        <div class="page-card" style="padding: 22px;">
          <div class="section-heading">
            <div>
              <h3>运营提示</h3>
              <p>围绕主流程的快速检查项。</p>
            </div>
          </div>
          <div class="page-stack">
            <div class="soft-block">
              <strong>九选一红包墙</strong>
              <div class="mini-note">确认首页主文案、活动时间和福袋入口都处于正确状态。</div>
            </div>
            <div class="soft-block">
              <strong>红包发放链路</strong>
              <div class="mini-note">当前待发放 {{ dashboard.pendingDeliveryCount || 0 }} 笔，需重点关注微信红包状态。</div>
            </div>
            <div class="soft-block">
              <strong>抽奖承接</strong>
              <div class="mini-note">已有 {{ dashboard.lotteryCount || 0 }} 位用户完成抽奖，可继续观察玩法偏好。</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-grid">
      <div class="page-card" style="padding: 22px;">
        <div class="section-heading">
          <div>
            <h3>最新领取记录</h3>
            <p>查看最近完成拆福袋的用户记录。</p>
          </div>
        </div>
        <el-table :data="dashboard.latestRecords || []" border>
          <el-table-column prop="phone" label="手机号" width="150" />
          <el-table-column prop="amount" label="红包金额" width="120">
            <template #default="{ row }">¥{{ row.amount }}</template>
          </el-table-column>
          <el-table-column label="发放状态" width="120">
            <template #default="{ row }">
              <span :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="time" label="领取时间" min-width="180" />
        </el-table>
      </div>

      <div class="page-card" style="padding: 22px;">
        <div class="section-heading">
          <div>
            <h3>最新核销记录</h3>
            <p>观察消费券核销和商家侧活跃情况。</p>
          </div>
        </div>
        <el-table :data="dashboard.latestVerifies || []" border>
          <el-table-column prop="merchant" label="商家" min-width="150" />
          <el-table-column prop="amount" label="核销金额" width="120">
            <template #default="{ row }">¥{{ row.amount }}</template>
          </el-table-column>
          <el-table-column prop="time" label="核销时间" min-width="180" />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import echarts from '@/utils/echarts'
import api from '@/api'

const dashboard = ref({
  userCount: 0,
  redpacketTotal: '0.00',
  couponUsedCount: 0,
  merchantCount: 0,
  lotteryCount: 0,
  pendingDeliveryCount: 0,
  latestRecords: [],
  latestVerifies: [],
  redpacketPool: []
})

const trendChartRef = ref(null)
const poolChartRef = ref(null)
let trendChart
let poolChart

const statCards = computed(() => [
  { key: 'users', label: '已领取用户', value: dashboard.value.userCount || 0, icon: 'User' },
  { key: 'amount', label: '红包累计金额', value: `¥${dashboard.value.redpacketTotal || '0.00'}`, icon: 'Wallet' },
  { key: 'lottery', label: '已完成抽奖', value: dashboard.value.lotteryCount || 0, icon: 'Present' },
  { key: 'merchant', label: '合作商家', value: dashboard.value.merchantCount || 0, icon: 'Shop' }
])

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

function buildTrendData(records) {
  const source = [...(records || [])].reverse()
  return {
    xAxis: source.map((item, index) => item.time?.slice(5, 16) || `记录 ${index + 1}`),
    amounts: source.map((item) => Number(item.amount || 0))
  }
}

async function loadData() {
  const response = await api.getDashboard()
  if (response.success) {
    dashboard.value = response.data
    await nextTick()
    renderCharts()
  }
}

function renderCharts() {
  if (trendChartRef.value) {
    trendChart = trendChart || echarts.init(trendChartRef.value)
    const trend = buildTrendData(dashboard.value.latestRecords)
    trendChart.setOption({
      grid: { left: 24, right: 16, top: 24, bottom: 24, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: trend.xAxis,
        axisLine: { lineStyle: { color: '#d9cabd' } }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(137, 102, 79, 0.12)' } }
      },
      series: [
        {
          name: '红包金额',
          type: 'line',
          smooth: true,
          data: trend.amounts,
          lineStyle: { color: '#cf4b21', width: 3 },
          itemStyle: { color: '#cf4b21' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(207, 75, 33, 0.28)' },
              { offset: 1, color: 'rgba(207, 75, 33, 0.04)' }
            ])
          }
        }
      ]
    })
  }

  if (poolChartRef.value) {
    poolChart = poolChart || echarts.init(poolChartRef.value)
    poolChart.setOption({
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['42%', '72%'],
          label: { formatter: '{b}\n{c}份' },
          data: (dashboard.value.redpacketPool || []).map((item, index) => ({
            name: `¥${item.amount}`,
            value: item.totalCount,
            itemStyle: {
              color: ['#cf4b21', '#e98733', '#f4b55b', '#f9d79b'][index % 4]
            }
          }))
        }
      ]
    })
  }
}

function handleResize() {
  trendChart?.resize()
  poolChart?.resize()
}

onMounted(async () => {
  await loadData()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  poolChart?.dispose()
})
</script>
