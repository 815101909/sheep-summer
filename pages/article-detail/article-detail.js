// pages/article-detail/article-detail.js
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
    
    // 填色功能相关
    colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB', '#E74C3C', '#2ECC71', '#F1C40F', '#FFFFFF'],
    selectedColor: '#FF6B6B',
    canvasHeight: 300, // 初始高度
    isCanvasLoading: false,

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
    const { articleId, isSmallCard } = options;

    this.setData({
      isSmallCard: isSmallCard === 'true'
    });
    this.setData({ currentStyleImage: this.getStyleImage(this.data.currentStyleIndex) });

    if (articleId) {
      this.loadArticleDetail(articleId);
    }
    const avatar = wx.getStorageSync('currentAvatar') || '';
    if (avatar) this.setData({ currentAvatar: avatar });
  },

  /**
   * 加载文章详情
   */
  loadArticleDetail: async function (articleId) {
    wx.showLoading({ title: '加载中...' });
    
    try {
      // 初始化跨环境云实例
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4', // 资源方 AppID
        resourceEnv: 'cloud1-1gsyt78b92c539ef', // 资源方环境 ID
      });
      await c1.init();
      
      const db = c1.database();
      
      const res = await db.collection('spring_hoofprint_articles').doc(articleId).get();
      const data = res.data;
      
      // 处理图片链接
      let coverImage = data.cover_image || '';
      let a4Image = data.a4_image || '';
      
      const fileListToConvert = [];
      if (coverImage.startsWith('cloud://')) fileListToConvert.push(coverImage);
      if (a4Image.startsWith('cloud://')) fileListToConvert.push(a4Image);

      // 如果是云文件ID，换取临时链接
      if (fileListToConvert.length > 0) {
        try {
          const tempRes = await c1.getTempFileURL({
            fileList: fileListToConvert,
            config: { maxAge: 3 * 60 * 60 }
          });
          if (tempRes.fileList) {
             tempRes.fileList.forEach(item => {
               if (item.status === 0) {
                 if (item.fileID === coverImage) coverImage = item.tempFileURL;
                 if (item.fileID === a4Image) a4Image = item.tempFileURL;
               }
             });
          }
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
        content: data.content || '',
        contentPinyin: data.content_pinyin || '', // 拼音内容

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
        a4Image: a4Image
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
      const extraResources = [
        article.qaImage,
        article.inspireImage,
        article.fashionImage,
        article.a4Image
      ].filter(res => res && res.startsWith('cloud://'));

      if (extraResources.length > 0) {
        try {
          const extraRes = await c1.getTempFileURL({
            fileList: extraResources,
            config: { maxAge: 3 * 60 * 60 }
          });
          
          const urlMap = {};
          extraRes.fileList.forEach(file => {
            if (file.status === 0) {
              urlMap[file.fileID] = file.tempFileURL;
            }
          });
          
          if (article.qaImage && urlMap[article.qaImage]) article.qaImage = urlMap[article.qaImage];
          if (article.inspireImage && urlMap[article.inspireImage]) article.inspireImage = urlMap[article.inspireImage];
          if (article.fashionImage && urlMap[article.fashionImage]) article.fashionImage = urlMap[article.fashionImage];
          if (article.a4Image && urlMap[article.a4Image]) article.a4Image = urlMap[article.a4Image];
          
        } catch (extraErr) {
          console.error('其他资源链接转换失败', extraErr);
        }
      }

      this.setData({
        article: article
      }, () => {
        if (this.data.isSmallCard && article.a4Image) {
          setTimeout(() => {
            this.initCanvas();
          }, 500);
        }
      });

      wx.setNavigationBarTitle({
        title: this.data.isSmallCard ? (article.subtitle || article.title) : article.title
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
         const dpr = wx.getSystemInfoSync().pixelRatio;
         
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

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {},

  

  /**
   * 切换风格
   */
  switchStyle: function (e) {
    const styleIndex = parseInt(e.currentTarget.dataset.index);

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

  /**
   * 切换字体大小
   */
  toggleFontSize: function () {
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
    const newFavoritedState = !this.data.isFavorited;
    const article = this.data.article;

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
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    if (this.data.audioContext) {
      this.data.audioContext.stop();
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

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})
