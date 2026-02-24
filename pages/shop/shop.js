// pages/shop/shop.js 绵羊杂货铺：羊毛兑换 + 预留后端接口
//
// 后端接口字段建议：
// - id: string | number
// - name: string           商品名字
// - category: string       商品类别
// - description: string    商品介绍
// - priceWool: number      商品价钱（羊毛）
// - imageUrl?: string      商品图（可选）
const SHOP_PRODUCTS_API_URL = ''; // TODO: 后端上传后填入接口地址

// 商品类别：背景、长凳形象为主，另有文创、兑换等
const DEFAULT_CATEGORIES = ['背景', '长凳形象', '文创', '兑换'];

Page({
  data: {
    woolCount: 0,
    products: [
      { id: '1', name: '夏日草地', category: '背景', description: '长凳场景背景，用在拍立得与主页', priceWool: 40, imageUrl: '' },
      { id: '2', name: '黄昏长椅', category: '背景', description: '暖色黄昏下的长凳背景', priceWool: 50, imageUrl: '' },
      { id: '3', name: '夏小咩坐姿', category: '长凳形象', description: '坐在长凳上的小羊形象', priceWool: 60, imageUrl: '' },
      { id: '4', name: '夏小咩躺姿', category: '长凳形象', description: '在长凳上放松的小羊形象', priceWool: 60, imageUrl: '' },
      { id: '5', name: '夏日明信片', category: '文创', description: '手绘绵羊与长凳，可写下鼓励传给下一位', priceWool: 30, imageUrl: '' },
      { id: '6', name: '歇脚日记本', category: '文创', description: '记录每次坐下的心情与收获', priceWool: 50, imageUrl: '' },
      { id: '7', name: '100羊毛', category: '兑换', description: '¥10 兑换 100 羊毛，用于杂货铺消费', priceWool: 100, imageUrl: '' }
    ],
    categoryOptions: DEFAULT_CATEGORIES,
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
    const woolCount = wx.getStorageSync('woolCount') || 0;
    this.setData({ woolCount });
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
                const wool = (wx.getStorageSync('woolCount') || 0) + 100;
                wx.setStorageSync('woolCount', wool);
                this.setData({ woolCount: wool });
                wx.showToast({ title: '已获得 100 羊毛', icon: 'success' });
              }
            });
          } else {
            const wool = (wx.getStorageSync('woolCount') || 0) + 100;
            wx.setStorageSync('woolCount', wool);
            this.setData({ woolCount: wool });
            wx.showToast({ title: '已获得 100 羊毛', icon: 'success' });
          }
        }).catch(() => {
          const wool = (wx.getStorageSync('woolCount') || 0) + 100;
          wx.setStorageSync('woolCount', wool);
          this.setData({ woolCount: wool });
          wx.showToast({ title: '已获得 100 羊毛', icon: 'success' });
        });
      }
    });
  },
  loadProducts() {
    if (!SHOP_PRODUCTS_API_URL) {
      const products = this.data.products || [];
      const filteredProducts = this.data.categoryFilter
        ? products.filter((p) => (p.category || '') === this.data.categoryFilter)
        : products;
      this.setData({
        loading: false,
        loadError: '',
        filteredProducts: filteredProducts.length ? filteredProducts : products
      });
      return;
    }
    this.setData({ loading: true, loadError: '' });
    wx.request({
      url: SHOP_PRODUCTS_API_URL,
      method: 'GET',
      success: (res) => {
        const list = (res && res.data && (res.data.products || res.data.data || res.data)) || [];
        const products = (Array.isArray(list) ? list : []).map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category || '文创',
          description: p.description,
          priceWool: Number(p.priceWool || p.wool || 0),
          imageUrl: p.imageUrl
        }));
        const categoryOptions = DEFAULT_CATEGORIES;
        const filteredProducts = this.data.categoryFilter
          ? products.filter((p) => (p.category || '') === this.data.categoryFilter)
          : products;
        this.setData({
          products,
          categoryOptions,
          filteredProducts: filteredProducts.length ? filteredProducts : products,
          loading: false,
          loadError: ''
        });
      },
      fail: () => {
        this.setData({ loading: false, loadError: '加载失败，请稍后再试' });
      }
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
          const newWool = woolCount - price;
          wx.setStorageSync('woolCount', newWool);
          this.setData({ woolCount: newWool });
          wx.showToast({ title: '兑换成功', icon: 'success' });
        }
      }
    });
  }
});
