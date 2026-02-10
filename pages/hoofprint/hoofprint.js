// pages/hoofprint/hoofprint.js
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
    favoriteKeys: []
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
