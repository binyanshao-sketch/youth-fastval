<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6" v-for="stat in stats" :key="stat.key">
        <el-card class="stat-card" :body-style="{ padding: '20px' }">
          <div class="stat-content">
            <div class="stat-icon" :style="{ background: stat.color }">
              <el-icon :size="24"><component :is="stat.icon" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20" class="charts-row">
      <el-col :span="16">
        <el-card class="chart-card">
          <template #header>
            <span>领取趋势</span>
          </template>
          <div ref="lineChartRef" class="chart"></div>
        </el-card>
      </el-col>
      
      <el-col :span="8">
        <el-card class="chart-card">
          <template #header>
            <span>红包金额分布</span>
          </template>
          <div ref="pieChartRef" class="chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最新记录 -->
    <el-row :gutter="20" class="records-row">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>最新领取记录</span>
          </template>
          <el-table :data="latestRecords" style="width: 100%">
            <el-table-column prop="phone" label="手机号" width="120" />
            <el-table-column prop="amount" label="红包金额" width="100">
              <template #default="{ row }">
                <span class="amount">¥{{ row.amount }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="time" label="领取时间" />
          </el-table>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>最新核销记录</span>
          </template>
          <el-table :data="latestVerifies" style="width: 100%">
            <el-table-column prop="merchant" label="商家" width="120" />
            <el-table-column prop="amount" label="券面额" width="100">
              <template #default="{ row }">
                <span class="amount">¥{{ row.amount }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="time" label="核销时间" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import echarts from '@/utils/echarts'
import api from '@/api'

const stats = ref([
  { key: 'users', label: '领取人数', value: '0', icon: 'User', color: '#409EFF' },
  { key: 'redpacket', label: '红包发放', value: '¥0', icon: 'Present', color: '#67C23A' },
  { key: 'coupons', label: '消费券核销', value: '0张', icon: 'Ticket', color: '#E6A23C' },
  { key: 'merchants', label: '合作商家', value: '0家', icon: 'Shop', color: '#F56C6C' }
])

const latestRecords = ref([])
const latestVerifies = ref([])
const lineChartRef = ref(null)
const pieChartRef = ref(null)

onMounted(async () => {
  await loadData()
  initCharts()
})

async function loadData() {
  try {
    const res = await api.getDashboard()
    if (res.success) {
      stats.value[0].value = res.data.userCount.toLocaleString()
      stats.value[1].value = `¥${res.data.redpacketTotal.toLocaleString()}`
      stats.value[2].value = `${res.data.couponUsedCount}张`
      stats.value[3].value = `${res.data.merchantCount}家`
      latestRecords.value = res.data.latestRecords
      latestVerifies.value = res.data.latestVerifies
    }
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}

function initCharts() {
  // 折线图
  const lineChart = echarts.init(lineChartRef.value)
  lineChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['4/15', '4/16', '4/17', '4/18', '4/19', '4/20', '4/21']
    },
    yAxis: { type: 'value' },
    series: [{
      name: '领取人数',
      type: 'line',
      smooth: true,
      data: [120, 132, 101, 134, 90, 230, 210],
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64, 158, 255, 0.5)' },
          { offset: 1, color: 'rgba(64, 158, 255, 0.1)' }
        ])
      }
    }]
  })

  // 饼图
  const pieChart = echarts.init(pieChartRef.value)
  pieChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: 10000, name: '5.4元' },
        { value: 12000, name: '6.66元' },
        { value: 5000, name: '8.88元' },
        { value: 2168, name: '10元' }
      ]
    }]
  })

  // 响应式
  window.addEventListener('resize', () => {
    lineChart.resize()
    pieChart.resize()
  })
}
</script>

<style lang="scss" scoped>
.dashboard {
  .stats-row {
    margin-bottom: 20px;
  }
  
  .stat-card {
    .stat-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    
    .stat-info {
      flex: 1;
      
      .stat-value {
        font-size: 28px;
        font-weight: bold;
        color: #333;
      }
      
      .stat-label {
        font-size: 14px;
        color: #999;
        margin-top: 4px;
      }
    }
  }
  
  .charts-row {
    margin-bottom: 20px;
    
    .chart-card {
      .chart {
        height: 300px;
      }
    }
  }
  
  .amount {
    color: #E54D42;
    font-weight: bold;
  }
}
</style>
