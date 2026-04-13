const app = getApp();
const {
  buildGridCells,
  buildWheelItems,
  getLotteryModeLabel,
  normalizeLotteryConfig,
  normalizeLotteryResult,
  resolveDisplayPrizeCollection
} = require('../../utils/lotteryTheme');

function vibrateShort(type = 'medium') {
  try {
    wx.vibrateShort({ type });
  } catch (error) {
    wx.vibrateShort();
  }
}

function vibrateLong() {
  try {
    wx.vibrateLong();
  } catch (error) {
    // ignore
  }
}

Page({
  data: {
    loading: true,
    pageEntered: false,
    activeMode: 'wheel',
    activeModeLabel: '大转盘',
    mode: 'wheel',
    config: {
      activeMode: 'wheel',
      wheel: [],
      grid: []
    },
    wheelItems: [],
    gridCells: [],
    wheelRotation: 0,
    wheelDuration: 0,
    gridActiveIndex: -1,
    drawing: false,
    hasDrawn: false,
    result: null
  },

  onLoad() {
    this.pageEntryTimer = setTimeout(() => {
      this.setData({ pageEntered: true });
    }, 60);
    this.bootstrap();
  },

  onUnload() {
    clearTimeout(this.pageEntryTimer);
    clearTimeout(this.gridTimer);
    clearTimeout(this.drawTimer);
  },

  async bootstrap() {
    try {
      await app.ensureLogin();
      const [config, drawn] = await Promise.all([
        app.request({ url: '/api/user/lottery/config' }),
        app.request({ url: '/api/user/lottery/my' })
      ]);

      const themedConfig = normalizeLotteryConfig(config);
      const themedResult = normalizeLotteryResult(drawn, themedConfig);
      const wheelBoard = resolveDisplayPrizeCollection('wheel', themedConfig, themedResult);
      const gridBoard = resolveDisplayPrizeCollection('grid', themedConfig, themedResult);
      const nextState = {
        loading: false,
        activeMode: themedConfig.activeMode,
        activeModeLabel: getLotteryModeLabel(themedConfig.activeMode),
        mode: themedResult?.gameType || themedConfig.activeMode,
        config: themedConfig,
        wheelItems: buildWheelItems(wheelBoard),
        gridCells: buildGridCells(gridBoard)
      };

      if (themedResult) {
        app.saveLotterySnapshot(themedResult);
        nextState.mode = themedResult.gameType;
        nextState.hasDrawn = true;
        nextState.result = themedResult;
        nextState.gridActiveIndex = themedResult.gameType === 'grid' ? themedResult.prize.index : -1;
        nextState.wheelRotation = themedResult.gameType === 'wheel'
          ? this.getWheelTargetRotation(themedResult.prize.index, wheelBoard.length)
          : 0;
      }

      this.setData(nextState);
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '抽奖页加载失败',
        icon: 'none'
      });
    }
  },

  getWheelTargetRotation(prizeIndex, count) {
    const segment = 360 / count;
    return 360 - (prizeIndex * segment);
  },

  async onDraw() {
    if (this.data.drawing) {
      return;
    }

    if (this.data.hasDrawn) {
      wx.showToast({
        title: '你已经完成抽奖',
        icon: 'none'
      });
      return;
    }

    vibrateShort('medium');
    this.setData({ drawing: true });

    try {
      const result = await app.request({
        url: '/api/user/lottery/draw',
        method: 'POST',
        data: {
          gameType: this.data.activeMode
        }
      });
      const themedResult = normalizeLotteryResult(result, this.data.config);

      if (themedResult.gameType === 'wheel') {
        this.playWheel(themedResult);
      } else {
        this.playGrid(themedResult);
      }
    } catch (error) {
      this.setData({ drawing: false });
      wx.showToast({
        title: error.message || '抽奖失败',
        icon: 'none'
      });
    }
  },

  playWheel(result) {
    clearTimeout(this.drawTimer);
    const wheelBoard = resolveDisplayPrizeCollection('wheel', this.data.config, result);
    const extraTurns = 360 * 6;
    const rotation = this.data.wheelRotation + extraTurns
      + this.getWheelTargetRotation(result.prize.index, wheelBoard.length);

    this.setData({
      wheelDuration: 4200,
      wheelRotation: rotation
    });

    this.drawTimer = setTimeout(() => {
      this.finishDraw(result);
    }, 4300);
  },

  playGrid(result) {
    clearTimeout(this.gridTimer);
    const gridBoard = resolveDisplayPrizeCollection('grid', this.data.config, result);
    const totalSteps = gridBoard.length * 4 + result.prize.index;
    let step = 0;

    const tick = () => {
      this.setData({
        gridActiveIndex: step % gridBoard.length
      });

      if (step >= totalSteps) {
        this.finishDraw(result);
        return;
      }

      step += 1;
      const remain = totalSteps - step;
      const delay = remain < 6 ? 180 + (6 - remain) * 70 : 90;
      this.gridTimer = setTimeout(tick, delay);
    };

    tick();
  },

  finishDraw(result) {
    clearTimeout(this.gridTimer);
    clearTimeout(this.drawTimer);
    vibrateLong();

    app.saveLotterySnapshot(result);

    this.setData({
      drawing: false,
      hasDrawn: true,
      mode: result.gameType,
      result,
      gridActiveIndex: result.gameType === 'grid' ? result.prize.index : -1,
      wheelRotation: result.gameType === 'wheel'
        ? this.getWheelTargetRotation(
          result.prize.index,
          resolveDisplayPrizeCollection('wheel', this.data.config, result).length
        )
        : this.data.wheelRotation,
      wheelDuration: result.gameType === 'wheel' ? 0 : this.data.wheelDuration
    });
  },

  goToPoster() {
    wx.navigateTo({ url: '/pages/lucky-bag/result' });
  }
});
