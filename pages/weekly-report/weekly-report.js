Page({
  data: {
    weekStartStr: '',
    weekEndStr: '',
    weekRangeText: '',
    loginDaysThisWeek: 0,
    listenedCountThisWeek: 0,
    readCountThisWeek: 0,
    solitudeKeptCount: 0,
    longestSolitudeNote: '',
    longestSolitudeDate: '',
    maxEnergyLevel: 0,
    maxEnergyDate: '',
    unlockedTotal: 0,
    userInfo: {},
    keyword: '',
    greeting: ''
  },
  onLoad: async function () {
    const now = new Date();
    if (!(now.getDay() === 1 && now.getHours() >= 9)) {
      wx.showToast({ title: '每周一上午9点开放', icon: 'none' });
      setTimeout(() => { wx.navigateBack({ delta: 1 }); }, 800);
      return;
    }

    // 初始化云环境
    this.cloud = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
    await this.cloud.init();


    // if (now.getDay() !== 1) {
    //   wx.showModal({
    //     title: '提示',
    //     content: '每周一生成上周的成长报告，敬请期待！',
    //     showCancel: false,
    //     success: () => {
    //       wx.navigateBack();
    //     }
    //   });
    //   return;
    // }

    this.loadUserInfo();
    
    const thisMon = this.getWeekMonday(now);
    const start = new Date(thisMon.getTime());
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime());
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    const startStr = this.formatDate(start);
    const endStr = this.formatDate(end);
    this.setData({
      weekStartStr: startStr,
      weekEndStr: endStr,
      weekRangeText: `${startStr} 至 ${endStr}`
    });
    
    this.loadWeeklyStats(start, end);
    await this.loadUnlockedTotal();
  },
  getWeekMonday: function (d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay();
    const diff = (day + 6) % 7;
    x.setDate(x.getDate() - diff);
    x.setHours(0, 0, 0, 0);
    return x;
  },
  getWeekSunday: function (d) {
    const mon = this.getWeekMonday(d);
    const x = new Date(mon.getTime());
    x.setDate(mon.getDate() + 6);
    x.setHours(23, 59, 59, 999);
    return x;
  },
  formatDayOfWeek: function(d) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[d.getDay()];
  },
  formatDate: function (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },
  inRange: function (d, start, end) {
    const t = d.getTime();
    return t >= start.getTime() && t <= end.getTime();
  },
  parseDateStr: function (s) {
    if (!s) return null;
    const str = String(s).trim();
    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(str)) {
      const t = str.replace(/-/g, '/');
      const d = new Date(t);
      if (!isNaN(d.getTime())) return d;
    }
    const parts = str.split(' ');
    if (parts.length === 4) {
      const monMap = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
      const m = monMap[parts[1]];
      const dd = Number(parts[2]);
      const y = Number(parts[3]);
      if (m && dd && y) {
        const mm = m < 10 ? ('0' + m) : String(m);
        const ddd = dd < 10 ? ('0' + dd) : String(dd);
        const t2 = `${y}/${mm}/${ddd}`;
        const d2 = new Date(t2);
        if (!isNaN(d2.getTime())) return d2;
      }
    }
    const d3 = new Date(str);
    if (!isNaN(d3.getTime())) return d3;
    return null;
  },
  loadUserInfo: async function () {
    const userInfo = wx.getStorageSync('userInfo') || {};
    if (!userInfo.name) userInfo.name = '夏小咩';
    
    // 处理头像链接 (如果是 cloud:// 则转 http)
    if (userInfo.avatarUrl) {
      // 1. 先查缓存
      const cached = wx.getStorageSync('userAvatarCache');
      if (cached && cached.expiry > Date.now()) {
        userInfo.avatarUrl = cached.url;
      } else if (userInfo.avatarUrl.startsWith('cloud://')) {
        // 2. 转换 cloudID
        try {
          const res = await this.cloud.getTempFileURL({ fileList: [userInfo.avatarUrl] });
          if (res.fileList && res.fileList.length > 0 && res.fileList[0].tempFileURL) {
            userInfo.avatarUrl = res.fileList[0].tempFileURL;
            // 写入缓存 (3小时)
            wx.setStorageSync('userAvatarCache', {
              url: userInfo.avatarUrl,
              expiry: Date.now() + 3 * 60 * 60 * 1000
            });
          }
        } catch (e) {
          console.error('Avatar convert failed', e);
        }
      }
    }

    const greetings = [
      '夏天的风，正暖暖吹过。',
      '愿你的夏天，永远热烈赤诚。',
      '在这个夏天，做自己的光。',
      '生如夏花之绚烂。',
      '汽水、西瓜、蝉鸣，和你。'
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    this.setData({ userInfo, greeting });
  },
  generateKeyword: function(login, listen, read) {
    if (login >= 5) return '#元气满满';
    if (listen >= 5) return '#音乐治愈师';
    if (read >= 5) return '#博学多才';
    if (login + listen + read === 0) return '#蓄势待发';
    return '#快乐生长';
  },
  loadWeeklyStats: function (start, end) {
    const loginRecords = wx.getStorageSync('loginRecords') || [];
    const loginCount = loginRecords.filter(s => {
      const dt = this.parseDateStr(s);
      return dt && this.inRange(dt, start, end);
    }).length;
    
    const listenedSongs = wx.getStorageSync('listenedSongs') || [];
    const listenedCount = listenedSongs.filter(k => {
      const parts = String(k).split('_');
      const ds = parts[parts.length - 1];
      const dt = this.parseDateStr(ds);
      return dt && this.inRange(dt, start, end);
    }).length;
    
    const readCards = wx.getStorageSync('readCards') || [];
    let cleanedCount = 0;
    let keptCount = 0;
    let maxLen = 0;
    let maxNote = '';
    let maxDate = '';
    let maxEnergy = 0;
    let maxEnergyDay = '';

    const readCount = readCards.filter(k => {
      const parts = String(k).split('_');
      if (parts.length < 2) return false;
      const ds = parts[parts.length - 1];
      const dt = this.parseDateStr(ds);
      const inRange = dt && this.inRange(dt, start, end);
      
      if (inRange) {
        // 统计本周阅读过的文章中的净土站数据
        const aid = parts[0];
        const thing = wx.getStorageSync(`summer_solitude_thing_${aid}`);
        const note = wx.getStorageSync(`summer_solitude_note_${aid}`);
        const energy = Number(wx.getStorageSync(`summer_energy_level_${aid}`)) || 0;

        if (energy > maxEnergy) {
          maxEnergy = energy;
          maxEnergyDay = this.formatDayOfWeek(dt);
        }

        if (thing) cleanedCount++;
        if (note) {
          keptCount++;
          const txt = String(note).trim();
          if (txt.length > maxLen) {
            maxLen = txt.length;
            maxNote = txt;
            maxDate = this.formatDayOfWeek(dt);
          }
        }
      }
      return inRange;
    }).length;
    
    this.setData({
      loginDaysThisWeek: loginCount,
      listenedCountThisWeek: listenedCount,
      readCountThisWeek: readCount,
      solitudeCleanedCount: cleanedCount,
      solitudeKeptCount: keptCount,
      longestSolitudeNote: maxNote,
      longestSolitudeDate: maxDate,
      maxEnergyLevel: maxEnergy,
      maxEnergyDate: maxEnergyDay,
      keyword: this.generateKeyword(loginCount, listenedCount, readCount)
    });
  },
  loadUnlockedTotal: async function () {
    try {
      const db = this.cloud.database();
      // 仅统计本用户的解锁数量（需先通过 openid 精确找到用户）
      let total = 0;
      let openid = wx.getStorageSync('openid');
      if (!openid) {
        try {
          const loginRes = await this.cloud.callFunction({ name: 'login', data: {} });
          openid = loginRes && loginRes.result && loginRes.result.openid ? loginRes.result.openid : '';
          if (openid) wx.setStorageSync('openid', openid);
        } catch (_) {}
      }
      if (openid) {
        const userRes = await db.collection('summeruser').where({ _openid: openid }).get();
        if (userRes.data && userRes.data.length > 0) {
          const userId = userRes.data[0]._id;
          const res = await db.collection('summer_avatar_unlock')
            .where({ userId })
            .count();
          total = res.total || 0;
        }
      }
      this.setData({ unlockedTotal: total });
    } catch (e) {
      console.error(e);
      this.setData({ unlockedTotal: 0 });
    }
  },
  onShareAppMessage: function() {
    return {
      title: '我的夏日成长报告',
      path: '/pages/weekly-report/weekly-report'
    };
  }
})
