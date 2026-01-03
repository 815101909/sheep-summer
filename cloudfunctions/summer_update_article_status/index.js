// 云函数：summer_update_article_status
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function getShanghaiNowTs() {
  const now = new Date()
  const utcTs = now.getTime() + now.getTimezoneOffset() * 60000
  return utcTs + 8 * 60 * 60 * 1000
}

function parsePublishDateToTs(publish_date) {
  if (!publish_date) return 0
  if (typeof publish_date === 'number') return publish_date
  if (publish_date instanceof Date) return publish_date.getTime()
  if (typeof publish_date === 'string') {
    const s = publish_date.trim()
    // YYYY.MM.DD
    const dotMatch = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(s)
    if (dotMatch) {
      const y = parseInt(dotMatch[1], 10)
      const m = parseInt(dotMatch[2], 10)
      const d = parseInt(dotMatch[3], 10)
      // 以上海时区当天零点为时间戳
      return Date.UTC(y, m - 1, d) + 8 * 60 * 60 * 1000
    }
    // YYYY-MM-DD
    const dashMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
    if (dashMatch) {
      const y = parseInt(dashMatch[1], 10)
      const m = parseInt(dashMatch[2], 10)
      const d = parseInt(dashMatch[3], 10)
      return Date.UTC(y, m - 1, d) + 8 * 60 * 60 * 1000
    }
    // YYYY年MM月DD日
    const cnMatch = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(s)
    if (cnMatch) {
      const y = parseInt(cnMatch[1], 10)
      const m = parseInt(cnMatch[2], 10)
      const d = parseInt(cnMatch[3], 10)
      return Date.UTC(y, m - 1, d) + 8 * 60 * 60 * 1000
    }
    // 回退尝试直接 Date 解析
    const t = new Date(s)
    if (!isNaN(t.getTime())) return t.getTime()
    return 0
  }
  // 其他未知类型
  try {
    const t = new Date(publish_date)
    if (!isNaN(t.getTime())) return t.getTime()
  } catch (e) {}
  return 0
}

async function updateCollection(colName, nowTs) {
  const LIMIT = 100
  const col = db.collection(colName)
  const countRes = await col.count()
  const total = countRes.total || 0
  let updated = 0

  for (let skip = 0; skip < total; skip += LIMIT) {
    const res = await col
      .orderBy('publish_date', 'asc')
      .skip(skip)
      .limit(LIMIT)
      .get()
    const list = res.data || []
    for (const doc of list) {
      const status = doc.status
      const ts = parsePublishDateToTs(doc.publish_date)
      if (ts && ts <= nowTs && status !== true) {
        try {
          await col.doc(doc._id).update({
            data: {
              status: true,
              status_updated_at: db.serverDate()
            }
          })
          updated++
        } catch (e) {
          console.error('update status failed', colName, doc._id, e)
        }
      }
    }
  }
  return { collection: colName, total, updated }
}

exports.main = async (event, context) => {
  const nowTs = getShanghaiNowTs()
  const collections = [
    'spring_hoofprint_articles',
    'summer_hoofprint_articles'
  ]
  const results = []
  for (const name of collections) {
    const r = await updateCollection(name, nowTs)
    results.push(r)
  }
  return {
    success: true,
    nowShanghaiTs: nowTs,
    results
  }
}
