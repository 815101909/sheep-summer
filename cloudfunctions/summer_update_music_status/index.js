const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function getShanghaiNowTs() {
  const now = new Date()
  const utcTs = now.getTime() + now.getTimezoneOffset() * 60000
  return utcTs + 8 * 60 * 60 * 1000
}

function parsePublishTimeToTs(publish_time) {
  if (!publish_time) return 0
  if (typeof publish_time === 'number') {
    if (publish_time < 1e12) return publish_time * 1000
    return publish_time
  }
  if (publish_time instanceof Date) return publish_time.getTime()
  if (typeof publish_time === 'string') {
    const s = publish_time.trim()
    const numOnly = /^\d{10,13}$/.exec(s)
    if (numOnly) {
      const n = parseInt(s, 10)
      if (s.length === 10) return n * 1000
      return n
    }
    const m = /^(\d{4})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})(?:[ T日](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/.exec(s)
    if (m) {
      const y = parseInt(m[1], 10)
      const mm = parseInt(m[2], 10)
      const d = parseInt(m[3], 10)
      const h = m[4] ? parseInt(m[4], 10) : 0
      const min = m[5] ? parseInt(m[5], 10) : 0
      const sec = m[6] ? parseInt(m[6], 10) : 0
      return Date.UTC(y, mm - 1, d, h, min, sec) + 8 * 60 * 60 * 1000
    }
    const t = new Date(s)
    if (!isNaN(t.getTime())) return t.getTime()
    return 0
  }
  try {
    const t = new Date(publish_time)
    if (!isNaN(t.getTime())) return t.getTime()
  } catch (e) {}
  return 0
}

async function updateCollection(colName, nowTs) {
  const LIMIT = 100
  const col = db.collection(colName)
  const countRes = await col.where({ status: _.neq(true), publish_time: _.lte(nowTs) }).count()
  const total = countRes.total || 0
  let updated = 0

  for (let skip = 0; skip < total; skip += LIMIT) {
    const res = await col.where({ status: _.neq(true), publish_time: _.lte(nowTs) }).orderBy('publish_time', 'asc').skip(skip).limit(LIMIT).get()
    const list = res.data || []
    const tasks = []
    for (const doc of list) {
      const ts = parsePublishTimeToTs(doc.publish_time)
      const status = doc.status
      if (ts && ts <= nowTs && status !== true) {
        tasks.push(() => col.where({ _id: doc._id, status: _.neq(true) }).update({ data: { status: true, status_updated_at: db.serverDate() } }))
      }
    }
    const LIMIT_CONC = 20
    for (let i = 0; i < tasks.length; i += LIMIT_CONC) {
      const batch = tasks.slice(i, i + LIMIT_CONC).map(fn => fn())
      const r = await Promise.allSettled(batch)
      for (const it of r) {
        if (it.status === 'fulfilled' && it.value && it.value.stats && typeof it.value.stats.updated === 'number') {
          updated += it.value.stats.updated
        }
      }
    }
  }
  return { collection: colName, total, updated }
}

exports.main = async (event, context) => {
  const nowTs = getShanghaiNowTs()
  const collections = ['summer_music_library', 'spring_music_library']
  const results = await Promise.all(collections.map(name => updateCollection(name, nowTs)))
  return { success: true, nowShanghaiTs: nowTs, results }
}
