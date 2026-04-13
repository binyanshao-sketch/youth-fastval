# 上线与回滚手册

## 发布前
- 执行 `npm run migrate`
- 执行 `npm test`
- 执行管理端与核心接口冒烟
- 检查 `JWT_SECRET`、`DB_PASSWORD`、`REDIS_PASSWORD` 是否已更新为生产值
- 检查红包补偿任务表 `redpacket_jobs` 已创建

## 发布后
- 访问 `/health`、`/ready`
- 检查最近 15 分钟 5xx、红包失败率、Redis 连接数、MySQL 慢查询
- 检查后台配置修改是否写入审计日志

## 回滚
- 回滚到上一个镜像版本
- 恢复上一版本环境变量
- 如本次版本已执行迁移，仅允许执行兼容性迁移；禁止直接删库回滚
- 对 `redpacket_jobs` 中 `dead` 状态记录进行人工补偿
