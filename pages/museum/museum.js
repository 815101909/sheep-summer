// pages/museum/museum.js 夏日时光机：陈列坐的次数（拍立得）
// 根据坐了多久猜测陪伴情绪
function moodFromDuration(minutes) {
  const m = Number(minutes) || 0;
  if (m <= 3) return '匆匆一坐';
  if (m <= 8) return '小憩';
  if (m <= 15) return '放松';
  if (m <= 25) return '沉淀';
  if (m <= 40) return '放空';
  return '长伴';
}

function processRecords(records) {
  const list = (records || []).map((r) => ({
    ...r,
    moodLabel: r.moodLabel || moodFromDuration(r.durationMinutes)
  }));
  const monthSet = new Set();
  list.forEach((r) => {
    if (r.date) {
      const match = r.date.match(/^(\d{4})-(\d{1,2})/);
      if (match) monthSet.add(match[1] + '年' + match[2] + '月');
    }
  });
  const monthOptions = Array.from(monthSet).sort().reverse();
  return { list, monthOptions };
}

Page({
  data: {
    records: [],
    filteredRecords: [],
    monthOptions: [],
    monthFilter: '',
    woolCount: 0,
    woolImageUrl: '',
    polaroidBgUrl: ''
  },
  onLoad(options) {
    const raw = wx.getStorageSync('benchSitRecords') || [];
    const woolCount = wx.getStorageSync('woolCount') || 0;
    const { list, monthOptions } = processRecords(raw);
    const filteredRecords = list;
    this.setData({
      records: list,
      filteredRecords,
      monthOptions,
      monthFilter: '',
      woolCount
    });
    
    // 加载云存储图片链接
    this.loadCloudImageUrls();
  },
  onShow() {
    const raw = wx.getStorageSync('benchSitRecords') || [];
    const woolCount = wx.getStorageSync('woolCount') || 0;
    const { list, monthOptions } = processRecords(raw);
    const filteredRecords = this._filterByMonth(list, this.data.monthFilter);
    this.setData({
      records: list,
      filteredRecords,
      monthOptions,
      woolCount
    });
  },
  _filterByMonth(records, monthKey) {
    if (!monthKey) return records;
    return records.filter((r) => {
      if (!r.date) return false;
      const match = r.date.match(/^(\d{4})-(\d{1,2})/);
      return match && match[1] + '年' + match[2] + '月' === monthKey;
    });
  },
  onMonthFilter(e) {
    const month = e.currentTarget.dataset.month ?? '';
    const filteredRecords = this._filterByMonth(this.data.records, month);
    this.setData({ monthFilter: month, filteredRecords });
  },
  loadCloudImageUrls: async function() {
    const cloud = getApp().cloud || wx.cloud;
    const woolCloudPath = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/羊毛.webp';
    const bg2CloudPath = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/bg2.png';
    
    try {
      const result = await cloud.getTempFileURL({
        fileList: [woolCloudPath, bg2CloudPath]
      });
      
      const processedResult = {};
      result.fileList.forEach((file, index) => {
        if (file.status === 0) {
          if (index === 0) {
            processedResult.woolImageUrl = file.tempFileURL;
          } else if (index === 1) {
            processedResult.polaroidBgUrl = file.tempFileURL;
          }
        }
      });
      
      if (Object.keys(processedResult).length > 0) {
        this.setData(processedResult);
      }
    } catch (error) {
      console.error('获取云存储图片链接失败:', error);
    }
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
  }
});
