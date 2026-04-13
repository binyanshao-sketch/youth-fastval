const { UniqueConstraintError } = require('sequelize');
const crypto = require('crypto');
const logger = require('../utils/logger');

const BOARD_CONFIG = {
  wheel: [
    {
      key: 'youth-map',
      label: '青年地图包',
      shortLabel: '地图包',
      level: '精选',
      type: 'digital',
      value: '热门商圈与政策点位合集',
      posterTitle: '抽中青年地图包',
      posterMessage: '带上这份城市青年地图，继续解锁下一站惊喜。',
      color: '#ffede2',
      accent: '#d14a1f',
      weight: 26
    },
    {
      key: 'merchant-pack',
      label: '商家优享包',
      shortLabel: '优享包',
      level: '热门',
      type: 'benefit',
      value: '优享商家推荐清单',
      posterTitle: '抽中商家优享包',
      posterMessage: '恭喜你获得本地青年消费优享推荐。',
      color: '#fff5cf',
      accent: '#bb7b06',
      weight: 20
    },
    {
      key: 'poster-card',
      label: '限定祝福海报',
      shortLabel: '祝福海报',
      level: '氛围',
      type: 'poster',
      value: '五四纪念电子海报',
      posterTitle: '抽中限定祝福海报',
      posterMessage: '把这份五四青春海报分享给朋友，一起接好运。',
      color: '#ffe4ea',
      accent: '#cb3e6a',
      weight: 16
    },
    {
      key: 'policy-pass',
      label: '政策直通卡',
      shortLabel: '直通卡',
      level: '实用',
      type: 'guide',
      value: '青年政策导航清单',
      posterTitle: '抽中政策直通卡',
      posterMessage: '青年扶持政策已为你整理好，随时查看即可。',
      color: '#e3f6ff',
      accent: '#167ca5',
      weight: 18
    },
    {
      key: 'campus-note',
      label: '青春手账签',
      shortLabel: '手账签',
      level: '惊喜',
      type: 'gift',
      value: '青年节纪念签文',
      posterTitle: '抽中青春手账签',
      posterMessage: '把今天的好运签收起来，下一次打开仍会发光。',
      color: '#efe6ff',
      accent: '#6e42be',
      weight: 12
    },
    {
      key: 'thank-you',
      label: '再接再厉',
      shortLabel: '好运签',
      level: '基础',
      type: 'encouragement',
      value: '收下今日鼓励签',
      posterTitle: '收下今日好运签',
      posterMessage: '青春没有空手而归，你已经领取了今天的第一份好运。',
      color: '#f4f4f4',
      accent: '#5b5b5b',
      weight: 8
    }
  ],
  grid: [
    {
      key: 'city-route',
      label: '城市探索线',
      shortLabel: '探索线',
      level: '精选',
      type: 'route',
      value: '青年城市探索路线',
      posterTitle: '抽中城市探索线',
      posterMessage: '从青年商圈到政策打卡点，路线已经帮你规划好。',
      color: '#fff0df',
      accent: '#ce5d18',
      weight: 18
    },
    {
      key: 'flash-benefit',
      label: '闪享权益卡',
      shortLabel: '权益卡',
      level: '热门',
      type: 'benefit',
      value: '权益卡片展示',
      posterTitle: '抽中闪享权益卡',
      posterMessage: '你的青年权益卡已解锁，可在页面中继续查看权益内容。',
      color: '#fff8d9',
      accent: '#be8607',
      weight: 17
    },
    {
      key: 'energy-quote',
      label: '能量金句',
      shortLabel: '金句',
      level: '氛围',
      type: 'poster',
      value: '青春金句海报',
      posterTitle: '抽中青春能量金句',
      posterMessage: '送你一句今天最该被听见的话，继续向前就对了。',
      color: '#ffe6ef',
      accent: '#c23763',
      weight: 12
    },
    {
      key: 'merchant-route',
      label: '吃喝玩乐单',
      shortLabel: '玩乐单',
      level: '实用',
      type: 'guide',
      value: '热门商家推荐',
      posterTitle: '抽中吃喝玩乐单',
      posterMessage: '吃喝玩乐推荐清单已送达，周末安排起来。',
      color: '#e7fff2',
      accent: '#178a4c',
      weight: 15
    },
    {
      key: 'youth-badge',
      label: '青春徽章',
      shortLabel: '徽章',
      level: '惊喜',
      type: 'badge',
      value: '页面纪念徽章',
      posterTitle: '抽中青春徽章',
      posterMessage: '今天的好运已经盖章，愿你保持热爱与锋芒。',
      color: '#e7f2ff',
      accent: '#2f6db0',
      weight: 10
    },
    {
      key: 'friends-share',
      label: '分享好运',
      shortLabel: '分享',
      level: '互动',
      type: 'share',
      value: '邀请好友继续领福袋',
      posterTitle: '抽中分享好运卡',
      posterMessage: '把好运继续传递给朋友，一起参与青年节惊喜。',
      color: '#f3ecff',
      accent: '#7a45c4',
      weight: 10
    },
    {
      key: 'poster-ticket',
      label: '节日票根',
      shortLabel: '票根',
      level: '纪念',
      type: 'poster',
      value: '五四纪念票根海报',
      posterTitle: '抽中节日票根',
      posterMessage: '这张票根记录了你今天拆开的青春好运。',
      color: '#fff3f3',
      accent: '#b94242',
      weight: 10
    },
    {
      key: 'good-luck',
      label: '好运常在',
      shortLabel: '好运',
      level: '基础',
      type: 'encouragement',
      value: '好运提示卡',
      posterTitle: '收下好运提示卡',
      posterMessage: '好运已经在路上，下一份惊喜会更快到来。',
      color: '#f4f4f4',
      accent: '#4c4c4c',
      weight: 8
    }
  ]
};

const DEFAULT_GAME_TYPE = 'wheel';
const VALID_GAME_TYPES = Object.keys(BOARD_CONFIG);

class LotteryService {
  constructor(models) {
    this.models = models;
  }

  formatBoard(gameType) {
    return (BOARD_CONFIG[gameType] || []).map((item, index) => ({
      key: item.key,
      label: item.label,
      shortLabel: item.shortLabel,
      level: item.level,
      type: item.type,
      value: item.value,
      color: item.color,
      accent: item.accent,
      index
    }));
  }

  getConfig() {
    return VALID_GAME_TYPES.reduce((result, key) => {
      result[key] = this.formatBoard(key);
      return result;
    }, {});
  }

  async getActiveMode() {
    const config = await this.models.SystemConfig.findOne({
      where: { config_key: 'lottery_mode' },
      attributes: ['config_value']
    });

    const mode = String(config?.config_value || '').trim();
    return VALID_GAME_TYPES.includes(mode) ? mode : DEFAULT_GAME_TYPE;
  }

  async getClientConfig() {
    const activeMode = await this.getActiveMode();
    return {
      activeMode,
      wheel: activeMode === 'wheel' ? this.formatBoard('wheel') : [],
      grid: activeMode === 'grid' ? this.formatBoard('grid') : []
    };
  }

  resolvePrize(gameType, boardKey) {
    return BOARD_CONFIG[gameType]?.find((item) => item.key === boardKey) || null;
  }

  resolveIndex(gameType, boardKey) {
    return BOARD_CONFIG[gameType]?.findIndex((item) => item.key === boardKey) ?? -1;
  }

  drawWeightedPrize(gameType) {
    const pool = BOARD_CONFIG[gameType] || [];
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let random = crypto.randomInt(0, total);

    for (const item of pool) {
      random -= item.weight;
      if (random <= 0) {
        return item;
      }
    }

    return pool[pool.length - 1];
  }

  async ensureEligible(userId) {
    const record = await this.models.LuckyBagRecord.findOne({
      where: { user_id: userId }
    });

    if (!record) {
      throw new Error('请先领取青春福袋，再进入抽奖页面。');
    }
  }

  formatRecord(record) {
    const prize = this.resolvePrize(record.game_type, record.board_key);
    const board = this.formatBoard(record.game_type);

    return {
      hasDrawn: true,
      gameType: record.game_type,
      drawnAt: record.created_at,
      board,
      prize: {
        key: record.board_key,
        name: record.prize_name,
        level: record.prize_level,
        type: record.prize_type,
        value: record.prize_value,
        posterTitle: record.poster_title,
        posterMessage: record.poster_message,
        index: this.resolveIndex(record.game_type, record.board_key),
        color: prize?.color || '#fff5ef',
        accent: prize?.accent || '#d14a1f'
      }
    };
  }

  async getUserLottery(userId) {
    const record = await this.models.LotteryRecord.findOne({
      where: { user_id: userId }
    });

    if (!record) {
      return null;
    }

    return this.formatRecord(record);
  }

  async draw(userId, gameType) {
    await this.ensureEligible(userId);

    const existing = await this.models.LotteryRecord.findOne({
      where: { user_id: userId }
    });

    if (existing) {
      return this.formatRecord(existing);
    }

    const activeMode = await this.getActiveMode();
    if (gameType && gameType !== activeMode) {
      throw new Error(activeMode === 'grid'
        ? '\u5f53\u524d\u4ec5\u5f00\u653e\u4e5d\u5bab\u683c\u62bd\u5956'
        : '\u5f53\u524d\u4ec5\u5f00\u653e\u5927\u8f6c\u76d8\u62bd\u5956');
    }

    const pool = BOARD_CONFIG[activeMode];
    if (!pool) {
      throw new Error('\u4e0d\u652f\u6301\u7684\u62bd\u5956\u73a9\u6cd5');
    }

    const prize = this.drawWeightedPrize(activeMode);
    if (!prize) {
      throw new Error('\u65e0\u6cd5\u751f\u6210\u62bd\u5956\u7ed3\u679c');
    }

    try {
      const record = await this.models.LotteryRecord.create({
        user_id: userId,
        game_type: activeMode,
        board_key: prize.key,
        prize_name: prize.label,
        prize_level: prize.level,
        prize_type: prize.type,
        prize_value: prize.value,
        poster_title: prize.posterTitle,
        poster_message: prize.posterMessage
      });

      logger.info('lottery draw created', {
        userId,
        gameType: activeMode,
        boardKey: prize.key
      });

      return this.formatRecord(record);
    } catch (error) {
      // ??????? findOne ???????? create?
      // ???????????????????????
      if (error instanceof UniqueConstraintError) {
        const existingRecord = await this.models.LotteryRecord.findOne({
          where: { user_id: userId }
        });
        if (!existingRecord) {
          throw new Error('抽奖记录异常，请稍后重试');
        }
        return this.formatRecord(existingRecord);
      }
      throw error;
    }
  }
}

module.exports = LotteryService;
