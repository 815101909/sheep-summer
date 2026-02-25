// 云函数：summer_we_run
const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function pickTodayStep(stepInfoList) {
  if (!Array.isArray(stepInfoList) || stepInfoList.length === 0) return 0
  const last = stepInfoList[stepInfoList.length - 1] || {}
  return Number(last.step || 0) || 0
}

exports.main = async (event, context) => {
  const action = String(event && event.action || 'getSteps')
  try {
    if (action === 'getSteps') {
      const data = event && event.weRunData && event.weRunData.data ? event.weRunData.data : {}
      const list = Array.isArray(data.stepInfoList) ? data.stepInfoList : []
      const step = pickTodayStep(list)
      return { code: 0, step, stepInfoList: list.slice(-7) }
    }

    if (action === 'decryptByCode') {
      const encryptedData = event && event.encryptedData
      const iv = event && event.iv
      const code = event && event.code
      if (!encryptedData || !iv || !code) {
        return { code: -2, msg: 'missing params' }
      }

      // 优先使用环境变量配置的 AppID/Secret 通过 HTTPS 获取 session_key（支持跨环境）
      const APPID = process.env.WERUN_APPID || ''
      const SECRET = process.env.WERUN_SECRET || ''

      async function getSessionKeyByHttp(appid, secret, jsCode) {
        return new Promise((resolve, reject) => {
          const url = `/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(jsCode)}&grant_type=authorization_code`
          const options = { hostname: 'api.weixin.qq.com', path: url, method: 'GET' }
          const req = https.request(options, res => {
            let raw = ''
            res.on('data', d => (raw += d))
            res.on('end', () => {
              try {
                const obj = JSON.parse(raw || '{}')
                if (obj.session_key) resolve(obj.session_key)
                else reject(Object.assign(new Error(obj.errmsg || 'code2session failed'), { errcode: obj.errcode, errmsg: obj.errmsg }))
              } catch (e) {
                reject(e)
              }
            })
          })
          req.on('error', reject)
          req.end()
        })
      }

      let sessionKey = ''
      let lastErr = null
      if (APPID && SECRET) {
        try {
          sessionKey = await getSessionKeyByHttp(APPID, SECRET, code)
        } catch (e) {
          lastErr = e
          // 回落到 openapi（在同 AppID 环境下有效）
        }
      }
      if (!sessionKey) {
        try {
          const sess = await cloud.openapi.auth.code2Session({
            js_code: code,
            grant_type: 'authorization_code'
          })
          sessionKey = (sess && sess.session_key) || ''
        } catch (e2) {
          if (!lastErr) lastErr = e2
        }
      }

      if (!sessionKey) {
        const hint = APPID && SECRET
          ? `code2session failed via http/openapi${lastErr && lastErr.errcode ? ` (${lastErr.errcode}:${lastErr.errmsg || ''})` : ''}`
          : 'missing WERUN_APPID/WERUN_SECRET or code2session failed'
        return { code: -3, msg: hint }
      }

      const decipher = crypto.createDecipheriv(
        'aes-128-cbc',
        Buffer.from(sessionKey, 'base64'),
        Buffer.from(iv, 'base64')
      )
      decipher.setAutoPadding(true)
      let decoded = decipher.update(encryptedData, 'base64', 'utf8')
      decoded += decipher.final('utf8')
      const obj = JSON.parse(decoded || '{}')
      const step = pickTodayStep(obj.stepInfoList || [])
      return { code: 0, step, stepInfoList: (obj.stepInfoList || []).slice(-7) }
    }

    return { code: -1, msg: 'unknown action' }
  } catch (e) {
    return { code: -500, msg: 'decrypt_failed', error: String(e && e.message || e) }
  }
}
