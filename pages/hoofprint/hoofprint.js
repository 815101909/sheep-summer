// pages/hoofprint/hoofprint.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    carouselItems: [], // 将动态生成
    selectedDate: '', // 存储选择的日期
    selectedDateText: '', // 显示的日期文本
    selectedType: '全部', // 存储选择的类型
    selectedTypeText: '全部', // 显示的类型文本
    typeOptions: ['全部', '文化', '生活', '成长', '科技', '技能', '祝福', '思考', '学习', '旅行', '商业', '体育', '热词', '医疗', '健康', '历史', '人物', '节日'], // 类型选项
    showTypeDropdown: false, // 控制类型下拉列表显示隐藏
    selectedDifficulty: '全部',
    selectedDifficultyText: '全部',
    difficultyOptions: ['全部', '低难度', '高难度'],
    showDifficultyDropdown: false,
    timelineData: [], // 初始为空
    filteredTimelineData: [], // 存储筛选后的时间线数据

    // 收藏状态
    favoriteArticles: [40, 41],
    favoriteKeys: []
  },

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

    // 从云端加载数据
    this.loadArticlesFromCloud();
  },

  /**
   * 从云端加载文章数据
   */
  loadArticlesFromCloud: async function() {
    wx.showLoading({ title: '加载中...' });
    
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

        // 批量换取临时链接
        let tempUrlMap = {};
        if (fileList.length > 0) {
            try {
                const tempRes = await c1.getTempFileURL({
                    fileList: fileList,
                    config: { maxAge: 3 * 60 * 60 }
                });
                tempRes.fileList.forEach(file => {
                    if (file.status === 0) tempUrlMap[file.fileID] = file.tempFileURL;
                });
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
                category: item.category || '未分类',
                date: formatDate(item.publish_date),
                cover: tempUrlMap[item.cover_image] || item.cover_image || '',
                a4Image: tempUrlMap[item.a4_image] || item.a4_image || '',
                level: item.level || 'low'
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

        // 2. 生成 carouselItems (取前 5 个或者随机推荐)
        // 这里简单取前 5 个
        const carouselItems = processedArticles.slice(0, 5).map(article => ({
            id: article.id,
            title: article.titleCn, // 轮播图用 title
            cover: article.cover,
            date: article.date,
            category: article.category,
            level: article.level
        }));

        this.setData({
            carouselItems: carouselItems,
            timelineData: timelineData
        });

        await this.initCloud();
        await this.loadFavoriteSet();
        this.filterTimeline();

    } catch (err) {
        console.error('获取文章失败', err);
        wx.showToast({ title: '获取数据失败', icon: 'none' });
    } finally {
        wx.hideLoading();
    }
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
    // 日期选择器会自动显示，因为picker组件绑定了showDatePicker事件
  },

  /**
   * 切换类型下拉列表显示/隐藏
   */
  toggleTypeDropdown: function () {
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
    const { timelineData, selectedDate, selectedType, selectedDifficulty } = this.data;
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

    // 3. 按难度筛选（基于后端 level 字段，仅过滤卡片，不整天移除）
    if (selectedDifficulty && selectedDifficulty !== '全部') {
      const normalizeLevel = (lv) => {
        const s = String(lv || '').toLowerCase();
        if (s.includes('low') || s.includes('低')) return '低难度';
        if (s.includes('high') || s.includes('高')) return '高难度';
        return '低难度';
      };
      filteredData = filteredData
        .map(dateBlock => {
          const articles = (dateBlock.articles || []).filter(a => normalizeLevel(a.level) === selectedDifficulty);
          return { ...dateBlock, articles };
        })
        .filter(db => (db.articles || []).length > 0);
    }

    const favSet = new Set(this.data.favoriteKeys || []);
    filteredData = filteredData.map(dateBlock => {
      const articles = (dateBlock.articles || []).map(a => ({
        ...a,
        isFavoritedMain: favSet.has(`${a.id}_main`),
        isFavoritedSmall: favSet.has(`${a.id}_small`)
      }));
      return { ...dateBlock, articles };
    });
    this.setData({
      filteredTimelineData: filteredData
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

  },

  /**
   * 打开轮播文章详情页面
   */
  openCarouselArticle: function (e) {
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
