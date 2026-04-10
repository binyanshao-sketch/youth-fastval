const LotteryService = require('../src/services/LotteryService');

describe('LotteryService', () => {
  function createService(overrides = {}) {
    const models = {
      LuckyBagRecord: {
        findOne: jest.fn().mockResolvedValue({ id: 1, user_id: 1 })
      },
      LotteryRecord: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn()
      },
      ...overrides
    };

    return {
      service: new LotteryService(models),
      models
    };
  }

  test('draw stores the weighted prize selected on the server', async () => {
    const record = {
      game_type: 'wheel',
      board_key: 'merchant-pack',
      prize_name: 'Merchant Pack',
      prize_level: 'hot',
      prize_type: 'benefit',
      prize_value: 'value',
      poster_title: 'title',
      poster_message: 'message',
      created_at: new Date().toISOString()
    };
    const { service, models } = createService();

    jest.spyOn(service, 'drawWeightedPrize').mockReturnValue({
      key: 'merchant-pack',
      label: 'Merchant Pack',
      level: 'hot',
      type: 'benefit',
      value: 'value',
      posterTitle: 'title',
      posterMessage: 'message'
    });
    models.LotteryRecord.create.mockResolvedValue(record);

    const result = await service.draw(1, 'wheel');

    expect(service.drawWeightedPrize).toHaveBeenCalledWith('wheel');
    expect(models.LotteryRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 1,
      game_type: 'wheel',
      board_key: 'merchant-pack'
    }));
    expect(result.prize.key).toBe('merchant-pack');
  });

  test('draw returns an existing record without creating a new one', async () => {
    const existingRecord = {
      game_type: 'grid',
      board_key: 'good-luck',
      prize_name: 'Good Luck',
      prize_level: 'basic',
      prize_type: 'encouragement',
      prize_value: 'value',
      poster_title: 'title',
      poster_message: 'message',
      created_at: new Date().toISOString()
    };
    const { service, models } = createService({
      LotteryRecord: {
        findOne: jest.fn().mockResolvedValue(existingRecord),
        create: jest.fn()
      }
    });

    const result = await service.draw(2, 'grid');

    expect(models.LotteryRecord.create).not.toHaveBeenCalled();
    expect(result.prize.key).toBe('good-luck');
  });
});
