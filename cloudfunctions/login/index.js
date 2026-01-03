const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 生成随机userId: summer_ + 8位数字
function generateUserId() {
  const randomDigits = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return 'summer_' + randomDigits;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  // 获取用户信息 
  const { OPENID, UNIONID, FROM_OPENID } = wxContext 
  // 优先使用FROM_OPENID（B小程序的openid），如果不存在则使用OPENID（A小程序的openid） 
  const userOpenid = FROM_OPENID || OPENID

  const usersCollection = db.collection('summeruser')

  try {
    // 如果是更新用户信息的操作
    if (event.action === 'update' && event.userData) {
      // 查询用户是否存在
      const userRes = await usersCollection.where({
        _openid: userOpenid
      }).get()

      if (userRes.data.length > 0) {
        const userId = userRes.data[0]._id
        // 更新字段
        await usersCollection.doc(userId).update({
          data: event.userData
        })
        
        // 返回更新后的用户信息（合并旧数据和新数据）
        return {
          openid: userOpenid,
          appid: wxContext.APPID,
          unionid: wxContext.UNIONID,
          userInfo: { ...userRes.data[0], ...event.userData },
          updated: true
        }
      } else {
        return {
          error: 'User not found',
          openid: userOpenid
        }
      }
    }

    // 查询用户是否存在
    const userRes = await usersCollection.where({
      _openid: userOpenid
    }).get()

    let userData = null
    let isNewUser = false

    if (userRes.data.length === 0) {
      // 新用户，创建记录

      // 生成唯一的userId
      let newUserId = '';
      let isUnique = false;
      
      // 循环直到生成的ID唯一
      while (!isUnique) {
        newUserId = generateUserId();
        // 检查是否存在
        const checkRes = await usersCollection.where({
          userId: newUserId
        }).get();
        
        if (checkRes.data.length === 0) {
          isUnique = true;
        }
      }

      const createTime = db.serverDate()
      const newUser = {
        openid: userOpenid,
        _openid: userOpenid,
        userId: newUserId, // 新增唯一userId
        registerDate: createTime,
        lastLoginDate: createTime,
        // 初始化默认字段
        nickName: '夏小咩',
        avatarUrl: '',
        vipLevel: false, // 默认会员等级
        points: 0,    // 默认积分
        referrer: event.referrer || '' // 推荐人
      }
      
      const addRes = await usersCollection.add({
        data: newUser
      })
      
      userData = { ...newUser, _id: addRes._id }
      isNewUser = true
    } else {
      // 老用户，更新最后登录时间
      const userId = userRes.data[0]._id
      await usersCollection.doc(userId).update({
        data: {
          lastLoginDate: db.serverDate()
        }
      })
      userData = userRes.data[0]
    }

    return {
      openid: userOpenid,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
      userInfo: userData,
      isNewUser: isNewUser
    }
  } catch (e) {
    console.error('[云函数] [login] error: ', e)
    return {
      error: e,
      openid: userOpenid
    }
  }
}
