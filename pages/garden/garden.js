// pages/garden/garden.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    benchX: 0,
    benchY: 0,
    benchScale: 1,
    _benchTouchStartX: 0,
    _benchTouchStartY: 0,
    _benchStartX: 0,
    _benchStartY: 0,
    _pinchStartDistance: 0,
    _pinchStartScale: 1,
    _hasDraggedThisTouch: false,
    useVideoBg: false,
    frameVideoSrc: '',
    showBenchHint: true,
    bgQuote: '',
    bgQuoteLines: [],
    summerQuotes: [
      '风遇见云，花遇见树，我遇见夏天。',
      '夏天的风，正轻轻吹过，连时光都变得温柔。',
      '汽水降低的温度，是夏日的奇遇。',
      '把夏天的阳光，酿成一整个季节的温柔。',
      '蝉鸣是窗外渐渐倒数的钟声，夏天是藏在风里的温柔。',
      '夏日悠长，绿意温柔，万物都在慢慢生长。',
      '夏天有晚风和晚霞，有心动和偏爱。',
      '阳光正好，微风不燥，一切美好都如约而至。',
      '想把关于夏天的句子写得长一点，把温柔的日子过得慢一点。',
      '夏天是橘子味的落日，汽水味的风，和温柔的你。'
    ],
    relayModalVisible: false,
    relayStep: 'show',
    relayMessage: '',
    relayInputText: '',
    currentSitRecordId: '',
    showAwayNotice: false,
    showGuideModal: false,
    guideImageUrl: '', // 后端接口待上传
    showWorryModal: false,
    worryText: '',
    isAnimating: false,
    fallingChars: [],
    encouragingText: '',
    showEncouragingText: false,
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
    liveWatchCount: 0,
    sitCountdown: '',
    sitMinutesOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20],
    sitMinutesIndex: 9,
    sitMinutes: 10,
    benchSitCount: 0,
    woolCount: 0,
    _sitTimer: null,
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
    favoriteKeys: [],
    
    // 云存储图片链接
    bg2ImageUrl: '',
    benchImageUrl: '',
    
    // 放松攻略图片数组
    guideImages: [],
    currentGuideImageIndex: 0
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const sys = wx.getSystemInfoSync();
    const benchX = sys.windowWidth / 2;
    const benchY = sys.windowHeight / 2 + (170 * sys.windowWidth / 750);
    this.setData({
      benchX: benchX,
      benchY: benchY,
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

    const benchSitCount = wx.getStorageSync('benchSitCount') || 0;
    const benchDraggedOnce = wx.getStorageSync('benchDraggedOnce') || false;
    const woolCount = wx.getStorageSync('woolCount') || 0;
    const quotes = this.data.summerQuotes || [];
    const bgQuote = quotes.length ? quotes[Math.floor(Math.random() * quotes.length)] : '';
    const punct = '。，、；！？：';
    const bgQuoteLines = [];
    let cur = '';
    for (const c of bgQuote) {
      cur += c;
      if (punct.includes(c)) {
        bgQuoteLines.push(cur);
        cur = '';
      }
    }
    if (cur.trim()) bgQuoteLines.push(cur);
    this.setData({
      benchSitCount,
      woolCount,
      liveWatchCount: Math.floor(Math.random() * 50) + 80,
      showBenchHint: !benchDraggedOnce,
      bgQuote,
      bgQuoteLines
    });
    
    // 加载云存储图片链接
    this.loadCloudImageUrls();
  },
  
  loadCloudImageUrls: async function() {
    // 等待云开发实例初始化
    let cloud = null;
    const app = getApp();
    
    // 最多等待3秒
    const maxWaitTime = 3000;
    const startTime = Date.now();
    
    while (!cloud && (Date.now() - startTime) < maxWaitTime) {
      cloud = app.cloud;
      if (!cloud) {
        // 短暂延迟后重试
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (!cloud) {
      console.error('云开发未正确初始化');
      // 如果云开发未初始化，尝试使用缓存数据
      const cacheKey = 'garden_bg_images_cache';
      const cachedData = wx.getStorageSync(cacheKey);
      if (cachedData) {
        this.setData({
          bg2ImageUrl: cachedData.bg2ImageUrl,
          benchImageUrl: cachedData.benchImageUrl
        });
        console.log('使用缓存数据');
        // 加载放松攻略图片
        this.loadGuideImages();
      }
      return;
    }
    
    // 检查缓存
    const cacheKey = 'garden_bg_images_cache';
    const cachedData = wx.getStorageSync(cacheKey);
    const now = Date.now();
    
    // 如果缓存存在且未过期（3小时内）
    if (cachedData && (now - cachedData.timestamp) < 3 * 60 * 60 * 1000) {
      console.log('使用庭院背景图片缓存');
      this.setData({
        bg2ImageUrl: cachedData.bg2ImageUrl,
        benchImageUrl: cachedData.benchImageUrl
      });
      // 加载放松攻略图片
      this.loadGuideImages();
      return;
    }
    
    const bg2CloudPath = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/bg2.png';
    const benchCloudPath = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/长凳.jpg';
    
    try {
      const result = await cloud.getTempFileURL({
        fileList: [bg2CloudPath, benchCloudPath]
      });
      
      const images = {};
      let hasValidImages = false;
      
      result.fileList.forEach((file, index) => {
        if (file && file.status === 0 && file.tempFileURL) {
          if (index === 0) {
            images.bg2ImageUrl = file.tempFileURL;
            hasValidImages = true;
            console.log('成功加载背景图片:', file.tempFileURL);
          } else if (index === 1) {
            images.benchImageUrl = file.tempFileURL;
            hasValidImages = true;
            console.log('成功加载长凳图片:', file.tempFileURL);
          }
        } else {
          console.error(`获取图片失败: ${index === 0 ? 'bg2' : 'bench'}, 路径: ${index === 0 ? bg2CloudPath : benchCloudPath}, 错误码: ${file ? file.status : 'unknown'}`);
        }
      });
      
      // 即使部分图片加载失败，也要设置已成功加载的图片
      if (Object.keys(images).length > 0) {
        this.setData(images);
        console.log('已设置图片数据:', images);
        
        // 保存到缓存
        wx.setStorageSync(cacheKey, {
          bg2ImageUrl: images.bg2ImageUrl || (cachedData && cachedData.bg2ImageUrl),
          benchImageUrl: images.benchImageUrl || (cachedData && cachedData.benchImageUrl),
          timestamp: now
        });
      }
    } catch (error) {
      console.error('获取云存储图片链接失败:', error);
      // 如果网络请求失败，尝试使用旧的缓存数据
      if (cachedData) {
        console.log('网络请求失败，使用旧的缓存数据');
        this.setData({
          bg2ImageUrl: cachedData.bg2ImageUrl,
          benchImageUrl: cachedData.benchImageUrl
        });
      }
    }
    
    // 加载放松攻略图片
    this.loadGuideImages();
  },
  
  loadGuideImages: async function() {
    // 检查缓存
    const cacheKey = 'guide_images_cache';
    const cachedData = wx.getStorageSync(cacheKey);
    const now = Date.now();
    
    // 如果缓存存在且未过期（3小时内）
    if (cachedData && (now - cachedData.timestamp) < 3 * 60 * 60 * 1000) {
      console.log('使用攻略图片缓存');
      this.setData({
        guideImages: cachedData.images
      });
      return Promise.resolve();
    }
    
    // 使用app.js中初始化的云开发实例
    const app = getApp();
    const cloud = app.cloud;
    
    if (!cloud) {
      console.error('云开发未正确初始化');
      return Promise.resolve();
    }
    
    // 构建放松攻略图片云路径数组 - 使用您提供的准确路径
    const guideImagePaths = [];
    for (let i = 0; i <= 5; i++) {
      guideImagePaths.push(`cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/放松攻略/夏小咩的放松攻略-图片-${i}.jpg`);
    }
    
    console.log('正在尝试加载攻略图片路径：', guideImagePaths);
    
    try {
      const result = await cloud.getTempFileURL({
        fileList: guideImagePaths
      });
      
      console.log('云存储返回完整结果：', result);
      
      const validImages = [];
      result.fileList.forEach((file, index) => {
        if (file && file.status === 0 && file.tempFileURL) {
          validImages.push(file.tempFileURL);
          console.log(`成功加载攻略图片 ${index}:`, file.tempFileURL);
        } else {
          console.warn(`获取放松攻略图片失败: ${guideImagePaths[index]}, 文件状态:`, file);
        }
      });
      
      console.log('最终有效的攻略图片数量：', validImages.length, '图片列表：', validImages);
      
      // 保存到缓存
      wx.setStorageSync(cacheKey, {
        images: validImages,
        timestamp: now
      });
      
      // 使用 setData 更新数据，这会触发视图更新
      this.setData({
        guideImages: validImages
      });
      
      console.log('已设置攻略图片数据，当前页面数据：', this.data.guideImages.length);
      
      return Promise.resolve();
    } catch (error) {
      console.error('获取放松攻略图片失败:', error);
      console.error('错误详情:', error.errMsg || error.message);
      
      // 如果网络请求失败，尝试使用旧的缓存数据
      if (cachedData) {
        console.log('网络请求失败，使用旧的缓存数据');
        this.setData({
          guideImages: cachedData.images
        });
      }
      
      return Promise.resolve();
    }
  },

  onTapShop() {
    wx.navigateTo({ url: '/pages/shop/shop' });
  },
  onTapGuide() {
    console.log('点击了放松攻略，当前攻略图片数组长度：', this.data.guideImages.length);
    console.log('当前攻略图片数组：', this.data.guideImages);
    
    // 检查是否已经有加载好的图片
    if (this.data.guideImages && this.data.guideImages.length > 0) {
      console.log('已有攻略图片，直接显示，数量：', this.data.guideImages.length);
      this.setData({ 
        showGuideModal: true, 
        currentGuideImageIndex: 0 
      });
      return;
    }
    
    // 如果没有图片，显示加载提示并加载图片
    wx.showToast({ 
      title: '正在加载攻略图片...', 
      icon: 'loading',
      duration: 10000  // 延长持续时间
    });
    
    // 加载攻略图片
    this.loadGuideImages().then(() => {
      console.log('重新加载后的攻略图片数组长度：', this.data.guideImages.length);
      
      // 隐藏之前的加载提示
      wx.hideToast();
      
      if (this.data.guideImages && this.data.guideImages.length > 0) {
        console.log('攻略图片加载成功，准备显示模态框，图片数量：', this.data.guideImages.length);
        // 设置数据并显示模态框
        this.setData({ 
          showGuideModal: true, 
          currentGuideImageIndex: 0 
        });
        
        // 强制延迟一小段时间确保UI更新
        setTimeout(() => {
          console.log('模态框已显示');
        }, 100);
      } else {
        console.log('没有加载到任何攻略图片');
        wx.showToast({ 
          title: '暂无攻略图片可显示', 
          icon: 'none',
          duration: 2000
        });
      }
    }).catch(error => {
      console.error('加载攻略图片时发生错误：', error);
      wx.hideToast();
      wx.showToast({ 
        title: '加载图片失败', 
        icon: 'none' 
      });
    });
  },
  onCloseGuideModal() {
    this.setData({ showGuideModal: false });
  },
  
  onGuideSwiperChange(e) {
    this.setData({
      currentGuideImageIndex: e.detail.current
    });
  },
  
  onTapBgMusic() {
    wx.showToast({ title: '背景声音', icon: 'none' });
  },
  onSitMinutesChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const opts = this.data.sitMinutesOptions;
    this.setData({ sitMinutesIndex: idx, sitMinutes: opts[idx] });
  },
  onTapSitCountdown() {
    if (this.data._sitTimer) {
      wx.showToast({ title: '已在倒计时中', icon: 'none' });
      return;
    }
    const minutes = this.data.sitMinutes || 10;
    let sec = minutes * 60;
    const self = this;
    const tick = () => {
      if (sec <= 0) {
        clearInterval(self.data._sitTimer);
        self.setData({ sitCountdown: '', _sitTimer: null });
        const n = (self.data.benchSitCount || 0) + 1;
        const wool = (self.data.woolCount || 0) + 10;
        self.setData({ benchSitCount: n, woolCount: wool });
        wx.setStorageSync('benchSitCount', n);
        wx.setStorageSync('woolCount', wool);
        wx.showToast({ title: '获得 10 羊毛', icon: 'success', duration: 2000 });
        // 接力逻辑：第一个人收到固定文案，之后的人收到上一个人写的留言
        const relayMessage = wx.getStorageSync('relayMessage') || '我在这里，坐了十分钟又十分钟。愿你在这里接住疲惫，也拾起勇气，起身时，轻装上阵，眼里有光。';
        // 坐满10分钟即生成一张“拍立得”（先占位，写完给下一位后再补全）
        const recordId = String(Date.now());
        const dateStr = (function () {
          const d = new Date();
          return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        })();
        const records = wx.getStorageSync('benchSitRecords') || [];
        records.unshift({ id: recordId, date: dateStr, durationMinutes: minutes, received: relayMessage, myMessage: '' });
        wx.setStorageSync('benchSitRecords', records);
        setTimeout(() => {
          self.setData({
            relayModalVisible: true,
            relayStep: 'write',
            relayMessage,
            relayInputText: '',
            currentSitRecordId: recordId
          });
        }, 2100);
        return;
      }
      const m = Math.floor(sec / 60), s = sec % 60;
      self.setData({ sitCountdown: (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s });
      sec--;
    };
    tick();
    const t = setInterval(tick, 1000);
    this.setData({ _sitTimer: t });
  },
  onCloseRelayModal() {
    this.setData({ relayModalVisible: false, relayStep: 'show', relayInputText: '' });
  },
  onRelayKeep() {
    this.setData({ relayStep: 'write' });
  },
  onRelayInput(e) {
    this.setData({ relayInputText: e.detail.value });
  },
  onRelaySubmit() {
    const text = (this.data.relayInputText || '').trim();
    if (!text) {
      wx.showToast({ title: '写一句话再传递吧', icon: 'none' });
      return;
    }
    const records = wx.getStorageSync('benchSitRecords') || [];
    const id = this.data.currentSitRecordId;
    if (id) {
      const idx = records.findIndex((r) => String(r.id) === String(id));
      if (idx > -1) {
        records[idx] = { ...records[idx], myMessage: text };
      } else {
        // 兜底：未找到占位记录则新建
        const d = new Date();
        const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        records.unshift({ id: String(Date.now()), date: dateStr, durationMinutes: 10, received: this.data.relayMessage || '', myMessage: text });
      }
    }
    wx.setStorageSync('benchSitRecords', records);
    wx.setStorageSync('relayMessage', text);
    this.setData({ relayModalVisible: false, relayStep: 'show', relayInputText: '', currentSitRecordId: '' });
    wx.showToast({ title: '已保存到夏日时光机', icon: 'success' });
  },
  onHide() {
    if (this.data._sitTimer) {
      this.setData({ showAwayNotice: true });
    }
  },
  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
    
    // 在页面显示时预加载背景图片（如果有缓存则快速显示，否则异步加载）
    this.loadCloudImageUrls();
  },

  onDismissAwayNotice() {
    this.setData({ showAwayNotice: false });
  },
  onTapMuseum() {
    wx.navigateTo({ url: '/pages/museum/museum' });
  },
  onTapFlickWorry() {
    this.openWorryModal();
  },
  openWorryModal() {
    this.setData({ showWorryModal: true, worryText: '' });
  },
  closeWorryModal() {
    this.setData({ showWorryModal: false });
  },
  stopProp() {
    return;
  },
  onWorryInput(e) {
    this.setData({ worryText: e.detail.value });
  },
  submitWorry() {
    const text = this.data.worryText;
    if (!text.trim()) {
      wx.showToast({ title: '请写下你的烦恼...', icon: 'none' });
      return;
    }
    this.closeWorryModal();
    this.startWorryAnimation(text);
  },
  startWorryAnimation(text) {
    const chars = text.split('');
    const totalChars = chars.length;
    const sheepAnimDuration = 12;
    const startLeft = -75;
    const endLeft = 120;
    const totalDist = endLeft - startLeft;
    const speed = totalDist / sheepAnimDuration;
    const startTime = 3.5;
    const endTime = 9.5;
    const timeWindow = endTime - startTime;

    const fallingChars = chars.map((char, index) => {
      const progress = index / totalChars;
      const impactTime = startTime + (progress * timeWindow) + (Math.random() * 0.5 - 0.25);
      const sheepLeft = startLeft + speed * impactTime;
      const textLeft = sheepLeft + 35;
      const duration = (Math.random() * 0.5 + 2).toFixed(2);
      const numDuration = parseFloat(duration);
      const fallTime = numDuration * 0.6;
      let delay = impactTime - fallTime;
      if (delay < 0) delay = 0;
      return {
        char: char,
        size: Math.floor(Math.random() * 40) + 30,
        left: textLeft.toFixed(2),
        duration: duration,
        delay: delay.toFixed(2),
        bounceDir: Math.random() > 0.5 ? 1 : -1
      };
    });

    const randomQuote = this.data.encouragingQuotes[Math.floor(Math.random() * this.data.encouragingQuotes.length)];

    if (this.bounceTimers) {
      this.bounceTimers.forEach(t => clearTimeout(t));
    }
    this.bounceTimers = [];
    if (this.bounceAudios) {
      this.bounceAudios.forEach(ctx => ctx.destroy());
    }
    this.bounceAudios = [];

    fallingChars.forEach(item => {
      const duration = parseFloat(item.duration);
      const delay = parseFloat(item.delay);
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
        ctx.onError(() => {
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
      showEncouragingText: false
    });

    setTimeout(() => {
      this.setData({ showEncouragingText: true });
    }, 11000);

    setTimeout(() => {
      this.closeAnimation();
    }, 18000);
  },
  closeAnimation() {
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
      showEncouragingText: false
    });
  },

  _getTouchDistance(touches) {
    if (!touches || touches.length < 2) return 0;
    const a = touches[0], b = touches[1];
    return Math.sqrt(Math.pow(b.clientX - a.clientX, 2) + Math.pow(b.clientY - a.clientY, 2));
  },
  onBenchTouchStart(e) {
    const touches = e.touches;
    this.setData({ _hasDraggedThisTouch: false });
    if (touches.length >= 2) {
      const dist = this._getTouchDistance(touches);
      this.setData({
        _pinchStartDistance: dist,
        _pinchStartScale: this.data.benchScale
      });
    } else if (touches.length === 1) {
      const t = touches[0];
      this.setData({
        _benchTouchStartX: t.clientX,
        _benchTouchStartY: t.clientY,
        _benchStartX: this.data.benchX,
        _benchStartY: this.data.benchY
      });
    }
  },
  onBenchTouchMove(e) {
    const touches = e.touches;
    if (touches.length >= 2) {
      const dist = this._getTouchDistance(touches);
      if (this.data._pinchStartDistance > 0) {
        let scale = this.data._pinchStartScale * (dist / this.data._pinchStartDistance);
        scale = Math.max(0.25, Math.min(4, scale));
        this.setData({ benchScale: scale });
      }
    } else if (touches.length === 1) {
      const t = touches[0];
      const dx = t.clientX - this.data._benchTouchStartX;
      const dy = t.clientY - this.data._benchTouchStartY;
      this.setData({
        benchX: this.data._benchStartX + dx,
        benchY: this.data._benchStartY + dy,
        _hasDraggedThisTouch: true
      });
    }
  },
  onBenchTouchEnd(e) {
    if (e.touches.length === 2) {
      this.setData({
        _pinchStartDistance: this._getTouchDistance(e.touches),
        _pinchStartScale: this.data.benchScale
      });
    } else if (e.touches.length === 0 && this.data._hasDraggedThisTouch) {
      if (!wx.getStorageSync('benchDraggedOnce')) {
        wx.setStorageSync('benchDraggedOnce', true);
        this.setData({ showBenchHint: false });
      }
    }
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
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    if (this.data._sitTimer) clearInterval(this.data._sitTimer);
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

  },

  // 清除背景图片缓存
  clearBgImagesCache: function() {
    wx.removeStorageSync('garden_bg_images_cache');
    console.log('已清除庭院背景图片缓存');
  },

  // 清除攻略图片缓存
  clearGuideImagesCache: function() {
    wx.removeStorageSync('guide_images_cache');
    console.log('已清除攻略图片缓存');
  },
  
  // 强制重新加载所有图片（用于调试目的）
  forceReloadImages: function() {
    console.log('强制重新加载所有图片');
    // 清除缓存
    this.clearBgImagesCache();
    this.clearGuideImagesCache();
    // 重新加载图片
    this.loadCloudImageUrls();
  },

  // 测试单个云存储文件访问
  testCloudFileAccess: async function(filePath) {
    const app = getApp();
    const cloud = app.cloud;
    
    if (!cloud) {
      console.error('云开发未正确初始化');
      return false;
    }
    
    try {
      const result = await cloud.getTempFileURL({
        fileList: [filePath]
      });
      
      console.log('云存储测试结果：', result);
      
      if (result.fileList && result.fileList[0]) {
        if (result.fileList[0].status === 0) {
          console.log('云存储文件访问成功：', result.fileList[0].tempFileURL);
          return { success: true, url: result.fileList[0].tempFileURL };
        } else {
          console.error('云存储文件访问失败，状态码：', result.fileList[0].status);
          return { success: false, error: result.fileList[0].status };
        }
      }
      return { success: false, error: '无效响应' };
    } catch (error) {
      console.error('云存储测试出错：', error);
      return { success: false, error: error.message };
    }
  }
})
