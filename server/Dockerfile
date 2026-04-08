# 后端服务 Dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install --production

# 复制代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "src/app.js"]
