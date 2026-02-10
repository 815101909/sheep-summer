// pages/garden/garden.js

// 定义跨环境云开发实例
const CROSS_ENV_ID = 'cloud1-1gsyt78b92c539ef'; 
const CROSS_APP_ID = 'wx85d92d28575a70f4';
const GARDEN_CACHE_KEY = 'summer_garden_cache';
const GARDEN_CACHE_TTL = 10 * 60 * 1000;

const reminderManager = require('../../utils/reminderManager')
Page({
  data: {
    isLoggedIn: false, // 登录状态
    userInfo: {
      name: '', // 未登录时为空
      avatarUrl: '', // 用户头像
      description: '在夏日的草原上，寻找属于自己的节奏',
      daysCount: 0,
      listenCount: 0,    // 收听数量 (原articlesCount)
      readCount: 0       // 阅读数量 (原favoritesCount)
    },
    // A4区域三个栏目的数据
    checkinDays: 0,      // 打卡天数
    unlockedImages: 0,   // 解锁形象个数
    isVip: false,        // 是否是会员
    vipExpiry: '', // 会员到期时间
    audioCount: 0,      // 随身听数量
    cardCount: 0,        // 成长卡数量
    showAboutModal: false, // 关于我们模态框显示状态
    
    // 悬浮形象
    currentAvatar: '/assets/images/小卡片默认形象.png' ,

    // 烦恼泡泡相关数据
    showWorryModal: false,
    worryText: '',
    isRecording: false,
    isAnimating: false,
    fallingChars: [],
    plants: [],
    encouragingText: '',
    showEncouragingText: false,

    // 气泡拖动相关
    bubbleLeft: 15, // 初始位置 (对应30rpx approx 15px)
    bubbleTop: 240, // 初始位置 (对应480rpx approx 240px)
    isDraggingBubble: false,
    bubbleStartX: 0,
    bubbleStartY: 0,

    encouragingQuotes: [
      "烦恼是小乌云，吹一口气，就散成阳光啦！",
      "把烦恼轻轻放在手心，吹一口魔法气，它就化啦～",
      "烦恼画在沙滩上，浪一来，全被带走啦！",
      "烦恼变成小雪花，呼～落地就化啦～～",
      "把烦恼揉成纸团，投进垃圾桶，拜拜不见啦～",
      "烦恼是小灰尘，拿个小扫把，唰唰扫进垃圾桶～",
      "把烦恼揉成小纸团，啪嗒一下投进筐，满分！",
      "烦恼是小怪兽，给它喂颗甜甜的糖，它就会乖乖跑掉！"
    ],
    showSoundStarter: false,
    showReminderModal: false,
    reminderContent: '',
    reminderId: ''
  },

  _readGardenCache: function () {
    try {
      const c = wx.getStorageSync(GARDEN_CACHE_KEY) || null;
      if (!c || !c.savedAt) return null;
      if (Date.now() - Number(c.savedAt) > GARDEN_CACHE_TTL) return null;
      return c.data || null;
    } catch (_) { return null; }
  },
  applyGardenCache: function () {
    const d = this._readGardenCache();
    if (!d) return;
    const p = {};
    if (typeof d.checkinDays === 'number') p.checkinDays = d.checkinDays;
    if (typeof d.unlockedImages === 'number') p.unlockedImages = d.unlockedImages;
    if (typeof d.isVip === 'boolean') p.isVip = d.isVip;
    if (typeof d.vipExpiry === 'string') p.vipExpiry = d.vipExpiry;
    if (typeof d.audioCount === 'number') p.audioCount = d.audioCount;
    if (typeof d.cardCount === 'number') p.cardCount = d.cardCount;
    if (Object.keys(p).length) this.setData(p);
  },
  _mergeGardenCache: function (update) {
    try {
      const ex = wx.getStorageSync(GARDEN_CACHE_KEY) || {};
      const data = Object.assign({}, ex.data || {}, update || {});
      wx.setStorageSync(GARDEN_CACHE_KEY, { data, savedAt: Date.now() });
    } catch (_) {}
  },

  onLoad: function (options) {
    // 初始化跨环境云实例
    if (!this.cloud) {
        this.cloud = new wx.cloud.Cloud({
            resourceAppid: CROSS_APP_ID,
            resourceEnv: CROSS_ENV_ID,
        });
        this.cloudInitPromise = this.cloud.init();
    }
    
    this.initPageData();
    this.initRecord();
  },

  onShow: function () {
    // 每次进入页面自动记录访问天数（不需要登录账号）
    this.recordLoginDay();
    
    this.initPageData();
    const app = (typeof getApp === 'function') ? getApp() : null;
    const enabled = app && app.globalData && app.globalData.bgmEnabled === false ? false : true;
    const started = wx.getStorageSync('soundStarted');
    const needStarter = enabled && !started;
    if (needStarter) {
      this.setData({ showSoundStarter: true });
    } else {
      if (getApp && typeof getApp === 'function' && getApp() && typeof getApp().playMusic === 'function') {
        getApp().playMusic();
      }
    }

    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      });
    }
    try { reminderManager.checkAndNotify(); } catch (_) {}
    try {
      const pending = wx.getStorageSync('summer_time_capsule_pending') || null
      if (pending && pending.id) {
        try { wx.setStorageSync('summer_time_capsule_last_shown', pending.id) } catch (_) {}
        this.setData({ showReminderModal: true, reminderContent: String(pending.content || ''), reminderId: pending.id })
        wx.removeStorageSync('summer_time_capsule_pending')
      }
    } catch (_) {}
  },

  onTabItemTap: function () {
    if (getApp().playClickSound) getApp().playClickSound();
  },

  /**
   * 统一初始化页面数据
   */
  initPageData: async function() {
    this.applyGardenCache();
    // 1. 加载本地用户基础信息
    this.loadUserInfo();

    // 2. 等待云环境初始化
    if (this.cloudInitPromise) {
        try {
            await this.cloudInitPromise;
        } catch(e) {
            console.error("Cloud init failed", e);
            return;
        }
    }

    // 3. 加载云端打卡数据和形象数据
    if (this.cloud) {
        this.loadCheckinStats();
        this.loadCollectionStats();
        this.loadVipStatus();
        this.loadUserAvatar(); // 加载悬浮形象
        this.loadProfileAvatar(); // 加载用户头像
    }
    const v = this.data.vipExpiry;
    if (v) {
      const vv = this.formatVipExpiry(v);
      if (vv) {
        this.setData({ vipExpiry: vv });
      }
    }
  },

  startSound: function () {
    wx.setStorageSync('soundStarted', true);
    if (getApp && typeof getApp === 'function' && getApp() && typeof getApp().playMusic === 'function') {
      getApp().playMusic();
    }
    this.setData({ showSoundStarter: false });
  },

  /**
   * 加载用户头像 (summeruser.avatarUrl)
   */
  loadProfileAvatar: async function() {
      // 1. 检查缓存
      const cached = wx.getStorageSync('userAvatarCache');
      if (cached && cached.expiry > Date.now()) {
          this.setData({
              'userInfo.avatarUrl': cached.url
          });
          return;
      }

      if (!this.cloud) return;
      const db = this.cloud.database();
      let avatarUrl = '';
      
      try {
          // 2. 尝试从 summeruser 获取
          const userRes = await db.collection('summeruser').get();
          if (userRes.data.length > 0) {
              const user = userRes.data[0];
              if (user.avatarUrl) {
                  avatarUrl = user.avatarUrl;
              }
          }

          // 3. 如果没有头像，尝试从 summer_avatar 获取默认头像
          if (!avatarUrl) {
              const defaultAvatarRes = await db.collection('summer_avatar')
                  .where({
                      isDefault: true
                  })
                  .limit(1)
                  .get();
              
              if (defaultAvatarRes.data.length > 0) {
                  avatarUrl = defaultAvatarRes.data[0].avatar;
              }
          }

          // 4. 处理头像链接 (如果是 cloud:// 则转 http)
          if (avatarUrl) {
              if (avatarUrl.startsWith('cloud://')) {
                  try {
                      const fileRes = await this.cloud.getTempFileURL({
                          fileList: [avatarUrl]
                      });
                      if (fileRes.fileList && fileRes.fileList.length > 0 && fileRes.fileList[0].tempFileURL) {
                          avatarUrl = fileRes.fileList[0].tempFileURL;
                      }
                  } catch(e) {
                      console.error('转换头像临时链接失败', e);
                  }
              }
              
              // 更新数据
              this.setData({
                  'userInfo.avatarUrl': avatarUrl
              });

              // 写入缓存 (3小时)
              wx.setStorageSync('userAvatarCache', {
                  url: avatarUrl,
                  expiry: Date.now() + 3 * 60 * 60 * 1000
              });
          }
      } catch(err) {
          console.error('加载用户头像失败', err);
      }
  },

  /**
   * 加载用户信息 (本地 + 云端部分)
   */
  loadUserInfo: function () {
    // 检查登录状态
    const isLoggedIn = wx.getStorageSync('isLoggedIn') || false;
    
    // 获取存储的云端用户信息
    const cloudUserInfo = wx.getStorageSync('userInfo') || {};
    
    // 基础数据
    let displayUserInfo = {
      ...this.data.userInfo
    };

    // 更新登录状态和用户名
    if (isLoggedIn) {
      displayUserInfo.name = cloudUserInfo.nickName || wx.getStorageSync('userName') || '夏小咩';
    } else {
      displayUserInfo.name = '';
    }

    // 更新真实的统计数据 (这里主要是本地记录的非打卡类统计，或者后续也可以上云)
    displayUserInfo.daysCount = this.getLoginDaysCount();
    displayUserInfo.listenCount = this.getListenCount();
    displayUserInfo.readCount = this.getReadCount();

    this.setData({
      userInfo: displayUserInfo,
      isLoggedIn: isLoggedIn
    });
  },

  /**
   * 获取登录天数
   */
  getLoginDaysCount: function () {
    const loginRecords = wx.getStorageSync('loginRecords') || [];
    return loginRecords.length;
  },

  /**
   * 获取收听数量（初夏牧歌页面播放的歌曲数）
   */
  getListenCount: function () {
    const listenedSongs = wx.getStorageSync('listenedSongs') || [];
    return listenedSongs.length;
  },

  /**
   * 获取阅读数量（仲夏蹄印页面阅读的日期卡片数）
   */
  getReadCount: function () {
    const readCards = wx.getStorageSync('readCards') || [];
    return readCards.length;
  },

  /**
   * 加载打卡统计数据 (云端)
   */
  loadCheckinStats: async function() {
    if (!this.cloud) return;
    const db = this.cloud.database();
    
    try {
        // 1. 获取用户统计数据 (checkinDays)，按 openid 精确定位
        let openid = wx.getStorageSync('openid');
        if (!openid) {
            try {
                const loginRes = await this.cloud.callFunction({ name: 'login', data: {} });
                openid = loginRes && loginRes.result && loginRes.result.openid ? loginRes.result.openid : '';
                if (openid) wx.setStorageSync('openid', openid);
            } catch (_) {}
        }
        const userRes = openid 
            ? await db.collection('summeruser').where({ _openid: openid }).get()
            : await db.collection('summeruser').get();
        let checkinDays = 0;
        
        if (userRes.data.length > 0) {
            checkinDays = userRes.data[0].checkinDays || 0;
        }

        // 2. 获取本用户解锁形象数量（按 openid）
        let unlockedImages = 0;
        if (openid) {
            const unlockRes = await db.collection('summer_avatar_unlock')
                .where({ _openid: openid })
                .count();
            unlockedImages = unlockRes.total;
        }
        this.setData({
            checkinDays: checkinDays,
            unlockedImages: unlockedImages
        });
        this._mergeGardenCache({ checkinDays, unlockedImages });

    } catch (err) {
        console.error('加载打卡统计失败', err);
    }
  },

  /**
   * 加载收藏统计数据
   */
  loadCollectionStats: async function() {
    if (!this.cloud) return;
    const db = this.cloud.database();
    
    try {
        let openid = wx.getStorageSync('openid');
        if (!openid) {
            try {
                const loginRes = await this.cloud.callFunction({ name: 'login', data: {} });
                openid = loginRes && loginRes.result && loginRes.result.openid ? loginRes.result.openid : '';
                if (openid) wx.setStorageSync('openid', openid);
            } catch (_) {}
        }
        const whereMusic = openid ? { type: 'music', _openid: openid } : { type: 'music' };
        const whereArticle = openid ? { type: 'article', _openid: openid } : { type: 'article' };
        const [musicCountRes, articleCountRes] = await Promise.all([
            db.collection('summer_user_favorites').where(whereMusic).count(),
            db.collection('summer_user_favorites').where(whereArticle).count()
        ]);
        this.setData({
            audioCount: musicCountRes.total,
            cardCount: articleCountRes.total
        });
        this._mergeGardenCache({ audioCount: musicCountRes.total, cardCount: articleCountRes.total });
        
    } catch (err) {
        console.error('加载收藏统计失败', err);
    }
  },
  
  /**
   * 加载会员状态
   */
  loadVipStatus: async function() {
    if (!this.cloud) return;
    try {
      const res = await this.cloud.callFunction({
        name: 'summer_pay',
        data: { action: 'checkMemberStatus' }
      });
      const r = res && res.result ? res.result : {};
      const expiryTs = r.vipExpireTime || '';
      const expiryStr = expiryTs ? this.formatVipExpiry(expiryTs) : '';
      const nowTs = Date.now();
      const expired = expiryTs && Number(expiryTs) <= nowTs;
      if (expired) {
        const noticeKey = 'vipExpiredNotifiedExpireTs';
        const notifiedTs = Number(wx.getStorageSync(noticeKey)) || 0;
        this.setData({ isVip: false, vipExpiry: '' });
        if (!notifiedTs || notifiedTs !== Number(expiryTs)) {
          wx.showToast({ title: '会员已过期，已取消', icon: 'none' });
          wx.setStorageSync(noticeKey, Number(expiryTs));
        }
        this._mergeGardenCache({ isVip: false, vipExpiry: '' });
      } else {
        const isVip = !!r.isVip;
        this.setData({ isVip: isVip, vipExpiry: expiryStr });
        const noticeKey = 'vipExpiredNotifiedExpireTs';
        const savedTs = Number(wx.getStorageSync(noticeKey)) || 0;
        if (savedTs && expiryTs && Number(expiryTs) > nowTs) {
          wx.removeStorageSync(noticeKey);
        }
        this._mergeGardenCache({ isVip: !!r.isVip, vipExpiry: expiryStr });
      }
    } catch (e) {}
  },
  
  formatVipExpiry: function (input) {
    if (!input) return '';
    let y, m, d;
    if (typeof input === 'number' || /^\d+$/.test(String(input))) {
      const dt = new Date(Number(input));
      if (isNaN(dt.getTime())) return '';
      y = dt.getFullYear();
      m = dt.getMonth() + 1;
      d = dt.getDate();
    } else if (typeof input === 'string') {
      const m1 = input.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (!m1) return '';
      y = Number(m1[1]);
      m = Number(m1[2]);
      d = Number(m1[3]);
    } else {
      return '';
    }
    return '至' + y + '年' + m + '月' + d + '日';
  },
  
  /**
   * 加载用户当前设置的形象 (新增)
   */
  loadUserAvatar: async function() {
      const cached = wx.getStorageSync('currentAvatar') || '';
      if (cached) {
          this.setData({ currentAvatar: cached });
      }
      if (!this.cloud) return;
      const db = this.cloud.database();
      
      try {
          const userRes = await db.collection('summeruser').get();
          if (userRes.data.length > 0) {
              const user = userRes.data[0];
              const visualization = user.visualization;
              
              if (visualization) {
                  let avatarUrl = visualization;
                  
                  // 如果是 cloud:// 链接，转换为 http 链接
                  if (avatarUrl.startsWith('cloud://')) {
                      try {
                          const fileRes = await this.cloud.getTempFileURL({
                              fileList: [avatarUrl]
                          });
                          if (fileRes.fileList && fileRes.fileList.length > 0 && fileRes.fileList[0].tempFileURL) {
                              avatarUrl = fileRes.fileList[0].tempFileURL;
                          }
                      } catch(e) {
                          console.error('转换临时链接失败', e);
                      }
                  }
                  
                  this.setData({
                      currentAvatar: avatarUrl
                  });
              } else {
                  // 如果没有设置，使用默认形象
                  this.setData({
                      currentAvatar: '/assets/images/小卡片默认形象.png'
                  });
              }
          }
      } catch(err) {
          console.error('加载用户形象失败', err);
      }
  },

  /**
   * 获取登录天数
   */
  getLoginDaysCount: function () {
    const loginRecords = wx.getStorageSync('loginRecords') || [];
    return loginRecords.length;
  },

  /**
   * 获取收听数量（初夏牧歌页面播放的歌曲数）
   */
  getListenCount: function () {
    const listenedSongs = wx.getStorageSync('listenedSongs') || [];
    return listenedSongs.length;
  },

  /**
   * 获取阅读数量（盛夏蹄印页面阅读的日期卡片数）
   */
  getReadCount: function () {
    const readCards = wx.getStorageSync('readCards') || [];
    return readCards.length;
  },

  /**
   * 记录登录天数
   */
  recordLoginDay: function () {
    const today = new Date().toDateString();
    let loginRecords = wx.getStorageSync('loginRecords') || [];

    // 检查今天是否已经记录过
    if (!loginRecords.includes(today)) {
      loginRecords.push(today);
      wx.setStorageSync('loginRecords', loginRecords);
    }
  },

  /**
   * 快速登录
   */
  quickLogin: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    // 跳转到登录页面
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  /**
   * 点击悬浮形象
   */
  onCharacterTap: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    const now = new Date();
    if (!(now.getDay() === 1 && now.getHours() >= 9)) {
      wx.showToast({ title: '每周一上午9点解锁周报', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/weekly-report/weekly-report' });
  },
  _pad2: function (n) {
    return n < 10 ? ('0' + n) : String(n);
  },
  _getWeekMondayStr: function (d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay();
    const diffSinceMonday = (day + 6) % 7;
    x.setDate(x.getDate() - diffSinceMonday);
    const y = x.getFullYear();
    const m = this._pad2(x.getMonth() + 1);
    const dd = this._pad2(x.getDate());
    return `${y}-${m}-${dd}`;
  },
  _getPrevWeekMondayStr: function (d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay();
    const diffSinceMonday = (day + 6) % 7;
    x.setDate(x.getDate() - diffSinceMonday - 7);
    const y = x.getFullYear();
    const m = this._pad2(x.getMonth() + 1);
    const dd = this._pad2(x.getDate());
    return `${y}-${m}-${dd}`;
  },

  /**
   * 编辑个人资料
   */
  editProfile: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    // 跳转到设置页面
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  },


  /**
   * 打开打卡页面
   */
  openCheckinPage: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    wx.navigateTo({
      url: '/pages/checkin/checkin'
    });
  },

  /**
   * 打开关于我们页面
   */
  openAbout: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    this.setData({
      showAboutModal: true
    });
  },

  /**
   * 关闭关于我们模态框
   */
  closeAboutModal: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    this.setData({
      showAboutModal: false
    });
  },

  /**
   * 打开会员页面
   */
  openVip: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    wx.navigateTo({
      url: '/pages/vip/vip'
    });
  },

  /**
   * 打开收藏库页面
   */
  openCollection: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    wx.navigateTo({
      url: '/pages/collection/collection'
    });
  },

  /**
   * 打开帮助中心
   */
  openHelp: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    wx.navigateTo({
      url: '/pages/service/service'
    });
  },
  
  
  
  /**
   * 气泡拖动开始
   */
  onBubbleTouchStart: function(e) {
    if (this._bubbleInertiaTimer) {
      clearInterval(this._bubbleInertiaTimer);
      this._bubbleInertiaTimer = null;
    }
    this._bubbleStartX = e.touches[0].clientX;
    this._bubbleStartY = e.touches[0].clientY;
    this._hasMoved = false; // 重置移动标记
    this._prevX = this._bubbleStartX;
    this._prevY = this._bubbleStartY;
    this._prevTime = e.timeStamp;
    this._vx = 0;
    this._vy = 0;

    this.setData({
      isDraggingBubble: true,
      initialBubbleLeft: this.data.bubbleLeft,
      initialBubbleTop: this.data.bubbleTop
    });
  },

  /**
   * 气泡拖动中
   */
  onBubbleTouchMove: function(e) {
    if (!this.data.isDraggingBubble) return;
    
    const curX = e.touches[0].clientX;
    const curY = e.touches[0].clientY;
    const dx = curX - this._bubbleStartX;
    const dy = curY - this._bubbleStartY;

    // 如果尚未确认为移动，检查是否超过阈值
    if (!this._hasMoved) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        this._hasMoved = true;
      } else {
        // 未超过阈值，不移动气泡，视为潜在的点击
        return;
      }
    }
    
    // 计算新位置
    let newLeft = this.data.initialBubbleLeft + dx;
    let newTop = this.data.initialBubbleTop + dy;
    
    // 边界限制 (使用 wx.getWindowInfo 替代 deprecated API)
    const windowInfo = (typeof wx.getWindowInfo === 'function') ? wx.getWindowInfo() : { windowWidth: 375, windowHeight: 667 };
    const windowWidth = windowInfo.windowWidth;
    const windowHeight = windowInfo.windowHeight;
    const bubbleSize = Math.round(windowWidth * 110 / 750);
    
    if (newLeft < 0) newLeft = 0;
    if (newLeft > windowWidth - bubbleSize) newLeft = windowWidth - bubbleSize;
    if (newTop < 0) newTop = 0;
    if (newTop > windowHeight - bubbleSize) newTop = windowHeight - bubbleSize;
    
    this.setData({
      bubbleLeft: newLeft,
      bubbleTop: newTop
    });
    
    const dt = e.timeStamp - (this._prevTime || e.timeStamp);
    if (dt > 0) {
      this._vx = (curX - this._prevX) / dt * 1000;
      this._vy = (curY - this._prevY) / dt * 1000;
      this._prevX = curX;
      this._prevY = curY;
      this._prevTime = e.timeStamp;
    }
  },

  /**
   * 气泡拖动结束
   */
  onBubbleTouchEnd: function() {
    this.setData({
      isDraggingBubble: false
    });

    // 如果没有移动（即点击），则打开模态框
    if (!this._hasMoved) {
      this.openWorryModal();
      return;
    }
    
    const windowInfo = (typeof wx.getWindowInfo === 'function') ? wx.getWindowInfo() : { windowWidth: 375, windowHeight: 667 };
    const windowWidth = windowInfo.windowWidth;
    const windowHeight = windowInfo.windowHeight;
    const bubbleSize = Math.round(windowWidth * 110 / 750);
    const restitution = 0.6;
    const friction = 0.92;
    const start = Date.now();
    this._animPrevTime = Date.now();
    
    if (this._bubbleInertiaTimer) {
      clearInterval(this._bubbleInertiaTimer);
      this._bubbleInertiaTimer = null;
    }
    this._bubbleInertiaTimer = setInterval(() => {
      const now = Date.now();
      const dt = now - (this._animPrevTime || now);
      this._animPrevTime = now;
      const dtSec = dt / 1000;
      
      let left = this.data.bubbleLeft + this._vx * dtSec;
      let top = this.data.bubbleTop + this._vy * dtSec;
      let vx = this._vx;
      let vy = this._vy;
      
      if (left < 0) {
        left = 0;
        vx = -vx * restitution;
      }
      if (left > windowWidth - bubbleSize) {
        left = windowWidth - bubbleSize;
        vx = -vx * restitution;
      }
      if (top < 0) {
        top = 0;
        vy = -vy * restitution;
      }
      if (top > windowHeight - bubbleSize) {
        top = windowHeight - bubbleSize;
        vy = -vy * restitution;
      }
      
      vx *= friction;
      vy *= friction;
      this._vx = vx;
      this._vy = vy;
      
      this.setData({
        bubbleLeft: left,
        bubbleTop: top
      });
      
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed < 10 || now - start > 1500) {
        clearInterval(this._bubbleInertiaTimer);
        this._bubbleInertiaTimer = null;
      }
    }, 16);
  },

  /**
   * 打开烦恼输入模态框
   */
  openWorryModal: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    this.setData({
      showWorryModal: true,
      worryText: ''
    });
  },

  /**
   * 关闭烦恼输入模态框
   */
  closeWorryModal: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    this.setData({
      showWorryModal: false
    });
  },

  /**
   * 阻止冒泡
   */
  stopProp: function () {
    return;
  },
  closeReminderModal: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    this.setData({ showReminderModal: false, reminderContent: '', reminderId: '' });
  },
  onReminderDone: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    const rid = this.data.reminderId;
    if (rid) reminderManager.markResult(rid, 'done');
    this.setData({ showReminderModal: false, reminderContent: '', reminderId: '' });
  },
  onReminderMissed: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    const rid = this.data.reminderId;
    if (rid) reminderManager.markResult(rid, 'missed');
    this.setData({ showReminderModal: false, reminderContent: '', reminderId: '' });
  },

  /**
   * 监听烦恼输入
   */
  onWorryInput: function (e) {
    this.setData({
      worryText: e.detail.value
    });
  },

  /**
   * 提交烦恼
   */
  submitWorry: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    const text = this.data.worryText;
    if (!text.trim()) {
      wx.showToast({
        title: '请写下你的烦恼...',
        icon: 'none'
      });
      return;
    }

    this.closeWorryModal();
    this.startWorryAnimation(text);
  },

  /**
   * 开始烦恼转化动画
   */
  startWorryAnimation: function (text) {
    const chars = text.split('');
    const totalChars = chars.length;
    
    // 小羊移动参数
    const sheepAnimDuration = 12; // 12秒走完
    const startLeft = -75; // -550rpx 对应的百分比 
    const endLeft = 120; // 终点百分比
    const totalDist = endLeft - startLeft;
    const speed = totalDist / sheepAnimDuration; // 每秒移动的百分比
    
    // 掉落时间窗口 (小羊在屏幕内的时间段，大概 3.5s 到 9.5s)
    const startTime = 3.5;
    const endTime = 9.5;
    const timeWindow = endTime - startTime;

    const fallingChars = chars.map((char, index) => {
      // 根据索引线性分布在时间窗口内，保证“边走边落”的效果
      // 加上一点随机抖动 (-0.25s 到 0.25s)
      const progress = index / totalChars; 
      const impactTime = startTime + (progress * timeWindow) + (Math.random() * 0.5 - 0.25);
      
      // 计算撞击时小羊的位置
      const sheepLeft = startLeft + speed * impactTime;
      
      // 文字位置 = 小羊位置 + 偏移量 (约35%，适配520rpx大羊的中心)
      const textLeft = sheepLeft + 35; 
      
      // 动画总时长 (下落+弹开)
      const duration = (Math.random() * 0.5 + 2).toFixed(2); // 2.0 - 2.5s
      const numDuration = parseFloat(duration);
      
      // 下落占动画的60% (对应css中的keyframe 60%)
      const fallTime = numDuration * 0.6;
      
      // 动画延迟 = 撞击时间 - 下落时间
      let delay = impactTime - fallTime;
      if (delay < 0) delay = 0;
      
      return {
        char: char,
        size: Math.floor(Math.random() * 40) + 30, // 30-70rpx
        left: textLeft.toFixed(2), // 计算出的动态位置
        duration: duration,
        delay: delay.toFixed(2),
        bounceDir: Math.random() > 0.5 ? 1 : -1
      };
    });

    const randomQuote = this.data.encouragingQuotes[Math.floor(Math.random() * this.data.encouragingQuotes.length)];

    // Play audio
    // The previous background music '烦恼橡皮擦.mp3' is replaced by the bounce sound effect '弹射音.mp3' per character
    if (this.worryAudio) {
      this.worryAudio.stop();
      this.worryAudio.destroy();
      this.worryAudio = null;
    }
    
    // Reset bounce timers and audios
    if (this.bounceTimers) {
      this.bounceTimers.forEach(t => clearTimeout(t));
    }
    this.bounceTimers = [];
    
    if (this.bounceAudios) {
      this.bounceAudios.forEach(ctx => ctx.destroy());
    }
    this.bounceAudios = [];

    // Schedule bounce sounds
    fallingChars.forEach(item => {
      const duration = parseFloat(item.duration);
      const delay = parseFloat(item.delay);
      // Impact happens when fall animation ends (60% of duration)
      const impactTime = (delay + duration * 0.6) * 1000; 

      const timer = setTimeout(() => {
        const ctx = wx.createInnerAudioContext();
        ctx.src = '/assets/audio/弹射音.mp3';
        ctx.obeyMuteSwitch = false;
        ctx.onEnded(() => {
            ctx.destroy();
            if (this.bounceAudios) {
                const idx = this.bounceAudios.indexOf(ctx);
                if (idx > -1) this.bounceAudios.splice(idx, 1);
            }
        });
        ctx.onError((res) => {
            console.error('Bounce audio error:', res);
            ctx.destroy();
            if (this.bounceAudios) {
                const idx = this.bounceAudios.indexOf(ctx);
                if (idx > -1) this.bounceAudios.splice(idx, 1);
            }
        });
        ctx.play();
        this.bounceAudios.push(ctx);
      }, impactTime);
      this.bounceTimers.push(timer);
    });

    this.setData({
      isAnimating: true,
      fallingChars: fallingChars,
      encouragingText: randomQuote,
      showEncouragingText: false // Initially hidden
    });

    // 小羊跑完动画大概是12秒 (sheepAnimDuration)
    // 监听音乐播放或者设定定时器在跑完后停止音乐并显示文字
    setTimeout(() => {
        // Stop music
        if (this.worryAudio) {
            this.worryAudio.stop();
            this.worryAudio.destroy();
            this.worryAudio = null;
        }

        // Show encouraging text animation
        this.setData({
            showEncouragingText: true
        });

    }, sheepAnimDuration * 1000); // 12000ms

    // 18秒后自动结束动画 (extended to accommodate text animation)
    setTimeout(() => {
      if (this.data.isAnimating) {
        this.closeAnimation();
      }
    }, 18000);
  },

  /**
   * 关闭动画
   */
  closeAnimation: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    if (this.worryAudio) {
      this.worryAudio.stop();
      this.worryAudio.destroy();
      this.worryAudio = null;
    }

    if (this.bounceTimers) {
      this.bounceTimers.forEach(t => clearTimeout(t));
      this.bounceTimers = [];
    }
    
    if (this.bounceAudios) {
      this.bounceAudios.forEach(ctx => ctx.destroy());
      this.bounceAudios = [];
    }

    this.setData({
      isAnimating: false,
      fallingChars: [],
      plants: []
    });
  },

  initRecord: function () {
    const that = this;
    try {
      const plugin = requirePlugin("WechatSI");
      const manager = plugin.getRecordRecognitionManager();

      manager.onStart = function () {
        wx.showToast({
          title: '正在聆听...',
          icon: 'none',
          duration: 30000
        });
      };

      manager.onRecognize = function () {};

      manager.onStop = function (res) {
        wx.hideToast();
        if (res.result) {
          const currentText = that.data.worryText || '';
          that.setData({
            worryText: currentText + res.result,
            isRecording: false
          });
        } else {
          that.setData({ isRecording: false });
          wx.showToast({ title: '未识别到内容', icon: 'none' });
        }
      };

      manager.onError = function (res) {
        wx.hideToast();
        that.setData({ isRecording: false });

        let errorMsg = '语音识别失败';
        if (res.retcode === -30001 || res.retcode === -30002) {
          errorMsg = '录音接口出错';
        } else if (res.retcode === -30004) {
          errorMsg = '网络不稳定';
        } else if (res.retcode === -30003) {
          errorMsg = '录音时间太短';
        }

        wx.showToast({ title: errorMsg, icon: 'none' });
      };

      that.recordManager = manager;
    } catch (e) {
      wx.showModal({
        title: '插件加载失败',
        content: '请确保在小程序管理后台添加了“微信同声传译”插件，并在开发者工具中清除缓存后重试。',
        showCancel: false
      });
    }
  },

  startRecord: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    const that = this;
    wx.getSetting({
      success(res) {
        if (!res.authSetting['scope.record']) {
          wx.authorize({
            scope: 'scope.record',
            success() {
              that._startRecordAction();
            },
            fail() {
              wx.showModal({
                title: '提示',
                content: '需要录音权限才能进行语音识别',
                success(res) {
                  if (res.confirm) {
                    wx.openSetting();
                  }
                }
              });
            }
          });
        } else {
          that._startRecordAction();
        }
      }
    });
  },

  _startRecordAction: function () {
    if (this.data.isRecording) return;

    this.setData({ isRecording: true });
    if (this.recordManager) {
      try {
        this.recordManager.start({ duration: 30000, lang: "zh_CN" });
      } catch (e) {
        this.setData({ isRecording: false });
      }
    } else {
      wx.showToast({ title: '语音插件未加载', icon: 'none' });
      this.setData({ isRecording: false });
    }
  },

  stopRecord: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    if (!this.data.isRecording) return;

    if (this.recordManager) {
      try {
        this.recordManager.stop();
      } catch (e) {}
    }
    this.setData({ isRecording: false });
  },

  onHide: function () {
    if (this._bubbleInertiaTimer) {
      clearInterval(this._bubbleInertiaTimer);
      this._bubbleInertiaTimer = null;
    }
    if (this.data.isAnimating) {
      this.closeAnimation();
    }
  },

  onUnload: function () {
    if (this._bubbleInertiaTimer) {
      clearInterval(this._bubbleInertiaTimer);
      this._bubbleInertiaTimer = null;
    }
    if (this.data.isAnimating) {
      this.closeAnimation();
    }
  }
})
