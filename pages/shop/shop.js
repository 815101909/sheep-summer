// pages/shop/shop.js 绵羊杂货铺：羊毛兑换 + 云数据库对接
//
// 云数据库集合 summer_shop 字段结构：
// - name: string           商品名字
// - description: string    商品介绍
// - price: number         商品价格（羊毛）
// - image: string         云存储路径
// - category: string      商品分类（可选）

Page({
  data: {
    woolCount: 0,
    products: [],
    categoryOptions: [],
    categoryFilter: '',
    filteredProducts: [],
    loading: false,
    loadError: '',
    woolImageUrl: '/assets/images/羊毛.webp'
  },
  onLoad() {
    this._syncWoolCount();
    this.loadProducts();
    this._applyCategoryFilter();
    
    // 加载云存储图片链接
    this.loadCloudImageUrls();
  },
  onShow() {
    this._syncWoolCount();
    this._applyCategoryFilter();
  },
  _applyCategoryFilter() {
    const { products, categoryFilter } = this.data;
    const filteredProducts = !categoryFilter
      ? products
      : products.filter((p) => (p.category || '') === categoryFilter);
    this.setData({ filteredProducts });
  },
  onCategoryFilter(e) {
    const cat = e.currentTarget.dataset.cat ?? '';
    const { products } = this.data;
    const filteredProducts = !cat ? products : products.filter((p) => (p.category || '') === cat);
    this.setData({ categoryFilter: cat, filteredProducts });
  },
  _syncWoolCount() {
    // 优先从 summeruser 集合获取羊毛数量
    this.loadWoolFromCloud();
  },
  
  // 从云端获取羊毛数量
  loadWoolFromCloud() {
    const cloud = getApp().cloud || wx.cloud;
    if (!cloud) {
      // 云服务未初始化时使用本地存储
      const woolCount = wx.getStorageSync('woolCount') || 0;
      this.setData({ woolCount });
      return;
    }
    
    const db = cloud.database();
    
    // 获取用户 openid
    let openid = wx.getStorageSync('openid');
    if (!openid) {
      // 如果没有 openid，先调用登录获取
      cloud.callFunction({ name: 'login', data: {} }).then(res => {
        if (res.result && res.result.openid) {
          openid = res.result.openid;
          wx.setStorageSync('openid', openid);
          this.fetchWoolByOpenid(db, openid);
        } else {
          // 登录失败回退到本地存储
          const woolCount = wx.getStorageSync('woolCount') || 0;
          this.setData({ woolCount });
        }
      }).catch(() => {
        // 网络错误回退到本地存储
        const woolCount = wx.getStorageSync('woolCount') || 0;
        this.setData({ woolCount });
      });
    } else {
      this.fetchWoolByOpenid(db, openid);
    }
  },
  
  // 根据 openid 获取羊毛数量
  fetchWoolByOpenid(db, openid) {
    db.collection('summeruser')
      .where({ _openid: openid })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          const user = res.data[0];
          const woolCount = user.wool || 0;
          // 同步到本地存储作为备份
          wx.setStorageSync('woolCount', woolCount);
          this.setData({ woolCount });
        } else {
          // 用户不存在，使用本地存储
          const woolCount = wx.getStorageSync('woolCount') || 0;
          this.setData({ woolCount });
        }
      })
      .catch(err => {
        console.error('获取羊毛数量失败:', err);
        // 网络错误回退到本地存储
        const woolCount = wx.getStorageSync('woolCount') || 0;
        this.setData({ woolCount });
      });
  },
  
  // 更新羊毛数量（增加）
  updateWoolCount(increment) {
    const cloud = getApp().cloud || wx.cloud;
    if (!cloud) {
      // 云服务未初始化时只更新本地存储
      const currentWool = wx.getStorageSync('woolCount') || 0;
      const newWool = currentWool + increment;
      wx.setStorageSync('woolCount', newWool);
      this.setData({ woolCount: newWool });
      return;
    }
    
    const db = cloud.database();
    let openid = wx.getStorageSync('openid');
    
    if (!openid) {
      // 如果没有 openid，先获取
      cloud.callFunction({ name: 'login', data: {} }).then(res => {
        if (res.result && res.result.openid) {
          openid = res.result.openid;
          wx.setStorageSync('openid', openid);
          this.updateWoolInCloud(db, openid, increment);
        } else {
          // 回退到本地存储
          const currentWool = wx.getStorageSync('woolCount') || 0;
          const newWool = currentWool + increment;
          wx.setStorageSync('woolCount', newWool);
          this.setData({ woolCount: newWool });
        }
      }).catch(() => {
        // 网络错误回退到本地存储
        const currentWool = wx.getStorageSync('woolCount') || 0;
        const newWool = currentWool + increment;
        wx.setStorageSync('woolCount', newWool);
        this.setData({ woolCount: newWool });
      });
    } else {
      this.updateWoolInCloud(db, openid, increment);
    }
  },
  
  // 在云端更新羊毛数量
  updateWoolInCloud(db, openid, increment) {
    // 先查询用户是否存在
    db.collection('summeruser')
      .where({ _openid: openid })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          const user = res.data[0];
          const currentWool = user.wool || 0;
          const newWool = currentWool + increment;
          
          // 更新云端数据
          db.collection('summeruser')
            .doc(user._id)
            .update({
              data: {
                wool: newWool,
                updateTime: db.serverDate()
              }
            })
            .then(() => {
              // 同步到本地存储
              wx.setStorageSync('woolCount', newWool);
              this.setData({ woolCount: newWool });
            })
            .catch(err => {
              console.error('更新云端羊毛失败:', err);
              // 云端更新失败时只更新本地
              wx.setStorageSync('woolCount', newWool);
              this.setData({ woolCount: newWool });
            });
        } else {
          // 用户不存在，创建新用户记录
          this.createOrUpdateUserWool(db, openid, increment);
        }
      })
      .catch(err => {
        console.error('查询用户羊毛失败:', err);
        // 查询失败回退到本地存储
        const currentWool = wx.getStorageSync('woolCount') || 0;
        const newWool = currentWool + increment;
        wx.setStorageSync('woolCount', newWool);
        this.setData({ woolCount: newWool });
      });
  },
  
  // 创建或更新用户羊毛记录
  createOrUpdateUserWool(db, openid, woolAmount) {
    // 先尝试创建用户记录
    db.collection('summeruser')
      .add({
        data: {
          _openid: openid,
          wool: woolAmount,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      .then(() => {
        wx.setStorageSync('woolCount', woolAmount);
        this.setData({ woolCount: woolAmount });
      })
      .catch(err => {
        console.error('创建用户羊毛记录失败:', err);
        // 创建失败时更新本地存储
        wx.setStorageSync('woolCount', woolAmount);
        this.setData({ woolCount: woolAmount });
      });
  },
  
  // 扣除羊毛数量
  deductWool(amount) {
    const cloud = getApp().cloud || wx.cloud;
    if (!cloud) {
      // 云服务未初始化时只更新本地存储
      const currentWool = wx.getStorageSync('woolCount') || 0;
      const newWool = currentWool - amount;
      wx.setStorageSync('woolCount', newWool);
      this.setData({ woolCount: newWool });
      return;
    }
    
    const db = cloud.database();
    let openid = wx.getStorageSync('openid');
    
    if (!openid) {
      // 如果没有 openid，先获取
      cloud.callFunction({ name: 'login', data: {} }).then(res => {
        if (res.result && res.result.openid) {
          openid = res.result.openid;
          wx.setStorageSync('openid', openid);
          this.deductWoolInCloud(db, openid, amount);
        } else {
          // 回退到本地存储
          const currentWool = wx.getStorageSync('woolCount') || 0;
          const newWool = currentWool - amount;
          wx.setStorageSync('woolCount', newWool);
          this.setData({ woolCount: newWool });
        }
      }).catch(() => {
        // 网络错误回退到本地存储
        const currentWool = wx.getStorageSync('woolCount') || 0;
        const newWool = currentWool - amount;
        wx.setStorageSync('woolCount', newWool);
        this.setData({ woolCount: newWool });
      });
    } else {
      this.deductWoolInCloud(db, openid, amount);
    }
  },
  
  // 在云端扣除羊毛
  deductWoolInCloud(db, openid, amount) {
    db.collection('summeruser')
      .where({ _openid: openid })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          const user = res.data[0];
          const currentWool = user.wool || 0;
          const newWool = currentWool - amount;
          
          // 更新云端数据
          db.collection('summeruser')
            .doc(user._id)
            .update({
              data: {
                wool: newWool,
                updateTime: db.serverDate()
              }
            })
            .then(() => {
              // 同步到本地存储
              wx.setStorageSync('woolCount', newWool);
              this.setData({ woolCount: newWool });
            })
            .catch(err => {
              console.error('扣除云端羊毛失败:', err);
              // 云端更新失败时只更新本地
              wx.setStorageSync('woolCount', newWool);
              this.setData({ woolCount: newWool });
            });
        } else {
          // 用户不存在，使用本地存储
          const currentWool = wx.getStorageSync('woolCount') || 0;
          const newWool = currentWool - amount;
          wx.setStorageSync('woolCount', newWool);
          this.setData({ woolCount: newWool });
        }
      })
      .catch(err => {
        console.error('查询用户羊毛失败:', err);
        // 查询失败回退到本地存储
        const currentWool = wx.getStorageSync('woolCount') || 0;
        const newWool = currentWool - amount;
        wx.setStorageSync('woolCount', newWool);
        this.setData({ woolCount: newWool });
      });
  },
  
  onTopUpWool() {
    wx.showModal({
      title: '兑换羊毛',
      content: '10 元兑换 100 羊毛，确认支付？',
      confirmText: '去支付',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;
        wx.cloud.callFunction({ name: 'summer_pay', data: { planId: 'wool_100' } }).then(res => {
          if (res.result && res.result.data) {
            wx.requestPayment({
              ...res.result.data,
              success: () => {
                this.updateWoolCount(100);
                wx.showToast({ title: '已获得 100 羊毛', icon: 'success' });
              }
            });
          } else {
            this.updateWoolCount(100);
            wx.showToast({ title: '已获得 100 羊毛', icon: 'success' });
          }
        }).catch(() => {
          this.updateWoolCount(100);
          wx.showToast({ title: '已获得 100 羊毛', icon: 'success' });
        });
      }
    });
  },
  loadProducts() {
    this.setData({ loading: true, loadError: '' });
    
    // 使用云数据库获取商品数据
    const cloud = getApp().cloud || wx.cloud;
    if (!cloud) {
      this.setData({ loading: false, loadError: '云服务未初始化' });
      return;
    }
    
    const db = cloud.database();
    
    // 从 summer_shop 集合查询所有商品
    db.collection('summer_shop')
      .get()
      .then(res => {
        const list = res.data || [];
        
        // 处理商品数据，转换字段格式
        const products = list.map((item, index) => ({
          id: item._id || `product_${index}`,
          name: item.name || '',
          category: item.category || '文创',
          description: item.description || '',
          priceWool: Number(item.price || 0),
          image: item.image || '', // 云存储路径
          imageUrl: '' // 临时链接，后续转换
        }));
        
        // 提取所有唯一的分类
        const categories = [...new Set(products.map(p => p.category))].filter(Boolean);
        
        this.setData({
          products,
          categoryOptions: categories,
          loading: false,
          loadError: ''
        });
        
        // 转换云存储图片路径为临时链接
        this.convertImageUrls();
        
        // 应用当前筛选条件
        this._applyCategoryFilter();
      })
      .catch(err => {
        console.error('加载商品失败:', err);
        this.setData({ 
          loading: false, 
          loadError: '加载商品失败，请稍后再试' 
        });
      });
  },
  
  // 转换云存储图片路径为临时链接
  convertImageUrls() {
    const { products } = this.data;
    if (!products || products.length === 0) return;
    
    const cloud = getApp().cloud || wx.cloud;
    if (!cloud) return;
    
    // 收集所有需要转换的云存储路径
    const cloudPaths = products
      .map(p => p.image)
      .filter(path => path && path.startsWith('cloud://'));
    
    if (cloudPaths.length === 0) {
      // 如果没有云存储图片，直接更新视图
      this.setData({
        filteredProducts: this.data.filteredProducts.map(item => ({
          ...item,
          imageUrl: item.image && !item.image.startsWith('cloud://') ? item.image : ''
        }))
      });
      return;
    }
    
    // 批量获取临时链接
    cloud.getTempFileURL({
      fileList: cloudPaths
    }).then(res => {
      const urlMap = {};
      (res.fileList || []).forEach(file => {
        if (file.status === 0 && file.tempFileURL) {
          urlMap[file.fileID] = file.tempFileURL;
        }
      });
      
      // 更新商品图片链接
      const updatedProducts = products.map(item => ({
        ...item,
        imageUrl: urlMap[item.image] || item.image || ''
      }));
      
      this.setData({
        products: updatedProducts,
        filteredProducts: updatedProducts.filter(p => 
          !this.data.categoryFilter || (p.category || '') === this.data.categoryFilter
        )
      });
    }).catch(err => {
      console.error('转换图片链接失败:', err);
      // 转换失败时，使用原始路径
      this.setData({
        filteredProducts: this.data.filteredProducts.map(item => ({
          ...item,
          imageUrl: item.image || ''
        }))
      });
    });
  },
  loadCloudImageUrls: async function() {
    const cloud = getApp().cloud || wx.cloud;
    const woolCloudPath = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/羊毛.webp';
    
    try {
      const result = await cloud.getTempFileURL({
        fileList: [woolCloudPath]
      });
      
      if (result.fileList && result.fileList[0] && result.fileList[0].status === 0) {
        this.setData({
          woolImageUrl: result.fileList[0].tempFileURL
        });
      }
    } catch (error) {
      console.error('获取羊毛图片链接失败:', error);
    }
  },
  
  onProductTap(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    const price = Number(item.priceWool || 0);
    const woolCount = this.data.woolCount || 0;
    if (!price) {
      wx.showToast({ title: '该商品暂不可兑换', icon: 'none' });
      return;
    }
    if (woolCount < price) {
      wx.showToast({ title: '羊毛不足，需要 ' + price + ' 羊毛', icon: 'none', duration: 2000 });
      return;
    }
    wx.showModal({
      title: '确认兑换',
      content: '用 ' + price + ' 羊毛兑换「' + (item.name || '') + '」？',
      success: (res) => {
        if (res.confirm) {
          this.deductWool(price);
          wx.showToast({ title: '兑换成功', icon: 'success' });
        }
      }
    });
  }
});