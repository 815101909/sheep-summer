// pages/vip/vip.js
Page({
  data: {
    selectedPlan: '', // 选中的套餐：monthly, quarterly, yearly
    selectedPrice: '', // 选中的价格

    // 套餐信息
    plans: {
      monthly: { name: '月卡', price: '', value: 0, duration: 1 },
      quarterly: { name: '季卡', price: '', value: 0, duration: 3 },
      yearly: { name: '年卡', price: '', value: 0, duration: 12 }
    },
    activationCode: ''
  },

  onLoad: function (options) {
    this.loadPlans();
  },

  onShow: function () {
    // 页面显示时的操作
  },

  /**
   * 输入激活码
   */
  onCodeInput: function(e) {
    this.setData({
      activationCode: e.detail.value
    });
  },

  /**
   * 激活码兑换
   */
  activateCode: function() {
    const code = this.data.activationCode.trim();
    if (!code) {
      wx.showToast({
        title: '请输入激活码',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '兑换中...',
      mask: true
    });

    // 调用云函数验证激活码
    // 使用跨账号云实例 (根据用户指示及项目配置)
    const cloud = getApp().cloud || new wx.cloud.Cloud({
      resourceAppid: 'wx85d92d28575a70f4',
      resourceEnv: 'cloud1-1gsyt78b92c539ef',
    });
    
    // 确保初始化
    if (!getApp().cloud) {
       cloud.init().catch(console.error);
    }
    
    cloud.callFunction({
      name: 'summer_activate_code',
      data: {
        code: code
      },
      success: res => {
        wx.hideLoading();
        const result = res.result;

        if (result.success) {
          const days = result.days || 30;
          
          wx.showModal({
            title: '兑换成功',
            content: `激活码有效！已为您增加 ${days} 天会员权益。`,
            showCancel: false,
            success: (res) => {
              if (res.confirm) {
                // 直接授予会员权益，传入天数
                this.grantVipAccess({
                  type: 'activation',
                  days: days
                });
              }
            }
          });
        } else {
          wx.showToast({
            title: result.message || '无效的激活码',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('激活失败', err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 处理激活逻辑 (已废弃，直接在 activateCode 中处理)
   */
  // processActivation: function(planType) { ... },

  /**
   * 授予会员权限（公共方法）
   * @param {Object} info - 套餐信息或激活信息
   * info.duration (months) 或 info.days (days)
   */
  grantVipAccess: function(info) {
    wx.setStorageSync('isVip', true);

    // 计算到期时间
    const now = new Date();
    let expiryDate;
    
    // 如果之前已经是会员且未过期，应该在原基础上顺延
    const oldExpiryStr = wx.getStorageSync('vipExpiry');
    if (oldExpiryStr) {
        const oldExpiry = new Date(oldExpiryStr);
        // 如果旧的过期时间比现在晚，说明还在有效期内，从旧时间开始顺延
        if (oldExpiry > now) {
            // 这里重置为旧时间，以便下面累加
            now.setTime(oldExpiry.getTime());
        }
    }

    if (info.days) {
      // 按天数增加
      expiryDate = new Date(now.setDate(now.getDate() + info.days));
    } else {
      // 按月数增加 (默认1个月)
      const duration = info.duration || 1; 
      expiryDate = new Date(now.setMonth(now.getMonth() + duration));
    }

    const expiryStr = expiryDate.toLocaleDateString('zh-CN');
    wx.setStorageSync('vipExpiry', expiryStr);

    // 只有非静默模式才提示 (比如自动续费可能不需要弹窗，这里手动操作都需要)
    if (info.type !== 'silent') {
        wx.showToast({
          title: '开通成功！',
          icon: 'success',
          duration: 2000
        });
    }

    // 清空激活码输入
    this.setData({ activationCode: '' });

    // 返回上一页并刷新
    setTimeout(() => {
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage) {
        prevPage.setData({
          isVip: true,
          vipExpiry: expiryStr
        });
      }
      // 如果是tabbar页面不能用navigateBack，这里假设是普通页面
      // 也可以选择不返回，而是刷新当前页状态
      wx.navigateBack().catch(() => {
        // 如果无法返回（例如是tab页），则不操作或跳转到首页
      });
    }, 2000);
  },

  /**
   * 选择套餐
   */
  selectPlan: function (e) {
    if (getApp().playClickSound) getApp().playClickSound();
    const plan = e.currentTarget.dataset.plan;
    const planInfo = this.data.plans[plan];

    this.setData({
      selectedPlan: plan,
      selectedPrice: planInfo.price
    });
  },

  /**
   * 开通会员
   */
  subscribe: function () {
    if (!this.data.selectedPlan) {
      wx.showToast({
        title: '请先选择套餐',
        icon: 'none'
      });
      return;
    }

    const planInfo = this.data.plans[this.data.selectedPlan];

    // 确认开通弹窗
    wx.showModal({
      title: '确认开通',
      content: `确认开通${planInfo.name}会员吗？费用：${planInfo.price}`,
      success: (res) => {
        if (res.confirm) {
          // 发起支付
          this.processPayment(planInfo);
        }
      }
    });
  },

  /**
   * 处理支付
   */
  processPayment: function (planInfo) {
    wx.showLoading({
      title: '正在创建订单...'
    });

    const cloud = getApp().cloud || wx.cloud;

    // 1. 调用云函数创建订单
    cloud.callFunction({
      name: 'summer_pay',
      data: {
        action: 'createOrder', // 需要确认云函数是否支持此 action，这里假设默认或需要修改
        planId: this.data.selectedPlan, // 注意：这里用 selectedPlan 作为 planId，需确保后端对应
        description: `开通${planInfo.name}`,
        amount: planInfo.value * 100 // 转换为分
      },
      success: async res => {
        const result = res.result;
        
        if (result && result.data) {
          wx.hideLoading();
          
          // 2. 发起微信支付
          wx.requestPayment({
            ...result.data, // 包含 timeStamp, nonceStr, package, signType, paySign
            success: (payRes) => {
              console.log('支付成功', payRes);
              
              // 3. 支付成功后查询/更新会员状态
              this.checkPaymentStatus(result.out_trade_no, planInfo);
            },
            fail: (payErr) => {
              console.error('支付失败', payErr);
              if (payErr.errMsg.indexOf('cancel') > -1) {
                wx.showToast({ title: '已取消支付', icon: 'none' });
                // 用户取消支付，更新订单状态为 cancelled
                this.updateOrderStatus(result.out_trade_no, 'cancelled');
              } else {
                wx.showToast({ title: '支付失败', icon: 'none' });
              }
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({
            title: result.errmsg || '创建订单失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('调用支付云函数失败', err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 更新订单状态
   */
  updateOrderStatus: function(outTradeNo, status) {
      const cloud = getApp().cloud || wx.cloud;
      cloud.callFunction({
          name: 'summer_pay',
          data: {
              action: 'updateMemberOrder',
              out_trade_no: outTradeNo,
              status: status
          },
          success: res => {
              console.log('订单状态更新成功', status);
          },
          fail: err => {
              console.error('订单状态更新失败', err);
          }
      });
  },

  /**
   * 检查支付状态并授予权益
   */
  checkPaymentStatus: function(outTradeNo, planInfo) {
      wx.showLoading({ title: '确认状态中...' });
      
      const cloud = getApp().cloud || wx.cloud;
      
      // 轮询或直接查询订单状态
      cloud.callFunction({
          name: 'summer_pay',
          data: {
              action: 'updateMemberOrder',
              out_trade_no: outTradeNo,
              status: 'success' // 这里前端传 success 其实不太安全，最好是后端查询微信接口确认，但根据现有云函数逻辑
          },
          success: res => {
              wx.hideLoading();
              if (res.result && res.result.success) {
                  this.grantVipAccess(planInfo);
              } else {
                  wx.showToast({ title: '状态更新失败，请联系客服', icon: 'none' });
              }
          },
          fail: err => {
              wx.hideLoading();
              wx.showToast({ title: '网络异常', icon: 'none' });
          }
      });
  },

  loadPlans: function () {
    const cloud = getApp().cloud || wx.cloud;
    cloud.callFunction({
      name: 'summer_pay',
      data: { action: 'getPlans' },
      success: res => {
        const list = res.result && res.result.data ? res.result.data : [];
        const map = { ...this.data.plans };
        list.forEach(doc => {
          const pid = doc.planId;
          let val = 0;
          let priceStr = '';
          if (typeof doc.priceCents === 'number') {
            val = Number(doc.priceCents);
            priceStr = '¥' + String(val);
          } else if (typeof doc.priceYuan === 'number') {
            val = Number(doc.priceYuan);
            priceStr = '¥' + String(val);
          } else if (typeof doc.price === 'number') {
            val = Number(doc.price);
            priceStr = '¥' + String(val);
          } else if (typeof doc.displayPrice === 'string') {
            priceStr = doc.displayPrice;
          }
          const name = doc.name || (pid === 'monthly' ? '月卡' : pid === 'quarterly' ? '季卡' : pid === 'yearly' ? '年卡' : '');
          const duration = map[pid] && map[pid].duration ? map[pid].duration : 1;
          if (pid) {
            map[pid] = { name, price: priceStr, value: val, duration };
          }
        });
        this.setData({ plans: map });
      }
    });
  }
});


