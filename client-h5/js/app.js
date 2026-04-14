(function () {
  const content = window.CLIENT_H5_CONTENT || {};
  const root = document.getElementById('app');
  const bagOptions = Array.from({ length: 9 }).map((_, index) => ({
    id: index,
    label: `福袋 ${index + 1}`,
    tag: index < 3 ? '三江潮色' : index < 6 ? '竹海好运' : '隐藏惊喜'
  }));
  const gridMapping = [0, 1, 2, 7, null, 3, 6, 5, 4];
  const gridRingPositions = [0, 1, 2, 5, 8, 7, 6, 3];
  const wheelPointerAngle = 0;
  const storageKeys = {
    token: 'client_h5_token',
    mode: 'client_h5_mode',
    deviceId: 'client_h5_device_id',
    apiBase: 'client_h5_api_base'
  };

  const emptyStats = () => ({
    redpacketCount: 0,
    couponCount: 0,
    totalAmount: '0.00',
    hasDrawnLottery: false
  });

  const state = {
    apiBase: resolveApiBase(),
    bootstrapping: true,
    routeLoading: false,
    route: parseRoute(),
    sessionPromise: null,
    toast: null,
    unsupportedMessage: '',
    session: {
      token: localStorage.getItem(storageKeys.token) || '',
      mode: localStorage.getItem(storageKeys.mode) || 'mock',
      deviceId: getOrCreateDeviceId(),
      userInfo: null
    },
    activity: {
      isActive: false,
      statusText: '活动未开始',
      startTime: '',
      endTime: '',
      countdown: null
    },
    luckyBag: null,
    userStats: emptyStats(),
    login: {
      tab: 'password',
      email: '',
      password: '',
      code: '',
      codeSending: false,
      codeSent: false,
      codeCountdown: 0,
      submitting: false,
      isRegister: false
    },
    receive: {
      selectedSlot: null,
      agreePrivacy: true,
      phone: '',
      showPhoneSheet: false,
      submitting: false
    },
    lottery: {
      activeMode: 'wheel',
      mode: 'wheel',
      config: {
        wheel: [],
        grid: []
      },
      wheelRotation: 0,
      wheelDuration: 0,
      gridActiveIndex: -1,
      gridTrailIndex: -1,
      drawing: false,
      hasDrawn: false,
      result: null
    },
    coupons: {
      currentTab: '1',
      pool: {
        1: [],
        2: [],
        3: []
      },
      detail: null
    },
    policies: {
      currentCategory: '',
      displayList: content.policies || [],
      detail: null
    },
    redpackets: {
      list: [],
      total: 0
    },
    homePoster: {
      visible: false,
      type: 'redpacket'
    },
    showPosterGlow: true
  };

  let renderQueued = false;
  let toastTimer = null;
  let countdownTimer = null;
  let glowTimer = null;
  let gridTimer = null;
  let lastHomePosterKey = '';

  function resolveApiBase() {
    const isLocalHost = (hostname) => hostname === 'localhost' || hostname === '127.0.0.1';
    const fromStorage = localStorage.getItem(storageKeys.apiBase);
    if (fromStorage) {
      try {
        const parsed = new URL(fromStorage, window.location.origin);
        if (isLocalHost(parsed.hostname) && parsed.port && parsed.port !== '3000') {
          localStorage.removeItem(storageKeys.apiBase);
          return 'http://127.0.0.1:3000';
        }
        return parsed.origin;
      } catch {
        localStorage.removeItem(storageKeys.apiBase);
      }
    }

    if (window.location.protocol.startsWith('http')) {
      const { hostname, port } = window.location;
      if (isLocalHost(hostname) && port && port !== '3000') {
        return 'http://127.0.0.1:3000';
      }
      return window.location.origin;
    }

    return 'http://127.0.0.1:3000';
  }

  function getOrCreateDeviceId() {
    const existing = localStorage.getItem(storageKeys.deviceId);
    if (existing) {
      return existing;
    }

    const created = window.crypto?.randomUUID
      ? `h5_${window.crypto.randomUUID().replace(/-/g, '')}`
      : `h5_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    localStorage.setItem(storageKeys.deviceId, created);
    return created;
  }

  function parseRoute() {
    const rawHash = window.location.hash.replace(/^#/, '') || '/home';
    const [pathname] = rawHash.split('?');
    const segments = pathname.split('/').filter(Boolean);

    if (!segments.length) {
      return { name: 'home', params: {} };
    }

    if (segments[0] === 'coupon' && segments[1]) {
      return { name: 'coupon-detail', params: { id: segments[1] } };
    }

    if (segments[0] === 'policy' && segments[1]) {
      return { name: 'policy-detail', params: { id: segments[1] } };
    }

    const mapping = {
      home: 'home',
      login: 'login',
      receive: 'receive',
      result: 'result',
      lottery: 'lottery',
      coupons: 'coupons',
      policies: 'policies',
      redpackets: 'redpackets',
      profile: 'profile'
    };

    return {
      name: mapping[segments[0]] || 'home',
      params: {}
    };
  }

  function queueRender() {
    if (renderQueued) {
      return;
    }

    renderQueued = true;
    window.requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function setToast(message) {
    state.toast = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      state.toast = null;
      queueRender();
    }, 2200);
    queueRender();
  }

  function clearSession() {
    state.session.token = '';
    state.session.userInfo = null;
    localStorage.removeItem(storageKeys.token);
  }

  function setUnsupportedClient(message) {
    clearSession();
    state.session.mode = 'restricted';
    state.session.userInfo = null;
    state.receive.showPhoneSheet = false;
    state.homePoster.visible = false;
    state.unsupportedMessage = message || '当前环境暂不开放三江青年 H5 正式参与，请从微信小程序进入活动。';
    localStorage.removeItem(storageKeys.mode);
  }

  async function apiRequest(path, options = {}) {
    const method = options.method || 'GET';
    const auth = options.auth !== false;
    const retry = options.retry !== false;
    const payload = options.data || null;
    const url = new URL(path, state.apiBase);

    if (method === 'GET' && payload) {
      Object.keys(payload).forEach((key) => {
        const value = payload[key];
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, value);
        }
      });
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth && state.session.token ? { Authorization: `Bearer ${state.session.token}` } : {})
      },
      body: method === 'GET' ? undefined : JSON.stringify(payload || {})
    });

    const result = await response.json().catch(() => ({
      success: false,
      message: '服务返回了暂时无法识别的数据'
    }));

    if (response.status === 401 && auth && retry) {
      clearSession();
      await ensureSession();
      return apiRequest(path, { ...options, retry: false });
    }

    if (!response.ok || !result.success) {
      throw new Error(result.message || '服务连接失败，请稍后再试');
    }

    return result.data;
  }

  async function ensureSession(forceRefresh = false) {
    if (state.unsupportedMessage) {
      throw new Error(state.unsupportedMessage);
    }

    if (!forceRefresh && state.session.token) {
      return state.session.token;
    }

    if (state.sessionPromise) {
      return state.sessionPromise;
    }

    state.sessionPromise = (async () => {
      let data;
      try {
        data = await apiRequest('/api/user/h5/login', {
          method: 'POST',
          auth: false,
          data: {
            deviceId: state.session.deviceId
          }
        });
      } catch (error) {
        if (String(error.message || '').includes('H5')) {
          setUnsupportedClient('当前环境暂不开放三江青年 H5 正式参与，请从微信小程序进入活动。');
        }
        throw error;
      }

      state.session.token = data.token;
      state.session.mode = data.mode || 'mock';
      state.unsupportedMessage = '';
      localStorage.setItem(storageKeys.token, data.token);
      localStorage.setItem(storageKeys.mode, state.session.mode);
      return data.token;
    })().finally(() => {
      state.sessionPromise = null;
    });

    return state.sessionPromise;
  }

  async function loadUserInfo(force = false) {
    if (state.session.userInfo && !force) {
      return state.session.userInfo;
    }

    state.session.userInfo = await apiRequest('/api/user/info');
    return state.session.userInfo;
  }

  async function loadActivityStatus() {
    const data = await apiRequest('/api/status', { auth: false });
    state.activity.isActive = !!data.isActive;
    state.activity.statusText = data.isActive ? '进行中' : '即将开启';
    state.activity.startTime = data.startTime || '';
    state.activity.endTime = data.endTime || '';
    syncCountdown();
  }

  function syncCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = null;

    if (state.route.name !== 'home' || state.activity.isActive || !state.activity.startTime) {
      state.activity.countdown = null;
      return;
    }

    const update = () => {
      const diff = new Date(state.activity.startTime).getTime() - Date.now();
      if (diff <= 0) {
        state.activity.isActive = true;
        state.activity.statusText = '进行中';
        state.activity.countdown = null;
        clearInterval(countdownTimer);
        countdownTimer = null;
        queueRender();
        return;
      }

      state.activity.countdown = {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60)
      };
      queueRender();
    };

    update();
    countdownTimer = setInterval(update, 1000);
  }

  async function loadHomeData() {
    const [luckyBag, stats] = await Promise.all([
      apiRequest('/api/user/luckyBag/my'),
      apiRequest('/api/user/stats')
    ]);

    state.luckyBag = luckyBag || null;
    state.userStats = {
      ...emptyStats(),
      ...(stats || {})
    };

    if (luckyBag && luckyBag.selectedSlot !== undefined && luckyBag.selectedSlot !== null) {
      state.receive.selectedSlot = luckyBag.selectedSlot;
    }
  }

  async function loadLuckyBagResult() {
    state.luckyBag = await apiRequest('/api/user/luckyBag/my');
    if (!state.luckyBag) {
      return false;
    }

    state.showPosterGlow = true;
    clearTimeout(glowTimer);
    glowTimer = setTimeout(() => {
      state.showPosterGlow = false;
      queueRender();
    }, 1600);
    return true;
  }

  async function loadLotteryPage() {
    const [config, result] = await Promise.all([
      apiRequest('/api/user/lottery/config'),
      apiRequest('/api/user/lottery/my')
    ]);

    state.lottery.config = config || { wheel: [], grid: [] };
    state.lottery.activeMode = config?.activeMode || 'wheel';
    if (!result) {
      state.lottery.mode = state.lottery.activeMode;
    }
    state.lottery.result = result || null;
    state.lottery.hasDrawn = !!result;
    state.lottery.drawing = false;

    if (result) {
      const wheelBoard = getLotteryBoard('wheel', result);
      const gridStop = getGridStopConfig(result.prize?.index, result);
      state.lottery.mode = result.gameType;
      state.lottery.gridActiveIndex = result.gameType === 'grid' ? gridStop.safeIndex : -1;
      state.lottery.gridTrailIndex = -1;
      state.lottery.wheelRotation = result.gameType === 'wheel'
        ? getWheelTargetRotation(result.prize?.index, wheelBoard.length)
        : 0;
      state.lottery.wheelDuration = 0;
    } else {
      state.lottery.gridActiveIndex = -1;
      state.lottery.gridTrailIndex = -1;
      state.lottery.wheelRotation = 0;
      state.lottery.wheelDuration = 0;
    }
  }

  function getHomePosterKey() {
    if (!state.luckyBag) {
      return '';
    }

    return [
      state.luckyBag.receivedAt || '',
      state.userStats.hasDrawnLottery ? 'drawn' : 'pending',
      state.lottery.result?.prize?.key || 'no-result'
    ].join(':');
  }

  function getSharePoster() {
    const result = state.lottery.result;
    const basePoster = state.luckyBag?.poster || {};

    return {
      headline: '分享海报已就绪',
      title: result?.prize?.posterTitle || '把这份三江青年好运分享出去',
      amount: state.luckyBag?.redPacket?.amount || basePoster.amount || '0.00',
      blessing: result?.prize?.posterMessage || '邀请朋友一起打开青春福袋，在宜宾江景与竹影之间收下红包和抽奖惊喜。',
      footer: '分享当前页面，让朋友也来领取福袋并进入独立抽奖页。'
    };
  }

  function getActiveHomePoster() {
    if (state.homePoster.type === 'share') {
      return getSharePoster();
    }

    return state.luckyBag?.poster || {
      headline: '红包海报',
      title: '青春福袋已开启',
      amount: state.luckyBag?.redPacket?.amount || '0.00',
      blessing: state.luckyBag?.redPacket?.blessing || '',
      footer: '查看红包金额、祝福文案和领取结果。'
    };
  }

  function openHomePoster(type = 'random') {
    if (!state.luckyBag) {
      return;
    }

    state.homePoster.type = type === 'random'
      ? (Math.random() < 0.5 ? 'redpacket' : 'share')
      : type;
    state.homePoster.visible = true;
  }

  function maybeOpenHomePoster() {
    if (state.route.name !== 'home' || !state.luckyBag) {
      state.homePoster.visible = false;
      return;
    }

    const key = getHomePosterKey();
    if (!key || key === lastHomePosterKey) {
      return;
    }

    lastHomePosterKey = key;
    openHomePoster('random');
  }

  async function loadCoupons() {
    const [unused, used, expired] = await Promise.all([
      apiRequest('/api/user/coupons/my', { data: { status: 1 } }),
      apiRequest('/api/user/coupons/my', { data: { status: 2 } }),
      apiRequest('/api/user/coupons/my', { data: { status: 3 } })
    ]);

    state.coupons.pool = {
      1: (unused || []).map(normalizeCoupon),
      2: (used || []).map(normalizeCoupon),
      3: (expired || []).map(normalizeCoupon)
    };
  }

  async function loadCouponDetail(id) {
    state.coupons.detail = await apiRequest(`/api/user/coupon/${id}/qrcode`);
  }

  async function loadRedpackets() {
    const data = await apiRequest('/api/user/redpacket/list');
    state.redpackets.list = data.list || [];
    state.redpackets.total = data.total || 0;
  }

  async function loadProfile() {
    const [userInfo, stats] = await Promise.all([
      loadUserInfo(true),
      apiRequest('/api/user/stats')
    ]);

    state.session.userInfo = userInfo;
    state.userStats = {
      ...emptyStats(),
      ...(stats || {})
    };
  }

  function loadPolicyDetail(id) {
    state.policies.detail = id === 'privacy'
      ? content.privacyPolicy
      : (content.policies || []).find((item) => item.id === id) || null;
  }

  function setPolicyCategory(category) {
    state.policies.currentCategory = category;
    state.policies.displayList = category
      ? (content.policies || []).filter((item) => item.category === category)
      : (content.policies || []);
  }

  async function prepareRoute() {
    state.route = parseRoute();
    state.routeLoading = true;
    state.homePoster.visible = state.route.name === 'home' ? state.homePoster.visible : false;
    clearTimeout(glowTimer);
    clearTimeout(gridTimer);
    syncCountdown();
    queueRender();

    try {
      switch (state.route.name) {
        case 'login':
          if (state.session.token) {
            navigate('/home');
            return;
          }
          break;
        case 'home':
          await Promise.all([loadActivityStatus(), loadHomeData()]);
          if (state.luckyBag) {
            await loadLotteryPage();
          }
          maybeOpenHomePoster();
          break;
        case 'receive':
          await Promise.all([loadActivityStatus(), loadHomeData(), loadUserInfo(true)]);
          if (state.luckyBag) {
            navigate(state.userStats.hasDrawnLottery ? '/lottery' : '/result');
            return;
          }
          break;
        case 'result':
          await Promise.all([loadHomeData(), loadUserInfo(true)]);
          if (!(await loadLuckyBagResult())) {
            navigate('/receive');
            return;
          }
          break;
        case 'lottery':
          await Promise.all([loadHomeData(), loadUserInfo(true)]);
          if (!state.luckyBag) {
            setToast('请先领取青春福袋');
            navigate('/receive');
            return;
          }
          await loadLotteryPage();
          break;
        case 'coupons':
          await Promise.all([loadCoupons(), loadUserInfo(true)]);
          break;
        case 'coupon-detail':
          await Promise.all([loadCoupons(), loadCouponDetail(state.route.params.id)]);
          break;
        case 'policies':
          setPolicyCategory(state.policies.currentCategory || '');
          break;
        case 'policy-detail':
          loadPolicyDetail(state.route.params.id);
          break;
        case 'redpackets':
          await Promise.all([loadRedpackets(), loadUserInfo(true)]);
          break;
        case 'profile':
          await loadProfile();
          break;
        default:
          navigate('/home');
          return;
      }
    } catch (error) {
      setToast(error.message || '页面加载失败');
    } finally {
      state.routeLoading = false;
      syncCountdown();
      queueRender();
    }
  }

  function navigate(path) {
    window.location.hash = `#${path}`;
  }

  function normalizeCoupon(item) {
    const source = item.coupon || item;
    return {
      id: item.id,
      code: item.code || '',
      status: item.status,
      name: source.name,
      amount: source.amount,
      minSpend: source.minSpend ?? source.min_spend,
      validFrom: source.validFrom ?? source.valid_from,
      validTo: source.validTo ?? source.valid_to,
      description: source.description || ''
    };
  }

  function normalizeRotation(rotation) {
    const normalized = rotation % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function getLotteryBoard(mode, result = state.lottery.result) {
    const configured = state.lottery.config?.[mode];
    if (Array.isArray(configured) && configured.length) {
      return configured;
    }

    if (result?.gameType === mode && Array.isArray(result.board) && result.board.length) {
      return result.board;
    }

    return [];
  }

  function getSafePrizeIndex(prizeIndex, prizes) {
    if (Number.isInteger(prizeIndex) && prizeIndex >= 0 && prizeIndex < prizes.length) {
      return prizeIndex;
    }

    return prizes.length ? 0 : -1;
  }

  function getWinningPrizeIndex(mode, result = state.lottery.result) {
    if (!result || result.gameType !== mode) {
      return -1;
    }

    return getSafePrizeIndex(result.prize?.index, getLotteryBoard(mode, result));
  }

  function getDimmedPrizeCollection(mode) {
    const prizes = getLotteryBoard(mode);
    const winningIndex = getWinningPrizeIndex(mode);

    if (winningIndex < 0) {
      return prizes;
    }

    return prizes.map((item, index) => ({
      ...item,
      color: index === winningIndex ? item.color : '#f3f4f6',
      accent: index === winningIndex ? item.accent : '#b4bacc'
    }));
  }

  function getWheelTargetRotation(prizeIndex, count) {
    if (!count) {
      return 0;
    }

    const safeIndex = Number.isInteger(prizeIndex) ? prizeIndex : 0;
    const segment = 360 / count;
    return normalizeRotation(wheelPointerAngle - (safeIndex * segment + segment / 2));
  }

  function getGridRingOrder(result = state.lottery.result) {
    const prizes = getLotteryBoard('grid', result);
    return gridRingPositions
      .map((position) => gridMapping[position])
      .filter((prizeIndex) => Number.isInteger(prizeIndex) && prizeIndex >= 0 && prizeIndex < prizes.length);
  }

  function getGridStopConfig(prizeIndex, result = state.lottery.result) {
    const prizes = getLotteryBoard('grid', result);
    const safeIndex = getSafePrizeIndex(prizeIndex, prizes);
    const ringOrder = getGridRingOrder(result);
    const targetOffset = Math.max(ringOrder.indexOf(safeIndex), 0);

    return {
      ringOrder,
      safeIndex,
      targetOffset
    };
  }

  function getGridCells() {
    const coll = getDimmedPrizeCollection('grid');
    return gridMapping.map((prizeIndex) => {
      if (prizeIndex === null) {
        return { isCenter: true };
      }

      return {
        ...(coll[prizeIndex] || {}),
        prizeIndex
      };
    });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(value) {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
  }

  function formatDateTime(value) {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  function getAvatarText() {
    const name = state.session.userInfo?.nickname || '青';
    return name.slice(0, 1);
  }

  function getCurrentCoupons() {
    return state.coupons.pool[state.coupons.currentTab] || [];
  }

  function getRedpacketStatusLabel(status) {
    if (Number(status) === 2) {
      return '已到账';
    }

    if (Number(status) === 3) {
      return '待处理';
    }

    return '发放中';
  }

  function getRedpacketStatusClass(status) {
    if (Number(status) === 2) {
      return 'active';
    }

    if (Number(status) === 3) {
      return 'failed';
    }

    return 'pending';
  }

  function getRouteMeta() {
    const mapping = {
      home: { title: '青春福袋', subtitle: '三江青年路线 · 开袋海报 · 独立抽奖页衔接' },
      receive: { title: '福袋开启', subtitle: '九选一开袋，沿着三江水色进入开袋路线' },
      result: { title: '荣誉卡片', subtitle: '红包金额、到账状态和青年权益同步展示' },
      lottery: { title: '抽奖页面', subtitle: '当前启用奖池直接可见，延续和小程序同一套节奏' },
      coupons: { title: '权益卡包', subtitle: '消费券、福利卡和到店核销入口' },
      'coupon-detail': { title: '消费券详情', subtitle: '到店出示二维码或核销码即可使用' },

      policies: { title: '政策福利', subtitle: '就业、安居、培训和补贴支持一页通览' },
      'policy-detail': { title: '政策详情', subtitle: '查看条目重点、适用人群和办理路径' },
      redpackets: { title: '红包记录', subtitle: '查看红包到账进度和历次领取记录' },
      profile: { title: '我的', subtitle: '查看权益进度、抽奖状态与服务入口' }
    };

    return mapping[state.route.name] || mapping.home;
  }

  async function switchIdentity() {
    if (state.session.mode !== 'mock') {
      setToast('当前环境不支持生成预览身份');
      return;
    }

    clearSession();
    state.session.deviceId = window.crypto?.randomUUID
      ? `h5_${window.crypto.randomUUID().replace(/-/g, '')}`
      : `h5_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(storageKeys.deviceId, state.session.deviceId);
    state.luckyBag = null;
    state.userStats = emptyStats();
    state.session.userInfo = null;
    state.receive.selectedSlot = null;
    state.receive.phone = '';
    state.receive.showPhoneSheet = false;
    state.lottery.result = null;
    state.lottery.hasDrawn = false;
    state.lottery.gridActiveIndex = -1;
    state.lottery.wheelRotation = 0;
    state.lottery.wheelDuration = 0;
    state.homePoster.visible = false;
    state.homePoster.type = 'redpacket';
    lastHomePosterKey = '';
    queueRender();

    try {
      await ensureSession(true);
      await prepareRoute();
      setToast('已生成新的预览身份');
    } catch (error) {
      setToast(error.message || '生成预览身份失败');
    }
  }

  async function onReceiveEntry() {
    await loadActivityStatus();
    await loadHomeData();

    if (!state.activity.isActive) {
      setToast('青春福袋暂未开启');
      return;
    }

    if (state.luckyBag) {
      navigate(state.userStats.hasDrawnLottery ? '/lottery' : '/result');
      return;
    }

    navigate('/receive');
  }

  function getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('浏览器不支持定位'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => reject(new Error('请允许获取位置信息后再试')),
        { enableHighAccuracy: false, timeout: 10000 }
      );
    });
  }

  async function submitReceive() {
    state.receive.submitting = true;
    queueRender();

    try {
      let location;
      try {
        location = await getUserLocation();
      } catch (locErr) {
        setToast(locErr.message || '请先允许定位后继续开袋');
        return;
      }

      const data = await apiRequest('/api/user/luckyBag/receive', {
        method: 'POST',
        data: {
          slotIndex: state.receive.selectedSlot,
          latitude: location.latitude,
          longitude: location.longitude
        }
      });

      state.luckyBag = data;
      state.receive.showPhoneSheet = false;
      await loadHomeData();
      navigate('/result');
    } catch (error) {
      setToast(error.message || '开袋失败，请稍后再试');
    } finally {
      state.receive.submitting = false;
      queueRender();
    }
  }

  async function onOpenBag() {
    if (state.receive.selectedSlot === null || state.receive.selectedSlot === undefined) {
      setToast('先选中一个青春福袋再继续');
      return;
    }

    if (!state.receive.agreePrivacy) {
      setToast('请先阅读并同意隐私说明');
      return;
    }

    await loadUserInfo(true);
    if (!state.session.userInfo?.phone) {
      state.receive.showPhoneSheet = true;
      queueRender();
      return;
    }

    await submitReceive();
  }

  async function bindPhoneAndContinue() {
    if (!/^1[3-9]\d{9}$/.test(state.receive.phone.trim())) {
      setToast('请输入可接收通知的手机号');
      return;
    }

    try {
      await apiRequest('/api/user/h5/bindPhone', {
        method: 'POST',
        data: {
          phone: state.receive.phone.trim()
        }
      });

      await loadUserInfo(true);
      state.receive.showPhoneSheet = false;
      queueRender();
      await submitReceive();
    } catch (error) {
      setToast(error.message || '绑定领奖手机号失败');
    }
  }

  async function drawLottery() {
    if (state.lottery.drawing) {
      return;
    }

    if (state.lottery.hasDrawn) {
      setToast('\u4f60\u5df2\u7ecf\u5b8c\u6210\u62bd\u5956');
      return;
    }

    state.lottery.drawing = true;
    queueRender();

    try {
      const result = await apiRequest('/api/user/lottery/draw', {
        method: 'POST',
        data: {
          gameType: state.lottery.mode
        }
      });

      if (result.gameType === 'wheel') {
        playWheel(result);
      } else {
        playGrid(result);
      }
    } catch (error) {
      state.lottery.drawing = false;
      queueRender();
      setToast(error.message || '抽奖暂未完成，请稍后再试');
    }
  }

  function playWheel(result) {
    const wheelBoard = getLotteryBoard('wheel', result);
    const extraTurns = 360 * (7 + Math.floor(Math.random() * 3));
    const targetRotation = getWheelTargetRotation(result.prize?.index, wheelBoard.length);
    const nextRotation = state.lottery.wheelRotation + extraTurns + targetRotation;
    state.lottery.wheelDuration = 5600;
    queueRender();
    window.requestAnimationFrame(() => {
      state.lottery.wheelRotation = nextRotation;
      queueRender();
    });

    setTimeout(() => {
      finishLottery(result);
      state.lottery.wheelDuration = 0;
      state.lottery.wheelRotation = targetRotation;
      queueRender();
    }, 5700);
  }

  function playGrid(result) {
    clearTimeout(gridTimer);
    const { ringOrder, targetOffset } = getGridStopConfig(result.prize?.index, result);

    if (!ringOrder.length) {
      finishLottery(result);
      return;
    }

    const totalSteps = ringOrder.length * 4 + targetOffset;
    let step = 0;
    let prevIndex = -1;

    const tick = () => {
      prevIndex = state.lottery.gridActiveIndex;
      state.lottery.gridActiveIndex = ringOrder[step % ringOrder.length];
      state.lottery.gridTrailIndex = prevIndex;
      queueRender();

      if (step >= totalSteps) {
        state.lottery.gridTrailIndex = -1;
        finishLottery(result);
        return;
      }

      step += 1;
      const remain = totalSteps - step;
      const delay = remain < 6 ? 180 + (6 - remain) * 70 : 90;
      gridTimer = setTimeout(tick, delay);
    };

    tick();
  }

  function showConfetti() {
    const colors = ['#40d3c0', '#0d5fa8', '#f0c05c', '#e76753', '#1ca391', '#56aaff', '#ff8a65'];
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';

    for (let i = 0; i < 40; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100;
      const size = 6 + Math.random() * 8;
      const duration = 1.8 + Math.random() * 1.6;
      const delay = Math.random() * 0.6;
      piece.style.cssText = `left:${left}%;width:${size}px;height:${size * 0.6}px;background:${color};animation-duration:${duration}s;animation-delay:${delay}s;border-radius:${Math.random() > 0.5 ? '50%' : '2px'};`;
      layer.appendChild(piece);
    }

    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 4000);
  }

  function finishLottery(result) {
    clearTimeout(gridTimer);
    const gridStop = getGridStopConfig(result.prize?.index, result);

    state.lottery.drawing = false;
    state.lottery.hasDrawn = true;
    state.lottery.mode = result.gameType;
    state.lottery.result = result;
    state.lottery.gridActiveIndex = result.gameType === 'grid' ? gridStop.safeIndex : -1;
    state.lottery.gridTrailIndex = -1;
    showConfetti();
    loadHomeData()
      .then(() => {
        if (state.route.name === 'home') {
          maybeOpenHomePoster();
          queueRender();
        }
      })
      .catch(() => {});
    queueRender();
  }

  function copyText(text) {
    if (!text) {
      return;
    }

    navigator.clipboard?.writeText(text)
      .then(() => setToast('已复制到剪贴板'))
      .catch(() => setToast('复制失败，请手动复制'));
  }

  async function shareHomePoster() {
    const poster = getSharePoster();
    const shareUrl = `${window.location.origin}${window.location.pathname}#/home`;
    const shareData = {
      title: poster.title || '青春福袋',
      text: poster.blessing || '邀请朋友一起打开青春福袋。',
      url: shareUrl
    };

    if (navigator.share) {
      await navigator.share(shareData);
      state.homePoster.visible = false;
      setToast('分享请求已发出');
      return;
    }

    state.homePoster.visible = false;
    copyText(shareUrl);
    setToast('已复制分享链接');
  }

  function renderTopbar() {
    const meta = getRouteMeta();
    return `
      <header class="topbar">
        <div class="topbar-brand">
          <div class="topbar-title">${escapeHtml(meta.title)}</div>
          <div class="topbar-subtitle">${escapeHtml(meta.subtitle)}</div>
        </div>
      </header>
    `;
  }

  function renderUnsupportedPage() {
    return `
      <section class="page-shell">
        <div class="hero-card">
          <span class="hero-kicker">正式活动入口</span>
          <div class="hero-title">请从微信小程序进入三江青年福袋</div>
          <p class="hero-desc">${escapeHtml(state.unsupportedMessage || '当前环境暂不开放三江青年 H5 正式参与，请从微信小程序进入活动。')}</p>
        </div>

        <div class="glass-card info-card">
          <div class="info-row">
            <div class="info-label">当前入口</div>
            <div class="info-value">浏览器 H5 当前仅用于预览联调，不参与正式红包发放与活动资格校验。</div>
          </div>
          <div class="info-row">
            <div class="info-label">建议操作</div>
            <div class="info-value">请使用微信小程序打开正式活动入口，领取福袋、查看荣誉海报并参与抽奖。</div>
          </div>
        </div>
      </section>
    `;
  }

  function renderCountdown() {
    return `
      <div class="glass-card countdown-card">
        <div class="section-head">
          <div class="section-title">开袋倒计时</div>
          <div class="section-subtitle">活动开启后即可进入九选一开袋路线</div>
        </div>
        <div class="countdown-grid">
          <div class="count-item">
            <span class="count-value">${state.activity.countdown.days}</span>
            <span class="count-label">天</span>
          </div>
          <div class="count-item">
            <span class="count-value">${state.activity.countdown.hours}</span>
            <span class="count-label">时</span>
          </div>
          <div class="count-item">
            <span class="count-value">${state.activity.countdown.minutes}</span>
            <span class="count-label">分</span>
          </div>
          <div class="count-item">
            <span class="count-value">${state.activity.countdown.seconds}</span>
            <span class="count-label">秒</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderLotteryControls() {
    const lockToActiveMode = !state.lottery.hasDrawn;
    const wheelDisabled = lockToActiveMode && state.lottery.activeMode !== 'wheel';
    const gridDisabled = lockToActiveMode && state.lottery.activeMode !== 'grid';

    return `
      <div class="glass-card mode-switch">
        <div class="switch-track">
          <button class="switch-item ${state.lottery.mode === 'wheel' ? 'active' : ''}" data-action="switch-lottery-mode" data-mode="wheel" ${wheelDisabled ? 'disabled' : ''}>${wheelDisabled ? '三江转盘（未启用）' : '三江转盘'}</button>
          <button class="switch-item ${state.lottery.mode === 'grid' ? 'active' : ''}" data-action="switch-lottery-mode" data-mode="grid" ${gridDisabled ? 'disabled' : ''}>${gridDisabled ? '青春九宫格（未启用）' : '青春九宫格'}</button>
        </div>
      </div>
    `;
  }

  function renderLotteryBoard() {
    const wheelItems = getDimmedPrizeCollection('wheel');
    const winningWheelIndex = getWinningPrizeIndex('wheel');
    const gridCells = getGridCells();

    if (state.lottery.mode === 'wheel') {
      const drawButtonLabel = state.lottery.hasDrawn
        ? '已完成'
        : (state.lottery.drawing ? '抽取中' : (state.luckyBag ? '开始' : '待解锁'));
      const wheelCount = Math.max(1, wheelItems.length);
      const segment = 360 / wheelCount;
      const wheelGradient = wheelItems
        .map((item, index) => {
          const start = (index * segment).toFixed(3);
          const end = ((index + 1) * segment).toFixed(3);
          return `${item.color || '#dfeaf6'} ${start}deg ${end}deg`;
        })
        .join(', ');
      const ledCount = 30;
      return `
        <div class="surface-card wheel-panel">
          <div class="wheel-stage">
            <div class="wheel-led-ring">
              ${Array.from({ length: ledCount }).map((_, index) => `
                <span class="wheel-led ${state.lottery.drawing ? 'live' : ''}" style="--angle:${((360 / ledCount) * index).toFixed(2)}deg; --i:${index};"></span>
              `).join('')}
            </div>
            <div class="wheel-pointer"><span class="wheel-pointer-core"></span></div>
            <div
              class="wheel-body ${state.lottery.drawing ? 'spinning' : ''}"
              style="
                --wheel-gradient: conic-gradient(from -90deg, ${wheelGradient});
                transform: rotate(${state.lottery.wheelRotation}deg);
                transition: transform ${state.lottery.wheelDuration}ms cubic-bezier(0.08, 0.86, 0.12, 1);
              "
            >
              ${wheelItems.map((item, index) => {
                const angle = (segment * index) + segment / 2;
                return `
                  <div class="wheel-prize ${index === winningWheelIndex ? 'active' : ''}" style="--angle:${angle.toFixed(2)}deg;">
                    <div class="wheel-prize-content" style="background:${escapeHtml(item.color)}; color:${escapeHtml(item.accent)};">
                      <span class="wheel-prize-name">${escapeHtml(item.shortLabel)}</span>
                      <span class="wheel-prize-meta">${escapeHtml(item.level)}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            <button class="primary-btn wheel-center" data-action="draw-lottery" title="${drawButtonLabel}" ${state.lottery.drawing || state.lottery.hasDrawn || !state.luckyBag ? 'disabled' : ''}>
              ${state.lottery.hasDrawn ? '已完成' : (state.lottery.drawing ? '抽取中' : (state.luckyBag ? '开始' : '待解锁'))}
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="surface-card grid-panel">
        <div class="grid-board">
          ${gridCells.map((item) => `
            <div class="grid-cell ${item.prizeIndex === state.lottery.gridActiveIndex ? 'active' : ''} ${item.prizeIndex === state.lottery.gridTrailIndex ? 'trail' : ''} ${item.isCenter ? 'center' : ''}">
              ${item.isCenter
                ? `<button class="grid-center-btn" data-action="draw-lottery" ${state.lottery.drawing || state.lottery.hasDrawn || !state.luckyBag ? 'disabled' : ''}>${state.lottery.hasDrawn ? '已完成' : (state.lottery.drawing ? '抽取中' : (state.luckyBag ? '开始' : '待解锁'))}</button>`
                : `<div class="grid-prize" style="background:${escapeHtml(item.color)}; color:${escapeHtml(item.accent)};">
                    <span class="grid-prize-name">${escapeHtml(item.shortLabel)}</span>
                    <span class="grid-prize-meta">${escapeHtml(item.level)}</span>
                  </div>`
              }
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderLotteryResultCard(options = {}) {
    const result = state.lottery.result;
    const emptyText = options.emptyText || '选择当前启用玩法后开始抽奖，页面所示奖池就是你正在参与的奖池。';

    if (!result) {
      return `<div class="empty-panel">${emptyText}</div>`;
    }

    return `
      <div class="glass-card delivery-card">
        <div class="section-head">
          <div class="section-title">抽奖结果</div>
          <span class="status-chip active">${result.gameType === 'wheel' ? '大转盘' : '九宫格'}</span>
        </div>
        <div class="result-highlight" style="background:${escapeHtml(result.prize.color)}; color:${escapeHtml(result.prize.accent)};">
          <span class="result-name">${escapeHtml(result.prize.name)}</span>
          <span class="result-value">${escapeHtml(result.prize.value)}</span>
          <div class="result-message">${escapeHtml(result.prize.posterMessage)}</div>
        </div>
        ${(options.actions || '').trim() ? `<div class="page-actions" style="margin-top: 14px;">${options.actions}</div>` : ''}
      </div>
    `;
  }

  function renderLoginPage() {
    const isPassword = state.login.tab === 'password';
    return `
      <section class="page-shell login-page">
        <div class="hero-card" style="text-align:center;">
          <div class="hero-title" style="font-size:22px;">三江青年福袋</div>
          <p class="hero-desc">登录后领取福袋、参与抽奖</p>
        </div>

        <div class="glass-card" style="padding:24px 20px;">
          <div class="login-tabs">
            <button class="login-tab ${isPassword ? 'active' : ''}" data-action="login-tab" data-tab="password">密码登录</button>
            <button class="login-tab ${!isPassword ? 'active' : ''}" data-action="login-tab" data-tab="email">邮箱验证码</button>
          </div>

          <div class="login-form">
            <div class="form-group">
              <label class="form-label">邮箱</label>
              <input class="form-input" type="email" data-model="login.email" value="${escapeHtml(state.login.email)}" placeholder="请输入邮箱地址" autocomplete="email">
            </div>

            ${isPassword ? `
              <div class="form-group">
                <label class="form-label">密码</label>
                <input class="form-input" type="password" data-model="login.password" value="${escapeHtml(state.login.password)}" placeholder="${state.login.isRegister ? '设置密码（至少6位）' : '请输入密码'}" autocomplete="${state.login.isRegister ? 'new-password' : 'current-password'}">
              </div>
              ${state.login.isRegister ? `
                <div class="form-group">
                  <label class="form-label">昵称（选填）</label>
                  <input class="form-input" type="text" data-model="login.nickname" value="" placeholder="默认使用邮箱前缀">
                </div>
              ` : ''}
              <button class="primary-btn" data-action="login-submit" ${state.login.submitting ? 'disabled' : ''}>
                ${state.login.submitting ? '处理中...' : (state.login.isRegister ? '注册' : '登录')}
              </button>
              <div class="login-switch">
                <button class="link-btn" data-action="login-toggle-register">
                  ${state.login.isRegister ? '已有账号？去登录' : '没有账号？去注册'}
                </button>
              </div>
            ` : `
              <div class="form-group">
                <label class="form-label">验证码</label>
                <div class="code-input-row">
                  <input class="form-input" type="text" data-model="login.code" value="${escapeHtml(state.login.code)}" placeholder="6位验证码" maxlength="6" inputmode="numeric" autocomplete="one-time-code">
                  <button class="code-btn" data-action="login-send-code" ${state.login.codeSending || state.login.codeCountdown > 0 ? 'disabled' : ''}>
                    ${state.login.codeCountdown > 0 ? state.login.codeCountdown + 's' : (state.login.codeSending ? '发送中...' : '发送验证码')}
                  </button>
                </div>
              </div>
              <button class="primary-btn" data-action="login-submit" ${state.login.submitting ? 'disabled' : ''}>
                ${state.login.submitting ? '处理中...' : '登录 / 注册'}
              </button>
            `}
          </div>
        </div>
      </section>
    `;
  }

  async function handleSendEmailCode() {
    const email = state.login.email.trim();
    if (!email) {
      setToast('请输入邮箱地址');
      return;
    }

    state.login.codeSending = true;
    queueRender();

    try {
      const data = await apiRequest('/api/user/auth/email/send', {
        method: 'POST',
        auth: false,
        data: { email }
      });

      state.login.codeSent = true;
      state.login.codeCountdown = 60;

      if (data.mockCode) {
        state.login.code = data.mockCode;
        setToast('测试模式：验证码已自动填入');
      } else {
        setToast('验证码已发送至邮箱');
      }

      const timer = setInterval(() => {
        state.login.codeCountdown -= 1;
        if (state.login.codeCountdown <= 0) {
          clearInterval(timer);
          state.login.codeSent = false;
        }
        queueRender();
      }, 1000);
    } catch (error) {
      setToast(error.message || '发送失败');
    } finally {
      state.login.codeSending = false;
      queueRender();
    }
  }

  async function handleLoginSubmit() {
    const email = state.login.email.trim();
    if (!email) {
      setToast('请输入邮箱地址');
      return;
    }

    state.login.submitting = true;
    queueRender();

    try {
      let data;

      if (state.login.tab === 'password') {
        const password = state.login.password;
        if (!password) {
          setToast('请输入密码');
          return;
        }

        if (state.login.isRegister) {
          if (password.length < 6) {
            setToast('密码长度至少6位');
            return;
          }
          data = await apiRequest('/api/user/auth/register', {
            method: 'POST',
            auth: false,
            data: { email, password }
          });
        } else {
          data = await apiRequest('/api/user/auth/password', {
            method: 'POST',
            auth: false,
            data: { email, password }
          });
        }
      } else {
        const code = state.login.code.trim();
        if (!code || code.length !== 6) {
          setToast('请输入6位验证码');
          return;
        }
        data = await apiRequest('/api/user/auth/email/login', {
          method: 'POST',
          auth: false,
          data: { email, code }
        });
      }

      state.session.token = data.token;
      localStorage.setItem(storageKeys.token, data.token);

      state.login.email = '';
      state.login.password = '';
      state.login.code = '';

      navigate('/home');
    } catch (error) {
      setToast(error.message || '登录失败');
    } finally {
      state.login.submitting = false;
      queueRender();
    }
  }

  function renderHomePage() {
    const hasReceived = !!state.luckyBag;
    const myRedpacket = state.luckyBag?.redPacket || null;
    const myCoupons = (state.luckyBag?.coupons || []).map(normalizeCoupon);
    const primaryText = hasReceived
      ? (state.userStats.hasDrawnLottery ? '查看我的青春战绩' : '继续查看荣誉海报')
      : '领取青春福袋';

    return `
      <section class="page-shell">
        <div class="hero-card">
          <div class="hero-orbit orbit-a"></div>
          <div class="hero-orbit orbit-b"></div>
          <span class="hero-kicker">${escapeHtml(state.activity.statusText)}</span>
          <div class="hero-title">青春福袋<span class="accent">红包、海报、独立抽奖页衔接</span></div>
          <p class="hero-desc">以宜宾三江交汇和竹海风景为灵感，领取福袋后海报随机弹出，再进入独立抽奖页完成大转盘或九宫格抽奖。</p>
          <div class="hero-actions">
            <button class="primary-btn" data-action="receive-entry" ${!state.activity.isActive ? 'disabled' : ''}>${escapeHtml(primaryText)}</button>
            <button class="secondary-btn" data-route="/policies">查看青年政策福利</button>
          </div>
          ${state.activity.countdown ? renderCountdown() : ''}
        </div>

        <div class="glass-card flow-card">
          <div class="section-head">
            <div class="section-title">三江青年体验路线</div>
            <div class="section-subtitle">开袋、荣誉海报与抽奖已经串成一条完整路线</div>
          </div>
          <div class="flow-list">
            <div class="flow-item">
              <div class="flow-index">01</div>
              <div class="flow-body">
                <div class="flow-title">九选一领取红包</div>
                <p class="flow-text">先在福袋页选中一个红包，再完成拆袋领取，开袋结果会自动回流到首页。</p>
              </div>
            </div>
            <div class="flow-item">
              <div class="flow-index">02</div>
              <div class="flow-body">
                <div class="flow-title">随机弹出荣誉海报</div>
                <p class="flow-text">领取完成后，系统会随机展示红包海报或分享海报，把宜宾江景与竹影气质带进结果页仪式感。</p>
              </div>
            </div>
            <div class="flow-item">
              <div class="flow-index">03</div>
              <div class="flow-body">
                <div class="flow-title">进入独立抽奖页</div>
                <p class="flow-text">大转盘和九宫格统一放在独立抽奖页，领取福袋后可一键跳转并继续抽奖。</p>
              </div>
            </div>
          </div>
        </div>

        <div class="glass-card home-lottery-shell">
          <div class="section-head section-head-stack">
            <div>
              <div class="section-title">独立抽奖入口</div>
              <div class="section-subtitle section-subtitle-block">${hasReceived ? '抽奖玩法已迁移到独立页面，和小程序保持同一套奖池与交互。' : '领取青春福袋后，可从这里进入独立抽奖页。'}</div>
            </div>
            <span class="status-chip ${state.userStats.hasDrawnLottery ? 'active' : 'pending'}">${state.userStats.hasDrawnLottery ? '已抽奖' : '待抽奖'}</span>
          </div>
          ${hasReceived ? `
            <div class="poster-quick-actions">
              <button class="secondary-btn mini-btn" data-action="open-home-poster" data-type="random">随机弹出荣誉海报</button>
              <button class="secondary-btn mini-btn" data-action="open-home-poster" data-type="share">打开分享海报</button>
              <button class="secondary-btn mini-btn" data-route="/result">查看红包荣誉卡</button>
            </div>
            <div class="page-actions home-lottery-actions">
              <button class="primary-btn" data-route="/lottery">${state.userStats.hasDrawnLottery ? '查看抽奖结果' : '进入独立抽奖页'}</button>
            </div>
          ` : ''}
        </div>

        ${hasReceived ? '' : `
          <div class="empty-panel">先领取青春福袋，再进入独立抽奖页参与当前启用玩法。</div>
        `}

        ${hasReceived ? `
          <div class="glass-card welfare-card">
            <div class="section-head">
              <div class="section-title">我的当前权益</div>
              <div class="section-subtitle">红包、消费券和抽奖状态会在这里汇总</div>
            </div>
            <div class="list-stack">
              <button class="list-card metric-row" data-route="/redpackets">
                <div>
                  <span class="metric-main">¥${money(myRedpacket?.amount)}</span>
                  <div class="metric-caption">微信红包 ${Number(myRedpacket?.status) === 2 ? '已发放' : '发放中'}</div>
                </div>
                <span class="tiny-chip">查看红包</span>
              </button>
              <button class="list-card metric-row" data-route="/coupons">
                <div>
                  <span class="metric-main">${myCoupons.length}</span>
                  <div class="metric-caption">张青年消费券已入账</div>
                </div>
                <span class="tiny-chip">查看权益</span>
              </button>
              <button class="list-card metric-row" data-route="/lottery">
                <div>
                  <span class="metric-main">${state.userStats.hasDrawnLottery ? '已抽奖' : '待抽奖'}</span>
                  <div class="metric-caption">独立抽奖页可查看</div>
                </div>
                <span class="tiny-chip">进入抽奖页</span>
              </button>
            </div>
          </div>
        ` : ''}

        <div>
          <div class="section-head">
            <div class="section-title">活动规则</div>
            <div class="section-subtitle">发放和使用说明</div>
          </div>
          <div class="list-stack">
            ${(content.activityRules || []).map((item, index) => `
              <div class="list-card"><div class="rule-text">${index + 1}. ${escapeHtml(item)}</div></div>
            `).join('')}
          </div>
        </div>

        <div class="quick-grid">
          <button class="quick-card" data-route="/policies">
            <span class="quick-icon">策</span>
            <div class="quick-title">政策清单</div>
            <p class="quick-text">继续查看就业、安居、培训与补贴支持</p>
          </button>
          <button class="quick-card" data-route="/profile">
            <span class="quick-icon">我</span>
            <div class="quick-title">个人中心</div>
            <p class="quick-text">查看红包、消费券和当前抽奖状态</p>
          </button>
        </div>
      </section>
    `;
  }

  function renderReceivePage() {
    return `
      <section class="page-shell">
        <div class="hero-card">
          <span class="hero-kicker">第一屏 · 九选一</span>
          <div class="hero-title">挑一个最有眼缘的青春福袋</div>
          <p class="hero-desc">九个红包全部可选，选定后随机命中金额，并立刻生成青春祝福海报。页面灵感来自宜宾三江水色与竹海清风。</p>
        </div>

        <div class="bag-grid">
          ${bagOptions.map((item) => `
            <button class="bag-card ${state.receive.selectedSlot === item.id ? 'active' : ''}" data-action="select-bag" data-index="${item.id}">
              <span class="bag-knot"></span>
              <span class="bag-icon">福</span>
              <span class="bag-name">${escapeHtml(item.label)}</span>
              <span class="bag-tag">${escapeHtml(item.tag)}</span>
              ${state.receive.selectedSlot === item.id ? '<span class="bag-selected">已选中</span>' : ''}
            </button>
          `).join('')}
        </div>

        <div class="glass-card opening-card">
          <div class="section-head">
            <div class="section-title">开袋前确认</div>
            <div class="section-subtitle">手机号仅用于红包到账提醒和消费券核销</div>
          </div>
          <div class="tag-row">
            <span class="tag">${state.session.userInfo?.phone ? '领奖手机号已绑定' : '首次开启需绑定领奖手机号'}</span>
            <span class="tag">${state.receive.selectedSlot !== null ? `已选择福袋 ${state.receive.selectedSlot + 1}` : '请先选中一个福袋'}</span>
          </div>
          <div class="privacy-row">
            <button class="privacy-check ${state.receive.agreePrivacy ? 'checked' : ''}" data-action="toggle-privacy">${state.receive.agreePrivacy ? '✓' : ''}</button>
            <div class="privacy-text">我已阅读并同意活动隐私与授权说明</div>
            <button class="privacy-link" data-route="/policy/privacy">查看说明</button>
          </div>
          <button class="primary-btn" data-action="open-bag" ${state.receive.submitting ? 'disabled' : ''}>${state.receive.submitting ? '正在开启福袋...' : '立即开启这个福袋'}</button>
        </div>
      </section>
    `;
  }

  function renderResultPage() {
    if (!state.luckyBag) {
      return `<section class="page-shell"><div class="empty-panel">还没有开袋结果，请先返回首页领取青春福袋。</div></section>`;
    }

    const delivery = state.luckyBag.delivery || {};
    const poster = state.luckyBag.poster || {};
    const coupons = (state.luckyBag.coupons || []).map(normalizeCoupon);

    return `
      <section class="page-shell">
        <div class="poster-card ${state.showPosterGlow ? 'float-pulse' : ''}">
          <div class="poster-headline">三江青年荣誉海报</div>
          <div class="poster-title">${escapeHtml(poster.title || '三江青年荣誉卡片')}</div>
          <div class="poster-amount-row">
            <span class="poster-currency">¥</span>
            <span class="poster-amount">${money(poster.amount)}</span>
          </div>
          <div class="poster-blessing">${escapeHtml(poster.blessing || '')}</div>
          <div class="poster-footer">${escapeHtml(poster.footer || '')}</div>
        </div>

        <div class="glass-card delivery-card">
          <div class="section-head">
            <div class="section-title">红包发放状态</div>
            <span class="status-chip ${escapeHtml(delivery.status || 'pending')}">${escapeHtml(delivery.title || '发放中')}</span>
          </div>
          <p class="delivery-desc">${escapeHtml(delivery.description || '')}</p>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">发放金额</span>
              <span class="info-value">¥${money(state.luckyBag.redPacket?.amount)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">发放通道</span>
              <span class="info-value">${escapeHtml(delivery.channel || '')}</span>
            </div>
            <div class="info-item">
              <span class="info-label">拆袋结果</span>
              <span class="info-value">${escapeHtml(poster.headline || '青春福袋已开启')}</span>
            </div>
          </div>
        </div>

        <div class="glass-card coupon-stage">
          <div class="section-head">
            <div class="section-title">同步入账权益</div>
            <div class="section-subtitle">消费券与政策福利已同步入账</div>
          </div>
          ${coupons.length ? `
            <div class="list-stack">
              ${coupons.map((item) => `
                <div class="list-card coupon-card">
                  <div class="coupon-left">
                    <span class="coupon-money">¥${money(item.amount)}</span>
                    <span class="coupon-min">满 ${escapeHtml(item.minSpend)} 可用</span>
                  </div>
                  <div class="coupon-right">
                    <span class="coupon-name">${escapeHtml(item.name)}</span>
                    <span class="coupon-date">${escapeHtml(item.validTo || '')} 前有效</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<div class="empty-panel">本次未叠加消费券，可继续查看青年政策与服务清单。</div>'}
        </div>

        <div class="page-actions">
          <button class="primary-btn" data-route="/lottery">继续进入独立抽奖页</button>
          <button class="secondary-btn" data-route="/coupons">查看消费券</button>
          <button class="secondary-btn" data-route="/redpackets">查看红包记录</button>
          <button class="secondary-btn" data-route="/policies">查看政策福利</button>
          <button class="secondary-btn" data-route="/home">返回青春首页</button>
        </div>
      </section>
    `;
  }

  function renderLotteryPage() {
    const modeLabel = state.lottery.activeMode === 'grid' ? '青春九宫格' : '三江转盘';
    const statusHint = state.lottery.hasDrawn
      ? '你已完成本次抽奖，下方查看结果'
      : (state.luckyBag ? `当前玩法：${modeLabel}，点击开始按钮抽奖` : '领取福袋后解锁抽奖');

    return `
      <section class="page-shell">
        <div class="hero-card">
          <span class="hero-kicker">${state.lottery.hasDrawn ? '抽奖已完成' : '当前启用玩法'}</span>
          <div class="hero-title">三江青年抽奖区</div>
          <p class="hero-desc">${escapeHtml(statusHint)}</p>
        </div>
        ${renderLotteryControls()}
        ${renderLotteryBoard()}
        ${renderLotteryResultCard({
          actions: '<button class="secondary-btn" data-route="/result">返回查看荣誉海报</button>'
        })}
      </section>
    `;
  }

  function renderCouponsPage() {
    const coupons = getCurrentCoupons();
    return `
      <section class="page-shell">
        <div class="hero-card">
          <span class="hero-kicker">我的青年权益</span>
          <div class="hero-title">消费券与福利卡包</div>
          <p class="hero-desc">福袋到账后的消费券和福利卡会在这里集中展示，未使用、已使用和已过期状态一眼可见。</p>
        </div>

        <div class="glass-card mode-switch">
          <div class="tabs">
            <button class="tab-item ${state.coupons.currentTab === '1' ? 'active' : ''}" data-action="switch-coupon-tab" data-tab="1">未使用 ${state.coupons.pool[1].length}</button>
            <button class="tab-item ${state.coupons.currentTab === '2' ? 'active' : ''}" data-action="switch-coupon-tab" data-tab="2">已使用 ${state.coupons.pool[2].length}</button>
            <button class="tab-item ${state.coupons.currentTab === '3' ? 'active' : ''}" data-action="switch-coupon-tab" data-tab="3">已过期 ${state.coupons.pool[3].length}</button>
          </div>
        </div>

        ${coupons.length ? `
          <div class="list-stack">
            ${coupons.map((item) => `
              <button class="surface-card coupon-card" data-route="/coupon/${item.id}">
                <div class="coupon-left">
                  <span class="coupon-money">¥${money(item.amount)}</span>
                  <span class="coupon-min">满 ${escapeHtml(item.minSpend)} 可用</span>
                </div>
                <div class="coupon-right">
                  <span class="coupon-name">${escapeHtml(item.name)}</span>
                  <span class="coupon-date">${escapeHtml(item.validFrom || '')} - ${escapeHtml(item.validTo || '')}</span>
                  <span class="tiny-chip">${state.coupons.currentTab === '1' ? '待使用' : (state.coupons.currentTab === '2' ? '已使用' : '已过期')}</span>
                </div>
              </button>
            `).join('')}
          </div>
        ` : '<div class="empty-panel">当前分类下暂无权益，领取福袋后再回来看看。</div>'}
      </section>
    `;
  }

  function renderCouponDetailPage() {
    const detail = state.coupons.detail;
    const coupon = normalizeCoupon({
      id: detail?.coupon?.id || state.route.params.id,
      code: detail?.code || '',
      status: detail?.status,
      coupon: detail?.coupon || {}
    });

    if (!detail?.coupon) {
      return `<section class="page-shell"><div class="empty-panel">权益详情加载失败，请返回卡包页重试。</div></section>`;
    }

    return `
      <section class="page-shell">
        <div class="surface-card coupon-stage">
          <div class="detail-top">
            <div>
              <span class="hero-kicker">消费券详情</span>
              <div class="merchant-detail-title" style="margin-top: 12px;">${escapeHtml(coupon.name)}</div>
              <div class="coupon-money" style="margin-top: 12px;">¥${money(coupon.amount)}</div>
              <div class="detail-meta">满 ${escapeHtml(coupon.minSpend)} 可用 · ${escapeHtml(coupon.validFrom || '')} 至 ${escapeHtml(coupon.validTo || '')}</div>
            </div>
          </div>

          ${Number(detail.status) === 1 ? `
            <div class="code-panel">
              <img class="qrcode-image" src="${escapeHtml(detail.qrcodeUrl)}" alt="核销二维码">
              <span class="verify-code">${escapeHtml(detail.code)}</span>
              <div class="verify-tip">到店后向青年友好商家出示二维码或核销码即可使用。</div>
              <div class="page-actions" style="margin-top: 14px;">
                <button class="secondary-btn" data-action="copy-code" data-code="${escapeHtml(detail.code)}">复制核销码</button>
              </div>
            </div>
          ` : `<div class="empty-panel">${Number(detail.status) === 2 ? '该消费券已使用' : '该消费券已过期'}</div>`}
        </div>

        <div class="glass-card detail-info">
          <div class="section-head">
            <div class="section-title">使用说明</div>
            <div class="section-subtitle">到店出示二维码或核销码即可完成核销</div>
          </div>
          <p class="detail-copy">${escapeHtml(coupon.description || '请在有效期内到支持消费券的青年商家核销使用。')}</p>
        </div>
      </section>
    `;
  }

  function renderPoliciesPage() {
    return `
      <section class="page-shell">
        <div class="hero-card">
          <span class="hero-kicker">政策福利</span>
          <div class="hero-title">青年政策与成长支持</div>
          <p class="hero-desc">就业、培训、安居和补贴政策已经收口到一页，适合拆袋后继续深入查看。</p>
        </div>

        <div class="glass-card mode-switch">
          <div class="policy-category-row">
            ${(content.policyCategories || []).map((item) => `
              <button class="policy-category ${state.policies.currentCategory === item.id ? 'active' : ''}" data-action="switch-policy-category" data-category="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>
            `).join('')}
          </div>
        </div>

        <div class="list-stack">
          ${state.policies.displayList.map((item) => `
            <button class="surface-card policy-card" data-route="/policy/${item.id}">
              <div class="policy-card-top">
                <div class="quick-icon">${escapeHtml(item.icon)}</div>
                <div style="flex: 1;">
                  <div class="policy-name">${escapeHtml(item.title)}</div>
                  <p class="policy-summary">${escapeHtml(item.summary)}</p>
                </div>
              </div>
              <div class="tag-row">
                ${(item.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
              </div>
            </button>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderPolicyDetailPage() {
    const policy = state.policies.detail;
    if (!policy) {
      return `<section class="page-shell"><div class="empty-panel">政策详情暂时加载失败，请返回列表重试。</div></section>`;
    }

    return `
      <section class="page-shell">
        <div class="surface-card coupon-stage">
          <span class="hero-kicker">${escapeHtml(policy.tags?.[0] || '政策')}</span>
          <div class="policy-detail-title" style="margin-top: 14px;">${escapeHtml(policy.title)}</div>
          <p class="policy-summary">${escapeHtml(policy.summary)}</p>
          <div class="tag-row">
            ${(policy.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        </div>

        <div class="list-stack">
          ${(policy.sections || []).map((section) => `
            <div class="glass-card section-card">
              <div class="section-title" style="font-size:18px;">${escapeHtml(section.title)}</div>
              <div class="section-copy" style="margin-top: 10px;">${escapeHtml(section.content)}</div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderRedpacketsPage() {
    return `
      <section class="page-shell">
        <div class="hero-card">
          <span class="hero-kicker">红包记录</span>
          <div class="hero-title">我的三江红包</div>
          <p class="hero-desc">共 ${state.redpackets.total} 条红包记录，到账状态会在这里持续同步。</p>
        </div>

        ${state.redpackets.list.length ? `
          <div class="list-stack">
            ${state.redpackets.list.map((item) => `
              <div class="surface-card redpacket-card">
                <div class="redpacket-main">
                  <span class="redpacket-money">¥${money(item.amount)}</span>
                  <span class="status-chip ${getRedpacketStatusClass(item.status)}">${getRedpacketStatusLabel(item.status)}</span>
                </div>
                <span class="redpacket-blessing">${escapeHtml(item.blessing || '')}</span>
                <span class="redpacket-time">领取时间：${escapeHtml(item.createTime || formatDateTime(item.receivedAt || ''))}</span>
              </div>
            `).join('')}
          </div>
        ` : '<div class="empty-panel">还没有红包记录，先回首页领取青春福袋。</div>'}

        <div class="page-actions">
          <button class="secondary-btn" data-route="/lottery">进入独立抽奖页</button>
        </div>
      </section>
    `;
  }

  function renderProfilePage() {
    return `
      <section class="page-shell">
        <div class="surface-card coupon-stage">
          <div class="profile-top">
            <div class="avatar">${escapeHtml(getAvatarText())}</div>
            <div class="profile-main">
              <div class="profile-name">${escapeHtml(state.session.userInfo?.nickname || '三江青年用户')}</div>
              <span class="profile-phone">${escapeHtml(state.session.userInfo?.phone || '待绑定领奖手机号')}</span>
            </div>
          </div>

          <div class="summary-grid" style="margin-top: 18px;">
            <button class="summary-card" data-route="/redpackets">
              <span class="summary-value">${state.userStats.redpacketCount}</span>
              <span class="summary-label">红包记录</span>
            </button>
            <button class="summary-card" data-route="/coupons">
              <span class="summary-value">${state.userStats.couponCount}</span>
              <span class="summary-label">消费券</span>
            </button>
            <button class="summary-card" data-route="/lottery">
              <span class="summary-value">${escapeHtml(state.userStats.totalAmount)}</span>
              <span class="summary-label">累计金额</span>
            </button>
            <button class="summary-card" data-route="/lottery">
              <span class="summary-value">${state.userStats.hasDrawnLottery ? '已抽奖' : '待抽奖'}</span>
              <span class="summary-label">抽奖状态</span>
            </button>
          </div>
        </div>

        <div class="list-stack">
          <button class="surface-card menu-card" data-route="/lottery">
            <div class="menu-title">进入独立抽奖页</div>
            <p class="menu-desc">查看三江转盘、青春九宫格和你的抽奖结果。</p>
          </button>
          <button class="surface-card menu-card" data-route="/policies">
            <div class="menu-title">政策福利清单</div>
            <p class="menu-desc">继续查看就业、培训、安居和补贴支持。</p>
          </button>
        </div>

        <div class="glass-card rules-card">
          <div class="section-head">
            <div class="section-title">使用提醒</div>
            <div class="section-subtitle">领取、到账与核销提醒</div>
          </div>
          <div class="list-stack">
            ${(content.activityRules || []).map((item, index) => `
              <div class="list-card"><div class="rule-text">${index + 1}. ${escapeHtml(item)}</div></div>
            `).join('')}
          </div>
        </div>
        <div class="page-actions">
          <button class="primary-btn" data-action="logout">重新登录</button>
        </div>
      </section>
    `;
  }

  function renderTabbar() {
    const active = state.route.name;
    return `
      <nav class="tabbar">
        <button class="tab-link ${active === 'home' ? 'active' : ''}" data-route="/home">首页</button>
        <button class="tab-link ${active === 'coupons' || active === 'coupon-detail' ? 'active' : ''}" data-route="/coupons">权益</button>
        <button class="tab-link ${active === 'profile' ? 'active' : ''}" data-route="/profile">我的</button>
      </nav>
    `;
  }

  function renderLoading() {
    if (!state.bootstrapping && !state.routeLoading) {
      return '';
    }

    return `
      <div class="loading-overlay">
        <div class="loading-card">
          <span class="spinner"></span>
          <span>${state.bootstrapping ? '三江青年加载中...' : '正在同步青春页面状态...'}</span>
        </div>
      </div>
    `;
  }

  function renderToast() {
    if (!state.toast) {
      return '';
    }

    return `<div class="toast">${escapeHtml(state.toast)}</div>`;
  }

  function renderPhoneModal() {
    return `
      <div class="modal-backdrop">
        <div class="modal-panel">
          <div class="modal-title">绑定领奖手机号后继续</div>
          <p class="modal-copy">当前开袋结果已经锁定，绑定成功后即可继续查看荣誉海报并进入独立抽奖页。</p>
          <input class="text-input" data-model="receive.phone" value="${escapeHtml(state.receive.phone)}" maxlength="11" placeholder="请输入领奖手机号">
          <div class="modal-actions">
            <button class="primary-btn" data-action="bind-phone">绑定并继续</button>
            <button class="secondary-btn" data-action="close-phone-modal">暂不绑定</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderHomePosterModal() {
    const poster = getActiveHomePoster();
    if (!state.homePoster.visible || !poster) {
      return '';
    }

    const isSharePoster = state.homePoster.type === 'share';
    const primaryAction = isSharePoster
      ? '<button class="primary-btn" data-action="share-home-poster">立即分享青年海报</button>'
      : '<button class="primary-btn" data-route="/redpackets">查看红包记录</button>';

    return `
      <div class="modal-backdrop">
        <div class="modal-panel poster-modal-panel">
          <div class="poster-card poster-modal-card">
            <div class="poster-headline">${escapeHtml(poster.headline || '海报已生成')}</div>
            <div class="poster-title">${escapeHtml(poster.title || '三江青年福袋')}</div>
            <div class="poster-amount-row">
              <span class="poster-currency">¥</span>
              <span class="poster-amount">${money(poster.amount)}</span>
            </div>
            <div class="poster-blessing">${escapeHtml(poster.blessing || '')}</div>
            <div class="poster-footer">${escapeHtml(poster.footer || '')}</div>
          </div>
          <div class="modal-actions poster-modal-actions">
            ${primaryAction}
            <div class="poster-quick-actions">
              <button class="secondary-btn mini-btn" data-action="open-home-poster" data-type="random">随机换一张</button>
              <button class="secondary-btn mini-btn" data-action="open-home-poster" data-type="${isSharePoster ? 'redpacket' : 'share'}">${isSharePoster ? '切到红包海报' : '切到分享海报'}</button>
            </div>
            <button class="secondary-btn" data-action="close-home-poster">收起海报</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderPage() {
    if (state.unsupportedMessage) {
      return renderUnsupportedPage();
    }

    switch (state.route.name) {
      case 'login':
        return renderLoginPage();
      case 'home':
        return renderHomePage();
      case 'receive':
        return renderReceivePage();
      case 'result':
        return renderResultPage();
      case 'lottery':
        return renderLotteryPage();
      case 'coupons':
        return renderCouponsPage();
      case 'coupon-detail':
        return renderCouponDetailPage();
      case 'policies':
        return renderPoliciesPage();
      case 'policy-detail':
        return renderPolicyDetailPage();
      case 'redpackets':
        return renderRedpacketsPage();
      case 'profile':
        return renderProfilePage();
      default:
        return renderHomePage();
    }
  }

  function render() {
    root.innerHTML = `
      <div class="phone-frame">
        ${renderTopbar()}
        ${renderPage()}
      </div>
      ${renderTabbar()}
      ${state.receive.showPhoneSheet ? renderPhoneModal() : ''}
      ${renderHomePosterModal()}
      ${renderToast()}
      ${renderLoading()}
    `;
  }

  async function handleAction(action, target) {
    switch (action) {
      case 'switch-identity':
        await switchIdentity();
        break;
      case 'receive-entry':
        await onReceiveEntry();
        break;
      case 'select-bag':
        state.receive.selectedSlot = Number(target.dataset.index);
        queueRender();
        break;
      case 'toggle-privacy':
        state.receive.agreePrivacy = !state.receive.agreePrivacy;
        queueRender();
        break;
      case 'open-bag':
        await onOpenBag();
        break;
      case 'bind-phone':
        await bindPhoneAndContinue();
        break;
      case 'close-phone-modal':
        state.receive.showPhoneSheet = false;
        queueRender();
        break;
      case 'open-home-poster':
        openHomePoster(target.dataset.type || 'random');
        queueRender();
        break;
      case 'close-home-poster':
        state.homePoster.visible = false;
        queueRender();
        break;
      case 'share-home-poster':
        await shareHomePoster();
        break;
      case 'switch-lottery-mode': {
        const mode = target.dataset.mode;
        if (state.lottery.drawing) {
          return;
        }

        if (!state.lottery.hasDrawn && mode !== state.lottery.activeMode) {
          setToast(state.lottery.activeMode === 'grid' ? '当前仅开放青春九宫格' : '当前仅开放三江转盘');
          return;
        }

        if (state.lottery.hasDrawn && state.lottery.result?.gameType !== mode) {
          setToast('你已经按当前玩法完成抽奖');
          return;
        }

        state.lottery.mode = mode;
        queueRender();
        break;
      }
      case 'draw-lottery':
        await drawLottery();
        break;
      case 'switch-coupon-tab':
        state.coupons.currentTab = target.dataset.tab;
        queueRender();
        break;
      case 'switch-policy-category':
        setPolicyCategory(target.dataset.category || '');
        queueRender();
        break;
      case 'copy-code':
        copyText(target.dataset.code);
        break;
      case 'login-tab':
        state.login.tab = target.dataset.tab;
        queueRender();
        break;
      case 'login-toggle-register':
        state.login.isRegister = !state.login.isRegister;
        queueRender();
        break;
      case 'login-send-code':
        await handleSendEmailCode();
        break;
      case 'login-submit':
        await handleLoginSubmit();
        break;
      case 'logout':
        clearSession();
        navigate('/login');
        queueRender();
        break;
      default:
        break;
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-route], [data-action]');
    if (!target) {
      return;
    }

    event.preventDefault();
    if (target.dataset.route) {
      navigate(target.dataset.route);
      return;
    }

    handleAction(target.dataset.action, target).catch((error) => {
      setToast(error.message || '操作失败');
    });
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    const model = target.dataset.model;
    if (!model) {
      return;
    }

    if (model === 'receive.phone') {
      state.receive.phone = target.value;
    } else if (model === 'login.email') {
      state.login.email = target.value;
    } else if (model === 'login.password') {
      state.login.password = target.value;
    } else if (model === 'login.code') {
      state.login.code = target.value;
    }

  });

  window.addEventListener('hashchange', () => {
    prepareRoute().catch((error) => {
      setToast(error.message || '页面切换失败');
    });
  });

  async function bootstrap() {
    try {
      if (!window.location.hash) {
        navigate('/home');
      }

      if (state.session.token) {
        try {
          await loadUserInfo(true);
        } catch (e) {
          clearSession();
        }
      }

      if (!state.session.token && state.route.name !== 'login') {
        navigate('/login');
      }

      await prepareRoute();
    } catch (error) {
      if (!state.unsupportedMessage) {
        setToast(error.message || 'H5 客户端初始化失败');
      }
    } finally {
      state.bootstrapping = false;
      queueRender();
    }
  }

  render();
  bootstrap();
})();
