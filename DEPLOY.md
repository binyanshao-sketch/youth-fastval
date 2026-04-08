# 部署指南

## 服务器要求

- **操作系统**: Ubuntu 20.04+ / CentOS 7+
- **配置**: 2核4G以上
- **带宽**: 5Mbps以上
- **域名**: 已备案域名 + SSL证书

## 一、环境准备

### 1. 安装 Docker 和 Docker Compose

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 2. 安装 Git

```bash
apt install git -y  # Ubuntu
# 或
yum install git -y  # CentOS
```

## 二、项目部署

### 1. 克隆代码

```bash
cd /opt
git clone https://github.com/your-repo/yibin-youth-festival.git
cd yibin-youth-festival
```

### 2. 配置环境变量

```bash
cp .env.example .env
vim .env
```

填写以下配置：

```env
# 数据库
DB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_random_secret_key

# 微信小程序
WX_APPID=wx1234567890
WX_SECRET=abcdef123456

# 微信支付
WX_PAY_MCHID=123456789
WX_PAY_KEY=32位支付密钥

# 腾讯云SMS
TENCENT_SECRET_ID=your_secret_id
TENCENT_SECRET_KEY=your_secret_key
TENCENT_SMS_APP_ID=1400123456
TENCENT_SMS_TEMPLATE_ID=123456
TENCENT_SMS_SIGN=你的签名
```

说明：

- `JWT_SECRET` 需至少 24 位。
- 若以真实微信能力上线，请设置 `WX_USE_MOCK=false`，并在服务环境中补齐微信支付证书路径。
- 如需后端单独运行，也应维护 `server/.env`（可由 `server/.env.example` 拷贝）。

### 3. 上传支付证书

```bash
# 创建证书目录
mkdir -p server/certs

# 上传微信支付证书
# apiclient_cert.pem
# apiclient_key.pem
```

### 4. 配置 SSL 证书

```bash
# 创建SSL目录
mkdir -p nginx/ssl

# 上传SSL证书
# yibin-youth.com.crt
# yibin-youth.com.key
# api.yibin-youth.com.crt
# api.yibin-youth.com.key
```

### 5. 启动服务

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 查看服务状态
docker-compose ps

# 查看健康状态（需 Docker Compose v2）
docker compose ps
```

## 三、域名配置

### 1. 域名解析

添加以下DNS记录：

| 类型 | 主机记录 | 记录值 |
|------|---------|--------|
| A | @ | 服务器IP |
| A | www | 服务器IP |
| A | api | 服务器IP |

### 2. Nginx 配置

修改 `nginx/nginx.conf` 中的域名：

```nginx
server_name yibin-youth.com www.yibin-youth.com;
server_name api.yibin-youth.com;
```

## 四、微信配置

### 1. 小程序配置

- 登录微信公众平台
- 配置服务器域名：`https://api.yibin-youth.com`
- 配置业务域名：`https://yibin-youth.com`

### 2. 支付配置

- 登录微信支付商户平台
- 配置支付回调域名
- 下载商户证书

## 五、数据库初始化

```bash
# 进入MySQL容器
docker-compose exec mysql mysql -uroot -p

# 导入数据库
source /docker-entrypoint-initdb.d/init.sql

# 或手动执行
mysql -h 127.0.0.1 -uroot -p yibin_youth_festival < database/schema.sql
```

## 六、构建小程序

```bash
# 安装依赖
cd miniprogram
npm install

# 使用微信开发者工具上传代码
```

## 七、构建管理后台

```bash
# 安装依赖
cd admin
npm install

# 构建
npm run build

# 生成的dist目录会自动映射到nginx
```

## 八、监控与运维

### 1. 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f server
docker-compose logs -f nginx
```

### 2. 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart server
```

### 3. 更新代码

```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose up -d --build
```

### 4. 数据备份

```bash
# 备份数据库
docker-compose exec mysql mysqldump -uroot -p yibin_youth_festival > backup_$(date +%Y%m%d).sql

# 备份Redis
docker-compose exec redis redis-cli BGSAVE
```

## 九、安全加固

### 1. 防火墙配置

```bash
# 开放必要端口
ufw allow 80
ufw allow 443
ufw allow 22
ufw enable
```

### 2. 修改SSH端口

```bash
vim /etc/ssh/sshd_config
# 修改 Port 22 为其他端口
systemctl restart sshd
```

### 3. 定期更新

```bash
# 设置定时更新
crontab -e

# 每周日凌晨3点更新
0 3 * * 0 apt update && apt upgrade -y
```

## 十、故障排查

### 1. 服务无法启动

```bash
# 检查端口占用
netstat -tlnp | grep -E '80|443|3000|3306|6379'

# 检查容器日志
docker-compose logs
```

### 2. 数据库连接失败

```bash
# 检查MySQL状态
docker-compose ps mysql

# 检查连接
docker-compose exec server ping mysql
```

### 3. 支付失败

- 检查证书路径
- 检查商户号和密钥
- 查看支付日志

## 十一、联系支持

- 技术支持：戎琛网络
- 邮箱：support@rongchen.com
- 电话：0831-1234567
