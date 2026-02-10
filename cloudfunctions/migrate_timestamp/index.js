// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

async function migrateCollection(collectionName, fields) {
  let total = 0
  try {
    const countResult = await db.collection(collectionName).count()
    total = countResult.total
  } catch (e) {
    console.error(`[${collectionName}] Count failed, maybe collection not exist`, e)
    return { collectionName, total: 0, updatedCount: 0, errorCount: 0, msg: 'Collection not found or error' }
  }

  const batchSize = 100
  const batchTimes = Math.ceil(total / batchSize)
  let updatedCount = 0
  let errorCount = 0

  console.log(`[${collectionName}] 开始迁移，总记录数: ${total}, 批次: ${batchTimes}`)

  for (let i = 0; i < batchTimes; i++) {
    try {
      const res = await db.collection(collectionName).skip(i * batchSize).limit(batchSize).get()
      const list = res.data
      const tasks = []

      for (const item of list) {
        let needUpdate = false
        let dataToUpdate = {}

        for (const field of fields) {
           const val = item[field]
           // Date 对象转时间戳
           if (val && val instanceof Date) {
               dataToUpdate[field] = val.getTime()
               needUpdate = true
           }
           // 处理 EJSON 格式 {"$date": timestamp} 或特殊对象结构
           else if (val && typeof val === 'object' && val.$date) {
               const ts = new Date(val.$date).getTime()
               if (!isNaN(ts)) {
                   dataToUpdate[field] = ts
                   needUpdate = true
               }
           }
           // 特殊处理 lastCheckinDate 字符串转时间戳
           else if (field === 'lastCheckinDate' && typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
               const ts = new Date(val + ' 00:00:00').getTime()
               if (!isNaN(ts)) {
                   dataToUpdate[field] = ts
                   needUpdate = true
               }
           }
        }

        if (needUpdate) {
          tasks.push(
            db.collection(collectionName).doc(item._id).update({
              data: dataToUpdate
            }).then(() => {
              updatedCount++
            }).catch(err => {
              console.error(`[${collectionName}] Update failed for ${item._id}`, err)
              errorCount++
            })
          )
        }
      }

      if (tasks.length > 0) {
        await Promise.all(tasks)
      }
      
    } catch (e) {
      console.error(`[${collectionName}] Batch ${i} failed`, e)
    }
  }
  
  return { collectionName, total, updatedCount, errorCount }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const results = []

  // 1. 迁移夏天用户表
  results.push(await migrateCollection('summeruser', ['registerDate', 'lastLoginDate', 'updateTime', 'lastCheckinDate']))

  // 2. 迁移春天用户表
  results.push(await migrateCollection('springuser', ['createTime', 'updateTime', 'lastCheckinDate']))

  // 3. 迁移春天签到表
  results.push(await migrateCollection('spring_checkin', ['checkedAt', 'createdAt', 'updatedAt']))

  // 4. 迁移春天解锁表
  results.push(await migrateCollection('spring_avatar_unlock', ['unlockedAt']))

  // 5. 迁移春天订单表
  results.push(await migrateCollection('spring_vip_orders', ['updatedAt']))
  
  // 6. 迁移春天激活码表
  results.push(await migrateCollection('spring_codes', ['usedTime']))

  return {
    msg: 'All migrations complete',
    results
  }
}
