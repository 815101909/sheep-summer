Page({
  data: {
    articleId: '',
    printImage: '',
    printImages: [],
    articleContent: '',
    articleTitle: ''
  },
  onLoad: async function (options) {
    const articleId = options.articleId || '';
    const useFixed = options.useFixed === '1' || options.useFixed === 'true';
    if (!articleId) {
      wx.showToast({ title: '缺少文章ID', icon: 'none' });
      return;
    }
    this.setData({ articleId, useFixed });
    wx.setNavigationBarTitle({ title: '打印预览' });
    await this.loadPrintImage(articleId, useFixed);
  },
  loadPrintImage: async function (articleId, useFixed) {
    wx.showLoading({ title: '加载中...' });
    try {
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4',
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      await c1.init();
      const db = c1.database();
      const res = await db.collection('summer_hoofprint_articles').doc(articleId).get();
      const data = res.data || {};
      let images = [];
      if (useFixed) {
        images = [
          'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/整体1.png',
          'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/整体2.png'
        ];
      } else {
        if (Array.isArray(data.print)) {
          images = data.print.filter(Boolean);
        } else if (data.print) {
          images = [data.print];
        }
      }
      const fileListToConvert = (images || []).filter(u => typeof u === 'string' && u.startsWith('cloud://'));
      if (fileListToConvert.length > 0) {
        let map = {};
        try {
          const tempRes = await c1.getTempFileURL({
            fileList: fileListToConvert,
            config: { maxAge: 3 * 60 * 60 }
          });
          (tempRes.fileList || []).forEach(item => {
            if (item.status === 0) map[item.fileID] = item.tempFileURL;
          });
        } catch (e1) {
          console.error('跨环境临时链接转换失败，尝试本环境转换', e1);
        }
        try {
          const unconverted = fileListToConvert.filter(fid => !map[fid]);
          if (unconverted.length > 0) {
            const tempRes2 = await wx.cloud.getTempFileURL({
              fileList: unconverted,
              config: { maxAge: 3 * 60 * 60 }
            });
            (tempRes2.fileList || []).forEach(item => {
              if (item.status === 0) map[item.fileID] = item.tempFileURL;
            });
          }
        } catch (e2) {
          console.error('本环境临时链接转换失败', e2);
        }
        images = images.map(u => (map[u] ? map[u] : u));
      }
      this.setData({
        printImages: images,
        printImage: images[0] || '',
        articleContent: data.content || '',
        articleTitle: data.title || ''
      });
      if (images && images.length > 0) {
        this.processImagesWithText(images, articleId, data);
      }
    } catch (err) {
      console.error('加载打印图片失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
  previewImage: function (e) {
    const url = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.url) || this.data.printImage
    if (!url) return
    const urls = (this.data.printImages && this.data.printImages.length) ? this.data.printImages : [url]
    wx.previewImage({ current: url, urls })
  },
  processImagesWithText: async function(images, articleId, articleData) {
    const that = this;
    const query = wx.createSelectorQuery();
    query.select('#printCanvas')
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const processedImages = [];
        const now = new Date();
        const dateStr = `${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getDate().toString().padStart(2, '0')}`;
        const parseToDotYMD = (v) => {
          if (!v) return '';
          if (typeof v === 'number') {
            let ms = v;
            if (ms < 1000000000000) ms = ms * 1000;
            const d = new Date(ms);
            if (isNaN(d.getTime())) return '';
            return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
          }
          if (v instanceof Date) {
            const d = v;
            if (isNaN(d.getTime())) return '';
            return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
          }
          if (typeof v === 'string') {
            const s = v.trim();
            const m1 = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(s);
            if (m1) {
              const y = m1[1], m = m1[2].padStart(2, '0'), d = m1[3].padStart(2, '0');
              return `${y}.${m}.${d}`;
            }
            const m2 = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
            if (m2) {
              const y = m2[1], m = m2[2].padStart(2, '0'), d = m2[3].padStart(2, '0');
              return `${y}.${m}.${d}`;
            }
            const m3 = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(s);
            if (m3) {
              const y = m3[1], m = m3[2].padStart(2, '0'), d = m3[3].padStart(2, '0');
              return `${y}.${m}.${d}`;
            }
            const t = new Date(s);
            if (!isNaN(t.getTime())) {
              return `${t.getFullYear()}.${(t.getMonth() + 1).toString().padStart(2, '0')}.${t.getDate().toString().padStart(2, '0')}`;
            }
            return '';
          }
          try {
            const d = new Date(v);
            if (!isNaN(d.getTime())) {
              return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
            }
          } catch (e) {}
          return '';
        };
        const publishDateStr = parseToDotYMD(articleData.publish_date || articleData.publishDate || articleData.publish_time || articleData.publishTime) || dateStr;
        const title = articleData.title || '无标题';
        let coverUrl = articleData.cover_image || articleData.cover || articleData.image || articleData.img || articleData.poster || '';
        const content = articleData.content || '暂无内容';
        let parentPhotoUrl = wx.getStorageSync(`parent_task_photo_url_${articleId}`) || wx.getStorageSync(`parent_task_photo_${articleId}`) || '';
        const parentPhotoFileId = wx.getStorageSync(`parent_task_photo_fileid_${articleId}`);
        if (parentPhotoFileId) parentPhotoUrl = parentPhotoFileId;
        const mailbox = wx.getStorageSync(`mailbox_${articleId}`) || [];
        let userNote = String(wx.getStorageSync(`summer_user_note_${articleId}`) || '').trim();
        if (!userNote) {
          const fromMailbox = mailbox.length > 0 ? String(mailbox[0].text || '').trim() : '';
          userNote = fromMailbox;
        }
        if (!userNote) {
          userNote = String(wx.getStorageSync('userNote') || '').trim();
        }
        const reminders = wx.getStorageSync(`reminders_${articleId}`) || [];
        let futureNote = '';
        let futureDateStr = '';
        if (reminders.length > 0) {
          reminders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          const r = reminders[0];
          futureNote = r.content || '';
          if (r.dueAt) {
            const d = new Date(r.dueAt);
            futureDateStr = `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
          }
        }
        if (!futureNote) futureNote = '';
        if (!futureDateStr) futureDateStr = dateStr;
        const energyLevelRaw = wx.getStorageSync(`summer_energy_level_${articleId}`);
        const energyLevel = Number(energyLevelRaw || 0);
        let moodTag = '';
        const moodArr = wx.getStorageSync(`summer_selected_mood_tags_${articleId}`) || [];
        if (Array.isArray(moodArr) && moodArr.length > 0) moodTag = moodArr[0];
        const moodSingle = wx.getStorageSync(`summer_selected_mood_tag_${articleId}`);
        if (moodSingle) moodTag = moodSingle;
        const solitudeThing = wx.getStorageSync(`summer_solitude_thing_${articleId}`) || '';
        const solitudeNote = wx.getStorageSync(`summer_solitude_note_${articleId}`) || '';
        let solitudeImage = wx.getStorageSync(`summer_solitude_image_${articleId}`) || '';
        const tKey = `summer_time_capsules_${articleId}`;
        const tList = wx.getStorageSync(tKey) || [];
        let timeCapsuleContent = '';
        let timeCapsuleDateStr = '';
        let timeCapsuleWriteDateStr = '';
        if (Array.isArray(tList) && tList.length > 0) {
          const latest = tList
            .slice()
            .sort((a, b) => {
              const ax = typeof a.createdAt === 'number' ? a.createdAt : a.dueAt || 0;
              const bx = typeof b.createdAt === 'number' ? b.createdAt : b.dueAt || 0;
              return bx - ax;
            })[0];
          timeCapsuleContent = String((latest && latest.content) || '');
          if (latest && latest.dueAt) {
            const d = new Date(latest.dueAt);
            timeCapsuleDateStr = `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
          }
          if (latest && latest.createdAt) {
            const d2 = new Date(latest.createdAt);
            timeCapsuleWriteDateStr = `${d2.getFullYear()}.${(d2.getMonth() + 1).toString().padStart(2, '0')}.${d2.getDate().toString().padStart(2, '0')}`;
          }
        }
        const urlsToConvert = [];
        if (coverUrl && coverUrl.startsWith('cloud://')) urlsToConvert.push(coverUrl);
        if (parentPhotoUrl && parentPhotoUrl.startsWith('cloud://')) urlsToConvert.push(parentPhotoUrl);
        if (solitudeImage && solitudeImage.startsWith('cloud://')) urlsToConvert.push(solitudeImage);
        if (urlsToConvert.length > 0) {
          try {
            const c1 = new wx.cloud.Cloud({
              resourceAppid: 'wx85d92d28575a70f4',
              resourceEnv: 'cloud1-1gsyt78b92c539ef',
            });
            await c1.init();
            const tempRes = await c1.getTempFileURL({
              fileList: urlsToConvert,
              config: { maxAge: 3 * 60 * 60 }
            });
            if (tempRes.fileList) {
              tempRes.fileList.forEach(item => {
                if (item.status === 0) {
                  if (item.fileID === coverUrl) coverUrl = item.tempFileURL;
                  if (item.fileID === parentPhotoUrl) parentPhotoUrl = item.tempFileURL;
                  if (item.fileID === solitudeImage) solitudeImage = item.tempFileURL;
                }
              });
            }
          } catch (e) {}
        }
        const selIdxRaw = wx.getStorageSync(`summer_courage_theme_${articleId}`);
        const selIdx = Number(selIdxRaw);
        const themesArr = Array.isArray(articleData.themes) ? articleData.themes : [];
        const themeName = (selIdx >= 0 && selIdx < themesArr.length) ? (themesArr[selIdx].name || themesArr[selIdx].title || '') : '';
        const courageNote = wx.getStorageSync(`summer_courage_note_${articleId}`) || '';
        const printData = {
          date: publishDateStr,
          title: title,
          cover: coverUrl,
          content: content,
          parentPhoto: parentPhotoUrl,
          energyLevel: energyLevel,
          moodTag: moodTag,
          userNote: userNote,
          futureNote: futureNote,
          futureDate: futureDateStr,
          themeName: themeName,
          courageNote: courageNote,
          solitudeThing: solitudeThing,
          solitudeNote: solitudeNote,
          solitudeImage: solitudeImage,
          timeCapsuleContent: timeCapsuleContent,
          timeCapsuleDate: timeCapsuleDateStr,
          timeCapsuleWriteDate: timeCapsuleWriteDateStr
        };
        wx.showLoading({ title: '生成打印稿...' });
        for (let i = 0; i < images.length; i++) {
          const src = images[i];
          try {
            const newPath = await that.drawTextOnImage(canvas, ctx, src, printData, i);
            processedImages.push(newPath);
          } catch (e) {
            processedImages.push(src);
          }
        }
        that.setData({
          printImages: processedImages,
          printImage: processedImages[0] || ''
        });
        wx.hideLoading();
      });
  },
  drawTextOnImage: function(canvas, ctx, bgSrc, data, index) {
    return new Promise((resolve, reject) => {
      const img = canvas.createImage();
      img.src = bgSrc;
      img.onload = async () => {
        const width = img.width;
        const height = img.height;
        let drawWidth = width;
        let drawHeight = height;
        const maxSize = 2000;
        if (width > maxSize || height > maxSize) {
          const ratio = width / height;
          if (width > height) {
            drawWidth = maxSize;
            drawHeight = maxSize / ratio;
          } else {
            drawHeight = maxSize;
            drawWidth = maxSize * ratio;
          }
        }
        canvas.width = drawWidth;
        canvas.height = drawHeight;
        ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
        if (index === 0) {
          // 图1：绘制封面、标题、日期等绿色标注的数据
          // 1) 标题（右上绿色便签）
          ctx.fillStyle = '#2c3e50';
          const titleFontSize = Math.floor(drawWidth * 0.020);
          ctx.font = `bold ${titleFontSize}px sans-serif`;
          ctx.textAlign = 'center';
          // 位置与区域宽度基于模板相对比例估算
          const titleX = drawWidth * 0.76;
          const titleY = drawHeight * 0.10;
          const titleMaxW = drawWidth * 0.30;
          const titleLineH = titleFontSize * 1.2;
          this.wrapText(ctx, data.title || '', titleX, titleY, titleMaxW, titleLineH, drawHeight * 0.10, true);
          
          // 2) 封面（右上虚线框）
          if (data.cover) {
            const coverX = drawWidth * 0.29;
            const coverY = drawHeight * 0.05;
            const coverW = drawWidth * 0.25;
            const coverH = drawHeight * 0.20;
            await this.drawImageInRect(canvas, ctx, data.cover, coverX, coverY, coverW, coverH);
          }
          
          // 3) 日期（涂抹区域）
          ctx.fillStyle = '#2c3e50';
          const dateFontSize = Math.floor(drawWidth * 0.022);
          ctx.font = `bold ${dateFontSize}px sans-serif`;
          ctx.textAlign = 'left';
          const dateX = drawWidth * 0.27;
          const dateY = drawHeight * 0.39;
          ctx.fillText(data.date || '', dateX, dateY);
          const stars = Math.max(0, Math.min(5, Number(data.energyLevel || 0)));
          if (stars > 0) {
            ctx.fillStyle = '#ffffff';
            const starFontSize = Math.floor(drawWidth * 0.026);
            ctx.font = `${starFontSize}px sans-serif`;
            ctx.textAlign = 'center';
            let starStr = '';
            for (let i = 0; i < stars; i++) starStr += '★';
            for (let i = stars; i < 5; i++) starStr += '☆';
            const ex = drawWidth * 0.32;
            const ey = drawHeight * 0.465;
            ctx.fillText(starStr, ex, ey);
          }
          if (data.parentPhoto) {
            const px = drawWidth * 0.09;
            const py = drawHeight * 0.52;
            const pw = drawWidth * 0.20;
            const ph = drawHeight * 0.17;
            await this.drawImageInRect(canvas, ctx, data.parentPhoto, px, py, pw, ph);
          }
          if (data.moodTag) {
            ctx.fillStyle = '#ffffff';
            const moodFontSize = Math.floor(drawWidth * 0.018);
            ctx.font = `bold ${moodFontSize}px sans-serif`;
            ctx.textAlign = 'center';
            const mx = drawWidth * 0.39;
            const my = drawHeight * 0.64;
            ctx.fillText(String(data.moodTag), mx, my);
          }
          if (data.userNote) {
            ctx.fillStyle = '#2c3e50';
            const noteFs = Math.floor(drawWidth * 0.017);
            ctx.font = `${noteFs}px sans-serif`;
            ctx.textAlign = 'left';
            const ux = drawWidth * 0.125;
            const uy = drawHeight * 0.75;
            const indentX = 0;
            const lines = this.segmentNoteByPattern(String(data.userNote), [4, 6, 6, 4]);
            const lineHeight = Math.floor(noteFs * 1.35);
            for (let i = 0; i < Math.min(lines.length, 4); i++) {
              const dx = 0;
              ctx.fillText(lines[i], ux + dx, uy + i * lineHeight);
            }
          }
          // 追加：勇气卡片的三项（第二日期、主题名、勇气小事），位置按卡片布局且倾斜
          ctx.fillStyle = '#2c3e50';
          const tilt = -Math.PI / 15;
          ctx.font = `bold ${dateFontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.save();
          ctx.translate(drawWidth * 0.75, drawHeight * 0.46);
          ctx.rotate(tilt);
          ctx.textBaseline = 'middle';
          ctx.fillText(data.date || '', 0, 0);
          ctx.restore();
          if (data.themeName) {
            ctx.font = `bold ${titleFontSize}px sans-serif`;
            ctx.save();
            ctx.translate(drawWidth * 0.78, drawHeight * 0.52);
            ctx.rotate(tilt);
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            ctx.fillText(String(data.themeName), 0, 0);
            ctx.restore();
          }
          if (data.courageNote) {
            const noteFont = Math.floor(drawWidth * 0.016);
            ctx.font = `${noteFont}px sans-serif`;
            ctx.textAlign = 'left';
            const indentX = ctx.measureText('字字').width;
            const lineH = Math.floor(noteFont * 1.3);
            const lines = (() => {
              const arr = Array.from(String(data.courageNote).replace(/\s+/g, ''));
              const firstLen = 10;
              const restLen = 12;
              const out = [];
              if (arr.length <= firstLen) return [arr.join('')];
              out.push(arr.slice(0, firstLen).join(''));
              let idx = firstLen;
              while (idx < arr.length) {
                out.push(arr.slice(idx, idx + restLen).join(''));
                idx += restLen;
              }
              return out.slice(0, 8);
            })();
            ctx.save();
            ctx.translate(drawWidth * 0.66, drawHeight * 0.66);
            ctx.rotate(tilt);
            ctx.textBaseline = 'top';
            for (let i = 0; i < lines.length; i++) {
              const dx = i === 0 ? indentX : 0;
              ctx.fillText(lines[i], dx, i * lineH);
            }
            ctx.restore();
          }
        } else if (index === 1) {
          ctx.fillStyle = '#2c3e50';
          const contentFontSize = Math.floor(drawWidth * 0.020);
          ctx.font = `${contentFontSize}px sans-serif`;
          ctx.textAlign = 'left';
          const x = drawWidth * 0.32;
          const y = drawHeight * 0.795;
          const maxW = drawWidth * 0.59;
          const maxH = drawHeight * 0.16;
          this.drawTextFit(ctx, data.content, x, y, maxW, maxH, drawWidth, { indentChars: 2, lineHeightFactor: 1.42 });
          if (data.solitudeImage) {
            const sx = drawWidth * 0.11;
            const sy = drawHeight * 0.38;
            const sw = drawWidth * 0.20;
            const sh = drawHeight * 0.14;
            const r = Math.max(6, Math.floor(Math.min(sw, sh) * 0.08));
            await this.drawImageRoundRect(canvas, ctx, data.solitudeImage, sx, sy, sw, sh, r);
          }
          const sDateFs = Math.floor(drawWidth * 0.018);
          ctx.fillStyle = '#2c3e50';
          ctx.font = `bold ${sDateFs}px sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText(String(data.date || ''), drawWidth * 0.28, drawHeight * 0.14);
          if (data.solitudeThing) {
            ctx.fillStyle = '#2c3e50';
            const fs = Math.floor(drawWidth * 0.024);
            ctx.font = `bold ${fs}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(String(data.solitudeThing), drawWidth * 0.24, drawHeight * 0.25);
          }
          if (data.solitudeNote) {
            ctx.fillStyle = '#2c3e50';
            const x2 = drawWidth * 0.365;
            const y2 = drawHeight * 0.37;
            ctx.font = `24px sans-serif`;
            ctx.textAlign = 'left';
            const lines = this.segmentNote(String(data.solitudeNote), 8, 10);
            const lineHeight = 40;
            const indentX = ctx.measureText('一一').width;
            for (let i = 0; i < Math.min(lines.length, 8); i++) {
              const dx = i === 0 ? indentX : 0;
              ctx.fillText(lines[i], x2 + dx, y2 + i * lineHeight);
            }
          }
          const dateFs = Math.floor(drawWidth * 0.022);
          if (data.timeCapsuleDate) {
            ctx.fillStyle = '#2c3e50';
            ctx.font = `bold ${dateFs}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(String(data.timeCapsuleDate), drawWidth * 0.75, drawHeight * 0.28);
          }
          if (data.timeCapsuleWriteDate) {
            ctx.fillStyle = '#2c3e50';
            ctx.font = `bold ${dateFs}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(String(data.date), drawWidth * 0.75, drawHeight * 0.21);
          }
          if (data.timeCapsuleContent) {
            const tx = drawWidth * 0.62;
            const ty = drawHeight * 0.45;
            const tw = drawWidth * 0.30;
            const th = drawHeight * 0.13;
            this.drawTextFit(ctx, String(data.timeCapsuleContent), tx, ty, tw, th, drawWidth, { indentChars: 2, lineHeightFactor: 1.42 });
          }
        }
        wx.canvasToTempFilePath({
          canvas: canvas,
          fileType: 'jpg',
          quality: 0.9,
          success: (res) => {
            resolve(res.tempFilePath);
          },
          fail: (err) => {
            reject(err);
          }
        });
      };
      img.onerror = (e) => {
        reject(e);
      };
    });
  },
  async drawImageInRect(canvas, ctx, src, x, y, w, h) {
    if (!src) return;
    try {
      const img = canvas.createImage();
      img.src = src;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const imgRatio = img.width / img.height;
      const rectRatio = w / h;
      let sx, sy, sw, sh;
      if (imgRatio > rectRatio) {
        sh = img.height;
        sw = sh * rectRatio;
        sy = 0;
        sx = (img.width - sw) / 2;
      } else {
        sw = img.width;
        sh = sw / rectRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    } catch (e) {}
  },
  async drawImageRoundRect(canvas, ctx, src, x, y, w, h, r) {
    if (!src) return;
    try {
      const img = canvas.createImage();
      img.src = src;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const imgRatio = img.width / img.height;
      const rectRatio = w / h;
      let sx, sy, sw, sh;
      if (imgRatio > rectRatio) {
        sh = img.height;
        sw = sh * rectRatio;
        sy = 0;
        sx = (img.width - sw) / 2;
      } else {
        sw = img.width;
        sh = sw / rectRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
      }
      const rr = Math.max(0, Math.min(r || 0, Math.min(w, h) / 2));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0);
      ctx.lineTo(x + w, y + h - rr);
      ctx.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2);
      ctx.lineTo(x + rr, y + h);
      ctx.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI);
      ctx.lineTo(x, y + rr);
      ctx.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 3 / 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
      ctx.restore();
    } catch (e) {}
  },
  wrapTextInCloud: function(ctx, text, x, startY, lineHeight) {
    const lineConfig = [
      { limit: 6, offset: 0 },
      { limit: 6, offset: 0 },
      { limit: 9, offset: 0 },
      { limit: 9, offset: 0 },
      { limit: 10, offset: 0 },
      { limit: 6, offset: 0 }
    ];
    const chars = text.split('');
    let charIndex = 0;
    const fontSize = parseInt(ctx.font, 10);
    for (let i = 0; i < lineConfig.length; i++) {
      if (charIndex >= chars.length) break;
      const config = lineConfig[i];
      const limit = config.limit;
      let lineStr = '';
      for (let j = 0; j < limit; j++) {
        if (charIndex < chars.length) {
          lineStr += chars[charIndex];
          charIndex++;
        }
      }
      const xOffset = config.offset * fontSize;
      ctx.fillText(lineStr, x + xOffset, startY + (i * lineHeight));
    }
  },
  wrapText: function(ctx, text, x, y, maxWidth, lineHeight, maxHeight, center = false) {
    const chars = text.split('');
    let line = '';
    let currentY = y;
    const startY = y;
    for (let n = 0; n < chars.length; n++) {
      const testLine = line + chars[n];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        if (center) ctx.fillText(line, x, currentY);
        else ctx.fillText(line, x, currentY);
        line = chars[n];
        currentY += lineHeight;
        if (maxHeight && (currentY - startY > maxHeight)) break;
      } else {
        line = testLine;
      }
    }
    if (center) ctx.fillText(line, x, currentY);
    else ctx.fillText(line, x, currentY);
    return currentY + lineHeight;
  },
  computeWrappedLines: function(ctx, text, maxWidth) {
    const chars = text.split('');
    let line = '';
    const lines = [];
    for (let n = 0; n < chars.length; n++) {
      const ch = chars[n];
      if (ch === '\n') {
        if (line) lines.push(line);
        line = '';
        continue;
      }
      const testLine = line + ch;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxWidth && line.length > 0) {
        lines.push(line);
        line = ch;
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
    return lines;
  },
  computeWrappedLinesIndent: function(ctx, text, maxWidth, indentX) {
    const chars = text.split('');
    let line = '';
    const lines = [];
    let isFirst = true;
    for (let n = 0; n < chars.length; n++) {
      const ch = chars[n];
      if (ch === '\n') {
        if (line) lines.push(line);
        line = '';
        isFirst = false;
        continue;
      }
      const testLine = line + ch;
      const mw = isFirst ? (maxWidth - indentX) : maxWidth;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > mw && line.length > 0) {
        lines.push(line);
        line = ch;
        isFirst = false;
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
    return lines;
  },
  segmentNote: function(text, firstLen = 8, restLen = 10) {
    const arr = Array.from(String(text || '').replace(/\s+/g, ''));
    const out = [];
    if (arr.length <= firstLen) return [arr.join('')];
    out.push(arr.slice(0, firstLen).join(''));
    let idx = firstLen;
    while (idx < arr.length) {
      out.push(arr.slice(idx, idx + restLen).join(''));
      idx += restLen;
    }
    return out;
  },
  segmentNoteByPattern: function(text, pattern = [4, 6, 6, 4]) {
    const s = String(text || '');
    const arr = Array.from(s.replace(/\s+/g, '')).slice(0, 20);
    const out = [];
    let idx = 0;
    for (let i = 0; i < pattern.length && idx < arr.length; i++) {
      const len = Math.max(0, Number(pattern[i]) || 0);
      if (len <= 0) continue;
      out.push(arr.slice(idx, idx + len).join(''));
      idx += len;
    }
    return out;
  },
  drawTextFit: function(ctx, text, x, y, w, h, drawWidth, options = {}) {
    let fontSize = Math.floor(drawWidth * 0.020);
    let minFont = Math.floor(drawWidth * 0.014);
    ctx.textAlign = 'left';
    const indentChars = options.indentChars || 0;
    const lineHeightFactor = options.lineHeightFactor || 1.25;
    for (let i = 0; i < 20; i++) {
      ctx.font = `${fontSize}px sans-serif`;
      const lineHeight = fontSize * lineHeightFactor;
      const indentX = indentChars > 0 ? ctx.measureText('字字').width : 0;
      const lines = this.computeWrappedLinesIndent(ctx, text, w, indentX);
      if (lines.length * lineHeight <= h) {
        for (let j = 0; j < lines.length; j++) {
          const dx = j === 0 ? indentX : 0;
          ctx.fillText(lines[j], x + dx, y + j * lineHeight);
        }
        return;
      }
      fontSize = Math.max(minFont, Math.floor(fontSize * 0.95));
      if (fontSize === minFont) break;
    }
    ctx.font = `${minFont}px sans-serif`;
    const lh = minFont * lineHeightFactor;
    const indentX = indentChars > 0 ? ctx.measureText('字字').width : 0;
    const lines = this.computeWrappedLinesIndent(ctx, text, w, indentX);
    const maxLines = Math.max(1, Math.floor(h / lh));
    for (let j = 0; j < maxLines; j++) {
      if (lines[j]) {
        const dx = j === 0 ? indentX : 0;
        ctx.fillText(lines[j], x + dx, y + j * lh);
      }
    }
  }
})
