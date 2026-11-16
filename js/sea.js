/* ============================================================
   水：首屏的海、页脚的海、还有一路跟着页面往下漂的那只小船
   纯 Canvas 2D，没有用任何外部库。全部从头写。

   画法：每片海是一张字符格子。每一帧——
     1. 水：一张低分辨率高度场做真正的波动模拟，再按坡度挑字符（最暗的一层）
     2. 雨：字符竖着落，落到水面就在高度场里砸一下（稍亮，很稀）
     3. 船：几个三角面的立体折纸，自己做光栅化；纸面是实心白格子，
            暗面用蓝色小字符，折缝是那件作品的颜色（最亮的一层）
     4. 海的边缘：白纸和蓝色之间用规则的网点一格一格过渡，边界跟着水波起伏
     5. 页脚的海里有一行大字，是水面上的白格子拼成的，水一动字也跟着晃
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 可以调的手感 ---------- */
  var T = {
    WAVE_C: 0.24,      // 波速（<0.5）
    WAVE_DAMP: 0.994,  // 波的衰减，越接近 1 涟漪留得越久
    SEA_GAIN: 3.2,     // 水面字符对波动的敏感度（太吵就调小）
    SEA_T: 0.08,       // 平静 / 波峰 的分界
    SEA_CALM: 0.10,    // 平静水面的亮度（越小水越退后）
    SEA_CREST: 0.72,   // 波峰最亮能到多少
    EDGE_ROWS: 9,      // 海的上沿用几行（的两倍）从白过渡到蓝
    SHORE_AMP: 5,      // 海岸线自己弯曲、慢慢涨落的幅度（行）。0 = 笔直的线
    RAIN_LIGHT: 0.55,  // 雨的亮度
    RAIN_AMP: 0.30,    // 雨点砸水的力度
    STIR_AMP: 0.60,    // 鼠标划水的力度
    BOAT_SIZE: 1.2,    // 船的大小
    BOAT_PUSH: 300,    // 水坡推船的力
    BOAT_HOME: 0.25,   // 船慢慢漂回原位的力
    UNFOLD_SEC: 1.15,  // 摊开动画时长
    TEXT_WOBBLE: 18,   // 页脚水里的字跟着水晃的幅度
    GUIDE_SIZE: 0.95,  // 跟着页面往下漂的小船，相对海里的船的大小
    GUIDE_Y: 0.6       // 小船停在屏幕高度的什么位置
  };

  var MONO = '"Site Mono","Cascadia Mono",Consolas,"SF Mono",Menlo,monospace';
  var SERIF = '"Display Serif","Times New Roman",Times,serif';
  var BLUE = '#002FA7';
  var WORKS = window.WORKS || [];
  var SITE = window.SITE;
  var reduce = SITE.reduce;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(q) { q = clamp(q, 0, 1); return q * q * (3 - 2 * q); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* ---------- 字符表 ---------- */
  var GLYPHS = ' .·:-~=+*#%@0123456789/\\|<>x';
  var GI = {};
  for (var gi0 = 0; gi0 < GLYPHS.length; gi0++) GI[GLYPHS.charAt(gi0)] = gi0;
  var DIG0 = GI['0'];
  var G_DOT = GI['.'], G_MID = GI['·'], G_COL = GI[':'], G_DASH = GI['-'], G_TIL = GI['~'],
      G_EQ = GI['='], G_PLUS = GI['+'], G_HASH = GI['#'];
  var EDGE_RAMP = [GI[':'], GI['+'], GI['#']];          // 船的边缘：没盖满一格的地方
  var RAIN_SYM = [GI['+'], GI['/'], GI['<'], GI['>'], GI['|'], GI['x']];
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  /* ---------- 折纸的形状 ---------- */
  // 船自己坐标系里的 11 个点（x 沿船长，y 向上，z 沿船宽）
  var BV = [
    17, 7.0, 0,     // 0 船头尖
   -17, 7.0, 0,     // 1 船尾尖
    9, 0, 0,        // 2 龙骨前
   -9, 0, 0,        // 3 龙骨后
    0, 4.2, 3.7,    // 4 近侧船舷
    0, 4.2, -3.7,   // 5 远侧船舷
    0, 14, 0,       // 6 中间的尖顶
    7, 3.0, 0,      // 7
   -7, 3.0, 0,      // 8
    0, 3.0, 1.7,    // 9
    0, 3.0, -1.7    // 10
  ];
  var BT = [1,3,4, 3,2,4, 2,0,4,   1,3,5, 3,2,5, 2,0,5,   6,7,9,  6,9,8,  6,8,10,  6,10,7];
  var BG = [0,0,0, 1,1,1, 2, 3, 4, 5];           // 每个三角面属于哪一"片纸"，片与片之间就是折缝
  var APEX = 14;
  // 摊开的那张纸：3x3 个点，8 个三角面，折痕是十字加对角
  var ST = [0,1,4, 0,4,3,  1,2,4, 2,5,4,  3,4,6, 4,7,6,  4,5,8, 4,8,7];
  var SG = [0, 1, 2, 3, 4, 5, 6, 7];
  var SSH = [246, 214, 226, 250, 236, 208, 248, 220];

  /* ============================================================
     光栅化：把立体的三角面落到字符格子里（每格 2x3 个采样点）
     ============================================================ */
  function makeRaster() {
    var cols = 0, rows = 0, SW = 0, SH = 0, sDepth, sId, sShade;
    var vx = new Float32Array(16), vy = new Float32Array(16), vz = new Float32Array(16);
    var px = new Float32Array(16), py = new Float32Array(16), pd = new Float32Array(16);
    var boxes = [], originRow = 0, rpu = 1, rpuY = 1;

    function tri(x0, y0, d0, x1, y1, d1, x2, y2, d2, id, shade) {
      var area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (area > -1e-6 && area < 1e-6) return;
      var minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
      var maxX = Math.min(SW - 1, Math.ceil(Math.max(x0, x1, x2)));
      var minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
      var maxY = Math.min(SH - 1, Math.ceil(Math.max(y0, y1, y2)));
      var inv = 1 / area, i, j, sx, sy, w0, w1, w2, d, k;
      for (j = minY; j <= maxY; j++) {
        sy = j + 0.5;
        for (i = minX; i <= maxX; i++) {
          sx = i + 0.5;
          w0 = ((x1 - sx) * (y2 - sy) - (x2 - sx) * (y1 - sy)) * inv;
          if (w0 < 0) continue;
          w1 = ((x2 - sx) * (y0 - sy) - (x0 - sx) * (y2 - sy)) * inv;
          if (w1 < 0) continue;
          w2 = 1 - w0 - w1;
          if (w2 < 0) continue;
          d = w0 * d0 + w1 * d1 + w2 * d2; k = j * SW + i;
          if (d > sDepth[k]) { sDepth[k] = d; sId[k] = id; sShade[k] = shade; }
        }
      }
    }

    var R = {
      vx: vx, vy: vy, vz: vz,
      resize: function (c, r) {
        cols = c; rows = r; SW = c * 2; SH = r * 3;
        sDepth = new Float32Array(SW * SH); sId = new Int16Array(SW * SH); sShade = new Uint8Array(SW * SH);
      },
      // 水面 z=0 落在第几行；往远近走一个单位是几行；往上走一个单位是几行（不写就和前一个一样 = 45° 俯视）
      setProj: function (o, k, kUp) { originRow = o; rpu = k; rpuY = kUp || k; },
      clear: function () { sId.fill(0); sDepth.fill(-1e9); boxes.length = 0; },
      // 已经填好 vx/vy/vz 的网格 → 采样缓冲
      mesh: function (nVerts, tris, groups, meshIdx, bias, fixedShade) {
        var t, a, b, c, ux, uy, uz, wx, wy, wz, nx, ny, nz, len, l, shade, i;
        var minC = 1e9, maxC = -1e9, minR = 1e9, maxR = -1e9;
        for (i = 0; i < nVerts; i++) {
          px[i] = vx[i] * 2;
          py[i] = (originRow + vz[i] * rpu - vy[i] * rpuY) * 3;
          pd[i] = vy[i] + vz[i] + bias;                        // 越大越靠近我们
          if (px[i] < minC) minC = px[i];
          if (px[i] > maxC) maxC = px[i];
          if (py[i] < minR) minR = py[i];
          if (py[i] > maxR) maxR = py[i];
        }
        for (t = 0; t < tris.length / 3; t++) {
          a = tris[t * 3]; b = tris[t * 3 + 1]; c = tris[t * 3 + 2];
          if (fixedShade) shade = fixedShade[t];
          else {
            ux = vx[b] - vx[a]; uy = vy[b] - vy[a]; uz = vz[b] - vz[a];
            wx = vx[c] - vx[a]; wy = vy[c] - vy[a]; wz = vz[c] - vz[a];
            nx = uy * wz - uz * wy; ny = uz * wx - ux * wz; nz = ux * wy - uy * wx;
            len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= len; ny /= len; nz /= len;
            if (ny * 0.7071 + nz * 0.7071 < 0) { nx = -nx; ny = -ny; nz = -nz; }   // 朝向我们的那一面
            l = nx * -0.45 + ny * 0.75 + nz * 0.48;                                 // 光从左上方来
            shade = (0.42 + 0.58 * Math.max(0, l)) * 255;
          }
          tri(px[a], py[a], pd[a], px[b], py[b], pd[b], px[c], py[c], pd[c],
              (meshIdx + 1) * 16 + groups[t], shade | 0);
        }
        boxes.push(Math.max(0, Math.floor(minC / 2)), Math.min(cols - 1, Math.floor(maxC / 2)),
                   Math.max(0, Math.floor(minR / 3)), Math.min(rows - 1, Math.floor(maxR / 3)));
      },
      // 一只船
      boat: function (x, y, z, yaw, tx, tz, sc, meshIdx) {
        var cs = Math.cos(yaw), sn = Math.sin(yaw), v, lx, ly, lz, dx, dz;
        for (v = 0; v < 11; v++) {
          lx = BV[v * 3] * sc; ly = BV[v * 3 + 1] * sc; lz = BV[v * 3 + 2] * sc;
          dx = lx * cs - lz * sn; dz = lx * sn + lz * cs;
          vx[v] = x + dx; vz[v] = z + dz;
          vy[v] = y - 0.6 * sc + ly + tx * dx + tz * dz;     // 船身跟着水面的坡歪一点
        }
        R.mesh(11, BT, BG, meshIdx, 0, null);
      },
      // 采样 → 格子。fn(行, 列, 盖住了几个采样点(1~6), 是不是折缝, 平均明暗, 第几个网格)
      resolve: function (fn) {
        var q, c0, c1, r0, r1, r, c, i, j, k, id, n, sum, first, crease, best, bestId;
        for (q = 0; q < boxes.length; q += 4) {
          c0 = boxes[q]; c1 = boxes[q + 1]; r0 = boxes[q + 2]; r1 = boxes[q + 3];
          for (r = r0; r <= r1; r++) for (c = c0; c <= c1; c++) {
            n = 0; sum = 0; first = 0; crease = false; best = -1e9; bestId = 0;
            for (j = 0; j < 3; j++) for (i = 0; i < 2; i++) {
              k = (r * 3 + j) * SW + c * 2 + i; id = sId[k];
              if (!id) continue;
              n++; sum += sShade[k];
              if (!first) first = id;
              else if (id !== first && (id >> 4) === (first >> 4)) crease = true;
              if (sDepth[k] > best) { best = sDepth[k]; bestId = id; }
            }
            if (n) fn(r, c, n, crease, sum / n, (bestId >> 4) - 1);
          }
        }
      }
    };
    return R;
  }

  /* ============================================================
     一片海
     cfg: root, canvas,
          colors[]      折缝用的颜色（第 i 只船用 colors[i % 长度]）
          nBoats        几只船
          works         true = 船代表作品：按网格排开、悬停出名字、点击摊开
          seaTop(viewRows, rect, chC, EDGE) → 水面从第几行开始
          bottomFade    true = 底部再化回白色
          rainDens      雨的密度
          text[]        水里的大字（可选）
          firstHidden   true = 第一只船先藏着，等 arrive() 再出现
     ============================================================ */
  function createSea(cfg) {
    var root = cfg.root, canvas = cfg.canvas, ctx = canvas.getContext('2d');
    var R = makeRaster();
    var EDGE = T.EDGE_ROWS, AMP = T.SHORE_AMP, MARGIN = EDGE + Math.ceil(AMP);
    var shoreT = null, shoreB = null;              // 每一列的海岸线这一刻往上 / 往下偏了几行

    var COLORS = ['#FFFFFF'].concat(cfg.colors);
    var BLUE_I = COLORS.length; COLORS.push(BLUE);

    var W = 0, H = 0, VH = 0, dpr = 1, fontPx = 10;
    var cwD = 6, chD = 10, cwC = 6, chC = 10;      // 一格的设备像素 / CSS 像素
    var cols = 0, rows = 0, viewRows = 0, N = 0;
    var seaTopRow = 0, trStart = 0, TR = 1;        // 水面起始行；底部蓝转白从哪一行开始、共几行
    var rowsPerUnit = 1, zPerRow = 1;              // 世界单位 = 一格的宽
    var NX = 0, NZ = 0, cur, prev, edge;           // 高度场
    var cg, ca, cc, cbg, isBlue, owner, cellRand, cellBase, cellDigit, mask = null;
    var atlas = null, S = 1, zFar = 0, zNear = 0;
    var boats = [], drops = [], meshColor = [];
    var ready = false, M = null;

    var mx = -1, my = -1, pmx = -1, pmy = -1;
    var hovered = -1, labelFor = -1, touchArmed = -1, lastPointerType = 'mouse';
    var unfold = null, sheetOpen = false;

    /* ---------- 布局 ---------- */
    function layout() {
      var rect = root.getBoundingClientRect();
      W = Math.max(320, rect.width); H = Math.max(320, rect.height);
      VH = Math.min(H, window.innerHeight || H);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      fontPx = clamp(W / 175, 8, 12);

      var m = document.createElement('canvas').getContext('2d');
      m.font = (fontPx * dpr) + 'px ' + MONO;
      var adv = m.measureText('0').width || fontPx * dpr * 0.6;
      cwD = Math.max(4, Math.round(adv));
      chD = Math.max(6, Math.round(fontPx * dpr));
      cwC = cwD / dpr; chC = chD / dpr;

      cols = Math.ceil(W / cwC); rows = Math.ceil(H / chC); N = cols * rows;
      viewRows = Math.min(rows, Math.round(VH / chC));
      canvas.width = cols * cwD; canvas.height = rows * chD;
      canvas.style.width = (cols * cwC) + 'px';
      canvas.style.height = (rows * chC) + 'px';

      seaTopRow = clamp(cfg.seaTop(viewRows, rect, chC, MARGIN), MARGIN, rows - 12);
      shoreT = new Float32Array(cols); shoreB = new Float32Array(cols);
      if (cfg.bottomFade) { trStart = Math.max(seaTopRow + MARGIN + 6, Math.min(viewRows - 1, rows - 6)); TR = Math.max(1, rows - trStart); }
      else { trStart = rows; TR = 1; }
      rowsPerUnit = 0.7071 * cwC / chC;   // 45° 俯视：屏幕纵向 = 0.7071 * (z - y)
      zPerRow = 1 / rowsPerUnit;

      NX = cols; NZ = Math.ceil((rows - seaTopRow) * zPerRow) + 4;
      cur = new Float32Array(NX * NZ); prev = new Float32Array(NX * NZ); edge = new Float32Array(NX * NZ);
      for (var z = 0; z < NZ; z++) for (var x = 0; x < NX; x++) {
        var d = Math.min(x, NX - 1 - x, z, NZ - 1 - z);
        edge[z * NX + x] = d >= 8 ? 1 : 0.86 + 0.14 * (d / 8);   // 边上吸收，免得回波乱弹
      }

      cg = new Uint8Array(N); ca = new Float32Array(N); cc = new Uint8Array(N); cbg = new Uint8Array(N);
      isBlue = new Uint8Array(N); owner = new Int8Array(N); cellRand = new Float32Array(N);
      cellBase = new Uint8Array(N); cellDigit = new Uint8Array(N);
      for (var i = 0; i < N; i++) { cellRand[i] = Math.random(); rollCell(i); }

      R.resize(cols, rows); R.setProj(seaTopRow, rowsPerUnit);

      S = clamp(cols / 290, 0.5, 1.1) * T.BOAT_SIZE;
      zFar = 16 * S + MARGIN * zPerRow;
      zNear = Math.max(zFar + 2, (trStart - seaTopRow - (cfg.bottomFade ? AMP * 1.4 : 0)) * zPerRow - 7 * S);

      var hint = root.querySelector('.hint');
      if (hint) hint.style.top = Math.round(Math.min(trStart, viewRows) * chC - 52) + 'px';

      M = { cwD: cwD, chD: chD, cwC: cwC, chC: chC, dpr: dpr, fontPx: fontPx, rpu: rowsPerUnit, S: S };
      buildAtlas(); buildMask(); initBoats(); initRain();
      hovered = -1; setLabel(-1);
      ready = true;
    }

    function rollCell(i) {
      var r = Math.random();
      cellDigit[i] = DIG0 + ((Math.random() * 10) | 0);
      cellBase[i] = r < 0.22 ? 0 : r < 0.58 ? G_DOT : r < 0.74 ? G_MID : r < 0.82 ? G_DASH :
                    r < 0.87 ? G_TIL : r < 0.91 ? G_COL : cellDigit[i];
    }

    function buildAtlas() {
      atlas = document.createElement('canvas');
      atlas.width = GLYPHS.length * cwD; atlas.height = COLORS.length * chD;
      var a = atlas.getContext('2d');
      a.font = (fontPx * dpr) + 'px ' + MONO;
      a.textAlign = 'center'; a.textBaseline = 'middle';
      for (var c = 0; c < COLORS.length; c++) {
        a.fillStyle = COLORS[c];
        for (var g = 1; g < GLYPHS.length; g++) {
          a.save();
          a.beginPath(); a.rect(g * cwD, c * chD, cwD, chD); a.clip();
          a.fillText(GLYPHS.charAt(g), g * cwD + cwD / 2, c * chD + chD / 2 + chD * 0.04);
          a.restore();
        }
      }
    }

    // 水里的大字：先用衬线字体画成一张"每格一个像素"的小图，当作哪些格子该变白的模板
    function buildMask() {
      mask = null;
      if (!cfg.text || !cfg.text.length) return;
      var oc = document.createElement('canvas'); oc.width = cols; oc.height = rows;
      var o = oc.getContext('2d');
      o.scale(1 / cwC, 1 / chC);
      var fs = 100, maxw = 1, i;
      o.font = fs + 'px ' + SERIF;
      for (i = 0; i < cfg.text.length; i++) maxw = Math.max(maxw, o.measureText(cfg.text[i]).width);
      var top = (seaTopRow + MARGIN + 3) * chC, room = H - top - 70;
      fs = Math.min(fs * (W * 0.9) / maxw, room / (cfg.text.length * 0.9));
      o.font = fs + 'px ' + SERIF; o.fillStyle = '#000'; o.textBaseline = 'alphabetic';
      var y0 = top + (room - cfg.text.length * fs * 0.86) / 2 + fs * 0.76;
      for (i = 0; i < cfg.text.length; i++) o.fillText(cfg.text[i], W * 0.04, y0 + i * fs * 0.86);
      var data = o.getImageData(0, 0, cols, rows).data;
      mask = new Uint8Array(N);
      for (i = 0; i < N; i++) mask[i] = data[i * 4 + 3];
    }

    /* ---------- 水：高度场波动模拟 ---------- */
    function simStep() {
      var x, z, i, n, t;
      for (z = 1; z < NZ - 1; z++) {
        i = z * NX + 1;
        for (x = 1; x < NX - 1; x++, i++) {
          n = 2 * cur[i] - prev[i] + T.WAVE_C * (cur[i - 1] + cur[i + 1] + cur[i - NX] + cur[i + NX] - 4 * cur[i]);
          prev[i] = n * T.WAVE_DAMP * edge[i];
        }
      }
      t = cur; cur = prev; prev = t;
    }
    function impulse(x, z, amp, rad) {
      var Rr = Math.ceil(rad * 2), xi = Math.round(x), zi = Math.round(z), dx, dz, qx, qz;
      for (dz = -Rr; dz <= Rr; dz++) {
        qz = zi + dz; if (qz < 1 || qz > NZ - 2) continue;
        for (dx = -Rr; dx <= Rr; dx++) {
          qx = xi + dx; if (qx < 1 || qx > NX - 2) continue;
          cur[qz * NX + qx] += amp * Math.exp(-(dx * dx + dz * dz) / (rad * rad));
        }
      }
    }
    function sampleH(x, z) {
      var xi = clamp(Math.round(x), 1, NX - 2), zi = clamp(Math.round(z), 1, NZ - 2);
      return cur[zi * NX + xi];
    }

    function renderSea() {
      var r, c, i, z, zi, fz, o0, h, gz, gx, s, t, xl, xr, k, q, pT, pW, inTR, base, thr, mc, mr, m, topZone, botZone;
      var rStart = seaTopRow - EDGE, rFull = seaTopRow + EDGE;
      var r0 = Math.max(0, rStart - Math.ceil(AMP)), TRe = Math.max(4, TR - AMP * 1.4 - 1);
      var tt = performance.now() / 1000;
      k = (N * 0.003) | 0;                       // 平静处的字符慢慢换
      while (k-- > 0) rollCell((Math.random() * N) | 0);

      // 海岸线不是直的：几道很慢的长波叠在一起，让它弯着，并且一直在缓缓涨落
      for (c = 0; c < cols; c++) {
        shoreT[c] = AMP * (0.5 * Math.sin(c * 0.045 + tt * 0.35) + 0.3 * Math.sin(c * 0.11 - tt * 0.5) + 0.2 * Math.sin(c * 0.023 + tt * 0.17));
        shoreB[c] = AMP * 1.4 * (0.5 * Math.sin(c * 0.038 - tt * 0.3 + 2) + 0.3 * Math.sin(c * 0.09 + tt * 0.45 + 1) + 0.2 * Math.sin(c * 0.02 - tt * 0.13));
      }

      for (r = r0; r < rows; r++) {
        z = (r + 0.5 - seaTopRow) * zPerRow; zi = z | 0; fz = z - zi;
        if (zi < 1) { zi = 1; fz = 0; }
        if (zi > NZ - 3) { zi = NZ - 3; fz = 0; }
        o0 = zi * NX;
        topZone = r < rFull + AMP + 1;
        botZone = cfg.bottomFade && r >= trStart - AMP * 1.4 - 1;
        pT = 9; inTR = false; pW = 0; q = 0;
        for (c = 0; c < cols; c++) {
          i = r * cols + c;
          xl = c > 0 ? c - 1 : 0; xr = c < NX - 1 ? c + 1 : NX - 1;
          h = cur[o0 + c]; h += (cur[o0 + NX + c] - h) * fz;
          thr = (BAYER[(r & 3) * 4 + (c & 3)] + 0.5) / 16;
          if (topZone) pT = smooth((r + shoreT[c] - rStart + 0.5) / (2 * EDGE)) * 1.1;      // 上沿：白 → 蓝
          if (botZone) {                                                                     // 下沿：蓝 → 白
            q = (r + shoreB[c] - trStart + 0.5) / TRe;
            inTR = q > 0; pW = inTR ? smooth(q) * 1.1 : 0;
          }

          // 规则网点决定这一格是蓝还是白；加上水的高度，边界就会跟着波起伏
          if (thr >= pT + h * 0.9 || (inTR && (q > 0.94 || thr < pW + h * 0.9))) {
            base = cellBase[i];
            if (base >= DIG0 && base < DIG0 + 10) { cg[i] = base; cc[i] = BLUE_I; ca[i] = inTR ? 0.75 * Math.max(0, 1 - q) : 0.2 + 0.6 * Math.min(1, pT); }
            continue;
          }
          isBlue[i] = 1;

          gz = (cur[o0 + 2 * NX + c] - cur[o0 - NX + c]) / 3;
          gx = (cur[o0 + xr] - cur[o0 + xl]) * 0.5;

          if (mask) {                              // 水里的大字，跟着水面的坡度晃
            mc = c + ((gx * T.TEXT_WOBBLE) | 0); mr = r + ((gz * T.TEXT_WOBBLE) | 0);
            if (mc >= 0 && mc < cols && mr >= 0 && mr < rows) {
              m = mask[mr * cols + mc];
              if (m > 128) { cbg[i] = 1; continue; }
              if (m > 40) { cg[i] = G_PLUS; cc[i] = 0; ca[i] = 0.9; continue; }
            }
          }

          s = (h * 0.8 - gz * 3 - gx * 0.8) * T.SEA_GAIN;
          if (s > T.SEA_T) {                       // 朝着我们的坡、波峰：亮一点
            t = Math.min(1, (s - T.SEA_T) / 0.9);
            cg[i] = t < 0.16 ? G_DASH : t < 0.32 ? G_TIL : t < 0.48 ? G_EQ : t < 0.66 ? G_PLUS :
                    t < 0.88 ? cellDigit[i] : G_HASH;
            ca[i] = T.SEA_CALM + 0.12 + (T.SEA_CREST - T.SEA_CALM - 0.12) * t; cc[i] = 0;
          } else if (s < -T.SEA_T) {               // 背着我们的坡、波谷：暗下去
            t = Math.min(1, (-s - T.SEA_T) / 0.5);
            if (t < 0.35) { cg[i] = G_DOT; ca[i] = T.SEA_CALM * 0.8; cc[i] = 0; }
          } else if (cellBase[i]) {                // 平静：一片很安静的碎字符
            base = cellBase[i];
            cg[i] = base;
            ca[i] = T.SEA_CALM + (base >= DIG0 && base < DIG0 + 10 ? 0.08 : 0) + 0.08 * cellRand[i];
            cc[i] = 0;
          }
        }
      }
    }

    /* ---------- 船 ---------- */
    function initBoats() {
      boats = [];
      var n = cfg.nBoats; if (!n) return;
      var perRow = cols > 140 ? 4 : (cols > 90 ? 3 : 2);
      var nRows = Math.ceil(n / perRow);
      var zMin = zFar + 3 * S, zMax = Math.max(zMin + 1, zNear - 3 * S);
      for (var i = 0; i < n; i++) {
        var hx, hz;
        if (cfg.works) {
          var rr = Math.floor(i / perRow), k = i % perRow, inRow = Math.min(perRow, n - rr * perRow);
          hx = cols * ((k + 0.5) / inRow) + (rr % 2 ? 1 : -1) * cols * 0.045 + (Math.random() - 0.5) * cols * 0.04;
          hz = zMin + (zMax - zMin) * (nRows > 1 ? rr / (nRows - 1) : 0.5) + (Math.random() - 0.5) * 4;
        } else {
          hx = cols * (0.55 + 0.35 * Math.random());           // 让开左边的大字
          hz = zMin + (zMax - zMin) * Math.random();
        }
        hx = clamp(hx, 20 * S, cols - 20 * S); hz = clamp(hz, zFar, zNear);
        var yaw = (Math.random() - 0.5) * 1.1;
        var hidden = !!cfg.firstHidden && i === 0;
        boats.push({ x: hx, z: hz, hx: hx, hz: hz, vx: 0, vz: 0, y: 0, yaw: yaw, yaw0: yaw, yv: 0,
                     tx: 0, tz: 0, sc: hidden ? 0 : 1, show: !hidden, hit: 0 });
        meshColor[i] = 1 + (i % cfg.colors.length);
      }
    }

    function updateBoats(dt) {
      var i, j, b, o, gx, gz, sp, dx, dz, d, minD, nx, nz, rel, push;
      var drag = Math.exp(-1.5 * dt), ydrag = Math.exp(-1.4 * dt), sm = Math.min(1, dt * 8);
      for (i = 0; i < boats.length; i++) {
        b = boats[i];
        gx = (sampleH(b.x + 4, b.z) - sampleH(b.x - 4, b.z)) / 8;
        gz = (sampleH(b.x, b.z + 4) - sampleH(b.x, b.z - 4)) / 8;
        b.vx += (-gx * T.BOAT_PUSH + (b.hx - b.x) * T.BOAT_HOME) * dt;
        b.vz += (-gz * T.BOAT_PUSH + (b.hz - b.z) * T.BOAT_HOME) * dt;
        b.vx *= drag; b.vz *= drag;
        sp = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
        if (sp > 30) { b.vx *= 30 / sp; b.vz *= 30 / sp; }
        b.x += b.vx * dt; b.z += b.vz * dt;
        if (b.x < 16 * S) { b.x = 16 * S; b.vx = Math.abs(b.vx) * 0.4; }
        if (b.x > cols - 16 * S) { b.x = cols - 16 * S; b.vx = -Math.abs(b.vx) * 0.4; }
        if (b.z < zFar) { b.z = zFar; b.vz = Math.abs(b.vz) * 0.4; }
        if (b.z > zNear) { b.z = zNear; b.vz = -Math.abs(b.vz) * 0.4; }

        b.yv += (gx * 7 + (b.yaw0 - b.yaw) * 0.35) * dt;
        b.yv *= ydrag; b.yaw += b.yv * dt;

        b.y += ((clamp(sampleH(b.x, b.z) * 4, -2, 2.5) + (hovered === i ? 2.2 : 0)) - b.y) * sm;
        b.tx += (clamp(gx * 5, -0.3, 0.3) - b.tx) * sm;
        b.tz += (clamp(gz * 5, -0.3, 0.3) - b.tz) * sm;
        b.sc += (((b.show && !(unfold && unfold.i === i)) ? 1 : 0) - b.sc) * Math.min(1, dt * 6);
        if (b.hit > 0) b.hit -= dt;
      }
      minD = 23 * S;                              // 船和船轻轻相碰
      for (i = 0; i < boats.length; i++) for (j = i + 1; j < boats.length; j++) {
        b = boats[i]; o = boats[j];
        if (b.sc < 0.5 || o.sc < 0.5) continue;
        dx = o.x - b.x; dz = o.z - b.z; d = Math.sqrt(dx * dx + dz * dz);
        if (d >= minD || d < 0.001) continue;
        nx = dx / d; nz = dz / d; push = (minD - d) * 0.5;
        b.x -= nx * push; b.z -= nz * push; o.x += nx * push; o.z += nz * push;
        rel = (o.vx - b.vx) * nx + (o.vz - b.vz) * nz;
        if (rel < 0) {
          b.vx += nx * rel * 0.75; b.vz += nz * rel * 0.75;
          o.vx -= nx * rel * 0.75; o.vz -= nz * rel * 0.75;
          b.yv += rel * 0.02; o.yv -= rel * 0.02;
          if (b.hit <= 0 && rel < -3) {
            impulse((b.x + o.x) / 2, (b.z + o.z) / 2, 0.5, 2);
            b.hit = 0.4; SITE.sfx('bump');
          }
        }
      }
    }

    function rasterBoats() {
      for (var i = 0; i < boats.length; i++) {
        var b = boats[i];
        if (b.sc < 0.06) continue;
        R.boat(b.x, b.y, b.z, b.yaw, b.tx, b.tz, S * b.sc, i);
      }
    }

    function rasterSheet() {
      var b = boats[unfold.i], e = ease(unfold.t);
      var Vh = Math.min(VH * 0.42 / cwC, cols * 0.42 / 0.68), Uh = Vh * 0.68;
      var sc = 0.06 + 0.94 * e, phi = (1 - e) * (b.yaw + 0.6);
      var tz = (viewRows * 0.5 - seaTopRow) * zPerRow;
      var cx = b.x + (cols / 2 - b.x) * e, cz = b.z + (tz - b.z) * e, cy = (b.y + 7 * S) * (1 - e);
      var cs = Math.cos(phi), sn = Math.sin(phi), u, v, a, r, k = 0;
      for (v = -1; v <= 1; v++) for (u = -1; u <= 1; u++, k++) {
        a = (u * Uh * cs - v * Vh * sn) * sc;      // 沿屏幕横向
        r = (u * Uh * sn + v * Vh * cs) * sc;      // 沿屏幕纵向（正对视线的平面里）
        R.vx[k] = cx + a; R.vy[k] = cy - r * 0.7071; R.vz[k] = cz + r * 0.7071;
      }
      meshColor[boats.length] = meshColor[unfold.i];
      R.mesh(9, ST, SG, boats.length, 1e5, SSH);
    }

    // 盖满的格子 = 实心白纸，暗面用蓝色小字符；一格里出现两片纸 = 折缝，整格填成作品的颜色；
    // 没盖满的格子 = 一个字符，让轮廓软一点
    function onCell(r, c, n, crease, shade, mesh) {
      var cell = r * cols + c, dk, g;
      owner[cell] = mesh;
      if (n >= 4) {
        if (crease) { cbg[cell] = meshColor[mesh] + 1; cg[cell] = 0; }
        else {
          cbg[cell] = 1;
          dk = 1 - shade / 255;
          g = dk < 0.12 ? 0 : dk < 0.22 ? G_DOT : dk < 0.32 ? G_COL : dk < 0.44 ? G_EQ : G_PLUS;
          if (!g && !isBlue[cell]) g = G_DOT;        // 伸到白底上的纸，至少留一层小点，不然看不见
          cg[cell] = g; cc[cell] = BLUE_I; ca[cell] = 0.85;
        }
      } else if (!cbg[cell]) {
        cg[cell] = EDGE_RAMP[n - 1]; cc[cell] = isBlue[cell] ? 0 : BLUE_I; ca[cell] = 1;
      }
    }

    /* ---------- 雨 ---------- */
    function respawn(d, first) {
      d.c = (Math.random() * cols) | 0;
      d.land = seaTopRow + ((Math.pow(Math.random(), 0.8) * (rows - seaTopRow)) | 0);
      if (d.land > rows - 1) d.land = rows - 1;
      d.y = first ? Math.random() * d.land : -Math.random() * 14;
      d.sp = 18 + Math.random() * 24;
      d.len = 3 + ((Math.random() * 5) | 0);
      d.seed = (Math.random() * 1000) | 0;
    }
    function initRain() {
      drops = [];
      if (reduce) return;
      var n = Math.floor(cols * cfg.rainDens);
      for (var i = 0; i < n; i++) { var d = {}; respawn(d, true); drops.push(d); }
    }
    function rain(dt) {
      var i, d, hr, k, r, cell, g, paper;
      for (i = 0; i < drops.length; i++) {
        d = drops[i]; d.y += d.sp * dt;
        if (d.y >= d.land) {     // 落到水面：在高度场里砸一下
          impulse(d.c, (d.land + 0.5 - seaTopRow) * zPerRow, -T.RAIN_AMP * (0.6 + Math.random() * 0.8), 1.3);
          if (d.land < trStart && Math.random() < 0.08) SITE.sfx('drop');
          respawn(d, false); continue;
        }
        hr = Math.floor(d.y);
        for (k = 0; k < d.len; k++) {
          r = hr - k; if (r < 0 || r >= rows) continue;
          cell = r * cols + d.c;
          if (owner[cell] >= 0) continue;
          paper = !isBlue[cell] || cbg[cell] === 1;       // 落在白的地方用蓝字，落在蓝的地方用白字
          g = (d.seed + r * 13) % 11 === 0 ? RAIN_SYM[(d.seed + r) % RAIN_SYM.length] : DIG0 + (d.seed + r * 7) % 10;
          cg[cell] = g; cc[cell] = paper ? BLUE_I : 0;
          ca[cell] = (k === 0 ? 1 : 0.6 * (1 - k / d.len)) * (paper ? 0.6 : T.RAIN_LIGHT);
        }
      }
    }

    /* ---------- 画到屏幕 ---------- */
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      var i, r, c, g, a, key, k2, c0, last = -1;
      // 先画实心格子（蓝色的水、白纸、折缝），同色的连续格子合成一条
      for (r = 0; r < rows; r++) {
        i = r * cols; c = 0;
        while (c < cols) {
          key = cbg[i + c] || (isBlue[i + c] ? 255 : 0);
          if (!key) { c++; continue; }
          c0 = c;
          while (c < cols) { k2 = cbg[i + c] || (isBlue[i + c] ? 255 : 0); if (k2 !== key) break; c++; }
          ctx.fillStyle = key === 255 ? BLUE : COLORS[key - 1];
          ctx.fillRect(c0 * cwD, r * chD, (c - c0) * cwD, chD);
        }
      }
      // 再画字符
      i = 0;
      for (r = 0; r < rows; r++) for (c = 0; c < cols; c++, i++) {
        g = cg[i]; if (!g) continue;
        a = ((ca[i] * 16 + 0.5) | 0) / 16; if (a <= 0) continue; if (a > 1) a = 1;
        if (a !== last) { ctx.globalAlpha = a; last = a; }
        ctx.drawImage(atlas, g * cwD, cc[i] * chD, cwD, chD, c * cwD, r * chD, cwD, chD);
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- 船旁的名字（只有代表作品的船才有） ---------- */
    var label = cfg.works ? document.getElementById('boatLabel') : null;
    var blNo = document.getElementById('blNo'), blTitle = document.getElementById('blTitle');
    var blCn = document.getElementById('blCn'), blSpecs = document.getElementById('blSpecs');

    function setLabel(i) {
      if (!label || i === labelFor) return;
      labelFor = i;
      if (i < 0) { label.classList.remove('on'); root.classList.remove('is-boat'); return; }
      var w = WORKS[i];
      blNo.textContent = '::0 /#' + SITE.pad2(i + 1) + '  ' + SITE.catOf(w).en;
      blCn.textContent = w.cn;
      blSpecs.textContent = SITE.specsOf(w) + '\n--CLICK TO UNFOLD';
      SITE.setScrambled(blTitle, w.en, 600);
      label.classList.add('on'); root.classList.add('is-boat');
      impulse(boats[i].x, boats[i].z, -0.5, 2.5);
      SITE.sfx('note', i);
    }
    function placeLabel() {
      if (!label || labelFor < 0) return;
      var b = boats[labelFor];
      var x = b.x * cwC, y = (seaTopRow + (b.z - b.y - APEX * S) * rowsPerUnit) * chC;
      var off = 20 * S * cwC, lw = label.offsetWidth, lh = label.offsetHeight;
      var lx = clamp(x > W * 0.6 ? x - off - lw : x + off, 12, W - lw - 12);
      var lo = (seaTopRow + MARGIN) * chC + 6;
      var ly = clamp(y - 6, lo, Math.max(lo, trStart * chC - lh - 12));
      label.style.transform = 'translate(' + Math.round(lx) + 'px,' + Math.round(ly) + 'px)';
    }
    function pick(x, y) {
      if (x < 0 || y < 0 || !owner) return -1;
      var c = Math.floor(x / cwC), r = Math.floor(y / chC), dr, dc, sgn, c2, r2, o;
      for (dr = 0; dr <= 1; dr++) for (dc = 0; dc <= 2; dc++) for (sgn = -1; sgn <= 1; sgn += 2) {
        c2 = c + dc * sgn; r2 = r + dr * sgn;
        if (c2 < 0 || c2 >= cols || r2 < 0 || r2 >= rows) continue;
        o = owner[r2 * cols + c2];
        if (o >= 0 && o < boats.length) return o;
      }
      return -1;
    }

    /* ---------- 鼠标 / 触摸 ---------- */
    var annoR = cfg.works ? document.getElementById('annoR') : null;
    function stir(x0, y0, x1, y1) {
      var ax = x0 / cwC, az = (y0 / chC - seaTopRow) * zPerRow;
      var bx = x1 / cwC, bz = (y1 / chC - seaTopRow) * zPerRow;
      var d = Math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
      var steps = clamp(Math.ceil(d / 2), 1, 24), amp = -clamp(0.2 + d * 0.05, 0.2, 1.2) * T.STIR_AMP, i, t, z;
      for (i = 1; i <= steps; i++) {
        t = i / steps; z = az + (bz - az) * t;
        if (z > 1 && z < NZ - 2) impulse(ax + (bx - ax) * t, z, amp, 2.2);
      }
    }
    root.addEventListener('pointermove', function (e) {
      if (!ready || sheetOpen) return;
      var rect = root.getBoundingClientRect();
      pmx = mx; pmy = my; mx = e.clientX - rect.left; my = e.clientY - rect.top;
      if (pmx >= 0) stir(pmx, pmy, mx, my);
      if (annoR) annoR.textContent = 'X:' + ('000' + Math.round(mx)).slice(-4) + ' Y:' + ('000' + Math.round(my)).slice(-4);
    });
    root.addEventListener('pointerdown', function (e) {
      lastPointerType = e.pointerType || 'mouse';
      var rect = root.getBoundingClientRect();
      mx = e.clientX - rect.left; my = e.clientY - rect.top; pmx = mx; pmy = my;
      if (ready && !sheetOpen) stir(mx, my, mx, my);
    });
    root.addEventListener('pointerleave', function () {
      if (lastPointerType === 'mouse') { mx = my = pmx = pmy = -1; }
    });
    if (cfg.works) root.addEventListener('click', function () {
      if (!ready || unfold || sheetOpen) return;
      var i = pick(mx, my);
      if (i < 0) { touchArmed = -1; return; }
      if (lastPointerType !== 'mouse' && touchArmed !== i) { touchArmed = i; return; }  // 手机：点一下出名字，再点一下进入
      touchArmed = -1;
      unfold = { i: i, t: 0, done: false };
      setLabel(-1);
      SITE.sfx('unfold');
    });

    // 作品页开 / 关时暂停 / 恢复
    SITE.onOpen(function () { sheetOpen = true; });
    SITE.onClose(function () {
      sheetOpen = false; unfold = null;
      mx = my = pmx = pmy = -1; last = performance.now();
    });

    /* ---------- 每一帧 ---------- */
    var last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      if (!ready || sheetOpen) return;
      var rect = root.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > (window.innerHeight || 0)) return;     // 不在屏幕里就不画

      simStep(); simStep();
      cg.fill(0); cbg.fill(0); isBlue.fill(0); owner.fill(-1); R.clear();

      renderSea();
      updateBoats(dt);
      rasterBoats();
      if (unfold) {
        if (!unfold.done) {
          unfold.t += dt / T.UNFOLD_SEC;
          if (unfold.t >= 1) { unfold.t = 1; unfold.done = true; }
        }
        rasterSheet();
      }
      R.resolve(onCell);
      rain(dt);

      if (cfg.works) {
        if (!unfold) {
          hovered = pick(mx, my);
          setLabel(lastPointerType === 'mouse' ? hovered : touchArmed);
        } else hovered = -1;
        placeLabel();
      }
      draw();
      if (unfold && unfold.done && !sheetOpen) SITE.openWork(unfold.i);
    }

    var rsz = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rsz); rsz = setTimeout(function () { if (!sheetOpen) layout(); }, 180);
    });

    return {
      root: root,
      start: function () { layout(); requestAnimationFrame(frame); },
      ready: function () { return ready; },
      metrics: function () { return M; },
      // 蓝色水面在屏幕上的上下范围
      blueRect: function () {
        var r = root.getBoundingClientRect();
        return { top: r.top + (seaTopRow + EDGE * 0.3) * chC,
                 bottom: cfg.bottomFade ? r.top + (trStart + TR * 0.35) * chC : r.bottom };
      },
      // 漂下来的小船进到这片海里
      arrive: function (xCss, yCss) {
        var b = boats[0]; if (!b) return;
        b.x = clamp(xCss / cwC, 16 * S, cols - 16 * S);
        b.z = clamp((yCss / chC - seaTopRow) * zPerRow, zFar, zNear);
        b.hx = b.x; b.hz = clamp(b.z + 30, zFar, zNear);       // 进来之后再往里漂一段
        b.vx = 0; b.vz = 14; b.yaw = 0.2; b.yaw0 = 0.3; b.sc = T.GUIDE_SIZE; b.show = true;
        impulse(b.x, b.z, -1.6, 4);
        SITE.sfx('splash');
      },
      depart: function () {
        var b = boats[0]; if (!b || !b.show) return;
        b.show = false; impulse(b.x, b.z, 1.2, 3.5);
      },
      // 小船从这片海的下沿出去 / 回来时，在水边溅一圈
      splash: function (xCss) {
        if (!ready) return;
        var z = (trStart - seaTopRow - 2) * zPerRow, x = xCss / cwC;
        impulse(x, z, -2.2, 4.5); impulse(x - 7, z - 6, 0.9, 3); impulse(x + 7, z - 6, 0.9, 3);
        SITE.sfx('splash');
      }
    };
  }

  /* ============================================================
     两片海
     ============================================================ */
  var heroEl = document.getElementById('hero'), footEl = document.getElementById('seaFoot');
  var hero = createSea({
    root: heroEl, canvas: document.getElementById('sea'),
    colors: WORKS.map(function (w) { return w.accent || '#FFFFFF'; }),
    nBoats: WORKS.length, works: true, bottomFade: true, rainDens: 0.14,
    seaTop: function (viewRows, rect, chC, EDGE) {
      var row = Math.round(viewRows * 0.42);
      var copy = heroEl.querySelector('.hero-copy');     // 水面要让开上面的标题
      if (copy) {
        var need = Math.ceil((copy.getBoundingClientRect().bottom - rect.top + 18) / chC) + EDGE;
        if (need > row) row = Math.min(need, Math.round(viewRows * 0.56));
      }
      return row;
    }
  });
  var foot = createSea({
    root: footEl, canvas: document.getElementById('seaFootCanvas'),
    colors: ['#8FB0FF'], nBoats: 3, works: false, bottomFade: false, rainDens: 0.1,
    firstHidden: true, text: ['More boats', 'on the way.'],
    seaTop: function (viewRows, rect, chC, EDGE) { return Math.round(viewRows * 0.14) + EDGE; }
  });
  window.__seas = [hero, foot];

  /* ============================================================
     一路跟着页面往下漂的小船：
     离开首屏的海之后出现，沿着页面左右摆着往下走，最后漂进页脚的海
     ============================================================ */
  function startGuide() {
    var cv = document.getElementById('guide');
    if (!cv || reduce) return;
    var g = cv.getContext('2d'), R = makeRaster();
    var GC = 60, GR = 30, OR = GR * 0.66, m = null;
    var kind = new Uint8Array(GC * GR), shadeOf = new Uint8Array(GC * GR);
    var lastY = window.pageYOffset || 0, vel = 0, lastT = performance.now(), phase = 0, inFoot = false, outOfHero = false;

    function setup() {
      m = hero.metrics();
      cv.width = GC * m.cwD; cv.height = GR * m.chD;
      cv.style.width = (GC * m.cwC) + 'px'; cv.style.height = (GR * m.chC) + 'px';
      // 这只船几乎是从正侧面看的（比海里的 45° 平得多），这样它有十来行字符高，
      // 能看出"两头翘的船身 + 中间一个大三角"，不会再扁成一条
      var cell = m.cwC / m.chC;
      R.resize(GC, GR); R.setProj(OR, 0.34 * cell, 0.94 * cell);
    }
    function cellText(ch, c, r, color, alpha) {
      g.globalAlpha = alpha; g.fillStyle = color;
      g.fillText(ch, c * m.cwD + m.cwD / 2, r * m.chD + m.chD / 2);
    }

    (function frame(now) {
      requestAnimationFrame(frame);
      var dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000)); lastT = now;
      if (!hero.ready() || !foot.ready()) return;
      if (m !== hero.metrics()) setup();

      var y = window.pageYOffset || 0, vw = window.innerWidth, vh = window.innerHeight, gy = vh * T.GUIDE_Y;
      vel += ((y - lastY) / dt - vel) * Math.min(1, dt * 6); lastY = y;
      var hb = hero.blueRect(), fb = foot.blueRect();
      var startY = y + hb.bottom - gy, endY = y + fb.top - gy, span = Math.max(1, endY - startY);
      var p = clamp((y - startY) / span, 0, 1), amp = vw > 900 ? 0.4 : 0.3;
      var gx = vw * (0.5 + amp * Math.sin(p * Math.PI * 3 + 0.5));

      var nowIn = gy >= fb.top;                              // 漂进页脚的海：把船交给那片海
      if (nowIn !== inFoot) {
        inFoot = nowIn;
        if (nowIn) { var fr = foot.root.getBoundingClientRect(); foot.arrive(gx - fr.left, gy - fr.top); }
        else foot.depart();
      }
      var out = gy > hb.bottom;                              // 从首屏的海里出来 / 回去：水边溅一圈
      if (out !== outOfHero) {
        outOfHero = out;
        var hr = hero.root.getBoundingClientRect();
        if (hr.bottom > 0 && hr.top < vh) hero.splash(gx - hr.left);
      }
      var vis = out && gy < fb.top && !SITE.isOpen();
      cv.style.opacity = vis ? 1 : 0;
      if (!vis) return;

      phase += dt;
      var slope = vw * amp * Math.cos(p * Math.PI * 3 + 0.5) * Math.PI * 3 / span;     // 横向 / 纵向
      // 和海里的船同一个角度（侧着看：两头尖的船身 + 中间的三角），只是顺着漂的方向稍微偏一点
      var yaw = clamp(slope * 0.7, -0.5, 0.5) + Math.sin(phase * 0.9) * 0.06;
      var GS = T.GUIDE_SIZE * m.S, mid = GC / 2, wr = Math.round(OR), c, k;

      g.clearRect(0, 0, cv.width, cv.height);
      g.font = (m.fontPx * m.dpr) + 'px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'middle';
      // 船自己带着的一小段水：几行蓝色的波纹字符，滑得越快铺得越宽
      var half = Math.min(mid - 2, 14 + Math.min(14, Math.abs(vel) / 60)), sh = Math.floor(phase * 5);
      for (k = 0; k < 3; k++) for (c = Math.ceil(mid - half); c <= mid + half; c++) {
        if ((c + sh * (k % 2 ? -1 : 1) + k * 2) % (3 + k) !== 0) continue;
        cellText(k === 0 ? '~' : k === 1 ? '-' : '·', c, wr + k, BLUE, (1 - Math.abs(c - mid) / half) * (0.85 - k * 0.22));
      }
      // 船：全部用字符拼，没有实心色块。白纸打底，上面全是蓝色字符——
      // 轮廓一圈用最密的 #，折缝用 +，纸面按明暗用 . : = 由疏到密
      var i, r2, c2, kd, dk, edgeCell;
      R.clear();
      R.boat(mid, Math.sin(phase * 1.7) * 0.5, 0, yaw, clamp(vel / 3500, -0.2, 0.2), 0, GS, 0);
      kind.fill(0);
      R.resolve(function (r, cc2, n, crease, shade) {
        kind[r * GC + cc2] = n >= 4 ? (crease ? 2 : 1) : 3;      // 1 纸面 2 折缝 3 没盖满的边缘
        shadeOf[r * GC + cc2] = shade;
      });
      for (r2 = 0; r2 < GR; r2++) for (c2 = 0; c2 < GC; c2++) {
        i = r2 * GC + c2; kd = kind[i];
        if (!kd) continue;
        if (kd === 3) { cellText(':', c2, r2, BLUE, 0.55); continue; }
        g.globalAlpha = 1; g.fillStyle = '#FFFFFF';                // 白纸打底，盖住船后面的内容
        g.fillRect(c2 * m.cwD, r2 * m.chD, m.cwD, m.chD);
        edgeCell = c2 === 0 || c2 === GC - 1 || r2 === 0 || r2 === GR - 1 ||
                   kind[i - 1] % 3 === 0 || kind[i + 1] % 3 === 0 || kind[i - GC] % 3 === 0 || kind[i + GC] % 3 === 0;
        if (edgeCell) cellText('#', c2, r2, BLUE, 1);
        else if (kd === 2) cellText('+', c2, r2, BLUE, 0.95);
        else {
          dk = 1 - shadeOf[i] / 255;
          cellText(dk < 0.14 ? '.' : dk < 0.3 ? ':' : '=', c2, r2, BLUE, dk < 0.14 ? 0.45 : 0.7);
        }
      }
      g.globalAlpha = 1;
      cv.style.transform = 'translate(' + Math.round(gx - GC * m.cwC / 2) + 'px,' + Math.round(gy - OR * m.chC) + 'px)';
    })(lastT);
  }

  /* ---------- 启动 ---------- */
  var started = false;
  function start() {
    if (started) return; started = true;
    hero.start(); foot.start(); startGuide();
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start, start);
    setTimeout(start, 1200);       // 字体文件不在也照常开始
  } else start();
})();
