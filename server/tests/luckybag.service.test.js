const LuckyBagService = require('../src/services/LuckyBagService');

function createServiceFixture() {
  const transaction = {
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined)
  };

  const models = {
    sequelize: {
      transaction: jest.fn().mockResolvedValue(transaction)
    },
    RedPacketPool: {
      increment: jest.fn().mockResolvedValue([1]),
      findOne: jest.fn().mockResolvedValue({ poster_url: '' })
    },
    SystemConfig: {
      findOne: jest.fn().mockResolvedValue({ config_value: 'https://example.com/policy' })
    },
    LuckyBagRecord: {
      create: jest.fn().mockResolvedValue({
        id: 1001,
        selected_slot: null,
        redpacket_amount: 1.88,
        redpacket_blessing: 'test blessing',
        redpacket_status: 1
      })
    }
  };

  const redis = {
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1)
  };

  const service = new LuckyBagService(models, redis);

  jest.spyOn(service, 'ensureRedPacketPool').mockResolvedValue(undefined);
  jest.spyOn(service, 'isActivityActive').mockResolvedValue(true);
  jest.spyOn(service, 'hasReceived').mockResolvedValue(false);
  jest.spyOn(service, 'checkDailyLimit').mockResolvedValue(undefined);
  jest.spyOn(service, 'allocateCoupons').mockResolvedValue([
    { id: 1, name: 'Coupon A', amount: 10, min_spend: 50, valid_to: '2026-12-31' }
  ]);
  jest.spyOn(service, 'bindCoupons').mockResolvedValue(undefined);
  jest.spyOn(service, 'enqueueRedPacketJob').mockResolvedValue(undefined);
  jest.spyOn(service, 'sendRedPacket').mockResolvedValue({ success: true });

  service.redPacketAllocator.hasStock = jest.fn().mockResolvedValue(true);
  service.redPacketAllocator.allocate = jest.fn().mockResolvedValue({
    amount: 1.88,
    amountKey: '1.88',
    blessing: 'test blessing'
  });
  service.redPacketAllocator.release = jest.fn().mockResolvedValue(true);

  return { service, transaction, redis };
}

describe('LuckyBagService.receive', () => {
  test('compensates redis stock when db transaction fails', async () => {
    const { service, transaction, redis } = createServiceFixture();
    service.allocateCoupons.mockRejectedValue(new Error('coupon allocation failed'));

    await expect(service.receive(1, '127.0.0.1', 'jest')).rejects.toThrow('coupon allocation failed');

    expect(transaction.rollback).toHaveBeenCalledTimes(1);
    expect(service.redPacketAllocator.release).toHaveBeenCalledWith('1.88');
    expect(redis.del).toHaveBeenCalledWith('lock:lucky_bag:1');
  });

  test('does not compensate redis stock after successful commit', async () => {
    const { service, transaction, redis } = createServiceFixture();

    const result = await service.receive(2, '127.0.0.1', 'jest');

    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(service.redPacketAllocator.release).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith('lock:lucky_bag:2');
    expect(result.redPacket.amount).toBe('1.88');
  });
});
