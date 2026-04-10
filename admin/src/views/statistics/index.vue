<template>
  <div class="page-stack">
    <div>
      <h1 class="page-title">统计报表</h1>
      <p class="page-subtitle">查看领取趋势，以及用户地域和商家核销的结构分布。</p>
    </div>

    <div class="page-card" style="padding:16px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
      />
      <div style="display:flex;gap:12px;">
        <el-button @click="reset">重置</el-button>
        <el-button type="primary" @click="loadData">刷新</el-button>
      </div>
    </div>

    <div class="page-card" style="padding:16px;">
      <div ref="chartRef" style="height:320px"></div>
    </div>

    <el-row :gutter="12">
      <el-col :span="12">
        <div class="page-card" style="padding:16px;">
          <h3>用户地域</h3>
          <el-table :data="userStats.provinceDistribution || []" border>
            <el-table-column prop="province" label="省份" />
            <el-table-column prop="count" label="人数" />
          </el-table>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="page-card" style="padding:16px;">
          <h3>商家排行</h3>
          <el-table :data="merchantStats" border>
            <el-table-column prop="merchantName" label="商家" />
            <el-table-column prop="count" label="核销次数" />
            <el-table-column prop="amount" label="核销金额">
              <template #default="{ row }">¥{{ row.amount }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import echarts from '@/utils/echarts'
import api from '@/api'

const chartRef = ref(null)
const userStats = ref({ provinceDistribution: [] })
const merchantStats = ref([])
const dateRange = ref([])
let chart

async function loadData() {
  const [trendRes, userRes, merchantRes] = await Promise.all([
    api.getStatistics({
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1]
    }),
    api.getUserAnalysis(),
    api.getMerchantAnalysis()
  ])

  if (userRes.success) userStats.value = userRes.data
  if (merchantRes.success) merchantStats.value = merchantRes.data

  if (trendRes.success) {
    await nextTick()
    chart = chart || echarts.init(chartRef.value)
    chart.setOption({
      grid: { left: 24, right: 16, top: 24, bottom: 24, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: trendRes.data.map((item) => item.date) },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'line',
          smooth: true,
          areaStyle: {},
          lineStyle: { color: '#cf4b21', width: 3 },
          itemStyle: { color: '#cf4b21' },
          data: trendRes.data.map((item) => Number(item.amount || 0))
        }
      ]
    })
  }
}

function reset() {
  dateRange.value = []
  loadData()
}

function handleResize() {
  chart?.resize()
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})
</script>
