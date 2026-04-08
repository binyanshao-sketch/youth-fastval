/**
 * 红包随机分配算法
 * 基于库存和权重的双重控制
 */

const Redis = require('ioredis');

class RedPacketAllocator {
  constructor(redisClient) {
    this.redis = redisClient;
    this.poolKey = 'redpacket:pool';
    this.lockKey = 'redpacket:lock';
  }

  /**
   * 初始化红包池到Redis
   * @param {Array} poolConfig 红包配置
   */
  async initPool(poolConfig) {
    // 清空旧数据
    await this.redis.del(this.poolKey);
    
    // 写入新配置
    for (const item of poolConfig) {
      // 使用有序集合存储，score为库存
      await this.redis.hset(this.poolKey, item.amount, JSON.stringify({
        total: item.total_count,
        used: 0,
        weight: item.weight,
        blessing: item.blessing
      }));
    }
    
    return true;
  }

  async hasPool() {
    const poolSize = await this.redis.hlen(this.poolKey);
    return poolSize > 0;
  }

  /**
   * 分配红包（原子操作）
   * @returns {Object} { amount, blessing } 或 null
   */
  async allocate() {
    // 使用Redis Lua脚本保证原子性
    const luaScript = `
      local poolKey = KEYS[1]
      local lockKey = KEYS[2]
      
      -- 尝试获取分布式锁
      local lockAcquired = redis.call('SET', lockKey, '1', 'NX', 'EX', 5)
      if not lockAcquired then
        return {err = 'LOCK_FAILED'}
      end
      
      -- 获取所有红包配置
      local pool = redis.call('HGETALL', poolKey)
      if not pool or #pool == 0 then
        redis.call('DEL', lockKey)
        return {err = 'POOL_EMPTY'}
      end
      
      -- 构建可用红包列表（有库存的）
      local available = {}
      for i = 1, #pool, 2 do
        local amount = pool[i]
        local config = cjson.decode(pool[i + 1])
        if config.used < config.total then
          table.insert(available, {
            amount = amount,
            config = config,
            score = config.weight * (config.total - config.used)
          })
        end
      end
      
      if #available == 0 then
        redis.call('DEL', lockKey)
        return {err = 'NO_STOCK'}
      end
      
      -- 加权随机选择
      local totalScore = 0
      for _, item in ipairs(available) do
        totalScore = totalScore + item.score
      end
      
      local random = math.random() * totalScore
      local accumulated = 0
      local selected = nil
      
      for _, item in ipairs(available) do
        accumulated = accumulated + item.score
        if random <= accumulated then
          selected = item
          break
        end
      end
      
      -- 扣减库存
      selected.config.used = selected.config.used + 1
      redis.call('HSET', poolKey, selected.amount, cjson.encode(selected.config))
      
      -- 释放锁
      redis.call('DEL', lockKey)
      
      return {amount = selected.amount, blessing = selected.config.blessing}
    `;
    
    const result = await this.redis.eval(
      luaScript,
      2,
      this.poolKey,
      this.lockKey
    );
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return {
      amount: parseFloat(result.amount),
      blessing: result.blessing
    };
  }

  /**
   * 获取红包池状态
   */
  async getPoolStatus() {
    const pool = await this.redis.hgetall(this.poolKey);
    const status = [];
    
    for (const [amount, configStr] of Object.entries(pool)) {
      const config = JSON.parse(configStr);
      status.push({
        amount: parseFloat(amount),
        total: config.total,
        used: config.used,
        remaining: config.total - config.used,
        weight: config.weight
      });
    }
    
    return status;
  }

  /**
   * 检查库存是否充足
   */
  async hasStock() {
    const status = await this.getPoolStatus();
    return status.some(item => item.remaining > 0);
  }
}

module.exports = RedPacketAllocator;
