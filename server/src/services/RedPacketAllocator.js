/**
 * 红包随机分配算法
 * 基于 Redis Lua 脚本的原子操作，无需分布式锁
 * Lua 脚本在 Redis 中是单线程原子执行的，天然防并发
 */

class RedPacketAllocator {
  constructor(redisClient) {
    this.redis = redisClient;
    this.poolKey = 'redpacket:pool';
    this.statsKey = 'redpacket:stats';
  }

  isRedisMockMode() {
    return process.env.REDIS_MOCK === 'true';
  }

  /**
   * 初始化红包池到Redis
   * @param {Array} poolConfig 红包配置
   */
  async initPool(poolConfig) {
    const pipeline = this.redis.pipeline();
    pipeline.del(this.poolKey);
    pipeline.del(this.statsKey);
    let totalAllocated = 0;
    let totalAmount = 0;

    for (const item of poolConfig) {
      const usedCount = Number(item.used_count || 0);
      const amountNumber = Number(item.amount || 0);
      totalAllocated += usedCount;
      if (Number.isFinite(amountNumber)) {
        totalAmount += amountNumber * usedCount;
      }
      pipeline.hset(this.poolKey, item.amount, JSON.stringify({
        total: item.total_count,
        used: usedCount,
        weight: item.weight,
        blessing: item.blessing
      }));
    }

    pipeline.hset(this.statsKey, {
      total_allocated: String(totalAllocated),
      total_amount: Number(totalAmount.toFixed(2))
    });

    const results = await pipeline.exec();
    for (const [err] of results) {
      if (err) {
        throw new Error(`红包池初始化失败: ${err.message}`);
      }
    }
    return true;
  }

  async hasPool() {
    const poolSize = await this.redis.hlen(this.poolKey);
    return poolSize > 0;
  }

  /**
   * 分配红包（Lua 原子操作，无需分布式锁）
   * Lua 在 Redis 中单线程执行，天然保证原子性
   * @returns {Object} { amount, blessing }
   */
  async allocate() {
    if (this.isRedisMockMode()) {
      return this.allocateWithMock();
    }

    // Lua 脚本：原子性加权随机分配 + 库存扣减
    const luaScript = `
      local poolKey = KEYS[1]
      local randSeed = tonumber(ARGV[1])

      -- 获取所有红包配置
      local pool = redis.call('HGETALL', poolKey)
      if not pool or #pool == 0 then
        return redis.error('POOL_EMPTY')
      end

      -- 构建可用红包列表（有库存的）
      local available = {}
      local totalScore = 0
      for i = 1, #pool, 2 do
        local amount = pool[i]
        local config = cjson.decode(pool[i + 1])
        local remaining = config.total - config.used
        if remaining > 0 then
          local score = config.weight * remaining
          totalScore = totalScore + score
          table.insert(available, {
            amount = amount,
            config = config,
            score = score
          })
        end
      end

      if #available == 0 then
        return redis.error('NO_STOCK')
      end

      -- 加权随机选择（使用外部传入的随机种子）
      local random = (randSeed % 10000) / 10000 * totalScore
      local accumulated = 0
      local selected = available[1]

      for _, item in ipairs(available) do
        accumulated = accumulated + item.score
        if random <= accumulated then
          selected = item
          break
        end
      end

      -- 原子扣减库存
      selected.config.used = selected.config.used + 1
      redis.call('HSET', poolKey, selected.amount, cjson.encode(selected.config))

      -- 更新统计计数器
      redis.call('HINCRBY', KEYS[2], 'total_allocated', 1)
      redis.call('HINCRBYFLOAT', KEYS[2], 'total_amount', tonumber(selected.amount))

      return {selected.amount, selected.config.blessing}
    `;

    // 使用 crypto 生成安全随机种子
    const crypto = require('crypto');
    const randSeed = crypto.randomInt(0, 10000000);

    const result = await this.redis.eval(
      luaScript,
      2,
      this.poolKey,
      this.statsKey,
      randSeed
    );

    const amountKey = String(result[0]);
    return {
      amount: parseFloat(amountKey),
      amountKey,
      blessing: result[1]
    };
  }

  /**
   * 回补红包库存（用于业务事务失败后的补偿）
   * @param {string|number} amount 红包面额键
   */
  async release(amount) {
    if (this.isRedisMockMode()) {
      return this.releaseWithMock(amount);
    }

    const amountKey = String(amount);
    const amountNumber = Number(amountKey);
    if (!Number.isFinite(amountNumber)) {
      throw new Error('INVALID_AMOUNT');
    }

    const luaScript = `
      local poolKey = KEYS[1]
      local statsKey = KEYS[2]
      local amountKey = ARGV[1]
      local amountValue = tonumber(ARGV[2])

      local configStr = redis.call('HGET', poolKey, amountKey)
      if not configStr then
        return redis.error_reply('AMOUNT_NOT_FOUND')
      end

      local config = cjson.decode(configStr)
      if tonumber(config.used or 0) <= 0 then
        return redis.error_reply('USED_EMPTY')
      end

      config.used = config.used - 1
      redis.call('HSET', poolKey, amountKey, cjson.encode(config))

      local totalAllocated = tonumber(redis.call('HGET', statsKey, 'total_allocated') or '0')
      if totalAllocated > 0 then
        redis.call('HINCRBY', statsKey, 'total_allocated', -1)
      end

      local totalAmount = tonumber(redis.call('HGET', statsKey, 'total_amount') or '0')
      if totalAmount >= amountValue then
        redis.call('HINCRBYFLOAT', statsKey, 'total_amount', -amountValue)
      else
        redis.call('HSET', statsKey, 'total_amount', 0)
      end

      return 1
    `;

    await this.redis.eval(
      luaScript,
      2,
      this.poolKey,
      this.statsKey,
      amountKey,
      amountNumber
    );
    return true;
  }

  async allocateWithMock() {
    const pool = await this.redis.hgetall(this.poolKey);
    const available = [];
    let totalScore = 0;

    for (const [amount, configStr] of Object.entries(pool)) {
      const config = JSON.parse(configStr);
      const remaining = Number(config.total) - Number(config.used || 0);
      if (remaining <= 0) {
        continue;
      }

      const score = Number(config.weight || 1) * remaining;
      totalScore += score;
      available.push({ amount, config, score });
    }

    if (available.length === 0 || totalScore <= 0) {
      throw new Error('NO_STOCK');
    }

    const random = Math.random() * totalScore;
    let cursor = 0;
    let selected = available[0];
    for (const item of available) {
      cursor += item.score;
      if (random <= cursor) {
        selected = item;
        break;
      }
    }

    selected.config.used = Number(selected.config.used || 0) + 1;
    await this.redis.hset(this.poolKey, selected.amount, JSON.stringify(selected.config));
    await this.redis.hincrby(this.statsKey, 'total_allocated', 1);
    await this.redis.hincrbyfloat(this.statsKey, 'total_amount', Number(selected.amount));

    return {
      amount: parseFloat(selected.amount),
      amountKey: String(selected.amount),
      blessing: selected.config.blessing
    };
  }

  async releaseWithMock(amount) {
    const amountKey = String(amount);
    const amountNumber = Number(amountKey);
    if (!Number.isFinite(amountNumber)) {
      throw new Error('INVALID_AMOUNT');
    }

    const configStr = await this.redis.hget(this.poolKey, amountKey);
    if (!configStr) {
      throw new Error('AMOUNT_NOT_FOUND');
    }

    const config = JSON.parse(configStr);
    if (Number(config.used || 0) <= 0) {
      throw new Error('USED_EMPTY');
    }

    config.used = Number(config.used) - 1;
    await this.redis.hset(this.poolKey, amountKey, JSON.stringify(config));

    const totalAllocated = Number(await this.redis.hget(this.statsKey, 'total_allocated') || '0');
    if (totalAllocated > 0) {
      await this.redis.hincrby(this.statsKey, 'total_allocated', -1);
    }

    const totalAmount = Number(await this.redis.hget(this.statsKey, 'total_amount') || '0');
    if (totalAmount >= amountNumber) {
      await this.redis.hincrbyfloat(this.statsKey, 'total_amount', -amountNumber);
    } else {
      await this.redis.hset(this.statsKey, 'total_amount', 0);
    }

    return true;
  }

  /**
   * 获取红包池状态
   */
  async getPoolStatus() {
    const pool = await this.redis.hgetall(this.poolKey);
    const status = [];

    for (const [amount, configStr] of Object.entries(pool)) {
      try {
        const config = JSON.parse(configStr);
        status.push({
          amount: parseFloat(amount),
          total: config.total,
          used: config.used,
          remaining: config.total - config.used,
          weight: config.weight
        });
      } catch {
        status.push({
          amount: parseFloat(amount),
          total: 0,
          used: 0,
          remaining: 0,
          weight: 0,
          error: '数据解析失败'
        });
      }
    }

    return status;
  }

  /**
   * 检查库存是否充足（使用 Lua 原子检查避免多次网络往返）
   */
  async hasStock() {
    if (this.isRedisMockMode()) {
      const pool = await this.redis.hgetall(this.poolKey);
      return Object.values(pool).some((configStr) => {
        const config = JSON.parse(configStr);
        return Number(config.used || 0) < Number(config.total || 0);
      });
    }

    const luaScript = `
      local pool = redis.call('HGETALL', KEYS[1])
      if not pool or #pool == 0 then
        return 0
      end
      for i = 1, #pool, 2 do
        local config = cjson.decode(pool[i + 1])
        if config.used < config.total then
          return 1
        end
      end
      return 0
    `;

    const result = await this.redis.eval(luaScript, 1, this.poolKey);
    return result === 1;
  }

  /**
   * 获取分配统计
   */
  async getStats() {
    const stats = await this.redis.hgetall(this.statsKey);
    return {
      totalAllocated: parseInt(stats.total_allocated || '0'),
      totalAmount: parseFloat(stats.total_amount || '0')
    };
  }
}

module.exports = RedPacketAllocator;
