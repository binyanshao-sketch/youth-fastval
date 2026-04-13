const GRID_MAPPING = [0, 1, 2, 7, null, 3, 6, 5, 4];

const PRIZE_PALETTE = [
  {
    background: 'linear-gradient(160deg, #0c5ea8 0%, #1286bd 100%)',
    foreground: '#f2fbff',
    shadow: 'rgba(11, 94, 168, 0.30)',
    glow: 'rgba(84, 190, 255, 0.28)'
  },
  {
    background: 'linear-gradient(160deg, #0a7b7b 0%, #15a08f 100%)',
    foreground: '#effffd',
    shadow: 'rgba(10, 123, 123, 0.28)',
    glow: 'rgba(72, 231, 204, 0.24)'
  },
  {
    background: 'linear-gradient(160deg, #0d4f88 0%, #0f6db3 100%)',
    foreground: '#eef8ff',
    shadow: 'rgba(13, 79, 136, 0.28)',
    glow: 'rgba(87, 165, 255, 0.24)'
  },
  {
    background: 'linear-gradient(160deg, #0a8d6d 0%, #28b68f 100%)',
    foreground: '#f1fffb',
    shadow: 'rgba(10, 141, 109, 0.26)',
    glow: 'rgba(71, 236, 181, 0.24)'
  }
];

function getPalette(index) {
  return PRIZE_PALETTE[index % PRIZE_PALETTE.length];
}

function sanitizeLotteryMode(mode) {
  return mode === 'grid' ? 'grid' : 'wheel';
}

function themePrize(prize, index) {
  const palette = getPalette(index);
  return {
    ...prize,
    color: palette.background,
    accent: palette.foreground,
    shadow: palette.shadow,
    glow: palette.glow
  };
}

function themePrizeCollection(prizes = []) {
  return prizes.map((prize, index) => themePrize(prize, index));
}

function normalizeLotteryConfig(config = {}) {
  return {
    activeMode: sanitizeLotteryMode(config.activeMode),
    wheel: themePrizeCollection(config.wheel || []),
    grid: themePrizeCollection(config.grid || [])
  };
}

function resolveDisplayPrizeCollection(mode, config = {}, result = null) {
  const safeMode = sanitizeLotteryMode(mode);
  const configured = config?.[safeMode];
  if (Array.isArray(configured) && configured.length) {
    return configured;
  }

  if (result?.gameType === safeMode && Array.isArray(result.board)) {
    return themePrizeCollection(result.board);
  }

  return [];
}

function getLotteryModeLabel(mode) {
  return sanitizeLotteryMode(mode) === 'grid' ? '九宫格' : '大转盘';
}

function buildWheelItems(prizes = []) {
  const themedPrizes = themePrizeCollection(prizes);
  return themedPrizes.map((item, index, list) => {
    const angle = Math.round((360 / list.length) * index);
    return {
      ...item,
      style: [
        `transform: translate(-50%, -50%) rotate(${angle}deg) translateY(-236rpx) rotate(-${angle}deg)`,
        `background: ${item.color}`,
        `color: ${item.accent}`,
        `box-shadow: 0 18rpx 36rpx ${item.shadow}`
      ].join('; ')
    };
  });
}

function buildGridCells(prizes = []) {
  const themedPrizes = themePrizeCollection(prizes);
  return GRID_MAPPING.map((prizeIndex) => {
    if (prizeIndex == null) {
      return { isCenter: true };
    }

    return {
      ...themedPrizes[prizeIndex],
      prizeIndex
    };
  });
}

function normalizeLotteryResult(result, config = {}) {
  if (!result) {
    return null;
  }

  const prizeIndex = Number.isInteger(result.prize?.index) ? result.prize.index : 0;
  const themedBoard = resolveDisplayPrizeCollection(result.gameType, config, result);
  const sourcePrize = themedBoard[prizeIndex] || {};
  const palette = getPalette(prizeIndex);

  return {
    ...result,
    board: themedBoard,
    prize: {
      ...sourcePrize,
      ...result.prize,
      color: palette.background,
      accent: palette.foreground,
      shadow: palette.shadow,
      glow: palette.glow
    }
  };
}

module.exports = {
  buildGridCells,
  buildWheelItems,
  getLotteryModeLabel,
  normalizeLotteryConfig,
  normalizeLotteryResult,
  resolveDisplayPrizeCollection,
  themePrizeCollection
};
