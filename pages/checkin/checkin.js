// pages/checkin/checkin.js
const app = getApp();

// 定义跨环境云开发实例
// 注意：这里需要填入资源方的 AppID 和环境 ID
const CROSS_ENV_ID = 'cloud1-1gsyt78b92c539ef'; 
const CROSS_APP_ID = 'wx85d92d28575a70f4';

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

Page({
  data: {
    // 打卡统计数据
    checkinDays: 0,      // 连续打卡天数
    totalCheckins: 0,    // 累计打卡天数
    unlockedImages: 0,   // 解锁形象数量

    // 日历数据
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],

    // 打卡记录
    checkinRecords: {},

    // 打卡成功提示
    showCheckinSuccess: false,

    // 盲盒奖励
    showReward: false,
    hasNewAvatar: false,
    rewardImage: '',
    
    // 形象数据
    unlockedAvatarList: [],
    currentAvatar: '/assets/images/小卡片默认形象.png',
    
    // 当前用户ID，用于更新形象
    userId: '' 
  },

  onLoad: function (options) {
    // 初始化跨环境云实例
    if (!this.cloud) {
        this.cloud = new wx.cloud.Cloud({
            resourceAppid: CROSS_APP_ID,
            resourceEnv: CROSS_ENV_ID,
        });
        this.cloudInitPromise = this.cloud.init();
    }

    // 这里不直接加载，而是由 initPageData 统一处理
    this.initPageData();
  },

  onShow: function () {
    // 页面显示时刷新数据
    this.initPageData();
  },

  /**
   * 统一初始化页面数据，等待云能力就绪
   */
  initPageData: async function() {
      if (this.cloudInitPromise) {
          try {
            await this.cloudInitPromise;
          } catch(e) {
              console.error("Cloud init failed", e);
              return;
          }
      }
      // 初始化完成后再加载数据
      if (this.cloud) {
        // 先加载用户数据以获取 userId 和当前形象
        await this.loadUserData();
        this.loadCheckinData();
        this.generateCalendar();
        this.loadAvatarData();
      }
  },

  /**
   * 加载用户基础数据（获取userId和当前形象）
   */
  loadUserData: async function() {
      if (!this.cloud) return;
      const db = this.cloud.database();
      try {
          const userRes = await db.collection('summeruser').get();
          if (userRes.data.length > 0) {
              const user = userRes.data[0];
              const userId = user._id;
              const visualization = user.visualization;
              
              let currentAvatar = '/assets/images/小卡片默认形象.png';
              
              if (visualization) {
                  let avatarUrl = visualization;
                  // 如果是 cloud:// 链接，转换为 http 链接
                  if (avatarUrl.startsWith('cloud://')) {
                      try {
                          const fileRes = await this.cloud.getTempFileURL({
                              fileList: [avatarUrl]
                          });
                          if (fileRes.fileList && fileRes.fileList.length > 0 && fileRes.fileList[0].tempFileURL) {
                              avatarUrl = fileRes.fileList[0].tempFileURL;
                          }
                      } catch(e) {
                          console.error('转换临时链接失败', e);
                      }
                  }
                  currentAvatar = avatarUrl;
              }
              
              this.setData({
                  userId: userId,
                  currentAvatar: currentAvatar
              });
              wx.setStorageSync('currentAvatar', currentAvatar);
          }
      } catch (err) {
          console.error('加载用户数据失败', err);
      }
  },

  /**
   * 加载打卡数据
   */
  loadCheckinData: async function () {
    if (!this.cloud) return;
    const db = this.cloud.database();
    try {
        // 1. 获取用户统计数据 (此时 userId 已在 loadUserData 中获取，但为了兼容仍保留部分逻辑)
        const userRes = await db.collection('summeruser').get();
        let checkinDays = 0;
        let totalCheckins = 0;

        if (userRes.data.length > 0) {
            checkinDays = userRes.data[0].checkinDays || 0;
            totalCheckins = userRes.data[0].totalCheckins || 0;
        }

        // 2. 获取打卡记录 (最近100条)
        const checkinRes = await db.collection('summer_checkin')
            .orderBy('date', 'desc')
            .limit(100)
            .get();
            
        const checkinRecords = {};
        if (checkinRes.data) {
            checkinRes.data.forEach(item => {
                checkinRecords[item.date] = true;
            });
        }

        // 3. 获取解锁形象数量
        const unlockRes = await db.collection('summer_avatar_unlock').count();
        const unlockedImages = unlockRes.total;

        this.setData({
            checkinRecords: checkinRecords,
            checkinDays: checkinDays,
            totalCheckins: totalCheckins,
            unlockedImages: unlockedImages
        });
        
        this.generateCalendar();

    } catch (err) {
        console.error('加载打卡数据失败', err);
    }
  },

  /**
   * 生成日历
   */
  generateCalendar: function () {
    const { currentYear, currentMonth, checkinRecords } = this.data;
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const today = new Date();
    const todayStr = formatDate(today);

    const calendarDays = [];
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // 计算当前月份需要的总行数
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const totalDays = daysInMonth + startingDayOfWeek;
    const totalRows = Math.ceil(totalDays / 7);
    const totalCells = totalRows * 7;

    for (let i = 0; i < totalCells; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dateStr = formatDate(date);
      const isCurrentMonth = date.getMonth() === currentMonth - 1;
      const isToday = dateStr === todayStr;

      calendarDays.push({
        date: dateStr,
        day: date.getDate(),
        checkin: !!checkinRecords[dateStr],
        today: isToday,
        currentMonth: isCurrentMonth
      });
    }

    this.setData({
      calendarDays: calendarDays
    });
  },

  /**
   * 点击日期
   */
  onDayTap: function (e) {
    const { date } = e.currentTarget.dataset;
    
    const today = new Date();
    const todayStr = formatDate(today);

    // 只能打卡当天的日期
    if (date !== todayStr) {
      wx.showToast({
        title: '只能打卡当天',
        icon: 'none'
      });
      return;
    }

    // 检查是否已经打卡
    if (this.data.checkinRecords[date]) {
      wx.showToast({
        title: '今日已打卡',
        icon: 'success'
      });
      return;
    }

    // 执行打卡
    this.checkin(date);
  },

  /**
   * 执行打卡
   */
  checkin: async function (date) {
    if (!this.cloud) {
        wx.showToast({ title: '系统初始化中...', icon: 'none' });
        return;
    }
    
    // 等待初始化完成
    if (this.cloudInitPromise) {
        try {
            await this.cloudInitPromise;
        } catch (e) {
            console.error("Cloud init failed", e);
            wx.showToast({ title: '云服务连接失败', icon: 'none' });
            return;
        }
    }

    wx.showLoading({ title: '打卡中...' });

    this.cloud.callFunction({
        name: 'summer_do_checkin',
        data: {}
    }).then(async res => {
        wx.hideLoading();
        const result = res.result;
        
        if (result.code === 0) {
            // 打卡成功
            const data = result.data;
            const checkinRecords = { ...this.data.checkinRecords };
            checkinRecords[data.date] = true;

            const hasAvatar = data.hasAvatar;
            let rewardAvatarUrl = data.rewardAvatarUrl;

            // 如果是 cloud:// 链接，转换为 http 链接
            if (hasAvatar && rewardAvatarUrl && rewardAvatarUrl.startsWith('cloud://')) {
                try {
                    const fileRes = await this.cloud.getTempFileURL({
                        fileList: [rewardAvatarUrl]
                    });
                    if (fileRes.fileList && fileRes.fileList.length > 0 && fileRes.fileList[0].tempFileURL) {
                        rewardAvatarUrl = fileRes.fileList[0].tempFileURL;
                    }
                } catch(e) {
                    console.error('转换临时链接失败', e);
                }
            }

            this.setData({
                checkinRecords: checkinRecords,
                showCheckinSuccess: true,
                hasNewAvatar: hasAvatar,
                rewardImage: rewardAvatarUrl || ''
            });

            // 刷新数据（更新统计和解锁列表）
            this.loadCheckinData();
            this.loadAvatarData();

            wx.showToast({
                title: '打卡成功！',
                icon: 'success'
            });

        } else if (result.code === 1) {
             wx.showToast({ title: '今日已打卡', icon: 'none' });
             this.loadCheckinData();
        } else {
             wx.showToast({ title: result.msg || '打卡失败', icon: 'none' });
        }

    }).catch(err => {
        wx.hideLoading();
        console.error('云函数调用失败', err);
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    });
  },

  /**
   * 打开盲盒
   */
  openBlindBox: function () {
    // 隐藏打卡成功提示，显示奖励
    this.setData({
      showCheckinSuccess: false,
      showReward: true
    });
  },

  /**
   * 关闭奖励弹窗
   */
  closeReward: function () {
    this.setData({
      showReward: false,
      showCheckinSuccess: false
    });
  },

  /**
   * 上一月
   */
  prevMonth: function () {
    let { currentYear, currentMonth } = this.data;
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
    this.setData({
      currentYear: currentYear,
      currentMonth: currentMonth
    });
    this.generateCalendar();
  },

  /**
   * 下一月
   */
  nextMonth: function () {
    let { currentYear, currentMonth } = this.data;
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    this.setData({
      currentYear: currentYear,
      currentMonth: currentMonth
    });
    this.generateCalendar();
  },

  /**
   * 上一年
   */
  prevYear: function () {
    let { currentYear } = this.data;
    currentYear--;
    this.setData({
      currentYear: currentYear
    });
    this.generateCalendar();
  },

  /**
   * 下一年
   */
  nextYear: function () {
    let { currentYear } = this.data;
    currentYear++;
    this.setData({
      currentYear: currentYear
    });
    this.generateCalendar();
  },

  /**
   * 加载形象数据
   */
  loadAvatarData: async function () {
    if (!this.cloud) return;
    if (this.cloudInitPromise) await this.cloudInitPromise;

    const db = this.cloud.database();
    try {
        const res = await db.collection('summer_avatar_unlock').get();
        // 去重
        let unlockedAvatarList = [];
        const seen = new Set();
        const cloudFileIds = [];
        const originalUrls = {}; // 映射 http -> cloud (如果需要存原始链接)
        
        if (res.data) {
            res.data.forEach(item => {
                if (item.avatarUrl && !seen.has(item.avatarUrl)) {
                    seen.add(item.avatarUrl);
                    unlockedAvatarList.push(item.avatarUrl);
                    if (item.avatarUrl.startsWith('cloud://')) {
                        cloudFileIds.push(item.avatarUrl);
                    }
                }
            });
        }

        // 批量转换 cloudID 为 http 链接
        if (cloudFileIds.length > 0) {
            try {
                const fileRes = await this.cloud.getTempFileURL({
                    fileList: cloudFileIds
                });
                
                // 建立映射表
                const urlMap = {};
                fileRes.fileList.forEach(file => {
                    if (file.tempFileURL) {
                        urlMap[file.fileID] = file.tempFileURL;
                    }
                });

                // 替换列表中的 cloudID
                unlockedAvatarList = unlockedAvatarList.map(url => {
                    // 保存原始链接映射，方便后续可能使用（虽然这里不需要存回，但为了逻辑完整）
                    const httpUrl = urlMap[url] || url;
                    originalUrls[httpUrl] = url; 
                    return httpUrl;
                });
                
                // 保存原始链接映射到 data，供选择形象时使用
                this.setData({
                    avatarOriginalUrls: originalUrls
                });

            } catch(e) {
                console.error('批量转换临时链接失败', e);
            }
        }

        this.setData({
            unlockedAvatarList: unlockedAvatarList
        });
    } catch (e) {
        console.error('加载形象失败', e);
    }
  },

  /**
   * 更新用户形象
   */
  updateUserAvatar: async function(avatarUrl) {
      if (!this.cloud) {
          wx.showToast({ title: '云服务未连接', icon: 'none' });
          return;
      }
      
      // 如果没有 userId，尝试重新获取
      if (!this.data.userId) {
          wx.showLoading({ title: '准备中...' });
          await this.loadUserData();
          wx.hideLoading();
      }
      
      if (!this.data.userId) {
          wx.showToast({ title: '获取用户信息失败，无法保存', icon: 'none' });
          return;
      }

      const db = this.cloud.database();
      
      try {
          // 如果有原始 cloud:// 链接，优先使用原始链接存储
          let saveUrl = avatarUrl;
          if (this.data.avatarOriginalUrls && this.data.avatarOriginalUrls[avatarUrl]) {
              saveUrl = this.data.avatarOriginalUrls[avatarUrl];
          }

          await db.collection('summeruser').doc(this.data.userId).update({
              data: {
                  visualization: saveUrl
              }
          });
          console.log('用户形象已更新:', saveUrl);
      } catch (err) {
          console.error('更新用户形象失败', err);
          wx.showToast({ title: '保存形象失败，请重试', icon: 'none' });
      }
  },

  /**
   * 选择默认形象
   */
  selectDefaultAvatar: function () {
    const defaultAvatar = '/assets/images/小卡片默认形象.png';

    this.setData({
      currentAvatar: defaultAvatar
    });

    wx.setStorageSync('currentAvatar', defaultAvatar);
    
    // 更新云端数据 (清空 visualization 或设为默认值)
    this.updateUserAvatar('');

    wx.showToast({
      title: '已切换到默认形象',
      icon: 'success'
    });
  },

  /**
   * 选择形象
   */
  selectAvatar: function (e) {
    const { index } = e.currentTarget.dataset;
    const selectedAvatar = this.data.unlockedAvatarList[index];

    this.setData({
      currentAvatar: selectedAvatar
    });
    
    wx.setStorageSync('currentAvatar', selectedAvatar);
    
    // 更新云端数据
    this.updateUserAvatar(selectedAvatar);

    wx.showToast({
      title: '形象切换成功',
      icon: 'success'
    });
  },

});
