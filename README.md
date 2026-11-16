# 作品集网站 · 使用说明

## 本地预览

双击 `index.html`，用 Chrome 或 Edge 打开。不需要安装任何东西，不联网也能打开。

## 文件夹里有什么

```
portfolio/
├─ index.html        整页
├─ css/style.css     样式、字体位
├─ js/works.js       ★ 作品数据：增删作品、换图、加视频只改这里
├─ js/main.js        载入、导航、四种版式的列表、作品页、声音
├─ js/sea.js         首屏的海、页脚的海、跟着页面往下漂的小船（顶部有一组可调的数）
└─ assets/
   ├─ works/         放高清展板
   ├─ videos/        放视频（单个不超过 100MB）
   └─ fonts/         放字体文件
```

## 换图

图片都在 `assets/works/作业高清/` 里。要换某张图：把新图放进这个文件夹，再到 `js/works.js` 里把对应作品 `images` 里的文件名改掉。
展板使用 WebP。作品的 thumb 字段是列表和悬停预览用的缩略图，换封面时记得一起更新。

## 加视频

1. 把视频放进 `assets/videos/`。
2. 在 `js/works.js` 里对应的作品写：`videos: ["assets/videos/文件名.mp4"]`。
   视频会出现在那件作品页的展板上方，点了才播放。

## 加一件作品

在 `js/works.js` 的 `WORKS` 里照着已有的格式复制一段，改掉内容即可。
首屏会自动多一只船，列表会自动多一格。`cat` 填四个分类之一：`craft` / `place` / `code` / `hand`。

## 放字体

把下面三个文件放进 `assets/fonts/`，文件名要一样，放进去就自动生效：

- `InstrumentSerif-Regular.woff2`（英文大字）
- `JetBrainsMono-Regular.woff2`（等宽小字）

不放也能看，会用电脑自带的字体。
中文现在用的是电脑自带的常规粗细黑体（细体太弱，已经不用），`SourceHanSansSC-Light-subset.woff2` 可以删掉。

## 上传到 GitHub Pages

1. 在 GitHub 新建一个仓库（Public）。
2. 把 `portfolio` 文件夹**里面的**所有东西上传到仓库根目录（`index.html` 要在最外层）。
   上传前确认图片已经搬进 `assets/works/`，否则线上看不到图。
3. 仓库 → Settings → Pages → Source 选 `Deploy from a branch`，Branch 选 `main`、`/ (root)`，保存。
4. 等一两分钟，页面上会出现网址。

## 调首屏的手感

`js/sea.js` 最上面有一组数，改完刷新即可：水面高度、雨的密度、涟漪留多久、水面有多"吵"、船被推开的力度等，每个数旁边都有中文说明。
