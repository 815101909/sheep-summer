const reminderManager = require('./utils/reminderManager')
const themeManager = require('./utils/themeManager')
const __originPage__ = Page;
Page = function (config) {
  const originalOnShow = config.onShow;
  config.onShow = function () {
    themeManager.applyToPage(this);
    if (typeof originalOnShow === 'function') {
      return originalOnShow.apply(this, arguments);
    }
  };
  return __originPage__(config);
};
App({
  onLaunch: function () {
    this.globalData = {
      bgm: null,
      bgmSrc: '',
      clickCtx: null,
      clickSrc: '/assets/audio/click.wav',
      bgmEnabled: true
    };

    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      // 声明新的 cloud 实例，用于跨账号调用
      var c1 = new wx.cloud.Cloud({
        // 资源方 AppID
        resourceAppid: 'wx85d92d28575a70f4',
        // 资源方环境 ID
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      })
      
      // 初始化 cloud 实例
      c1.init().then(() => {
        // 挂载到全局，方便后续调用
        this.cloud = c1
        // 初始化背景音乐
        this.initBackgroundMusic();
        reminderManager.checkAndNotify()
        if (!this._reminderTicker) {
          this._reminderTicker = setInterval(() => {
            reminderManager.checkAndNotify()
          }, 30000)
        }
      }).catch(err => {
        console.error('云能力初始化失败', err)
      })

      // 保留默认的 init，防止其他组件依赖；支持从本地存储读取 envId
      try {
        const envId = wx.getStorageSync('SUMMER_CLOUD_ENV') || '';
        const initOptions = { traceUser: true };
        if (envId) initOptions.env = envId;
        wx.cloud.init(initOptions);
      } catch (_) {
        wx.cloud.init({ traceUser: true });
      }
    }
    themeManager.init();
  },

  onShow: function () {
    reminderManager.checkAndNotify()
    themeManager.applyTheme();
    const enabled = this.globalData && this.globalData.bgmEnabled;
    const suppressed = !!(this.globalData && this.globalData.bgmSuppressed);
    if (enabled !== false) {
      try {
        const mgr = wx.getBackgroundAudioManager();
        const isAnyAudioPlaying = !!(mgr && mgr.src && !mgr.paused);
        const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : [];
        const top = (pages && pages.length > 0) ? pages[pages.length - 1] : null;
        const route = top && top.route ? String(top.route) : '';
        const onMusicPage = /pages\/music\/music$/.test(route);
        if (!isAnyAudioPlaying && !onMusicPage && !suppressed) {
          this.playMusic();
        }
      } catch (_){
        if (!suppressed) this.playMusic();
      }
    }
  },

  onHide: function () {
    this.stopMusic();
  },

  initBackgroundMusic: function() {
    const cloudFileID = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/audio/bgm/back.mp3';
    const ctx = wx.createInnerAudioContext();
    ctx.loop = true;
    ctx.volume = 0.05;
    ctx.autoplay = false;
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true });
    } else {
      ctx.obeyMuteSwitch = false;
    }
    ctx.onCanplay(() => {
      const enabled = this.globalData && this.globalData.bgmEnabled;
      const suppressed = !!(this.globalData && this.globalData.bgmSuppressed);
      if (enabled !== false && !suppressed && ctx.src && ctx.paused) { ctx.play(); }
    });
    this.globalData.bgm = ctx;

    this.cloud.getTempFileURL({ fileList: [cloudFileID] }).then(res => {
      if (res.fileList && res.fileList[0].tempFileURL) {
        const src = res.fileList[0].tempFileURL;
        this.globalData.bgmSrc = src;
        if (!this.globalData || !this.globalData.bgmSuppressed) this.playMusic();
      }
    }).catch(err => {
      console.error('获取背景音乐链接失败', err);
    });
  },

  playMusic: function(force) {
      const enabled = this.globalData && this.globalData.bgmEnabled;
      if (enabled === false) return;
      if (this.globalData && this.globalData.bgmSuppressed) return;

      try {
        const mgr = wx.getBackgroundAudioManager();
        if (mgr && mgr.src && !mgr.paused) {
          return;
        }
        const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : [];
        const top = (pages && pages.length > 0) ? pages[pages.length - 1] : null;
        const route = top && top.route ? String(top.route) : '';
        const onMusicPage = /pages\/music\/music$/.test(route);
        if (onMusicPage && !force) {
          return;
        }
      } catch (_){}

      const bgm = this.globalData && this.globalData.bgm;
      const src = this.globalData && this.globalData.bgmSrc;
      if (!bgm || !src) return;

      if (bgm.src !== src) {
        bgm.src = src;
      }
      if (typeof bgm.play === 'function') {
        bgm.play();
      }
      setTimeout(() => {
        const en = this.globalData && this.globalData.bgmEnabled;
        const suppressed = !!(this.globalData && this.globalData.bgmSuppressed);
        if (en === false || suppressed) return;
        try {
          const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : [];
          const top = (pages && pages.length > 0) ? pages[pages.length - 1] : null;
          const route = top && top.route ? String(top.route) : '';
          const onMusicPage = /pages\/music\/music$/.test(route);
          if (onMusicPage) return;
        } catch (_){}
        if (this.globalData && this.globalData.bgm && this.globalData.bgm.src && this.globalData.bgm.paused) {
          this.globalData.bgm.play();
        }
      }, 200);
      setTimeout(() => {
        const en = this.globalData && this.globalData.bgmEnabled;
        const suppressed = !!(this.globalData && this.globalData.bgmSuppressed);
        if (en === false || suppressed) return;
        try {
          const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : [];
          const top = (pages && pages.length > 0) ? pages[pages.length - 1] : null;
          const route = top && top.route ? String(top.route) : '';
          const onMusicPage = /pages\/music\/music$/.test(route);
          if (onMusicPage) return;
        } catch (_){}
        if (this.globalData && this.globalData.bgm && this.globalData.bgm.src && this.globalData.bgm.paused) {
          this.globalData.bgm.play();
        }
      }, 1000);
      setTimeout(() => {
        const en = this.globalData && this.globalData.bgmEnabled;
        const suppressed = !!(this.globalData && this.globalData.bgmSuppressed);
        if (en === false || suppressed) return;
        try {
          const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : [];
          const top = (pages && pages.length > 0) ? pages[pages.length - 1] : null;
          const route = top && top.route ? String(top.route) : '';
          const onMusicPage = /pages\/music\/music$/.test(route);
          if (onMusicPage) return;
        } catch (_){}
        if (this.globalData && this.globalData.bgm && this.globalData.bgm.src && this.globalData.bgm.paused) {
          this.globalData.bgm.play();
        }
      }, 3000);
  },
  suppressBGM: function() {
    if (!this.globalData) this.globalData = {};
    this.globalData.bgmSuppressed = true;
    try {
      const bgm = this.globalData && this.globalData.bgm;
      if (bgm && typeof bgm.pause === 'function') bgm.pause();
    } catch (_){}
  },
  releaseBGM: function() {
    if (!this.globalData) this.globalData = {};
    this.globalData.bgmSuppressed = false;
  },

  stopMusic: function() {
      if (this.globalData.bgm) {
          this.globalData.bgm.pause();
      }
  },

  ensureClickSound: function() {
      if (this.globalData && this.globalData.clickCtx) return this.globalData.clickCtx;

      const clickCtx = wx.createInnerAudioContext();
      if (wx.setInnerAudioOption) {
        wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true });
      } else {
        clickCtx.obeyMuteSwitch = false;
      }
      clickCtx.volume = 1;
      clickCtx.src = (this.globalData && this.globalData.clickSrc) ? this.globalData.clickSrc : '/assets/audio/click.wav';
      clickCtx.onError(() => {
        try { clickCtx.destroy(); } catch (_) {}
        if (this.globalData) this.globalData.clickCtx = null;
      });

      if (this.globalData) this.globalData.clickCtx = clickCtx;
      return clickCtx;
  },

  playClickSound: function() {
      const clickCtx = this.ensureClickSound();
      if (!clickCtx) return;
      try { if (typeof clickCtx.stop === 'function') clickCtx.stop(); } catch (_) {}
      try { if (typeof clickCtx.seek === 'function') clickCtx.seek(0); } catch (_) {}
      try { clickCtx.play(); } catch (_) {}
  },
  _reminderTicker: null
});
