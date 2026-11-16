/* ============================================================
   整页：载入、导航、声音、标题显影、分类大字、
        四种版式的作品列表、缩略图显影、作品页、放大、视频
   没有用任何外部库。
   ============================================================ */
(function () {
  'use strict';

  var WORKS = window.WORKS || [];
  var CATS = window.CATEGORIES || [];
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var SITE = window.SITE = { reduce: reduce };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function catOf(w) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === w.cat) return CATS[i];
    return { en: '', cn: '' };
  }
  function specsOf(w) {
    var lines = [];
    if (w.course) lines.push('--COURSE: ' + w.course);
    if (w.year) lines.push('--YEAR: ' + w.year);
    if (w.tags && w.tags.length) lines.push('--TAGS: ' + w.tags.join(' / '));
    return lines.join('\n');
  }
  function src(name) { return encodeURI((window.IMG_BASE || '') + name); }
  SITE.pad2 = pad2; SITE.catOf = catOf; SITE.specsOf = specsOf;

  /* ============================================================
     声音：浏览器现场合成，默认关
     · 海声：隔十几秒来一道浪，涌上来再退下去，不是一直响
     · 雨点：偶尔一粒很轻的水滴声
     · 停在船上：每只船一个五声音阶的音，划过去像拨了一串
     · 船相碰：闷闷的一声木头响
     · 摊开：一声由低到高的纸声
     所有声音都过一个低通和一点点回声，不刺耳
     ============================================================ */
  var ac = null, master = null, noiseBuf = null, bed = 0 /* 下一道浪最早什么时候来 */, soundOn = false, lastAt = {};
  var GAP = { drop: 0.25, scr: 0.08, bump: 0.15, click: 0.05, note: 0.1, unfold: 0.3 };
  var PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

  function initAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9;
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
    var dl = ac.createDelay(0.5); dl.delayTime.value = 0.21;
    var fb = ac.createGain(); fb.gain.value = 0.24;
    var wet = ac.createGain(); wet.gain.value = 0.22;
    master.connect(lp); lp.connect(ac.destination);
    lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function env(g, t, v, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(f, dur, v, type, f2, attack) {
    var t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, v, attack || 0.006, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, v, ftype, freq, q, f2, attack) {
    var t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = ftype; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, v, attack || 0.004, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 1.5, dur + 0.05);
  }
  // 海声：一道浪慢慢涌上来再退下去，大约五秒；不是一直响，隔一阵才来一道
  function wash(vol) {
    var t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = 'lowpass'; f.Q.value = 0.4;
    f.frequency.setValueAtTime(260, t);
    f.frequency.linearRampToValueAtTime(950, t + 1.7);
    f.frequency.linearRampToValueAtTime(320, t + 5.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 1.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5.4);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random()); s.stop(t + 5.6);
  }
  function seaOnScreen() {
    var seas = window.__seas || [], vh = window.innerHeight, i, r;
    for (i = 0; i < seas.length; i++) {
      if (!seas[i].ready()) continue;
      r = seas[i].blueRect();
      if (r.bottom > 0 && r.top < vh) return true;
    }
    return false;
  }
  setInterval(function () {            // 只有开着声音、而且屏幕上看得到海的时候才来浪
    if (!soundOn || !ac || ac.currentTime < bed) return;
    if (!seaOnScreen()) return;
    try { wash(0.03 + Math.random() * 0.015); } catch (e) {}
    bed = ac.currentTime + 10 + Math.random() * 9;
  }, 1000);
  SITE.sfx = function (name, arg) {
    if (!soundOn || !ac) return;
    var now = ac.currentTime;
    if (lastAt[name] != null && now - lastAt[name] < (GAP[name] || 0.05)) return;
    lastAt[name] = now;
    try {
      if (name === 'drop') {
        noise(0.04, 0.014, 'bandpass', 1800 + Math.random() * 2200, 7);
        tone(800 + Math.random() * 700, 0.08, 0.006, 'sine', 500);
      } else if (name === 'splash') {
        noise(0.9, 0.05, 'bandpass', 700, 0.7, 2600, 0.03);
        tone(300, 0.25, 0.04, 'sine', 150);
      } else if (name === 'note') {
        var f = 220 * Math.pow(2, PENTA[(arg || 0) % PENTA.length] / 12);
        tone(f, 1.1, 0.05, 'sine', 0, 0.012);
        tone(f * 2, 0.6, 0.012, 'sine', 0, 0.012);
      } else if (name === 'bump') {
        tone(330, 0.18, 0.08, 'sine', 165);
        noise(0.03, 0.025, 'lowpass', 900, 1);
      } else if (name === 'unfold') {
        noise(0.55, 0.045, 'bandpass', 500, 0.9, 3600, 0.12);
        tone(330, 0.5, 0.02, 'triangle', 660, 0.05);
      } else if (name === 'click') {
        noise(0.05, 0.035, 'highpass', 3000, 0.7);
        tone(520, 0.1, 0.025, 'triangle');
      } else {
        noise(0.014, 0.008, 'highpass', 6000, 0.7);
      }
    } catch (e) {}
  };
  var soundBtn = $('soundBtn');
  if (soundBtn) soundBtn.addEventListener('click', function () {
    soundOn = !soundOn;
    if (soundOn && !ac && !initAudio()) soundOn = false;
    if (ac && soundOn && ac.resume) ac.resume();
    if (ac && soundOn) bed = ac.currentTime + 0.6;      // 打开声音后先来一道浪
    soundBtn.textContent = 'SOUND: ' + (soundOn ? 'ON' : 'OFF');
    SITE.sfx('click');
  });

  /* ============================================================
     标题显影：
     每个大字母的位置上先浮出一小团极细的等宽字符，像一道波从左扫到右；
     波到了，那团小字符散掉，字母本身淡入。字母一直占着自己的位置，版面不动。
     ============================================================ */
  var TINY = '01.:+-=#/\\';
  var GBASE = 12;                       // 小字符先按 12px 排，再整体缩小（避开浏览器的最小字号限制）
  function prep(node0) {
    var letters = [];
    (function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      kids.forEach(function (k) {
        if (k.nodeType === 3) {
          var frag = document.createDocumentFragment();
          k.nodeValue.split(/(\s+)/).forEach(function (tok) {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(el('span', 'sp', ' ')); return; }
            var w = el('span', 'w');
            for (var i = 0; i < tok.length; i++) {
              var l = el('span', 'l', tok.charAt(i));
              w.appendChild(l); letters.push(l);
            }
            frag.appendChild(w);
          });
          node.replaceChild(frag, k);
        } else if (k.nodeType === 1) walk(k);
      });
    })(node0);
    return letters;
  }
  function tinyText(cols, rows, dens) {
    var s = '', r, c;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) s += Math.random() < dens ? TINY.charAt((Math.random() * TINY.length) | 0) : ' ';
      s += '\n';
    }
    return s;
  }
  function scramble(node, letters, dur) {
    var tok = (node._tok = (node._tok || 0) + 1), n = letters.length;
    if (reduce || !n) return;
    var cs = getComputedStyle(node), fs = parseFloat(cs.fontSize) || 16, col = cs.color;
    var gs = Math.max(2.4, fs * 0.1), sc = gs / GBASE;
    var rowsN = Math.max(2, Math.ceil(fs * 1.02 / gs));
    var widths = letters.map(function (l) { return l.getBoundingClientRect().width; });
    letters.forEach(function (l, i) {
      var g = el('i', 'g');
      g.style.color = col;
      g.style.transform = 'scale(' + sc + ')';
      g._cols = Math.max(1, Math.round(widths[i] / sc / (GBASE * 0.6)));
      l.classList.add('pend'); l.classList.remove('rev');
      l.appendChild(g); l._g = g;
    });
    var win = dur * 0.32, fadeT = dur * 0.2, span = Math.max(1, dur - win - fadeT);
    var t0 = performance.now(), lastUp = -100;
    (function step(now) {
      if (node._tok !== tok) return;
      var t = now - t0, up = now - lastUp > 45, i, l, g, s, d;
      if (up) lastUp = now;
      for (i = 0; i < n; i++) {
        l = letters[i]; g = l._g; if (!g) continue;
        s = win + (n > 1 ? i / (n - 1) : 0) * span;
        if (t < s) d = Math.max(0, 1 - (s - t) / win) * 0.85;          // 波还没到：小字符越聚越密
        else {
          if (l.classList.contains('pend')) { l.classList.remove('pend'); l.classList.add('rev'); }
          d = 0.85 * (1 - (t - s) / fadeT);                             // 波到了：字母淡入，小字符散掉
          if (d <= 0) { l.removeChild(g); l._g = null; continue; }
        }
        if (up) g.textContent = d > 0.02 ? tinyText(g._cols, rowsN, d) : '';
      }
      if (up) SITE.sfx('scr');
      if (t < dur + 60) requestAnimationFrame(step);
      else letters.forEach(function (x) {
        x.classList.remove('pend');
        if (x._g) { x.removeChild(x._g); x._g = null; }
      });
    })(t0);
  }
  function setScrambled(node, text, dur) { node.textContent = text; scramble(node, prep(node), dur); }
  SITE.setScrambled = setScrambled;

  /* ============================================================
     缩略图：滑进屏幕时先是一片静止的蓝色字符，然后淡成图片（只做一次）
     ============================================================ */
  var DCH = '01#%=+*:;.-xnz';
  function decode(th) {
    if (th._seen) return;
    th._seen = true;
    var pre = th.querySelector('pre'), m = th.querySelector('.m');
    if (reduce) { th.classList.add('done'); return; }
    // 只写一次字符（不再一帧一帧刷新），剩下的淡入淡出交给 CSS，几乎不占电脑
    var cols = Math.max(10, Math.min(40, Math.floor(th.clientWidth / 8)));
    var rows = Math.max(6, Math.min(24, Math.floor(th.clientHeight / 13)));
    var s = '', r, c;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) s += Math.random() < 0.7 ? DCH.charAt((Math.random() * DCH.length) | 0) : ' ';
      s += '\n';
    }
    pre.style.fontSize = (th.clientWidth / cols / 0.6) + 'px';
    pre.style.lineHeight = (th.clientHeight / rows) + 'px';
    pre.textContent = s;
    // 大图先在后台解码好，再让它淡入
    var go = function () { th.classList.add('done'); };
    if (m.tagName === 'IMG' && m.decode) m.decode().then(go, go); else go();
  }

  /* ============================================================
     作品列表：四个分类，四种版式
       trio    三张竖图并排，标题居中在上
       zig     一左一右交错的大图 + 一段介绍
       index   纯文字的目录表，鼠标移上去旁边浮出小图
       scatter 几张大小不一、微微歪着的"纸"，标题压在右下
     ============================================================ */
  var LAYOUTS = ['trio', 'zig', 'index', 'scatter'];

  function thumbOf(w, i) {
    var wrap = el('div', 'thumb-wrap');
    wrap.appendChild(el('span', 'mono xy', 'X:' + (100 + i * 173 % 900) + ' Y:' + (200 + i * 131 % 700)));
    var th = el('div', 'thumb'), m;
    var first = w.thumb || (w.images && w.images[0]);
    if (first) { m = el('img'); m.alt = w.en; m.loading = 'lazy'; m.decoding = 'async'; m.src = src(first); }
    else if (w.videos && w.videos[0]) {            // 没有图片的作品：用视频的第一帧
      m = el('video'); m.muted = true; m.preload = 'metadata'; m.playsInline = true;
      m.src = encodeURI(w.videos[0]) + '#t=1';
    } else m = el('div');
    m.className = 'm';
    th.appendChild(m); th.appendChild(el('pre', 'garble'));
    wrap.appendChild(th);
    return wrap;
  }
  function link(node, i) {
    node.tabIndex = 0; node.setAttribute('role', 'link');
    node.addEventListener('click', function () { SITE.sfx('click'); SITE.openWork(i); });
    node.addEventListener('keydown', function (e) { if (e.key === 'Enter') SITE.openWork(i); });
    return node;
  }
  function card(w, i) {
    var a = link(el('div', 'card'), i);
    a.appendChild(thumbOf(w, i));
    a.appendChild(el('div', 'mono no', '::0 /#' + pad2(i + 1)));
    a.appendChild(el('h4', 'card-title', w.en));
    a.appendChild(el('p', 'cn card-cn', w.cn));
    a.appendChild(el('pre', 'mono card-specs', '--SPECS:\n' + specsOf(w).replace(/^--/gm, '  :--')));
    return a;
  }
  function zigRow(w, i, k) {
    var a = link(el('div', 'zig-row' + (k % 2 ? ' rev' : '')), i);
    a.appendChild(thumbOf(w, i));
    var t = el('div', 'zig-text');
    t.appendChild(el('div', 'zig-num', pad2(k + 1)));
    t.appendChild(el('div', 'mono no', '::0 /#' + pad2(i + 1)));
    t.appendChild(el('h4', 'card-title', w.en));
    t.appendChild(el('p', 'cn card-cn', w.cn));
    if (w.blurb) t.appendChild(el('p', 'zig-blurb', w.blurb));
    t.appendChild(el('pre', 'mono card-specs', specsOf(w)));
    a.appendChild(t);
    return a;
  }
  var preview = $('preview'), previewImg = $('previewImg');
  function indexRow(w, i) {
    var a = link(el('div', 'irow'), i);
    a.appendChild(el('span', 'mono i-no', '/#' + pad2(i + 1)));
    a.appendChild(el('span', 'i-title', w.en));
    a.appendChild(el('span', 'cn i-cn', w.cn));
    a.appendChild(el('span', 'mono i-tags', (w.tags || []).join(' / ')));
    a.appendChild(el('span', 'mono i-year', w.year || ''));
    a.appendChild(el('span', 'mono i-go', 'UNFOLD →'));
    var first = w.thumb || (w.images && w.images[0]);
    if (preview && first) {
      a.addEventListener('mouseenter', function () { previewImg.src = src(first); preview.classList.add('on'); });
      a.addEventListener('mouseleave', function () { preview.classList.remove('on'); });
      a.addEventListener('mousemove', function (e) {
        var x = Math.min(e.clientX + 28, window.innerWidth - 300), y = Math.min(e.clientY + 18, window.innerHeight - 240);
        preview.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
    }
    return a;
  }
  function buildList() {
    var list = $('workList'); if (!list) return;
    CATS.forEach(function (cat, ci) {
      var layout = cat.layout || LAYOUTS[ci % LAYOUTS.length];
      var sec = el('section', 'cat cat--' + layout); sec.id = 'cat-' + cat.id;
      var items = [];
      WORKS.forEach(function (w, i) { if (w.cat === cat.id) items.push([w, i]); });
      // 同一类里按 order 排（颜色相近的挨在一起）；没写 order 的保持原来的先后
      items.sort(function (a, b) { return (a[0].order || 50) - (b[0].order || 50) || a[1] - b[1]; });

      var head = el('div', 'cat-head');
      head.appendChild(el('span', 'mono cat-no', '--CAT ' + pad2(ci + 1) + '/' + pad2(CATS.length) + ':'));
      var h = el('h3', 'cat-title', cat.en); h.setAttribute('data-scramble', '');
      head.appendChild(h);
      head.appendChild(el('span', 'cn cat-cn', cat.cn));
      head.appendChild(el('span', 'mono cat-count', ':--' + pad2(items.length) + ' -/- ITEMS  [SEC:' + cat.id.toUpperCase() + ']'));

      var body = el('div', 'cat-body');
      items.forEach(function (it, k) {
        body.appendChild(layout === 'zig' ? zigRow(it[0], it[1], k) :
                         layout === 'index' ? indexRow(it[0], it[1]) : card(it[0], it[1]));
      });
      if (layout === 'scatter') { sec.appendChild(body); sec.appendChild(head); }   // 标题压在下面
      else { sec.appendChild(head); sec.appendChild(body); }
      list.appendChild(sec);
    });
  }
  buildList();

  // 文案里的件数跟着数据走
  var NUM = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
             'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
  Array.prototype.forEach.call(document.querySelectorAll('[data-count]'), function (n) {
    n.textContent = n.getAttribute('data-count') === 'word' ? (NUM[WORKS.length] || String(WORKS.length)) : pad2(WORKS.length);
  });

  /* 滑进屏幕时：标题显影、缩略图显影（各一次） */
  function onSeen(node) {
    if (node.classList.contains('thumb')) decode(node);
    else scramble(node, prep(node), 900);
  }
  var watch = Array.prototype.slice.call(document.querySelectorAll('.thumb, [data-scramble]'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target); onSeen(en.target);
      });
    }, { threshold: 0.25 });
    watch.forEach(function (n) { io.observe(n); });
  } else watch.forEach(onSeen);

  /* ============================================================
     滚动：导航压在蓝色上时变白字、模糊大字跟着滚
     ============================================================ */
  var nav = $('nav'), m1 = $('mq1'), m2 = $('mq2');
  function onScroll() {
    var y = window.pageYOffset || 0, seas = window.__seas || [], blue = false, i, r;
    for (i = 0; i < seas.length; i++) {
      if (!seas[i].ready()) continue;
      r = seas[i].blueRect();
      if (22 > r.top && 22 < r.bottom) blue = true;
    }
    if (nav) nav.classList.toggle('on-blue', blue);
    if (m1 && !reduce) {
      m1.style.transform = 'translateX(' + (-y * 0.35) + 'px)';
      m2.style.transform = 'translateX(' + (y * 0.35 - 1400) + 'px)';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { setTimeout(onScroll, 300); });
  setTimeout(onScroll, 1500);

  /* ============================================================
     作品页（盖在首页上面的一层；浏览器的后退键可以关掉它）
     ============================================================ */
  var sheet = $('sheet'), zoom = $('zoom');
  var openIdx = -1, pushed = false, openCbs = [], closeCbs = [];
  SITE.onOpen = function (f) { openCbs.push(f); };
  SITE.onClose = function (f) { closeCbs.push(f); };
  SITE.isOpen = function () { return openIdx >= 0; };

  function show(i) {
    var w = WORKS[i]; if (!w) return;
    var next = (i + 1) % WORKS.length;
    if (preview) preview.classList.remove('on');
    $('shNo').textContent = '::0 /#' + pad2(i + 1) + '  ' + catOf(w).en;
    $('shCn').textContent = w.cn;
    $('shSpecs').textContent = '--CATEGORY: ' + catOf(w).en + '\n' + specsOf(w);
    $('shBlurb').textContent = w.blurb || '';
    var boards = $('shBoards'); boards.innerHTML = '';
    (w.videos || []).forEach(function (v) {        // 视频：点了才播放，不自动出声
      var vid = el('video'); vid.controls = true; vid.preload = 'none'; vid.playsInline = true;
      vid.src = encodeURI(v);
      boards.appendChild(vid);
    });
    (w.images || []).forEach(function (name, k) {
      var im = el('img'); im.alt = w.en + ' — board ' + (k + 1);
      im.decoding = 'async'; if (k > 0) im.loading = 'lazy';
      im.src = src(name); im.title = 'CLICK TO ZOOM';
      im.addEventListener('click', function () {
        var full = (w.full && w.full[k]) ? encodeURI(w.full[k]) : im.src;   // 有更清晰的版本就放大时再加载
        $('zoomImg').src = full; zoom.classList.add('open');
      });
      boards.appendChild(im);
    });
    $('shNextName').textContent = WORKS[next].en;
    $('shNext').onclick = function () { SITE.sfx('click'); SITE.openWork(next); };
    sheet.scrollTop = 0;
    sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sheet-open');
    var first = openIdx < 0; openIdx = i;
    setScrambled($('shTitle'), w.en, 800);
    if (first) openCbs.forEach(function (f) { f(i); });
  }
  function hide() {
    if (openIdx < 0) return;
    zoom.classList.remove('open');
    sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sheet-open');
    Array.prototype.forEach.call(sheet.querySelectorAll('video'), function (v) { v.pause(); });
    openIdx = -1;
    closeCbs.forEach(function (f) { f(); });
  }
  SITE.openWork = function (i) {
    show(i);
    try {
      var url = '#work/' + WORKS[i].id;
      if (pushed) history.replaceState({ work: WORKS[i].id }, '', url);
      else { history.pushState({ work: WORKS[i].id }, '', url); pushed = true; }
    } catch (e) {}
  };
  SITE.closeWork = function () {
    if (openIdx < 0) return;
    hide();
    if (pushed) { pushed = false; try { history.back(); } catch (e) {} }
  };
  function idxOfId(id) {
    for (var i = 0; i < WORKS.length; i++) if (WORKS[i].id === id) return i;
    return -1;
  }
  window.addEventListener('popstate', function (e) {
    var i = e.state && e.state.work ? idxOfId(e.state.work) : -1;
    if (i >= 0) { pushed = true; show(i); } else { pushed = false; hide(); }
  });
  $('sheetBack').addEventListener('click', SITE.closeWork);
  zoom.addEventListener('click', function () { zoom.classList.remove('open'); });
  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (zoom.classList.contains('open')) zoom.classList.remove('open');
    else SITE.closeWork();
  });

  /* ============================================================
     载入：左上角一小段树状小字，1.2 秒内结束
     ============================================================ */
  var loader = $('loader'), headline = $('headline');
  function afterLoad() {
    if (loader) loader.classList.add('done');
    if (headline) scramble(headline, prep(headline), 1100);
    var m = /^#work\/(.+)$/.exec(location.hash || '');     // 直接打开某件作品的链接
    if (m && idxOfId(m[1]) >= 0) show(idxOfId(m[1]));
  }
  if (!loader || reduce) afterLoad();
  else {
    var lines = [
      '--INITIALIZING:',
      '   :--FOLDING PAPER ......... ' + pad2(WORKS.length) + '/' + pad2(WORKS.length),
      '   :--FILLING THE SEA',
      '   :--RAIN: ON'
    ];
    var lt = $('loaderText'), ln = $('loaderNum'), t0 = performance.now(), DUR = 1100;
    (function tick(now) {
      var p = Math.min(1, (now - t0) / DUR);
      lt.textContent = lines.slice(0, 1 + Math.floor(p * (lines.length - 0.01))).join('\n');
      ln.textContent = '[ ' + ('00' + Math.round(p * 100)).slice(-3) + ' ]';
      if (p < 1) requestAnimationFrame(tick); else afterLoad();
    })(t0);
  }
})();
