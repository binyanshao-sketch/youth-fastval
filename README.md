# 共青团宜宾市委"五四"青春福袋系统

## 项目简介

本项目为共青团宜宾市委2026年"五四"青年节青春福袋活动的配套软件系统，支持：
- 🎁 线上福袋发放（现金红包 + 消费券 + 政策福利）
- 💰 微信红包即时提现
- 🎫 消费券核销管理
- 📊 实时数据统计分析

## 技术栈

- **后端**: Node.js + Express + MySQL + Redis
- **前端**: 微信小程序原生 + Vue 3
- **支付**: 微信支付（企业付款到零钱）
- **云服务**: 腾讯云

## 项目结构

```
yibin-youth-festival/
├── miniprogram/          # 微信小程序
├── admin/                # 管理后台（Vue 3）
├── server/               # 后端服务
│   ├── src/
│   │   ├── models/       # 数据模型
│   │   ├── routes/       # API路由
│   │   ├── services/     # 业务服务
│   │   ├── middleware/   # 中间件
│   │   └── app.js        # 应用入口
│   └── package.json
├── database/             # 数据库脚本
│   └── schema.sql
└── docs/                 # 文档
```

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

```bash
cp server/.env.example server/.env
# 编辑 server/.env 文件，填写数据库、Redis、微信等配置
```

生产部署（Docker Compose）请使用根目录环境文件：

```bash
cp .env.example .env
# 编辑根目录 .env，填写 DB_PASSWORD/JWT_SECRET/微信与短信配置
```

### 3. 初始化数据库

```bash
mysql -u root -p < database/schema.sql
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 5. 启动管理后台

```bash
cd admin
npm install
npm run dev
```

生产构建：

```bash
cd admin
npm run build
```

### 6. 后台联调冒烟

```bash
cd server

# 默认只读，不会修改业务数据
npm run smoke:admin

# 全量模式，会执行创建商家、创建消费券、更新配置等写操作
# 并在脚本结束时自动回滚系统配置、停用测试消费券、回退测试商家状态
npm run smoke:admin:full
```

## API 文档

### 用户端接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/user/login` | POST | 微信登录 |
| `/api/user/bindPhone` | POST | 绑定手机号 |
| `/api/luckyBag/receive` | POST | 领取福袋 |
| `/api/luckyBag/my` | GET | 获取我的福袋 |
| `/api/redpacket/withdraw` | POST | 提现红包 |
| `/api/coupons/my` | GET | 获取我的消费券 |
| `/api/coupon/:id/qrcode` | GET | 获取核销码 |
| `/api/merchants/nearby` | GET | 获取附近商家 |

### 商家端接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/merchant/login` | POST | 商家登录 |
| `/api/merchant/verify` | POST | 核销消费券 |
| `/api/merchant/records` | GET | 核销记录 |
| `/api/merchant/statistics` | GET | 核销统计 |

### 管理后台接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/dashboard` | GET | 数据概览 |
| `/api/admin/users` | GET | 用户列表 |
| `/api/admin/merchants` | GET | 商家列表 |
| `/api/admin/coupons` | GET | 消费券管理 |
| `/api/admin/statistics` | GET | 统计报表 |

## 核心功能

### 1. 红包随机分配算法

采用基于库存和权重的双重控制算法：
- Redis原子操作保证不超发
- 加权随机分配，保证公平性
- 实时库存监控预警

### 2. 防刷机制

- 微信openid + 手机号双重绑定
- IP限流 + 行为风控
- 图形验证码

### 3. 高并发处理

- Redis缓存热点数据
- 消息队列削峰
- 服务降级保护

## 部署说明

### 服务器要求

- Node.js >= 18.0
- MySQL 8.0
- Redis 7.0
- 2核4G以上

### 部署步骤

1. 安装Node.js、MySQL、Redis
2. 克隆代码，安装依赖
3. 导入数据库脚本
4. 配置环境变量
5. 配置微信支付证书
6. 启动服务

### 推荐配置

- 使用PM2管理Node进程
- Nginx反向代理
- SSL证书配置HTTPS

### 上线前必检

- `NODE_ENV=production` 时必须配置 `DB_*`、`REDIS_*`、`JWT_SECRET`、`CORS_ORIGINS`。
- `JWT_SECRET` 长度需至少 24 位。
- 生产环境建议 `WX_USE_MOCK=false`，并配置真实微信参数与证书。
- 容器健康探针：后端使用 `/ready`，Nginx 使用 `/health`。


## 许可证

本项目为共青团宜宾市委定制开发，版权归属戎琛网络。
