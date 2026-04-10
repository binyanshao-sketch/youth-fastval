/**
 * 管理员操作日志服务
 */

class AdminLogService {
  constructor(models) {
    this.models = models;
  }

  /**
   * 记录管理员操作
   */
  async log(adminId, action, target, detail, ip) {
    await this.models.AdminLog.create({
      admin_id: adminId,
      action,
      target: target || null,
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
      ip: ip || null
    });
  }

  /**
   * 查询操作日志（分页）
   */
  async getRecords(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;

    const { count, rows } = await this.models.AdminLog.findAndCountAll({
      include: [{
        model: this.models.Admin,
        as: 'admin',
        attributes: ['username', 'name']
      }],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset
    });

    return {
      list: rows.map(item => ({
        id: item.id,
        action: item.action,
        operator: item.admin?.name || item.admin?.username || '-',
        target: item.target,
        detail: item.detail,
        ip: item.ip,
        createdAt: item.created_at
      })),
      total: count,
      page,
      pageSize
    };
  }
}

module.exports = AdminLogService;
