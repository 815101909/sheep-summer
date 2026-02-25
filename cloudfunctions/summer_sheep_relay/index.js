const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const action = event && event.action ? String(event.action) : 'get'
  const COLLECTION_NAME = 'summer_collective_progress'

  // 计算从起点沿方位角行进指定公里后的经纬度（简化大地测量）
  function destinationPoint(lat, lon, bearingDeg, distanceKm) {
    const R = 6371
    const δ = (Number(distanceKm) || 0) / R
    const θ = (Number(bearingDeg) || 0) * Math.PI / 180
    const φ1 = (Number(lat) || 0) * Math.PI / 180
    const λ1 = (Number(lon) || 0) * Math.PI / 180
    const sinφ1 = Math.sin(φ1), cosφ1 = Math.cos(φ1)
    const sinδ = Math.sin(δ), cosδ = Math.cos(δ)
    const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ)
    const φ2 = Math.asin(sinφ2)
    const y = Math.sin(θ) * sinδ * cosφ1
    const x = cosδ - sinφ1 * sinφ2
    const λ2 = λ1 + Math.atan2(y, x)
    const lat2 = φ2 * 180 / Math.PI
    let lon2 = (λ2 * 180 / Math.PI + 540) % 360 - 180
    return { latitude: lat2, longitude: lon2 }
  }

  async function getGlobalDoc() {
    // 优先按 _id = 'global' 查找；兼容历史按字段 id = 'global' 的文档
    try {
      const byDoc = await db.collection(COLLECTION_NAME).doc('global').get()
      if (byDoc && byDoc.data) {
        return { docId: 'global', globalDoc: byDoc.data }
      }
    } catch (_) {}

    // 兼容：按字段 id 查找
    try {
      const res = await db.collection(COLLECTION_NAME).where({ id: 'global' }).limit(1).get()
      if (res.data && res.data.length > 0) {
        return { docId: res.data[0]._id, globalDoc: res.data[0] }
      }
    } catch (_) {}

    // 都不存在则创建固定 _id 的全局文档
    const todayDate = new Date().toDateString()
    await db.collection(COLLECTION_NAME).doc('global').set({
      data: {
        id: 'global',
        totalKm: 0,
        todayParticipants: 0,
        lastResetDate: todayDate,
        lastBaselineDate: todayDate,
        currentNodeIndex: 0,
        direction: 'S',
        directionDeg: 180,
        anchorKm: 0,
        anchorLat: 53.481,
        anchorLon: 122.368,
        currentKm: 0,
        currentLat: 53.481,
        currentLon: 122.368,
        lastUpdate: db.serverDate()
      }
    })
    return { docId: 'global', globalDoc: { totalKm: 0, todayParticipants: 0, lastResetDate: todayDate, lastBaselineDate: todayDate, currentNodeIndex: 0, direction: 'S', directionDeg: 180, anchorKm: 0, anchorLat: 53.481, anchorLon: 122.368, currentKm: 0, currentLat: 53.481, currentLon: 122.368 } }
  }

  if (action === 'updateProgress') {
    const { addedKm, shouldIncParticipants } = event
    const todayDate = new Date().toDateString()
    const numAdded = Number(addedKm) || 0

    try {
      const { docId, globalDoc } = await getGlobalDoc()
      
      // 构造更新对象
      let updateData = {
        totalKm: _.inc(numAdded),
        lastUpdate: db.serverDate(),
        lastResetDate: todayDate // 强制更新日期，确保下次判断准确
      }

      if (globalDoc.lastResetDate !== todayDate) {
        updateData.todayParticipants = shouldIncParticipants ? 1 : 0
      } else if (shouldIncParticipants) {
        updateData.todayParticipants = _.inc(1)
      }

      // 基于方向与锚点计算新的当前位置(用于全局同步)
      const curTotal = (Number(globalDoc.totalKm) || 0) + numAdded
      const bearing = isFinite(globalDoc.directionDeg) ? Number(globalDoc.directionDeg) : 180
      const aKm = Number(globalDoc.anchorKm) || 0
      const aLat = Number(globalDoc.anchorLat) || 0
      const aLon = Number(globalDoc.anchorLon) || 0
      const moveKm = Math.max(0, curTotal - aKm)
      const pos = destinationPoint(aLat, aLon, bearing, moveKm)
      updateData.currentKm = curTotal
      updateData.currentLat = pos.latitude
      updateData.currentLon = pos.longitude

      // 使用 docId 明确更新
      const updateRes = await db.collection(COLLECTION_NAME).doc(docId).update({
        data: updateData
      })

      return { code: 0, msg: 'ok', updateRes }
    } catch (e) {
      return { code: 500, msg: e.message }
    }
  }

  if (action === 'submitDirection' || action === 'submitNextNode' || action === 'chooseDirection') {
    const targetIndex = Number(event && event.targetIndex)
    const nickName = String((event && event.nickName) || '一位女生')
    const directionKey = event && event.directionKey ? String(event.directionKey) : ''
    let bearingDeg = event && typeof event.bearingDeg !== 'undefined' ? Number(event.bearingDeg) : NaN
    const keyMap = { N: 0, E: 90, S: 180, W: 270 }
    if (!isFinite(bearingDeg) && keyMap[directionKey]) {
      bearingDeg = keyMap[directionKey]
    }
    const todayDate = new Date().toDateString()
    if (!isFinite(targetIndex) || targetIndex < 0) {
      return { code: 400, msg: 'invalid targetIndex' }
    }
    const anchorKm = Number(event && event.anchorKm)
    const anchorLat = Number(event && event.anchorLat)
    const anchorLon = Number(event && event.anchorLon)
    try {
      const wxContext = cloud.getWXContext()
      const openid = (wxContext && wxContext.OPENID) || ''
      const { docId } = await getGlobalDoc()
      const data = {
        currentNodeIndex: targetIndex,
        lastMover: nickName,
        lastUpdate: db.serverDate(),
        lastResetDate: todayDate
      }
      if (directionKey) {
        data.direction = directionKey
      }
      if (isFinite(bearingDeg)) {
        data.directionDeg = bearingDeg
      }
      if (isFinite(anchorKm)) {
        data.anchorKm = anchorKm
      }
      if (isFinite(anchorLat) && isFinite(anchorLon)) {
        data.anchorLat = anchorLat
        data.anchorLon = anchorLon
      }
      const updateRes = await db.collection(COLLECTION_NAME).doc(docId).update({ data })
      // 记录一次用户的方向决策，用于周报统计
      try {
        const record = {
          openid: openid,
          nickName: nickName,
          directionKey: directionKey || '',
          bearingDeg: isFinite(bearingDeg) ? bearingDeg : null,
          anchorKm: isFinite(anchorKm) ? anchorKm : null,
          anchorLat: isFinite(anchorLat) ? anchorLat : null,
          anchorLon: isFinite(anchorLon) ? anchorLon : null,
          ts: Date.now(),
          created_at: db.serverDate()
        }
        await db.collection('summer_direction_decisions').add({ data: record })
      } catch (e) {
        // 只记录日志，不影响主流程
        console.error('record decision failed', e && e.message ? e.message : e)
      }
      return { code: 0, msg: 'ok', updateRes }
    } catch (e) {
      return { code: 500, msg: e.message }
    }
  }

  // 统计：调用者在一段时间内“决定的方向”的公里数（以 anchorKm 段差估算）
  if (action === 'userWeeklyDecisionKm') {
    try {
      const wxContext = cloud.getWXContext()
      const openid = (wxContext && wxContext.OPENID) || ''
      const startTs = Number(event && event.startTs) || 0
      const endTs = Number(event && event.endTs) || Date.now()
      const rangeStart = Math.max(0, startTs)
      const rangeEnd = Math.max(rangeStart, endTs)

      // 获取全局总里程（作为最后一段的上界）
      const { globalDoc } = await getGlobalDoc()
      const totalKmNow = Number(globalDoc && globalDoc.totalKm) || 0

      // 查询从周起始到周末之后的全部决策事件（用于找到“下一次决策”的锚点）
      const allRes = await db.collection('summer_direction_decisions')
        .where({ ts: _.gte(rangeStart) })
        .orderBy('ts', 'asc')
        .limit(1000)
        .get()
      const allEvents = (allRes && allRes.data) ? allRes.data : []

      // 过滤出本周内由该用户做出的决策事件
      const myWeekEvents = allEvents.filter(e => {
        const t = Number(e && e.ts)
        return e && e.openid === openid && isFinite(t) && t >= rangeStart && t <= rangeEnd
      })

      let km = 0
      for (let i = 0; i < myWeekEvents.length; i++) {
        const ev = myWeekEvents[i]
        const idxInAll = allEvents.findIndex(x => x && x.ts === ev.ts && x.openid === ev.openid)
        // 下一次“全局”的方向变更（不区分用户）
        let nextAnchorKm = null
        if (idxInAll >= 0 && idxInAll < allEvents.length - 1) {
          const nextEv = allEvents[idxInAll + 1]
          if (nextEv && isFinite(nextEv.anchorKm)) {
            nextAnchorKm = Number(nextEv.anchorKm)
          }
        }
        const startKm = isFinite(ev.anchorKm) ? Number(ev.anchorKm) : 0
        let endKm = isFinite(nextAnchorKm) ? nextAnchorKm : totalKmNow
        if (!isFinite(endKm)) endKm = totalKmNow
        const seg = Math.max(0, endKm - startKm)
        km += seg
      }

      return { code: 0, km: km, count: myWeekEvents.length }
    } catch (e) {
      return { code: 500, msg: e.message }
    }
  }

  if (action === 'get') {
    try {
      const { docId, globalDoc } = await getGlobalDoc()
      const todayDate = new Date().toDateString()
      if (globalDoc.lastBaselineDate !== todayDate) {
        // 应用当天基线里程（例如 200 公里），并更新当前位置
        const baseline = 200
        const curTotal = (Number(globalDoc.totalKm) || 0) + baseline
        const bearing = isFinite(globalDoc.directionDeg) ? Number(globalDoc.directionDeg) : 180
        const aKm = Number(globalDoc.anchorKm) || 0
        const aLat = Number(globalDoc.anchorLat) || 0
        const aLon = Number(globalDoc.anchorLon) || 0
        const moveKm = Math.max(0, curTotal - aKm)
        const pos = destinationPoint(aLat, aLon, bearing, moveKm)
        await db.collection(COLLECTION_NAME).doc(docId).update({
          data: {
            totalKm: curTotal,
            lastBaselineDate: todayDate,
            currentKm: curTotal,
            currentLat: pos.latitude,
            currentLon: pos.longitude,
            lastUpdate: db.serverDate()
          }
        })
        const newDoc = Object.assign({}, globalDoc, {
          totalKm: curTotal,
          lastBaselineDate: todayDate,
          currentKm: curTotal,
          currentLat: pos.latitude,
          currentLon: pos.longitude
        })
        return { code: 0, data: newDoc }
      }
      return { code: 0, data: globalDoc }
    } catch (e) {
      return { code: 500, msg: e.message }
    }
  }

  return { code: 400, msg: 'unknown action' }
}
