const QQMAP_KEY_FALLBACK = 'J3NBZ-OJE6W-TTFR3-YUZMI-CEJFJ-VJBOX';
// pages/sheep/sheep.js
Page({
  data: {
    // 今日微信运动步数
    todayStepCount: 0,
    // 今天是否已经用步数帮小羊前进过一次
    hasContributedToday: false,
    latitude: 0,
    longitude: 0,
    scale: 14,
    // 路线节点（从后端 / 云函数获取）
    routeNodes: [],
    // 当前所在节点索引
    currentNodeIndex: 0,
    // 进度百分比，用于控制小羊在轨道上的位置
    sheepProgressPercent: 0,
    // 总节点数
    totalNodes: 0,
    // 下一站候选节点（由后端返回）
    nextCandidates: [],
    selectedNextNodeId: '',
    showDirectionDrawer: false,
    // 路线对应的真实地图图片，由 API 提供
    mapImage: '',
    // --- 副本.md 新增数据 ---
    totalDistance: 4500, // 漠河到三亚约4500km
    currentCollectiveDistance: 0,
    todayAcceleratedCount: 0,
    focusMinutes: 0, // 今日专注时长
    personalContributionKm: 0, // 个人今日贡献公里数
    // --- 地图路线数据 ---
    polyline: [],
    markers: [],
    useCardinalDirections: true,
    // 自由路径模式：只有起点，无终点；由方向与里程决定路径
    useFreePath: true,
    startLat: 53.481,
    startLon: 122.368,
    showPathLine: true,
    freePathSegments: [],
    lastMover: '',
    placeName: '',
    allowSetStart: false,
    directionDisplay: '',
  },

  async ensureUserNickname() {
    try {
      const cached = wx.getStorageSync('userInfo');
      if (cached && cached.nickName) return cached.nickName;
    } catch (_) {}
    try {
      const prof = await wx.getUserProfile({ desc: '用于展示接力昵称' });
      if (prof && prof.userInfo) {
        wx.setStorageSync('userInfo', prof.userInfo);
        return prof.userInfo.nickName || '一位女生';
      }
    } catch (_) {}
    return '一位女生';
  },

  onLoad() {
    this.loadProgressFromStorage();
    this.loadRouteFromApi();
    this.initSouthRoute();
    // 首次进入刷新全局数据
    this.refreshPageData();
  },

  onTapGoToWeeklyReport() {
    wx.navigateTo({
      url: '/pages/weekly-report/weekly-report'
    });
  },

  /**
   * 初始化从漠河到三亚的向南路线
   */
  initSouthRoute() {
    const nodes = this.getDefaultRouteNodes();
    const polylinePoints = nodes.map(n => ({
      latitude: n.latitude,
      longitude: n.longitude
    }));

    // 预计算全路线累计里程（km）
    this._routeCumKm = this.buildRouteCumulative(nodes);
    this._routeTotalKm = this._routeCumKm.length > 0 ? this._routeCumKm[this._routeCumKm.length - 1] : 0;

    const markers = this.data.useFreePath
      ? []
      : nodes.map((n, index) => ({
        id: index,
        latitude: n.latitude,
        longitude: n.longitude,
        title: n.name,
        width: 20,
        height: 20,
        alpha: 0.6,
        label: {
          content: n.name,
          color: '#6b7b8c',
          fontSize: 10,
          anchorX: -20,
          anchorY: -30,
          bgColor: '#ffffffcc',
          padding: 2,
          borderRadius: 4
        }
      }));

    // 当前小羊位置的特殊 marker（固定路线时展示）
    if (!this.data.useFreePath) {
      const currentIndex = this.data.currentNodeIndex || 0;
      const current = nodes[currentIndex] || nodes[0];
      markers.push({
        id: 999,
        latitude: current.latitude,
        longitude: current.longitude,
        iconPath: '/assets/images/小绵羊.png',
        width: 40,
        height: 40,
        anchor: { x: 0.5, y: 0.5 },
        zIndex: 10
      });
    }

    if (this.data.useFreePath) {
      // 初始仅放置小羊在起点
      const lat = this.data.startLat, lon = this.data.startLon;
      markers.push({
        id: 999,
        latitude: lat,
        longitude: lon,
        iconPath: '/assets/images/小绵羊.png',
        width: 40,
        height: 40,
        anchor: { x: 0.5, y: 0.5 },
        zIndex: 10
      });
      this.setData({
        latitude: lat,
        longitude: lon,
        scale: 3,
        polyline: [],
        markers
      });
      this.maybeReverseGeocode(lat, lon);
    } else {
      this.setData({
        latitude: current.latitude,
        longitude: current.longitude,
        scale: 4, 
        polyline: [{
          points: polylinePoints,
          color: '#10b981',
          width: 4,
          dottedLine: true
        }],
        markers: markers
      });
    }

    // 初次定位到当前累计里程对应的位置（若已有）
    const km = Number(this.data.currentCollectiveDistance) || 0;
    this.updateSheepPositionByDistance(km);
  },

  /**
   * 刷新页面动态数据（专注时长、步数、集体进度等）
   */
  async refreshPageData() {
    // 1. 刷新本地步数与贡献状态
    this.loadProgressFromStorage();
    
    // 2. 刷新今日专注时长（从本地 garden 记录读取）
    const records = wx.getStorageSync('benchSitRecords') || [];
    const d = new Date();
    const todayPrefix = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    
    let todayFocusMinutes = 0;
    records.forEach(r => {
      if (r.date && r.date.startsWith(todayPrefix)) {
        todayFocusMinutes += (Number(r.durationMinutes) || 0);
      }
    });

    // --- 核心逻辑：自动同步增量专注时长到云端 ---
    const todayKey = new Date().toDateString();
    let daily = wx.getStorageSync('summer_sheep_daily') || { date: todayKey };
    if (daily.date !== todayKey) {
      daily = { date: todayKey, lastSyncedSteps: 0, lastSyncedFocusMinutes: 0 };
    }
    
    const lastSyncedFocus = daily.lastSyncedFocusMinutes || 0;
    // 副本规则：每 10 分钟 20 公里。我们计算新增的“10分钟”倍数
    const totalFocusBlocks = Math.floor(todayFocusMinutes / 10);
    const lastFocusBlocks = Math.floor(lastSyncedFocus / 10);
    const newFocusBlocks = Math.max(0, totalFocusBlocks - lastFocusBlocks);

    if (newFocusBlocks > 0) {
      const addedFocusKm = newFocusBlocks * 50;
      console.log('[Sync] 准备同步增量专注公里数:', addedFocusKm);
      const success = await this.updateCloudCollectiveProgress(addedFocusKm, false); 
      
      if (success) {
        console.log('[Sync] 专注公里数同步成功');
        daily.lastSyncedFocusMinutes = todayFocusMinutes;
        wx.setStorageSync('summer_sheep_daily', daily);

        // --- 新增：专注达标弹窗 ---
        wx.showModal({
          title: `她又向南走了 ${addedFocusKm} 公里。`,
          content: '谢谢你，为自己留下了 10 分钟。\n\n专注不是拼命，是给自己空间。',
          showCancel: false,
          confirmText: '继续前进'
        });
      } else {
        console.error('[Sync] 专注公里数同步失败');
      }
    }

    // 计算专注贡献的公里数（用于本地显示）
    const focusContributionKm = totalFocusBlocks * 50;
    
    // 3. 计算步数贡献 (直接按当前步数计算今日已同步的公里数)
    const steps = Number(this.data.todayStepCount) || 0;
    const stepContributionKm = 0;
    
    // 汇总个人贡献公里数
    const personalKm = parseFloat((focusContributionKm + stepContributionKm).toFixed(2));

    // 4. 从云端获取真实的集体进度
    try {
      const cloud = await this.ensureCloudInstance();
      console.log('[Refresh] 正在调用云函数获取最新进度...');
      
      const res = await cloud.callFunction({
        name: 'summer_sheep_relay',
        data: { action: 'get' }
      });

      console.log('[Refresh] 云函数返回结果:', res);
      const result = res.result || {};
      
      if (result.code !== 0 || !result.data) {
        throw new Error(result.msg || '获取进度失败');
      }

      const globalData = result.data;
      console.log('[Refresh] 成功同步云端进度:', globalData);
      
      const todayDate = new Date().toDateString();
      let todayParticipants = globalData.todayParticipants || 0;
      
      if (globalData.lastResetDate !== todayDate) {
        todayParticipants = 0;
      }

      // 方向与锚点同步（自由路径使用）
      const dirKey = String(globalData.direction || '').toUpperCase();
      const dirDegFromKey = dirKey === 'N' ? 0 : dirKey === 'E' ? 90 : dirKey === 'S' ? 180 : dirKey === 'W' ? 270 : NaN;
      const dirDeg = isFinite(globalData.directionDeg) ? Number(globalData.directionDeg) : dirDegFromKey;
      if (isFinite(dirDeg)) this._globalDirectionDeg = dirDeg;
      this._globalAnchorKm = isFinite(globalData.anchorKm) ? Number(globalData.anchorKm) : 0;
      this._globalAnchorLat = isFinite(globalData.anchorLat) ? Number(globalData.anchorLat) : (Number(this.data.startLat) || 0);
      this._globalAnchorLon = isFinite(globalData.anchorLon) ? Number(globalData.anchorLon) : (Number(this.data.startLon) || 0);
      const nameFromKey = dirKey === 'N' ? '向北' : dirKey === 'E' ? '向东' : dirKey === 'S' ? '向南' : dirKey === 'W' ? '向西' : '';
      const nameFromDeg = isFinite(dirDeg) ? (function(d){ const a=[{n:'向北',v:0},{n:'向东',v:90},{n:'向南',v:180},{n:'向西',v:270}]; let best=a[0],min=1e9; a.forEach(it=>{const diff=Math.abs(((d-it.v+540)%360)-180); if(diff<min){min=diff;best=it}}); return best.n; })(dirDeg) : '';
      const directionDisplay = nameFromKey || nameFromDeg || '';

      this.setData({
        todayAcceleratedCount: todayParticipants,
        focusMinutes: todayFocusMinutes,
        currentCollectiveDistance: parseFloat((globalData.totalKm || 0).toFixed(2)),
        personalContributionKm: personalKm,
        currentNodeIndex: globalData.currentNodeIndex || 0,
        lastMover: globalData.lastMover || '',
        directionDisplay
      }, () => {
        const srvLat = Number(globalData.currentLat);
        const srvLon = Number(globalData.currentLon);
        if (isFinite(srvLat) && isFinite(srvLon)) {
          let markers = (this.data.markers || []).filter(m => m.id !== 999);
          markers.push({
            id: 999,
            latitude: srvLat,
            longitude: srvLon,
            iconPath: '/assets/images/小绵羊.png',
            width: 40,
            height: 40,
            anchor: { x: 0.5, y: 0.5 },
            zIndex: 10
          });
          this.setData({ markers, latitude: srvLat, longitude: srvLon });
          if (this.data.showPathLine) {
            const startLat = Number(this.data.startLat) || 0;
            const startLon = Number(this.data.startLon) || 0;
            this.setData({
              polyline: [{
                points: [{ latitude: startLat, longitude: startLon }, { latitude: srvLat, longitude: srvLon }],
                color: '#10b981',
                width: 4,
                dottedLine: true
              }]
            });
          }
          this.maybeReverseGeocode(srvLat, srvLon);
        } else {
          this.updateSheepPositionByDistance(this.data.currentCollectiveDistance || 0);
        }
      });
    } catch (e) {
      console.error('[Refresh] 同步云端进度失败:', e);
      this.setData({
        focusMinutes: todayFocusMinutes,
        personalContributionKm: personalKm
      });
    }
  },

  onShow() {
    this.refreshPageData();
    // 每次进入页面自动尝试同步一次微信步数
    this.syncWeRunSteps();
  },

  /**
   * 从本地读取当前所在节点与当天是否已助力
   */
  loadProgressFromStorage() {
    try {
      const stored = wx.getStorageSync('summer_sheep_progress') || {};
      const idx =
        typeof stored.currentIndex === 'number' && stored.currentIndex >= 0
          ? stored.currentIndex
          : 0;

      const daily = wx.getStorageSync('summer_sheep_daily') || {};
      const todayKey = new Date().toDateString();
      const hasContributedToday =
        daily && daily.date === todayKey && !!daily.hasContributedToday;
      const hasUploadedStepsToday =
        daily && daily.date === todayKey && !!daily.hasUploadedStepsToday;

      this.setData({
        currentNodeIndex: idx,
        hasContributedToday,
        hasUploadedStepsToday
      });
    } catch (_) {}
  },

  /**
   * 从后端 / 云函数获取路线节点；失败时用本地默认路线
   */
  async loadRouteFromApi() {
    let nodes = [];
    let mapImage = '';
    try {
      const cloud = getApp().cloud || wx.cloud;
      const res = await cloud.callFunction({
        name: 'summerSheepRoute',
        data: { action: 'getRoute' }
      });
      const result = res && res.result ? res.result : {};
      nodes = (result && result.nodes) || [];
      mapImage = result && result.mapImage ? result.mapImage : '';
    } catch (_) {
      // 忽略错误，使用本地默认路线
    }

    if (!Array.isArray(nodes) || nodes.length === 0) {
      nodes = this.getDefaultRouteNodes();
    }

    let currentIndex = this.data.currentNodeIndex || 0;
    if (currentIndex >= nodes.length) currentIndex = nodes.length - 1;

    this.setData(
      {
        routeNodes: nodes,
        totalNodes: nodes.length,
        currentNodeIndex: currentIndex,
        mapImage: mapImage || this.data.mapImage || '',
        polyline: this.data.useFreePath ? [] : (this.data.polyline || [])
      },
      () => {
        this.updateProgressUi(currentIndex);
      }
    );
  },

  /**
   * 本地兜底的默认路线：漠河 -> 三亚
   */
  getDefaultRouteNodes() {
    return [
      { id: 'mohe', name: '漠河 · 起点', latitude: 53.481, longitude: 122.368, nextOptions: ['haerbin', 'shenyang', 'beijing'] },
      { id: 'haerbin', name: '哈尔滨', latitude: 45.757, longitude: 126.642, nextOptions: ['shenyang', 'changchun'] },
      { id: 'changchun', name: '长春', latitude: 43.817, longitude: 125.324, nextOptions: ['shenyang', 'beijing'] },
      { id: 'shenyang', name: '沈阳', latitude: 41.677, longitude: 123.463, nextOptions: ['beijing', 'dalian'] },
      { id: 'dalian', name: '大连', latitude: 38.914, longitude: 121.614, nextOptions: ['beijing'] },
      { id: 'beijing', name: '北京', latitude: 39.904, longitude: 116.407, nextOptions: ['zhengzhou', 'tianjin', 'jinan', 'shanghai'] },
      { id: 'tianjin', name: '天津', latitude: 39.085, longitude: 117.199, nextOptions: ['jinan', 'zhengzhou', 'shanghai'] },
      { id: 'jinan', name: '济南', latitude: 36.651, longitude: 117.120, nextOptions: ['zhengzhou', 'shanghai'] },
      { id: 'zhengzhou', name: '郑州', latitude: 34.746, longitude: 113.625, nextOptions: ['wuhan', 'xian', 'hefei'] },
      { id: 'xian', name: '西安', latitude: 34.341, longitude: 108.939, nextOptions: ['wuhan', 'changsha'] },
      { id: 'hefei', name: '合肥', latitude: 31.861, longitude: 117.285, nextOptions: ['wuhan', 'shanghai'] },
      { id: 'wuhan', name: '武汉', latitude: 30.593, longitude: 114.305, nextOptions: ['changsha', 'nanchang', 'shanghai'] },
      { id: 'nanchang', name: '南昌', latitude: 28.683, longitude: 115.858, nextOptions: ['changsha', 'guangzhou', 'shanghai'] },
      { id: 'shanghai', name: '上海', latitude: 31.230, longitude: 121.473, nextOptions: ['wuhan', 'guangzhou', 'changsha'] },
      { id: 'changsha', name: '长沙', latitude: 28.228, longitude: 112.938, nextOptions: ['guangzhou', 'nanning', 'shenzhen'] },
      { id: 'shenzhen', name: '深圳', latitude: 22.543, longitude: 114.057, nextOptions: ['guangzhou', 'haikou'] },
      { id: 'nanning', name: '南宁', latitude: 22.817, longitude: 108.366, nextOptions: ['guangzhou', 'haikou'] },
      { id: 'guangzhou', name: '广州', latitude: 23.129, longitude: 113.264, nextOptions: ['haikou', 'shenzhen'] },
      { id: 'haikou', name: '海口', latitude: 20.017, longitude: 110.349, nextOptions: ['sanya'] },
      { id: 'sanya', name: '三亚 · 终点', latitude: 18.252, longitude: 109.512, nextOptions: [] }
    ];
  },

  /**
   * 更新地图组件的视觉内容（标记点与路线）
   */
  updateMapVisuals(nodes, currentIndex) {
    if (this.data.useFreePath) {
      // 自由路径模式不绘制任何固定路线或城市标记
      return;
    }
    if (!nodes || nodes.length === 0) return;

    const polylinePoints = nodes.map(n => ({
      latitude: n.latitude,
      longitude: n.longitude
    }));

    const markers = nodes.map((n, index) => ({
      id: index,
      latitude: n.latitude,
      longitude: n.longitude,
      title: n.name,
      width: 20,
      height: 20,
      alpha: 0.6,
      label: {
        content: n.name,
        color: '#6b7b8c',
        fontSize: 10,
        anchorX: -20,
        anchorY: -30,
        bgColor: '#ffffffcc',
        padding: 2,
        borderRadius: 4
      }
    }));

    const current = nodes[currentIndex] || nodes[0];
    markers.push({
      id: 999,
      latitude: current.latitude,
      longitude: current.longitude,
      iconPath: '/assets/images/小绵羊.png',
      width: 40,
      height: 40,
      anchor: { x: 0.5, y: 0.5 },
      zIndex: 10
    });

    this.setData({
      markers,
      latitude: current.latitude,
      longitude: current.longitude,
      polyline: [{
        points: polylinePoints,
        color: '#10b981',
        width: 4,
        dottedLine: true
      }]
    });
  },

  // 计算两点间球面距离（km）
  haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = d => (d * Math.PI) / 180;
    const R = 6371; // 地球半径（km）
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  // 构建路线累计公里数组：cum[0]=0, cum[i+1]=cum[i]+dist(node[i],node[i+1])
  buildRouteCumulative(nodes) {
    if (!Array.isArray(nodes) || nodes.length === 0) return [0];
    const cum = [0];
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1];
      const d = this.haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
      cum.push(cum[cum.length - 1] + d);
    }
    return cum;
  },

  // 根据累计公里数，插值计算当前位置，并刷新小羊 marker
  updateSheepPositionByDistance(km) {
    // 自由路径模式：根据起点 + 已选方向序列 + 里程，生成折线并定位小羊
    if (this.data.useFreePath) {
      this.updateFreePathByDistance(km);
      return;
    }
    const nodes = this.data.routeNodes && this.data.routeNodes.length > 0
      ? this.data.routeNodes
      : this.getDefaultRouteNodes();
    if (!this._routeCumKm) {
      this._routeCumKm = this.buildRouteCumulative(nodes);
      this._routeTotalKm = this._routeCumKm[this._routeCumKm.length - 1] || 0;
    }
    const total = this._routeTotalKm || 0;
    if (total <= 0) return;
    let v = Math.max(0, Math.min(Number(km) || 0, total));

    // 找到区间 [i, i+1]
    let i = 0;
    while (i < this._routeCumKm.length - 1 && this._routeCumKm[i + 1] < v) i++;

    const segStart = this._routeCumKm[i];
    const segEnd = this._routeCumKm[i + 1] || segStart;
    const segLen = Math.max(1e-6, segEnd - segStart);
    const t = Math.max(0, Math.min((v - segStart) / segLen, 1));

    const A = nodes[i] || nodes[0];
    const B = nodes[i + 1] || nodes[nodes.length - 1];
    const lat = A.latitude + (B.latitude - A.latitude) * t;
    const lon = A.longitude + (B.longitude - A.longitude) * t;

    // 更新 marker 999 的位置
    const markers = (this.data.markers || []).map(m => {
      if (m.id === 999) {
        const copy = Object.assign({}, m);
        copy.latitude = lat;
        copy.longitude = lon;
        return copy;
      }
      return m;
    });
    const hasSheep = markers.some(m => m.id === 999);
    if (!hasSheep) {
      markers.push({
        id: 999,
        latitude: lat,
        longitude: lon,
        iconPath: '/assets/images/小绵羊.png',
        width: 40,
        height: 40,
        anchor: { x: 0.5, y: 0.5 },
        zIndex: 10
      });
    }

    // 更新 UI：当前段的候选方向与进度百分比
    const current = nodes[i] || {};
    let nextCandidates = [];
    if (this.data.useCardinalDirections) {
      nextCandidates = this.computeCardinalCandidates(i);
    } else {
      const nextIds = Array.isArray(current.nextOptions) ? current.nextOptions : [];
      nextCandidates = nodes.filter(n => nextIds.includes(n.id));
    }
    const percent = total > 0 ? (v / total) * 100 : 0;

    this.setData({
      markers,
      latitude: lat,
      longitude: lon,
      currentNodeIndex: i,
      sheepProgressPercent: percent,
      nextCandidates,
      selectedNextNodeId: (nextCandidates[0] && nextCandidates[0].id) || this.data.selectedNextNodeId || ''
    });
    this.maybeReverseGeocode(lat, lon);
  },

  /**
   * 使用当前节点更新进度条 and next candidate
   */
  updateProgressUi(index) {
    if (this.data.useFreePath) {
      const percent = 0;
      const nextCandidates = this.computeFreeDirectionCandidates();
      this.setData({
        currentNodeIndex: 0,
        sheepProgressPercent: percent,
        nextCandidates,
        selectedNextNodeId: (nextCandidates[0] && nextCandidates[0].id) || ''
      });
      this.updateFreePathByDistance(this.data.currentCollectiveDistance || 0);
      return;
    }
    const { routeNodes } = this.data;
    const total = routeNodes.length || 1;
    const clamped = Math.max(0, Math.min(index, total - 1));
    const percent = total > 1 ? (clamped / (total - 1)) * 100 : 0;

    const current = routeNodes[clamped] || {};
    let nextCandidates = [];
    if (this.data.useCardinalDirections) {
      nextCandidates = this.computeCardinalCandidates(clamped);
    } else {
      const nextIds = Array.isArray(current.nextOptions) ? current.nextOptions : [];
      nextCandidates = routeNodes.filter(n => nextIds.includes(n.id));
    }

    this.setData({
      currentNodeIndex: clamped,
      sheepProgressPercent: percent,
      nextCandidates,
      selectedNextNodeId:
        (nextCandidates[0] && nextCandidates[0].id) || ''
    });

    this.updateMapVisuals(routeNodes, clamped);
  },

  // 计算目的地（起点 + 方位角 + 距离）经纬度
  destinationPoint(lat, lon, bearingDeg, distanceKm) {
    const R = 6371;
    const δ = distanceKm / R;
    const θ = this.deg2rad(bearingDeg);
    const φ1 = this.deg2rad(lat);
    const λ1 = this.deg2rad(lon);
    const sinφ1 = Math.sin(φ1), cosφ1 = Math.cos(φ1);
    const sinδ = Math.sin(δ), cosδ = Math.cos(δ);
    const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
    const φ2 = Math.asin(sinφ2);
    const y = Math.sin(θ) * sinδ * cosφ1;
    const x = cosδ - sinφ1 * sinφ2;
    const λ2 = λ1 + Math.atan2(y, x);
    let lat2 = this.rad2deg(φ2);
    let lon2 = (this.rad2deg(λ2) + 540) % 360 - 180; // 归一化到 [-180,180]
    return { latitude: lat2, longitude: lon2 };
  },

  // 基于锚点(公里/经纬)与方向角计算 km 下的当前位置（无副作用）
  computePositionFromAnchor(totalKm, anchorKm, anchorLat, anchorLon, bearingDeg) {
    const dist = Math.max(0, Number(totalKm || 0) - Number(anchorKm || 0));
    if (!isFinite(bearingDeg)) {
      return { latitude: Number(anchorLat) || 0, longitude: Number(anchorLon) || 0 };
    }
    return this.destinationPoint(Number(anchorLat) || 0, Number(anchorLon) || 0, Number(bearingDeg), dist);
  },

  // 返回四个方向的候选
  computeFreeDirectionCandidates() {
    return [
      { id: 'dir-N', name: '向北' },
      { id: 'dir-E', name: '向东' },
      { id: 'dir-S', name: '向南' },
      { id: 'dir-W', name: '向西' }
    ];
  },

  // 根据当前累计公里数，生成自由路径折线并定位小羊
  updateFreePathByDistance(km) {
    const totalKm = Math.max(0, Number(km) || 0);
    // 若全局方向已设置，则按锚点从 anchorKm 开始推进 (totalKm - anchorKm)
    if (isFinite(this._globalDirectionDeg)) {
      const anchorKm = isFinite(this._globalAnchorKm) ? Number(this._globalAnchorKm) : 0;
      const anchorLat = isFinite(this._globalAnchorLat) ? Number(this._globalAnchorLat) : (Number(this.data.startLat) || 0);
      const anchorLon = isFinite(this._globalAnchorLon) ? Number(this._globalAnchorLon) : (Number(this.data.startLon) || 0);
      const end = this.computePositionFromAnchor(totalKm, anchorKm, anchorLat, anchorLon, this._globalDirectionDeg);
      const startLat = Number(this.data.startLat) || 0;
      const startLon = Number(this.data.startLon) || 0;
      const points = this.data.showPathLine ? [{ latitude: startLat, longitude: startLon }, { latitude: end.latitude, longitude: end.longitude }] : [];
      const markers = (this.data.markers || []).filter(m => m.id === 999 ? false : true);
      markers.push({
        id: 999,
        latitude: end.latitude,
        longitude: end.longitude,
        iconPath: '/assets/images/小绵羊.png',
        width: 40,
        height: 40,
        anchor: { x: 0.5, y: 0.5 },
        zIndex: 10
      });
      this.setData({
        polyline: this.data.showPathLine ? [{ points, color: '#10b981', width: 4, dottedLine: true }] : [],
        markers,
        latitude: end.latitude,
        longitude: end.longitude
      });
      this.maybeReverseGeocode(end.latitude, end.longitude);
      return;
    }
    let segments = this._freeSegments;
    if (!segments) {
      try {
        segments = wx.getStorageSync('summer_sheep_free_path') || [];
      } catch (_) { segments = []; }
      this._freeSegments = segments;
    }
    const startLat = Number(this.data.startLat) || 0;
    const startLon = Number(this.data.startLon) || 0;
    let points = [];
    let cur = { latitude: startLat, longitude: startLon };
    points.push({ latitude: cur.latitude, longitude: cur.longitude });
    if (!Array.isArray(segments) || segments.length === 0 || totalKm === 0) {
      const markers = (this.data.markers || []).filter(m => m.id === 999 ? false : true);
      markers.push({
        id: 999,
        latitude: cur.latitude,
        longitude: cur.longitude,
        iconPath: '/assets/images/小绵羊.png',
        width: 40,
        height: 40,
        anchor: { x: 0.5, y: 0.5 },
        zIndex: 10
      });
      this.setData({
        // 单点不绘制折线，避免地图内部 MultiPolyline 报错
        polyline: [],
        markers,
        latitude: cur.latitude,
        longitude: cur.longitude
      });
      this.maybeReverseGeocode(cur.latitude, cur.longitude);
      return;
    }
    // 按 startKm 升序
    segments = segments.slice().sort((a, b) => (a.startKm || 0) - (b.startKm || 0));
    for (let j = 0; j < segments.length; j++) {
      const seg = segments[j];
      const nextStart = (j < segments.length - 1) ? (segments[j + 1].startKm || 0) : Number.POSITIVE_INFINITY;
      const segStartKm = seg.startKm || 0;
      const segMaxLen = Math.max(0, Math.min(totalKm, nextStart) - segStartKm);
      if (segMaxLen < 0) continue;
      const end = this.destinationPoint(cur.latitude, cur.longitude, seg.bearingDeg || 0, segMaxLen);
      points.push({ latitude: end.latitude, longitude: end.longitude });
      // 将当前位置推进到该段“理论末端”（到下一段起点）
      const advLen = (j < segments.length - 1) ? Math.max(0, (segments[j + 1].startKm || 0) - segStartKm) : segMaxLen;
      cur = this.destinationPoint(cur.latitude, cur.longitude, seg.bearingDeg || 0, advLen);
    }
    const last = points[points.length - 1] || cur;
    const markers = (this.data.markers || []).filter(m => m.id === 999 ? false : true);
    markers.push({
      id: 999,
      latitude: last.latitude,
      longitude: last.longitude,
      iconPath: '/assets/images/小绵羊.png',
      width: 40,
      height: 40,
      anchor: { x: 0.5, y: 0.5 },
      zIndex: 10
    });
    this.setData({
      polyline: this.data.showPathLine ? [{ points, color: '#10b981', width: 4, dottedLine: true }] : [],
      markers,
      latitude: last.latitude,
      longitude: last.longitude
    });
    this.maybeReverseGeocode(last.latitude, last.longitude);
  },

  deg2rad(d) {
    return (d * Math.PI) / 180;
  },
  rad2deg(r) {
    return (r * 180) / Math.PI;
  },
  bearingDeg(aLat, aLon, bLat, bLon) {
    const φ1 = this.deg2rad(aLat);
    const φ2 = this.deg2rad(bLat);
    const Δλ = this.deg2rad(bLon - aLon);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    let θ = Math.atan2(y, x);
    θ = (this.rad2deg(θ) + 360) % 360;
    return θ;
  },
  computeCardinalCandidates(index) {
    const nodes = this.data.routeNodes && this.data.routeNodes.length > 0 ? this.data.routeNodes : this.getDefaultRouteNodes();
    if (!nodes || nodes.length === 0) return [];
    const cur = nodes[index] || nodes[0];
    const buckets = { N: null, E: null, S: null, W: null };
    const labels = { N: '向北', E: '向东', S: '向南', W: '向西' };
    const distMin = 30;
    nodes.forEach(n => {
      if (n.id === cur.id) return;
      const d = this.haversineKm(cur.latitude, cur.longitude, n.latitude, n.longitude);
      if (d < distMin) return;
      const b = this.bearingDeg(cur.latitude, cur.longitude, n.latitude, n.longitude);
      let dir = null;
      if (b >= 315 || b < 45) dir = 'N';
      else if (b >= 45 && b < 135) dir = 'E';
      else if (b >= 135 && b < 225) dir = 'S';
      else dir = 'W';
      const currentBest = buckets[dir];
      if (!currentBest || d < currentBest._dist) {
        const clone = Object.assign({}, n);
        clone._dist = d;
        clone.name = `${labels[dir]}·${n.name}`;
        buckets[dir] = clone;
      }
    });
    return Object.values(buckets).filter(Boolean).map(n => {
      const ret = Object.assign({}, n);
      try { delete ret._dist; } catch(_) {}
      return ret;
    });
  },
  /**
   * 同步微信运动步数，并尝试用今天的步数帮小羊前进一步
   */
  async syncWeRunSteps() {
    try {
      let weRunRes = null;
      try {
        weRunRes = await wx.getWeRunData();
      } catch (err1) {
        const msg = String((err1 && (err1.errMsg || err1.message)) || '');
        const needSetting =
          msg.indexOf('auth deny') >= 0 ||
          msg.indexOf('scope') >= 0 ||
          msg.indexOf('werun') >= 0 ||
          msg.indexOf('WeRun') >= 0 ||
          msg.indexOf('not enabled') >= 0 ||
          msg.indexOf('未开启') >= 0 ||
          msg.indexOf('未授权') >= 0;
        if (needSetting) {
          await wx.showModal({
            title: '需要微信运动授权',
            content: '请在设置中允许读取微信运动，并确保已在微信里开启“微信运动”服务。',
            confirmText: '去设置',
            cancelText: '取消'
          });
          const os = await wx.openSetting();
          const ok = !!(os && os.authSetting && os.authSetting['scope.werun']);
          if (!ok) throw err1;
          weRunRes = await wx.getWeRunData();
        } else {
          throw err1;
        }
      }
      const cloud = await this.ensureCloudInstance();
      let loginRes = await wx.login();
      let step = 0;
      const decryptOnce = async () => {
        const dec = await cloud.callFunction({
          name: 'summer_we_run',
          data: {
            action: 'decryptByCode',
            encryptedData: weRunRes.encryptedData,
            iv: weRunRes.iv,
            code: loginRes.code
          }
        });
        const r = dec && dec.result;
        if (!r || r.code !== 0) {
          throw new Error((r && r.msg) ? String(r.msg) : '解密失败');
        }
        return Number(r.step) || 0;
      };
      try {
        step = await decryptOnce();
      } catch (err) {
        const msg = String((err && (err.message || err.errMsg)) || '');
        if (msg.indexOf('40029') >= 0 || msg.indexOf('invalid code') >= 0) {
          loginRes = await wx.login();
          step = await decryptOnce();
        } else {
          throw err;
        }
      }
      
      // --- 核心逻辑：自动同步增量步数到云端 ---
      const todayKey = new Date().toDateString();
      let daily = wx.getStorageSync('summer_sheep_daily') || { date: todayKey };
      if (daily.date !== todayKey) {
        daily = { date: todayKey, lastSyncedSteps: 0 };
      }
      
      const lastSyncedSteps = daily.lastSyncedSteps || 0;
      const addedSteps = Math.max(0, step - lastSyncedSteps);
      
      if (addedSteps > 0) {
        // 步数不再增加公里，只用于解锁方向选择权；仍记录最新步数避免重复提示
        daily.lastSyncedSteps = step;
        wx.setStorageSync('summer_sheep_daily', daily);
      }

      this.setData({ todayStepCount: step });
      this.tryContributeWithSteps(step);
    } catch (e) {
      try { console.error('syncWeRunSteps_error', e); } catch(_){}
      const raw = (e && (e.errMsg || e.message)) ? String(e.errMsg || e.message) : '未知错误';
      const lower = raw.toLowerCase();
      if (lower.includes('-601034') || lower.includes('没有权限') || lower.includes('开通云开发')) {
        wx.showModal({
          title: '需要跨环境云开发',
          content: '请确认资源环境已可用，并将 summer_we_run 部署到资源环境 cloud1-1gsyt78b92c539ef；或检查跨环境权限是否开启。',
          showCancel: false
        });
      } else {
        wx.showModal({
          title: '同步失败',
          content: raw,
          showCancel: false
        });
      }
      wx.showToast({
        title: '同步失败，稍后再试',
        icon: 'none'
      });
    }
  },

  async ensureCloudInstance() {
    let cloud = getApp().cloud;
    if (!cloud) {
      cloud = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4',
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      try { await cloud.init(); } catch (_) {}
      getApp().cloud = cloud;
    }
    return cloud;
  },

  async ensureWeRunAuth() {
    try {
      const setting = await wx.getSetting();
      if (setting.authSetting && setting.authSetting['scope.werun']) return true;
      try {
        await wx.authorize({ scope: 'scope.werun' });
        return true;
      } catch (_) {
        await wx.showModal({
          title: '需要授权',
          content: '请在设置中允许读取微信运动步数',
          confirmText: '去设置',
          cancelText: '暂不'
        });
        const os = await wx.openSetting();
        return !!(os.authSetting && os.authSetting['scope.werun']);
      }
    } catch (_) {
      return false;
    }
  },

  async onTapSyncSteps() {
    wx.showLoading({ title: '正在同步进度...', mask: true });
    try {
      // 1. 先尝试同步微信步数（内部会处理增量步数同步）
      await this.syncWeRunSteps();
      
      // 2. 强制刷新页面数据（内部会处理增量专注时长同步）
      await this.refreshPageData();
      
      wx.hideLoading();
      wx.showToast({ title: '同步完成', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      console.error('[SyncButton] 同步流程出错:', e);
      wx.showToast({ title: '同步失败', icon: 'none' });
    }
  },

  async onResetStartToMyLocation() {
    try {
      const loc = await wx.getLocation({ type: 'gcj02' });
      const lat = Number(loc.latitude) || 0;
      const lon = Number(loc.longitude) || 0;
      this.setData({ startLat: lat, startLon: lon });
      try { wx.setStorageSync('summer_sheep_free_start', { latitude: lat, longitude: lon }); } catch (_) {}
      this.updateFreePathByDistance(this.data.currentCollectiveDistance || 0);
      wx.showToast({ title: '起点已更新', icon: 'success' });
      this.maybeReverseGeocode(lat, lon);
    } catch (e) {
      wx.showToast({ title: '无法获取位置', icon: 'none' });
    }
  },

  onMapTap(e) {
    if (!this.data.useFreePath || !this.data.allowSetStart) return;
    const d = e && e.detail ? e.detail : {};
    const lat = Number(d.latitude);
    const lon = Number(d.longitude);
    if (!isFinite(lat) || !isFinite(lon)) return;
    this.setData({ startLat: lat, startLon: lon });
    try { wx.setStorageSync('summer_sheep_free_start', { latitude: lat, longitude: lon }); } catch (_) {}
    this.updateFreePathByDistance(this.data.currentCollectiveDistance || 0);
    wx.showToast({ title: '已设为起点', icon: 'none' });
    this.maybeReverseGeocode(lat, lon);
  },

  shouldGeocode(lat, lon) {
    const now = Date.now();
    if (!this._lastGeocodeTs) {
      this._lastGeocodeTs = 0;
    }
    if (!this._lastGeo) {
      this._lastGeo = { lat: 0, lon: 0 };
    }
    // 时间间隔 >= 10s 或 距离变化 >= 1km 才触发
    const dt = now - this._lastGeocodeTs;
    const dist = this.haversineKm(this._lastGeo.lat, this._lastGeo.lon, lat, lon);
    return dt >= 10000 || dist >= 1;
  },

  async maybeReverseGeocode(lat, lon) {
    try {
      if (!this.shouldGeocode(lat, lon)) return;
      const keyFromStorage = wx.getStorageSync('qqmapKey');
      const keyFromApp = (getApp() && getApp().globalData && getApp().globalData.qqmapKey) ? getApp().globalData.qqmapKey : '';
      const keyFromCode = QQMAP_KEY_FALLBACK || '';
      const key = keyFromStorage || keyFromApp || keyFromCode;
      if (!key) {
        // 无 key 则显示经纬度，避免空白
        this.setData({ placeName: lat.toFixed(3) + ',' + lon.toFixed(3) });
        this._lastGeocodeTs = Date.now();
        this._lastGeo = { lat, lon };
        return;
      }
      const url = 'https://apis.map.qq.com/ws/geocoder/v1/?location=' + lat + ',' + lon + '&key=' + encodeURIComponent(key) + '&get_poi=0';
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url,
          method: 'GET',
          timeout: 5000,
          success: resolve,
          fail: reject
        });
      });
      let name = '';
      if (res && res.data && res.data.status === 0 && res.data.result) {
        const r = res.data.result;
        const comp = r.address_component || {};
        const province = comp.province || '';
        const city = comp.city || '';
        // 只显示到省；若无省（直辖市等），退到 city；再退到推荐地址/整段地址
        const regionName = province || city || '';
        name = regionName || (r.formatted_addresses && (r.formatted_addresses.recommend || r.formatted_addresses.rough)) || r.address || '';
      }
      let clean = '';
      try {
        clean = String(name || '').replace(/[^\u4e00-\u9fa5·\s]/g, '').replace(/\s+/g, '').trim();
      } catch(_) {}
      this.setData({ placeName: clean || name || (lat.toFixed(3) + ',' + lon.toFixed(3)) });
      this._lastGeocodeTs = Date.now();
      this._lastGeo = { lat, lon };
    } catch (_) {
      // 静默失败：显示经纬度
      this.setData({ placeName: lat.toFixed(3) + ',' + lon.toFixed(3) });
      this._lastGeocodeTs = Date.now();
      this._lastGeo = { lat, lon };
    }
  },

  /**
   * 跳转到方向选择区域
   */
  onTapToSelectDirection() {
    if (this.data.todayStepCount < 3000) {
      wx.showToast({ title: '还差一点点步数，加油！', icon: 'none' });
      return;
    }
    if (this.data.hasContributedToday) {
      wx.showToast({ title: '今日已选过方向了', icon: 'none' });
      return;
    }
    this.setData({ showDirectionDrawer: true });
  },

  onCloseDirectionDrawer() {
    this.setData({ showDirectionDrawer: false });
  },

  /**
   * 更新云端集体进度
   * 注意：跨环境云开发在小程序端无法直接写入数据库，必须通过云函数中转。
   */
  async updateCloudCollectiveProgress(addedKm, shouldIncParticipants = true) {
    if (!addedKm || addedKm <= 0) {
      console.log('[Sync] 无需同步，公里数为0');
      return true;
    }
    
    try {
      const cloud = await this.ensureCloudInstance();
      console.log('[Sync] 正在调用云函数 summer_sheep_relay, 参数:', {
        action: 'updateProgress',
        addedKm: addedKm,
        shouldIncParticipants: shouldIncParticipants
      });

      const res = await cloud.callFunction({
        name: 'summer_sheep_relay',
        data: {
          action: 'updateProgress',
          addedKm: Number(addedKm), // 确保是数字
          shouldIncParticipants: !!shouldIncParticipants
        }
      });

      console.log('[Sync] 云函数调用原始响应:', res);
      const result = res.result || {};
      
      if (result.code === 0) {
        console.log('[Sync] 云函数执行成功');
        this.setData({ showDirectionDrawer: false });
        return true;
      } else {
        console.error('[Sync] 云函数逻辑报错:', result.msg || '未知错误');
        wx.showToast({ title: '同步逻辑错误', icon: 'none' });
        return false;
      }
    } catch (e) {
      console.error('[Sync] 调用云函数链路失败:', e);
      // 检查是否是云函数未部署或环境 ID 错误
      const errorMsg = e.message || '';
      if (errorMsg.includes('not found') || errorMsg.includes('not deployed')) {
        wx.showModal({
          title: '云函数未就绪',
          content: '请确认 summer_sheep_relay 云函数已部署到资源环境。',
          showCancel: false
        });
      }
      return false;
    }
  },

  onTapContribute() {
    const step = Number(this.data.todayStepCount) || 0;
    this.tryContributeWithSteps(step);
  },

  /**
   * 用当前步数尝试帮小羊前进一步（满足 >=3000 且今日未助力）
   */
  tryContributeWithSteps(step) {
    const todayKey = new Date().toDateString();
    let daily = wx.getStorageSync('summer_sheep_daily') || {};
    if (!daily || daily.date !== todayKey) {
      daily = { date: todayKey, hasContributedToday: false };
    }

    if (step < 3000) {
      // 不再自动前进，而是提示满3000步解锁方向选择权
      this.setData({ hasContributedToday: false });
      return;
    }

    if (daily.hasContributedToday) {
      this.setData({ hasContributedToday: true });
      return;
    }

    // 满 3000 步时的反馈
    wx.showModal({
      title: '今天的方向，由你决定。',
      content: '不是地图的方向。\n是她的心情方向。\n\n下一段路，往哪走？',
      showCancel: false,
      confirmText: '去选择'
    });

    this.setData({ hasContributedToday: false }); // 还没确认方向，所以不算完成贡献
  },

  /**
   * 选择下一站候选
   */
  onSelectNextNode(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    this.setData({ selectedNextNodeId: id });
  },


  /**
   * 将“下一站去哪”提交给后端，并更新全局位置
   */
  async submitNextNode() {
    const targetId = this.data.selectedNextNodeId;
    if (!targetId) {
      wx.showToast({ title: '先选一个你的心情方向', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在传递接力棒...' });

    try {
      const cloud = await this.ensureCloudInstance();
      const db = cloud.database();
      const useFree = !!this.data.useFreePath;
      let displayTargetName = '';
      let targetIndex = 0;
      let chosenBearing = null;
      if (useFree && /^dir-/.test(targetId)) {
        const map = { 'N': 0, 'E': 90, 'S': 180, 'W': 270 };
        const key = String(targetId.split('-')[1] || '').toUpperCase();
        chosenBearing = map[key] != null ? map[key] : 180;
        displayTargetName = ({ 'N': '向北', 'E': '向东', 'S': '向南', 'W': '向西' })[key] || '一个方向';
      } else {
        // 1. 查找目标节点索引（固定路线）
        targetIndex = this.data.routeNodes.findIndex(n => n.id === targetId);
        if (targetIndex === -1) throw new Error('无效的目标节点');
        const targetCity = this.data.routeNodes[targetIndex];
        displayTargetName = targetCity.name || '目标';
      }

      // 2. 更新云端全局进度（公里数 + 位置 + 接力者信息）
      const docId = this._globalDocId;
      const _ = db.command;
      const todayDate = new Date().toDateString();
      
      const nickName = await this.ensureUserNickname();

      // 计算当前锚点（以当前 totalKm 的实时位置为锚点）
      const kmNow = Number(this.data.currentCollectiveDistance) || 0;
      let anchorLat = Number(this.data.startLat) || 0;
      let anchorLon = Number(this.data.startLon) || 0;
      // 若已有全局方向和锚点，先基于旧锚点求出当前实时位置，作为新锚点
      if (isFinite(this._globalDirectionDeg) && isFinite(this._globalAnchorLat) && isFinite(this._globalAnchorLon) && isFinite(this._globalAnchorKm)) {
        const p = this.computePositionFromAnchor(kmNow, this._globalAnchorKm, this._globalAnchorLat, this._globalAnchorLon, this._globalDirectionDeg);
        anchorLat = p.latitude;
        anchorLon = p.longitude;
      }

      const res = await cloud.callFunction({
        name: 'summer_sheep_relay',
        data: {
          action: 'submitDirection',
          targetIndex: targetIndex,
          nickName: nickName,
          directionKey: useFree && /^dir-/.test(targetId) ? String(targetId.split('-')[1] || '').toUpperCase() : '',
          bearingDeg: useFree && chosenBearing != null ? chosenBearing : undefined,
          anchorKm: useFree ? kmNow : undefined,
          anchorLat: useFree ? anchorLat : undefined,
          anchorLon: useFree ? anchorLon : undefined
        }
      });

      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.msg || '云函数执行失败');
      }

      // 3. 处理自由路径方向：追加一段新方向，从当前累计公里处开始生效
      if (useFree && chosenBearing != null) {
        // 统一方向：直接在本地生效全局方向
        this._globalDirectionDeg = chosenBearing;
        this._globalAnchorKm = kmNow;
        this._globalAnchorLat = anchorLat;
        this._globalAnchorLon = anchorLon;
        this.setData({ directionDisplay: (function(d){ const a=[{n:'向北',v:0},{n:'向东',v:90},{n:'向南',v:180},{n:'向西',v:270}]; let best=a[0],min=1e9; a.forEach(it=>{const diff=Math.abs(((d-it.v+540)%360)-180); if(diff<min){min=diff;best=it}}); return best.n; })(chosenBearing) });
        this.updateFreePathByDistance(kmNow);
      }
      
      // 记录今日已贡献
      const todayKey = new Date().toDateString();
      wx.setStorageSync('summer_sheep_daily', {
        date: todayKey,
        hasContributedToday: true
      });

      this.setData({
        hasContributedToday: true,
        personalContributionKm: parseFloat((this.data.personalContributionKm + 10).toFixed(2)),
        lastMover: nickName
      });

      wx.hideLoading();

      wx.showModal({
        title: '接力成功',
        content: `你已选择：${displayTargetName}。我们会按累计里程沿该方向继续前进。`,
        showCancel: false
      });

    } catch (e) {
      console.error('接力失败', e);
      wx.hideLoading();
      wx.showToast({
        title: '接力失败，请稍后重试',
        icon: 'none'
      });
    }
  }
});
