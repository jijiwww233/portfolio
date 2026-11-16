/* ============================================================
   作品数据 —— 以后增删作品、换图、加视频，只改这一个文件。

   · images： 展板 / 图片，文件在 IMG_BASE 这个文件夹里，按顺序竖着排。
   · videos： 视频，写完整路径，会排在展板上方，点了才播放。
   · blurb：  作品页左栏的一句话介绍。
   · accent： 首屏那只船折缝的颜色。
   · year：   取自文件名上标的年份。
   · order：  （可选）在自己那一类里排第几。现在是按颜色排的：相近的颜色挨在一起。
   · full：   （可选）点击放大时用的更清晰的原图，和 images 一一对应。
   · thumb：  （可选）列表里的小缩略图，不写就用 images 的第一张。
   · boardCrops：可选，每张展板的 [原图宽, 裁剪顶部, 裁剪后宽, 裁剪后高]，单位为像素。
   · course 留空的不会显示，等你补。
   ============================================================ */

var IMG_BASE = "assets/works/作业高清/";

var CATEGORIES = [
  { id: "craft", en: "Culture & Craft",    cn: "文创与非遗" },
  { id: "place", en: "Place & Wayfinding", cn: "场所与导视" },
  { id: "code",  en: "Code & Form",        cn: "代码与形态" },
  { id: "hand",  en: "Hand & Material",    cn: "手绘与材料" }
];

var WORKS = [
  /* ---------- 文创与非遗 ---------- */
  {
    id: "amituofo", cat: "craft", order: 1,
    en: "Amituofo Blind Box",
    cn: "阿咪陀佛 · 系列盲盒",
    accent: "#FF8A00",
    course: "艺术实践与考察", year: "2025",
    tags: ["IP", "BLIND BOX", "LONGMEN GROTTOES"],
    blurb: "A blind-box series that pairs the Buddhas of the Longmen Grottoes with the cats that live among them.",
    images: ["阿咪托佛25.webp"],
    thumb: "thumbs/阿咪托佛25.webp",
    videos: ["assets/videos/阿咪托佛视频.mp4"]
  },
  {
    id: "mirror", cat: "craft", order: 3,
    en: "Four-Crane Ribbon Inlay Mirror",
    cn: "镜逸鹤花 · 四鹤衔绶金银平脱镜文创",
    accent: "#19C3FF",
    course: "", year: "2024",
    tags: ["PATTERN", "HERITAGE", "MERCH"],
    blurb: "Patterns lifted from a Tang-dynasty crane mirror, remade by hand and redrawn as a set of everyday souvenirs.",
    images: ["镜逸鹤花24.webp", "镜逸鹤花实物24.webp"],
    thumb: "thumbs/镜逸鹤花24.webp",
    videos: []
  },
  {
    id: "chanhua", cat: "craft", order: 2,
    en: "Hakka Thread-Wrapped Flowers",
    cn: "缠花有语 · 客家缠花",
    accent: "#FF6FA3",
    course: "信息设计与策略", year: "2026",
    tags: ["CRAFT RESEARCH", "INFOGRAPHIC", "3 BOARDS"],
    blurb: "Three boards on Hakka thread-wrapped flowers: what they are made of, what the motifs mean, and where the craft can go next.",
    images: ["缠花26.webp", "缠花26年.webp", "缠花26（3）.webp"],
    boardCrops: [[1080, 378, 1080, 1932], [1203, 28, 1080, 1944], [1081, 32, 1080, 1948]],
    thumb: "thumbs/缠花26.webp",
    videos: []
  },

  /* ---------- 场所与导视 ---------- */
  {
    id: "xiananfang", cat: "place", order: 1,
    en: "Seeing Xian'anfang",
    cn: "看见咸安坊 · 视觉符号系统",
    accent: "#E8553A",
    course: "", year: "2026",
    tags: ["VISUAL SYMBOLS", "WAYFINDING MAP", "COLLAGE"],
    blurb: "A family of symbols drawn from the brick lanes of Xian'anfang, then put to work on maps, signs and souvenirs.",
    images: ["看见咸安坊26.webp"],
    thumb: "thumbs/看见咸安坊26.webp",
    videos: []
  },
  {
    id: "limiao", cat: "place", order: 3,
    en: "Limiao New Village",
    cn: "栗庙新村 · 导视调研",
    accent: "#FFF000",
    course: "", year: "2025",
    tags: ["FIELD RESEARCH", "MAPPING", "WAYFINDING"],
    blurb: "Field research into how people actually find their way through a village that keeps rebuilding itself.",
    images: ["栗庙新村导视25.webp"],
    thumb: "thumbs/栗庙新村导视25.webp",
    videos: ["assets/videos/栗庙新村导视视频.mp4"]
  },
  {
    id: "shell", cat: "place", order: 2,
    en: "Shell Wedding Pavilion",
    cn: "贝壳婚礼建筑 · 湖上",
    accent: "#A9745B",
    course: "", year: "2025",
    tags: ["ARCHITECTURE", "LAKESIDE", "RENDERING"],
    blurb: "A wedding pavilion on a lake, with a plan borrowed from a spiral shell.",
    images: ["建筑相关25/47098a0346fd7bcaefff195b28d5ac91.webp"],
    thumb: "thumbs/建筑相关25/47098a0346fd7bcaefff195b28d5ac91.webp",
    videos: []
  },
  {
    id: "terrain", cat: "place", order: 4,
    en: "Terrain Model",
    cn: "地形沙盘模型",
    accent: "#A8B545",
    course: "", year: "2025",
    tags: ["SCALE MODEL", "LANDSCAPE", "HANDMADE"],
    blurb: "A hillside built by hand at model scale: slope, stone steps, and a clearing of sand.",
    images: ["建筑相关25/1a5bffdc78f0520acc6492876e902473.webp", "建筑相关25/69ed166a47363895e30b96b0b3ff255b.webp"],
    thumb: "thumbs/建筑相关25/1a5bffdc78f0520acc6492876e902473.webp",
    videos: []
  },

  /* ---------- 代码与形态 ---------- */
  {
    id: "dissolve", cat: "code",
    en: "Dissolve",
    cn: "溶解 · 虚实无界",
    accent: "#9C7BFF",
    course: "", year: "2025",
    tags: ["XR EXHIBITION", "WATER", "DIGITAL TWIN"],
    blurb: "An XR exhibition concept that uses water to blur the line between the real and the virtual.",
    images: ["数字之雨展板25.webp"],
    thumb: "thumbs/数字之雨展板25.webp",
    videos: []
  },
  {
    id: "digitalrain", cat: "code",
    en: "Digital Rain",
    cn: "数字之雨 · 代码画的水",
    accent: "#5B7CFF",
    course: "", year: "2025",
    tags: ["PROCESSING", "GENERATIVE", "RAIN & WAVE"],
    blurb: "Rain and waves, drawn with a few dozen lines of Processing.",
    images: ["数字之雨25.webp"],
    thumb: "thumbs/数字之雨25.webp",
    videos: ["assets/works/作业高清/数字之雨视频.mp4"]
  },
  {
    id: "vr", cat: "code",
    en: "Green Valley VR",
    cn: "VR 场景",
    accent: "#B6F23A",
    course: "", year: "2026",
    tags: ["VR", "REAL-TIME 3D", "ENVIRONMENT"],
    blurb: "A walk-through VR scene: a mossy valley, a stream, and a cave at the end of it.",
    images: [
      "vr26/c86abe30fd60b81ee1e840ba12a942c0.webp",
      "vr26/85177c0d23273a15f1a6b0a412439e1e.webp",
      "vr26/bfab9020471c2d47dee09c0437847669.webp"
    ],
    thumb: "thumbs/vr26/c86abe30fd60b81ee1e840ba12a942c0.webp",
    videos: ["assets/videos/vr26.mp4"]
  },
  {
    id: "ichmap", cat: "code",
    en: "ICH Map of Wuhan",
    cn: "非遗导航网页",
    accent: "#E9C46A",
    course: "", year: "2025",
    tags: ["WEB", "INTERACTIVE MAP", "HERITAGE"],
    blurb: "An interactive web map for finding intangible-heritage studios around Wuhan and checking in at each one.",
    images: [
      "导航网页25/1af1f66de0c06d021bfcc1e7e6bb01ce.webp",
      "导航网页25/13665a20ffc4a20d46a277d72e7a1207.webp",
      "导航网页25/1a99e86bd88b37ba22132c3f72d16b6c.webp"
    ],
    thumb: "thumbs/导航网页25/1af1f66de0c06d021bfcc1e7e6bb01ce.webp",
    videos: []
  },
  {
    id: "lamp", cat: "code",
    en: "Interactive Lamp",
    cn: "交互灯",
    accent: "#FFC94D",
    course: "", year: "2026",
    tags: ["INTERACTION", "LIGHT", "PROTOTYPE"],
    blurb: "A glass lamp full of paper stars that answers when you come close.",
    images: [
      "交互灯26/54244e1fb104f9942ed627847924913c.webp",
      "交互灯26/3e52131beb1c2c4ca9a2031a1bbd40ab.webp"
    ],
    thumb: "thumbs/交互灯26/54244e1fb104f9942ed627847924913c.webp",
    videos: ["assets/videos/交互灯26.mp4"]
  },
  {
    id: "lattice", cat: "code",
    en: "Parametric Lattice Shell",
    cn: "参数化镂空壳体",
    accent: "#9AA1AB",
    course: "", year: "2025",
    tags: ["PARAMETRIC", "LATTICE", "3D MODEL"],
    blurb: "A curved lattice shell on branching supports, grown from parameters rather than drawn by hand.",
    images: [
      "建筑相关25/4e2a1845b25b9a599fd20b21da034550.webp",
      "建筑相关25/e108a0e9f0e3c918f52a7ecb029b6366.webp",
      "建筑相关25/d3a334dcce89d74a4543f7b646c47ef6.webp"
    ],
    thumb: "thumbs/建筑相关25/4e2a1845b25b9a599fd20b21da034550.webp",
    videos: []
  },

  /* ---------- 手绘与材料 ---------- */
  {
    id: "sketches", cat: "hand",
    en: "Marker Paintings",
    cn: "写生 · 马克笔静物与人物",
    accent: "#20C9C9",
    course: "", year: "2024",
    tags: ["MARKER", "STILL LIFE", "FIGURE"],
    blurb: "Marker paintings of still lifes and people, mostly an excuse to play with colour.",
    images: ["绘图24.webp", "绘图24（2）.webp"],
    thumb: "thumbs/绘图24.webp",
    videos: []
  },
  {
    id: "graphic2d", cat: "hand",
    en: "2D Graphic Language",
    cn: "二维平面图示语言 · 水彩",
    accent: "#FF3B55",
    course: "二维平面图示语言基础", year: "2024",
    tags: ["WATERCOLOUR", "ABSTRACT", "COMPOSITION"],
    blurb: "An abstract composition in watercolour: a landscape taken apart into blocks and stripes.",
    images: ["绘图24（3）.webp"],
    thumb: "thumbs/绘图24（3）.webp",
    videos: []
  },
  {
    id: "dog", cat: "hand",
    en: "Gou, a Dog",
    cn: "狗 · 字形装置",
    accent: "#E6007E",
    course: "", year: "2024",
    tags: ["CHARACTER", "INSTALLATION", "FOAM BOARD"],
    blurb: "The Chinese character for dog, redrawn until it became one, then built at full size.",
    images: ["狗24.webp", "狗24 (2).webp"],
    thumb: "thumbs/狗24 (2).webp",          // 主页上用第二张（实物照片）
    videos: []
  }
];

window.IMG_BASE = IMG_BASE;
window.CATEGORIES = CATEGORIES;
window.WORKS = WORKS;
