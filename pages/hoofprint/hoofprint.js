// pages/hoofprint/hoofprint.js
const STATION_META = {
  charging: { id: 'charging', name: '抽取能量卡片' },
  supply: { id: 'supply', name: '勇气补给' },
  solitude: { id: 'solitude', name: '独处净土' },
  time: { id: 'time', name: '时光胶囊' },
  worry: { id: 'worry', name: '弹走烦恼' }
};

Page({

  /**
   * 页面的初始数据
   */
  data: {
    carouselItems: [], // 将动态生成
    todayGentleList: [],
    currentGentleIndex: 0,
    dailyTendernessItem: null,
    selectedDate: '', // 存储选择的日期
    selectedDateText: '', // 显示的日期文本
    selectedType: '全部', // 存储选择的类型
    selectedTypeText: '全部', // 显示的类型文本
    typeOptions: ['全部', '文化', '生活', '成长', '科技', '技能', '祝福', '思考', '学习', '旅行', '商业', '体育', '热词', '医疗', '健康', '历史', '人物', '节日'], // 类型选项
    showTypeDropdown: false, // 控制类型下拉列表显示隐藏
    timelineData: [], // 初始为空
    filteredTimelineData: [], // 存储筛选后的时间线数据
    displayFilteredTimelineData: [],
    displayLimit: 8,
    displayIncrement: 8,

    // 收藏状态
    favoriteArticles: [40, 41],
    favoriteKeys: [],

    // 顶部五个功能站点的显示/删除状态
    stationVisibility: {
      charging: true,
      supply: true,
      solitude: true,
      time: true,
      worry: true
    },
    deletedStations: [], // { id, name }

    // 顶部五个功能的拖拽坐标（相对于 journey-map 左上角，像素）
    stationPositions: {
      // charging: { x, y }, ...
    },
    // 拖拽中的中间状态
    dragState: {
      activeStation: '',
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0
    },
    // journey-map 的位置信息（像素）
    mapRect: null,
    
    // 能量卡片相关
    showEnergyCardModal: false, // 控制能量卡片弹窗显示
    energyCard: null, // 抽取到的能量卡片
    energyCardImage: '', // 能量卡片图片临时链接
    energyCardLoading: false, // 能量卡片加载状态
    forceEnergyCardRender: 0 // 强制能量卡片重新渲染的标志
  },

  gentleTimer: null,

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 默认不筛选日期，显示所有时间线内容
    this.setData({
      selectedDate: '',
      selectedDateText: '全部日期'
    });

    // 读取本地已删站点配置，更新可见性与底部列表
    try {
      const deleted = wx.getStorageSync('summer_deleted_stations') || [];
      const vis = {
        charging: true,
        supply: true,
        solitude: true,
        time: true,
        worry: true
      };
      (deleted || []).forEach(item => {
        if (item && item.id && Object.prototype.hasOwnProperty.call(vis, item.id)) {
          vis[item.id] = false;
        }
      });
      // 读取本地拖拽坐标（如果有）
      const savedPositions = wx.getStorageSync('summer_station_positions') || {};
      this.setData({
        stationVisibility: vis,
        deletedStations: deleted,
        stationPositions: savedPositions || {}
      });
    } catch (_) {}

    // 加载收藏状态
    const favoriteArticles = wx.getStorageSync('favoriteArticles') || [];
    this.setData({
      favoriteArticles: favoriteArticles
    });

    this.loadDailyTenderness();
    this.loadArticlesFromCloud();
  },

  loadDailyTenderness: async function() {
    try {
      const cached = wx.getStorageSync('summer_daily_tenderness_cache') || null;
      if (cached && cached.expiresAt && cached.expiresAt > Date.now() && cached.item) {
        this.setData({ dailyTendernessItem: cached.item });
        return;
      }
      await this.initCloud();
      const db = this.cloud.database();
      const res = await db.collection('summer_daily_tenderness')
        .orderBy('publish_time', 'desc')
        .limit(1)
        .get();
      if (res.data && res.data.length > 0) {
        const item = res.data[0];
        let pictureUrl = item.picture;
        if (pictureUrl && pictureUrl.startsWith('cloud://')) {
          try {
            const ttlMs = 2 * 60 * 60 * 1000;
            const tempMap = await this.convertTempUrlsWithCache(this.cloud, [pictureUrl], ttlMs);
            pictureUrl = tempMap[pictureUrl] || pictureUrl;
          } catch (_) {}
        }
        const dataItem = {
          id: item._id,
          cover: pictureUrl,
          publish_time: item.publish_time
        };
        this.setData({ dailyTendernessItem: dataItem });
        try {
          wx.setStorageSync('summer_daily_tenderness_cache', {
            item: dataItem,
            expiresAt: Date.now() + 3 * 60 * 60 * 1000
          });
        } catch (_) {}
      }
    } catch (err) {}
  },

  /**
   * 从云端加载文章数据
   */
  loadArticlesFromCloud: async function() {
    let hasCache = false;
    try {
      const cached = wx.getStorageSync('summer_timeline_cache') || null;
      if (cached && cached.expiresAt && cached.expiresAt > Date.now()) {
        this.setData({
          carouselItems: cached.carouselItems || [],
          timelineData: cached.timelineData || []
        });
        this.filterTimeline();
        this.computeTodayGentle();
        hasCache = true;
      }
    } catch (_) {}
    if (!hasCache) {
      wx.showLoading({ title: '加载中...' });
    }
    
    // 初始化跨环境云实例
    const c1 = new wx.cloud.Cloud({
      resourceAppid: 'wx85d92d28575a70f4', // 资源方 AppID
      resourceEnv: 'cloud1-1gsyt78b92c539ef', // 资源方环境 ID
    });
    await c1.init();

    const db = c1.database();

    try {
        // 直接查询 summer_hoofprint_articles 集合
        // 这里一次性获取，如果数据量大需要分页
        const MAX_LIMIT = 20;
        const res = await db.collection('summer_hoofprint_articles')
            .where({ status: true })
            .orderBy('publish_date', 'desc')
            .limit(MAX_LIMIT)
            .get();
            
        const articles = res.data;
        
        if (!articles || articles.length === 0) {
            wx.hideLoading();
            return;
        }

        // 收集需要转换的图片链接
        const fileList = [];
        articles.forEach(item => {
            if (item.cover_image && item.cover_image.startsWith('cloud://')) fileList.push(item.cover_image);
            if (item.a4_image && item.a4_image.startsWith('cloud://')) fileList.push(item.a4_image);
        });
        const fixedSmallCover = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/cover/轻松一夏.jpg';
        fileList.push(fixedSmallCover);

        // 批量换取临时链接
        let tempUrlMap = {};
        if (fileList.length > 0) {
            try {
                const ttlMs = 2 * 60 * 60 * 1000;
                tempUrlMap = await this.convertTempUrlsWithCache(c1, fileList, ttlMs);
            } catch (err) {
                console.error('图片链接转换失败', err);
            }
        }

        // 辅助函数：格式化日期 (时间戳 -> YYYY年MM月DD日)
        const formatDate = (timestamp) => {
            if (!timestamp) return '';
            if (typeof timestamp === 'string' && timestamp.includes('年')) return timestamp; // 已经是格式化好的字符串
            const date = new Date(timestamp);
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}年${month}月${day}日`;
        };

        // 处理文章数据
        const processedArticles = articles.map(item => {
            return {
                id: item._id,
                titleCn: item.title || '无标题',
                subtitle: item.subtitle || '',
                category: '未分类',
                date: formatDate(item.publish_date),
                cover: tempUrlMap[item.cover_image] || item.cover_image || '',
                a4Image: tempUrlMap[item.a4_image] || item.a4_image || '',
                level: item.level || 'low',
                smallCover: tempUrlMap[fixedSmallCover] || '',
                isCarousel: !!item.is_carousel
            };
        });

        // 1. 生成 timelineData (按日期分组)
        // 使用 Map 保持插入顺序（因为已经是倒序了）
        const timelineMap = new Map();
        
        processedArticles.forEach(article => {
            const date = article.date;
            if (!timelineMap.has(date)) {
                timelineMap.set(date, {
                    date: date,
                    articles: []
                });
            }
            timelineMap.get(date).articles.push(article);
        });
        
        const timelineData = Array.from(timelineMap.values());

        // 2. 生成 carouselItems (仅取 is_carousel 为 true 的前 5 个)
        const carouselItems = processedArticles.filter(article => article.isCarousel).slice(0, 5).map(article => ({
            id: article.id,
            title: article.titleCn,
            cover: article.cover,
            date: article.date,
            category: article.category,
            level: article.level
        }));

        this.setData({
            carouselItems: carouselItems,
            timelineData: timelineData
        });
        this.filterTimeline();
        this.computeTodayGentle();
        try {
          wx.setStorageSync('summer_timeline_cache', {
            carouselItems,
            timelineData,
            expiresAt: Date.now() + 10 * 60 * 1000
          });
        } catch (_) {}
        this.initCloud().then(() => this.loadFavoriteSet().then(() => this.filterTimeline())).catch(() => {});

    } catch (err) {
        console.error('获取文章失败', err);
        wx.showToast({ title: '获取数据失败', icon: 'none' });
    } finally {
        if (!hasCache) wx.hideLoading();
    }
  },
  getTempUrlCache() {
    return wx.getStorageSync('temp_url_cache_map') || {};
  },
  setTempUrlCache(map) {
    wx.setStorageSync('temp_url_cache_map', map || {});
  },
  getCachedTempUrl(fid) {
    if (!fid) return '';
    const map = this.getTempUrlCache();
    const e = map[fid];
    if (e && e.url && e.expiresAt && e.expiresAt > Date.now()) return e.url;
    return '';
  },
  setCachedTempUrl(fid, url, ttlMs) {
    if (!fid || !url) return;
    const map = this.getTempUrlCache();
    map[fid] = { url, expiresAt: Date.now() + (ttlMs || 0) };
    this.setTempUrlCache(map);
  },
  async convertTempUrlsWithCache(c1, fids, ttlMs) {
    const result = {};
    const toFetch = [];
    (fids || []).forEach(fid => {
      const u = this.getCachedTempUrl(fid);
      if (u) result[fid] = u;
      else toFetch.push(fid);
    });
    if (toFetch.length) {
      const secs = Math.max(1, Math.floor((ttlMs || 0) / 1000));
      const resp = await c1.getTempFileURL({ fileList: toFetch, config: { maxAge: secs } });
      const list = resp.fileList || [];
      list.forEach(it => {
        if (it.status === 0) {
          result[it.fileID] = it.tempFileURL;
          this.setCachedTempUrl(it.fileID, it.tempFileURL, ttlMs || 0);
        }
      });
    }
    return result;
  },

  computeTodayGentle: function () {
    const { carouselItems } = this.data;
    if (!carouselItems || carouselItems.length === 0) {
      this.setData({ todayGentleList: [], currentGentleIndex: 0 });
      return;
    }
    const candidates = carouselItems.slice(0, 5);
    this.setData({
      todayGentleList: candidates,
      currentGentleIndex: 0
    });
    this.startGentleTimer();
  },

  startGentleTimer: function() {
    this.stopGentleTimer();
    if (this.data.todayGentleList.length > 1) {
      this.gentleTimer = setInterval(() => {
        this.nextGentleSlide();
      }, 4000);
    }
  },

  stopGentleTimer: function() {
    if (this.gentleTimer) {
      clearInterval(this.gentleTimer);
      this.gentleTimer = null;
    }
  },

  nextGentleSlide: function() {
    const len = this.data.todayGentleList.length;
    if (len < 2) return;
    this.setData({
      currentGentleIndex: (this.data.currentGentleIndex + 1) % len
    });
  },

  prevGentleSlide: function() {
    const len = this.data.todayGentleList.length;
    if (len < 2) return;
    this.setData({
      currentGentleIndex: (this.data.currentGentleIndex - 1 + len) % len
    });
    this.startGentleTimer();
  },

  handleNextSlide: function() {
    if (getApp().playClickSound) getApp().playClickSound();
    this.nextGentleSlide();
    this.startGentleTimer();
  },

  handlePrevSlide: function() {
    if (getApp().playClickSound) getApp().playClickSound();
    this.prevGentleSlide();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    // 渲染完成后，计算 journey-map 和五个站点当前的实际位置，用于拖拽
    this.initStationPositions();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      })
    }
  },

  onTabItemTap: function () {
    if (getApp().playClickSound) getApp().playClickSound();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 日期选择器改变事件
   */
  bindDateChange: function (e) {
    const dateParts = e.detail.value.split('-');
    const formattedDate = `${dateParts[0]}年${dateParts[1]}月${dateParts[2]}日`;
    this.setData({
      selectedDate: e.detail.value,
      selectedDateText: formattedDate
    });
    wx.showToast({
      title: `选择了: ${formattedDate}`,
      icon: 'none'
    });
    this.filterTimeline();
  },

  /**
   * 选择全部日期
   */
  selectAllDates: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    this.setData({
      selectedDate: '',
      selectedDateText: '全部日期'
    });
    wx.showToast({
      title: '显示全部日期',
      icon: 'none'
    });
    this.filterTimeline();
  },

  /**
   * 显示日期选择器
   */
  showDatePicker: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    // 日期选择器会自动显示，因为picker组件绑定了showDatePicker事件
  },

  /**
   * 切换类型下拉列表显示/隐藏
   */
  toggleTypeDropdown: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    this.setData({
      showTypeDropdown: !this.data.showTypeDropdown
    });
  },

  toggleDifficultyDropdown: function () {
    this.setData({
      showDifficultyDropdown: !this.data.showDifficultyDropdown
    });
  },

  /**
   * 选择类型
   */
  selectType: function (e) {
    if (getApp().playClickSound) getApp().playClickSound();
    const type = e.currentTarget.dataset.type;
    this.setData({
      selectedType: type,
      selectedTypeText: type,
      showTypeDropdown: false // 选择后关闭下拉列表
    });
    wx.showToast({
      title: `筛选类型: ${type}`,
      icon: 'none'
    });
    this.filterTimeline();
  },

  selectDifficulty: function (e) {
    if (getApp().playClickSound) getApp().playClickSound();
    const difficulty = e.currentTarget.dataset.difficulty;
    this.setData({
      selectedDifficulty: difficulty,
      selectedDifficultyText: difficulty,
      showDifficultyDropdown: false
    });
    wx.showToast({
      title: `筛选难度: ${difficulty}`,
      icon: 'none'
    });
    this.filterTimeline();
  },

  /**
   * 生成轮播数据 - 从所有勾选的文章中获取
   */
  generateCarouselItems: function () {
    const { timelineData } = this.data;
    const selectedArticles = [];

    // 遍历所有日期的所有文章，收集勾选的文章
    timelineData.forEach(dateBlock => {
      dateBlock.articles.forEach(article => {
        if (article.selected) {
          selectedArticles.push({
            id: article.id,
            title: article.titleCn,
            cover: article.cover,
            date: dateBlock.date,
            category: article.category
          });
        }
      });
    });

    this.setData({
      carouselItems: selectedArticles
    });
  },

  /**
   * 筛选时间线数据
   */
  filterTimeline: function () {
    const { timelineData, selectedDate, selectedType } = this.data;
    let filteredData = timelineData;

    // 1. 按日期筛选 (精确匹配)
    if (selectedDate) {
      const dateText = this.data.selectedDateText;
      filteredData = filteredData.filter(item => item.date === dateText);
    }

    // 2. 按类型筛选
    if (selectedType !== '全部') {
      filteredData = filteredData.filter(dateBlock => {
        // 检查这个日期块是否包含指定类型的文章
        const hasMatchingArticle = dateBlock.articles.some(article => {
          return article.category !== '放松' && article.titleCn.startsWith(selectedType + '｜');
        });

        // 如果包含指定类型的文章，保留整个日期块
        if (hasMatchingArticle) {
          return true;
        }

        // 如果不包含指定类型的文章，移除整个日期块
        return false;
      });
    }

    // 3. 移除了难度筛选

    const favSet = new Set(this.data.favoriteKeys || []);
    filteredData = filteredData.map(dateBlock => {
      const articles = (dateBlock.articles || []).map(a => ({
        ...a,
        isFavoritedMain: favSet.has(`${a.id}_main`),
        isFavoritedSmall: favSet.has(`${a.id}_small`)
      }));
      return { ...dateBlock, articles };
    });
    const limit = this.data.displayLimit || filteredData.length;
    this.setData({
      filteredTimelineData: filteredData,
      displayFilteredTimelineData: filteredData.slice(0, limit)
    });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {
    const full = this.data.filteredTimelineData || [];
    const limit = this.data.displayLimit || 0;
    const inc = this.data.displayIncrement || 6;
    const next = Math.min(limit + inc, full.length);
    if (next > limit) {
      this.setData({ displayLimit: next, displayFilteredTimelineData: full.slice(0, next) });
    }
  },

  /**
   * 打开轮播文章详情页面
   */
  openCarouselArticle: function (e) {
    if (getApp().playClickSound) getApp().playClickSound();
    const { article } = e.currentTarget.dataset;

    // 记录阅读数量（按天+ID统计）
    if (article && article.id) {
      this.recordReadCount(article.id);
    }

    wx.navigateTo({
      url: `/pages/article-detail/article-detail?articleId=${article.id}&isSmallCard=false`,
      success: function() {
        console.log('从轮播跳转到短文详情页面成功', article.id);
      },
      fail: function(err) {
        console.error('跳转失败', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 打开短文详情页面
   */
  openArticleDetail: function (e) {
    if (getApp().playClickSound) getApp().playClickSound();
    const { article, date, cardType } = e.currentTarget.dataset;

    // 记录阅读数量（按日期统计）
    if (date) {
      this.recordReadCount(date);
    }

    // 检测是否为小卡片
    const isSmallCard = cardType === 'small';

    wx.navigateTo({
      url: `/pages/article-detail/article-detail?articleId=${article.id}&isSmallCard=${isSmallCard}`,
      success: function() {
        console.log('跳转到短文详情页面成功', article.id, isSmallCard ? '小卡片' : '主卡片');
      },
      fail: function(err) {
        console.error('跳转失败', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 顶部闯关地图：点击站点
   */
  tapStation: function (e) {
    if (getApp().playClickSound) getApp().playClickSound();
    const station = e.currentTarget.dataset.station;
    
    // 如果是抽取能量卡片站点，执行抽取功能
    if (station === 'charging') {
      // 使用延迟确保页面渲染完成
      setTimeout(() => {
        this.drawEnergyCard();
      }, 50);
      return;
    }
    
    const article = this.getLatestArticleForStation();

    if (!article || !article.id) {
      wx.showToast({
        title: '暂时没有可以体验的小卡片',
        icon: 'none'
      });
      return;
    }

    let url = `/pages/article-detail/article-detail?articleId=${article.id}`;
    if (station === 'worry') {
      url += '&isSmallCard=true';
    } else {
      const map = { supply: 1, solitude: 2, time: 3 };
      const idx = map[station];
      if (idx !== undefined) {
        url += `&styleIndex=${idx}&singleStation=1`;
      }
    }

    wx.navigateTo({ url });
  },

  /**
   * 跳转到“一起守护绵羊副本”页面
   */
  goSheepRaid: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    wx.navigateTo({
      url: '/pages/sheep/sheep'
    });
  },

  /**
   * 初始化站点的绝对坐标（像素），用于后续拖拽
   */
  initStationPositions: function () {
    const query = wx.createSelectorQuery().in(this);
    query.select('.journey-map').boundingClientRect();
    query.select('#station-charging').boundingClientRect();
    query.select('#station-supply').boundingClientRect();
    query.select('#station-solitude').boundingClientRect();
    query.select('#station-time').boundingClientRect();
    query.select('#station-worry').boundingClientRect();
    query.exec(res => {
      if (!res || !res[0]) return;
      const mapRect = res[0];
      const ids = ['charging', 'supply', 'solitude', 'time', 'worry'];
      const nextPositions = Object.assign({}, this.data.stationPositions || {});
      for (let i = 0; i < ids.length; i++) {
        const rect = res[i + 1];
        const id = ids[i];
        if (!rect || !id) continue;
        // 如果本地已经有保存的位置，就不覆盖（以用户上一次拖拽为准）
        if (nextPositions[id] && typeof nextPositions[id].x === 'number' && typeof nextPositions[id].y === 'number') {
          continue;
        }
        // 使用当前样式计算出来的 left/top（相对 journey-map 左上角）
        const left = rect.left - mapRect.left;
        const top = rect.top - mapRect.top;
        nextPositions[id] = { x: left, y: top };
      }
      this.setData({
        mapRect,
        stationPositions: nextPositions
      });
      try {
        wx.setStorageSync('summer_station_positions', nextPositions);
      } catch (_) {}
    });
  },

  /**
   * 站点拖拽开始
   */
  onStationTouchStart: function (e) {
    const station = e.currentTarget.dataset.station;
    const touch = e.touches && e.touches[0];
    if (!station || !touch) return;
    // 每次按下重置拖拽移动标记，避免误触触发跳转
    this._dragMoved = false;
    const positions = this.data.stationPositions || {};
    const current = positions[station] || { x: 0, y: 0 };
    this.setData({
      dragState: {
        activeStation: station,
        startX: touch.clientX,
        startY: touch.clientY,
        originX: current.x || 0,
        originY: current.y || 0
      }
    });
  },

  /**
   * 站点拖拽移动
   */
  onStationTouchMove: function (e) {
    const state = this.data.dragState || {};
    if (!state.activeStation) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;

    const dx = touch.clientX - state.startX;
    const dy = touch.clientY - state.startY;

    // 判断是否发生了明显移动，用于后续阻止 tap 触发跳转（阈值放大，避免轻点被误判为拖拽）
    if (!this._dragMoved && (Math.abs(dx) > 25 || Math.abs(dy) > 25)) {
      this._dragMoved = true;
    }

    let newX = (state.originX || 0) + dx;
    let newY = (state.originY || 0) + dy;

    const mapRect = this.data.mapRect;
    if (mapRect) {
      const padding = 10; // 给四周留一点空隙
      const minX = padding;
      const minY = padding;
      const maxX = Math.max(padding, mapRect.width - 220); // 估算卡片宽度
      const maxY = Math.max(padding, mapRect.height - 160); // 估算卡片高度
      if (newX < minX) newX = minX;
      if (newY < minY) newY = minY;
      if (newX > maxX) newX = maxX;
      if (newY > maxY) newY = maxY;
    }

    const positions = Object.assign({}, this.data.stationPositions || {});
    if (!positions[state.activeStation]) positions[state.activeStation] = {};
    positions[state.activeStation].x = newX;
    positions[state.activeStation].y = newY;

    this.setData({
      stationPositions: positions
    });
  },

  /**
   * 站点拖拽结束
   */
  onStationTouchEnd: function () {
    const positions = this.data.stationPositions || {};
    this.setData({
      dragState: {
        activeStation: '',
        startX: 0,
        startY: 0,
        originX: 0,
        originY: 0
      }
    });
    try {
      wx.setStorageSync('summer_station_positions', positions);
    } catch (_) {}
  },

  /**
   * 点击站点右上角的减号，准备删除该功能
   */
  onRemoveStationTap: function (e) {
    const station = e.currentTarget.dataset.station;
    if (!station || !STATION_META[station]) return;
    const meta = STATION_META[station];
    wx.showModal({
      title: '确认删除',
      content: `你确定删掉“${meta.name}”这个功能吗？`,
      confirmText: '删掉',
      cancelText: '再想想',
      success: (res) => {
        if (res.confirm) {
          this.deleteStation(station);
        }
      }
    });
  },

  // 阻止减号区域的触摸事件继续触发拖拽
  onRemoveStationTouch: function () {
    // 空函数即可，使用 catchtouchstart 拦截冒泡
  },

  /**
   * 真正执行删除逻辑：隐藏顶部站点，并把它放到底部列表
   */
  deleteStation: function (station) {
    const meta = STATION_META[station];
    if (!meta) return;

    const vis = Object.assign({}, this.data.stationVisibility || {});
    vis[station] = false;

    const currentDeleted = Array.isArray(this.data.deletedStations) ? this.data.deletedStations.slice() : [];
    const exists = currentDeleted.some(item => item && item.id === station);
    if (!exists) {
      currentDeleted.push({ id: meta.id, name: meta.name });
    }

    this.setData({
      stationVisibility: vis,
      deletedStations: currentDeleted
    });

    try {
      wx.setStorageSync('summer_deleted_stations', currentDeleted);
    } catch (_) {}
  },

  /**
   * 从页脚收纳区重新打开某个小站
   */
  onRestoreStationTap: function (e) {
    const id = e.currentTarget.dataset.id;
    if (!id || !Object.prototype.hasOwnProperty.call(STATION_META, id)) return;

    const vis = Object.assign({}, this.data.stationVisibility || {});
    vis[id] = true;

    const nextDeleted = (this.data.deletedStations || []).filter(item => item && item.id !== id);

    this.setData({
      stationVisibility: vis,
      deletedStations: nextDeleted
    });

    try {
      wx.setStorageSync('summer_deleted_stations', nextDeleted);
    } catch (_) {}
  },

  /**
   * 选择用于站点跳转的文章：优先时间线最新一篇，其次轮播
   */
  getLatestArticleForStation: function () {
    const { timelineData, carouselItems } = this.data;

    if (Array.isArray(timelineData) && timelineData.length > 0) {
      const firstBlock = timelineData[0];
      if (firstBlock && Array.isArray(firstBlock.articles) && firstBlock.articles.length > 0) {
        return firstBlock.articles[0];
      }
    }

    if (Array.isArray(carouselItems) && carouselItems.length > 0) {
      return { id: carouselItems[0].id };
    }

    return null;
  },

  /**
   * 记录阅读数量
   */
  recordReadCount: function(articleId) {
    if (!articleId) return;
    
    const today = new Date().toDateString();
    // 组合 Key: 文章ID_日期 (按天去重)
    const recordKey = `${articleId}_${today}`;
    
    let readCards = wx.getStorageSync('readCards') || [];

    // 检查今天是否已经记录过这篇文章
    if (!readCards.includes(recordKey)) {
      readCards.push(recordKey);
      wx.setStorageSync('readCards', readCards);
    }
  },

  /**
   * 切换文章收藏状态
   */
  toggleFavorite: async function (e) {
    if (getApp().playClickSound) getApp().playClickSound();
    const article = e.currentTarget.dataset.article;
    const cardType = e.currentTarget.dataset.cardType || 'main';
    const cardIndex = e.currentTarget.dataset.cardIndex || 0;
    const articleId = article.id;
    const key = `${articleId}_${cardType}`;
    const favSet = new Set(this.data.favoriteKeys || []);
    const isFav = favSet.has(key);
    await this.initCloud();
    const db = this.cloud.database();
    if (isFav) {
      const openid = wx.getStorageSync('openid');
      const whereCond = {
        type: 'article',
        target_id: articleId,
        'data.cardType': cardType,
      };
      if (openid) whereCond['_openid'] = openid;
      await db.collection('summer_user_favorites').where(whereCond).remove();
      wx.showToast({ title: '已取消收藏', icon: 'success', duration: 1000 });
    } else {
      await db.collection('summer_user_favorites').add({
        data: {
          type: 'article',
          target_id: articleId,
          created_at: db.serverDate(),
          data: {
            title: article.titleCn || article.title || '',
            titleCn: article.titleCn || article.title || '',
            subtitle: article.subtitle || '',
            category: article.category || '',
            date: this.data.selectedDateText || article.date || '',
            cover: article.cover || '',
            cardType: cardType,
            cardIndex: cardIndex
          }
        }
      });
      wx.showToast({ title: '已添加到收藏', icon: 'success', duration: 1000 });
    }
    await this.loadFavoriteSet();
    this.filterTimeline();
  },
  
  /**
   * 抽取能量卡片
   */
  drawEnergyCard: async function () {
    
    // 先显示加载状态
    this.setData({
      energyCardLoading: true,
      showEnergyCardModal: true  // 立即显示模态框
    });
    
    try {
      // 等待云开发实例初始化
      await this.initCloud();
      
      const db = this.cloud.database();
      
      // 从summer_energy集合中获取所有能量卡片
      const res = await db.collection('summer_energy').get();
      
      if (!res.data || res.data.length === 0) {
        wx.showToast({
          title: '暂无能量卡片',
          icon: 'none'
        });
        this.setData({
          energyCardLoading: false,
          showEnergyCardModal: false
        });
        return;
      }
      
      // 随机选择一张卡片
      const randomIndex = Math.floor(Math.random() * res.data.length);
      const selectedCard = res.data[randomIndex];
      
      // 记录抽到的能量卡片及所有字段
      console.log('抽到的能量卡片:', selectedCard);
      console.log('能量卡片所有字段:', Object.keys(selectedCard || {}));
      // 检查可能的图片字段
      console.log('image字段:', selectedCard.image);
      console.log('img字段:', selectedCard.img);
      
      // 获取图片临时链接 - 检查image字段（按规范）和img字段（兼容现有数据）
      const imageField = selectedCard.image || selectedCard.img;
      console.log('能量卡片图片字段:', imageField);
      
      if (!imageField) {
        console.warn('能量卡片没有找到图片字段(image或img):', selectedCard);
        wx.showToast({
          title: '卡片缺少图片',
          icon: 'none'
        });
        this.setData({
          energyCard: selectedCard,
          energyCardImage: '',
          energyCardLoading: false
        });
        return;
      }
      // 兼容多种图片路径：cloud://、http(s)://、本地静态资源
      if (typeof imageField !== 'string') {
        console.error('图片字段不是字符串:', imageField);
        wx.showToast({ title: '图片路径无效', icon: 'none' });
        this.setData({ energyCard: selectedCard, energyCardImage: '', energyCardLoading: false });
        return;
      }
      // 直接使用外链或本地静态资源
      if (imageField.startsWith('http://') || imageField.startsWith('https://')) {
        const urlWithTs = `${imageField}${imageField.includes('?') ? '&' : '?'}t=${Date.now()}`;
        this.setData({
          energyCard: selectedCard,
          energyCardImage: urlWithTs,
          energyCardLoading: false,
          forceEnergyCardRender: this.data.forceEnergyCardRender + 1
        });
        return;
      }
      if (imageField.startsWith('/') || imageField.startsWith('./') || imageField.startsWith('../')) {
        this.setData({
          energyCard: selectedCard,
          energyCardImage: imageField,
          energyCardLoading: false,
          forceEnergyCardRender: this.data.forceEnergyCardRender + 1
        });
        return;
      }
      // 云存储 fileID -> 临时链接
      if (!imageField.startsWith('cloud://')) {
        console.error('未知图片路径形式:', imageField);
        wx.showToast({ title: '图片路径无效', icon: 'none' });
        this.setData({ energyCard: selectedCard, energyCardImage: '', energyCardLoading: false });
        return;
      }
      try {
        console.log('正在获取临时链接:', imageField);
        // 使用缓存转换，延长临时链接可用期
        const ttlMs = 2 * 60 * 60 * 1000;
        const tempMap = await this.convertTempUrlsWithCache(this.cloud, [imageField], ttlMs);
        const tempUrl = tempMap[imageField];
        
        if (tempUrl) {
          const imageUrlWithTimestamp = `${tempUrl}?t=${Date.now()}`;
          this.setData({
            energyCard: selectedCard,
            energyCardImage: imageUrlWithTimestamp,
            energyCardLoading: false,
            forceEnergyCardRender: this.data.forceEnergyCardRender + 1
          });
        } else {
          console.error('未获得有效的临时链接');
          wx.showToast({ title: '图片链接获取失败', icon: 'none' });
          this.setData({ energyCard: selectedCard, energyCardImage: '', energyCardLoading: false });
        }
      } catch (error) {
        console.error('获取临时链接时发生错误:', error);
        wx.showToast({
          title: '图片加载失败',
          icon: 'none'
        });
        this.setData({
          energyCard: selectedCard,
          energyCardImage: '',
          energyCardLoading: false
        });
      }
    } catch (error) {
      console.error('抽取能量卡片失败:', error);
      wx.showToast({
        title: '抽取失败，请重试',
        icon: 'none'
      });
      this.setData({
        energyCardLoading: false,
        showEnergyCardModal: false
      });
    }
  },
  
  /**
   * 关闭能量卡片弹窗
   */
  closeEnergyCardModal: function() {
    // 添加延迟确保动画完成
    setTimeout(() => {
      this.setData({
        showEnergyCardModal: false,
        energyCard: null,
        energyCardImage: '',
        energyCardLoading: false
      });
    }, 150);
  },
  
  /**
   * 能量卡片图片加载完成
   */
  onEnergyCardImageLoad: function(e) {
    console.log('能量卡片图片加载完成', e);
    console.log('图片加载详情:', e.detail);
    // 图片加载完成后，强制刷新渲染以确保显示
    this.setData({
      forceEnergyCardRender: this.data.forceEnergyCardRender + 1
    });
  },
  
  /**
   * 能量卡片图片加载失败
   */
  onEnergyCardImageError: function(e) {
    console.error('能量卡片图片加载失败', e);
    console.error('错误详情:', e.detail);
    wx.showToast({
      title: '图片加载失败，请稍后再试',
      icon: 'none'
    });
    // 图片加载失败时，清空图片并重新生成forceRender标志
    this.setData({
      energyCardImage: '',
      forceEnergyCardRender: this.data.forceEnergyCardRender + 1
    });
  },
  
  /**
   * 重新加载能量卡片图片
   */
  reloadEnergyCardImage: function(e) {
    console.log('点击重新加载能量卡片图片');
    if (this.data.energyCard && !this.data.energyCardLoading) {
      this.setData({
        energyCardLoading: true
      });
      
      // 重新获取图片临时链接 - 检查image字段（按规范）和img字段（兼容现有数据）
      const imageField = this.data.energyCard.image || this.data.energyCard.img;
      console.log('重新加载图片字段:', imageField);
      
      if (!imageField) {
        console.warn('能量卡片缺少图片字段:', this.data.energyCard);
        wx.showToast({
          title: '卡片缺少图片',
          icon: 'none'
        });
        this.setData({
          energyCardLoading: false
        });
        return;
      }
      // 兼容多种图片路径
      if (typeof imageField !== 'string') {
        console.error('图片字段不是字符串:', imageField);
        wx.showToast({ title: '图片路径无效', icon: 'none' });
        this.setData({ energyCardLoading: false });
        return;
      }
      if (imageField.startsWith('http://') || imageField.startsWith('https://')) {
        const urlWithTs = `${imageField}${imageField.includes('?') ? '&' : '?'}t=${Date.now()}`;
        this.setData({
          energyCardImage: urlWithTs,
          energyCardLoading: false,
          forceEnergyCardRender: this.data.forceEnergyCardRender + 1
        });
        return;
      }
      if (imageField.startsWith('/') || imageField.startsWith('./') || imageField.startsWith('../')) {
        this.setData({
          energyCardImage: imageField,
          energyCardLoading: false,
          forceEnergyCardRender: this.data.forceEnergyCardRender + 1
        });
        return;
      }
      if (!imageField.startsWith('cloud://')) {
        console.error('未知图片路径形式:', imageField);
        wx.showToast({ title: '图片路径无效', icon: 'none' });
        this.setData({ energyCardLoading: false });
        return;
      }
      console.log('正在获取临时链接:', imageField);
      // 使用缓存转换
      const ttlMs = 2 * 60 * 60 * 1000;
      this.convertTempUrlsWithCache(this.cloud, [imageField], ttlMs)
        .then(tempMap => {
          const tempUrl = tempMap[imageField];
          if (tempUrl) {
            const imageUrlWithTimestamp = `${tempUrl}?t=${Date.now()}`;
            this.setData({
              energyCardImage: imageUrlWithTimestamp,
              energyCardLoading: false,
              forceEnergyCardRender: this.data.forceEnergyCardRender + 1
            });
          } else {
            console.error('获取图片临时链接失败');
            wx.showToast({ title: '图片链接获取失败', icon: 'none' });
            this.setData({ energyCardLoading: false });
          }
        })
        .catch(err => {
          console.error('重新加载图片时出错:', err);
          wx.showToast({ title: '图片加载失败', icon: 'none' });
          this.setData({ energyCardLoading: false });
        });
    }
  },
  
  initCloud: async function() {
    if (getApp().cloud) {
      this.cloud = getApp().cloud;
      return this.cloud;
    }
    if (!this.cloud) {
      this.cloud = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4',
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      try {
        await this.cloud.init();
        getApp().cloud = this.cloud;
      } catch(err) {}
    }
    return this.cloud;
  },

  loadFavoriteSet: async function() {
    await this.initCloud();
    const db = this.cloud.database();
    let openid = wx.getStorageSync('openid');
    if (!openid) {
      try {
        const cloud = getApp().cloud || wx.cloud;
        const loginRes = await cloud.callFunction({ name: 'login', data: {} });
        openid = loginRes && loginRes.result && loginRes.result.openid ? loginRes.result.openid : '';
        if (openid) wx.setStorageSync('openid', openid);
      } catch (_) {}
    }
    const whereCond = openid ? { type: 'article', _openid: openid } : { type: 'article' };
    const res = await db.collection('summer_user_favorites')
      .where(whereCond)
      .orderBy('created_at', 'desc')
      .limit(500)
      .get();
    const keys = (res.data || []).map(d => `${d.target_id}_${(d.data && d.data.cardType) ? d.data.cardType : 'main'}`);
    this.setData({ favoriteKeys: keys });
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})
