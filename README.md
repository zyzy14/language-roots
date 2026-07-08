# 语言寻根 · 全球语言谱系赛博全息馆

一个兼具前沿科技质感与深厚人文关怀的「全球语言谱系赛博全息馆」。通过可视化技术，将人类约 5000 年的语言演化史、空间迁徙地图、以及濒危文化反思，打包成一个「一分钟开箱即食」的数字档案馆。

> 本项目由造物云平台上的原站**迁移重构**而来：数据与逻辑彻底分离、外部依赖本地化，成为可自由托管、可维护、可扩展的纯静态站点。

## ✨ 核心功能

1. **赛博星系图谱**：Vis.js 力导向星系，按语系分色（印欧 / 汉藏 / 乌拉尔·非洲 / 美洲 / 南岛 / 孤立），点击语系绽放下属语族与语种。
2. **空间与趣味三位一体闭环**：点击语言 → 右侧点阵世界地图定向亮起其地理分布 + 抽屉滑出「冷知识暴击 / 发音密码 / 语言梗」。
3. **暮色余烬集群（濒危·守护）**：独立濒危语言模式，暮色烛光氛围，唤起守护意识。

## 🗂 项目结构

```
.
├── index.html              # 入口页
├── styles.css              # 样式（暖墨底 + 赭金/鼠尾草绿 复古人文调）
├── js/
│   ├── data.js             # 由 data/*.json 生成的全局数据（勿手改）
│   └── app.js              # 全部渲染逻辑（图谱/搜索/模式/地图/抽屉）
├── data/                   # ★ 内容数据源：改这里 = 改网站
│   ├── languages.json      # 54 种语言（name/tree/fact/example/meme）
│   ├── categories.json     # 8 个语系/语族科普
│   ├── geo_regions.json    # 语言 → 国家/区域映射
│   └── geo_coords.json     # 105 个国家中心点坐标
├── vendor/                 # 本地化依赖（完全离线自包含）
│   ├── vis-network.min.js
│   ├── lucide.min.js
│   └── tailwind.js
├── reference/
│   └── original-site.html  # 造物云原始站点备份
├── deploy.sh               # 一键部署到 GitHub Pages
├── netlify.toml            # Netlify 部署配置
├── vercel.json             # Vercel 部署配置
└── .github/workflows/deploy.yml  # GitHub Pages Actions
```

## 🔧 本地预览

```bash
cd 项目目录
python3 -m http.server 8765
# 浏览器打开 http://localhost:8765
```

## 🚀 部署（任选其一）

### 方式 A：GitHub Pages（推荐，免费·全球）
```bash
gh auth login            # 首次需登录
./deploy.sh              # 自动提交并推送到 main，Actions 自动部署
```
> 首次部署后到仓库 **Settings → Pages** 确认 Source = `GitHub Actions`。

### 方式 B：Netlify / Vercel
- Netlify：拖拽整个文件夹到 [app.netlify.com/drop](https://app.netlify.com/drop)，或连接 Git 仓库（已含 `netlify.toml`）。
- Vercel：导入 Git 仓库（已含 `vercel.json`），或 `vercel deploy`。

### 方式 C：任意静态托管 / 对象存储
直接把整个文件夹上传到 GitHub Pages、Cloudflare Pages、对象存储（OSS/COS）+ CDN、或原造物云的静态目录即可——纯静态，零服务端依赖。

### 自定义域名
在仓库根放一个 `CNAME` 文件，内容为你的域名（如 `language-roots.example.com`），并在 DNS 处做相应解析。

## ✏️ 改内容（无需碰代码）

编辑 `data/languages.json` 等文件后，重跑数据生成脚本（把 JSON 写回 `js/data.js`）：

```bash
node scripts/build-data.js   # 见 scripts/ 目录
```

> 若尚未生成 `scripts/build-data.js`，可直接用原站提取脚本逻辑：读取 `data/*.json` 重建 `js/data.js` 中的 5 个全局常量。

## 📌 技术说明

- **可视化**：Vis.js Network（力导向图），本地化于 `vendor/`
- **样式**：Tailwind（play CDN 版本地化于 `vendor/tailwind.js`）
- **图标**：Lucide，本地化于 `vendor/lucide.min.js`
- **字体**：思源宋体/黑体（Google Fonts，可后续本地化）
- **数据驱动**：所有文案、语系关系、地理坐标均外置于 `data/`，便于持续运营
