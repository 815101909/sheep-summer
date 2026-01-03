// pages/music/music.js
const favoriteManager = require('../../utils/favoriteManager');

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
    lyrics: [
      { time: 0, text: '夏日的微风轻拂着海岸线' },
      { time: 30, text: '海浪轻轻拍打着沙滩' },
      { time: 60, text: '夕阳洒下金色的余晖' },
      { time: 90, text: '照亮了我们相遇的瞬间' },
      { time: 120, text: '初夏的夜晚星空璀璨' },
      { time: 150, text: '月光洒满整个海湾' },
      { time: 180, text: '让我们一起唱起这首小夜曲' },
      { time: 210, text: '在夏日的夜晚久久回荡' }
    ]
  },

  onLoad: function (options) {
    // 获取歌曲列表
    this.getMusicList();
  },

  onShow: function () {
    // 重新进入页面时同步收藏，保持心形与筛选正确
    if (typeof this.refreshFavorites === 'function') {
      this.refreshFavorites();
    }
  },

  onHide: function () {
    // 页面隐藏时暂停播放
    if (this.data.isPlaying) {
      this.togglePlay();
    }
  },

  onUnload: function () {
    // 页面卸载时清理定时器和音频
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
    }
    if (this.audioCtx) {
      this.audioCtx.destroy();
    }
  },

  // 获取歌曲列表
  getMusicList: function() {
    wx.showLoading({
      title: '加载中...',
      // 记录收听数量
  recordListenCount: function() {
    const currentSong = this.data.currentSong;
    console.log('Summer Music recordListenCount called', currentSong);

    if (!currentSong) return;
    
    // 优先使用数据库ID，如果没有则降级使用 title-artist
    const songId = currentSong._id || `${currentSong.title}-${currentSong.artist}`;
    const today = new Date().toDateString();
    
    // 组合 Key: 歌曲ID_日期 (按天去重)
    const recordKey = `${songId}_${today}`;
    console.log('Summer Music Record Key:', recordKey);

    let listenedSongs = wx.getStorageSync('listenedSongs') || [];

    // 检查这首歌今天是否已经记录过
    if (!listenedSongs.includes(recordKey)) {
      listenedSongs.push(recordKey);
      wx.setStorageSync('listenedSongs', listenedSongs);
      console.log('Summer Music Recorded! New count:', listenedSongs.length);
      wx.showToast({ title: '收听+1', icon: 'none' });
    } else {
      console.log('Summer Music Already recorded today');
    }
  }
});

    const cloud = getApp().cloud || wx.cloud;
    
    // 改用云函数获取，以确保跨环境调用能正确获取到数据
    // 同时也利用云函数可以绕过前端直接查库可能存在的权限问题
    cloud.callFunction({
      name: 'summer_listen',
      data: {
        action: 'getMusicList'
      }
    }).then(res => {
      // console.log('云函数获取到的歌曲列表:', res.result.data);
      if (res.result && res.result.data && res.result.data.length > 0) {
        this.processMusicData(res.result.data);
      } else {
        wx.hideLoading();
        // console.warn('云函数返回数据为空或格式不对', res);
        // 如果云函数获取失败，暂时保留默认数据，或者提示无数据
        wx.showToast({
          title: '暂无歌曲',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('获取歌曲列表失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
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

    // 收集需要转换的云文件ID
    musicList.forEach(song => {
      if (song.audioUrl && song.audioUrl.startsWith('cloud://') && !cachedUrls[song.audioUrl]) {
        fileList.push(song.audioUrl);
      }
      if (song.videoUrl && song.videoUrl.startsWith('cloud://') && !cachedUrls[song.videoUrl]) {
        fileList.push(song.videoUrl);
      }
      if (song.image && song.image.startsWith('cloud://') && !cachedUrls[song.image]) {
        fileList.push(song.image);
      }
    });

    // 如果有需要转换的链接
    if (fileList.length > 0) {
      try {
        const cloud = getApp().cloud || wx.cloud;
        const result = await cloud.getTempFileURL({
          fileList: fileList
        });
        
        result.fileList.forEach(file => {
          if (file.status === 0) {
            cachedUrls[file.fileID] = {
              url: file.tempFileURL,
              timestamp: now
            };
          }
        });
        
        // 更新缓存
        wx.setStorageSync('music_urls_cache', cachedUrls);
      } catch (err) {
        console.error('获取临时链接失败:', err);
      }
    }

    // 获取收藏集合并构建命中集
    let favSet = new Set();
    try {
      const synced = await favoriteManager.syncFromCloud();
      favSet = new Set((synced || []).filter(f => f.type === 'music').map(f => f.id));
    } catch (_) {}

    // 替换原始数据中的链接，并带入收藏状态
    const processedList = musicList.map(song => ({
      ...song,
      audioUrl: this.getRealUrl(song.audioUrl, cachedUrls),
      videoUrl: this.getRealUrl(song.videoUrl, cachedUrls),
      imageUrl: this.getRealUrl(song.image, cachedUrls),
      duration: song.duration || '0:00',
      isFavorite: favSet.has(song._id)
    }));

    // 初始化显示的播放列表
    const displayPlaylist = this.getFilteredPlaylist(processedList, this.data.searchQuery, this.data.filterFavorite);

    this.setData({
      playlist: processedList,
      displayPlaylist: displayPlaylist, // 立即初始化显示列表
      currentSong: processedList[0],
      currentSongIndex: 0,
      lyrics: processedList[0].lyrics || [],
      isFavorite: processedList[0].isFavorite // 初始化第一首的收藏状态
    });

    // 初始化音频
    this.initAudio();
    
    wx.hideLoading();
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

  // 初始化音频
  initAudio: function() {
    if (this.audioCtx) {
      this.audioCtx.destroy();
    }
    
    this.audioCtx = wx.createInnerAudioContext();
    // 开启自动播放，或者在用户交互后播放
    this.audioCtx.autoplay = false; 

    const currentSong = this.data.currentSong;
    // console.log('初始化音频，当前歌曲:', currentSong);

    // 设置音频源，确保不是空字符串
    if (currentSong.audioUrl) {
      this.audioCtx.src = currentSong.audioUrl;
      // console.log('设置音频源 URL:', currentSong.audioUrl);
    } else {
      console.error('音频链接为空', currentSong);
      wx.showToast({
        title: '音频链接无效',
        icon: 'none'
      });
      return;
    }
    
    // 监听可以播放状态，尝试更新时长
    this.audioCtx.onCanplay(() => {
        // console.log('音频准备就绪，duration:', this.audioCtx.duration);
        if (this.audioCtx.duration > 0) {
             // 格式化时长
             const duration = this.audioCtx.duration;
             const totalMinutes = Math.floor(duration / 60);
             const totalSeconds = Math.floor(duration % 60);
             const totalTimeStr = `${totalMinutes}:${totalSeconds < 10 ? '0' : ''}${totalSeconds}`;
             
             this.setData({
                 totalTime: totalTimeStr
             });
        }
    });

    this.audioCtx.onPlay(() => {
      // console.log('开始播放');
      this.setData({ isPlaying: true });
      
      // 记录收听数量（按天统计）
      this.recordListenCount();
    });

    this.audioCtx.onPause(() => {
      // console.log('暂停播放');
      this.setData({ isPlaying: false });
    });
    
    this.audioCtx.onTimeUpdate(() => {
      // 只有在播放时才更新进度，避免干扰
      // if (!this.data.isPlaying) return; 
      
      const currentTime = this.audioCtx.currentTime;
      const duration = this.audioCtx.duration;
      
      // 更新进度条和时间
      if (duration > 0) {
        const progress = (currentTime / duration) * 100;
        this.updateProgressByTime(currentTime, duration, progress);
      }
    });
    
    this.audioCtx.onEnded(() => {
      this.nextSong();
    });
    
    this.audioCtx.onError((res) => {
      console.error('播放错误', res.errMsg);
      console.error('错误码:', res.errCode);
      wx.showToast({
        title: '播放失败: ' + res.errCode,
        icon: 'none'
      });
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
    
    // 更新当前歌词行
    const currentLyricsLine = this.data.lyrics.find((line, index) => {
      const nextLine = this.data.lyrics[index + 1];
      return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
    }) || this.data.lyrics[0];

    this.setData({
      progress: progress,
      currentTime: timeStr,
      totalTime: totalTimeStr,
      currentLyricsLine: currentLyricsLine
    });
  },

  // 播放/暂停切换
  togglePlay: function () {
    const isPlaying = !this.data.isPlaying;
    this.setData({
      isPlaying: isPlaying
    });
    
    if (isPlaying) {
      // 强制记录收听
      this.recordListenCount();
    }
    
    if (this.audioCtx) {
      if (isPlaying) {
        // console.log('用户点击播放');
        this.audioCtx.play();
      } else {
        // console.log('用户点击暂停');
        this.audioCtx.pause();
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
      } else {
        videoContext.pause();
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
    
    // 更新当前歌词行
    const currentLyricsLine = this.data.lyrics.find((line, index) => {
      const nextLine = this.data.lyrics[index + 1];
      return currentSeconds >= line.time && (!nextLine || currentSeconds < nextLine.time);
    }) || this.data.lyrics[0];

    this.setData({
      progress: progress,
      currentTime: currentTime,
      currentLyricsLine: currentLyricsLine
    });
  },

  // 获取当前歌词行索引
  getCurrentLyricsIndex: function(currentSeconds) {
    const lyrics = this.data.lyrics;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentSeconds >= lyrics[i].time) {
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
    // 确保 query 是字符串，避免 undefined 报错
    const query = (searchQuery || '').toString().toLowerCase().trim();

    return (playlist || []).map((item, index) => {
      return { ...item, originalIndex: index };
    }).filter(item => {
      // 筛选逻辑，确保 title 和 artist 存在
      const title = (item.title || '').toString().toLowerCase();
      const artist = (item.artist || '').toString().toLowerCase();
      
      const matchSearch = title.includes(query) || artist.includes(query);
      const matchFavorite = filterFavorite ? item.isFavorite : true;
      return matchSearch && matchFavorite;
    });
  },

  // 响应搜索和筛选操作 (UI交互入口)
  filterPlaylist: function() {
    const { playlist, searchQuery, filterFavorite } = this.data;
    const displayPlaylist = this.getFilteredPlaylist(playlist, searchQuery, filterFavorite);

    console.log('Filter applied:', { query: searchQuery, filterFavorite, count: displayPlaylist.length });
    
    this.setData({
      displayPlaylist: displayPlaylist
    });
  },

  // 切歌逻辑
  changeSong: function(index) {
    if (index === this.data.currentSongIndex) return;

    this.setData({
      currentSongIndex: index,
      currentSong: this.data.playlist[index],
      lyrics: this.data.playlist[index].lyrics || [],
      isFavorite: this.data.playlist[index].isFavorite, // 更新收藏状态
      isPlaying: false,
      progress: 0,
      currentTime: '0:00',
      totalTime: this.data.playlist[index].duration || '0:00'
    });

    this.initAudio();
    // this.checkFavoriteStatus(); // 已废弃，直接使用上面的 setData 更新
    
    // 自动播放
    setTimeout(() => {
      this.togglePlay();
    }, 100);
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
  downloadSong: function () {
    wx.showToast({
      title: '开始下载...',
      icon: 'loading'
    });
    // 这里添加实际的下载逻辑
    setTimeout(() => {
      wx.showToast({
        title: '下载完成',
        icon: 'success'
      });
    }, 1500);
  },

  // 切换播放模式
  cyclePlayMode: function () {
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
    const rate = parseFloat(e.currentTarget.dataset.rate);
    this.setData({
      playbackRate: rate
    });
    wx.showToast({
      title: `${rate}x 倍速`,
      icon: 'none',
      duration: 1000
    });
    // 这里可以添加实际的音频播放倍速设置逻辑
  },

  // 设置字体大小
  setFontSize: function(e) {
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
    this.setData({
      activePanel: null
    });
  },

  // 切换播放列表
  togglePlaylist: function() {
    this.setData({
      showPlaylist: !this.data.showPlaylist
    });
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
