// pages/profile/profile.js
Page({
  data: {
    currentAvatar: '',
    userAvatar: '',
    userPhone: '138****8888', // 用户手机号
    userId: 'UID123456789', // 用户ID
    userName: '夏小咩', // 默认用户名
    backgroundMusicEnabled: true, // 背景音乐开关状态
    isEditingName: false, // 是否正在编辑用户名
    tempUserName: '', // 临时用户名
    avatarList: []
  },

  onLoad: function (options) {
    this.loadUserInfo();
    this.loadAvatarChoices();
  },

  onShow: function () {
    // 每次显示页面时刷新数据
    this.loadUserInfo();
    this.loadAvatarChoices();
  },

  // 加载用户信息（资料头像来自 summeruser.avatarUrl）
  loadUserInfo: async function () {
    const info = wx.getStorageSync('userInfo') || null;
    const userName = wx.getStorageSync('userName') || '夏小咩';
    const userPhone = info && info.phone && String(info.phone).trim() ? info.phone : '未绑定';
    const userId = info && (info.userId || info.openid || info._id) ? (info.userId || info.openid || info._id) : '未登录';
    const backgroundMusicEnabled = wx.getStorageSync('backgroundMusicEnabled');
    const bgMusicEnabled = backgroundMusicEnabled !== null ? backgroundMusicEnabled : true;

    this.setData({
      userName: userName,
      backgroundMusicEnabled: bgMusicEnabled,
      userPhone: userPhone,
      userId: userId
    });

    // ---------------------------------------------------------
    // 新增：头像加载逻辑 (带缓存)
    // ---------------------------------------------------------
    // 1. 检查缓存
    const cached = wx.getStorageSync('userAvatarCache');
    if (cached && cached.expiry > Date.now()) {
        this.setData({
            userAvatar: cached.url
        });
        return;
    }

    // 初始化云开发
    const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
    await c1.init();
    const db = c1.database();
    
    let avatarUrl = '';
    
    try {
         // 2. 尝试从 summeruser 获取
         const userRes = await db.collection('summeruser').get();
         if (userRes.data.length > 0) {
             const user = userRes.data[0];
             if (user.avatarUrl) {
                 avatarUrl = user.avatarUrl;
             }
         }

         // 3. 如果没有头像，尝试从 summer_avatar 获取默认头像
         if (!avatarUrl) {
             const defaultAvatarRes = await db.collection('summer_avatar')
                 .where({
                     isDefault: true
                 })
                 .limit(1)
                 .get();
             
             if (defaultAvatarRes.data.length > 0) {
                 avatarUrl = defaultAvatarRes.data[0].avatar;
             }
         }

         // 4. 处理头像链接 (如果是 cloud:// 则转 http)
         if (avatarUrl) {
             if (avatarUrl.startsWith('cloud://')) {
                 try {
                     const tmp = await c1.getTempFileURL({ fileList: [avatarUrl] });
                     const fl = tmp.fileList || [];
                     if (fl.length && fl[0].status === 0) {
                         avatarUrl = fl[0].tempFileURL;
                     }
                 } catch(e) {
                     console.error('转换头像临时链接失败', e);
                 }
             }
             
             // 更新数据
             this.setData({
                 userAvatar: avatarUrl
             });

             // 写入缓存 (3小时)
             wx.setStorageSync('userAvatarCache', {
                 url: avatarUrl,
                 expiry: Date.now() + 3 * 60 * 60 * 1000
             });
         } else {
             // 兜底
             this.setData({
                 userAvatar: '/assets/images/default-avatar.png'
             });
         }
    } catch(err) {
        console.error('加载用户头像失败', err);
        this.setData({
             userAvatar: '/assets/images/default-avatar.png'
        });
    }
  },

  // 加载头像候选列表（summer_avatar）
  loadAvatarChoices: async function () {
    try {
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4',
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      await c1.init();

      const db = c1.database();
      const res = await db.collection('summer_avatar').where({}).get();
      const list = res.data || [];

      // 收集需要换取临时链接的文件ID
      const fileIDs = list
        .map(item => item.avatar)
        .filter(v => typeof v === 'string' && v.startsWith('cloud://'));

      const urlMap = {};
      if (fileIDs.length > 0) {
        try {
          const tmp = await c1.getTempFileURL({ fileList: fileIDs, config: { maxAge: 3 * 60 * 60 } });
          (tmp.fileList || []).forEach(f => { if (f.status === 0) urlMap[f.fileID] = f.tempFileURL; });
        } catch (e) {
          console.error('头像临时链接换取失败', e);
        }
      }

      const avatarList = list.map(item => ({
        isDefault: !!item.isDefault,
        avatarUrl: (typeof item.avatar === 'string' && item.avatar.startsWith('cloud://')) ? (urlMap[item.avatar] || '') : (item.avatar || ''),
        originalUrl: item.avatar // 保存原始链接
      })).filter(x => x.avatarUrl);

      this.setData({ avatarList });
      
      // 如果当前没有设置头像（或者显示的是默认头像），且列表里有默认头像，自动应用
      const currentUa = this.data.userAvatar;
      if ((!currentUa || currentUa === '/assets/images/default-avatar.png') && avatarList.length > 0) {
          const defaultAvatar = avatarList.find(item => item.isDefault);
          if (defaultAvatar) {
              this.setData({ userAvatar: defaultAvatar.avatarUrl });
              wx.setStorageSync('userAvatar', defaultAvatar.avatarUrl);
              // 同时也更新 userInfo 里的记录（如果需要的话）
              // 这里暂只更新本地显示
          }
      }
    } catch (err) {
      console.error('加载头像列表失败', err);
    }
  },

  /**
   * 选择头像
   */
  selectAvatar: function(e) {
    const avatar = e.currentTarget.dataset.avatar; // 这里的 avatar 可能是临时链接
    
    // 找到原始链接
    const selectedItem = this.data.avatarList.find(item => item.avatarUrl === avatar);
    const saveUrl = selectedItem ? (selectedItem.originalUrl || avatar) : avatar;

    this.setData({
      userAvatar: avatar
    });
    
    // 更新缓存 (3小时) - 使用 http 链接
    wx.setStorageSync('userAvatarCache', {
        url: avatar,
        expiry: Date.now() + 3 * 60 * 60 * 1000
    });
    
    // 同步到云端用户数据
    this.updateUserAvatar(saveUrl);
    
    wx.showToast({
      title: '头像已更新',
      icon: 'success'
    });
  },

  /**
   * 更新用户头像到云端
   */
  updateUserAvatar: function(avatarUrl) {
      // 使用全局配置的跨账号云实例
      const cloud = getApp().cloud || wx.cloud;
      
      cloud.callFunction({
          name: 'login',
          data: {
              action: 'update',
              userData: {
                  avatarUrl: avatarUrl
              }
          },
          success: res => {
              console.log('头像云端更新成功', res);
              // 更新本地 userInfo
              let info = wx.getStorageSync('userInfo') || {};
              info.avatarUrl = avatarUrl;
              wx.setStorageSync('userInfo', info);
          },
          fail: err => {
              console.error('头像云端更新失败', err);
          }
      });
  },

  // 修改头像
  onAvatarTap: function () {
    wx.showActionSheet({
      itemList: ['从相册选择', '拍照'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.chooseFromAlbum();
        } else if (res.tapIndex === 1) {
          this.takePhoto();
        }
      }
    });
  },

  // 从相册选择
  chooseFromAlbum: function () {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          'userInfo.avatar': tempFilePath
        });
        // 这里可以上传头像到服务器
        wx.showToast({
          title: '头像设置成功',
          icon: 'success'
        });
      }
    });
  },

  // 拍照
  takePhoto: function () {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          'userInfo.avatar': tempFilePath
        });
        wx.showToast({
          title: '头像设置成功',
          icon: 'success'
        });
      }
    });
  },

  // 开始编辑用户名
  onNameEdit: function () {
    this.setData({
      isEditingName: true,
      tempUserName: this.data.userName // 这里用 data.userName
    });
  },

  // 取消编辑用户名
  onNameCancel: function () {
    this.setData({
      isEditingName: false,
      tempUserName: ''
    });
  },

  // 确认编辑用户名
  onNameConfirm: function () {
    const newName = this.data.tempUserName.trim();
    if (!newName) {
      wx.showToast({
        title: '用户名不能为空',
        icon: 'none'
      });
      return;
    }
    
    // 只有变动了才调用云函数
    if (newName === this.data.userName) {
        this.setData({ isEditingName: false });
        return;
    }

    // 调用云函数更新昵称
    wx.showLoading({
      title: '更新中...',
    });

    // 使用全局配置的跨账号云实例
    const cloud = getApp().cloud || wx.cloud;
    
    cloud.callFunction({
      name: 'login',
      data: {
        action: 'update',
        userData: {
          nickName: newName
        }
      },
      success: res => {
        wx.hideLoading();
        if (res.result.updated) {
           // 更新成功
           // 保存用户名
           wx.setStorageSync('userName', newName);
           // 更新本地完整用户信息
           if (res.result.userInfo) {
             wx.setStorageSync('userInfo', res.result.userInfo);
           }
           
           this.setData({
             userName: newName,
             isEditingName: false,
             tempUserName: ''
           });
       
           wx.showToast({
             title: '用户名修改成功',
             icon: 'success'
           });
        } else {
          console.error('[云函数] 更新失败', res.result);
          wx.showToast({
            title: '更新失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('[云函数] 调用失败', err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },

  // 用户名输入
  onNameInput: function (e) {
    this.setData({
      tempUserName: e.detail.value
    });
  },

  // 背景音乐开关
  onMusicToggle: function (e) {
    const isEnabled = e.detail.value;
    this.setData({
      backgroundMusicEnabled: isEnabled
    });
    wx.setStorageSync('backgroundMusicEnabled', isEnabled);
    
    // 控制背景音乐播放/暂停
    const app = getApp();
    if (isEnabled) {
        if (app.playMusic) {
            app.playMusic();
        }
    } else {
        if (app.stopMusic) {
            app.stopMusic();
        }
    }
  },

  // 退出登录
  onLogout: function () {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录信息
          wx.removeStorageSync('isLoggedIn');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('userName');
          wx.removeStorageSync('openid');
          wx.removeStorageSync('userAvatar'); // 也清除选择的头像

          // 更新页面状态
          this.setData({
            userId: '未登录',
            userPhone: '未绑定',
            userAvatar: '/assets/images/default-avatar.png',
            userName: '夏小咩'
          });
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
          
          // 可以选择跳转回首页或登录页
          setTimeout(() => {
             wx.navigateBack();
          }, 1500);
        }
      }
    });
  }
});


