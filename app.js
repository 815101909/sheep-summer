App({
  onLaunch: function () {
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
        setTimeout(() => { this.playMusic(); }, 500);
        setTimeout(() => { this.playMusic(); }, 2000);
      }).catch(err => {
        console.error('云能力初始化失败', err)
      })

      // 保留默认的 init，防止其他组件依赖
      wx.cloud.init({
        traceUser: true,
      });
    }

    this.globalData = {
      bgm: null
    };
  },

  initBackgroundMusic: function() {
    let isAndroid = false;
    try {
      const sys = wx.getSystemInfoSync();
      const s1 = String(sys.system || '').toLowerCase();
      const s2 = String(sys.platform || '').toLowerCase();
      isAndroid = s1.indexOf('android') !== -1 || s2 === 'android';
    } catch (e) {}

    const cloudFileID = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/audio/bgm/back.mp3';

    if (isAndroid) {
      const mgr = wx.getBackgroundAudioManager();
      mgr.title = '夏日庭院';
      mgr.singer = '绵羊团队';
      mgr.epname = '夏日BGM';
      mgr.coverImgUrl = '/assets/images/收藏.png';
      mgr.onCanplay(() => {
        const enabled = wx.getStorageSync('backgroundMusicEnabled');
        if (enabled !== false && mgr.src && mgr.paused) { mgr.play(); }
      });
      this.globalData.bgm = mgr;
    } else {
      const ctx = wx.createInnerAudioContext();
      ctx.loop = true;
      ctx.volume = 0.05;
      ctx.autoplay = true;
      if (wx.setInnerAudioOption) {
        wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true });
      } else {
        ctx.obeyMuteSwitch = false;
      }
      ctx.onCanplay(() => {
        const enabled = wx.getStorageSync('backgroundMusicEnabled');
        if (enabled !== false && ctx.src && ctx.paused) { ctx.play(); }
      });
      this.globalData.bgm = ctx;
    }

    this.cloud.getTempFileURL({ fileList: [cloudFileID] }).then(res => {
      if (res.fileList && res.fileList[0].tempFileURL) {
        const src = res.fileList[0].tempFileURL;
        this.globalData.bgmSrc = src;
        if (this.globalData.bgm) {
          this.globalData.bgm.src = src;
          const enabled = wx.getStorageSync('backgroundMusicEnabled');
          if (enabled !== false) {
            this.globalData.bgm.play();
            setTimeout(() => { if (this.globalData.bgm && this.globalData.bgm.paused) this.globalData.bgm.play(); }, 200);
            setTimeout(() => { if (this.globalData.bgm && this.globalData.bgm.paused) this.globalData.bgm.play(); }, 1000);
            setTimeout(() => { if (this.globalData.bgm && this.globalData.bgm.paused) this.globalData.bgm.play(); }, 3000);
          }
        }
      }
    }).catch(err => {
      console.error('获取背景音乐链接失败', err);
    });
  },

  playMusic: function() {
      if (this.globalData.bgm) {
          this.globalData.bgm.play();
      }
  },

  stopMusic: function() {
      if (this.globalData.bgm) {
          this.globalData.bgm.pause();
      }
  },

  playClickSound: function() {
      const clickCtx = wx.createInnerAudioContext();
      if (wx.setInnerAudioOption) {
        wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true });
      } else {
        clickCtx.obeyMuteSwitch = false;
      }
      clickCtx.autoplay = true;
      clickCtx.src = '/assets/audio/click.wav';
      clickCtx.onEnded(() => clickCtx.destroy());
      clickCtx.onError(() => clickCtx.destroy());
      const enabled = wx.getStorageSync('backgroundMusicEnabled');
      if (enabled !== false) { this.playMusic(); }
  }
});
