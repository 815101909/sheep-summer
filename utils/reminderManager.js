const favoriteManager = require('./favoriteManager')

const STORAGE_KEY = 'summer_time_capsules_global' // 修改key以区分，虽然其实可以用一样的，但为了安全起见
const LAST_SHOWN_KEY = 'summer_time_capsule_last_shown'

function load() {
  return wx.getStorageSync(STORAGE_KEY) || []
}

function save(list) {
  wx.setStorageSync(STORAGE_KEY, list || [])
}

function add(item) {
  if (!item || !item.id) return
  const list = load()
  const existsIndex = list.findIndex(x => x.id === item.id)
  if (existsIndex >= 0) {
    list[existsIndex] = { ...list[existsIndex], ...item, result: item.result || list[existsIndex].result || null }
  } else {
    list.push({ ...item, favorited: !!item.favorited, result: null })
  }
  save(list)
}

function remove(id) {
  if (!id) return
  const list = load().filter(x => x.id !== id)
  save(list)
}

function markNotified(id) {
  const list = load()
  const idx = list.findIndex(x => x.id === id)
  if (idx >= 0) {
    list[idx].notified = true
    save(list)
    const aid = list[idx].articleId || ''
    if (aid) {
      const key = `summer_time_capsules_${aid}`
      const local = wx.getStorageSync(key) || []
      const i2 = local.findIndex(x => x.id === id)
      if (i2 >= 0) {
        local[i2].notified = true
        wx.setStorageSync(key, local)
      }
    }
  }
}

function markResult(id, result) {
  const list = load()
  const idx = list.findIndex(x => x.id === id)
  if (idx >= 0) {
    list[idx].result = result || null
    list[idx].completedAt = Date.now()
    list[idx].notified = true
    save(list)
    const aid = list[idx].articleId || ''
    if (aid) {
      const key = `summer_time_capsules_${aid}`
      const local = wx.getStorageSync(key) || []
      const i2 = local.findIndex(x => x.id === id)
      if (i2 >= 0) {
        local[i2].result = result || null
        local[i2].completedAt = list[idx].completedAt
        local[i2].notified = true
        wx.setStorageSync(key, local)
      }
    }
  }
}

function markFavorited(id) {
  const list = load()
  const idx = list.findIndex(x => x.id === id)
  if (idx >= 0) {
    list[idx].favorited = true
    save(list)
  }
}

function checkAndNotify() {
  const list = load()
  const now = Date.now()
  const nowDate = new Date(now)
  const dayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 0, 0, 0, 0).getTime()
  const dayEnd = dayStart + 24 * 60 * 60 * 1000
  for (let i = 0; i < list.length; i++) {
    const it = list[i]
    if (!it.notified && it.dueAt >= dayStart && it.dueAt < dayEnd) {
      const rid = it.id
      const pending = { id: rid, content: String(it.content || ''), articleId: it.articleId || '', dueAt: it.dueAt }
      wx.setStorageSync('summer_time_capsule_pending', pending)
      try {
        const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : null
        const cur = pages && pages.length ? pages[pages.length - 1] : null
        if (cur && cur.route && cur.route.indexOf('pages/garden/garden') === 0 && typeof cur.setData === 'function') {
          cur.setData({ showReminderModal: true, reminderContent: pending.content, reminderId: rid })
        }
      } catch (_) {}
      return
    }
  }
}

module.exports = {
  add,
  remove,
  markNotified,
  markResult,
  markFavorited,
  checkAndNotify
}
