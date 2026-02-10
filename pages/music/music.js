// pages/music/music.js
const favoriteManager = require('../../utils/favoriteManager');

function parseVttTimestampToSeconds(raw) {
  const str = (raw || '').trim();
  if (!str) return null;

  const parts = str.split(':');
  if (parts.length < 2 || parts.length > 3) return null;

  const last = parts[parts.length - 1];
  const [secStr, msStr] = last.split('.');

  const seconds = Number(secStr);
  const milliseconds = msStr == null ? 0 : Number(msStr.padEnd(3, '0').slice(0, 3));
  if (!Number.isFinite(seconds) || !Number.isFinite(milliseconds)) return null;

  let minutes = 0;
  let hours = 0;
  if (parts.length === 2) {
    minutes = Number(parts[0]);
  } else {
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
  }
  if (!Number.isFinite(minutes) || !Number.isFinite(hours)) return null;

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

function parseWebVttToLyrics(vttText) {
  if (!vttText || typeof vttText !== 'string') return [];

  const normalized = vttText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const cues = [];
  let i = 0;

  while (i < lines.length) {
    const line = (lines[i] || '').trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (line.toUpperCase() === 'WEBVTT') {
      i += 1;
      continue;
    }

    if (!line.includes('-->') && i + 1 < lines.length) {
      const nextLine = (lines[i + 1] || '').trim();
      if (nextLine.includes('-->')) {
        i += 1;
      }
    }

    const timeLine = (lines[i] || '').trim();
    if (!timeLine.includes('-->')) {
      i += 1;
      continue;
    }

    const [startPartRaw, endPartRaw] = timeLine.split('-->');
    const startPart = (startPartRaw || '').trim();
    const endPart = ((endPartRaw || '').trim().split(/\s+/)[0] || '').trim();

    const start = parseVttTimestampToSeconds(startPart);
    const end = parseVttTimestampToSeconds(endPart);
    if (start == null || end == null) {
      i += 1;
      continue;
    }

    i += 1;
    const textLines = [];
    while (i < lines.length) {
      const t = lines[i];
      if (t == null) break;
      if (!t.trim()) break;
      textLines.push(t);
      i += 1;
    }

    const text = textLines.join('\n').trim();
    if (text) {
      cues.push({ time: start, endTime: end, text });
    }

    i += 1;
  }

  cues.sort((a, b) => (a.time || 0) - (b.time || 0));
  return cues;
}

Page({
  data: {
    // 播放状态
    isPlaying: false,
    progress: 0,
    currentTime: '0:00',
    totalTime: '3:45',

    // 当前歌曲
    currentSongIndex: 0,
    currentSong: {
      title: '初夏小夜曲',
      artist: '夏日音乐家',
      duration: '3:45'
    },

    // 播放模式（固定为单曲循环）
    playMode: 'list', // 列表循环、单曲循环、随机播放

    // 当前歌曲收藏状态
    isFavorite: false,

    // 播放倍速 (0.5x, 0.75x, 1.0x, 1.25x, 1.5x)
    playbackRate: 1.0,

    // 字体大小 ('small', 'medium', 'large')
    fontSize: 'medium',

    // 字体颜色 ('black', 'white', 'green', 'blue', 'red')
    fontColor: 'green',

    // 当前激活的面板 ('speed', 'fontSize', 'fontColor', null)
    activePanel: null,

    // 播放列表
    showPlaylist: false,
    // 搜索与筛选
    searchQuery: '',
    filterFavorite: false,
    filterType: 'all',
    typeOptions: ['类型'],
    typeIndex: 0,
    showTypeDropdown: false,
    selectedTypeText: '类型',
    displayPlaylist: [],
    displayLimit: 30,
    displayIncrement: 30,
    filterPerson: 'all',
    personOptions: ['作者'],
    personIndex: 0,
    selectedPersonText: '作者',
    showPersonDropdown: false,
    playlist: [
      { title: '初夏小夜曲', artist: '夏日音乐家', duration: '3:45', isFavorite: false },
      { title: '海边微风', artist: '海洋歌手', duration: '4:12', isFavorite: false },
      { title: '夏日恋歌', artist: '恋爱诗人', duration: '3:28', isFavorite: false },
      { title: '阳光海岸', artist: '沙滩乐队', duration: '5:33', isFavorite: false },
      { title: '暮色夏夜', artist: '夜晚歌手', duration: '4:51', isFavorite: false },
      { title: '清晨海浪', artist: '清晨歌手', duration: '3:17', isFavorite: false }
    ],

    // 歌词
    currentLyricsIndex: 0,
    currentLyricsLine: { time: 0, text: '' },
    lyrics: [
      { time: 0, text: '夏日的微风轻拂着海岸线' },
      { time: 30, text: '海浪轻轻拍打着沙滩' },
      { time: 60, text: '夕阳洒下金色的余晖' },
      { time: 90, text: '照亮了我们相遇的瞬间' },
      { time: 120, text: '初夏的夜晚星空璀璨' },
      { time: 150, text: '月光洒满整个海湾' },
      { time: 180, text: '让我们一起唱起这首小夜曲' },
      { time: 210, text: '在夏日的夜晚久久回荡' }
    ],
    showVipModal: false
  },

  onLoad: function (options) {
    this._pauseByUser = false;
    this._lastPlayTs = 0;
    this._desiredPlaying = false;
    this._bgmResumeTimer = null;
    // 获取歌曲列表
    this.getMusicList();
  },

  onShow: function () {
    // 重新进入页面时同步收藏，保持心形与筛选正确
    if (typeof this.refreshFavorites === 'function') {
      this.refreshFavorites();
    }

    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      });
    }
  },

  onTabItemTap: function () {
    if (getApp().playClickSound) getApp().playClickSound();
  },

  onHide: function () {
    
  },

  onUnload: function () {
    // 页面卸载时清理定时器和音频
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
    }
    
  },

  // 获取歌曲列表
  getMusicList: async function() {
    const cache = wx.getStorageSync('summer_music_cache') || null;
    const now = Date.now();
    if (cache && cache.expiresAt && cache.expiresAt > now && Array.isArray(cache.list) && cache.list.length > 0) {
      const processedList = cache.list;
      try {
        const topicMap = await this.getTopicOrderMap();
        this.sortPlaylistByTopic(processedList, topicMap);
      } catch (_){}
      const displayPlaylist = this.getFilteredPlaylist(processedList, this.data.searchQuery, this.data.filterFavorite);
      const firstPrepared = await this.ensureCloudUrlsForSong(processedList[0]);
      const firstLyrics = (firstPrepared && Array.isArray(firstPrepared.lyrics) && firstPrepared.lyrics.length > 0)
        ? firstPrepared.lyrics
        : ((firstPrepared && firstPrepared.vtt && typeof firstPrepared.vtt === 'string' && firstPrepared.vtt.trim())
          ? parseWebVttToLyrics(firstPrepared.vtt)
          : []);
      this.setData({
        playlist: processedList,
        displayPlaylist: displayPlaylist.slice(0, this.data.displayLimit || displayPlaylist.length),
        typeOptions: this.buildTypeOptions(processedList),
        personOptions: this.buildPersonOptions(processedList),
        topicOptions: this.buildTopicOptions(processedList),
        personIndex: 0,
        selectedPersonText: '作者',
        filterPerson: 'all',
        topicIndex: 0,
        selectedTopicText: '专题',
        filterTopic: 'all',
        showTopicDropdown: false,
        currentSong: firstPrepared,
        currentSongIndex: 0,
        lyrics: firstLyrics,
        currentLyricsIndex: 0,
        currentLyricsLine: (firstLyrics[0] ? firstLyrics[0] : { time: 0, text: '' }),
        isFavorite: firstPrepared && firstPrepared.isFavorite
      });
      if (typeof this.refreshFavorites === 'function') {
        this.refreshFavorites();
      }
      this.initAudio();
      this.refreshMusicListSilently();
      return;
    }
    wx.showLoading({ title: '加载中...' });
    const cloud = getApp().cloud || wx.cloud;
    cloud.callFunction({
      name: 'summer_listen',
      data: { action: 'getMusicList' }
    }).then(res => {
      if (res.result && res.result.data && res.result.data.length > 0) {
        this.processMusicData(res.result.data);
      } else {
        wx.hideLoading();
        wx.showToast({ title: '暂无歌曲', icon: 'none' });
      }
    }).catch(err => {
      console.error('获取歌曲列表失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  refreshMusicListSilently: function() {
    const cloud = getApp().cloud || wx.cloud;
    cloud.callFunction({
      name: 'summer_listen',
      data: { action: 'getMusicList' }
    }).then(res => {
      if (res.result && res.result.data && res.result.data.length > 0) {
        this.processMusicData(res.result.data);
      }
    }).catch(_ => {});
  },

  // 处理音乐数据（转换云文件ID为临时链接）
  processMusicData: async function(musicList) {
    const fileList = [];
    const now = Date.now();
    const CACHE_DURATION = 3 * 60 * 60 * 1000; // 3小时

    // 检查本地缓存
    let cachedUrls = wx.getStorageSync('music_urls_cache') || {};
    
    // 清理过期缓存
    Object.keys(cachedUrls).forEach(key => {
      if (now - cachedUrls[key].timestamp > CACHE_DURATION) {
        delete cachedUrls[key];
      }
    });

    // 获取收藏集合并构建命中集
    const localFavs = favoriteManager.getAll('music') || [];
    const favSet = new Set(localFavs.map(f => f.id));

    // 替换原始数据中的链接，并带入收藏状态与类型/日期展示
    const processedList = musicList.map(song => {
      const publishTsPrimary = this.parsePublishToTs(song.publish_time || song.publish_date || song.publishTime || song.publishDate || song.date);
      const publishDateStr = (() => {
        let ts = this.parsePublishToTs(song.publish_date || song.publishDate || song.publish_time || song.publishTime);
        if (!Number.isFinite(ts) || ts <= 0) { ts = publishTsPrimary; }
        const fmt = this.formatDateYMD(ts);
        return fmt || this.parseDateFromTitleStr(song.title);
      })();
      const topicRaw = song.topic || song.topic_name || song.topicName || song.subject || '';
      const topic = this.normalizeTopicName(topicRaw) || (song.title.indexOf('春日') > -1 ? '春日系列' : (song.title.indexOf('故事') > -1 ? '故事上新' : ''));
      const isVip = song.is_vip || song.isVip || (song.title.indexOf('特别') > -1) || false;

      const obj = {
        ...song,
        audioUrl: song.audioUrl,
        videoUrl: song.videoUrl,
        imageUrl: this.getRealUrl(song.imageUrl, cachedUrls) || this.getRealUrl(song.image, cachedUrls),
        posterUrl: this.getRealUrl((song.poster || song.poster_url), cachedUrls) || this.getRealUrl(song.imageUrl, cachedUrls) || this.getRealUrl(song.image, cachedUrls),
        rawImageId: song.imageUrl || '',
        rawPosterId: (song.poster || song.poster_url || ''),
        duration: song.duration || song.duration_str || '0:00',
        isFavorite: favSet.has(song._id),
        vtt: song.vtt || '',
        lyrics: (song.lyrics || []),
        type: song.type || song.category || '',
        publishTs: publishTsPrimary,
        publishDateStr,
        topic,
        isVip
      };
      return obj;
    });
    try {
      const topicMap = await this.getTopicOrderMap();
      this.sortPlaylistByTopic(processedList, topicMap);
    } catch (_){}

    // 初始化显示的播放列表
    const displayPlaylist = this.getFilteredPlaylist(processedList, this.data.searchQuery, this.data.filterFavorite);
    const firstPrepared = await this.ensureCloudUrlsForSong(processedList[0]);
    const firstLyrics = (firstPrepared && Array.isArray(firstPrepared.lyrics) && firstPrepared.lyrics.length > 0)
      ? firstPrepared.lyrics
      : ((firstPrepared && firstPrepared.vtt && typeof firstPrepared.vtt === 'string' && firstPrepared.vtt.trim())
        ? parseWebVttToLyrics(firstPrepared.vtt)
        : []);

    this.setData({
      playlist: processedList,
      displayPlaylist: displayPlaylist.slice(0, this.data.displayLimit || displayPlaylist.length),
      typeOptions: this.buildTypeOptions(processedList),
      personOptions: this.buildPersonOptions(processedList),
      topicOptions: this.buildTopicOptions(processedList),
      personIndex: 0,
      selectedPersonText: '作者',
      filterPerson: 'all',
      topicIndex: 0,
      selectedTopicText: '专题',
      filterTopic: 'all',
      showTopicDropdown: false,
      currentSong: firstPrepared,
      currentSongIndex: 0,
      lyrics: firstLyrics,
      currentLyricsIndex: 0,
      currentLyricsLine: (firstLyrics[0] ? firstLyrics[0] : { time: 0, text: '' }),
      isFavorite: firstPrepared && firstPrepared.isFavorite
    });
    try {
      wx.setStorageSync('summer_music_cache', {
        list: processedList,
        expiresAt: Date.now() + CACHE_DURATION
      });
    } catch (_){}
    wx.hideLoading();
    if (typeof this.refreshFavorites === 'function') {
      this.refreshFavorites();
    }

    // 初始化音频
    this.initAudio();
    
  },

  normalizeTopicName: function(s) {
    let t = String(s == null ? '' : s);
    t = t.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
    t = t.trim().replace(/\s+/g, ' ');
    t = t.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 65248));
    return t;
  },
  parsePublishToTs: function(raw) {
    if (raw == null) return 0;
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw)) return 0;
      return raw < 1e12 ? Math.floor(raw * 1000) : Math.floor(raw);
    }
    if (raw instanceof Date) return raw.getTime() || 0;
    const s = String(raw || '').trim();
    if (!s) return 0;
    const d = new Date(s);
    const t = d.getTime();
    if (Number.isFinite(t)) return t;
    const n = Number(s);
    if (Number.isFinite(n)) return n < 1e12 ? Math.floor(n * 1000) : Math.floor(n);
    return 0;
  },
  formatDateYMD: function(ts) {
    const t = Number(ts);
    if (!Number.isFinite(t) || t <= 0) return '';
    const d = new Date(t);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },
  parseDateFromTitleStr: function(title) {
    const s = String(title || '').trim();
    if (!s) return '';
    const m1 = s.match(/[【\[]\s*(\d{4})\s*[年\-\/\.]\s*(\d{1,2})\s*[月\-\/\.]\s*(\d{1,2})\s*日?\s*[】\]]/);
    if (m1) {
      const y = Number(m1[1]);
      const mo = String(Number(m1[2])).padStart(2, '0');
      const da = String(Number(m1[3])).padStart(2, '0');
      if (Number.isFinite(y)) return `${y}-${mo}-${da}`;
    }
    const m2 = s.match(/[【\[]\s*(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})\s*[】\]]/);
    if (m2) {
      const y = Number(m2[1]);
      const mo = String(Number(m2[2])).padStart(2, '0');
      const da = String(Number(m2[3])).padStart(2, '0');
      if (Number.isFinite(y)) return `${y}-${mo}-${da}`;
    }
    const m3 = s.match(/[【\[]\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*[】\]]/);
    if (m3) {
      const y = new Date().getFullYear();
      const mo = String(Number(m3[1])).padStart(2, '0');
      const da = String(Number(m3[2])).padStart(2, '0');
      return `${y}-${mo}-${da}`;
    }
    return '';
  },
  getTopicOrderMap: async function() {
    const buildMap = (res) => {
      const map = {};
      (res && res.data || []).forEach(it => {
        const k = this.normalizeTopicName(String((it && (it.topic || it.name || it.title)) || ''));
        const vRaw = (it && (it.paixu ?? it.order ?? it.sort_order ?? it.sort ?? it.index ?? it.priority ?? it.seq));
        const v = Number(vRaw);
        if (k) map[k] = v;
      });
      return map;
    };
    try {
      let cloudInst = getApp().cloud;
      if (!cloudInst) {
        cloudInst = new wx.cloud.Cloud({
          resourceAppid: 'wx85d92d28575a70f4',
          resourceEnv: 'cloud1-1gsyt78b92c539ef',
        });
        await cloudInst.init();
      }
      const dbX = cloudInst.database();
      const rX = await dbX.collection('summer_topic').limit(1000).get();
      const mX = buildMap(rX);
      try { console.log('Summer topic map size', Object.keys(mX).length); } catch (_){}
      if (Object.keys(mX).length > 0) return mX;
    } catch (_){}
    try {
      const dbA = (getApp().cloud || wx.cloud).database();
      const rA = await dbA.collection('summer_topic').limit(1000).get();
      const mA = buildMap(rA);
      try { console.log('Summer topic map size (local)', Object.keys(mA).length); } catch (_){}
      if (Object.keys(mA).length > 0) return mA;
    } catch (_){}
    try {
      const dbB = wx.cloud.database();
      const rB = await dbB.collection('summer_topic').limit(1000).get();
      const mB = buildMap(rB);
      try { console.log('Summer topic map size (wx)', Object.keys(mB).length); } catch (_){}
      if (Object.keys(mB).length > 0) return mB;
    } catch (_){}
    return {};
  },
  sortPlaylistByTopic: function(list, orderMap) {
    const map = orderMap || {};
    try {
      const mapped = [];
      const unmapped = [];
      const dailyOrEmpty = [];
      (list || []).forEach(it => {
        const t = this.normalizeTopicName(it && it.topic || '');
        const o = Number(map[t]);
        const isDailyOrEmpty = (!t) || (t === '每日播报') || (/^每日播报(?:\s|$)/.test(t));
        const isMapped = (Object.prototype.hasOwnProperty.call(map, t)) && !isDailyOrEmpty;
        if (isMapped) mapped.push(it);
        else if (isDailyOrEmpty) dailyOrEmpty.push(it);
        else unmapped.push(it);
      });
      mapped.sort((a, b) => {
        const ta = this.normalizeTopicName(a && a.topic || '');
        const tb = this.normalizeTopicName(b && b.topic || '');
        const oa = Number(map[ta]);
        const ob = Number(map[tb]);
        const va = Number.isFinite(oa) ? oa : Number.MAX_SAFE_INTEGER;
        const vb = Number.isFinite(ob) ? ob : Number.MAX_SAFE_INTEGER;
        if (va !== vb) return va - vb;
        const ia = this.getInitialLetter(a && a.title);
        const ib = this.getInitialLetter(b && b.title);
        if (ia === ib) return (a && a.title || '').localeCompare(b && b.title || '');
        return ia.localeCompare(ib);
      });
      unmapped.sort((a, b) => {
        const ia = this.getInitialLetter(a && a.title);
        const ib = this.getInitialLetter(b && b.title);
        if (ia === ib) return (a && a.title || '').localeCompare(b && b.title || '');
        return ia.localeCompare(ib);
      });
      dailyOrEmpty.sort((a, b) => {
        const pa = Number(a && a.publishTs);
        const pb = Number(b && b.publishTs);
        const pav = Number.isFinite(pa) ? pa : 0;
        const pbv = Number.isFinite(pb) ? pb : 0;
        if (pav !== pbv) return pbv - pav;
        const ia = this.getInitialLetter(a && a.title);
        const ib = this.getInitialLetter(b && b.title);
        if (ia === ib) return (a && a.title || '').localeCompare(b && b.title || '');
        return ia.localeCompare(ib);
      });
      list.splice(0, list.length, ...mapped, ...unmapped, ...dailyOrEmpty);
      const head = [];
      const tail = [];
      list.forEach(x => {
        const tt = this.normalizeTopicName(x && x.topic || '');
        const dd = (!tt) || (tt === '每日播报') || (/^每日播报(?:\s|$)/.test(tt));
        if (dd) tail.push(x); else head.push(x);
      });
      list.splice(0, list.length, ...head, ...tail);
      try {
        const preview = list.slice(0, 6).map(x => ({
          t: this.normalizeTopicName(x && x.topic || ''),
          o: Number(map[this.normalizeTopicName(x && x.topic || '')])
        }));
        const mappedCnt = head.filter(x => {
          const tt = this.normalizeTopicName(x && x.topic || '');
          return Object.prototype.hasOwnProperty.call(map, tt) && tt !== '每日播报';
        }).length;
        const dailyCnt = tail.length;
        console.log('Topic order preview', preview, 'mapped:', mappedCnt, 'daily:', dailyCnt);
      } catch (_){}
    } catch (_){}
    return list;
  },
  // 检查当前歌曲是否已收藏（改为统一管理器，可按需调用）
  checkFavoriteStatus: async function() {
    const currentSong = this.data.currentSong;
    if (!currentSong || !currentSong._id) return;
    try {
      const synced = await favoriteManager.syncFromCloud();
      const favSet = new Set((synced || []).filter(f => f.type === 'music').map(f => f.id));
      this.setData({ isFavorite: favSet.has(currentSong._id) });
    } catch (_) {}
  },

  // 获取真实链接辅助函数
  getRealUrl: function(url, cache) {
    if (!url) return '';
    if (url.startsWith('cloud://')) {
      // 增加日志，查看是否命中了缓存
      const hit = cache[url] ? true : false;
      // console.log('Link conversion check:', url, 'Hit:', hit);
      return cache[url] ? cache[url].url : ''; 
    }
    return url;
  },

  ensureCloudUrlsForSong: async function(song) {
    if (!song || typeof song !== 'object') return song;
    const out = { ...song };
    const cloud = getApp().cloud || wx.cloud;
    const need = [];
    if (out.audioUrl && out.audioUrl.startsWith('cloud://')) {
      need.push(out.audioUrl);
    }
    if (out.videoUrl && out.videoUrl.startsWith('cloud://')) {
      need.push(out.videoUrl);
    }
    if (out.rawImageId && out.rawImageId.startsWith('cloud://')) {
      need.push(out.rawImageId);
    }
    if (out.imageUrl && out.imageUrl.startsWith('cloud://')) {
      need.push(out.imageUrl);
    }
    if (out.rawPosterId && out.rawPosterId.startsWith('cloud://')) {
      need.push(out.rawPosterId);
    }
    if (out.posterUrl && out.posterUrl.startsWith('cloud://')) {
      need.push(out.posterUrl);
    }
    if (need.length > 0) {
      try {
        const r = await cloud.getTempFileURL({ fileList: need });
        const map = {};
        (r.fileList || []).forEach(f => { if (f.status === 0) map[f.fileID] = f.tempFileURL; });
        if (out.audioUrl && out.audioUrl.startsWith('cloud://')) {
          out.audioUrl = map[out.audioUrl] || out.audioUrl;
        }
        if (out.videoUrl && out.videoUrl.startsWith('cloud://')) {
          out.videoUrl = map[out.videoUrl] || out.videoUrl;
        }
        if (out.rawImageId && out.rawImageId.startsWith('cloud://')) {
          out.imageUrl = map[out.rawImageId] || out.imageUrl;
        }
        if (out.imageUrl && out.imageUrl.startsWith('cloud://')) {
          out.imageUrl = map[out.imageUrl] || out.imageUrl;
        }
        if (out.rawPosterId && out.rawPosterId.startsWith('cloud://')) {
          out.posterUrl = map[out.rawPosterId] || out.posterUrl;
        }
        if (out.posterUrl && out.posterUrl.startsWith('cloud://')) {
          out.posterUrl = map[out.posterUrl] || out.posterUrl;
        }
      } catch (_){}
    }
    return out;
  },

  // 初始化音频
  initAudio: function() {
    this.audioCtx = wx.getBackgroundAudioManager();
    const currentSong = this.data.currentSong;
    if (!currentSong || !currentSong.audioUrl) {
      wx.showToast({ title: '音频链接无效', icon: 'none' });
      return;
    }
    try { this.audioCtx.title = String(currentSong.title || '随身听'); } catch (_){}
    try { this.audioCtx.epname = String(currentSong.topic || '夏日庭院'); } catch (_){}
    try { this.audioCtx.singer = String(currentSong.artist || ''); } catch (_){}
    try { this.audioCtx.coverImgUrl = String(currentSong.posterUrl || currentSong.imageUrl || ''); } catch (_){}
    if (typeof currentSong.audioUrl === 'string' && currentSong.audioUrl.startsWith('cloud://')) {
      this.ensureCloudUrlsForSong(currentSong).then(prepared => {
        const safe = prepared || currentSong;
        if (safe && typeof safe.audioUrl === 'string' && /^https:\/\//.test(safe.audioUrl)) {
          this.setData({ currentSong: safe });
        }
      });
    }
    this.audioCtx.onPlay(() => {
      this.setData({ isPlaying: true });
      this.recordListenCount();
      this._lastPlayTs = Date.now();
    });
    this.audioCtx.onPause(() => {
      this.setData({ isPlaying: false });
      const now = Date.now();
      const recent = (this._lastPlayTs && (now - this._lastPlayTs < 800));
      if (recent && !this._pauseByUser) {
        this._pauseByUser = false;
        return;
      }
      if (this._bgmResumeTimer) { try { clearTimeout(this._bgmResumeTimer); } catch (_){ } this._bgmResumeTimer = null; }
      if (!this._desiredPlaying) {
        this._bgmResumeTimer = setTimeout(() => {
          this._bgmResumeTimer = null;
          if (!this._desiredPlaying) {
            try { if (getApp && typeof getApp === 'function') { getApp().playMusic(true); } } catch (_){}
          }
        }, 300);
      }
      this._pauseByUser = false;
    });
    this.audioCtx.onStop(() => {
      this.setData({ isPlaying: false });
    });
    this.audioCtx.onEnded(() => {
      this.nextSong();
    });
    this.audioCtx.onTimeUpdate(() => {
      const currentTime = this.audioCtx.currentTime;
      const duration = this.audioCtx.duration;
      if (Number.isFinite(duration) && duration > 0) {
        const progress = (currentTime / duration) * 100;
        this.updateProgressByTime(currentTime, duration, progress);
      }
    });
    this.audioCtx.onError((res) => {
      wx.showToast({ title: '播放失败', icon: 'none' });
    });
  },
  
  // 记录收听历史
  recordListenHistory: function() {
    const currentSong = this.data.currentSong;
    if (!currentSong || !currentSong._id) return;

    // 简单的防抖，避免频繁调用（比如播放/暂停切换时）
    const now = Date.now();
    if (this.lastRecordTime && (now - this.lastRecordTime < 30000)) {
      return; // 30秒内不重复记录同一首歌
    }
    this.lastRecordTime = now;

    const cloud = getApp().cloud || wx.cloud;
    cloud.callFunction({
      name: 'summer_listen',
      data: {
        songId: currentSong._id,
        title: currentSong.title,
        artist: currentSong.artist,
        duration: currentSong.duration
      }
    }).then(res => {
      console.log('收听记录已上传', res);
    }).catch(err => {
      console.error('收听记录上传失败', err);
    });
  },

  // 根据实际时间更新进度
  updateProgressByTime: function(currentTime, duration, progress) {
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    
    // 优先使用 audioCtx 的 duration，如果为 0 或无效，则尝试解析数据库中的 duration 字符串
    let totalTimeStr = '0:00';
    if (duration > 0) {
      const totalMinutes = Math.floor(duration / 60);
      const totalSeconds = Math.floor(duration % 60);
      totalTimeStr = `${totalMinutes}:${totalSeconds < 10 ? '0' : ''}${totalSeconds}`;
    } else if (this.data.currentSong.duration) {
      totalTimeStr = this.data.currentSong.duration;
    }
    
    const currentLyricsIndex = this.getCurrentLyricsIndex(currentTime);
    const currentLyricsLine = this.data.lyrics[currentLyricsIndex] || this.data.lyrics[0] || { time: 0, text: '' };

    this.setData({
      progress: progress,
      currentTime: timeStr,
      totalTime: totalTimeStr,
      currentLyricsIndex: currentLyricsIndex,
      currentLyricsLine: currentLyricsLine
    });
  },

  // 播放/暂停切换
  togglePlay: function () {
    if (getApp().playClickSound) getApp().playClickSound();

    // 播放前的 VIP 检查
    if (!this.data.isPlaying) {
      const currentSong = this.data.currentSong;
      if (currentSong && currentSong.isVip && !this.isVipValid()) {
        if (this.vipPreviewLocked) {
          this.setData({ showVipModal: true, isPlaying: false });
          return;
        }
      }
    }

    const isPlaying = !this.data.isPlaying;
    this.setData({
      isPlaying: isPlaying
    });
    this._desiredPlaying = isPlaying;
    
    if (isPlaying) {
      try { if (getApp && typeof getApp === 'function') { getApp().suppressBGM(); } } catch (_){}
      this.recordListenCount();
      if (getApp && typeof getApp === 'function' && getApp() && typeof getApp().stopMusic === 'function') {
        getApp().stopMusic();
      }
      this._pauseByUser = false;
      this._lastPlayTs = Date.now();
      if (this._bgmResumeTimer) { try { clearTimeout(this._bgmResumeTimer); } catch (_){ } this._bgmResumeTimer = null; }
    }
    
    // 如果是视频模式，优先仅控制视频，避免与音频同时操作
    const cur = this.data.currentSong || {};
    if (cur.videoUrl) {
      const videoContext = wx.createVideoContext('songVideo');
      if (isPlaying) {
        videoContext.play();
        const s2 = cur;
        if (s2 && s2.isVip && !this.isVipValid()) { this.startVipPreviewGate(); }
      } else {
        videoContext.pause();
        this.pauseVipPreviewGate();
        if (this._bgmResumeTimer) { try { clearTimeout(this._bgmResumeTimer); } catch (_){ } this._bgmResumeTimer = null; }
        try { if (getApp && typeof getApp === 'function') { getApp().releaseBGM(); getApp().playMusic(true); } } catch (_){}
      }
      return;
    }
    
    if (this.audioCtx) {
      if (isPlaying) {
        // console.log('用户点击播放');
        const s = this.data.currentSong;
        const setAndPlay = (url) => {
          if (typeof url === 'string' && url) {
            if (this.audioCtx.src !== url) {
              this.audioCtx.src = url;
            }
            try { if (getApp && typeof getApp === 'function') { getApp().suppressBGM(); } } catch (_){}
            try { this.audioCtx.play(); } catch (_){}
          } else {
            wx.showToast({ title: '音频链接无效', icon: 'none' });
            this.setData({ isPlaying: false });
          }
        };
        if (s && typeof s.audioUrl === 'string' && s.audioUrl.startsWith('cloud://')) {
          this.ensureCloudUrlsForSong(s).then(prepared => {
            const safe = prepared || s;
            this.setData({ currentSong: safe });
            const url = (safe && typeof safe.audioUrl === 'string' && /^https:\/\//.test(safe.audioUrl)) ? safe.audioUrl : '';
            setAndPlay(url);
          });
        } else {
          setAndPlay(s && s.audioUrl);
        }
        if (s && s.isVip && !this.isVipValid()) { this.startVipPreviewGate(); }
      } else {
        // console.log('用户点击暂停');
        this.audioCtx.pause();
        this.pauseVipPreviewGate();
        this._pauseByUser = true;
        if (this._bgmResumeTimer) { try { clearTimeout(this._bgmResumeTimer); } catch (_){ } this._bgmResumeTimer = null; }
        if (!this._desiredPlaying) {
          try { if (getApp && typeof getApp === 'function') { getApp().releaseBGM(); getApp().playMusic(true); } } catch (_){}
        }
      }
    } else {
      console.warn('audioCtx 未初始化，尝试重新初始化');
      this.initAudio();
    }
    
    // 如果有视频，控制视频播放
    if (this.data.currentSong.videoUrl) {
      const videoContext = wx.createVideoContext('songVideo');
      if (isPlaying) {
        videoContext.play();
        const s2 = this.data.currentSong;
        if (s2 && s2.isVip && !this.isVipValid()) { this.startVipPreviewGate(); }
      } else {
        videoContext.pause();
        this.pauseVipPreviewGate();
      }
    }
  },

  // 更新进度
  updateProgress: function (progress) {
    // 模拟时间显示
    const totalSeconds = 225; // 3:45
    const currentSeconds = Math.floor(totalSeconds * (progress / 100));
    
    const minutes = Math.floor(currentSeconds / 60);
    const seconds = currentSeconds % 60;
    const currentTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    
    const currentLyricsIndex = this.getCurrentLyricsIndex(currentSeconds);
    const currentLyricsLine = this.data.lyrics[currentLyricsIndex] || this.data.lyrics[0] || { time: 0, text: '' };

    this.setData({
      progress: progress,
      currentTime: currentTime,
      currentLyricsIndex: currentLyricsIndex,
      currentLyricsLine: currentLyricsLine
    });
  },

  // 获取当前歌词行索引
  getCurrentLyricsIndex: function(currentSeconds) {
    const lyrics = this.data.lyrics;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      const start = Number(lyrics[i]?.time ?? lyrics[i]?.start ?? 0);
      if (Number.isFinite(start) && currentSeconds >= start) {
        return i;
      }
    }
    return 0;
  },

  // 移除重复的 togglePlay 定义
  // 之前的代码可能存在多个 togglePlay 定义，导致逻辑冲突或覆盖
  // 此处不需要额外的 togglePlay 定义，因为上面已经定义了一个完整的 togglePlay

  // 上一首
  prevSong: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    let index = this.data.currentSongIndex;
    if (this.data.playMode === 'random') {
       index = Math.floor(Math.random() * this.data.playlist.length);
    } else {
       index = index - 1;
       if (index < 0) {
         index = this.data.playlist.length - 1;
       }
    }
    this.selectSong({ currentTarget: { dataset: { index: index } } });
  },

  // 下一首
  nextSong: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    let index = this.data.currentSongIndex;
    if (this.data.playMode === 'random') {
       index = Math.floor(Math.random() * this.data.playlist.length);
    } else {
       index = index + 1;
       if (index >= this.data.playlist.length) {
         index = 0;
       }
    }
    this.selectSong({ currentTarget: { dataset: { index: index } } });
  },

  // 搜索输入
  onSearchInput: function(e) {
    this.setData({
      searchQuery: e.detail.value
    });
    this.filterPlaylist();
  },
  onTypeChange: function(e) {
    const idx = e.detail.value;
    const opts = this.data.typeOptions || [];
    const text = opts[idx] || '类型';
    this.setData({
      typeIndex: idx,
      selectedTypeText: text,
      filterType: text === '类型' ? 'all' : text
    });
    this.filterPlaylist();
  },
  toggleTypeDropdown: function() {
    this.setData({
      showTypeDropdown: !this.data.showTypeDropdown
    });
  },
  togglePersonDropdown: function() {
    this.setData({
      showPersonDropdown: !this.data.showPersonDropdown
    });
  },
  selectPerson: function(e) {
    const text = (e.currentTarget.dataset.person || '').trim();
    const idx = (this.data.personOptions || []).indexOf(text);
    this.setData({
      selectedPersonText: text || '作者',
      filterPerson: (text === '作者') ? 'all' : text,
      personIndex: idx >= 0 ? idx : 0,
      showPersonDropdown: false
    });
    this.filterPlaylist();
  },
  selectType: function(e) {
    const text = (e.currentTarget.dataset.type || '').trim();
    const idx = (this.data.typeOptions || []).indexOf(text);
    this.setData({
      selectedTypeText: text || '类型',
      filterType: (text === '类型') ? 'all' : text,
      typeIndex: idx >= 0 ? idx : 0,
      showTypeDropdown: false
    });
    this.filterPlaylist();
  },
  toggleTopicDropdown: function() {
    this.setData({
      showTopicDropdown: !this.data.showTopicDropdown
    });
  },
  selectTopic: function(e) {
    const text = (e.currentTarget.dataset.topic || '').trim();
    const idx = (this.data.topicOptions || []).indexOf(text);
    this.setData({
      selectedTopicText: text || '专题',
      filterTopic: (text === '专题') ? 'all' : text,
      topicIndex: idx >= 0 ? idx : 0,
      showTopicDropdown: false
    });
    this.filterPlaylist();
  },
  onDateChange: function(e) {
    this.setData({
      filterDate: e.detail.value
    });
    this.filterPlaylist();
  },
  clearFilterDate: function() {
    if (getApp().playClickSound) getApp().playClickSound();
    this.setData({
      filterDate: ''
    });
    this.filterPlaylist();
  },
  resetFilters: function() {
    if (getApp().playClickSound) getApp().playClickSound();
    this.setData({
      searchQuery: '',
      filterFavorite: false,
      selectedTypeText: '类型',
      filterType: 'all',
      typeIndex: 0,
      showTypeDropdown: false,
      showPersonDropdown: false,
      showTopicDropdown: false,
      personIndex: 0,
      selectedPersonText: '作者',
      filterPerson: 'all',
      selectedTopicText: '专题',
      filterTopic: 'all',
      topicIndex: 0
    });
    this.filterPlaylist();
  },

  // 切换收藏筛选
  toggleFilterFavorite: function() {
    if (getApp().playClickSound) getApp().playClickSound();
    this.setData({
      filterFavorite: !this.data.filterFavorite
    });
    this.filterPlaylist();
  },

  // 筛选播放列表 (核心逻辑)
  getFilteredPlaylist: function(playlist, searchQuery, filterFavorite) {
    const query = (searchQuery || '').toString().toLowerCase().trim();
    const filterType = this.data.filterType || 'all';
    const filterPerson = this.data.filterPerson || 'all';
    const filterTopic = this.data.filterTopic || 'all';

    return (playlist || []).map((item, index) => {
      return { ...item, originalIndex: index };
    }).filter(item => {
      const title = (item.title || '').toString().toLowerCase();
      const artist = (item.artist || '').toString().toLowerCase();
      const matchSearch = title.includes(query) || artist.includes(query);
      const matchFavorite = filterFavorite ? item.isFavorite : true;
      const typeVal = item.type;
      const matchType = filterType === 'all' ? true : (Array.isArray(typeVal) ? typeVal.includes(filterType) : (String(typeVal || '') === filterType));
      const matchPerson = filterPerson === 'all' ? true : ((item.artist || '') === filterPerson);
      const topicNorm = this.normalizeTopicName(item.topic || '');
      const matchTopic = filterTopic === 'all' ? true : (topicNorm === filterTopic);
      return matchSearch && matchFavorite && matchType && matchPerson && matchTopic;
    });
  },

  // 响应搜索和筛选操作 (UI交互入口)
  filterPlaylist: function() {
    const { playlist, searchQuery, filterFavorite } = this.data;
    const full = this.getFilteredPlaylist(playlist, searchQuery, filterFavorite);

    const limited = full.slice(0, this.data.displayLimit || full.length);
    console.log('Filter applied:', { query: searchQuery, filterFavorite, count: limited.length });
    
    this.setData({
      displayPlaylist: limited
    });
  },
  buildPersonOptions: function(list) {
    const set = new Set();
    (list || []).forEach(it => {
      const a = (it && it.artist) ? String(it.artist).trim() : '';
      if (a) set.add(a);
    });
    const arr = Array.from(set);
    arr.sort((a, b) => {
      const ia = (a || '').toString().trim().charAt(0).toUpperCase() || '#';
      const ib = (b || '').toString().trim().charAt(0).toUpperCase() || '#';
      if (ia === ib) return a.localeCompare(b);
      return ia.localeCompare(ib);
    });
    return ['作者', ...arr];
  },
  buildTypeOptions: function(list) {
    const set = new Set();
    (list || []).forEach(it => {
      const t = it && it.type;
      if (Array.isArray(t)) {
        t.forEach(x => {
          const v = String(x || '').trim();
          if (v) set.add(v);
        });
      } else {
        const v = String(t || '').trim();
        if (v) set.add(v);
      }
    });
    const arr = Array.from(set);
    arr.sort((a, b) => {
      const ia = (a || '').toString().trim().charAt(0).toUpperCase() || '#';
      const ib = (b || '').toString().trim().charAt(0).toUpperCase() || '#';
      if (ia === ib) return a.localeCompare(b);
      return ia.localeCompare(ib);
    });
    return ['类型', ...arr];
  },
  buildTopicOptions: function(list) {
    const set = new Set();
    (list || []).forEach(it => {
      const t = this.normalizeTopicName(it && it.topic);
      if (t) set.add(t);
    });
    const arr = Array.from(set);
    arr.sort((a, b) => {
      const ia = (a || '').toString().trim().charAt(0).toUpperCase() || '#';
      const ib = (b || '').toString().trim().charAt(0).toUpperCase() || '#';
      if (ia === ib) return a.localeCompare(b);
      return ia.localeCompare(ib);
    });
    return ['专题', ...arr];
  },
  getInitialLetter: function(str) {
    const s = (str || '').toString().trim();
    if (!s) return '#';
    const letter = s.match(/[A-Za-z]/);
    if (letter) return letter[0].toUpperCase();
    const digit = s.match(/[0-9]/);
    if (digit) return digit[0];
    return '#';
  },
  onScrollToLower: function() {
    const limit = this.data.displayLimit || 30;
    const inc = this.data.displayIncrement || 30;
    const total = this.getFilteredPlaylist(this.data.playlist, this.data.searchQuery, this.data.filterFavorite).length;
    const nextLimit = Math.min(limit + inc, total);
    if (nextLimit !== limit) {
      this.setData({ displayLimit: nextLimit });
      this.filterPlaylist();
    }
  },
  
  openSongPrint: function(e) {
    if (getApp().playClickSound) getApp().playClickSound();
    const songId = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id;
    if (!songId) {
      wx.showToast({ title: '缺少歌曲ID', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/music-print/music-print?songId=${songId}`
    });
  },

  // 切歌逻辑
  changeSong: async function(index) {
    if (index === this.data.currentSongIndex) return;

    const base = this.data.playlist[index];

    this.resetVipPreviewGate();

    const prepared = await this.ensureCloudUrlsForSong(base);
    let nextLyrics = prepared && prepared.lyrics ? prepared.lyrics : [];
    if ((!nextLyrics || nextLyrics.length === 0) && prepared && prepared.vtt && typeof prepared.vtt === 'string' && prepared.vtt.trim()) {
      nextLyrics = parseWebVttToLyrics(prepared.vtt);
    }

    this.setData({
      currentSongIndex: index,
      currentSong: prepared,
      lyrics: nextLyrics,
      currentLyricsIndex: 0,
      currentLyricsLine: nextLyrics[0] || { time: 0, text: '' },
      isFavorite: prepared && prepared.isFavorite,
      isPlaying: false,
      progress: 0,
      currentTime: '0:00',
      totalTime: prepared && prepared.duration ? prepared.duration : '0:00'
    });

    this.initAudio();
    // this.checkFavoriteStatus(); // 已废弃，直接使用上面的 setData 更新
  },
  closeVipModal: function() {
    this.vipPreviewLocked = true;
    this.setData({ showVipModal: false });
  },
  goToVip: function() {
    this.vipPreviewLocked = true;
    wx.navigateTo({ url: '/pages/vip/vip' });
    this.setData({ showVipModal: false });
  },
  
  // 选择列表中的歌曲
  selectSong: function(e) {
    if (getApp().playClickSound) getApp().playClickSound();
    // 这里传入的是 originalIndex，因为我们在 filterPlaylist 中把它存进去了
    // 如果没有筛选，e.currentTarget.dataset.index 就是 originalIndex
    // 但为了安全，我们在 wxml 中使用 data-index="{{item.originalIndex}}"
    const index = e.currentTarget.dataset.index;
    this.changeSong(index);
    this.setData({
      showPlaylist: false
    });
  },


  // 下载歌曲
  downloadSong: async function () {
    if (getApp().playClickSound) getApp().playClickSound();
    const currentSong = this.data.currentSong || {};
    let src = currentSong.audioUrl || currentSong.videoUrl || '';
    const isVideo = !!currentSong.videoUrl && !currentSong.audioUrl;
    if (!src) {
      wx.showToast({ title: '暂无可下载资源', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '下载中...' });
      if (src.startsWith('http://')) {
        wx.hideLoading();
        wx.showToast({ title: '需HTTPS链接', icon: 'none' });
        return;
      }
      if (src.startsWith('cloud://')) {
        try {
          const cloud = getApp().cloud || wx.cloud;
          const res = await cloud.getTempFileURL({ fileList: [src] });
          if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
            src = res.fileList[0].tempFileURL;
          }
        } catch (_) {}
      }
      if (!/^https:\/\//.test(src)) {
        wx.hideLoading();
        wx.showToast({ title: '资源不可下载', icon: 'none' });
        return;
      }
      wx.downloadFile({
        url: src,
        success: (res) => {
          if (res.statusCode === 200) {
            wx.hideLoading();
            const tempPath = res.tempFilePath;
            if (isVideo) {
              wx.getSetting({
                success: (st) => {
                  const granted = !!(st.authSetting && st.authSetting['scope.writePhotosAlbum']);
                  const doSave = () => {
                    wx.saveVideoToPhotosAlbum({
                      filePath: tempPath,
                      success: () => wx.showToast({ title: '已保存到相册' }),
                      fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
                    });
                  };
                  if (granted) {
                    doSave();
                  } else {
                    wx.authorize({
                      scope: 'scope.writePhotosAlbum',
                      success: doSave,
                      fail: () => {
                        wx.showModal({
                          title: '提示',
                          content: '需要相册权限才能保存视频',
                          showCancel: false,
                          confirmText: '好的'
                        });
                      }
                    });
                  }
                }
              });
            } else {
              const fs = wx.getFileSystemManager();
              const extMatch = (src.split('?')[0] || '').match(/\.(mp3|m4a|aac|wav|flac|ogg)$/i);
              const ext = extMatch ? '.' + extMatch[1].toLowerCase() : '.mp3';
              const savePath = `${wx.env.USER_DATA_PATH}/summer_music_${Date.now()}${ext}`;
              try {
                fs.saveFile({
                  tempFilePath: tempPath,
                  filePath: savePath,
                  success: () => {
                    wx.setClipboardData({
                      data: src,
                      success: () => wx.showModal({ title: '提示', content: '已复制下载链接，请在浏览器粘贴下载', showCancel: false, confirmText: '好的' })
                    });
                  },
                  fail: () => {
                    wx.showToast({ title: '保存失败', icon: 'none' });
                  }
                });
              } catch (_) {
                wx.showToast({ title: '保存失败', icon: 'none' });
              }
            }
          } else {
            wx.hideLoading();
            wx.showToast({ title: `下载失败(${res.statusCode})`, icon: 'none' });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          const msg = (err && err.errMsg) ? err.errMsg : '下载失败';
          wx.showToast({ title: msg, icon: 'none' });
          try {
            wx.setClipboardData({
              data: src,
              success: () => wx.showModal({ title: '提示', content: '已复制下载链接，请在浏览器粘贴下载', showCancel: false, confirmText: '好的' })
            });
          } catch(_) {}
        }
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '下载失败', icon: 'none' });
    }
  },

  // 切换播放模式
  cyclePlayMode: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    const modes = ['list', 'single', 'random'];
    let currentModeIndex = modes.indexOf(this.data.playMode);
    let nextModeIndex = (currentModeIndex + 1) % modes.length;
    let nextMode = modes[nextModeIndex];
    
    this.setData({
      playMode: nextMode
    });
    
    let modeName = '列表循环';
    if (nextMode === 'single') modeName = '单曲循环';
    else if (nextMode === 'random') modeName = '随机播放';
    
    wx.showToast({
      title: modeName,
      icon: 'none'
    });
  },

  // 收藏/取消收藏
  toggleFavorite: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    const isFavorite = !this.data.isFavorite;
    const currentSong = this.data.currentSong;
    const index = this.data.currentSongIndex;
    
    // 乐观更新
    const up = `playlist[${index}].isFavorite`;
    this.setData({ isFavorite, [up]: isFavorite });
    
    // 统一收藏管理器写入/删除，并云端同步
    const songForManager = { ...currentSong, id: currentSong._id };
    if (isFavorite) {
      favoriteManager.add(songForManager, 'music');
      wx.showToast({ title: '已收藏', icon: 'success' });
    } else {
      favoriteManager.remove(currentSong._id, 'music');
      wx.showToast({ title: '已取消', icon: 'none' });
    }
    
    // 如果开启了收藏筛选，需要重新筛选列表
    if (this.data.filterFavorite) {
      this.filterPlaylist();
    }
  },

  // 设置播放倍速
  setPlaybackRate: function(e) {
    if (getApp().playClickSound) getApp().playClickSound();
    const rate = parseFloat(e.currentTarget.dataset.rate);
    this.setData({
      playbackRate: rate
    });
    wx.showToast({
      title: `${rate}x 倍速`,
      icon: 'none',
      duration: 1000
    });
    let sdkOk = true;
    try {
      const info = wx.getSystemInfoSync();
      const sdk = String(info.SDKVersion || '0.0.0').split('.').map(n => parseInt(n || '0', 10));
      const need = [2,11,0];
      const cmp = (a,b) => (a[0]-b[0]) || (a[1]-b[1]) || (a[2]-b[2]);
      sdkOk = cmp(sdk, need) >= 0;
    } catch (_){}
    if (this.data.currentSong && this.data.currentSong.videoUrl) {
      const videoContext = wx.createVideoContext('songVideo');
      try { 
        videoContext.playbackRate(rate); 
        if (this.data.isPlaying) {
          try { videoContext.pause(); } catch (_){}
          setTimeout(() => { try { videoContext.playbackRate(rate); videoContext.play(); } catch (_){ } }, 80);
        }
      } catch (_){ }
    }
    if (this.audioCtx) {
      const supportsRate = (typeof this.audioCtx.playbackRate !== 'undefined');
      if (!supportsRate && !this.data.currentSong.videoUrl) {
        wx.showToast({ title: '后台播放不支持倍速', icon: 'none' });
        return;
      }
      if (!sdkOk) {
        wx.showToast({ title: '设备倍速不支持', icon: 'none' });
        return;
      }
      try {
        if (this.data.isPlaying) {
          try { this.audioCtx.pause(); } catch (_){}
          this.audioCtx.playbackRate = rate;
          setTimeout(() => { 
            try { 
              this.audioCtx.playbackRate = rate; 
              this.audioCtx.play(); 
            } catch (_){ } 
          }, 80);
        } else {
          this.audioCtx.playbackRate = rate;
          setTimeout(() => { try { this.audioCtx.playbackRate = rate; } catch (_){ } }, 100);
        }
      } catch (_){}
    }
  },

  // 设置字体大小
  setFontSize: function(e) {
    if (getApp().playClickSound) getApp().playClickSound();
    const size = e.currentTarget.dataset.size;
    this.setData({
      fontSize: size
    });
    const sizeText = {
      'small': '小',
      'medium': '中',
      'large': '大'
    };
    wx.showToast({
      title: `字体大小: ${sizeText[size]}`,
      icon: 'none',
      duration: 1000
    });
  },

  // 设置字体颜色
  setFontColor: function(e) {
    if (getApp().playClickSound) getApp().playClickSound();
    const color = e.currentTarget.dataset.color;
    this.setData({
      fontColor: color
    });
    const colorText = {
      'black': '黑色',
      'white': '白色',
      'green': '绿色',
      'blue': '蓝色',
      'red': '红色',
      'goose': '鹅黄色'
    };
    wx.showToast({
      title: `字体颜色: ${colorText[color]}`,
      icon: 'none',
      duration: 1000
    });
  },

  // 增加字体大小
  increaseFontSize: function() {
    // 这里可以添加字体大小调整逻辑
    wx.showToast({
      title: '字体放大',
      icon: 'none',
      duration: 1000
    });
  },

  // 减少字体大小
  decreaseFontSize: function() {
    // 这里可以添加字体大小调整逻辑
    wx.showToast({
      title: '字体缩小',
      icon: 'none',
      duration: 1000
    });
  },

  // 切换展开面板
  togglePanel: function(e) {
    if (getApp().playClickSound) getApp().playClickSound();
    const panel = e.currentTarget.dataset.panel;
    const currentPanel = this.data.activePanel;

    // 如果点击的是当前激活的面板，则关闭
    // 否则打开新的面板
    this.setData({
      activePanel: currentPanel === panel ? null : panel
    });
  },

  // 关闭展开面板（点击遮罩层）
  closePanel: function() {
    if (getApp().playClickSound) getApp().playClickSound();
    this.setData({
      activePanel: null
    });
  },

  // 切换播放列表
  togglePlaylist: function() {
    if (getApp().playClickSound) getApp().playClickSound();
    this.setData({
      showPlaylist: !this.data.showPlaylist
    });
  },
  startVipPreviewGate: function() {
    const now = Date.now();
    let left = 30000;
    if (this.vipPreviewDeadline && this.vipPreviewDeadline > now) {
      left = this.vipPreviewDeadline - now;
    } else {
      this.vipPreviewDeadline = now + 30000;
    }
    if (this.vipPreviewTimer) { try { clearTimeout(this.vipPreviewTimer); } catch (_){ } }
    this.vipPreviewTimer = setTimeout(() => { this.triggerVipGate(); }, Math.max(0, left));
  },
  pauseVipPreviewGate: function() {
    if (this.vipPreviewTimer) { try { clearTimeout(this.vipPreviewTimer); } catch (_){ } this.vipPreviewTimer = null; }
  },
  resetVipPreviewGate: function() {
    if (this.vipPreviewTimer) { try { clearTimeout(this.vipPreviewTimer); } catch (_){ } this.vipPreviewTimer = null; }
    this.vipPreviewDeadline = null;
  },
  triggerVipGate: function() {
    this.vipPreviewTimer = null;
    this.vipPreviewDeadline = null;
    this.vipPreviewLocked = true;
    try { if (this.audioCtx) this.audioCtx.pause(); } catch (_){}
    try { const vc = wx.createVideoContext('songVideo'); vc.pause(); } catch (_){}
    this.setData({ isPlaying: false, showVipModal: true });
  },
  
  normalizeBoolean: function(v) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = String(v).trim().toLowerCase();
    if (s === 'false' || s === '0' || s === 'no' || s === 'n' || s === '') return false;
    if (s === 'true' || s === '1' || s === 'yes' || s === 'y') return true;
    return !!v;
  },
  parseDateString: function(str) {
    if (!str || typeof str !== 'string') return null;
    let s = str.trim();
    if (/年|月|日/.test(s)) {
      s = s.replace('年', '-').replace('月', '-').replace('日', '');
    }
    s = s.replace(/\./g, '-').replace(/\//g, '-');
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d;
  },
  isVipValid: function() {
    const info = wx.getStorageSync('userInfo') || {};
    const rawVip = (info && typeof info.isVip !== 'undefined') ? info.isVip : wx.getStorageSync('isVip');
    const isVip = this.normalizeBoolean(rawVip);
    if (!isVip) return false;
    const expiryStr = wx.getStorageSync('vipExpiry');
    if (!expiryStr) return true;
    const expiry = this.parseDateString(expiryStr);
    if (!expiry) return true;
    const now = new Date();
    return expiry.getTime() >= now.getTime();
  },

  // 重新同步收藏并刷新列表显示
  refreshFavorites: async function() {
    try {
      const synced = await favoriteManager.syncFromCloud();
      const favSet = new Set((synced || []).filter(f => f.type === 'music').map(f => f.id));
      const updatedPlaylist = (this.data.playlist || []).map(item => ({
        ...item,
        isFavorite: favSet.has(item._id)
      }));
      const displayPlaylist = this.getFilteredPlaylist(updatedPlaylist, this.data.searchQuery, this.data.filterFavorite);
      this.setData({
        playlist: updatedPlaylist,
        displayPlaylist: displayPlaylist,
        isFavorite: updatedPlaylist[this.data.currentSongIndex]?.isFavorite || false
      });
    } catch (_) {}
  },

  // 记录收听数量
  recordListenCount: function() {
    const currentSong = this.data.currentSong;
    const songKey = `${currentSong.title}-${currentSong.artist}`;

    let listenedSongs = wx.getStorageSync('listenedSongs') || [];

    // 检查这首歌是否已经记录过
    if (!listenedSongs.includes(songKey)) {
      listenedSongs.push(songKey);
      wx.setStorageSync('listenedSongs', listenedSongs);
    }
  }
})
