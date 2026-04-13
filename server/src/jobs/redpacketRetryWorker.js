const logger = require('../utils/logger');
const LuckyBagService = require('../services/LuckyBagService');

function startRedpacketRetryWorker(app) {
  const intervalMs = Number(process.env.REDPACKET_RETRY_INTERVAL_MS || 30000);
  let timer = null;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const service = new LuckyBagService(app.locals.models, app.locals.redis);
      await service.processPendingRedPacketJobs(20);
    } catch (error) {
      logger.error('红包补偿任务轮询失败', { error: error.message });
    } finally {
      running = false;
    }
  };

  timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  tick();

  return () => clearInterval(timer);
}

module.exports = { startRedpacketRetryWorker };
