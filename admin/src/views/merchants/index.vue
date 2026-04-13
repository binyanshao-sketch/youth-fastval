<template>
  <div class="page-stack">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h1 class="page-title">商家管理</h1>
        <p class="page-subtitle">新增、筛选并审核合作商家，支撑消费券核销链路。</p>
      </div>
      <el-button type="primary" @click="show = true">新增商家</el-button>
    </div>

    <div class="page-card" style="padding:16px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <el-input v-model="filters.name" clearable placeholder="商家名称" style="width:220px;" />
          <el-select v-model="filters.status" clearable placeholder="状态" style="width:140px;">
            <el-option label="待审核" :value="1" />
            <el-option label="已审核" :value="2" />
            <el-option label="禁用" :value="3" />
          </el-select>
        </div>
        <div style="display:flex;gap:12px;">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" @click="loadData(1)">查询</el-button>
        </div>
      </div>

      <el-table :data="list" v-loading="loading" border>
        <el-table-column prop="name" label="商家" min-width="180" />
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="contact_phone" label="电话" width="140" />
        <el-table-column prop="address" label="地址" min-width="220" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 2 ? 'success' : row.status === 1 ? 'warning' : 'danger'">
              {{ row.status === 2 ? '已审核' : row.status === 1 ? '待审核' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="row.status === 2" @click="verifyMerchant(row.id)">审核</el-button>
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

    <el-dialog v-model="show" title="新增商家" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="分类" prop="category"><el-input v-model="form.category" /></el-form-item>
        <el-form-item label="电话" prop="phone"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="联系人" prop="contactName"><el-input v-model="form.contactName" /></el-form-item>
        <el-form-item label="地址" prop="address"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="营业执照">
          <div class="license-upload">
            <el-image
              v-if="form.licenseImage"
              :src="form.licenseImage"
              fit="contain"
              style="width:120px;height:80px;border-radius:4px;border:1px solid #e4e7ed;"
            />
            <el-upload
              :show-file-list="false"
              accept="image/jpeg,image/png,image/webp"
              :before-upload="handleBeforeUpload"
              :http-request="handleUpload"
            >
              <el-button :loading="uploading" size="small" style="margin-left:8px;">
                {{ form.licenseImage ? '重新上传' : '上传图片' }}
              </el-button>
            </el-upload>
            <el-button
              v-if="form.licenseImage"
              size="small"
              type="danger"
              link
              style="margin-left:6px;"
              @click="form.licenseImage = ''"
            >删除</el-button>
          </div>
          <div class="el-form-item__error" v-if="!uploadEnabled" style="position:static;">
            上传服务未配置，可手动填写图片 URL：
            <el-input v-model="form.licenseImage" placeholder="https://..." size="small" style="margin-top:4px;" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="show = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="create">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'
import { uploadToQiniu } from '@/utils/qiniuUpload'

const loading = ref(false)
const show = ref(false)
const uploading = ref(false)
const submitting = ref(false)
const uploadEnabled = ref(true)
const formRef = ref(null)
const list = ref([])
const filters = reactive({ name: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const form = reactive({ name: '', category: '餐饮', phone: '', contactName: '', address: '', licenseImage: '' })

const rules = {
  name: [{ required: true, message: '请输入商家名称', trigger: 'blur' }],
  category: [{ required: true, message: '请输入商家分类', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  contactName: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  address: [{ required: true, message: '请输入地址', trigger: 'blur' }]
}

// 检测上传服务是否可用
async function checkUploadEnabled() {
  try {
    await api.getUploadToken('merchant/license/')
  } catch (_e) {
    uploadEnabled.value = false
  }
}

function handleBeforeUpload(file) {
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 5MB')
    return false
  }
  return true
}

async function handleUpload({ file }) {
  uploading.value = true
  try {
    const url = await uploadToQiniu(file, 'merchant/license/')
    form.licenseImage = url
    ElMessage.success('上传成功')
  } catch (error) {
    ElMessage.error(error.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function loadData(page = pagination.page) {
  pagination.page = page
  loading.value = true
  try {
    const res = await api.getMerchants({
      page: pagination.page,
      pageSize: pagination.pageSize,
      name: filters.name || undefined,
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
  filters.name = ''
  filters.status = ''
  loadData(1)
}

async function create() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = {
      name: form.name,
      category: form.category,
      phone: form.phone,
      contactName: form.contactName,
      address: form.address
    }
    if (form.licenseImage) payload.licenseImage = form.licenseImage

    const res = await api.createMerchant(payload)
    if (res.success) {
      ElMessage.success('商家创建成功')
      show.value = false
      Object.assign(form, { name: '', category: '餐饮', phone: '', contactName: '', address: '', licenseImage: '' })
      loadData()
    }
  } finally {
    submitting.value = false
  }
}

async function verifyMerchant(id) {
  const res = await api.verifyMerchant(id)
  if (res.success) {
    ElMessage.success('商家审核通过')
    loadData()
  }
}

onMounted(() => {
  loadData()
  checkUploadEnabled()
})
</script>

<style scoped>
.license-upload {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
