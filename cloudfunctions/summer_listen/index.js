// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  // 获取用户信息 
  const { OPENID, UNIONID, FROM_OPENID } = wxContext 
  // 优先使用FROM_OPENID（B小程序的openid），如果不存在则使用OPENID（A小程序的openid） 
  const userOpenid = FROM_OPENID || OPENID

  // 如果 action 是 getMusicList，则返回歌曲列表
  if (event.action === 'getMusicList') {
    try {
      // 获取所有歌曲，按 sort_order 排序
      // 注意：如果是大量数据需要分页，这里暂取前 100 条
      return await db.collection('summer_music_library')
        .where({ status: true })
        .orderBy('sort_order', 'asc')
        .limit(100)
        .get()
    } catch (err) {
      console.error(err)
      return {
        success: false,
        error: err
      }
    }
  }

  // 检查收藏状态
  if (event.action === 'checkFavoriteStatus') {
    const { songId } = event;
    if (!songId) return { success: false, message: 'songId required' };
    
    try {
      const countRes = await db.collection('summer_favorite').where({
        songId: songId,
        openid: userOpenid // 使用 openid 字段，或者 _openid
      }).count();
      
      return {
        success: true,
        isFavorite: countRes.total > 0
      };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  // 切换收藏状态
  if (event.action === 'toggleFavorite') {
    const { songId, isFavorite } = event; // isFavorite: true(收藏) / false(取消)
    if (!songId) return { success: false, message: 'songId required' };

    try {
      if (isFavorite) {
        // 添加收藏
        // 先查重
        const checkRes = await db.collection('summer_favorite').where({
          songId: songId,
          openid: userOpenid
        }).get();

        if (checkRes.data.length > 0) {
          return { success: true, message: 'Already favorited' };
        }

        // 获取歌曲信息
        const musicRes = await db.collection('summer_music_library').doc(songId).get();
        const songData = musicRes.data;

        await db.collection('summer_favorite').add({
          data: {
            openid: userOpenid,
            songId: songId,
            title: songData.title || '',
            artist: songData.artist || '',
            image: songData.image || songData.imageUrl || '',
            createTime: db.serverDate()
          }
        });
      } else {
        // 取消收藏
        await db.collection('summer_favorite').where({
          songId: songId,
          openid: userOpenid
        }).remove();
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  // 否则默认执行记录收听历史逻辑
  const { songId } = event

  if (!songId) {
    return {
      success: false,
      message: 'songId is required'
    }
  }

  try {
    // 1. 从音乐库获取歌曲详情，确保数据准确
    const musicRes = await db.collection('summer_music_library').doc(songId).get()
    const songData = musicRes.data

    const listenCollection = db.collection('summer_listen_history')
    
    // 2. 记录收听历史
    await listenCollection.add({
      data: {
        openid: userOpenid,
        songId: songId,
        title: songData.title || '',
        artist: songData.artist || '',
        listenTime: db.serverDate(),
        duration: songData.duration || '',
        image: songData.image || songData.imageUrl || ''
      }
    })

    return {
      success: true,
      message: 'Recorded successfully'
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      error: err
    }
  }
}
