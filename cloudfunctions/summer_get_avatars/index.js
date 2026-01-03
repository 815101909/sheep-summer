// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const collection = db.collection('summer_avatar')
    
    // 获取所有头像
    const res = await collection.get()
    const list = res.data || []
    
    // 处理 isDefault 排序，默认头像排在前面
    list.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1
      if (!a.isDefault && b.isDefault) return 1
      return 0
    })

    return {
      success: true,
      data: list
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      error: err
    }
  }
}
