// utils/favoriteManager.js

/**
 * 统一收藏管理器
 * 用于管理音乐和文章的收藏，实现“一个数据集”的设计理念。
 * 数据存储在本地缓存 'unified_favorites' 中，并同步到云数据库 'summer_user_favorites'。
 */

const STORAGE_KEY = 'unified_favorites';
const CLOUD_COLLECTION = 'summer_user_favorites';
const CLOUD_ENV = 'cloud1-1gsyt78b92c539ef';
const CLOUD_APPID = 'wx85d92d28575a70f4';

class FavoriteManager {
  constructor() {
    this._favorites = this._load();
    this._deduplicate(); // 初始化时去重
    this._initCloud();
  }

  /**
   * 去重逻辑
   * 确保同一类型下 ID 唯一
   */
  _deduplicate() {
    const uniqueMap = new Map();
    const uniqueFavorites = [];
    
    // 保留最新的记录（因为是 unshift 添加，前面的可能是新的，也可能是旧的，取决于加载顺序）
    // 假设 _favorites 顺序是：最新在最前（因为 add 是 unshift）
    // 我们遍历时，如果遇到已存在的 ID，就跳过（保留第一个，即最新的）
    
    for (const item of this._favorites) {
      const ct = item && item.data && item.data.cardType ? item.data.cardType : null;
      const key = ct ? `${item.type}_${item.id}_${ct}` : `${item.type}_${item.id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, true);
        uniqueFavorites.push(item);
      }
    }
    
    if (uniqueFavorites.length !== this._favorites.length) {
      console.log(`FavoriteManager: Cleaned up ${this._favorites.length - uniqueFavorites.length} duplicate items.`);
      this._favorites = uniqueFavorites;
      this._save();
    }
  }

  async _initCloud() {
    if (this._cloudInitialized) return;
    try {
      this.c1 = new wx.cloud.Cloud({
        resourceAppid: CLOUD_APPID,
        resourceEnv: CLOUD_ENV,
      });
      await this.c1.init();
      this.db = this.c1.database();
      this._cloudInitialized = true;
      console.log('FavoriteManager: Cloud initialized');
      // 初始化后，可以考虑静默同步一次
      // this._syncFromCloud(); 
    } catch (e) {
      console.error('FavoriteManager: Cloud init failed', e);
    }
  }

  _load() {
    try {
      return wx.getStorageSync(STORAGE_KEY) || [];
    } catch (e) {
      console.error('加载收藏数据失败', e);
      return [];
    }
  }

  _save() {
    try {
      wx.setStorageSync(STORAGE_KEY, this._favorites);
    } catch (e) {
      console.error('保存收藏数据失败', e);
    }
  }

  /**
   * 添加收藏
   * @param {Object} item - 收藏对象
   * @param {string} type - 类型 ('music' | 'article')
   */
  async add(item, type) {
    if (!item || !item.id) return;

    // 检查是否已存在
    const ct = item.cardType || (item.data && item.data.cardType) || null;
    if (ct ? this.isFavorite(item.id, type, ct) : this.isFavorite(item.id, type)) return;

    const newItem = {
      id: item.id,
      type: type,
      title: item.title || item.titleCn || '未知标题',
      subtitle: type === 'article' ? (item.subtitle || item.category || '') : (item.artist || ''),
      cover: item.cover || item.image || item.poster || '', // 统一封面字段
      data: item, // 保存原始数据，以便恢复
      createdAt: Date.now()
    };

    // 1. 本地更新
    this._favorites.unshift(newItem); // 添加到开头
    this._save();

    // 2. 云端异步更新
    this._addToCloud(newItem);
  }

  /**
   * 移除收藏
   * (注意：这里保留旧的 remove 签名作为重载入口，实际逻辑在下面)
   */
  
  /**
   * 切换收藏状态
   * @param {Object} item - 收藏对象
   * @param {string} type - 类型
   * @returns {boolean} - 新的收藏状态 (true: 已收藏, false: 未收藏)
   */
  toggle(item, type) {
    // 获取 item 中的 cardType，如果没有则默认为 null
    const cardType = item.cardType || (item.data && item.data.cardType) || null;
    
    // 使用新的匹配逻辑：如果 item 有 cardType，就精确匹配；否则模糊匹配
    const isFav = cardType ? this.isFavorite(item.id, type, cardType) : this.isFavorite(item.id, type);

    if (isFav) {
      // 移除时也要精确匹配
      this.remove(item.id, type, cardType);
      return false;
    } else {
      this.add(item, type);
      return true;
    }
  }
  
  /**
   * 移除收藏
   * @param {string|number} id - 对象ID
   * @param {string} type - 类型
   * @param {string} cardType - 可选
   */
  async remove(id, type, cardType = null) {
    const initialLength = this._favorites.length;
    
    this._favorites = this._favorites.filter(f => {
      // 如果需要匹配 cardType
      if (cardType) {
        // 如果 ID 和 Type 匹配，且 cardType 也匹配，则移除（返回 false）
        const isMatch = f.id == id && f.type === type && f.data && f.data.cardType === cardType;
        return !isMatch; 
      }
      // 否则只匹配 ID 和 Type
      return !(f.id == id && f.type === type);
    });
    
    if (this._favorites.length !== initialLength) {
      // 1. 本地更新
      this._save();
      // 2. 云端异步更新
      this._removeFromCloud(id, type, cardType);
    }
  }

  isFavorite(id, type, cardType = null) {
    if (cardType) {
      return this._favorites.some(f => f.id == id && f.type === type && f.data && f.data.cardType === cardType);
    }
    return this._favorites.some(f => f.id == id && f.type === type);
  }

  getAll(type = 'all') {
    if (type === 'all') {
      return this._favorites;
    }
    return this._favorites.filter(f => f.type === type);
  }

  // --- 云端操作私有方法 ---

  async _addToCloud(item) {
    if (!this._cloudInitialized) await this._initCloud();
    if (!this.db) return;

    try {
      await this.db.collection(CLOUD_COLLECTION).add({
        data: {
          target_id: item.id,
          type: item.type,
          data: item.data, // 存储快照
          created_at: this.db.serverDate()
        }
      });
      console.log('Added to cloud:', item.id);
    } catch (e) {
      console.error('Failed to add to cloud:', e);
    }
  }

  async _removeFromCloud(id, type, cardType = null) {
    if (!this._cloudInitialized) await this._initCloud();
    if (!this.db) return;

    try {
      const openid = wx.getStorageSync('openid');
      // 构建查询条件
      const whereCondition = {
        target_id: id,
        type: type
      };
      
      // 如果指定了 cardType，则需要在 data 字段中查找匹配的 cardType
      // 注意：云开发查询嵌套对象可能需要用 data.cardType
      if (cardType) {
        whereCondition['data.cardType'] = cardType;
      }
      if (openid) {
        whereCondition['_openid'] = openid;
      }

      const res = await this.db.collection(CLOUD_COLLECTION).where(whereCondition).get();

      if (res.data.length > 0) {
        const deletePromises = res.data.map(doc => 
          this.db.collection(CLOUD_COLLECTION).doc(doc._id).remove()
        );
        await Promise.all(deletePromises);
        console.log('Removed from cloud:', id, cardType);
      } else {
        console.log('No cloud record found to remove:', id, type, cardType);
      }
    } catch (e) {
      console.error('Failed to remove from cloud:', e);
    }
  }

  /**
   * 从云端同步数据 (通常在App启动或Collection页面加载时调用)
   */
  async syncFromCloud() {
    if (!this._cloudInitialized) await this._initCloud();
    if (!this.db) return [];
    try {
      let openid = wx.getStorageSync('openid');
      if (!openid) {
        try {
          const cloud = getApp().cloud || wx.cloud;
          const loginRes = await cloud.callFunction({ name: 'login', data: {} });
          openid = loginRes && loginRes.result && loginRes.result.openid ? loginRes.result.openid : '';
          if (openid) wx.setStorageSync('openid', openid);
        } catch (_) {}
      }
      const whereCond = openid ? { _openid: openid } : {};
      const res = await this.db.collection(CLOUD_COLLECTION)
        .where(whereCond)
        .orderBy('created_at', 'desc')
        .limit(200)
        .get();
      const cloudData = res.data || [];
      const formattedData = cloudData.map(item => {
        const raw = item.data || {};
        return {
          id: item.target_id,
          type: item.type,
          title: raw.title || raw.titleCn || '未知标题',
          subtitle: item.type === 'article' ? (raw.subtitle || raw.category || '') : (raw.artist || ''),
          cover: raw.cover || raw.image || raw.poster || '',
          data: raw,
          createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now()
        };
      });

      const missingIds = formattedData
        .filter(it => it.type === 'article' && (!it.subtitle || it.subtitle === ''))
        .map(it => it.id);
      if (missingIds.length > 0) {
        try {
          const _ = this.db.command;
          const artRes = await this.db.collection('summer_hoofprint_articles').where({ _id: _.in(missingIds) }).get();
          const subMap = {};
          (artRes.data || []).forEach(a => { subMap[a._id] = a.subtitle || ''; });
          formattedData.forEach(it => {
            if (it.type === 'article' && (!it.subtitle || it.subtitle === '') && subMap[it.id]) {
              it.subtitle = subMap[it.id];
              if (it.data) it.data.subtitle = subMap[it.id];
            }
          });
        } catch (_) {}
      }
      this._favorites = formattedData;
      this._save();
      return this._favorites;
    } catch (e) {
      return this._favorites;
    }
  }
}

// 导出单例
module.exports = new FavoriteManager();
