const themeManager = require('../utils/themeManager');
Component({
  data: {
    selected: 0,
    color: "#7A7E83",
    selectedColor: "#87CEEB",
    themeClass: 'light',
    list: [
      {
        pagePath: "/pages/garden/garden",
        text: "夏日庭院",
        iconPath: "/assets/images/garden.png",
        selectedIconPath: "/assets/images/garden.png"
      },
      {
        pagePath: "/pages/music/music",
        text: "初夏牧歌",
        iconPath: "/assets/images/music.png",
        selectedIconPath: "/assets/images/music.png"
      },
      {
        pagePath: "/pages/hoofprint/hoofprint",
        text: "盛夏蹄印",
        iconPath: "/assets/images/sheep.png",
        selectedIconPath: "/assets/images/sheep.png"
      },
      {
        pagePath: "/pages/my-summer/my-summer",
        text: "我的夏天",
        iconPath: "/assets/images/我的夏天.png",
        selectedIconPath: "/assets/images/我的夏天.png"
      }
    ]
  },
  attached() {
    this.setData({ themeClass: themeManager.isDark() ? 'dark' : 'light' });
  },
  methods: {
    switchTab(e) {
      if (getApp().playClickSound) getApp().playClickSound();
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
    },
    updateTheme() {
      this.setData({ themeClass: themeManager.isDark() ? 'dark' : 'light' });
    }
  }
});
