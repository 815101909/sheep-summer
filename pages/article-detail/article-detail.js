// pages/article-detail/article-detail.js
const reminderManager = require('../../utils/reminderManager');
Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentStyleIndex: 0, // 当前风格索引：0-main, 1-qa, 2-inspire, 3-fashion
    isFavorited: false, // 收藏状态
    fontSizeIndex: 1, // 字体大小索引：0-小，1-中，2-大
    currentStyleImage: '', // 当前风格图片
    isSmallCard: false, // 是否为小卡片模式（A4区域）
    showTipLabel: false, // 是否显示提示便签
    currentAvatar: '',
    topImageSmallCardCloudId: 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/夏小卡片.jpg',
    topImageSmallCardUrl: '',
    showAvatarTip: false,
    avatarTipText: '',
    showWorryModal: false,
    worryText: '',
    isRecording: false,
    recordTarget: '',
    showEncouragingText: false,
    isAnimating: false,
    fallingChars: [],
    encouragingQuotes: [
      '烦恼是小乌云，吹一口气，就散成阳光啦！',
      '把烦恼轻轻放在手心，吹一口魔法气，它就化啦～',
      '烦恼画在沙滩上，浪一来，全被带走啦！',
      '烦恼变成小雪花，呼～落地就化啦～～',
      '把烦恼揉成纸团，投进垃圾桶，拜拜不见啦～',
      '烦恼是小灰尘，拿个小扫把，唰唰扫进垃圾桶～',
      '把烦恼揉成小纸团，啪嗒一下投进筐，满分！',
      '烦恼是小怪兽，给它喂颗甜甜的糖，它就会乖乖跑掉！'
    ],
    
    // 填色功能相关
    colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB', '#E74C3C', '#2ECC71', '#F1C40F', '#FFFFFF'],
    selectedColor: '#FF6B6B',
    canvasHeight: 300, // 初始高度
    isCanvasLoading: false,
    canPaint: true,
    audioContext: null,
    isPlaying: false,
    audioDuration: 0,
    audioCurrentTime: 0,
    audioProgress: 0,
    audioTimeText: '',
    isLocked: false,

    // 情绪充电站数据
    energyLevel: 0,
    moodTags: [
      '职场电量只剩 1%', '独处充电满格快乐', '小成就值得叉会儿腰', 
      '孤单到能和影子唠嗑', '摸鱼偷闲美滋滋', '被工作追着跑的慌张', 
      '吃到好吃的原地起飞', '发呆放空超治愈', '忙到飞起但超充实', 
      '想找人唠嗑又懒得动'
    ],
    selectedMoodTags: [],
    userNote: '',
    userImage: '',
    chargingStationImage: '', // 充电站头部图片
    energyCardBg: '', // 能量卡片底图
    showMoodDropdown: false,
    courageBannerImage: '',
    courageCardBg: '',
    solitudeBannerImage: '',
    solitudeCardBg: '',
    solitudeThing: '',
    solitudeNote: '',
    solitudeImage: '',
    courageThemes: [
      { name: '会议前打气', steps: [
        '闭上眼睛，深吸一口气，感受气流从鼻子进到肚子里',
        '告诉自己：我准备的内容很充分，不用慌',
        '慢慢呼气，把紧张的情绪一起吐出去',
        '想象自己站在会场，声音清晰又有力',
        '再吸一口气，告诉自己：我一定可以的'
      ]},
      { name: '拒绝内耗', steps: [
        '轻轻闭上眼睛，双手放在胸口，感受心跳',
        '对自己说：别人的看法，不用都放在心上',
        '慢慢呼气，把纠结和不安都吐出去',
        '告诉自己：我只需要做好我认为对的事',
        '睁开眼，嘴角微微上扬，心里轻松一点'
      ]},
      { name: '独处自在', steps: [
        '找个舒服的姿势坐好，闭上眼睛',
        '听听周围的声音，比如风声、钟表声',
        '告诉自己：一个人待着，也可以很快乐',
        '慢慢吸气，感受独处的安静和自由',
        '呼气时，对自己说：享受当下，真好'
      ]},
      { name: '拒绝无效加班', steps: [
        '双手放在膝盖上，闭上眼睛，深吸一口气',
        '告诉自己：我的时间很宝贵，要留给重要的事',
        '呼气时，把 “不好意思拒绝” 的想法吐出去',
        '想象自己笑着说 “今天先到这里啦” 的样子',
        '再吸一口气，给自己点个赞：我超棒的'
      ]},
      { name: '上台不紧张', steps: [
        '闭上眼睛，深吸一口气，肩膀往下沉',
        '告诉自己：台下的人都是来听我分享的',
        '慢慢呼气，把 “怕出错” 的担心吐出去',
        '想象自己站在台上，自信又从容',
        '最后吸一口气，对自己说：我就是最亮的星'
      ]},
      { name: '告别拖延症', steps: [
        '坐直身体，闭上眼睛，深吸一口气',
        '告诉自己：这件事没那么难，我可以开始',
        '呼气时，把 “再等等” 的念头吐出去',
        '想象自己做完这件事，心里超轻松',
        '对自己说：现在就行动，我能行'
      ]},
      { name: '化解小委屈', steps: [
        '双手抱一下自己，闭上眼睛，慢慢吸气',
        '告诉自己：我的感受很重要，委屈要讲出来',
        '呼气时，把心里的不舒服都吐出去',
        '对自己说：我值得被好好对待',
        '睁开眼，告诉自己：明天又是开心的一天'
      ]},
      { name: '迎接新挑战', steps: [
        '坐直身体，闭上眼睛，深吸一大口气',
        '告诉自己：新挑战就是新机会，我不怕',
        '呼气时，把 “怕做不好” 的顾虑吐出去',
        '想象自己搞定挑战，成就感满满',
        '对自己说：冲呀，我可以的'
      ]},
      { name: '和自己和解', steps: [
        '闭上眼睛，双手放在胸口，慢慢吸气',
        '告诉自己：偶尔犯错没关系，不用怪自己',
        '呼气时，把自责和懊悔都吐出去',
        '对自己说：我已经很努力了，要好好爱自己',
        '最后吸一口气，感受心里的平静'
      ]},
      { name: '交朋友不社恐', steps: [
        '闭上眼睛，深吸一口气，放松脸颊肌肉',
        '告诉自己：主动打招呼，没那么可怕',
        '慢慢呼气，把 “怕被拒绝” 的担心吐出去',
        '想象自己和新朋友聊得很开心',
        '对自己说：我很有趣，别人会喜欢和我聊天'
      ]}
    ],
    courageThemeNames: [],
    selectedCourageThemeIndex: -1,
    isCourageRunning: false,
    currentCourageStepIndex: 0,
    courageCompleted: false,
    courageNote: '',
    showCourageModal: false,
    timeCapsuleBannerImage: '',
    timeCapsuleCardBg: '',
    selectedDate: '',
    timeCapsuleContent: '',
    timeCapsules: [],
    reminderTicker: null,
    singleStationMode: false, // 是否从盛夏蹄印单站入口进入
    article: {
      id: '',
      title: '',
      subtitle: '',
      category: '',
      date: '',
      cover: '',
      createdAt: '',
      content: '',
      // 问答式数据
      qaTitle: '',
      qaImage: '',
      qaContent: '',
      // 启发式数据
      inspireText: '',
      inspireAuthor: '',
      // 时尚式数据
      characterImage: '',
      fashionContent: '',
      signature: ''
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const { articleId, isSmallCard, styleIndex, singleStation } = options || {};

    const isSmall = isSmallCard === 'true';
    const singleMode = !isSmall && singleStation === '1';
    let nextStyleIndex = this.data.currentStyleIndex;
    if (!isSmall && styleIndex !== undefined) {
      const idx = parseInt(styleIndex, 10);
      if (!isNaN(idx) && idx >= 0 && idx <= 3) {
        nextStyleIndex = idx;
      }
    }

    this.setData({
      isSmallCard: isSmall,
      singleStationMode: singleMode,
      currentStyleIndex: nextStyleIndex,
      currentStyleImage: this.getStyleImage(nextStyleIndex)
    });

    if (articleId) {
      this.loadArticleDetail(articleId);
    }
    this.loadCourageThemes(articleId);
    const avatar = wx.getStorageSync('currentAvatar') || '';
    if (avatar) this.setData({ currentAvatar: avatar });

    this.checkRemoteVipStatus();
    this.initRecord();
  },
  onShow: function () {
    this.startReminderTicker();
    this.loadTimeCapsules();
  },
  onHide: function () {
    this.stopReminderTicker();
  },
  onUnload: function () {
    this.stopReminderTicker();
  },
  async loadCourageThemes(articleId) {
    try {
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4',
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      await c1.init();
      const db = c1.database();
      const res = await db.collection('summer_hoofprint_articles').doc(articleId).get();
      const data = (res && res.data) || {};
      const arr = Array.isArray(data.themes) ? data.themes : [];
      const themes = arr.map(t => {
        const name = (t && (t.name || t.title)) || '';
        const contents = Array.isArray(t && t.content) ? t.content : (Array.isArray(t && t.contents) ? t.contents : (Array.isArray(t && t.steps) ? t.steps : []));
        return { name, steps: contents };
      });
      const useThemes = (themes && themes.length > 0) ? themes : (this.data.courageThemes || []);
      const names = useThemes.map(x => x.name);
      const aid = articleId || (this.data.article && this.data.article.id) || '';
      let idx = -1;
      if (aid) {
        const saved = wx.getStorageSync(`summer_courage_theme_${aid}`);
        if (saved !== undefined && saved !== null && String(saved) !== '') idx = parseInt(saved);
      }
      this.setData({ courageThemes: useThemes, courageThemeNames: names, selectedCourageThemeIndex: idx });
    } catch (_) {
      const useThemes = this.data.courageThemes || [];
      const names = useThemes.map(x => x.name);
      this.setData({ courageThemeNames: names });
    }
  },

  async checkRemoteVipStatus() {
    try {
      // 初始化跨环境云实例 (与 loadArticleDetail 保持一致)
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4', 
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      await c1.init();
      const db = c1.database();
      
      // 查询 summer_user 集合
      const res = await db.collection('summeruser').get();
      
      if (res.data && res.data.length > 0) {
        const user = res.data[0];
        
        // 更新本地存储
        wx.setStorageSync('isVip', user.isVip);
        if (user.vipExpiry) {
           wx.setStorageSync('vipExpiry', user.vipExpiry);
        }
        // 同步用户形象（首页显示的形象），并写入本地存储供小卡片读取
        const visualization = user.visualization || '';
        if (visualization) {
          let avatarUrl = visualization;
          if (avatarUrl.startsWith('cloud://')) {
            try {
              const fileRes = await c1.getTempFileURL({ fileList: [avatarUrl] });
              const item = fileRes.fileList && fileRes.fileList[0];
              if (item && item.tempFileURL) avatarUrl = item.tempFileURL;
            } catch (e) {}
          }
          this.setData({ currentAvatar: avatarUrl });
          wx.setStorageSync('currentAvatar', avatarUrl);
        }
        
        // 刷新页面锁定状态
        this.updateLockState();
      }
    } catch (e) {
      console.error('同步远程VIP状态失败', e);
    }
  },

  /**
   * 加载文章详情
   */
  loadArticleDetail: async function (articleId) {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const cacheKey = `summer_article_cache_${articleId}`;
      try {
        const cached = wx.getStorageSync(cacheKey);
        if (cached && cached.article && cached.expiresAt && cached.expiresAt > Date.now()) {
          this.setData({ article: cached.article });
          this.updateLockState();
          this.loadTimeCapsules();
        }
      } catch (_) {}
      // 初始化跨环境云实例
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4', // 资源方 AppID
        resourceEnv: 'cloud1-1gsyt78b92c539ef', // 资源方环境 ID
      });
      await c1.init();
      
      const db = c1.database();
      
      const res = await db.collection('summer_hoofprint_articles').doc(articleId).get();
      const data = res.data;
      
      // 处理图片链接
      let coverImage = data.cover_image || '';
      let a4Image = data.a4_image || '';
      let audioSrc = data.audio || '';
      
      const fileListToConvert = [];
      if (coverImage.startsWith('cloud://')) fileListToConvert.push(coverImage);
      if (a4Image.startsWith('cloud://')) fileListToConvert.push(a4Image);
      if (audioSrc && audioSrc.startsWith('cloud://')) fileListToConvert.push(audioSrc);

      // 如果是云文件ID，换取临时链接
      if (fileListToConvert.length > 0) {
        try {
          const ttlMs = 2 * 60 * 60 * 1000;
          const urlMap1 = await this.convertTempUrlsWithCache(c1, fileListToConvert, ttlMs);
          if (coverImage && urlMap1[coverImage]) coverImage = urlMap1[coverImage];
          if (a4Image && urlMap1[a4Image]) a4Image = urlMap1[a4Image];
          if (audioSrc && urlMap1[audioSrc]) audioSrc = urlMap1[audioSrc];
        } catch (imgErr) {
          console.error('图片链接转换失败', imgErr);
        }
      }

      // 辅助函数：格式化日期 (时间戳 -> YYYY.MM.DD)
      const formatDate = (timestamp) => {
        if (!timestamp) return '';
        if (typeof timestamp === 'string' && timestamp.includes('.')) return timestamp; // 已经是格式化好的字符串
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}.${month}.${day}`;
      };
      
      const normalizeType = (t) => {
        const sTrim = String(t || '').trim();
        const s = sTrim.toLowerCase();
        if (s === 'sketching' || sTrim === '涂色' || sTrim === '上色' || sTrim === '画板') return 'sketching';
        if (s === 'picture' || s === 'image' || sTrim === '普通图' || sTrim === '图片') return 'picture';
        return 'sketching';
      };
      
      // 构建页面需要的文章对象
      const article = {
        id: data._id,
        title: data.title || '无标题',
        subtitle: data.subtitle || '',
        category: data.category || '未分类',
        date: formatDate(data.publish_date) || '',
        cover: coverImage,
        createdAt: data.create_time ? new Date(data.create_time).toLocaleString() : '',
        level: data.level || 'low',
        type: normalizeType(data.type),
        content: data.content || '',
        contentPinyin: data.content_pinyin || '',
        isCarousel: this.normalizeBoolean(data.is_carousel),

        // 问答式数据
        qaTitle: data.qa_title || data.title || '关于本篇的思考',
        qaImage: data.qa_image || coverImage,
        qaContent: data.qa_content || data.content || '暂无问答内容',
        qaContentPinyin: data.qa_content_pinyin || '', // 问答拼音

        // 启发式数据 (图片+正文)
        inspireImage: data.inspire_image || coverImage,
        inspireText: data.inspire_content || data.content || '暂无启发内容',
        inspireTextPinyin: data.inspire_content_pinyin || '', // 启发拼音
        inspireAuthor: data.inspire_author || '—— 一只绵羊的春天',
        
        // 时尚式数据 (图片+正文)
        fashionImage: data.fashion_image || coverImage,
        fashionContent: data.fashion_content || data.content || '暂无内容',
        fashionContentPinyin: data.fashion_content_pinyin || '', // 时尚拼音
        signature: '一只绵羊的春天',

        // A4图片
        a4Image: a4Image,
        audio: audioSrc
      };

      // 辅助函数：处理拼音和文字的一一对应
      const processPinyin = (content, contentPinyin) => {
        if (!content || !contentPinyin) return null;
        
        const pinyinList = contentPinyin.trim().split(/\s+/);
        const charList = content.split('');
        const contentWithPinyin = [];
        let pinyinIndex = 0;
        
        for (let i = 0; i < charList.length; i++) {
          const char = charList[i];
          if (char.trim() === '' && char !== '\n') continue;
          
          let pinyin = '';
          if (char === '\n') {
             pinyin = ''; 
          } else {
            if (pinyinIndex < pinyinList.length) {
              pinyin = pinyinList[pinyinIndex];
              pinyinIndex++;
            }
          }
          
          contentWithPinyin.push({
            char: char,
            pinyin: pinyin,
            isLineBreak: char === '\n'
          });
        }
        return contentWithPinyin;
      };

      // 处理拼音（仅低难度展示）
      const normalizeLevel = (lv) => {
        const s = String(lv || '').toLowerCase();
        if (s.includes('low') || s.includes('低')) return '低难度';
        if (s.includes('high') || s.includes('高')) return '高难度';
        return '低难度';
      };
      const isLow = normalizeLevel(article.level) === '低难度';
      if (isLow) {
        article.contentWithPinyin = processPinyin(article.content, article.contentPinyin);
        article.qaContentWithPinyin = processPinyin(article.qaContent, article.qaContentPinyin);
        article.inspireTextWithPinyin = processPinyin(article.inspireText, article.inspireTextPinyin);
        article.fashionContentWithPinyin = processPinyin(article.fashionContent, article.fashionContentPinyin);
      } else {
        article.contentWithPinyin = null;
        article.qaContentWithPinyin = null;
        article.inspireTextWithPinyin = null;
        article.fashionContentWithPinyin = null;
        article.contentPinyin = '';
        article.qaContentPinyin = '';
        article.inspireTextPinyin = '';
        article.fashionContentPinyin = '';
      }

      // 如果有图片链接需要转换（除了封面图外的其他图片）
      // 增加 chargingStationImage 和 energyCardBg
      const chargingStationFileID = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/充电站.jpg';
      const energyCardBgFileID = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/能力打印.png';
      const courageBannerFileID = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/勇气补给站.jpg';
      const courageCardBgFileID = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/补充站.png';
      const solitudeCardBgFileID = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/净土打印.png';
      const solitudeBannerFileID = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/净土站.jpg';
      const timeCapsuleBannerFileID = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/时光.jpg';
      const timeCapsuleCardBgFileID = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/时光站.png';

      const topImageSmallCardCloudId = this.data.topImageSmallCardCloudId || '';

      const extraResources = [
        article.qaImage,
        article.inspireImage,
        article.fashionImage,
        article.a4Image,
        chargingStationFileID,
        energyCardBgFileID,
        courageBannerFileID,
        courageCardBgFileID,
        solitudeCardBgFileID,
        solitudeBannerFileID,
        timeCapsuleBannerFileID,
        timeCapsuleCardBgFileID,
        topImageSmallCardCloudId
      ].filter(res => res && res.startsWith('cloud://'));

      if (extraResources.length > 0) {
        try {
          const ttlMs2 = 2 * 60 * 60 * 1000;
          const urlMap = await this.convertTempUrlsWithCache(c1, extraResources, ttlMs2);
          
          if (article.qaImage && urlMap[article.qaImage]) article.qaImage = urlMap[article.qaImage];
          if (article.inspireImage && urlMap[article.inspireImage]) article.inspireImage = urlMap[article.inspireImage];
          if (article.fashionImage && urlMap[article.fashionImage]) article.fashionImage = urlMap[article.fashionImage];
          if (article.a4Image && urlMap[article.a4Image]) article.a4Image = urlMap[article.a4Image];
          
          if (urlMap[chargingStationFileID]) {
             this.setData({ chargingStationImage: urlMap[chargingStationFileID] });
          }
          if (urlMap[timeCapsuleBannerFileID]) {
            this.setData({ timeCapsuleBannerImage: urlMap[timeCapsuleBannerFileID] });
          }
          if (urlMap[timeCapsuleCardBgFileID]) {
            this.setData({ timeCapsuleCardBg: urlMap[timeCapsuleCardBgFileID] });
          }
          // 更新 energyCardBg
          if (urlMap[energyCardBgFileID]) {
             this.setData({ energyCardBg: urlMap[energyCardBgFileID] });
          }
          if (urlMap[courageBannerFileID]) {
             this.setData({ courageBannerImage: urlMap[courageBannerFileID] });
          }
          if (urlMap[courageCardBgFileID]) {
             this.setData({ courageCardBg: urlMap[courageCardBgFileID] });
          } else if (urlMap[courageBannerFileID]) {
             this.setData({ courageCardBg: urlMap[courageBannerFileID] });
          }
          if (urlMap[solitudeCardBgFileID]) {
             this.setData({ solitudeCardBg: urlMap[solitudeCardBgFileID] });
          }
          if (urlMap[solitudeBannerFileID]) {
             this.setData({ solitudeBannerImage: urlMap[solitudeBannerFileID] });
          } else if (urlMap[chargingStationFileID]) {
             this.setData({ solitudeBannerImage: urlMap[chargingStationFileID] });
          } else if (urlMap[courageBannerFileID]) {
             this.setData({ solitudeBannerImage: urlMap[courageBannerFileID] });
          }
          if (topImageSmallCardCloudId && urlMap[topImageSmallCardCloudId]) {
            this.setData({ topImageSmallCardUrl: urlMap[topImageSmallCardCloudId] });
          }

        } catch (extraErr) {
          console.error('其他资源链接转换失败', extraErr);
        }
      }

      const isCarousel = this.normalizeBoolean(data && data.is_carousel);
      const requiresVip = isCarousel === false;
      const locked = requiresVip && !this.isVipValid();

      this.setData({
        article: article,
        canPaint: (!this.data.isSmallCard) && article.type === 'sketching' && !locked,
        isLocked: locked
      }, () => {
        this.loadTimeCapsules();
        // 恢复独处净土站本地状态
        try {
          const aid = article.id || '';
          if (aid) {
            wx.removeStorageSync(`summer_solitude_image_${aid}`);
            const sThing = wx.getStorageSync(`summer_solitude_thing_${aid}`);
            const sNote = wx.getStorageSync(`summer_solitude_note_${aid}`);
            const sImg = wx.getStorageSync(`summer_solitude_image_${aid}`);
            if (sThing !== undefined && sThing !== null) this.setData({ solitudeThing: String(sThing || '') });
            if (sNote !== undefined && sNote !== null) this.setData({ solitudeNote: String(sNote || '') });
            this.setData({ solitudeImage: sImg || '' });
          }
        } catch (_) {}
        if (this.data.isSmallCard && article.a4Image && !this.data.isLocked && this.data.canPaint) {
          setTimeout(() => {
            this.initCanvas();
          }, 500);
        }
        if (!this.data.isSmallCard) {
          if (!this.data.isLocked && article.audio) {
            this.initAudio();
          } else {
            this.setData({
              audioTimeText: this.data.isLocked ? '会员专属' : '暂无音频',
              audioProgress: 0
            });
          }
        }
        try { wx.setStorageSync(cacheKey, { article, expiresAt: Date.now() + 10 * 60 * 1000 }); } catch (_) {}
      });

      wx.setNavigationBarTitle({
        title: this.data.isSmallCard ?  '弹走烦恼，春暖花开' : article.title
      });
      
      // 检查收藏状态
      this.checkFavoriteStatus();
      
    } catch (err) {
      console.error('加载文章详情失败', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
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
  updateLockState() {
    const a = this.data.article;
    if (!a || !a.id) return;
    const requiresVip = a.isCarousel === false;
    const locked = requiresVip && !this.isVipValid();
    const canPaint = (!this.data.isSmallCard) && a.type === 'sketching' && !locked;
    const prevLocked = this.data.isLocked;
    this.setData({ isLocked: locked, canPaint });
    if (!locked && prevLocked) {
      if (!this.data.isSmallCard) {
        if (a.audio && !this.data.audioContext) this.initAudio();
      } else {
        if (a.a4Image && this.data.canPaint) {
          setTimeout(() => { this.initCanvas(); }, 300);
        }
      }
    }
  },
  normalizeBoolean(v) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = String(v).trim().toLowerCase();
    if (s === 'false' || s === '0' || s === 'no' || s === 'n' || s === '') return false;
    if (s === 'true' || s === '1' || s === 'yes' || s === 'y') return true;
    return !!v;
  },
  isVipValid() {
    const raw = wx.getStorageSync('isVip');
    const isVip = this.normalizeBoolean(raw);
    if (!isVip) return false;
    
    const expiryStr = wx.getStorageSync('vipExpiry');
    // 如果没有过期时间，默认为永久VIP（兼容测试场景）
    if (!expiryStr) return true;
    
    const expiry = this.parseDateString(expiryStr);
    // 如果日期格式无法解析，也默认为有效
    if (!expiry) return true;
    
    const now = new Date();
    return expiry.getTime() >= now.getTime();
  },
  parseDateString(str) {
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
  goVip() {
    wx.navigateTo({
      url: '/pages/vip/vip'
    });
  },

  onCourageThemeChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({ selectedCourageThemeIndex: index, courageCompleted: false, currentCourageStepIndex: 0 });
    const aid = (this.data.article && this.data.article.id) || '';
    if (aid) wx.setStorageSync(`summer_courage_theme_${aid}`, index);
  },
  startCourageSupply() {
    getApp().playClickSound && getApp().playClickSound();
    if (this.data.selectedCourageThemeIndex < 0) {
      wx.showToast({ title: '请选择主题', icon: 'none' });
      return;
    }
    const theme = this.data.courageThemes[this.data.selectedCourageThemeIndex];
    const steps = theme.steps || [];
    this.setData({ isCourageRunning: true });
    const aid = (this.data.article && this.data.article.id) || '';
    let idx = this.data.currentCourageStepIndex || 0;
    if (!Number.isInteger(idx) || idx < 0 || idx >= steps.length) idx = 0;
    this.setData({ currentCourageStepIndex: idx, showCourageModal: true });
    if (aid) wx.setStorageSync(`summer_courage_step_${aid}`, idx);
  },
  onCourageNoteInput(e) {
    const raw = String(e.detail.value || '');
    const limited = Array.from(raw).slice(0, 80).join('');
    this.setData({ courageNote: limited });
    const aid = (this.data.article && this.data.article.id) || '';
    if (aid) wx.setStorageSync(`summer_courage_note_${aid}`, limited);
  },
  onCourageModalConfirm() {
    getApp().playClickSound && getApp().playClickSound();
    const theme = this.data.courageThemes[this.data.selectedCourageThemeIndex] || {};
    const steps = theme.steps || [];
    const aid = (this.data.article && this.data.article.id) || '';
    const next = (this.data.currentCourageStepIndex || 0) + 1;
    if (next >= steps.length) {
      this.setData({ showCourageModal: false, isCourageRunning: false, courageCompleted: true });
      if (aid) wx.setStorageSync(`summer_courage_progress_${aid}`, 'done');
      wx.showToast({ title: '补给完成', icon: 'success' });
      return;
    }
    this.setData({ currentCourageStepIndex: next });
    if (aid) wx.setStorageSync(`summer_courage_step_${aid}`, next);
  },
  onCourageModalCancel() {
    getApp().playClickSound && getApp().playClickSound();
    this.setData({ showCourageModal: false });
  },
  onSolitudeThingInput(e) {
    const raw = String(e.detail.value || '');
    const limited = Array.from(raw).slice(0, 12).join('');
    this.setData({ solitudeThing: limited });
    const aid = (this.data.article && this.data.article.id) || '';
    if (aid) wx.setStorageSync(`summer_solitude_thing_${aid}`, limited);
  },
  onSolitudeNoteInput(e) {
    const raw = String(e.detail.value || '');
    const limited = Array.from(raw).slice(0, 78).join('');
    this.setData({ solitudeNote: limited });
    const aid = (this.data.article && this.data.article.id) || '';
    if (aid) wx.setStorageSync(`summer_solitude_note_${aid}`, limited);
  },
  chooseSolitudeImage() {
    getApp().playClickSound && getApp().playClickSound();
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const path =
          (res.tempFilePaths && res.tempFilePaths[0]) ||
          (res.tempFiles && res.tempFiles[0] && (res.tempFiles[0].tempFilePath || res.tempFiles[0].path)) ||
          '';
        if (!path) {
          wx.showToast({ title: '选择失败', icon: 'none' });
          return;
        }
        this.setData({ solitudeImage: path });
        const aid = (this.data.article && this.data.article.id) || '';
        this.checkAndAcceptSolitudeImage(path, aid);
      }
    });
  },
  generateCourageCard() {
    getApp().playClickSound && getApp().playClickSound();
    if (!this.data.courageCardBg) {
      wx.showToast({ title: '底图加载中，请稍后...', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '生成中...' });
    const query = wx.createSelectorQuery();
    query.select('#courageCardCanvas')
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res[0] || !res[0].node) {
          wx.hideLoading();
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 1;
        const width = 1000;
        const height = 1000;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        try {
          const bg = canvas.createImage();
          bg.src = this.data.courageCardBg;
          await new Promise((resolve) => { bg.onload = resolve; bg.onerror = resolve; });
          ctx.drawImage(bg, 0, 0, width, height);
          const dateStr = (this.data.article && this.data.article.date) ? this.data.article.date : '';
          ctx.fillStyle = '#2c3e50';
          ctx.font = 'bold 32px sans-serif';
          ctx.textAlign = 'center';
          ctx.save();
          ctx.translate(500, 260);
          ctx.rotate(-Math.PI / 14);
          ctx.textBaseline = 'middle';
          if (dateStr) ctx.fillText(dateStr, 0, 0);
          ctx.restore();
          const themeName = this.data.selectedCourageThemeIndex >= 0 ? this.data.courageThemes[this.data.selectedCourageThemeIndex].name : '';
          if (themeName) {
            ctx.font = 'bold 36px sans-serif';
            ctx.save();
            ctx.translate(570, 345);
            ctx.rotate(-Math.PI / 14);
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            ctx.fillText(themeName, 0, 0);
            ctx.restore();
          }
          if (this.data.courageNote) {
            ctx.fillStyle = '#2c3e50';
            ctx.font = '32px sans-serif';
            ctx.textAlign = 'left';
            const lines = this.segmentNote(this.data.courageNote);
            const lineHeight = 45;
            const indentX = ctx.measureText('一一').width;
            ctx.save();
            ctx.translate(300, 560);
            ctx.rotate(-Math.PI / 14);
            ctx.textBaseline = 'top';
            lines.forEach((line, index) => {
              if (index >= 7) return;
              if (line) ctx.fillText(line, index === 0 ? indentX : 0, index * lineHeight);
            });
            ctx.restore();
          }
          wx.canvasToTempFilePath({
            canvas: canvas,
            fileType: 'jpg',
            quality: 0.9,
            success: (res2) => {
              wx.hideLoading();
              wx.previewImage({ urls: [res2.tempFilePath] });
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '生成失败', icon: 'none' });
            }
          });
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '生成出错', icon: 'none' });
        }
      });
  },
  async generateSolitudeCard() {
    getApp().playClickSound && getApp().playClickSound();
    if (!this.data.solitudeCardBg) {
      try {
        const c1 = new wx.cloud.Cloud({
          resourceAppid: 'wx85d92d28575a70f4',
          resourceEnv: 'cloud1-1gsyt78b92c539ef',
        });
        await c1.init();
        const solitudeCardBgFileID = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/净土打印.png';
        const res = await c1.getTempFileURL({
          fileList: [solitudeCardBgFileID],
          config: { maxAge: 3 * 60 * 60 }
        });
        if (res.fileList && res.fileList[0] && res.fileList[0].status === 0) {
          this.setData({ solitudeCardBg: res.fileList[0].tempFileURL });
        }
      } catch (_) {}
      if (!this.data.solitudeCardBg) {
        wx.showToast({ title: '底图未就绪，请稍后重试', icon: 'none' });
        return;
      }
    }
    wx.showLoading({ title: '生成中...' });
    const query = wx.createSelectorQuery();
    query.select('#solitudeCardCanvas')
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res[0] || !res[0].node) {
          wx.hideLoading();
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 1;
        const width = 1000;
        const height = 1000;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        try {
          // 背景
          const bg = canvas.createImage();
          bg.src = this.data.solitudeCardBg;
          await new Promise((resolve) => { bg.onload = resolve; bg.onerror = resolve; });
          ctx.drawImage(bg, 0, 0, width, height);
          // 日期
          const dateStr = (this.data.article && this.data.article.date) ? this.data.article.date : '';
          ctx.fillStyle = '#2c3e50';
          ctx.font = 'bold 32px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (dateStr) ctx.fillText(dateStr, 630, 140);
          // 独处小事
          if (this.data.solitudeThing) {
            ctx.font = 'bold 34px sans-serif';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            ctx.fillText(this.data.solitudeThing, 420, 310);
          }
          // 照片
          if (this.data.solitudeImage) {
            await this.drawImageRoundRect(canvas, ctx, this.data.solitudeImage, 185, 468, 380, 250, 36);
          }
          // 生活感受
          if (this.data.solitudeNote) {
            ctx.fillStyle = '#2c3e50';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'left';
            const lines = this.segmentNote(this.data.solitudeNote, 8, 10);
            const lineHeight = 40;
            const indentX = ctx.measureText('一一').width;
            ctx.textBaseline = 'top';
            lines.forEach((line, index) => {
              if (index >= 8) return;
              if (line) ctx.fillText(line, 685 + (index === 0 ? indentX : 0), 480 + index * lineHeight);
            });
          }
          // 导出预览
          wx.canvasToTempFilePath({
            canvas: canvas,
            fileType: 'jpg',
            quality: 0.9,
            success: (res2) => {
              wx.hideLoading();
              wx.previewImage({ urls: [res2.tempFilePath] });
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '生成失败', icon: 'none' });
            }
          });
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '生成出错', icon: 'none' });
        }
      });
  },
  onDateChange(e) {
    const v = (e.detail && e.detail.value) || '';
    this.setData({ selectedDate: v });
  },
  onTimeCapsuleInput(e) {
    const raw = String(e.detail.value || '');
    const limited = Array.from(raw).slice(0, 94).join('');
    this.setData({ timeCapsuleContent: limited });
  },
  async saveTimeCapsule() {
    getApp().playClickSound && getApp().playClickSound();
    const d = String(this.data.selectedDate || '').trim();
    const c = String(this.data.timeCapsuleContent || '').trim();
    const articleId = (this.data.article && this.data.article.id) || '';
    if (!d || !c) {
      wx.showToast({ title: '请填写日期和内容', icon: 'none' });
      return;
    }
    const ds = d.split('-');
    const y = parseInt(ds[0], 10);
    const m = parseInt(ds[1], 10);
    const day = parseInt(ds[2], 10);
    const dueAt = new Date(y, m - 1, day, 0, 0, 0).getTime();
    const id = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const item = {
      id,
      content: c,
      dueAt,
      createdAt: Date.now(),
      notified: false,
      articleId
    };
    const key = `summer_time_capsules_${articleId}`;
    const list = wx.getStorageSync(key) || [];
    list.push(item);
    wx.setStorageSync(key, list);
    reminderManager.add(item);
    this.loadTimeCapsules();
    try {
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4',
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      await c1.init();
      const db = c1.database();
      await db.collection('summer_time_capsules').add({ data: item });
    } catch (_) {}
    wx.showToast({ title: '已封存', icon: 'success' });
    this.setData({ timeCapsuleContent: '' });
    try { reminderManager.checkAndNotify(); } catch (_) {}
  },
  formatDateYMD(ts) {
    const d = new Date(Number(ts) || 0);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}.${m}.${day}`;
  },
  loadTimeCapsules() {
    const article = this.data.article || {};
    const articleId = article.id || '';
    if (!articleId) return;
    const key = `summer_time_capsules_${articleId}`;
    const list = wx.getStorageSync(key) || [];
    const now = Date.now();
    const nd = new Date(now);
    const todayStart = new Date(nd.getFullYear(), nd.getMonth(), nd.getDate(), 0, 0, 0, 0).getTime();
    const globalList = wx.getStorageSync('summer_time_capsules_global') || [];
    const gmap = {};
    for (let i = 0; i < globalList.length; i++) {
      const gi = globalList[i];
      if (gi && gi.id) gmap[gi.id] = gi;
    }
    const mapped = list
      .slice()
      .sort((a, b) => {
        const ax = typeof a.createdAt === 'number' ? a.createdAt : a.dueAt || 0;
        const bx = typeof b.createdAt === 'number' ? b.createdAt : b.dueAt || 0;
        return bx - ax;
      })
      .map(it => {
        const gi = gmap[it.id] || {};
        const r = String((gi.result !== undefined ? gi.result : it.result) || '').trim();
        const notified = (gi.notified !== undefined ? gi.notified : it.notified) || false;
        let statusLabel = '';
        let statusClass = '';
        if (r === 'done') {
          statusLabel = '已完成';
          statusClass = 'status-done';
        } else if (r === 'missed') {
          statusLabel = '未完成';
          statusClass = 'status-missed';
        } else {
          if (!notified) {
            statusLabel = (it.dueAt < todayStart) ? '未完成' : '待提醒';
            statusClass = (it.dueAt < todayStart) ? 'status-missed' : 'status-waiting';
          } else {
            statusLabel = (it.dueAt < todayStart) ? '未完成' : '待提醒';
            statusClass = (it.dueAt < todayStart) ? 'status-missed' : 'status-waiting';
          }
        }
        return {
          ...it,
          dueAtStr: this.formatDateYMD(it.dueAt),
          createdAtStr: this.formatDateYMD(it.createdAt),
          statusLabel,
          statusClass
        };
      });
    this.setData({ timeCapsules: mapped });
  },
  removeTimeCapsule(e) {
    getApp().playClickSound && getApp().playClickSound();
    const id = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id;
    const article = this.data.article || {};
    const articleId = article.id || '';
    if (!id || !articleId) return;
    const key = `summer_time_capsules_${articleId}`;
    const list = wx.getStorageSync(key) || [];
    const next = list.filter(it => it.id !== id);
    wx.setStorageSync(key, next);
    reminderManager.remove(id);
    this.loadTimeCapsules();
    wx.showToast({ title: '已删除', icon: 'none' });
  },
  startReminderTicker() {
    if (this.data.reminderTicker) return;
    const timer = setInterval(() => {
      try { reminderManager.checkAndNotify(); } catch (_) {}
    }, 60000);
    this.setData({ reminderTicker: timer });
  },
  stopReminderTicker() {
    const t = this.data.reminderTicker;
    if (t) {
      clearInterval(t);
      this.setData({ reminderTicker: null });
    }
  },
  generateTimeCapsuleCard() {
    getApp().playClickSound && getApp().playClickSound();
    if (!this.data.timeCapsuleCardBg) {
      wx.showToast({ title: '底图加载中，请稍后...', icon: 'none' });
      return;
    }
    const list = Array.isArray(this.data.timeCapsules) ? this.data.timeCapsules : [];
    const latest = list && list.length > 0 ? list[0] : null;
    const contentToPrint = latest ? String(latest.content || '') : String(this.data.timeCapsuleContent || '');
    if (!contentToPrint) {
      wx.showToast({ title: '暂无胶囊内容', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '生成中...' });
    const query = wx.createSelectorQuery();
    query.select('#timeCapsuleCanvas')
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res[0] || !res[0].node) {
          wx.hideLoading();
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 1;
        const width = 1000;
        const height = 1000;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        try {
          const bg = canvas.createImage();
          bg.src = this.data.timeCapsuleCardBg;
          await new Promise((resolve) => { bg.onload = resolve; bg.onerror = resolve; });
          ctx.drawImage(bg, 0, 0, width, height);
          const dateStr = latest && typeof latest.dueAt === 'number'
            ? this.formatDateYMD(latest.dueAt)
            : (() => {
                const ds = String(this.data.selectedDate || '').trim();
                if (ds && ds.includes('-')) {
                  const parts = ds.split('-');
                  return `${parts[0]}.${parts[1]}.${parts[2]}`;
                }
                return (this.data.article && this.data.article.date) ? this.data.article.date : '';
              })();
          ctx.fillStyle = '#2c3e50';
          ctx.font = 'bold 34px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(dateStr, 600, 310);
          const createdAtStr = (this.data.article && this.data.article.date) ? this.data.article.date : '';
          ctx.fillStyle = '#2c3e50';
          ctx.font = 'bold 34px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${createdAtStr}`, 600, 200);
          if (contentToPrint) {
            ctx.fillStyle = '#2c3e50';
            ctx.font = '32px sans-serif';
            ctx.textAlign = 'left';
            const lines = this.segmentNote(contentToPrint, 14, 16);
            const lineHeight = 45;
            const indentX = ctx.measureText('一一').width;
            ctx.textBaseline = 'top';
            lines.forEach((line, index) => {
              if (index >= 7) return;
              if (line) ctx.fillText(line, 250 + (index === 0 ? indentX : 0), 550 + index * lineHeight);
            });
          }
          wx.canvasToTempFilePath({
            canvas: canvas,
            fileType: 'jpg',
            quality: 0.9,
            success: (res2) => {
              wx.hideLoading();
              wx.previewImage({ urls: [res2.tempFilePath] });
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '生成失败', icon: 'none' });
            }
          });
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '生成出错', icon: 'none' });
        }
      });
  },
  // 情绪充电站方法
  selectEnergy(e) {
    getApp().playClickSound && getApp().playClickSound();
    const level = e.currentTarget.dataset.level;
    this.setData({ energyLevel: level });
    const aid = (this.data.article && this.data.article.id) || '';
    if (aid) wx.setStorageSync(`summer_energy_level_${aid}`, level);
  },
  toggleMoodDropdown() {
    getApp().playClickSound && getApp().playClickSound();
    const v = !this.data.showMoodDropdown;
    this.setData({ showMoodDropdown: v });
  },
  onSelectMood(e) {
    getApp().playClickSound && getApp().playClickSound();
    const tag = e.currentTarget.dataset.tag;
    this.setData({ selectedMoodTags: [tag], showMoodDropdown: false });
    const aid = (this.data.article && this.data.article.id) || '';
    if (aid) {
      wx.setStorageSync(`summer_selected_mood_tags_${aid}`, [tag]);
      wx.setStorageSync(`summer_selected_mood_tag_${aid}`, tag);
    }
  },

  toggleMoodTag(e) {
    const tag = e.currentTarget.dataset.tag;
    const { selectedMoodTags } = this.data;
    
    // 改为单选逻辑：
    // 如果点击已选中的，则取消选中（清空）
    // 如果点击未选中的，则直接替换为当前这个
    if (selectedMoodTags.includes(tag)) {
      this.setData({ selectedMoodTags: [] });
      const aid = (this.data.article && this.data.article.id) || '';
      if (aid) {
        wx.setStorageSync(`summer_selected_mood_tags_${aid}`, []);
        wx.setStorageSync(`summer_selected_mood_tag_${aid}`, '');
      }
    } else {
      this.setData({ selectedMoodTags: [tag] });
      const aid = (this.data.article && this.data.article.id) || '';
      if (aid) {
        wx.setStorageSync(`summer_selected_mood_tags_${aid}`, [tag]);
        wx.setStorageSync(`summer_selected_mood_tag_${aid}`, tag);
      }
    }
  },

  onNoteInput(e) {
    const raw = String(e.detail.value || '');
    const limited = Array.from(raw).slice(0, 20).join('');
    this.setData({ userNote: limited });
    const aid = (this.data.article && this.data.article.id) || '';
    if (aid) wx.setStorageSync(`summer_user_note_${aid}`, limited);
  },

  chooseUserImage() {
    getApp().playClickSound && getApp().playClickSound();
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const path =
          (res.tempFilePaths && res.tempFilePaths[0]) ||
          (res.tempFiles && res.tempFiles[0] && (res.tempFiles[0].tempFilePath || res.tempFiles[0].path)) ||
          '';
        if (!path) {
          wx.showToast({ title: '选择失败', icon: 'none' });
          return;
        }
        this.setData({ userImage: path });
        const aid = (this.data.article && this.data.article.id) || '';
        this.checkAndAcceptUserImage(path, aid);
      }
    });
  },

  generateEnergyCard() {
    getApp().playClickSound && getApp().playClickSound();
    if (this.data.energyLevel === 0) {
      wx.showToast({ title: '请选择能量值', icon: 'none' });
      return;
    }
    
    if (!this.data.energyCardBg) {
       wx.showToast({ title: '底图加载中，请稍后...', icon: 'none' });
       return;
    }

    wx.showLoading({ title: '生成中...' });
    const that = this;
    const query = wx.createSelectorQuery();
    query.select('#energyCardCanvas')
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res[0] || !res[0].node) {
            wx.hideLoading();
            return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 1;
        
        // 设定画布尺寸
        const width = 1000;
        const height = 1000; 
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        
        try {
            // 1. 绘制底图
            const img = canvas.createImage();
            img.src = that.data.energyCardBg;
            await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
            ctx.drawImage(img, 0, 0, width, height);
            
            // 2. 绘制日期 (右上角绿色云朵)
            const dateStr = (that.data.article && that.data.article.date) ? that.data.article.date : '';
            ctx.fillStyle = '#2c3e50';
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            if (dateStr) ctx.fillText(dateStr, 680, 145); 
            
            // 3. 绘制能量值 (中间绿色长条)
            const stars = that.data.energyLevel;
            ctx.font = '40px sans-serif';
            ctx.fillStyle = '#ffffffff'; // 白色星星
            let starStr = '';
            for(let i=0; i<stars; i++) starStr += '★';
            for(let i=stars; i<5; i++) starStr += '☆';
            ctx.textAlign = 'center';
            // 下移5rpx(约2-3px)，从255改为258
            ctx.fillText(starStr, 650, 260);
            
            // 4. 绘制照片 (左侧白框)
            if (that.data.userImage) {
                // 右移5rpx(约2-3px)，x从210改为213
                await that.drawImageInRect(canvas, ctx, that.data.userImage, 220, 360, 380, 250);
            }
            
            // 5. 绘制标签 (右侧蓝色对话框)
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px sans-serif';
            ctx.textAlign = 'center';
            const tags = that.data.selectedMoodTags || [];
            if (tags.length > 0) {
                 tags.forEach((tag, index) => {
                     // 限制只显示前3个，防止溢出，大幅下移，从500调整到550
                     if(index < 3) ctx.fillText(tag, 800, 540 + index * 50);
                 });
            }
            
            // 6. 绘制感悟 (底部青色云朵)
            if (that.data.userNote) {
                ctx.fillStyle = '#2c3e50'; // 哑光黑
                ctx.font = '32px sans-serif';
                ctx.textAlign = 'left';
                // 左移20rpx(约10px)，从400改为390
                // 按分行规则：4 / 6 / 7 / 4 个字
                const lines = that.segmentNoteByPattern(that.data.userNote, [4, 6, 7, 4]);
                const x = 290;
                const baseY = 720;
                const lineHeight = 45;
                lines.forEach((line, index) => {
                    if (line) {
                        ctx.fillText(line, x, baseY + index * lineHeight);
                    }
                });
            }

            // 导出
            wx.canvasToTempFilePath({
                canvas: canvas,
                fileType: 'jpg',
                quality: 0.9,
                success: (res) => {
                    wx.hideLoading();
                    wx.previewImage({
                        urls: [res.tempFilePath]
                    });
                },
                fail: () => {
                   wx.hideLoading();
                   wx.showToast({ title: '生成失败', icon: 'none' });
                }
            });
            
        } catch (e) {
            console.error(e);
            wx.hideLoading();
            wx.showToast({ title: '生成出错', icon: 'none' });
        }
      });
  },

  // 辅助：在指定区域绘制图片（裁剪/缩放）
  async drawImageInRect(canvas, ctx, src, x, y, w, h) {
      if (!src) return;
      try {
          const img = canvas.createImage();
          img.src = src;
          await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
          });
          
          // 计算 cover 模式
          const imgRatio = img.width / img.height;
          const rectRatio = w / h;
          
          let sx, sy, sw, sh;
          
          if (imgRatio > rectRatio) {
              // 图片更宽，裁掉两边
              sh = img.height;
              sw = sh * rectRatio;
              sy = 0;
              sx = (img.width - sw) / 2;
          } else {
              // 图片更高，裁掉上下
              sw = img.width;
              sh = sw / rectRatio;
              sx = 0;
              sy = (img.height - sh) / 2;
          }
          
          ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
      } catch (e) {
          console.error('绘制子图失败', e);
      }
  },
  async drawImageRoundRect(canvas, ctx, src, x, y, w, h, r = 24) {
      if (!src) return;
      try {
          const img = canvas.createImage();
          img.src = src;
          await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
          });
          const imgRatio = img.width / img.height;
          const rectRatio = w / h;
          let sx, sy, sw, sh;
          if (imgRatio > rectRatio) {
              sh = img.height;
              sw = sh * rectRatio;
              sy = 0;
              sx = (img.width - sw) / 2;
          } else {
              sw = img.width;
              sh = sw / rectRatio;
              sx = 0;
              sy = (img.height - sh) / 2;
          }
          const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x + rr, y);
          ctx.lineTo(x + w - rr, y);
          ctx.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0);
          ctx.lineTo(x + w, y + h - rr);
          ctx.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2);
          ctx.lineTo(x + rr, y + h);
          ctx.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI);
          ctx.lineTo(x, y + rr);
          ctx.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
          ctx.restore();
      } catch (e) {
          console.error('绘制子图失败', e);
      }
  },

  // 辅助：文字换行
  wrapText(ctx, text, x, y, maxWidth, lineHeight, maxHeight, center = false) {
    const chars = text.split('');
    let line = '';
    let currentY = y;
    const startY = y;

    for (let n = 0; n < chars.length; n++) {
      const testLine = line + chars[n];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        if (center) ctx.fillText(line, x, currentY);
        else ctx.fillText(line, x, currentY);
        
        line = chars[n];
        currentY += lineHeight;
        if (maxHeight && (currentY - startY > maxHeight)) break;
      } else {
        line = testLine;
      }
    }
    if (center) ctx.fillText(line, x, currentY);
    else ctx.fillText(line, x, currentY);
    
    return currentY + lineHeight; 
  },
  segmentNote(text, firstLen = 10, restLen = 12) {
    const s = String(text || '');
    const chars = Array.from(s.replace(/\s+/g, ''));
    const lines = [];
    if (chars.length <= firstLen) {
      lines.push(chars.join(''));
      return lines;
    }
    lines.push(chars.slice(0, firstLen).join(''));
    let idx = firstLen;
    while (idx < chars.length) {
      lines.push(chars.slice(idx, idx + restLen).join(''));
      idx += restLen;
    }
    return lines;
  },
  segmentNoteByPattern(text, pattern = [4, 6, 7, 4]) {
    const s = String(text || '');
    const chars = Array.from(s.replace(/\s+/g, ''));
    const lines = [];
    let idx = 0;
    for (let i = 0; i < pattern.length && idx < chars.length; i++) {
      const len = Math.max(0, Number(pattern[i]) || 0);
      if (len <= 0) continue;
      lines.push(chars.slice(idx, idx + len).join(''));
      idx += len;
    }
    return lines;
  },

  initAudio() {
    // 进入页面即初始化并预加载音频，不等待点击
    if (this.data.audioContext) {
      try { this.data.audioContext.destroy(); } catch (_) {}
    }
    const ctx = wx.createInnerAudioContext();
    ctx.autoplay = false;
    ctx.loop = false;
    ctx.obeyMuteSwitch = true;
    ctx.src = this.data.article.audio;

    // 元数据就绪后读取总时长并刷新UI
    const updateDuration = () => {
      const du = ctx.duration || 0;
      if (du > 0) {
        const ft = (t) => {
          const m = Math.floor(t / 60);
          const s = Math.floor(t % 60);
          return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        };
        this.setData({
          audioDuration: du,
          audioTimeText: `${ft(0)} / ${ft(du)}`,
          audioProgress: 0
        });
      }
    };
    ctx.onCanplay(() => {
      // 某些环境下 duration 需要异步才可读，做一次延迟读取
      setTimeout(updateDuration, 150);
    });

    ctx.onTimeUpdate(() => {
      const ct = ctx.currentTime || 0;
      const du = ctx.duration || 0;
      const progress = du > 0 ? Math.min(100, Math.max(0, (ct / du) * 100)) : 0;
      const ft = (t) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      };
      this.setData({
        audioCurrentTime: ct,
        audioDuration: du,
        audioProgress: progress,
        audioTimeText: `${ft(ct)} / ${ft(du)}`
      });
    });
    ctx.onEnded(() => {
      this.setData({ isPlaying: false });
    });
    ctx.onError(() => {
      this.setData({
        isPlaying: false,
        audioTimeText: '音频加载失败',
        audioProgress: 0
      });
    });

    this.setData({ audioContext: ctx });
  },
  toggleAudioPlay() {
    getApp().playClickSound && getApp().playClickSound();
    const article = this.data.article;
    if (!article || !article.audio) {
      wx.showToast({ title: '暂无音频', icon: 'none' });
      return;
    }
    if (!this.data.audioContext) this.initAudio();
    const ctx = this.data.audioContext;
    if (!this.data.isPlaying) {
      ctx.play();
      this.setData({ isPlaying: true });
    } else {
      ctx.pause();
      this.setData({ isPlaying: false });
    }
  },

  /**
   * 检查收藏状态
   */
  checkFavoriteStatus: function() {
      const article = this.data.article;
      if (!article || !article.id) return;
      
      const cloud = getApp().cloud || wx.cloud;
      const db = cloud.database();
      const cardType = this.data.isSmallCard ? 'small' : 'main';
      const openid = wx.getStorageSync('openid');
      const whereCond = {
          type: 'article',
          target_id: article.id,
          'data.cardType': cardType,
      };
      if (openid) whereCond['_openid'] = openid;
      db.collection('summer_user_favorites').where(whereCond).count().then(res => {
          this.setData({
              isFavorited: res.total > 0
          });
      }).catch(err => {
          console.error('检查收藏状态失败', err);
      });
  },

  /**
   * 初始化Canvas
   */
  initCanvas() {
     this.setData({ isCanvasLoading: true });
     const query = wx.createSelectorQuery();
     query.select('#coloringCanvas')
       .fields({ node: true, size: true })
       .exec((res) => {
         if (!res[0]) {
           console.error('Canvas node not found');
           this.setData({ isCanvasLoading: false });
           return;
         }
         
         const canvas = res[0].node;
         const ctx = canvas.getContext('2d');
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 1;
         
         // 获取容器宽度
         const width = res[0].width;
         // 初始高度先设置一个值，后面会根据图片比例调整
         
         this.canvas = canvas;
         this.ctx = ctx;
         this.dpr = dpr;

         const img = canvas.createImage();
         img.onload = () => {
            console.log('Canvas image loaded successfully');
            // 计算图片宽高比
            const aspectRatio = img.height / img.width;
            const height = width * aspectRatio;
            
            // 设置Canvas物理尺寸
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            
            // 更新Canvas显示高度
            this.setData({
              canvasHeight: height,
              isCanvasLoading: false
            });

            ctx.scale(dpr, dpr);
             ctx.drawImage(img, 0, 0, width, height);
             
             // 保存原始图像数据用于重置
             try {
               this.originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
             } catch (e) {
               console.error('Failed to getImageData, coloring might not work', e);
             }
          };
         img.onerror = (err) => {
           console.error('Canvas image load failed', err);
           this.setData({ isCanvasLoading: false });
           wx.showToast({
             title: '图片加载失败',
             icon: 'none'
           });
         };
         console.log('Loading image for canvas:', this.data.article.a4Image);
         img.src = this.data.article.a4Image;
       });
   },

  /**
   * 选择颜色
   */
  selectColor(e) {
    const color = e.currentTarget.dataset.color;
    this.setData({
      selectedColor: color
    });
  },

  /**
    * Canvas点击事件
    */
   onCanvasTap(e) {
     if (!this.data.canPaint) return;
     if (!this.canvas || !this.ctx) return;
     
     // 增加防抖，避免频繁点击导致性能问题
     const now = Date.now();
     if (this.lastTapTime && now - this.lastTapTime < 300) return;
     this.lastTapTime = now;

     console.log('Canvas tapped', e.detail);
     const x = e.detail.x;
     const y = e.detail.y;
     
     // 获取canvas在页面中的位置
     const query = wx.createSelectorQuery();
     query.select('#coloringCanvas').boundingClientRect(rect => {
       const touchX = (x - rect.left) * this.dpr;
       const touchY = (y - rect.top) * this.dpr;
       
       console.log('Touch pos (px):', x, y);
       console.log('Canvas pos (px):', touchX, touchY);
       
       this.floodFill(Math.round(touchX), Math.round(touchY), this.data.selectedColor);
     }).exec();
   },

   /**
    * 泛洪填充算法
    */
   floodFill(startX, startY, fillColorHex) {
     const ctx = this.ctx;
     const canvas = this.canvas;
     const width = canvas.width;
     const height = canvas.height;
     
     console.log('Start floodFill at:', startX, startY, 'Color:', fillColorHex);

     // 获取当前画布数据
     let imageData;
     try {
        imageData = ctx.getImageData(0, 0, width, height);
     } catch (e) {
        console.error('Failed to get image data for flood fill', e);
        wx.showToast({
          title: '无法获取画布数据',
          icon: 'none'
        });
        return;
     }
     
     const data = imageData.data;
     
     // 获取点击位置的颜色
     const startPos = (startY * width + startX) * 4;
     const startR = data[startPos];
     const startG = data[startPos + 1];
     const startB = data[startPos + 2];
     const startA = data[startPos + 3];
     
     console.log('Start color:', startR, startG, startB, startA);

     // 目标颜色
     const rgb = this.hexToRgb(fillColorHex);
     const fillR = rgb.r;
     const fillG = rgb.g;
     const fillB = rgb.b;
     const fillA = 255;

     // 如果点击颜色和填充颜色相同，或者点击的是黑色线条（假设阈值），则不填充
     if (startR === fillR && startG === fillG && startB === fillB) {
        console.log('Color is same, skip filling');
        return;
     }
     
     // 简单的颜色距离判断，如果是黑色或深色线条，则不填充
     // 调高一点阈值，避免某些灰色线条被填充
     if (startR < 100 && startG < 100 && startB < 100) {
        console.log('Clicked on dark line, skip filling');
        return;
     }

     const tolerance = 50; // 颜色容差
     
     const matchStartColor = (pos) => {
       const r = data[pos];
       const g = data[pos + 1];
       const b = data[pos + 2];
       return Math.abs(r - startR) < tolerance && 
              Math.abs(g - startG) < tolerance && 
              Math.abs(b - startB) < tolerance;
     };

     const colorPixel = (pos) => {
       data[pos] = fillR;
       data[pos + 1] = fillG;
       data[pos + 2] = fillB;
       data[pos + 3] = fillA;
     };

     const queue = [[startX, startY]];
     const visited = new Set(); 
     // 使用 Int32Array 优化 visited 检查 (width * height)
     // 但为了简化代码且 Canvas 通常不大，Set 也可以，或者直接用 data 标记（不可行因为要对比颜色）
     // 这里用 Set 存储 `${cx},${cy}` 字符串效率较低，改为一维索引
     const visitedArr = new Uint8Array(width * height);
     
     let count = 0;
     const maxPixels = width * height; // 防止死循环

     while (queue.length > 0) {
       const [cx, cy] = queue.shift();
       const pixelIndex = cy * width + cx;
       
       if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
       if (visitedArr[pixelIndex]) continue;
       
       const pos = pixelIndex * 4;

       if (matchStartColor(pos)) {
         colorPixel(pos);
         visitedArr[pixelIndex] = 1;
         count++;
         
         if (count > maxPixels) break; 

         queue.push([cx + 1, cy]);
         queue.push([cx - 1, cy]);
         queue.push([cx, cy + 1]);
         queue.push([cx, cy - 1]);
       }
     }
     
     console.log('Filled pixels:', count);
     ctx.putImageData(imageData, 0, 0);
   },

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },
  async compressImageForCheck(imagePath) {
    const ensureSizeBelow = async (path, attempts = []) => {
      try {
        const info = await new Promise((resolve) => {
          wx.getFileInfo({
            filePath: path,
            success: resolve,
            fail: () => resolve({ size: 0 })
          });
        });
        const size = info && typeof info.size === 'number' ? info.size : 0;
        if (size > 970 * 1024 && attempts.length) {
          const next = attempts.shift();
          const resized = await this.resizeImageWithCanvas(path, next.w, next.h, next.q);
          return ensureSizeBelow(resized, attempts);
        }
        return path;
      } catch (_) {
        return path;
      }
    };
    return new Promise((resolve) => {
      wx.compressImage({
        src: imagePath,
        quality: 50,
        success: async (res) => {
          try {
            const imgInfo = await new Promise((resolveImg) => {
              wx.getImageInfo({
                src: res.tempFilePath,
                success: resolveImg,
                fail: () => resolveImg(null)
              });
            });
            const maxWidth = 750;
            const maxHeight = 1334;
            let path = res.tempFilePath;
            if (imgInfo && (imgInfo.width > maxWidth || imgInfo.height > maxHeight)) {
              path = await this.resizeImageWithCanvas(res.tempFilePath, maxWidth, maxHeight, 0.6);
            }
            const finalPath = await ensureSizeBelow(path, [
              { w: 600, h: 1067, q: 0.6 },
              { w: 480, h: 854, q: 0.5 }
            ]);
            resolve(finalPath);
          } catch (_) {
            resolve(res.tempFilePath);
          }
        },
        fail: async () => {
          try {
            const resized = await this.resizeImageWithCanvas(imagePath, 750, 1334, 0.6);
            const finalPath = await ensureSizeBelow(resized, [
              { w: 600, h: 1067, q: 0.6 },
              { w: 480, h: 854, q: 0.5 }
            ]);
            resolve(finalPath);
          } catch (_) {
            resolve(imagePath);
          }
        }
      });
    });
  },
  async resizeImageWithCanvas(imagePath, maxWidth, maxHeight, quality = 0.6) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: imagePath,
        success: (imgInfo) => {
          const width = imgInfo.width;
          const height = imgInfo.height;
          let targetWidth = width;
          let targetHeight = height;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            targetWidth = Math.floor(width * ratio);
            targetHeight = Math.floor(height * ratio);
          }
          const query = wx.createSelectorQuery();
          query.select('#compressCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
              const node = res && res[0] && res[0].node;
              if (!node) {
                reject(new Error('canvas not found'));
                return;
              }
              const ctx = node.getContext('2d');
              let dpr = 2;
              try {
                const wi = (typeof wx.getWindowInfo === 'function') ? wx.getWindowInfo() : null;
                dpr = wi && wi.pixelRatio ? wi.pixelRatio : 2;
              } catch (_) {}
              node.width = targetWidth * dpr;
              node.height = targetHeight * dpr;
              const img = node.createImage();
              img.onload = () => {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
                ctx.clearRect(0, 0, targetWidth, targetHeight);
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                wx.canvasToTempFilePath({
                  canvas: node,
                  width: targetWidth,
                  height: targetHeight,
                  destWidth: targetWidth,
                  destHeight: targetHeight,
                  quality: quality,
                  fileType: 'jpg',
                  success: (resp) => {
                    resolve(resp.tempFilePath);
                  },
                  fail: reject
                });
              };
              img.onerror = reject;
              img.src = imagePath;
            });
        },
        fail: reject
      });
    });
  },
  async finalizeUserImage(localPath, articleId) {
    try {
      this.setData({ userImage: localPath });
      if (articleId) {
        wx.setStorageSync(`parent_task_photo_url_${articleId}`, localPath);
        wx.setStorageSync(`parent_task_photo_${articleId}`, localPath);
      }
    } catch (_) {
      this.setData({ userImage: localPath });
      if (articleId) {
        wx.setStorageSync(`parent_task_photo_${articleId}`, localPath);
      }
    }
  },
  async checkAndAcceptUserImage(tempFilePath, articleId) {
    try {
      wx.showLoading({ title: '内容检测中...' });
      const compressedPath = await this.compressImageForCheck(tempFilePath);
      let contentType = 'image/jpeg';
      try {
        const info = await new Promise((resolve, reject) => {
          wx.getImageInfo({ src: compressedPath, success: resolve, fail: reject });
        });
        const t = String(info.type || '').toLowerCase();
        contentType = t === 'png' ? 'image/png' : 'image/jpeg';
      } catch (_) {}
      let tempUploadResult = null;
      try {
        tempUploadResult = await wx.cloud.uploadFile({
          cloudPath: `temp_check/${Date.now()}_summer_user.${contentType === 'image/png' ? 'png' : 'jpg'}`,
          filePath: compressedPath
        });
      } catch (_) {}
      if (!tempUploadResult || !tempUploadResult.fileID) {
        try {
          const fs = wx.getFileSystemManager();
          const base64 = fs.readFileSync(compressedPath, 'base64');
          let baseCheck = null;
          try {
            baseCheck = await wx.cloud.callFunction({
              name: 'secureImageCheck',
              data: {
                action: 'checkImage',
                imageBuffer: base64,
                contentType: contentType
              }
            });
          } catch (_) {}
          const ok = baseCheck && baseCheck.result && baseCheck.result.success;
          if (!ok) {
            const isRisky = !!(baseCheck && baseCheck.result && baseCheck.result.data && baseCheck.result.data.status === 'risky');
            if (isRisky) {
              wx.hideLoading();
              this.setData({ userImage: '' });
              wx.showToast({ title: '图片内容不合规', icon: 'none', duration: 2500 });
              return;
            }
            try {
              const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
              await c1.init();
              const alt = await c1.callFunction({
                name: 'imageCheck',
                data: { action: 'checkImage', imageBuffer: base64, contentType: contentType }
              });
              if (alt && alt.result && alt.result.data && alt.result.data.status === 'risky') {
                wx.hideLoading();
                this.setData({ userImage: '' });
                wx.showToast({ title: '图片内容不合规', icon: 'none', duration: 2500 });
                return;
              }
              if (alt && alt.result && alt.result.success) {
                wx.hideLoading();
                await this.finalizeUserImage(tempFilePath, articleId);
                wx.showToast({ title: '图片安全，已选择', icon: 'success' });
                return;
              }
            } catch (_) {}
            wx.hideLoading();
            const msg = (baseCheck && baseCheck.result && baseCheck.result.message) ? baseCheck.result.message : '内容检测失败';
            await this.handleUserContentCheckUnavailable(tempFilePath, articleId, msg);
            return;
          }
          wx.hideLoading();
          await this.finalizeUserImage(tempFilePath, articleId);
          wx.showToast({ title: '图片安全，已选择', icon: 'success' });
          return;
        } catch (e) {
          wx.hideLoading();
          await this.handleUserContentCheckUnavailable(tempFilePath, articleId, (e && e.message) ? e.message : '检测异常');
          return;
        }
      }
      let checkResult;
      let payload;
      try {
        let useUrl = false;
        let tempUrl = '';
        try {
          const urlRes = await wx.cloud.getTempFileURL({ fileList: [tempUploadResult.fileID] });
          if (urlRes && urlRes.fileList && urlRes.fileList.length > 0 && urlRes.fileList[0].status === 0) {
            tempUrl = urlRes.fileList[0].tempFileURL || '';
            useUrl = !!tempUrl;
          }
        } catch (_) {}
        payload = useUrl
          ? { action: 'checkImage', imageUrl: tempUrl, contentType: 'image/jpeg' }
          : { action: 'checkImage', fileID: tempUploadResult.fileID, contentType: contentType };
        checkResult = await wx.cloud.callFunction({ name: 'secureImageCheck', data: payload });
      } catch (err) {
        wx.hideLoading();
        await this.handleUserContentCheckUnavailable(tempFilePath, articleId, (err && err.message) ? err.message : '云函数调用失败');
        return;
      }
      try {
        await wx.cloud.deleteFile({ fileList: [tempUploadResult.fileID] });
      } catch (_) {}
      if (!checkResult.result || !checkResult.result.success) {
        if (checkResult.result && checkResult.result.data && checkResult.result.data.status === 'risky') {
          wx.hideLoading();
          this.setData({ userImage: '' });
          wx.showToast({ title: '图片内容不合规', icon: 'none', duration: 2500 });
          return;
        }
        wx.hideLoading();
        const rc = (checkResult.result && (checkResult.result.errCode || checkResult.result.error || checkResult.result.errMsg)) ? JSON.stringify({ errCode: checkResult.result.errCode, errMsg: checkResult.result.errMsg || checkResult.result.error }) : '';
        const reason = (checkResult.result && checkResult.result.message) ? checkResult.result.message : (rc || '内容检测失败');
        try {
          const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
          await c1.init();
          const alt = await c1.callFunction({ name: 'imageCheck', data: payload });
          if (alt && alt.result && alt.result.data && alt.result.data.status === 'risky') {
            wx.hideLoading();
            this.setData({ userImage: '' });
            wx.showToast({ title: '图片内容不合规', icon: 'none', duration: 2500 });
            return;
          }
          if (alt && alt.result && alt.result.success) {
            wx.hideLoading();
            await this.finalizeUserImage(tempFilePath, articleId);
            wx.showToast({ title: '图片安全，已选择', icon: 'success' });
            return;
          }
        } catch (_) {}
        await this.handleUserContentCheckUnavailable(tempFilePath, articleId, reason);
        return;
      }
      wx.hideLoading();
      await this.finalizeUserImage(tempFilePath, articleId);
      wx.showToast({ title: '图片安全，已选择', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      await this.handleUserContentCheckUnavailable(tempFilePath, articleId, (error && error.message) ? error.message : '检测异常');
    }
  },
  async handleUserContentCheckUnavailable(tempFilePath, articleId, reason) {
    return new Promise((resolve) => {
      let msg = reason || '服务暂不可用';
      if (typeof msg === 'string') {
        const r = msg.toLowerCase();
        if (r.includes('-604101') || r.includes('no permission') || r.includes('permission')) {
          msg = '云函数权限未配置或未重新部署';
        } else if (r.includes('function not found')) {
          msg = '云函数未上传或未部署';
        } else if (r.includes('invalid_env')) {
          msg = '云环境配置错误';
        } else if (r.includes('cannot read property') && r.includes('result')) {
          msg = '云函数返回为空，请检查部署或入参';
        }
      }
      wx.showModal({
        title: '内容检测不可用',
        content: msg ? ('服务暂不可用：' + msg + '。可稍后重试或跳过检测使用本地照片。') : '服务暂不可用，可稍后重试或跳过检测使用本地照片。',
        confirmText: '跳过检测',
        cancelText: '稍后重试',
        success: (res) => {
          if (res.confirm) {
            this.finalizeUserImage(tempFilePath, articleId);
            wx.showToast({ title: '已选择照片', icon: 'success' });
            resolve();
          } else {
            resolve();
          }
        }
      });
    });
  },
  async finalizeSolitudeImage(localPath, articleId) {
    try {
      this.setData({ solitudeImage: localPath });
      if (articleId) wx.setStorageSync(`summer_solitude_image_${articleId}`, localPath);
    } catch (_) {
      this.setData({ solitudeImage: localPath });
    }
  },
  async checkAndAcceptSolitudeImage(tempFilePath, articleId) {
    try {
      wx.showLoading({ title: '内容检测中...' });
      const compressedPath = await this.compressImageForCheck(tempFilePath);
      let contentType = 'image/jpeg';
      try {
        const info = await new Promise((resolve, reject) => {
          wx.getImageInfo({ src: compressedPath, success: resolve, fail: reject });
        });
        const t = String(info.type || '').toLowerCase();
        contentType = t === 'png' ? 'image/png' : 'image/jpeg';
      } catch (_) {}
      let tempUploadResult = null;
      try {
        tempUploadResult = await wx.cloud.uploadFile({
          cloudPath: `temp_check/${Date.now()}_summer_solitude.${contentType === 'image/png' ? 'png' : 'jpg'}`,
          filePath: compressedPath
        });
      } catch (_) {}
      if (!tempUploadResult || !tempUploadResult.fileID) {
        try {
          const fs = wx.getFileSystemManager();
          const base64 = fs.readFileSync(compressedPath, 'base64');
          let baseCheck = null;
          try {
            baseCheck = await wx.cloud.callFunction({
              name: 'secureImageCheck',
              data: {
                action: 'checkImage',
                imageBuffer: base64,
                contentType: contentType
              }
            });
          } catch (_) {}
          const ok = baseCheck && baseCheck.result && baseCheck.result.success;
          if (!ok) {
            const isRisky = !!(baseCheck && baseCheck.result && baseCheck.result.data && baseCheck.result.data.status === 'risky');
            if (isRisky) {
              wx.hideLoading();
              this.setData({ solitudeImage: '' });
              wx.showToast({ title: '图片内容不合规', icon: 'none', duration: 2500 });
              return;
            }
            try {
              const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
              await c1.init();
              const alt = await c1.callFunction({
                name: 'imageCheck',
                data: { action: 'checkImage', imageBuffer: base64, contentType: contentType }
              });
              if (alt && alt.result && alt.result.data && alt.result.data.status === 'risky') {
                wx.hideLoading();
                this.setData({ solitudeImage: '' });
                wx.showToast({ title: '图片内容不合规', icon: 'none', duration: 2500 });
                return;
              }
              if (alt && alt.result && alt.result.success) {
                wx.hideLoading();
                await this.finalizeSolitudeImage(tempFilePath, articleId);
                wx.showToast({ title: '图片安全，已选择', icon: 'success' });
                return;
              }
            } catch (_) {}
            wx.hideLoading();
            const msg = (baseCheck && baseCheck.result && baseCheck.result.message) ? baseCheck.result.message : '内容检测失败';
            await this.handleSolitudeContentCheckUnavailable(tempFilePath, articleId, msg);
            return;
          }
          wx.hideLoading();
          await this.finalizeSolitudeImage(tempFilePath, articleId);
          wx.showToast({ title: '图片安全，已选择', icon: 'success' });
          return;
        } catch (e) {
          wx.hideLoading();
          await this.handleSolitudeContentCheckUnavailable(tempFilePath, articleId, (e && e.message) ? e.message : '检测异常');
          return;
        }
      }
      let checkResult;
      let payload;
      try {
        let useUrl = false;
        let tempUrl = '';
        try {
          const urlRes = await wx.cloud.getTempFileURL({ fileList: [tempUploadResult.fileID] });
          if (urlRes && urlRes.fileList && urlRes.fileList.length > 0 && urlRes.fileList[0].status === 0) {
            tempUrl = urlRes.fileList[0].tempFileURL || '';
            useUrl = !!tempUrl;
          }
        } catch (_) {}
        payload = useUrl
          ? { action: 'checkImage', imageUrl: tempUrl, contentType: 'image/jpeg' }
          : { action: 'checkImage', fileID: tempUploadResult.fileID, contentType: contentType };
        checkResult = await wx.cloud.callFunction({ name: 'secureImageCheck', data: payload });
      } catch (err) {
        wx.hideLoading();
        await this.handleSolitudeContentCheckUnavailable(tempFilePath, articleId, (err && err.message) ? err.message : '云函数调用失败');
        return;
      }
      try {
        await wx.cloud.deleteFile({ fileList: [tempUploadResult.fileID] });
      } catch (_) {}
      if (!checkResult.result || !checkResult.result.success) {
        if (checkResult.result && checkResult.result.data && checkResult.result.data.status === 'risky') {
          wx.hideLoading();
          this.setData({ solitudeImage: '' });
          wx.showToast({ title: '图片内容不合规', icon: 'none', duration: 2500 });
          return;
        }
        wx.hideLoading();
        const rc = (checkResult.result && (checkResult.result.errCode || checkResult.result.error || checkResult.result.errMsg)) ? JSON.stringify({ errCode: checkResult.result.errCode, errMsg: checkResult.result.errMsg || checkResult.result.error }) : '';
        const reason = (checkResult.result && checkResult.result.message) ? checkResult.result.message : (rc || '内容检测失败');
        try {
          const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
          await c1.init();
          const alt = await c1.callFunction({ name: 'imageCheck', data: payload });
          if (alt && alt.result && alt.result.data && alt.result.data.status === 'risky') {
            wx.hideLoading();
            this.setData({ solitudeImage: '' });
            wx.showToast({ title: '图片内容不合规', icon: 'none', duration: 2500 });
            return;
          }
          if (alt && alt.result && alt.result.success) {
            wx.hideLoading();
            await this.finalizeSolitudeImage(tempFilePath, articleId);
            wx.showToast({ title: '图片安全，已选择', icon: 'success' });
            return;
          }
        } catch (_) {}
        await this.handleSolitudeContentCheckUnavailable(tempFilePath, articleId, reason);
        return;
      }
      wx.hideLoading();
      await this.finalizeSolitudeImage(tempFilePath, articleId);
      wx.showToast({ title: '图片安全，已选择', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      await this.handleSolitudeContentCheckUnavailable(tempFilePath, articleId, (error && error.message) ? error.message : '检测异常');
    }
  },
  async handleSolitudeContentCheckUnavailable(tempFilePath, articleId, reason) {
    return new Promise((resolve) => {
      let msg = reason || '服务暂不可用';
      if (typeof msg === 'string') {
        const r = msg.toLowerCase();
        if (r.includes('-604101') || r.includes('no permission') || r.includes('permission')) {
          msg = '云函数权限未配置或未重新部署';
        } else if (r.includes('function not found')) {
          msg = '云函数未上传或未部署';
        } else if (r.includes('invalid_env')) {
          msg = '云环境配置错误';
        } else if (r.includes('cannot read property') && r.includes('result')) {
          msg = '云函数返回为空，请检查部署或入参';
        }
      }
      wx.showModal({
        title: '内容检测不可用',
        content: msg ? ('服务暂不可用：' + msg + '。可稍后重试或跳过检测使用本地照片。') : '服务暂不可用，可稍后重试或跳过检测使用本地照片。',
        confirmText: '跳过检测',
        cancelText: '稍后重试',
        success: (res) => {
          if (res.confirm) {
            this.finalizeSolitudeImage(tempFilePath, articleId);
            wx.showToast({ title: '已选择照片', icon: 'success' });
            resolve();
          } else {
            resolve();
          }
        }
      });
    });
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {},

  

  /**
   * 切换风格
   */
  switchStyle: function (e) {
    getApp().playClickSound && getApp().playClickSound();
    const styleIndex = parseInt(e.currentTarget.dataset.index);
    if (this.data.singleStationMode && styleIndex !== this.data.currentStyleIndex) {
      wx.showToast({
        title: '从盛夏蹄印进入，本页仅开放这一小站',
        icon: 'none'
      });
      return;
    }
    const requiresVip = this.data.article && this.data.article.isCarousel === false;
    const isVip = this.isVipValid();
    if (requiresVip && !isVip && styleIndex !== 0) {
      this.showVipModal();
      this.setData({
        currentStyleIndex: 0,
        currentStyleImage: this.getStyleImage(0)
      });
      return;
    }
    this.setData({
      currentStyleIndex: styleIndex,
      currentStyleImage: this.getStyleImage(styleIndex)
    });
  },

  getStyleImage(index) {
    const imgs = [
      '/assets/images/主体式.png',
      '/assets/images/问答式.png',
      '/assets/images/启发式.png',
      '/assets/images/时尚式.png'
    ];
    const i = Number(index);
    return imgs[i] || imgs[0];
  },
  showVipModal() {
    wx.showModal({
      title: '会员专属',
      content: '开通会员即可解锁全部内容与功能',
      confirmText: '去开通',
      cancelText: '再看看',
      success: (res) => {
        if (res.confirm) {
          this.goVip();
        }
      }
    });
  },

  /**
   * 切换字体大小
   */
  toggleFontSize: function () {
    getApp().playClickSound && getApp().playClickSound();
    const fontSizes = ['小', '中', '大'];
    const newFontSizeIndex = (this.data.fontSizeIndex + 1) % 3;
    this.setData({
      fontSizeIndex: newFontSizeIndex
    });

    wx.showToast({
      title: `字体大小：${fontSizes[newFontSizeIndex]}`,
      icon: 'none',
      duration: 1500
    });
  },

  /**
   * 切换收藏状态
   */
  toggleFavorite: function () {
    getApp().playClickSound && getApp().playClickSound();
    const article = this.data.article;
    const newFavoritedState = !this.data.isFavorited;
 
    this.setData({
      isFavorited: newFavoritedState
    });

    const cloud = getApp().cloud || wx.cloud;
    const db = cloud.database();
    
    if (newFavoritedState) {
        // 添加收藏
        db.collection('summer_user_favorites').add({
            data: {
                type: 'article',
                target_id: article.id,
                created_at: db.serverDate(),
                data: {
                    title: article.title,
                    titleCn: article.title, // 兼容字段
                    subtitle: article.subtitle || '',
                    category: article.category,
                    date: article.date,
                    cover: article.cover || '',
                    cardType: this.data.isSmallCard ? 'small' : 'main'
                }
            }
        }).then(res => {
            wx.showToast({
                title: '已收藏',
                icon: 'success'
            });
        }).catch(err => {
            console.error('收藏失败', err);
            // 回滚
            this.setData({ isFavorited: !newFavoritedState });
            wx.showToast({
                title: '收藏失败',
                icon: 'none'
            });
        });
    } else {
        // 取消收藏
        const openid = wx.getStorageSync('openid');
        const whereCond = {
            type: 'article',
            target_id: article.id,
            'data.cardType': this.data.isSmallCard ? 'small' : 'main',
        };
        if (openid) whereCond['_openid'] = openid;
        db.collection('summer_user_favorites').where(whereCond).remove().then(res => {
            wx.showToast({
                title: '已取消',
                icon: 'none'
            });
        }).catch(err => {
            console.error('取消收藏失败', err);
            // 回滚
            this.setData({ isFavorited: !newFavoritedState });
            wx.showToast({
                title: '操作失败',
                icon: 'none'
            });
        });
    }
  },

  goToPrint: function () {
    getApp().playClickSound && getApp().playClickSound();
    const article = this.data.article;
    if (!article || !article.id) {
      wx.showToast({ title: '暂无文章', icon: 'none' });
      return;
    }
    const aid = article.id;
    const energyLevel = Number(this.data.energyLevel || wx.getStorageSync(`summer_energy_level_${aid}`) || 0);
    if (!energyLevel || energyLevel <= 0) {
      wx.showToast({ title: '请先选择能量星级', icon: 'none' });
      return;
    }
    const moodArr = this.data.selectedMoodTags && this.data.selectedMoodTags.length > 0 ? this.data.selectedMoodTags : (wx.getStorageSync(`summer_selected_mood_tags_${aid}`) || []);
    const moodSingle = wx.getStorageSync(`summer_selected_mood_tag_${aid}`);
    const hasMood = (Array.isArray(moodArr) && moodArr.length > 0) || !!moodSingle;
    if (!hasMood) {
      wx.showToast({ title: '请先选择心情标签', icon: 'none' });
      return;
    }
    const userImage = this.data.userImage || wx.getStorageSync(`parent_task_photo_url_${aid}`) || wx.getStorageSync(`parent_task_photo_${aid}`);
    if (!userImage) {
      wx.showToast({ title: '请先上传照片', icon: 'none' });
      return;
    }
    const userNote = (this.data.userNote || '').trim() || String(wx.getStorageSync(`summer_user_note_${aid}`) || '').trim() || String(wx.getStorageSync('userNote') || '').trim();
    if (!userNote) {
      wx.showToast({ title: '请先填写一句碎碎念', icon: 'none' });
      return;
    }
    const selThemeIdx = Number(wx.getStorageSync(`summer_courage_theme_${aid}`));
    if (!(selThemeIdx >= 0)) {
      wx.showToast({ title: '请先选择勇气主题', icon: 'none' });
      return;
    }
    const courageNote = (this.data.courageNote || '').trim() || String(wx.getStorageSync(`summer_courage_note_${aid}`) || '').trim();
    if (!courageNote) {
      wx.showToast({ title: '请先填写勇气小事', icon: 'none' });
      return;
    }
    const solitudeImage = this.data.solitudeImage || wx.getStorageSync(`summer_solitude_image_${aid}`);
    if (!solitudeImage) {
      wx.showToast({ title: '请先上传生活感受照片', icon: 'none' });
      return;
    }
    const solitudeThing = (this.data.solitudeThing || '').trim() || String(wx.getStorageSync(`summer_solitude_thing_${aid}`) || '').trim();
    if (!solitudeThing) {
      wx.showToast({ title: '请先填写独处小事', icon: 'none' });
      return;
    }
    const solitudeNote = (this.data.solitudeNote || '').trim() || String(wx.getStorageSync(`summer_solitude_note_${aid}`) || '').trim();
    if (!solitudeNote) {
      wx.showToast({ title: '请先填写生活感受', icon: 'none' });
      return;
    }
    const tcList = wx.getStorageSync(`summer_time_capsules_${aid}`) || [];
    const hasTimeCapsule = Array.isArray(tcList) && tcList.length > 0 && tcList[0] && String(tcList[0].content || '').trim();
    if (!hasTimeCapsule) {
      wx.showToast({ title: '请先封存一条时光胶囊', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/print/print?articleId=${encodeURIComponent(article.id)}&useFixed=1`
    });
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
    const avatar = wx.getStorageSync('currentAvatar') || '';
    if (avatar && avatar !== this.data.currentAvatar) this.setData({ currentAvatar: avatar });
    this.updateLockState();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    if (this.data.audioContext) {
      try {
        this.data.audioContext.stop();
      } catch (_) {}
    }
    this.setData({ isPlaying: false });
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
   * 点击小卡片默认形象PNG
   */
  onDefaultImageTap: function () {
    const that = this;
    this.setData({
      showTipLabel: true
    });

    // 3秒后自动隐藏便签
    setTimeout(function() {
      that.setData({
        showTipLabel: false
      });
    }, 3000);
  },
  openWorryModal: function () {
    getApp().playClickSound && getApp().playClickSound();
    this.setData({
      showWorryModal: true,
      worryText: '',
      showAvatarTip: false
    });
  },
  closeWorryModal: function () {
    getApp().playClickSound && getApp().playClickSound();
    this.setData({
      showWorryModal: false
    });
  },
  stopProp: function () {},
  onWorryInput: function (e) {
    this.setData({
      worryText: e.detail.value
    });
  },
  submitWorry: function () {
    getApp().playClickSound && getApp().playClickSound();
    const text = String(this.data.worryText || '');
    if (!text.trim()) {
      wx.showToast({
        title: '请写下你的烦恼...',
        icon: 'none'
      });
      return;
    }
    wx.setStorageSync('latestWorryText', text);
    this.closeWorryModal();
    this.startWorryAnimation(text);
  },
  startWorryAnimation: function (text) {
    const chars = Array.from(text);
    const totalChars = chars.length || 1;
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

    const quotes = this.data.encouragingQuotes || [];
    const randomQuote = quotes.length ? quotes[Math.floor(Math.random() * quotes.length)] : '你好呀～';

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
    }, sheepAnimDuration * 1000);

    setTimeout(() => {
      if (this.data.isAnimating) {
        this.closeAnimation();
      }
    }, 18000);
  },
  closeAnimation: function () {
    getApp().playClickSound && getApp().playClickSound();
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
  onCharacterTap: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    if (this.avatarTipTimer) {
      clearTimeout(this.avatarTipTimer);
      this.avatarTipTimer = null;
    }
    this.setData({
      showAvatarTip: true,
      avatarTipText: '坚持打卡，可解锁更多形象'
    });
    this.avatarTipTimer = setTimeout(() => {
      this.setData({ showAvatarTip: false });
      this.avatarTipTimer = null;
    }, 2500);
  },
  initRecord: function () {
    const that = this;
    try {
      const plugin = requirePlugin && requirePlugin('WechatSI');
      if (!plugin || !plugin.getRecordRecognitionManager) {
        wx.showToast({ title: '语音插件未加载', icon: 'none' });
        return;
      }
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
        if (res && res.result) {
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
      manager.onError = function () {
        wx.hideToast();
        that.setData({ isRecording: false });
        wx.showToast({ title: '语音识别失败', icon: 'none' });
      };
      this.recordManager = manager;
    } catch (e) {
      wx.showToast({ title: '语音插件未加载', icon: 'none' });
    }
  },
  startRecord: function () {
    if (this.data.isRecording) return;
    this.setData({ recordTarget: 'worry', isRecording: true });
    if (this.recordManager && this.recordManager.start) {
      try {
        this.recordManager.start({ duration: 30000, lang: 'zh_CN' });
      } catch (e) {
        this.setData({ isRecording: false });
      }
    } else {
      this.setData({ isRecording: false });
      wx.showToast({ title: '语音插件未加载', icon: 'none' });
    }
  },
  stopRecord: function () {
    if (!this.data.isRecording) return;
    if (this.recordManager && this.recordManager.stop) {
      try {
        this.recordManager.stop();
      } catch (e) {}
    }
    this.setData({ isRecording: false });
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})
