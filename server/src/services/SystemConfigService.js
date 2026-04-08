/**
 * 系统配置服务
 */

// 允许前端修改的配置键白名单
const ALLOWED_CONFIG_KEYS = new Set([
  'activity_start_time',
  'activity_end_time',
  'coupon_expire_time',
  'policy_url',
  'daily_limit',
  'is_active'
]);

class SystemConfigService {
  constructor(models) {
    this.models = models;
  }

  async getConfigMap() {
    const configList = await this.models.SystemConfig.findAll({
      order: [['config_key', 'ASC']]
    });
    return configList.reduce((acc, item) => {
      acc[item.config_key] = item.config_value;
      return acc;
    }, {});
  }

  /**
   * 安全更新配置（仅白名单内的键）
   */
  async updateConfig(entries) {
    const keys = Object.keys(entries);
    const rejected = keys.filter(k => !ALLOWED_CONFIG_KEYS.has(k));
    if (rejected.length > 0) {
      throw new Error(`不允许修改的配置项: ${rejected.join(', ')}`);
    }

    for (const key of keys) {
      await this.models.SystemConfig.upsert({
        config_key: key,
        config_value: String(entries[key] ?? '')
      });
    }
  }
}

module.exports = SystemConfigService;
module.exports.ALLOWED_CONFIG_KEYS = ALLOWED_CONFIG_KEYS;
