<template>
  <div class="page-stack">
    <div class="page-card" style="padding: 22px;">
      <div class="section-heading">
        <div>
          <h3>系统设置</h3>
          <p>维护活动时间、政策链接、消费券到期时间等全局参数。</p>
        </div>
        <div class="chip-row">
          <span :class="isActive ? 'status-pill active' : 'status-pill pending'">
            {{ isActive ? '活动开启' : '活动关闭' }}
          </span>
        </div>
      </div>

      <div class="metric-grid" style="margin-bottom: 20px;">
        <div class="metric-card">
          <span>活动开始</span>
          <strong>{{ form.activity_start_time || '-' }}</strong>
        </div>
        <div class="metric-card">
          <span>活动结束</span>
          <strong>{{ form.activity_end_time || '-' }}</strong>
        </div>
        <div class="metric-card">
          <span>消费券过期</span>
          <strong>{{ form.coupon_expire_time || '-' }}</strong>
        </div>
        <div class="metric-card">
          <span>每日上限</span>
          <strong>{{ form.daily_limit || 0 }}</strong>
        </div>
      </div>

      <el-form :model="form" label-width="140px">
        <el-form-item label="活动开始时间">
          <el-date-picker
            v-model="form.activity_start_time"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择活动开始时间"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="活动结束时间">
          <el-date-picker
            v-model="form.activity_end_time"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择活动结束时间"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="消费券过期时间">
          <el-date-picker
            v-model="form.coupon_expire_time"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择消费券过期时间"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="政策福利链接">
          <el-input v-model="form.policy_url" placeholder="结果页和政策页跳转地址" />
        </el-form-item>
        <el-form-item label="每日领取上限">
          <el-input v-model="form.daily_limit" placeholder="例如 5000" />
        </el-form-item>
        <el-form-item label="活动开关">
          <el-switch v-model="isActive" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="save">保存系统设置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="panel-grid">
      <div class="page-card" style="padding: 22px;">
        <div class="section-heading">
          <div>
            <h3>配置说明</h3>
            <p>这些配置会直接影响小程序首页、祝福海报和消费券有效期。</p>
          </div>
        </div>
        <div class="page-stack">
          <div class="soft-block">
            <strong>活动时间</strong>
            <div class="mini-note">控制首页按钮状态、倒计时和福袋领取开放时间。</div>
          </div>
          <div class="soft-block">
            <strong>政策福利链接</strong>
            <div class="mini-note">祝福海报页和政策页会复用这里的跳转地址。</div>
          </div>
          <div class="soft-block">
            <strong>每日上限与过期时间</strong>
            <div class="mini-note">领取上限影响日常流量控制，过期时间影响权益展示与核销节奏。</div>
          </div>
        </div>
      </div>

      <div class="page-card" style="padding: 22px;">
        <div class="section-heading">
          <div>
            <h3>当前配置快照</h3>
            <p>便于运营在发布前做人工复核。</p>
          </div>
        </div>
        <div class="page-stack">
          <div class="soft-block">
            <strong>政策链接</strong>
            <div class="mini-note">{{ form.policy_url || '未配置' }}</div>
          </div>
          <div class="soft-block">
            <strong>活动状态</strong>
            <div class="mini-note">{{ isActive ? '当前对用户开放领取' : '当前已对用户关闭' }}</div>
          </div>
          <div class="soft-block">
            <strong>消费券过期时间</strong>
            <div class="mini-note">{{ form.coupon_expire_time || '未配置' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const form = reactive({
  activity_start_time: '',
  activity_end_time: '',
  coupon_expire_time: '',
  policy_url: '',
  daily_limit: '',
  is_active: 'false'
})

const isActive = computed({
  get: () => form.is_active === 'true',
  set: (value) => {
    form.is_active = String(value)
  }
})

async function loadData() {
  const response = await api.getSettings()
  if (response.success) {
    Object.assign(form, response.data)
  }
}

async function save() {
  const response = await api.updateSettings(form)
  if (response.success) {
    ElMessage.success('系统设置已保存')
    loadData()
  }
}

onMounted(loadData)
</script>
