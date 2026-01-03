// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID, FROM_OPENID } = wxContext
  const userOpenid = FROM_OPENID || OPENID
  const { code } = event
  
  if (!code) {
    return {
      success: false,
      message: '激活码不能为空'
    }
  }

  const collection = db.collection('summer_codes')
  const _ = db.command

  try {
    // 1. 查询激活码
    const res = await collection.where({
      code: code
    }).get()

    if (res.data.length === 0) {
      return {
        success: false,
        message: '激活码不存在'
      }
    }

    const codeRecord = res.data[0]

    // 2. 检查状态 (假设 0 或 false 或 'unused' 为未使用)
    // 根据用户描述 "激活状态", 兼容多种情况
    const isUsed = codeRecord.status === 1 || codeRecord.status === true || codeRecord.status === 'used' || (codeRecord.usedBy && codeRecord.usedBy.length > 0)
    
    if (isUsed) {
      return {
        success: false,
        message: '激活码已被使用'
      }
    }

    // 3. 执行激活 (原子操作更新)
    // 使用事务或直接更新，这里使用直接更新并再次检查状态会更安全，但云函数并发不高时直接更新通常可以
    // 为了防止并发，可以使用 where status=0 条件更新
    const updateRes = await collection.where({
      _id: codeRecord._id,
      // 确保更新时状态仍为未使用
      status: _.neq(1).and(_.neq(true)).and(_.neq('used')) 
    }).update({
      data: {
        status: 'used', // 标记为已使用
        usedBy: userOpenid,
        usedTime: db.serverDate()
      }
    })

    if (updateRes.stats.updated === 0) {
      return {
        success: false,
        message: '激活失败，请重试' // 可能是并发导致已被抢用
      }
    }

    const days = codeRecord.days || 30
    const userCol = db.collection('summeruser')
    const userRes = await userCol.where({ _openid: userOpenid }).limit(1).get()
    const userDoc = (userRes.data || [])[0]
    if (userDoc) {
      let baseTime = Date.now()
      if (userDoc.isVip && userDoc.vipExpireTime && userDoc.vipExpireTime > baseTime) {
        baseTime = userDoc.vipExpireTime
      }
      const expireTime = baseTime + days * 24 * 60 * 60 * 1000
      await userCol.doc(userDoc._id).update({
        data: {
          isVip: true,
          vipExpireTime: expireTime,
          updateTime: db.serverDate()
        }
      })
    }

    return {
      success: true,
      message: '激活成功',
      days: days,
      type: codeRecord.type || 'activation'
    }

  } catch (err) {
    console.error(err)
    return {
      success: false,
      message: '系统错误',
      error: err
    }
  }
}
