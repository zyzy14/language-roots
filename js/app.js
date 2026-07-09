    /* =========================================================
       1. 语言详情数据库（用户提供，原样内置）
    ========================================================= */
    
/* 数据已外置到 js/data.js */
Object.keys(GEO_REGIONS).forEach(k => { if (languageDatabase[k]) languageDatabase[k].geoRegions = GEO_REGIONS[k]; });

    // (b) 区域中心坐标表（lat / lon）——用于在等距圆柱投影上定位高亮点
    
/* GEO_COORDS 已外置到 js/data.js */
// 地图陆地边界框（来自原始站点，用于等距投影地图上判断某经纬度是否在陆地上）
const LAND_BOXES = [ // [latN, latS, lonW, lonE]
  [72,50,-141,-60],[71,58,-168,-141],[49,30,-125,-70],[30,15,-116,-88],[16,7,-92,-77], // 北美
  [83,60,-55,-15], // 格陵兰
  [12,-20,-80,-35],[-20,-55,-75,-53],[-5,-35,-64,-40], // 南美
  [70,46,-9,40],[46,36,-9,28],[71,55,5,30], // 欧洲
  [37,18,-16,34],[18,-12,-16,42],[-12,-35,10,40], // 非洲
  [40,12,34,60], // 中东
  [66,45,40,88],[73,50,88,180],[50,36,52,88], // 俄罗斯 / 中亚
  [35,8,68,90],[50,22,90,122],[24,6,95,110], // 印度 / 中国 / 中南半岛
  [7,-10,95,141],[45,31,129,146], // 印尼 / 日本
  [-10,-39,113,154],[-34,-46,166,179], // 澳洲 / 新西兰
];
// 等距投影：经度 [-180,180] -> x [0,360]，纬度 [90,-90] -> y [0,180]
const projX = (lon) => lon + 180;
const projY = (lat) => 90 - lat;
const inLand = (lat, lon) => LAND_BOXES.some(b => lat <= b[0] && lat >= b[1] && lon >= b[2] && lon <= b[3]);

    const BASE_MAP_SVG = (() => {
      let grat = '';
      for (let lon = -150; lon <= 150; lon += 30) grat += `<line class="map-grid" x1="${projX(lon)}" y1="0" x2="${projX(lon)}" y2="180"/>`;
      for (let lat = 60; lat >= -60; lat -= 30) grat += `<line class="map-grid" x1="0" y1="${projY(lat)}" x2="360" y2="${projY(lat)}"/>`;
      let dots = '';
      for (let lat = 84; lat >= -56; lat -= 4) {
        for (let lon = -180; lon <= 178; lon += 4) {
          if (inLand(lat, lon)) dots += `<circle class="map-dot" cx="${projX(lon).toFixed(1)}" cy="${projY(lat).toFixed(1)}" r="1.25"/>`;
        }
      }
      return grat + dots;
    })();

    // (e) 为指定语言构建其高亮区域标记（id=map-geo-<代码>，class=map-land）
    function buildMapMarkers(dbKey) {
      const regs = (languageDatabase[dbKey] && languageDatabase[dbKey].geoRegions) || [];
      return regs.map(id => {
        const c = GEO_COORDS[id];
        if (!c) return '';
        return `<circle class="map-land" id="map-geo-${id}" cx="${projX(c.lon).toFixed(1)}" cy="${projY(c.lat).toFixed(1)}" r="3.6"/>`;
      }).join('');
    }

    // (f) 完整地图 HTML（点阵底图 + 当前语言的高亮标记 + GPS Loading）
    function buildMapHTML(dbKey) {
      return `
        <svg class="map-svg" viewBox="0 0 360 180" preserveAspectRatio="xMidYMid meet">
          ${BASE_MAP_SVG}
          <g id="map-markers">${buildMapMarkers(dbKey)}</g>
        </svg>
        <div class="map-loading">
          <span class="map-scan"></span>
          <span class="map-loading-text">◎ GPS 定位中…</span>
        </div>`;
    }

    // (g) 语言 → 语系主题色（联动星系色板）
    function getThemeColorByLanguage(dbKey) {
      const path = LEAF_PATHS[dbKey];
      return famColorOf(path && path[0]);
    }

    // (h) 区域染色联动逻辑
    function updateMapHighlight(dbKey) {
      const langData = languageDatabase[dbKey];
      // 1. 重置所有区域标记
      document.querySelectorAll('#language-map-container .map-land').forEach(el => {
        el.classList.remove('active-highlight');
        el.style.fill = '';
      });
      if (!langData || !langData.geoRegions) return;
      // 2. 取该语言所属语系的主题色
      const themeColor = getThemeColorByLanguage(dbKey);
      // 3. 动态点亮目标区域
      langData.geoRegions.forEach(regionId => {
        const el = document.getElementById(`map-geo-${regionId}`);
        if (el) {
          el.classList.add('active-highlight');
          el.style.setProperty('--theme-color', themeColor);
          el.style.fill = themeColor;
        }
      });
    }

    // (i) 抽屉内地图初始化：先播 GPS 定位动效，再染色
    function setupMap(dbKey) {
      const cont = document.getElementById('language-map-container');
      if (!cont) return;
      const loading = cont.querySelector('.map-loading');
      if (loading) loading.classList.remove('done');
      setTimeout(() => {
        updateMapHighlight(dbKey);
        if (loading) loading.classList.add('done');
      }, 650);
    }

    /* =========================================================
       2. 由数据库自动构建语系图谱
       层级：语系(family) → 语族(sub) → 语支(branch) → 语种(leaf)
       每个 leaf 节点携带 dbKey，指回 languageDatabase
    ========================================================= */
    /* —— 语系配色常量：按“语系归属”着色 —— */
    // 低饱和的“古地图”配色：像旧墨水与矿物颜料，克制而有人文温度
    const FAMILY_COLORS = {
      '印欧语系':          '#7E8FB0', // 黛蓝
      '汉藏语系':          '#C6A15B', // 赭金
      '乌拉尔语系':        '#8A9A6B', // 鼠尾草绿
      '阿尔泰假说 / 孤立': '#B07C9E', // 藕荷（日/韩）
      '孤立语言 (Isolate)':'#B07C9E', // 藕荷（巴斯克/阿伊努）
      // —— 全球五大洲扩展色板 ——
      '尼日尔-刚果语系':   '#8A9A6B', // 非洲橄榄绿
      '纳-德内语系':       '#C0785B', // 陶土红（美洲）
      '易洛魁语系':        '#C0785B',
      '玛雅语系':          '#C0785B',
      '克丘亚语系':        '#C0785B',
      '犹他-阿兹特克语系': '#C0785B',
      '南岛语系':          '#6E9E9A', // 大洋松石绿
      // —— 8 种新增语言带来的新语系 ——
      '达罗毗荼语系':       '#9E7CA0', // 柔和紫（泰米尔语）
      '蒙古语系':          '#7CA0A0', // 青灰（蒙古语）
      // —— 6 种新增语言带来的新语系 / 类型 ——
      '亚非语系':          '#B5895B', // 砂金铜（阿拉伯/希伯来/阿姆哈拉）
      '人工语言':          '#5FA8B0', // 亮松石（世界语）
      '手语':              '#C07C8A', // 灰玫瑰（美国手语）
      '图皮语系':          '#C0785B', // 陶土红（瓜拉尼，并入美洲色系）
      '克里奥尔语':        '#9E8AB0', // 雾紫灰（海地克里奥尔）
    };
    const DEFAULT_FAMILY_COLOR = '#A8926E'; // 其他语系：暖褐
    // 选中/悬浮时的高亮色（同色系提亮，柔和不刺眼）
    const NEON = {
      '#7E8FB0':'#A7B4CE', '#C6A15B':'#E0C489', '#8A9A6B':'#B2BE96',
      '#B07C9E':'#CFA9C1', '#C0785B':'#D9A488', '#6E9E9A':'#9CC3BF',
      '#A8926E':'#C9B694',
      '#B5895B':'#D8B07E', '#5FA8B0':'#8FCDD4', '#C07C8A':'#D9A3AE',
      '#9E8AB0':'#C2AFD0',
    };
    const famColorOf = (f) => FAMILY_COLORS[f] || DEFAULT_FAMILY_COLOR;
    // #RRGGBB + alpha → rgba()
    const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; };
    // 节点 label → categoryDatabase 的键（label 即键则用，否则走 CATEGORY_ALIAS 别名表），无则 null
    const categoryKeyOf = (label) => (categoryDatabase[label] ? label : CATEGORY_ALIAS[label]) || null;

    // 每门语言在图谱中的层级链（family → sub → branch → leaf）
    // 用 dbKey 作为 leaf。层级节点用稳定 id（同名节点自动复用/合并）。
    const LEAF_PATHS = {
      "法文":         ["印欧语系", "罗曼语族", "西罗曼语支"],
      "意大利文":     ["印欧语系", "罗曼语族", "西罗曼语支"],
      "德文":         ["印欧语系", "日耳曼语族", "西日耳曼语支"],
      "俄文":         ["印欧语系", "斯拉夫语族", "东斯拉夫语支"],
      "印地文":       ["印欧语系", "印度-伊朗语族", "印度-雅利安语支"],
      "中文":         ["汉藏语系", "汉语族", "官话 / 方言"],
      "藏文":         ["汉藏语系", "藏缅语族", "藏语支"],
      "日文":         ["阿尔泰假说 / 孤立"],
      "韩文":         ["阿尔泰假说 / 孤立"],
      "阿拉伯文":     ["亚非语系", "闪米特语族", "中闪米特语支"],
      "希伯来文":     ["亚非语系", "闪米特语族", "犹太语支"],
      "印度尼西亚文": ["南岛语系", "马来-波利尼西亚语族"],
      "越南文":       ["南亚语系", "孟高棉语族", "越芒语支"],
      "匈牙利文":     ["乌拉尔语系", "乌戈尔语族"],
      "土耳其文":     ["突厥语系", "乌古斯语支"],
      "巴斯克文":     ["孤立语言 (Isolate)"],
      // —— 追加的 4 门语言 ——
      "瑞典文":       ["印欧语系", "日耳曼语族", "北欧日耳曼语支"],
      "西班牙文":     ["印欧语系", "罗曼语族", "西罗曼语支"],
      "高棉文":       ["南亚语系", "孟高棉语族"],
      "泰文":         ["壮侗语系", "台语支"],
      // —— 非洲 / 美洲 / 大洋洲（全球五大洲扩展）——
      "斯瓦希里语":   ["尼日尔-刚果语系", "大西洋-刚果语族", "班图语支"],
      "祖鲁语":       ["尼日尔-刚果语系", "大西洋-刚果语族", "班图语支"],
      "纳瓦霍语":     ["纳-德内语系", "阿帕切语支"],
      "毛利语":       ["南岛语系", "马来-波利尼西亚语族", "波利尼西亚语支"],
      // —— 补全的各语系成员 ——
      "英语":         ["印欧语系", "日耳曼语族", "西日耳曼语支"],
      "荷兰语":       ["印欧语系", "日耳曼语族", "西日耳曼语支"],
      "挪威语":       ["印欧语系", "日耳曼语族", "北欧日耳曼语支"],
      "丹麦语":       ["印欧语系", "日耳曼语族", "北欧日耳曼语支"],
      "冰岛语":       ["印欧语系", "日耳曼语族", "北欧日耳曼语支"],
      "葡萄牙语":     ["印欧语系", "罗曼语族", "西罗曼语支"],
      "罗马尼亚语":   ["印欧语系", "罗曼语族", "东罗曼语支"],
      "乌克兰语":     ["印欧语系", "斯拉夫语族", "东斯拉夫语支"],
      "波兰语":       ["印欧语系", "斯拉夫语族", "西斯拉夫语支"],
      "捷克语":       ["印欧语系", "斯拉夫语族", "西斯拉夫语支"],
      "塞尔维亚语":   ["印欧语系", "斯拉夫语族", "南斯拉夫语支"],
      "保加利亚语":   ["印欧语系", "斯拉夫语族", "南斯拉夫语支"],
      "波斯语":       ["印欧语系", "印度-伊朗语族", "伊朗语支"],
      "希腊语":       ["印欧语系", "希腊语族", "希腊语支"],
      "缅甸语":       ["汉藏语系", "藏缅语族", "缅语支"],
      "约鲁巴语":     ["尼日尔-刚果语系", "大西洋-刚果语族", "约鲁巴语支"],
      "绍纳语":       ["尼日尔-刚果语系", "大西洋-刚果语族", "班图语支"],
      "切罗基语":     ["易洛魁语系", "南易洛魁语支"],
      "玛雅语":       ["玛雅语系", "尤卡坦语支"],
      "克丘亚语":     ["克丘亚语系"],
      "芬兰语":       ["乌拉尔语系", "芬兰语族"],
      "爱沙尼亚语":   ["乌拉尔语系", "芬兰语族"],
      // —— 追加的濒危语言（含新语族）——
      "阿伊努语":     ["孤立语言 (Isolate)"],
      "夏威夷语":     ["南岛语系", "马来-波利尼西亚语族", "波利尼西亚语支"],
      "威尔士语":     ["印欧语系", "凯尔特语族", "布立吞语支"],
      "布列塔尼语":   ["印欧语系", "凯尔特语族", "布立吞语支"],
      "爱尔兰语":     ["印欧语系", "凯尔特语族", "盖尔语支"],
      "苏格兰盖尔语": ["印欧语系", "凯尔特语族", "盖尔语支"],
      "格陵兰语":     ["爱斯基摩-阿留申语系", "因纽特语支"],
      "纳瓦特尔语":   ["犹他-阿兹特克语系", "纳瓦语支"],
      // —— 追加的 8 种语言（与 data/languages.json 同步）——
      "泰米尔语":     ["达罗毗荼语系", "南达罗毗荼语族", "泰米尔语支"],
      "粤语":         ["汉藏语系", "汉语族", "粤语"],
      "孟加拉语":     ["印欧语系", "印度-伊朗语族", "印度-雅利安语支"],
      "豪萨语":       ["亚非语系", "乍得语族", "西乍得语支"],
      "蒙古语":       ["蒙古语系", "中蒙古语支"],
      "马来语":       ["南岛语系", "马来-波利尼西亚语族"],
      "普什图语":     ["印欧语系", "印度-伊朗语族", "伊朗语支"],
      "梵语":         ["印欧语系", "印度-伊朗语族", "印度-雅利安语支"],
      // —— 追加的 6 种语言（人工/手语/美洲原住民/闪米特/南岛/克里奥尔）——
      "世界语":       ["人工语言", "世界语"],
      "美国手语":     ["手语", "法国手语族", "美国手语"],
      "瓜拉尼语":     ["图皮语系", "图皮-瓜拉尼语族", "瓜拉尼语"],
      "阿姆哈拉语":   ["亚非语系", "闪米特语族", "南闪米特语支"],
      "菲律宾语":     ["南岛语系", "马来-波利尼西亚语族", "中菲律宾语支"],
      "海地克里奥尔语": ["克里奥尔语", "法语克里奥尔", "海地克里奥尔语"],
    };
    // 层级链里，第 0 个视为 family，最后 leaf 之前依次为 sub / branch
    const LEVEL_KINDS = ['family', 'sub', 'branch'];

    const FACE = '"Noto Sans SC", Inter, "PingFang SC", sans-serif';
    const FACE_SERIF = '"Noto Serif SC", Georgia, serif';   // 语系/枢纽用宋体，添几分厚重

    /* 按“层级 + 语系归属”生成节点样式。
       plain 保存干净的原始 label，供逻辑（categoryDatabase 查找、搜索）使用；
       family / root 节点显示时用 <b> 加粗（需 font.multi='html'）。 */
    function styledNode(id, label, kind, family, dbKey) {
      const c = famColorOf(family);
      const neon = NEON[c] || '#FFFFFF';
      const common = {
        id, kind, plain: label, family: family || null, dbKey: dbKey || null,
        borderWidthSelected: 3,   // 选中时边框加粗
        shadow: { enabled: true, color: hexA(c, 0.32), size: kind === 'leaf' ? 10 : 7, x: 0, y: 1 },  // 柔和的落影，非霓虹
      };

      // 中心枢纽
      if (kind === 'root') {
        return { ...common, label: '<b>' + label + '</b>', shape: 'box', margin: 15, borderWidth: 1,
          font: { multi: 'html', size: 19, color: '#F1E9DA', face: FACE_SERIF, bold: { color: '#F1E9DA', size: 19, face: FACE_SERIF } },
          color: { background: '#2A2318', border: '#6E6047',
                   highlight: { background: '#3A3122', border: '#C6A15B' }, hover: { background: '#3A3122', border: '#C6A15B' } } };
      }

      // 一级：语系节点（宋体大字号，矿物主色填充 + 暖边）
      if (kind === 'family') {
        return { ...common, label: '<b>' + label + '</b>', shape: 'box', margin: 16, borderWidth: 1,
          font: { multi: 'html', size: 21, color: '#1B160E', face: FACE_SERIF, bold: { color: '#1B160E', size: 21, face: FACE_SERIF } },
          color: { background: c, border: hexA(c, 0.9),
                   highlight: { background: neon, border: '#F1E9DA' }, hover: { background: neon, border: '#F1E9DA' } } };
      }

      // 三级：具体语种节点（dot，矿物色小圆点）
      if (kind === 'leaf') {
        return { ...common, label, shape: 'dot', size: 11,
          font: { size: 14, color: '#B6AC98', face: FACE, strokeWidth: 3, strokeColor: '#17140F' },
          color: { background: c, border: c,
                   highlight: { background: neon, border: '#F1E9DA' }, hover: { background: neon, border: '#F1E9DA' } } };
      }

      // 二级：语族 / 语支节点（暖墨底 box + 主色边框）
      return { ...common, label, shape: 'box', margin: 10, borderWidth: 1,
        font: { size: 15, color: '#D8CFBC', face: FACE, strokeWidth: 0 },
        color: { background: '#241E15', border: c,
                 highlight: { background: '#322A1D', border: neon }, hover: { background: '#322A1D', border: neon } } };
    }

    // 用 Map 去重合并同名的中间层级节点
    const nodeMap = new Map();   // id -> node
    const edgeSet = new Set();   // "from|to" 去重
    const edgeList = [];

    function ensureNode(id, label, kind, family, dbKey) {
      if (!nodeMap.has(id)) nodeMap.set(id, styledNode(id, label, kind, family, dbKey));
      return nodeMap.get(id);
    }
    function link(from, to) {
      const k = from + '|' + to;
      if (!edgeSet.has(k)) { edgeSet.add(k); edgeList.push({ from, to }); }
    }

    // 中心枢纽
    ensureNode('__root', '人类语言', 'root', null);

    // 遍历每门语言，铺出 语系→...→语种 的整条链；整条链共享 path[0]（语系）的配色
    // 关键：给每个节点/连线打上 familyRoot 标记（所属语系节点 id），用于收拢/绽放
    Object.keys(languageDatabase).forEach(dbKey => {
      const path = LEAF_PATHS[dbKey];
      const family = path[0];            // 该语言所属语系 → 决定整条链的色系
      const familyId = 'lvl:' + family;  // 语系节点 id
      const langName = languageDatabase[dbKey].name.split(' ')[0]; // 取中文名做节点标签
      let prevId = '__root';

      path.forEach((label, i) => {
        const kind = LEVEL_KINDS[Math.min(i, LEVEL_KINDS.length - 1)];
        const id = 'lvl:' + label;         // 同名层级 → 同一节点（自动认亲合并）
        const n = ensureNode(id, label, kind, family);
        n.familyRoot = familyId;
        (n.descLeaves || (n.descLeaves = new Set())).add(dbKey);  // 记录其下辖语种（模式过滤用）
        // 中间层（sub / branch，即 i>0）默认隐藏，点击语系才绽放
        if (i > 0) n.collapsible = true;
        // 连线归属：连到中间层的边默认隐藏
        const e = linkMeta(prevId, id);
        if (i > 0) e.collapsible = true;
        e.familyRoot = familyId;
        prevId = id;
      });

      // 叶子：语种本身（始终可见）
      const leafId = 'leaf:' + dbKey;
      const leaf = ensureNode(leafId, langName, 'leaf', family, dbKey);
      leaf.familyRoot = familyId;
      leaf.descLeaves = new Set([dbKey]);
      // 叶子直接由“语系”统领的那条边（当谱系只有语系一层时）可见；否则连到中间层，随中间层绽放
      const eLeaf = linkMeta(prevId, leafId);
      eLeaf.familyRoot = familyId;
      if (prevId !== familyId && prevId !== '__root') eLeaf.collapsible = true;
    });

    // 给 edgeList 每条边挂元数据的辅助（复用去重逻辑）
    function linkMeta(from, to) {
      const k = from + '|' + to;
      let e = edgeList.find(x => (x.from + '|' + x.to) === k);
      if (!e) { e = { from, to }; edgeSet.add(k); edgeList.push(e); }
      return e;
    }

    const nodesArr = Array.from(nodeMap.values());
    // 初始：中间层节点隐藏
    nodesArr.forEach(n => { if (n.collapsible) n.hidden = true; });
    // 父节点映射（谱系为树，每个节点唯一父节点）→ 用于回溯“归属链”
    const parentOf = {};
    edgeList.forEach(e => { parentOf[e.to] = e.from; });

    /* =========================================================
       3. 初始化 Vis Network
    ========================================================= */
    const container = document.getElementById('graph');
    // 连线默认几乎隐形（rgba(255,255,255,0.05)）；选中/悬浮时才亮起语系霓虹色
    let EDGE_IDLE = 'rgba(255,255,255,0.05)';   // 连线默认色（随主题切换更新）
    const data = {
      nodes: new vis.DataSet(nodesArr),
      edges: new vis.DataSet(edgeList.map((e, i) => {
        const fam = (nodeMap.get(e.to) || {}).family;
        const c = famColorOf(fam);
        return {
          id: 'e' + i,
          from: e.from, to: e.to,
          familyRoot: e.familyRoot || null,
          collapsible: !!e.collapsible,
          neon: c,                                   // 记住该边的语系霓虹色
          hidden: !!e.collapsible,                   // 中间层连线默认隐藏
          color: { color: EDGE_IDLE, highlight: hexA(c, 0.95), hover: hexA(c, 0.85), inherit: false },
          width: 1,
          selectionWidth: 2.4,
          smooth: { enabled: true, type: 'cubicBezier', forceDirection: 'none', roundness: 0.5 },
        };
      })),
    };

    const options = {
      autoResize: true,
      nodes: { scaling: { min: 10, max: 30 } },
      interaction: { hover: true, dragNodes: true, dragView: true, zoomView: true, tooltipDelay: 120, keyboard: false },
      physics: {
        enabled: true,
        solver: 'barnesHut',
        barnesHut: {
          gravitationalConstant: -4000, // 让不同语系的星云拉开距离，不要重叠
          centralGravity: 0.1,          // 保持整体向中心靠拢，不至于飘走
          springLength: 150,            // 连线加长，给字体留足显示空间
          springConstant: 0.04,
          damping: 0.6,
          avoidOverlap: 0.4,
        },
        stabilization: { enabled: true, iterations: 550, updateInterval: 30, fit: false },
        maxVelocity: 42, minVelocity: 0.6,
      },
    };

    const network = new vis.Network(container, data, options);

    // 稳定后：自适应居中动画，随后冻结物理引擎（保留拖拽/缩放）
    network.once('stabilizationIterationsDone', () => {
      network.fit({ animation: { duration: 1100, easingFunction: 'easeInOutCubic' } });
      setTimeout(() => network.setOptions({ physics: { enabled: false } }), 1200);
      setTimeout(honorInitialHash, 200);   // 首屏若带 #/lang/xxx 深链，稳定后自动还原
    });

    /* =========================================================
       4. 右侧抽屉渲染（tree / fact / example / meme）
    ========================================================= */
    const drawer = document.getElementById('drawer');
    const scrim  = document.getElementById('scrim');

    // 把 example 解析为 短语/字形 · 拟音/读音 · 特征/发音密码 三段（解析失败则整体降级显示）
    function parseExample(str) {
      const m = str.match(/(?:短语|字形)：([\s\S]*?)➔\s*(?:拟音|读音)：([\s\S]*?)。(?:特征|发音密码)：([\s\S]*)/);
      if (m) return { phrase: m[1].trim(), pron: m[2].trim(), feature: m[3].trim() };
      return { phrase: '', pron: '', feature: str };
    }

    // 属性转义（用于把文本安全塞进 data-* 属性）
    function escAttr(s) {
      return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    // 每种语言的 TTS 发音 locale（BCP-47），用于「听原音」时挑对应语种的嗓音。
    // 值为 null 表示该语言没有口语发音（如手语），此时不显示朗读按钮。
    const LOCALE_BY_KEY = {
      '法文':'fr-FR','意大利文':'it-IT','德文':'de-DE','俄文':'ru-RU','印地文':'hi-IN',
      '中文':'zh-CN','藏文':'bo-CN','日文':'ja-JP','韩文':'ko-KR','阿拉伯文':'ar-SA',
      '希伯来文':'he-IL','印度尼西亚文':'id-ID','越南文':'vi-VN','匈牙利文':'hu-HU','土耳其文':'tr-TR',
      '巴斯克文':'eu-ES','瑞典文':'sv-SE','西班牙文':'es-ES','高棉文':'km-KH','泰文':'th-TH',
      '斯瓦希里语':'sw-KE','祖鲁语':'zu-ZA','纳瓦霍语':'nv','毛利语':'mi-NZ','英语':'en-US',
      '荷兰语':'nl-NL','挪威语':'nb-NO','丹麦语':'da-DK','冰岛语':'is-IS','葡萄牙语':'pt-PT',
      '罗马尼亚语':'ro-RO','乌克兰语':'uk-UA','波兰语':'pl-PL','捷克语':'cs-CZ','塞尔维亚语':'sr-RS',
      '保加利亚语':'bg-BG','波斯语':'fa-IR','希腊语':'el-GR','缅甸语':'my-MM','约鲁巴语':'yo-NG',
      '绍纳语':'sn-ZW','切罗基语':'chr','玛雅语':'yua','克丘亚语':'qu-PE','芬兰语':'fi-FI',
      '爱沙尼亚语':'et-EE','阿伊努语':'ain','夏威夷语':'haw-US','威尔士语':'cy-GB','爱尔兰语':'ga-IE',
      '布列塔尼语':'br-FR','苏格兰盖尔语':'gd-GB','格陵兰语':'kl-GL','纳瓦特尔语':'nah','泰米尔语':'ta-IN',
      '粤语':'zh-HK','孟加拉语':'bn-BD','豪萨语':'ha-NG','蒙古语':'mn-MN','马来语':'ms-MY',
      '普什图语':'ps-AF','梵语':'sa-IN','世界语':'eo','美国手语':null,'瓜拉尼语':'gn-PY',
      '阿姆哈拉语':'am-ET','菲律宾语':'fil-PH','海地克里奥尔语':'ht-HT'
    };
    // 把例句原文清洗为「纯原语言词」：先去括号内中文释义，再清首尾引号，保留词内撇号（如 t'aime）
    function cleanPhrase(p) {
      return String(p || '')
        .replace(/\s*[（(][^（）()]*[)）]\s*/g, '')        // 去括号及其中文释义
        .replace(/^\s*['"‘’]+/, '')                        // 去开头的引号
        .replace(/['"‘’]+\s*$/g, '')                       // 去结尾的引号
        .replace(/\s+/g, ' ').trim();
    }
    // 🔊 浏览器 TTS 朗读：读「原语言词」并用对应语种嗓音（lang 缺省回退中文）
    function speakText(text, btn, lang) {
      if (!text) return;
      if (!('speechSynthesis' in window)) { showToast('当前浏览器不支持语音朗读'); return; }
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang || 'zh-CN'; u.rate = 0.92; u.pitch = 1;
        if (btn) {
          btn.classList.add('speaking');
          u.onend = u.onerror = () => btn.classList.remove('speaking');
        }
        window.speechSynthesis.speak(u);
      } catch (e) { showToast('朗读失败'); }
    }

    /* ---- 统一的抽屉绘制器：支持淡入淡出丝滑切换 ----
       paint 为真正写入内容的回调。
       - 抽屉已展开：先把 #d-inner 淡出，替换内容后再淡入（内容级过渡）。
       - 抽屉未展开：直接写入内容，再滑出抽屉。 */
    const dInner = document.getElementById('d-inner');
    function paintDrawer(paint) {
      const isOpen = drawer.classList.contains('open');
      const commit = () => {
        paint();
        lucide.createIcons();       // 渲染新插入的图标
        dInner.style.opacity = '1';
      };
      if (isOpen) {
        // 内容淡出 → 替换 → 淡入
        dInner.style.opacity = '0';
        setTimeout(commit, 200);
      } else {
        commit();
        drawer.classList.add('open');
        scrim.classList.remove('hidden');
      }
    }

    /* ---- 渲染：语种详情（tree / fact / example / meme） ---- */
    let currentDbKey = null;   // 当前抽屉展示的语种（供手风琴内地图初始化用）
    function renderLanguage(dbKey) {
      const L = languageDatabase[dbKey];
      if (!L) return;
      currentDbKey = dbKey;

      document.getElementById('d-eyebrow').textContent = 'Language Profile · 语种';
      document.getElementById('d-name').textContent = L.name;

      // 谱系面包屑（按 ➔ 拆分 tree）
      const segs = L.tree.split('➔').map(s => s.trim());
      document.getElementById('d-lineage').innerHTML = segs.map((seg, i) => {
        const last = i === segs.length - 1;
        const chip = `<span class="px-2 py-0.5 rounded-md ${last ? 'bg-emerald/15 text-emerald border border-emerald/30' : 'bg-white/5 text-slate-400'}">${seg}</span>`;
        return chip + (last ? '' : `<i data-lucide="chevron-right" class="w-3 h-3 text-slate-600"></i>`);
      }).join('');

      const ex = parseExample(L.example);
      const speakLang = LOCALE_BY_KEY[dbKey];          // 手语等无口语语言为 null
      const speakPhrase = cleanPhrase(ex.phrase);       // 纯原语言词，供 TTS 朗读
      const canSpeak = !!speakLang && !!speakPhrase;
      const exampleHtml = ex.phrase ? `
          <p class="text-[26px] font-bold text-slate-50 leading-snug break-words tracking-tight" dir="auto">${ex.phrase}</p>
          <div class="mt-3.5 flex items-start gap-2.5">
            <i data-lucide="ear" class="w-4 h-4 text-brand mt-1 shrink-0"></i>
            <div>
              <div class="flex items-center gap-2">
                <p class="text-[15px] font-semibold text-brand leading-tight">拟音 · ${ex.pron}</p>
                ${canSpeak ? `<button class="speak-btn" data-speak="${escAttr(speakPhrase)}" data-lang="${escAttr(speakLang)}" title="听这门语言的原音" aria-label="听原音"><i data-lucide="volume-2" class="w-3.5 h-3.5"></i></button><span class="text-[11px] text-slate-500">原音</span>` : ''}
              </div>
              <p class="text-[13.5px] text-slate-400 leading-relaxed mt-1.5">${ex.feature}</p>
            </div>
          </div>
      ` : `<p class="text-[14.5px] leading-relaxed text-slate-300">${ex.feature}</p>`;

      // 冷知识暴击：控制在 60 字内，一针见血（超出则智能截断到句末）
      const punchline = clampFact(L.fact, 60);

      // 濒危程度可视化卡片（仅收录了濒危数据的语言展示）
      const vit = VITALITY[dbKey];
      const vitalityCard = vit ? `
        <div class="fade-up vit-card px-4 pt-1 pb-4">
          <div class="flex items-center justify-between mb-3">
            <span class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]" style="color:${vit.color}">
              <i data-lucide="flame" class="w-3.5 h-3.5"></i> 濒危程度
            </span>
            <span class="text-[11px] px-2.5 py-0.5 rounded-full" style="color:${vit.color};background:${vit.color}1f;border:1px solid ${vit.color}55">${vit.label}</span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-slate-50 tracking-tight">${formatSpeakers(vit.speakers)}</span>
            <span class="text-xs text-slate-500">仍在使用</span>
          </div>
          <div class="mt-3 h-1.5 rounded-full overflow-hidden" style="background:rgba(255,255,255,0.06)">
            <div class="h-full rounded-full vit-bar" style="width:${vit.vitality}%;background:linear-gradient(90deg,${vit.color}99,${vit.color});box-shadow:0 0 10px ${vit.color}66"></div>
          </div>
          <div class="flex justify-between mt-1 text-[10px] text-slate-600 tracking-wide">
            <span>濒临消失</span><span>语言活力</span><span>稳健存续</span>
          </div>
          <p class="text-[13px] text-slate-400 leading-relaxed mt-2.5">${vit.note}</p>
        </div>` : '';

      const onShelf = isOnShelf(dbKey);
      document.getElementById('d-body').innerHTML = `
        <button id="d-shelfBtn" class="d-shelf-btn ${onShelf ? 'on' : ''}" data-shelf>
          <i data-lucide="star" class="w-4 h-4"></i>
          <span>${onShelf ? '已在我的语言架' : '收进我的语言架'}</span>
        </button>

        <!-- 第一层（始终可见）：一句加粗冷知识暴击 -->
        <div class="fade-up px-4 pt-1 pb-5">
          <div class="flex items-center gap-1.5 mb-2.5 text-emerald/80">
            <i data-lucide="zap" class="w-3.5 h-3.5"></i>
            <span class="text-[10px] font-semibold uppercase tracking-[0.2em]">冷知识暴击</span>
          </div>
          <p class="text-[17px] font-semibold leading-relaxed text-slate-50">${punchline}</p>
        </div>

        ${vitalityCard}

        <!-- 第二层（默认展开）：全息像素地图 —— 点击语言即见分布 -->
        <div class="acc-item fade-up" data-acc data-acc-map style="animation-delay:.06s">
          <button class="acc-head" data-acc-head>
            <span class="flex items-center gap-2"><i data-lucide="map-pin" class="w-4 h-4 text-sky-300/80"></i> 全球分布地图</span>
            <i data-lucide="chevron-down" class="acc-chevron w-4 h-4"></i>
          </button>
          <div class="acc-body"><div><div class="acc-inner">
            <div id="language-map-container">${buildMapHTML(dbKey)}</div>
          </div></div></div>
        </div>

        <!-- 第三层（默认折叠）：文字与发音密码 -->
        <div class="acc-item fade-up" data-acc style="animation-delay:.1s">
          <button class="acc-head" data-acc-head>
            <span class="flex items-center gap-2"><i data-lucide="volume-2" class="w-4 h-4 text-brand/80"></i> 开启发音实例</span>
            <i data-lucide="chevron-down" class="acc-chevron w-4 h-4"></i>
          </button>
          <div class="acc-body"><div><div class="acc-inner">${exampleHtml}</div></div></div>
        </div>

        <!-- 第四层（默认折叠）：语法梗 -->
        <div class="acc-item fade-up" data-acc style="animation-delay:.14s">
          <button class="acc-head" data-acc-head>
            <span class="flex items-center gap-2"><i data-lucide="drama" class="w-4 h-4 text-purple-300/80"></i> 语法梗 · Meme</span>
            <i data-lucide="chevron-down" class="acc-chevron w-4 h-4"></i>
          </button>
          <div class="acc-body"><div><div class="acc-inner">
            <p class="text-[14.5px] leading-relaxed text-slate-300">${L.meme}</p>
          </div></div></div>
        </div>
      `;

      // 🔊 发音朗读按钮
      const _sb = document.querySelector('#d-body [data-speak]');
      if (_sb) _sb.addEventListener('click', (e) => { e.stopPropagation(); speakText(_sb.dataset.speak, _sb, _sb.dataset.lang); });

      // ⭐ 抽屉内「收藏到我的语言架」按钮
      const _sh = document.getElementById('d-shelfBtn');
      if (_sh) _sh.addEventListener('click', () => {
        toggleShelf(dbKey);
        const on = isOnShelf(dbKey);
        _sh.classList.toggle('on', on);
        _sh.querySelector('span').textContent = on ? '已在我的语言架' : '收进我的语言架';
        lucide.createIcons();
      });

      bindAccordions();

      // 打开词条即自动展开所有折叠栏（地图 / 发音 / 语法梗），省去手动点击
      document.querySelectorAll('#d-body [data-acc]').forEach(i => i.classList.add('open'));
      const mapItem = document.querySelector('#d-body [data-acc-map]');
      if (mapItem) mapItem.dataset.mapReady = '1';   // 标记已就绪，避免手风琴重复触发
      setupMap(dbKey);
    }

    // 冷知识截断：优先在标点处收尾，控制在 max 字内
    function clampFact(text, max) {
      if (text.length <= max) return text;
      const cut = text.slice(0, max);
      const m = cut.match(/^[\s\S]*[！!。？?、，,]/);
      return (m ? m[0] : cut) + '…';
    }

    // 绑定手风琴展开/收起（同一面板内互不干扰，可各自独立开合）
    function bindAccordions() {
      document.querySelectorAll('#d-body [data-acc]').forEach(item => {
        const head = item.querySelector('[data-acc-head]');
        head.addEventListener('click', () => {
          const wasOpen = item.classList.toggle('open');
          // 首次展开地图时触发 GPS 定位动效
          if (wasOpen && item.querySelector('#language-map-container') && !item.dataset.mapReady) {
            item.dataset.mapReady = '1';
            setupMap(currentDbKey);
          }
        });
      });
    }

    /* ---- 渲染：语系 / 语族 / 语支 宏观科普
       (title / evolution / languages / distribution / trivia) ---- */
    function renderCategory(key) {
      const c = categoryDatabase[key];
      if (!c) return;

      document.getElementById('d-eyebrow').textContent = c.type;
      document.getElementById('d-name').textContent = c.title;

      // trivia 为可选字段：新增的非洲/美洲语系没有该字段，则省略该卡片
      const triviaHtml = c.trivia ? `
        <div class="acc-item fade-up" data-acc style="animation-delay:.14s">
          <button class="acc-head" data-acc-head>
            <span class="flex items-center gap-2"><i data-lucide="sparkles" class="w-4 h-4 text-emerald/80"></i> 宏观冷知识 · 装b指南</span>
            <i data-lucide="chevron-down" class="acc-chevron w-4 h-4"></i>
          </button>
          <div class="acc-body"><div><div class="acc-inner">
            <p class="text-[14.5px] leading-relaxed text-slate-200">${c.trivia}</p>
          </div></div></div>
        </div>` : '';

      // 顶部用一个类型徽章替代语种的谱系面包屑
      document.getElementById('d-lineage').innerHTML =
        `<span class="px-2 py-0.5 rounded-md bg-brand/15 text-brand border border-brand/30 flex items-center gap-1">
           <i data-lucide="layers" class="w-3 h-3"></i>${key}
         </span>`;

      // 主要语言：拆成 chips
      const langChips = c.languages.split(/[、,，]/).map(s => s.trim()).filter(Boolean)
        .map(l => `<span class="px-2.5 py-1 rounded-lg bg-white/5 border border-white/8 text-slate-200 text-[13px]">${l}</span>`).join('');

      document.getElementById('d-body').innerHTML = `
        <!-- 历史与演进（始终可见，加粗一句主结论） -->
        <div class="fade-up px-4 pt-1 pb-5">
          <div class="flex items-center gap-1.5 mb-2.5 text-brand/80">
            <i data-lucide="scroll-text" class="w-3.5 h-3.5"></i>
            <span class="text-[10px] font-semibold uppercase tracking-[0.2em]">历史与演进</span>
          </div>
          <p class="text-[15px] leading-relaxed text-slate-50">${c.evolution}</p>
        </div>

        <!-- 主要语言（折叠） -->
        <div class="acc-item fade-up" data-acc style="animation-delay:.06s">
          <button class="acc-head" data-acc-head>
            <span class="flex items-center gap-2"><i data-lucide="languages" class="w-4 h-4 text-emerald/80"></i> 主要语言</span>
            <i data-lucide="chevron-down" class="acc-chevron w-4 h-4"></i>
          </button>
          <div class="acc-body"><div><div class="acc-inner">
            <div class="flex flex-wrap gap-2">${langChips}</div>
          </div></div></div>
        </div>

        <!-- 国家与分布（折叠） -->
        <div class="acc-item fade-up" data-acc style="animation-delay:.1s">
          <button class="acc-head" data-acc-head>
            <span class="flex items-center gap-2"><i data-lucide="globe-2" class="w-4 h-4 text-sky-300/80"></i> 国家与分布</span>
            <i data-lucide="chevron-down" class="acc-chevron w-4 h-4"></i>
          </button>
          <div class="acc-body"><div><div class="acc-inner">
            <p class="text-[14.5px] leading-relaxed text-slate-400">${c.distribution}</p>
          </div></div></div>
        </div>

        ${triviaHtml}
      `;
      bindAccordions();
      // 打开语系词条即自动展开全部折叠栏
      document.querySelectorAll('#d-body [data-acc]').forEach(i => i.classList.add('open'));
    }

    /* ---- 对外入口：打开语种 / 打开语系语族 ---- */
    function openLanguage(dbKey) { paintDrawer(() => renderLanguage(dbKey)); }
    function openCategory(key)   { paintDrawer(() => renderCategory(key)); }

    /* ---- 谱系树节点 → 知识卡片（语言 / 语系 / 语支 全覆盖）---- */
    function openTreeCard(id) {
      const node = treeNodeById[id];
      if (!node) return;
      if (node.kind === 'leaf') { openLanguage(node.dbKey); return; }
      const key = categoryKeyOf(node.label);   // 命中语系/语族词条 → 用现成丰富卡片
      if (key) { openCategory(key); return; }
      paintDrawer(() => renderTreeNode(node));  // 否则动态生成概览卡
    }

    // 为没有现成语系词条的节点（如“亚非语系”“南岛语系”“孤立语言”及各语支）生成同款概览卡
    function renderTreeNode(node) {
      const isFamily = node.kind === 'family';
      // 谱系面包屑：向上回溯到根
      const segs = [];
      let p = node;
      while (p && p.kind !== 'root') { segs.unshift(p.label); p = p.parent; }

      document.getElementById('d-eyebrow').textContent = isFamily ? '语系总览 (Language Family)' : '分支总览 (Branch)';
      document.getElementById('d-name').textContent = node.label;
      document.getElementById('d-lineage').innerHTML = segs.map((seg, i) => {
        const last = i === segs.length - 1;
        return `<span class="px-2 py-0.5 rounded-md ${last ? 'bg-brand/15 text-brand border border-brand/30' : 'bg-white/5 text-slate-400'}">${seg}</span>`
             + (last ? '' : `<i data-lucide="chevron-right" class="w-3 h-3 text-slate-600"></i>`);
      }).join('');

      // 收集后代语言与下级分支
      const leaves = [];
      (function collect(n) { if (n.kind === 'leaf' && n.dbKey) leaves.push(n.dbKey); else n.children.forEach(collect); })(node);
      const subBranches = node.children.filter(c => c.kind !== 'leaf');
      const langChips = leaves.length
        ? leaves.map(k => `<button class="px-2.5 py-1 rounded-lg bg-white/5 border border-white/8 text-slate-200 text-[13px] hover:border-brand/40 transition-colors" data-open-lang="${k}">${languageDatabase[k].name.split(' ')[0]}</button>`).join('')
        : '<span class="text-[13px] text-slate-500">（暂无收录成员语言）</span>';
      const branchChips = subBranches.length
        ? subBranches.map(c => `<span class="px-2.5 py-1 rounded-lg bg-white/5 border border-white/8 text-slate-300 text-[13px]">${c.label}</span>`).join('')
        : '';

      const intro = `该${isFamily ? '语系' : '分支'}共收录 <b class="text-slate-100">${leaves.length}</b> 种语言`
        + (subBranches.length ? `，下分 <b class="text-slate-100">${subBranches.length}</b> 个下级分支` : '')
        + '。点击成员语言可直达其详情卡片。';

      document.getElementById('d-body').innerHTML = `
        <div class="fade-up px-4 pt-1 pb-5">
          <div class="flex items-center gap-1.5 mb-2.5 text-brand/80">
            <i data-lucide="git-branch" class="w-3.5 h-3.5"></i>
            <span class="text-[10px] font-semibold uppercase tracking-[0.2em]">谱系概览</span>
          </div>
          <p class="text-[15px] leading-relaxed text-slate-50">${intro}</p>
        </div>
        <div class="acc-item fade-up" data-acc style="animation-delay:.06s">
          <button class="acc-head" data-acc-head>
            <span class="flex items-center gap-2"><i data-lucide="languages" class="w-4 h-4 text-emerald/80"></i> 成员语言（${leaves.length}）</span>
            <i data-lucide="chevron-down" class="acc-chevron w-4 h-4"></i>
          </button>
          <div class="acc-body"><div><div class="acc-inner"><div class="flex flex-wrap gap-2">${langChips}</div></div></div></div>
        </div>
        ${subBranches.length ? `
        <div class="acc-item fade-up" data-acc style="animation-delay:.1s">
          <button class="acc-head" data-acc-head>
            <span class="flex items-center gap-2"><i data-lucide="layers" class="w-4 h-4 text-sky-300/80"></i> 下级分支（${subBranches.length}）</span>
            <i data-lucide="chevron-down" class="acc-chevron w-4 h-4"></i>
          </button>
          <div class="acc-body"><div><div class="acc-inner"><div class="flex flex-wrap gap-2">${branchChips}</div></div></div></div>
        </div>` : ''}
      `;
      // 成员语言可点击直达详情
      document.querySelectorAll('#d-body [data-open-lang]').forEach(b => b.addEventListener('click', () => openLanguage(b.dataset.openLang)));
      bindAccordions();
      document.querySelectorAll('#d-body [data-acc]').forEach(i => i.classList.add('open'));
    }

    function closeDrawer() {
      drawer.classList.remove('open');
      scrim.classList.add('hidden');
      network.unselectAll();
    }
    document.getElementById('closeDrawer').addEventListener('click', () => { lockedNode = null; closeDrawer(); clearFocus(); });
    scrim.addEventListener('click', () => { lockedNode = null; closeDrawer(); clearFocus(); });

    /* =========================================================
       5. 动态收拢 / 绽放机制
    ========================================================= */
    /* ---- 浏览模式：all(全局) / common(常用) / endangered(濒危) ---- */
    // 常用：全球主要通用语
    const COMMON_LANGS = ['中文','英语','西班牙文','阿拉伯文','印地文','葡萄牙语','俄文','日文','德文','法文','韩文','意大利文','土耳其文','越南文','波斯语','泰文','印度尼西亚文','波兰语','泰米尔语','孟加拉语','马来语','豪萨语','蒙古语','粤语'];
    // 濒危 / 脆弱 / 复兴中的语言（保护与宣传）
    const ENDANGERED_LANGS = ['纳瓦霍语','切罗基语','玛雅语','克丘亚语','毛利语','巴斯克文','藏文',
      '阿伊努语','夏威夷语','威尔士语','爱尔兰语','布列塔尼语','苏格兰盖尔语','格陵兰语','纳瓦特尔语'];

    // 濒危程度数据：speakers 使用人数 · label 分级 · vitality 语言活力值(0-100) · color 暖色档 · note 说明
    const VITALITY = {
      '切罗基语': { speakers: 2000,    label: '重度濒危', vitality: 12, color: '#E06B5A', note: '流利使用者已不足两千，且绝大多数是高龄长者。' },
      '纳瓦霍语': { speakers: 170000,  label: '濒危',     vitality: 42, color: '#E0955A', note: '美国最大的原住民语言，但年轻一代正快速流失。' },
      '毛利语':   { speakers: 150000,  label: '复兴中',   vitality: 50, color: '#93B87A', note: '曾濒临消失，靠“语言巢”运动强力抢救回来。' },
      '玛雅语':   { speakers: 770000,  label: '脆弱',     vitality: 55, color: '#D9B36B', note: '尤卡坦玛雅语仍有数十万使用者，但年轻人越来越少。' },
      '藏文':     { speakers: 1200000, label: '脆弱',     vitality: 55, color: '#D9B36B', note: '使用者众多，却在城市与教育中逐步让位于主流语言。' },
      '克丘亚语': { speakers: 8000000, label: '脆弱',     vitality: 60, color: '#D9B36B', note: '南美使用最多的原住民语言，仍面临西班牙语的持续挤压。' },
      '巴斯克文': { speakers: 750000,  label: '脆弱·复兴', vitality: 66, color: '#B7C07A', note: '欧洲最古老的孤立语，近年靠教育稳步回升。' },
      // —— 追加 ——
      '阿伊努语':     { speakers: 10,      label: '极度濒危', vitality: 4,  color: '#D9604A', note: '日本北海道原住民语言，母语者仅存个位数，被列为极度濒危。' },
      '夏威夷语':     { speakers: 24000,   label: '复兴中',   vitality: 48, color: '#93B87A', note: '曾被禁教濒临灭绝，靠沉浸式母语学校强力复兴，重回官方语言。' },
      '威尔士语':     { speakers: 560000,  label: '脆弱·复兴', vitality: 64, color: '#B7C07A', note: '凯尔特语复兴样板，靠双语教育使用者数量稳步回升。' },
      '爱尔兰语':     { speakers: 70000,   label: '濒危',     vitality: 38, color: '#E0955A', note: '名义上是爱尔兰第一官方语言，日常母语者却仅集中在西部保护区。' },
      '布列塔尼语':   { speakers: 210000,  label: '重度濒危', vitality: 22, color: '#E06B5A', note: '法国布列塔尼的凯尔特语，因长期打压使用者锐减且高度老龄化。' },
      '苏格兰盖尔语': { speakers: 57000,   label: '濒危',     vitality: 34, color: '#E0955A', note: '苏格兰高地与岛屿的古老语言，使用人口持续萎缩。' },
      '格陵兰语':     { speakers: 57000,   label: '脆弱',     vitality: 58, color: '#D9B36B', note: '格陵兰官方语言，使用比例高，但面临丹麦语与英语压力。' },
      '纳瓦特尔语':   { speakers: 1700000, label: '脆弱',     vitality: 50, color: '#D9B36B', note: '阿兹特克帝国的语言，至今上百万人使用，却因西语同化逐代流失。' },
    };
    // 使用人数格式化：亿 / 万 / 人
    function formatSpeakers(n) {
      if (n >= 1e8) return '约 ' + (n / 1e8) + ' 亿人';
      if (n >= 1e4) return '约 ' + (n / 1e4) + ' 万人';
      return '约 ' + n.toLocaleString() + ' 人';
    }

    /* =========================================================
       5.5 属性标签系统（用于筛选侧栏 + 属性搜索）
       —— 维度与可选项定义 —— */
    const ATTR_DIMS = [
      { id: 'status', name: '存续状态', opts: [
        { id: 'common',     label: '主要通用语' },
        { id: 'endangered', label: '濒危' },
        { id: 'reviving',   label: '复兴中' },
        { id: 'isolate',    label: '孤立语言' },
        { id: 'classical',  label: '古典语言' },
      ]},
      { id: 'writing', name: '文字系统', opts: [
        { id: 'logographic', label: '表意·汉字' },
        { id: 'abjad',       label: '辅音音素' },
        { id: 'abugida',     label: '元音附标' },
        { id: 'syllabary',   label: '音节文字' },
        { id: 'vertical',    label: '竖写文字' },
        { id: 'rtl',         label: '从右往左' },
      ]},
      { id: 'phon', name: '语音特征', opts: [
        { id: 'tonal',    label: '有声调' },
        { id: 'click',    label: '搭嘴音' },
        { id: 'ejective', label: '挤喉音' },
      ]},
    ];
    // 平铺索引（供搜索/筛选快速定位 label 与所属维度）
    const ATTR_FLAT = [];
    ATTR_DIMS.forEach(d => d.opts.forEach(o => ATTR_FLAT.push({ id: o.id, label: o.label, dim: d.id, dimName: d.name })));
    // 显式标注（其余维度由现有数据自动推导，见下）
    const MANUAL_ATTRS = {
      '中文':['logographic','tonal'], '粤语':['logographic','tonal'], '日文':['logographic','syllabary'],
      '泰文':['abugida','tonal'], '越南文':['abugida','tonal'], '缅甸语':['abugida','tonal'], '藏文':['abugida','tonal'],
      '印地文':['abugida'], '孟加拉语':['abugida'], '梵语':['abugida','classical'],
      '阿拉伯文':['abjad','rtl'], '希伯来文':['abjad','rtl'],
      '蒙古语':['vertical'], '祖鲁语':['click'],
      '豪萨语':['tonal','ejective'], '约鲁巴语':['tonal'],
      '纳瓦霍语':['ejective'], '玛雅语':['ejective'], '普什图语':['ejective'], '切罗基语':['syllabary'],
    };
    // 每门语言的最终属性集合（自动推导 + 手动标注合并）
    const LANG_ATTRS = {};
    Object.keys(languageDatabase).forEach(k => {
      const set = new Set(MANUAL_ATTRS[k] || []);
      if (COMMON_LANGS.includes(k)) set.add('common');
      if (VITALITY[k]) {
        set.add('endangered');
        if ((VITALITY[k].label || '').includes('复兴')) set.add('reviving');
      }
      const fam = (LEAF_PATHS[k] || [])[0] || '';
      if (fam.includes('孤立')) set.add('isolate');
      LANG_ATTRS[k] = set;
    });
    // 反向索引：属性 id → 拥有该属性的语言集合（供“属性搜索”快速命中）
    const ATTR_INDEX = {};
    ATTR_FLAT.forEach(o => { ATTR_INDEX[o.id] = new Set(); });
    Object.keys(LANG_ATTRS).forEach(k => LANG_ATTRS[k].forEach(a => { if (ATTR_INDEX[a]) ATTR_INDEX[a].add(k); }));

    // 当前激活的筛选（维度 → 选项集合）；对象为空 = 不过滤
    const activeFilters = {};
    function langPassesFilter(k) {
      for (const dim in activeFilters) {
        const sel = activeFilters[dim];
        if (!sel || !sel.size) continue;
        const attrs = LANG_ATTRS[k];
        let hit = false;
        for (const opt of sel) if (attrs.has(opt)) { hit = true; break; }
        if (!hit) return false;
      }
      return true;
    }
    function activeFilterCount() {
      let n = 0; for (const d in activeFilters) n += (activeFilters[d] ? activeFilters[d].size : 0); return n;
    }
    function clearFilters() {
      for (const d in activeFilters) delete activeFilters[d];
      syncFilterUI();
      syncFiltersToView();
    }

    // 濒危模式下按“语言活力”重塑节点：使用人数越少 → 越小越暗，如将熄的烛火
    const endangeredOrig = {};
    function applyEndangeredNodeStyle(on) {
      ENDANGERED_LANGS.forEach(k => {
        const id = 'leaf:' + k;
        const n = data.nodes.get(id);
        if (!n) return;
        if (on) {
          if (!endangeredOrig[id]) endangeredOrig[id] = { size: n.size, color: n.color, shadow: n.shadow, opacity: n.opacity };
          const v = VITALITY[k] || { speakers: 1000, color: '#D9B36B', vitality: 40 };
          const size = Math.max(7, Math.min(22, 6 + (Math.log10(v.speakers) - 3) * 4)); // 人数→节点大小
          const op = 0.4 + v.vitality / 100 * 0.55;                                     // 活力→明暗
          data.nodes.update({
            id, size, opacity: op,
            color: { background: v.color, border: v.color,
                     highlight: { background: '#F7E2B8', border: '#FFFFFF' }, hover: { background: '#F7E2B8', border: '#FFFFFF' } },
            shadow: { enabled: true, color: hexA(v.color, 0.6), size: 14, x: 0, y: 0 },
          });
        } else if (endangeredOrig[id]) {
          const o = endangeredOrig[id];
          data.nodes.update({ id, size: o.size, color: o.color, shadow: o.shadow, opacity: o.opacity === undefined ? 1 : o.opacity });
        }
      });
    }

    let currentMode = 'all';
    let modeLeafSet = null;       // null = 全部；否则为当前模式的语种集合
    let expandedFamily = null;    // 当前已绽放的语系节点 id

    // 某节点在当前「浏览模式 + 属性筛选」下是否应参与显示
    function nodeModeVisible(n) {
      if (!n || n.kind === 'root') return true;
      // 1) 浏览模式过滤（all 不过滤）
      if (modeLeafSet) {
        if (n.kind === 'leaf') { if (!modeLeafSet.has(n.dbKey)) return false; }
        else if (n.descLeaves) {
          let mv = false;
          for (const k of n.descLeaves) if (modeLeafSet.has(k)) { mv = true; break; }
          if (!mv) return false;
        }
      }
      // 2) 属性筛选（leaf 直接判断；中间层/语系看是否含通过筛选的后代）
      if (n.kind === 'leaf') return langPassesFilter(n.dbKey);
      if (n.descLeaves) { for (const k of n.descLeaves) if (langPassesFilter(k)) return true; }
      return false;
    }

    // 统一按「模式 + 展开态」重算所有节点/连线可见性
    function refreshVisibility() {
      const nodeUpd = [], edgeUpd = [];
      data.nodes.forEach(n => {
        const mv = nodeModeVisible(n);
        // 语系/叶子/根：模式内即显示；中间层：还需其所属语系已绽放
        const hidden = (n.collapsible) ? (!mv || expandedFamily !== n.familyRoot) : !mv;
        if (n.hidden !== hidden) nodeUpd.push({ id: n.id, hidden });
      });
      data.edges.forEach(e => {
        const bothIn = nodeModeVisible(data.nodes.get(e.from)) && nodeModeVisible(data.nodes.get(e.to));
        const hidden = e.collapsible ? (!bothIn || expandedFamily !== e.familyRoot) : !bothIn;
        if (e.hidden !== hidden) edgeUpd.push({ id: e.id, hidden });
      });
      if (nodeUpd.length) data.nodes.update(nodeUpd);
      if (edgeUpd.length) data.edges.update(edgeUpd);
    }

    // 绽放某语系：显示其下属中间层（并收起其它语系）
    function expandFamily(familyId) {
      if (expandedFamily === familyId) return;
      expandedFamily = familyId;
      refreshVisibility();
      // 短暂开启物理引擎让新节点就近排布，再冻结
      network.setOptions({ physics: { enabled: true } });
      clearTimeout(expandFamily._t);
      expandFamily._t = setTimeout(() => network.setOptions({ physics: { enabled: false } }), 900);
    }

    // 收拢所有中间层
    function collapseAll(reset = true) {
      if (reset) expandedFamily = null;
      refreshVisibility();
    }

    // 只对当前可见节点做自适应居中
    function fitVisible() {
      const ids = [];
      data.nodes.forEach(n => { if (!n.hidden) ids.push(n.id); });
      network.fit(ids.length ? { nodes: ids, animation: { duration: 700, easingFunction: 'easeInOutCubic' } }
                             : { animation: { duration: 700 } });
    }

    // 切换浏览模式
    function setMode(mode) {
      currentMode = mode;
      modeLeafSet = mode === 'all' ? null : new Set(mode === 'common' ? COMMON_LANGS : ENDANGERED_LANGS);
      expandedFamily = null;
      lockedNode = null;
      clearFocus();
      closeDrawer();
      syncFiltersToView();
      // 濒危模式：切暖色暮光氛围 + 按活力重塑节点
      const endangered = mode === 'endangered';
      document.body.classList.toggle('endangered-active', endangered);
      applyEndangeredNodeStyle(endangered);
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('mode-active', b.dataset.mode === mode));
      setTimeout(fitVisible, 80);
      if (mode === 'endangered') showToast('濒危语言保护模式 · 这些语言正逐渐消失，愿更多人记得它们');
      else if (mode === 'common') showToast('常用语言模式 · 只显示全球主要通用语');
    }

    // 搜索/快捷定位到当前模式外的语言时，自动切回全局（轻量、不重排镜头）
    function ensureVisible(dbKey) {
      if (modeLeafSet && !modeLeafSet.has(dbKey)) {
        currentMode = 'all'; modeLeafSet = null; expandedFamily = null; lockedNode = null;
        refreshVisibility();
        document.body.classList.remove('endangered-active');
        applyEndangeredNodeStyle(false);
        document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('mode-active', b.dataset.mode === 'all'));
      }
    }

    /* ---- 选中聚焦：高亮所选语言的整条归属链，其余大幅降亮 ---- */
    const focusBaseNode = new Map();   // 记录聚焦前各节点的基准透明度，便于还原
    let focusActive = false;

    // 目标节点的“相关集合” = 其祖先链（归属）∪ 其后代（下辖）
    function focusSetOf(targetId) {
      const set = new Set();
      let cur = targetId;
      while (cur) { set.add(cur); cur = parentOf[cur]; }                 // 向上：祖先归属链
      data.nodes.forEach(n => {                                         // 向下：所有以 target 为祖先的后代
        let c = n.id;
        while (c) { if (c === targetId) { set.add(n.id); break; } c = parentOf[c]; }
      });
      return set;
    }

    function applyFocus(targetId) {
      clearFocus();
      const set = focusSetOf(targetId);
      const nodeUpd = [], edgeUpd = [];
      data.nodes.forEach(n => {
        const base = n.opacity === undefined ? 1 : n.opacity;
        focusBaseNode.set(n.id, base);
        // 目标最亮；相关项保留其原始明度；无关项大幅降亮
        const op = n.id === targetId ? 1 : (set.has(n.id) ? base : 0.1);
        nodeUpd.push({ id: n.id, opacity: op });
      });
      data.edges.forEach(e => {
        const on = set.has(e.from) && set.has(e.to) && !e.hidden;       // 归属链上的连线点亮，其余隐去
        edgeUpd.push({ id: e.id, color: { ...e.color, color: on ? hexA(e.neon, 0.9) : 'rgba(255,255,255,0.02)' } });
      });
      data.nodes.update(nodeUpd);
      data.edges.update(edgeUpd);
      focusActive = true;
    }

    function clearFocus() {
      if (!focusActive) return;
      const nodeUpd = [], edgeUpd = [];
      data.nodes.forEach(n => nodeUpd.push({ id: n.id, opacity: focusBaseNode.has(n.id) ? focusBaseNode.get(n.id) : 1 }));
      data.edges.forEach(e => edgeUpd.push({ id: e.id, color: { ...e.color, color: EDGE_IDLE } }));
      data.nodes.update(nodeUpd);
      data.edges.update(edgeUpd);
      focusBaseNode.clear();
      focusActive = false;
    }

    /* =========================================================
       6. 节点交互
    ========================================================= */
    let lockedNode = null;     // 已锁定聚焦的节点 id（双击锁定后，拖动视图不丢失高亮）
    let clickTimer = null;     // 单击防抖：区分单击 / 双击

    // 执行“选中一个节点”的动作：绽放谱系 + 聚焦高亮 + 弹出面板
    function selectLanguageNode(node) {
      const catKey = categoryKeyOf(node.plain);
      if (node.kind === 'leaf' && node.dbKey) {
        if (node.familyRoot) expandFamily(node.familyRoot);
        focusNode(node.id);
        openLanguage(node.dbKey);
      } else if (node.kind === 'family') {
        expandFamily(node.id);
        focusNode(node.id, 0.9);
        if (catKey) openCategory(catKey); else closeDrawer();
      } else if (catKey) {
        focusNode(node.id, 1.2);
        openCategory(catKey);
      } else {
        closeDrawer();
        focusNode(node.id, node.kind === 'root' ? null : 1.1);
      }
    }

    function unlockFocus() {
      lockedNode = null;
      clearFocus();
      closeDrawer();
    }

    // —— 单击：选中某语言，并【持久保持】其余变暗；空白单击不清除，可自由拖动查看 ——
    function handleSingleClick(params) {
      if (params.nodes.length === 0) return;   // 空白单击：保持当前高亮与变暗
      const node = data.nodes.get(params.nodes[0]);
      lockedNode = node.id;                     // 持久选中
      selectLanguageNode(node);                 // 高亮其归属链，其余持续变暗
    }

    // —— 双击：取消当前选中（恢复全部亮度）；双击其它语言则直接切换 ——
    function handleDoubleClick(params) {
      if (params.nodes.length === 0) { unlockFocus(); return; }
      const node = data.nodes.get(params.nodes[0]);
      if (lockedNode === node.id) unlockFocus();               // 双击已选中项 → 取消，恢复亮度
      else { lockedNode = node.id; selectLanguageNode(node); } // 双击其它 → 切换选中
    }

    network.on('click', (params) => {
      if (clickTimer) return;          // 双击的第二次 click 忽略
      clickTimer = setTimeout(() => { clickTimer = null; handleSingleClick(params); }, 240);
    });
    network.on('doubleClick', (params) => {
      clearTimeout(clickTimer); clickTimer = null;
      handleDoubleClick(params);
    });

    network.on('hoverNode', () => container.style.cursor = 'pointer');
    network.on('blurNode', () => container.style.cursor = 'default');

    function focusNode(nodeId, scale = 1.4) {
      const opt = { animation: { duration: 800, easingFunction: 'easeInOutCubic' } };
      if (scale) opt.scale = scale;
      network.focus(nodeId, opt);
      network.selectNodes([nodeId]);
      applyFocus(nodeId);          // 高亮归属链，其余降亮
    }

    /* =========================================================
       6. 搜索：定位 + 放大 + 开面板
    ========================================================= */
    function findDbKey(q) {
      q = q.trim().toLowerCase();
      if (!q) return null;
      // 第一轮：精确匹配键名 / 语言名（去掉 文/语 后缀也能命中）
      for (const key in languageDatabase) {
        const L = languageDatabase[key];
        const hay = (key + ' ' + L.name).toLowerCase();
        if (hay.includes(q) || key.replace(/[文语]$/, '').includes(q) || L.name.includes(q)) return key;
      }
      // 第二轮：全文关键词兜底（如“风语者”命中纳瓦霍语、“狮子王”命中斯瓦希里语）
      for (const key in languageDatabase) {
        const L = languageDatabase[key];
        const blob = (L.fact + ' ' + L.example + ' ' + L.meme + ' ' + L.tree).toLowerCase();
        if (blob.includes(q)) return key;
      }
      return null;
    }

    // 跳转到某语言 / 某语系节点（供搜索与预测下拉共用）
    function goToLanguage(key) {
      clearFilters();          // 显式导航时解除属性筛选，确保目标可见
      ensureVisible(key);
      const leafId = 'leaf:' + key;
      const leaf = data.nodes.get(leafId);
      if (leaf && leaf.familyRoot) expandFamily(leaf.familyRoot);
      lockedNode = leafId;
      focusNode(leafId);
      setTimeout(() => openLanguage(key), 350);
    }
    function goToCategoryNode(label) {
      const id = 'lvl:' + label;
      const node = data.nodes.get(id);
      const catKey = categoryKeyOf(label);
      if (node) {
        if (node.kind === 'family') expandFamily(id);
        lockedNode = id;
        focusNode(id, node.kind === 'family' ? 0.9 : 1.2);
      }
      if (catKey) setTimeout(() => openCategory(catKey), 350);
    }

    function runSearch(raw) {
      const val = (raw ?? document.getElementById('searchInput').value).trim();
      if (!val) return;
      lockedNode = null;
      hideSuggest();
      const key = findDbKey(val);
      if (key) { goToLanguage(key); return; }
      const hit = data.nodes.get().find(n => n.plain && n.plain.toLowerCase().includes(val.toLowerCase()));
      if (hit && categoryKeyOf(hit.plain)) goToCategoryNode(hit.plain);
      else if (hit) { lockedNode = hit.id; focusNode(hit.id, hit.kind === 'family' ? 0.95 : 1.3); }
      else {
        // 第二轮：属性关键词（如“声调”“竖写”“濒危”→ 按属性筛选）
        const attr = ATTR_FLAT.find(o => o.label.includes(val) || o.id.toLowerCase() === val.toLowerCase());
        if (attr) { applyAttrFilter(attr.id); return; }
        showToast(`没有找到「${val}」，试试：中文 / 日语 / 阿拉伯语 / 巴斯克语…`);
      }
    }

    /* =========================================================
       6.5 搜索引擎式实时预测下拉
    ========================================================= */
    const searchInputEl = document.getElementById('searchInput');
    const suggestEl = document.getElementById('searchSuggest');
    const searchArea = document.getElementById('searchArea');
    let sgItems = [];    // 当前候选 [{type,key}]
    let sgActive = -1;   // 键盘高亮下标

    // 可跳转的“语系/语族”节点标签（带科普面板的）
    const CAT_LABELS = [];
    { const seen = new Set();
      data.nodes.forEach(n => {
        if ((n.kind === 'family' || n.kind === 'sub' || n.kind === 'branch') && categoryKeyOf(n.plain) && !seen.has(n.plain)) {
          seen.add(n.plain); CAT_LABELS.push(n.plain);
        }
      });
    }

    const escHtml = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    function hl(text, q) {
      const i = text.toLowerCase().indexOf(q);
      if (i < 0) return escHtml(text);
      return escHtml(text.slice(0, i)) + '<b>' + escHtml(text.slice(i, i + q.length)) + '</b>' + escHtml(text.slice(i + q.length));
    }

    // 打分：名字前缀 > 名字包含 > 英文 > 语系名 > 正文关键词
    function scoreLang(key, q) {
      const L = languageDatabase[key];
      const disp = L.name.split(' ')[0];
      const en = L.name.toLowerCase();
      if (key.startsWith(q) || disp.startsWith(q)) return 100;
      if (en.startsWith(q) || en.includes('(' + q) || en.includes('/ ' + q)) return 92;
      if (key.includes(q) || disp.includes(q)) return 74;
      if (en.includes(q)) return 62;
      if (((LEAF_PATHS[key] || [])[0] || '').toLowerCase().includes(q)) return 42;
      if ((L.fact + L.example + L.meme + L.tree).toLowerCase().includes(q)) return 22;
      return 0;
    }
    function langTag(key) {
      if (ENDANGERED_LANGS.includes(key)) return '<span class="sg-tag" style="color:#D9A488;background:rgba(192,122,91,0.16)">濒危</span>';
      if (COMMON_LANGS.includes(key)) return '<span class="sg-tag" style="color:#B2BE96;background:rgba(138,154,107,0.16)">常用</span>';
      return '';
    }

    function renderSuggest(raw) {
      const q = (raw || '').trim().toLowerCase();
      sgActive = -1;
      if (!q) { hideSuggest(); return; }

      const scored = [];
      for (const key in languageDatabase) { const s = scoreLang(key, q); if (s > 0) scored.push({ key, s }); }
      scored.sort((a, b) => b.s - a.s || a.key.localeCompare(b.key, 'zh'));
      const langs = scored.slice(0, 8);
      const cats = CAT_LABELS.filter(l => l.toLowerCase().includes(q)).slice(0, 3);
      // 属性筛选建议（概念搜索，置于最前，方便“按属性看世界”）
      const attrHits = ATTR_FLAT.filter(o => o.label.toLowerCase().includes(q) || o.dimName.toLowerCase().includes(q) || o.id.includes(q)).slice(0, 4);

      sgItems = [];
      let html = '';
      if (attrHits.length) {
        html += '<div class="sg-head">按属性筛选</div>';
        attrHits.forEach(o => {
          const idx = sgItems.length;
          sgItems.push({ type: 'attr', id: o.id });
          html += `<div class="sg-item" data-idx="${idx}">
            <span class="sg-dot" style="background:#C6A15B;color:#C6A15B"></span>
            <span class="sg-name">${hl(o.label, q)}</span>
            <span class="sg-sub">属性 · ${escHtml(o.dimName)}</span>
          </div>`;
        });
      }
      if (langs.length) {
        html += '<div class="sg-head">语言</div>';
        langs.forEach(({ key }) => {
          const L = languageDatabase[key];
          const disp = L.name.split(' ')[0];
          const en = (L.name.match(/\(([^)\/]+)/) || [, ''])[1].trim();
          const fam = (LEAF_PATHS[key] || [])[0] || '';
          const c = famColorOf(fam);
          const idx = sgItems.length;
          sgItems.push({ type: 'lang', key });
          html += `<div class="sg-item" data-idx="${idx}">
            <span class="sg-dot" style="background:${c};color:${c}"></span>
            <span class="sg-name">${hl(disp, q)}${en ? ` <span class="sg-en">${escHtml(en)}</span>` : ''}</span>
            ${langTag(key)}
            <span class="sg-sub">${escHtml(fam)}</span>
          </div>`;
        });
      }
      if (cats.length) {
        html += '<div class="sg-head">语系 · 语族</div>';
        cats.forEach(label => {
          const c = famColorOf(label);
          const idx = sgItems.length;
          sgItems.push({ type: 'cat', key: label });
          html += `<div class="sg-item" data-idx="${idx}">
            <span class="sg-dot" style="background:${c};color:${c}"></span>
            <span class="sg-name">${hl(label, q)}</span>
            <span class="sg-sub">谱系分支</span>
          </div>`;
        });
      }
      if (!sgItems.length) html = `<div class="sg-empty">未找到「${escHtml(raw.trim())}」· 试试其它名字或关键词</div>`;
      suggestEl.innerHTML = html;
      suggestEl.classList.add('show');
    }

    function hideSuggest() { suggestEl.classList.remove('show'); sgActive = -1; }

    function updateActive() {
      const els = suggestEl.querySelectorAll('.sg-item');
      els.forEach((el, i) => el.classList.toggle('active', i === sgActive));
      if (sgActive >= 0 && els[sgActive]) els[sgActive].scrollIntoView({ block: 'nearest' });
    }

    function chooseItem(i) {
      const it = sgItems[i];
      if (!it) return;
      lockedNode = null;
      hideSuggest();
      if (it.type === 'lang') { searchInputEl.value = languageDatabase[it.key].name.split(' ')[0]; goToLanguage(it.key); }
      else if (it.type === 'attr') { searchInputEl.value = ''; applyAttrFilter(it.id); }
      else { searchInputEl.value = it.key; goToCategoryNode(it.key); }
      searchInputEl.blur();
    }

    searchInputEl.addEventListener('input', () => renderSuggest(searchInputEl.value));
    searchInputEl.addEventListener('focus', () => { if (searchInputEl.value.trim()) renderSuggest(searchInputEl.value); });
    searchInputEl.addEventListener('keydown', e => {
      const n = sgItems.length;
      if (e.key === 'ArrowDown' && n) { e.preventDefault(); sgActive = (sgActive + 1) % n; updateActive(); }
      else if (e.key === 'ArrowUp' && n) { e.preventDefault(); sgActive = (sgActive - 1 + n) % n; updateActive(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (n && sgActive >= 0) chooseItem(sgActive); else if (n) chooseItem(0); else runSearch(); }
      else if (e.key === 'Escape') { hideSuggest(); }
    });
    // mousedown 先于 input blur 触发，避免下拉在点击前消失
    suggestEl.addEventListener('mousedown', e => {
      const item = e.target.closest('.sg-item');
      if (item) { e.preventDefault(); chooseItem(+item.dataset.idx); }
    });
    document.addEventListener('click', e => { if (!searchArea.contains(e.target)) hideSuggest(); });

    document.getElementById('searchBtn').addEventListener('click', () => runSearch());

    /* =========================================================
       7. 快捷标签（自动生成几门代表性语言）
    ========================================================= */
    const QUICK = ['中文', '日文', '阿拉伯文', '斯瓦希里语', '纳瓦霍语', '毛利语', '泰米尔语', '蒙古语'];
    const quickWrap = document.getElementById('quickTags');
    QUICK.forEach(k => {
      const btn = document.createElement('button');
      btn.className = 'quick-tag px-3 py-1 rounded-full border border-transparent transition-colors';
      btn.textContent = languageDatabase[k].name.split(' ')[0];
      btn.addEventListener('click', () => {
        document.getElementById('searchInput').value = btn.textContent;
        ensureVisible(k);
        const leafId = 'leaf:' + k;
        const leaf = data.nodes.get(leafId);
        if (leaf && leaf.familyRoot) expandFamily(leaf.familyRoot);
        lockedNode = leafId;
        focusNode(leafId);
        setTimeout(() => openLanguage(k), 350);
      });
      quickWrap.appendChild(btn);
    });

    /* =========================================================
       8. 视图控制 + Toast
    ========================================================= */
    // 视图控制（图谱 / 地图 / 谱系树 统一缩放与复位）
    function currentViewZoom(factor) {
      if (viewMode === 'graph') { network.moveTo({ scale: network.getScale() * (factor < 1 ? 1.3 : 1 / 1.3), animation: { duration: 300 } }); return; }
      const svg = viewMode === 'map' ? document.getElementById('mapSvg') : document.getElementById('treeSvg');
      const r = svg.getBoundingClientRect();
      if (viewMode === 'map') mapZoom(factor, r.width / 2, r.height / 2); else treeZoom(factor, r.width / 2, r.height / 2);
    }
    function currentViewFit() {
      if (viewMode === 'graph') { network.fit({ animation: { duration: 700, easingFunction: 'easeInOutCubic' } }); return; }
      if (viewMode === 'map') { mapViewBox = { x: 0, y: 0, w: 360, h: 180 }; applyMapViewBox(); }
      else { treeViewBox = { x: -20, y: -20, w: treeSize.w + 40, h: Math.max(treeSize.h + 40, 300) }; applyTreeViewBox(); }
    }
    document.getElementById('zoomIn').addEventListener('click', () => currentViewZoom(0.82));
    document.getElementById('zoomOut').addEventListener('click', () => currentViewZoom(1.18));
    document.getElementById('fitBtn').addEventListener('click', () => {
      lockedNode = null; clearFocus();
      if (viewMode === 'graph') { closeDrawer(); collapseAll(); }
      currentViewFit();
    });

    let toastTimer = null;
    function showToast(msg) {
      const t = document.getElementById('toast');
      document.getElementById('toastText').textContent = msg;
      t.style.opacity = '1'; t.style.transform = 'translate(-50%, -6px)';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translate(-50%, 0)'; }, 2800);
    }

    /* 浏览模式切换：全局 / 常用 / 濒危 */
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    document.querySelector('[data-mode="all"]').classList.add('mode-active');   // 默认全局

    /* =========================================================
       9. 视图模式：关系图谱 ⇄ 世界地图
    ========================================================= */
    const graphEl = document.getElementById('graph');
    const mapEl = document.getElementById('mapView');
    const treeEl = document.getElementById('treeView');
    let viewMode = 'graph';
    let _graphFitT = null;            // 切回图谱后的居中动画定时器
    const SVGNS = 'http://www.w3.org/2000/svg';

    // 谱系树：构建的树结构与布局状态（惰性渲染）
    let treeRoot = null, treeSize = { w: 1000, h: 600 }, treeBuilt = false;
    const treeNodeById = {};
    let treeViewBox = { x: -20, y: -20, w: 1040, h: 640 };
    let treeMoved = false;

    // 计算某语言地理中心（取其所有所属国家的平均经纬度）
    function geoCentroid(dbKey) {
      const regs = (languageDatabase[dbKey] && languageDatabase[dbKey].geoRegions) || [];
      let lat = 0, lon = 0, n = 0;
      regs.forEach(id => { const c = GEO_COORDS[id]; if (c) { lat += c.lat; lon += c.lon; n++; } });
      return n ? { lat: lat / n, lon: lon / n } : null;
    }

    // 构建地图语言节点（在等距投影上撒点）
    function buildMapNodes() {
      let html = '';
      Object.keys(languageDatabase).forEach(k => {
        const g = geoCentroid(k);
        if (!g) return;
        const isEnd = !!VITALITY[k];
        const c = isEnd ? dangerColorOf(k) : langColorOf(k);
        const x = projX(g.lon).toFixed(1), y = projY(g.lat).toFixed(1);
        const disp = languageDatabase[k].name.split(' ')[0];
        const dur = (1.1 + Math.random() * 1.3).toFixed(2);
        html += `<g class="mpl ${isEnd ? 'endangered' : ''}" data-k="${k}" transform="translate(${x},${y})">
          ${isEnd ? `<circle class="mpl-ember" r="6.6" style="fill:${c};animation-duration:${dur}s"></circle>` : ''}
          <circle class="mpl-halo" r="5.4" style="fill:${c}"></circle>
          <circle class="mpl-dot" r="2.7" style="fill:${c}"></circle>
          <text class="mpl-label" x="4.2" y="1.2">${disp}</text>
        </g>`;
      });
      return html;
    }

    let mapNodesBuilt = false;
    function renderMap() {
      const svg = document.getElementById('mapSvg');
      if (!mapNodesBuilt) {
        svg.innerHTML = BASE_MAP_SVG + buildMapNodes();
        mapNodesBuilt = true;
      }
      applyMapFilter();
    }

    // 地图：应用当前属性筛选（未命中 → 暗淡且不可点）
    function applyMapFilter() {
      const anyFilter = activeFilterCount() > 0;
      mapEl.querySelectorAll('.mpl').forEach(g => {
        const pass = !anyFilter || langPassesFilter(g.dataset.k);
        g.classList.toggle('dim', !pass);
        g.style.pointerEvents = pass ? '' : 'none';
      });
    }

    // 地图平移 / 缩放（操作 viewBox）
    const mapViewBox = { x: 0, y: 0, w: 360, h: 180 };
    function applyMapViewBox() {
      document.getElementById('mapSvg').setAttribute('viewBox', `${mapViewBox.x} ${mapViewBox.y} ${mapViewBox.w} ${mapViewBox.h}`);
    }
    function mapZoom(factor, cx, cy) {
      const svg = document.getElementById('mapSvg');
      const rect = svg.getBoundingClientRect();
      const vx = mapViewBox.x + (cx / rect.width) * mapViewBox.w;
      const vy = mapViewBox.y + (cy / rect.height) * mapViewBox.h;
      const nw = Math.min(360, Math.max(45, mapViewBox.w * factor));
      const nh = nw / 2;
      mapViewBox.x = vx - (vx - mapViewBox.x) * (nw / mapViewBox.w);
      mapViewBox.y = vy - (vy - mapViewBox.y) * (nh / mapViewBox.h);
      mapViewBox.w = nw; mapViewBox.h = nh;
      applyMapViewBox();
    }

    // 通用平移 / 缩放（单指拖拽 + 双指捏合 pinch + 滚轮），供地图与谱系树共用
    // 移动端核心：touch-action:none 已就位，这里补齐双指捏合缩放
    function attachPanZoom(svg, zoomFn, vb, applyFn) {
      let dragging = false, lx = 0, ly = 0;
      svg._moved = false;
      const pts = new Map(); let lastDist = 0;
      svg.addEventListener('wheel', e => { e.preventDefault(); zoomFn(e.deltaY > 0 ? 1.15 : 0.87, e.offsetX, e.offsetY); }, { passive: false });
      svg.addEventListener('pointerdown', e => {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        svg._moved = false;
        if (pts.size === 1) { dragging = true; lx = e.clientX; ly = e.clientY; try { svg.setPointerCapture(e.pointerId); } catch (_) {} svg.classList.add('grabbing'); }
        else if (pts.size === 2) { dragging = false; svg.classList.remove('grabbing'); }
      });
      svg.addEventListener('pointermove', e => {
        if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) {                       // 双指捏合缩放
          const [a, b] = [...pts.values()];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (lastDist > 0) { const r = svg.getBoundingClientRect(); zoomFn(lastDist / dist, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); }
          lastDist = dist; svg._moved = true; return;
        }
        if (!dragging) return;
        const r = svg.getBoundingClientRect();
        vb.x -= (e.clientX - lx) / r.width * vb.w;
        vb.y -= (e.clientY - ly) / r.height * vb.h;
        lx = e.clientX; ly = e.clientY; svg._moved = true; applyFn();
      });
      const end = e => { pts.delete(e.pointerId); if (pts.size < 2) lastDist = 0; if (pts.size === 0) { dragging = false; svg.classList.remove('grabbing'); } };
      svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end); svg.addEventListener('pointerleave', end);
    }

    function setViewMode(m) {
      if (m === viewMode) return;
      viewMode = m;
      const isMap = m === 'map', isTree = m === 'tree';
      // 平滑过渡：旧视图淡出、新视图淡入（保留 display，靠 opacity 控制显隐，
      // 这样 vis.js 画布永不丢失尺寸，切回图谱无需重建，过渡更丝滑）
      graphEl.classList.toggle('is-active', !isMap && !isTree);
      mapEl.classList.toggle('is-active', isMap);
      treeEl.classList.toggle('is-active', isTree);
      document.body.classList.toggle('map-mode', isMap);
      if (isMap) { renderMap(); showToast('世界地图模式 · 语言散落在哪片土地，一眼可见'); }
      else if (isTree) { renderTree(); showToast('谱系树模式 · 一图看清“谁和谁是一家”'); }
      else {
        // 切回图谱：淡入结束后再做一次带动画的 fit，让节点重新居中
        clearTimeout(_graphFitT);
        _graphFitT = setTimeout(() => {
          if (viewMode !== 'graph') return;
          network.redraw();
          network.fit({ animation: { duration: 600, easingFunction: 'easeInOutCubic' } });
        }, 480);
      }
      document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('mode-active', b.dataset.view === m));
    }

    // 地图交互：滚轮 / 拖拽 / 双指捏合 缩放 + 点击打开详情
    function bindMapInteractions() {
      const svg = document.getElementById('mapSvg');
      attachPanZoom(svg, mapZoom, mapViewBox, applyMapViewBox);
      svg.addEventListener('click', e => {
        if (svg._moved) return;
        const g = e.target.closest('.mpl');
        if (!g || g.classList.contains('dim')) return;
        mapEl.querySelectorAll('.mpl.sel').forEach(x => x.classList.remove('sel'));
        g.classList.add('sel');
        openLanguage(g.dataset.k);
      });
    }

    /* =========================================================
       9.5 谱系树视图（第三种视图：力导向图认“分布”，树认“亲缘”）
       —— 由 LEAF_PATHS 构建层级树，横向 tidy 布局，支持平移/缩放/筛选 —— */
    function buildTree() {
      const root = { id: '__root', label: '人类语言', kind: 'root', fam: null, children: [], parent: null };
      const famMap = {};
      Object.keys(languageDatabase).forEach(dbKey => {
        const path = LEAF_PATHS[dbKey] || [];
        const fam = path[0]; if (!fam) return;
        if (!famMap[fam]) { const fn = { id: 'fam:' + fam, label: fam, kind: 'family', fam, children: [], parent: root }; famMap[fam] = fn; root.children.push(fn); }
        let parent = famMap[fam];
        for (let i = 1; i < path.length; i++) {
          const lbl = path[i];
          let child = parent.children.find(c => c.label === lbl);
          if (!child) { child = { id: 'mid:' + fam + ':' + lbl, label: lbl, kind: 'mid', fam, children: [], parent }; parent.children.push(child); }
          parent = child;
        }
        parent.children.push({ id: 'leaf:' + dbKey, label: languageDatabase[dbKey].name.split(' ')[0], kind: 'leaf', dbKey, fam, children: [], parent });
      });
      return root;
    }
    const TREE_COL_W = 200, TREE_ROW_H = 22;
    function layoutTree(root) {
      let nextY = 0, maxDepth = 0;
      (function rec(n, depth) {
        n.depth = depth; n.x = depth * TREE_COL_W; if (depth > maxDepth) maxDepth = depth;
        if (!n.children.length) { n.y = nextY; nextY += TREE_ROW_H; }
        else { n.children.forEach(c => rec(c, depth + 1)); n.y = (n.children[0].y + n.children[n.children.length - 1].y) / 2; }
      })(root, 0);
      treeSize = { w: (maxDepth + 1) * TREE_COL_W, h: nextY };
    }
    function treeDangerLevel(n) {
      if (n.kind === 'leaf') return dangerLevelOf(n.dbKey);
      let worst = 'safe'; n.children.forEach(c => { const d = treeDangerLevel(c); if (LEVEL_RANK[d] > LEVEL_RANK[worst]) worst = d; });
      return worst;
    }
    function treeNodeColor(n) { return colorScheme === 'endanger' ? DANGER[treeDangerLevel(n)] : famColorOf(n.fam); }

    function applyTreeViewBox() { const svg = document.getElementById('treeSvg'); if (svg) svg.setAttribute('viewBox', `${treeViewBox.x} ${treeViewBox.y} ${treeViewBox.w} ${treeViewBox.h}`); }
    function renderTree() {
      const svg = document.getElementById('treeSvg');
      if (!treeBuilt) {
        treeRoot = buildTree();
        layoutTree(treeRoot);
        const all = []; (function collect(n) { all.push(n); n.children.forEach(collect); })(treeRoot);
        all.forEach(n => treeNodeById[n.id] = n);
        let edges = '', nodes = '';
        all.forEach(n => n.children.forEach(c => {
          const x1 = n.x + 12, y1 = n.y, x2 = c.x, y2 = c.y;
          edges += `<path class="tedge" data-from="${n.id}" data-to="${c.id}" d="M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}"/>`;
        }));
        all.forEach(n => {
          const isLeaf = n.kind === 'leaf';
          const isEnd = isLeaf && n.dbKey && !!VITALITY[n.dbKey];
          const c = isEnd ? dangerColorOf(n.dbKey) : treeNodeColor(n);
          const shape = isLeaf ? `<circle class="tn-dot" r="4.5" style="fill:${c}"/>`
                               : `<rect class="tn-box" x="-6" y="-7" width="12" height="14" rx="3" style="fill:${c}"/>`;
          const dur = (1.1 + Math.random() * 1.3).toFixed(2);
          nodes += `<g class="tnode ${isLeaf ? 'leaf' : 'mid'} ${isEnd ? 'endangered' : ''}" data-id="${n.id}" data-kind="${n.kind}" ${n.dbKey ? `data-k="${n.dbKey}"` : ''} transform="translate(${n.x},${n.y})">
            ${isEnd ? `<circle class="tn-ember" r="6.2" style="fill:${c};animation-duration:${dur}s"></circle>` : ''}
            ${shape}<text class="tn-label" x="9" y="3.6">${n.label}</text></g>`;
        });
        svg.innerHTML = `<g id="treeEdges">${edges}</g><g id="treeNodes">${nodes}</g>`;
        treeViewBox = { x: -20, y: -20, w: treeSize.w + 40, h: Math.max(treeSize.h + 40, 300) };
        applyTreeViewBox();
        bindTreeInteractions();
        treeBuilt = true;
      }
      applyTreeFilter();
    }

    // 谱系树可见性：随“浏览模式 + 属性筛选”联动（内部节点看是否有可见后代）
    function treeNodeVisible(n) {
      if (n.kind === 'leaf') { if (modeLeafSet && !modeLeafSet.has(n.dbKey)) return false; return langPassesFilter(n.dbKey); }
      return n.children.some(treeNodeVisible);
    }
    function applyTreeFilter() {
      if (!treeBuilt) return;
      const vis = new Set();
      (function rec(n) { if (treeNodeVisible(n)) vis.add(n.id); n.children.forEach(rec); })(treeRoot);
      document.querySelectorAll('#treeSvg .tnode').forEach(g => g.classList.toggle('hidden', !vis.has(g.dataset.id)));
      document.querySelectorAll('#treeSvg .tedge').forEach(p => p.classList.toggle('hidden', !(vis.has(p.dataset.from) && vis.has(p.dataset.to))));
    }

    // 谱系树平移 / 缩放 / 点击打开详情
    function treeZoom(factor, cx, cy) {
      const svg = document.getElementById('treeSvg'), r = svg.getBoundingClientRect();
      const vx = treeViewBox.x + (cx / r.width) * treeViewBox.w, vy = treeViewBox.y + (cy / r.height) * treeViewBox.h;
      const nw = Math.min(6000, Math.max(120, treeViewBox.w * factor)), nh = nw / 2;
      treeViewBox.x = vx - (vx - treeViewBox.x) * (nw / treeViewBox.w);
      treeViewBox.y = vy - (vy - treeViewBox.y) * (nh / treeViewBox.h);
      treeViewBox.w = nw; treeViewBox.h = nh; applyTreeViewBox();
    }
    function bindTreeInteractions() {
      const svg = document.getElementById('treeSvg');
      attachPanZoom(svg, treeZoom, treeViewBox, applyTreeViewBox);
      svg.addEventListener('click', e => {
        if (svg._moved) return;
        const g = e.target.closest('.tnode');
        if (!g || g.classList.contains('hidden')) return;
        treeEl.querySelectorAll('.tnode.sel').forEach(x => x.classList.remove('sel'));
        g.classList.add('sel');
        openTreeCard(g.dataset.id);
      });
    }

    // 三视图统一筛选联动：图谱 / 地图 / 谱系树
    function syncFiltersToView() {
      if (viewMode === 'graph') refreshVisibility();
      else if (viewMode === 'map') applyMapFilter();
      else if (viewMode === 'tree') applyTreeFilter();
    }

    /* ---- 筛选侧栏 UI ---- */
    const filterPanel = document.getElementById('filterPanel');
    const filterBody = document.getElementById('filterBody');
    ATTR_DIMS.forEach(dim => {
      const sec = document.createElement('div');
      sec.className = 'fp-section';
      sec.innerHTML = `<div class="fp-title">${dim.name}</div>`;
      const wrap = document.createElement('div');
      wrap.className = 'fp-chips';
      dim.opts.forEach(o => {
        const b = document.createElement('button');
        b.className = 'fp-chip';
        b.dataset.dim = dim.id; b.dataset.opt = o.id;
        b.textContent = o.label;
        b.addEventListener('click', () => toggleFilter(dim.id, o.id));
        wrap.appendChild(b);
      });
      sec.appendChild(wrap);
      filterBody.appendChild(sec);
    });

    function toggleFilter(dim, opt) {
      if (!activeFilters[dim]) activeFilters[dim] = new Set();
      if (activeFilters[dim].has(opt)) activeFilters[dim].delete(opt);
      else activeFilters[dim].add(opt);
      if (activeFilters[dim].size === 0) delete activeFilters[dim];
      syncFilterUI();
      syncFiltersToView();
    }
    function syncFilterUI() {
      document.querySelectorAll('.fp-chip').forEach(b => {
        const on = activeFilters[b.dataset.dim] && activeFilters[b.dataset.dim].has(b.dataset.opt);
        b.classList.toggle('on', !!on);
      });
      const n = activeFilterCount();
      const badge = document.getElementById('filterCount');
      badge.textContent = n; badge.hidden = n === 0;
      document.getElementById('filterBtn').classList.toggle('active', n > 0);
      document.getElementById('filterClear').style.visibility = n ? 'visible' : 'hidden';
    }
    function applyAttrFilter(id) {
      const meta = ATTR_FLAT.find(o => o.id === id);
      if (!meta) return;
      activeFilters[meta.dim] = new Set([id]);
      syncFilterUI();
      syncFiltersToView();
      showToast(`已按属性筛选：${meta.label} · 命中 ${ATTR_INDEX[id].size} 种语言`);
    }
    // 侧栏避开顶部工具栏，按工具栏实际高度定位
    function positionFilterPanel() {
      const tb = document.querySelector('.top-toolbar');
      if (tb) {
        const top = tb.getBoundingClientRect().bottom + 12;
        filterPanel.style.top = top + 'px';
        filterPanel.style.height = `calc(100% - ${top + 12}px)`;
      }
    }
    positionFilterPanel();
    window.addEventListener('resize', positionFilterPanel);

    document.getElementById('filterBtn').addEventListener('click', () => filterPanel.classList.toggle('open'));
    document.getElementById('filterClose').addEventListener('click', () => filterPanel.classList.remove('open'));
    document.getElementById('filterClear').addEventListener('click', clearFilters);
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setViewMode(b.dataset.view)));
    document.querySelector('[data-view="graph"]').classList.add('mode-active');
    graphEl.classList.add('is-active');   // 初始图谱可见（无 display 切换，靠 opacity 控制）
    bindMapInteractions();
    syncFilterUI();

    /* =========================================================
       10. 分享深链（hash 路由 #/lang/<dbKey>）
       —— 打开语言即同步地址栏；加载 / 前进后退即还原 —— */
    let _suppressHash = false;
    function parseHash() {
      let m = (location.hash || '').match(/^#\/lang\/(.+)$/);
      if (m) return { type: 'lang', key: decodeURIComponent(m[1]) };
      m = (location.hash || '').match(/^#\/quiz\/(.+)$/);
      if (m) return { type: 'quiz', key: decodeURIComponent(m[1]) };
      return null;
    }
    function setLangHash(key) {
      _suppressHash = true;
      location.hash = '#/lang/' + encodeURIComponent(key);
    }
    function onHashChange() {
      if (_suppressHash) { _suppressHash = false; return; }
      const p = parseHash();
      if (p && p.type === 'lang' && languageDatabase[p.key]) {
        if (p.key !== currentDbKey) openLanguage(p.key);
      } else if (p && p.type === 'quiz' && QUIZ_BUCKETS[p.key]) {
        openQuiz();
        showQuizResult(p.key, true);
      } else if (drawer.classList.contains('open')) {
        lockedNode = null; closeDrawer();
      }
    }
    window.addEventListener('hashchange', onHashChange);
    // 包装 openLanguage：每次打开语言都同步地址栏
    const _origOpenLanguage = openLanguage;
    openLanguage = function (dbKey) { setLangHash(dbKey); _origOpenLanguage(dbKey); };
    // 包装 closeDrawer：关闭即回到根路径
    const _origCloseDrawer = closeDrawer;
    closeDrawer = function () {
      if (location.hash && location.hash !== '#/') { _suppressHash = true; location.hash = '#/'; }
      _origCloseDrawer();
    };
    // 复制当前语言的分享链接
    function copyShareLink() {
      if (!currentDbKey) return;
      const L = languageDatabase[currentDbKey];
      const url = location.origin + location.pathname + '#/lang/' + encodeURIComponent(currentDbKey);
      const ok = () => showToast('链接已复制 · 可直接分享「' + L.name.split(' ')[0] + '」');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(ok).catch(() => fallbackCopy(url, ok));
      } else fallbackCopy(url, ok);
    }
    function fallbackCopy(text, cb) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-9999px'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand('copy'); cb(); } catch (e) { showToast('复制失败，链接：' + text); }
      document.body.removeChild(ta);
    }
    /* =========================================================
       12. 语言人格测试（题库 + 计分 + 结果卡 + 分享深链 #/quiz/<key>） */
    const QUIZ_BUCKETS = {
      ie:  { name:'印欧语系', tag:'秩序与扩张者', rep:'法文', color:'#7E8FB0',
             desc:'你像印欧语系：带着清晰的语法与不安分的好奇，从草原一路扩张到五大洲。秩序是你的铠甲，传播是你的本能。' },
      st:  { name:'汉藏语系', tag:'厚古的传承者', rep:'中文', color:'#C6A15B',
             desc:'你像汉藏语系：把几千年的根脉揣在怀里。不急着喧哗，却最经得起时间。含蓄，是你最深的力。' },
      au:  { name:'南岛语系', tag:'海洋漫游者', rep:'毛利语', color:'#6E9E9A',
             desc:'你像南岛语系：驾着独木舟横渡太平洋，把家园撒进每座岛屿。浪漫是你的罗盘，远方是你的故乡。' },
      iso: { name:'孤岛坚守者', tag:'孤岛的守望人', rep:'日文', color:'#B07C9E',
             desc:'你像日本、冰岛这样的孤立语言：周围都是海，却自成宇宙。孤独不是软弱，是独一无二的骄傲。' },
      nc:  { name:'尼日尔-刚果语系', tag:'鼓声里的共同体', rep:'斯瓦希里语', color:'#8A9A6B',
             desc:'你像尼日尔-刚果语系：在鼓点与合唱中长大。一个人是你的影子，一群人才是你的太阳。' },
      aa:  { name:'亚非语系', tag:'沙漠与圣典', rep:'阿拉伯文', color:'#B5895B',
             desc:'你像亚非语系：在风沙与星月之间，把信仰和韵律刻进字母。庄严，是你说话的语气。' },
      am:  { name:'美洲原住民语系', tag:'大地的孩子', rep:'克丘亚语', color:'#C0785B',
             desc:'你像美洲原住民语言：脚下是山，口中是神话。不征服自然，而是和它商量着活下去。' },
      art: { name:'人工语言', tag:'理性的乌托邦', rep:'世界语', color:'#5FA8B0',
             desc:'你像世界语：相信人类本可以少一些隔阂。理想主义不是天真，是你认真的生活方式。' },
      sign:{ name:'手语', tag:'手势里的诗', rep:'美国手语', color:'#C07C8A',
             desc:'你像手语：用双手代替声音，把情绪捏成形状。沉默，也可以很喧闹。' },
      ural:{ name:'乌拉尔语系', tag:'极简留白派', rep:'芬兰语', color:'#5E9E8C',
             desc:'你像乌拉尔语系（芬兰语、爱沙尼亚语）：用最少的词，留最大的白。复杂的事你说得轻，安静的事你最懂。' },
      turk:{ name:'突厥语系', tag:'草原游吟派', rep:'土耳其文', color:'#D4A24C',
             desc:'你像突厥语系：从草原一路迁徙，把商队与歌谣带过半片欧亚。自由，是你驮在马背上的家。' },
      iran:{ name:'伊朗语支', tag:'绿洲诗旅派', rep:'波斯语', color:'#C07A4B',
             desc:'你像波斯语：在沙漠绿洲里写诗，把每一个词都打磨成宝石。华丽不是炫耀，是你对美的郑重。' },
      sea: { name:'东南亚稻田语', tag:'稻田禅意派', rep:'泰文', color:'#9DA95E',
             desc:'你像泰语、缅甸语这样的东南亚稻田语言：慢半拍，带笑意，把日子过成一首不用急着听懂的歌。' },
    };
    const QUIZ_QUESTIONS = [
      { q:'你理想的周末是？', opts:[
        { t:'捧一本厚书，泡壶茶，安静地待一整天', w:'st' },
        { t:'买张票去海边，认识一群陌生人', w:'au' },
        { t:'张罗一场热闹的大家庭聚会', w:'nc' },
        { t:'独自爬山露营，远离一切信号', w:'iso' },
      ]},
      { q:'别人怎么形容你的表达风格？', opts:[
        { t:'逻辑清晰、条理分明', w:'ie' },
        { t:'含蓄隽永、意在言外', w:'st' },
        { t:'手势丰富、很有画面感', w:'sign' },
        { t:'能用三个词绝不用十个，极简留白', w:'ural' },
      ]},
      { q:'面对一个新环境，你通常？', opts:[
        { t:'迅速建立规则，让一切井井有条', w:'ie' },
        { t:'先观察，慢慢找到自己的角落', w:'iso' },
        { t:'立刻下水，边做边学', w:'au' },
        { t:'守住老传统，又悄悄吸收新东西', w:'aa' },
      ]},
      { q:'你更认同哪一种「强大」？', opts:[
        { t:'疆域广阔、影响深远', w:'ie' },
        { t:'延续千年、根脉不断', w:'st' },
        { t:'与土地共生、朴素坚韧', w:'am' },
        { t:'人人平等、沟通无界', w:'art' },
      ]},
      { q:'如果发明一种语言，你最想让它？', opts:[
        { t:'语法极其严谨，没有歧义', w:'ie' },
        { t:'用最少的词说出最深的意思', w:'st' },
        { t:'一说就让人想跳舞', w:'au' },
        { t:'全世界人一学就会，消除隔阂', w:'art' },
      ]},
      { q:'你最怕哪一种「失去」？', opts:[
        { t:'计划被打乱、一切失去确定感', w:'ie' },
        { t:'根脉断了，再没人记得老话', w:'st' },
        { t:'族群离散、故土慢慢荒芜', w:'am' },
        { t:'人类之间永远消不掉隔阂', w:'art' },
      ]},
      { q:'旅行时你最享受？', opts:[
        { t:'把行程精确到每一分钟', w:'ie' },
        { t:'钻进当地市集，大吃一顿', w:'nc' },
        { t:'在绿洲茶馆发一下午的呆', w:'iran' },
        { t:'一个人安静地整理房间、断舍离', w:'ural' },
      ]},
      { q:'你理想中的「家」是？', opts:[
        { t:'一座井井有条的城市公寓', w:'ie' },
        { t:'一栋祖传的老院子，门槛都被踩亮', w:'st' },
        { t:'一间面朝水田、慢悠悠的小屋', w:'sea' },
        { t:'一顶随时收起的帐篷，跟着商队走', w:'turk' },
      ]},
    ];
    const QUIZ_PRIORITY = ['ie','st','au','nc','aa','iso','am','art','sign','ural','iran','sea','turk'];
    const quizOverlay = document.getElementById('quizOverlay');
    let quizState = null;
    function openQuiz() {
      quizState = { step: -1, scores: {} };
      renderQuizStep();
      quizOverlay.classList.remove('hidden');
      requestAnimationFrame(() => quizOverlay.classList.add('show'));
    }
    function closeQuiz() {
      quizOverlay.classList.remove('show');
      setTimeout(() => quizOverlay.classList.add('hidden'), 280);
    }
    function renderQuizStep() {
      const s = quizState;
      if (s.step < 0) {
        quizOverlay.querySelector('.quiz-card').innerHTML = `
          <div class="quiz-kicker"><i data-lucide="sparkles" class="w-4 h-4"></i> 语言人格测试</div>
          <h2 class="quiz-title">你是哪种「语言人格」？</h2>
          <p class="quiz-sub">8 道小题，看看你的性格最接近哪一支人类语系。</p>
          <button class="quiz-start" data-act="start">开始测试</button>
          <p class="quiz-foot">结果可一键分享 · 纯前端，无隐私收集</p>`;
      } else if (s.step < QUIZ_QUESTIONS.length) {
        const Q = QUIZ_QUESTIONS[s.step];
        const prog = Math.round((s.step / QUIZ_QUESTIONS.length) * 100);
        quizOverlay.querySelector('.quiz-card').innerHTML = `
          <div class="quiz-prog"><div class="quiz-prog-bar" style="width:${prog}%"></div></div>
          <div class="quiz-count">第 ${s.step + 1} / ${QUIZ_QUESTIONS.length} 题</div>
          <h2 class="quiz-title">${Q.q}</h2>
          <div class="quiz-opts">
            ${Q.opts.map((o, i) => `<button class="quiz-opt" data-w="${o.w}"><span class="quiz-opt-dot">${String.fromCharCode(65 + i)}</span>${o.t}</button>`).join('')}
          </div>`;
      } else {
        showQuizResult(pickQuizResult());
      }
      lucide.createIcons();
    }
    function pickQuizResult() {
      const sc = quizState.scores;
      let best = null, bestV = -1;
      for (const k of QUIZ_PRIORITY) { const v = sc[k] || 0; if (v > bestV) { bestV = v; best = k; } }
      return best || 'st';
    }
    function showQuizResult(bucketKey, fromHash) {
      const b = QUIZ_BUCKETS[bucketKey];
      if (!b) { if (!fromHash) renderQuizStep(); return; }
      const shareUrl = location.origin + location.pathname + '#/quiz/' + bucketKey;
      quizOverlay.querySelector('.quiz-card').innerHTML = `
        <div class="quiz-kicker" style="color:${b.color}"><i data-lucide="award" class="w-4 h-4"></i> 你的语言人格</div>
        <div class="quiz-result-name" style="color:${b.color}">${b.name}</div>
        <div class="quiz-result-tag">${b.tag}</div>
        <p class="quiz-result-desc">${b.desc}</p>
        <div class="quiz-result-actions">
          <button class="quiz-retake" data-act="retake">再测一次</button>
          <button class="quiz-share" data-act="share" data-url="${escAttr(shareUrl)}">复制分享链接</button>
          <button class="quiz-go" data-act="go" data-rep="${escAttr(b.rep)}" style="background:${b.color}">去认识「${languageDatabase[b.rep].name.split(' ')[0]}」</button>
        </div>`;
      lucide.createIcons();
      if (!fromHash) { _suppressHash = true; location.hash = '#/quiz/' + bucketKey; }
      quizState.result = bucketKey;
    }
    if (quizOverlay) {
      quizOverlay.addEventListener('click', (e) => {
        const start = e.target.closest('[data-act="start"]');
        const opt = e.target.closest('.quiz-opt');
        const retake = e.target.closest('[data-act="retake"]');
        const share = e.target.closest('[data-act="share"]');
        const go = e.target.closest('[data-act="go"]');
        if (e.target === quizOverlay) { closeQuiz(); return; }
        if (start) { quizState.step = 0; renderQuizStep(); return; }
        if (opt) {
          const w = opt.dataset.w; quizState.scores[w] = (quizState.scores[w] || 0) + 1;
          quizState.step++; renderQuizStep(); return;
        }
        if (retake) { quizState = { step: -1, scores: {} }; renderQuizStep(); return; }
        if (share) {
          const url = share.dataset.url;
          const ok = () => showToast('结果链接已复制，去炫耀你的语言人格吧！');
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok).catch(() => fallbackCopy(url, ok));
          else fallbackCopy(url, ok);
          return;
        }
        if (go) {
          const rep = go.dataset.rep;
          closeQuiz();
          if (rep && languageDatabase[rep]) openLanguage(rep);
          return;
        }
      });
    }
    const quizFab = document.getElementById('quizFab');
    if (quizFab) quizFab.addEventListener('click', openQuiz);

    /* =========================================================
       12. 随机抽卡 + 我的语言架（localStorage 收藏）
       ========================================================= */
    const SHELF_KEY = 'langroots.shelf.v1';
    function getShelf() {
      try { const a = JSON.parse(localStorage.getItem(SHELF_KEY)); return Array.isArray(a) ? a : []; }
      catch (e) { return []; }
    }
    function setShelf(arr) {
      try { localStorage.setItem(SHELF_KEY, JSON.stringify(arr)); } catch (e) {}
      updateShelfBadge();
    }
    function isOnShelf(k) { return getShelf().indexOf(k) !== -1; }
    function toggleShelf(k) {
      let arr = getShelf();
      if (arr.indexOf(k) !== -1) { arr = arr.filter(x => x !== k); showToast('已移出「我的语言架」'); }
      else { arr.unshift(k); showToast('已收进「我的语言架」 ⭐'); }
      setShelf(arr);
    }
    function updateShelfBadge() {
      const badge = document.getElementById('shelfBadge');
      if (!badge) return;
      const n = getShelf().length;
      badge.textContent = n;
      badge.hidden = n === 0;
    }

    // ---- 随机抽卡 ----
    const drawOverlay = document.getElementById('drawOverlay');
    let drawTimer = null;
    function openDraw() {
      clearInterval(drawTimer);
      drawOverlay.querySelector('.draw-card').innerHTML = `
        <div class="draw-kicker"><i data-lucide="dices" class="w-4 h-4"></i> 语言抽卡</div>
        <h2 class="draw-title">抽一张语言卡</h2>
        <p class="draw-sub">对 68 种语言毫无准备地随机遇见——也许，就是你一直在找的那一门。</p>
        <button class="draw-roll" data-act="roll">🎰 开始抽卡</button>
        <p class="draw-foot">抽到可听原音 · 可一键收进「我的语言架」</p>`;
      drawOverlay.classList.remove('hidden');
      requestAnimationFrame(() => drawOverlay.classList.add('show'));
      lucide.createIcons();
    }
    function closeDraw() {
      clearInterval(drawTimer);
      drawOverlay.classList.remove('show');
      setTimeout(() => drawOverlay.classList.add('hidden'), 280);
    }
    function rollDraw() {
      const keys = Object.keys(languageDatabase);
      const card = drawOverlay.querySelector('.draw-card');
      card.innerHTML = `
        <div class="draw-kicker"><i data-lucide="dices" class="w-4 h-4"></i> 语言抽卡</div>
        <div class="draw-shuffle"><span class="draw-shuffle-name">…</span></div>
        <div class="draw-shuffle-tip">命运正在 shuffling……</div>`;
      lucide.createIcons();
      const nameEl = card.querySelector('.draw-shuffle-name');
      let ticks = 0; const total = 16;
      clearInterval(drawTimer);
      drawTimer = setInterval(() => {
        ticks++;
        const k = keys[Math.floor(Math.random() * keys.length)];
        nameEl.textContent = languageDatabase[k].name.split(' ')[0];
        if (ticks >= total) { clearInterval(drawTimer); renderDrawReveal(keys[Math.floor(Math.random() * keys.length)]); }
      }, 70);
    }
    function renderDrawReveal(key) {
      const L = languageDatabase[key]; if (!L) return;
      const fam = (LEAF_PATHS[key] || [])[0] || '';
      const famColor = langColorOf(key);
      const ex = parseExample(L.example);
      const speakLang = LOCALE_BY_KEY[key];
      const speakPhrase = cleanPhrase(ex.phrase);
      const canSpeak = !!speakLang && !!speakPhrase;
      const onShelf = isOnShelf(key);
      drawOverlay.querySelector('.draw-card').innerHTML = `
        <div class="draw-reveal">
          <div class="draw-reveal-family" style="color:${famColor};border-color:${famColor}55;background:${famColor}1a">${fam || '其他'}</div>
          <h2 class="draw-result-name" style="color:${famColor}">${L.name}</h2>
          <p class="draw-result-punch">${clampFact(L.fact, 60)}</p>
          ${ex.phrase ? `<div class="draw-result-phrase">
              <span class="text-[20px] font-bold text-slate-50" dir="auto">${ex.phrase}</span>
              ${canSpeak ? `<button class="speak-btn" data-speak="${escAttr(speakPhrase)}" data-lang="${escAttr(speakLang)}" title="听原音"><i data-lucide="volume-2" class="w-3.5 h-3.5"></i></button>` : ''}
            </div>` : ''}
          <div class="draw-result-actions">
            <button class="draw-again" data-act="roll">🎰 再抽一张</button>
            <button class="draw-detail" data-act="go" data-key="${escAttr(key)}" style="background:${famColor}">看完整档案</button>
          </div>
          <button class="draw-shelf ${onShelf ? 'on' : ''}" data-act="shelf" data-key="${escAttr(key)}">${onShelf ? '★ 已在我的语言架' : '☆ 收进我的语言架'}</button>
        </div>`;
      lucide.createIcons();
    }
    if (drawOverlay) {
      drawOverlay.addEventListener('click', (e) => {
        if (e.target === drawOverlay) { closeDraw(); return; }
        const sp = e.target.closest('[data-speak]');
        if (sp) { e.stopPropagation(); speakText(sp.dataset.speak, sp, sp.dataset.lang); return; }
        const roll = e.target.closest('[data-act="roll"]');
        if (roll) { rollDraw(); return; }
        const go = e.target.closest('[data-act="go"]');
        if (go) { const k = go.dataset.key; closeDraw(); if (languageDatabase[k]) openLanguage(k); return; }
        const sh = e.target.closest('[data-act="shelf"]');
        if (sh) {
          const k = sh.dataset.key; toggleShelf(k);
          const on = isOnShelf(k);
          sh.classList.toggle('on', on);
          sh.textContent = on ? '★ 已在我的语言架' : '☆ 收进我的语言架';
          return;
        }
      });
    }
    const drawFab = document.getElementById('drawFab');
    if (drawFab) drawFab.addEventListener('click', openDraw);

    // ---- 我的语言架 ----
    const shelfOverlay = document.getElementById('shelfOverlay');
    function openShelf() { renderShelf(); shelfOverlay.classList.remove('hidden'); requestAnimationFrame(() => shelfOverlay.classList.add('show')); }
    function closeShelf() { shelfOverlay.classList.remove('show'); setTimeout(() => shelfOverlay.classList.add('hidden'), 280); }
    function shelfRow(k) {
      const L = languageDatabase[k]; if (!L) return '';
      const fam = (LEAF_PATHS[k] || [])[0] || '';
      const famColor = langColorOf(k);
      return `<div class="shelf-row" data-key="${escAttr(k)}">
        <span class="shelf-dot" style="background:${famColor}"></span>
        <div class="shelf-row-main">
          <div class="shelf-row-name">${L.name.split(' ')[0]}</div>
          <div class="shelf-row-fam">${fam || '其他'}</div>
        </div>
        <button class="shelf-open" data-act="open" data-key="${escAttr(k)}">查看</button>
        <button class="shelf-remove" data-act="remove" data-key="${escAttr(k)}" title="移出语言架"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>`;
    }
    function renderShelf() {
      const arr = getShelf();
      const body = arr.length
        ? `<div class="shelf-list">${arr.map(shelfRow).join('')}</div>`
        : `<div class="shelf-empty">
             <i data-lucide="book-heart" class="w-10 h-10"></i>
             <p>你的语言架还空着。</p>
             <p class="shelf-empty-sub">翻开任意语言卡点 ⭐，或去「语言抽卡」遇见缘分。</p>
           </div>`;
      shelfOverlay.querySelector('.shelf-card').innerHTML = `
        <div class="shelf-head">
          <div class="shelf-title"><i data-lucide="library" class="w-5 h-5"></i> 我的语言架 <span class="shelf-count">${arr.length}</span></div>
          <div class="flex gap-2">
            ${arr.length ? `<button class="shelf-clear" data-act="clear">清空</button>` : ''}
            <button class="shelf-close" data-act="close"><i data-lucide="x" class="w-4 h-4"></i></button>
          </div>
        </div>
        ${body}`;
      lucide.createIcons();
    }
    if (shelfOverlay) {
      shelfOverlay.addEventListener('click', (e) => {
        if (e.target === shelfOverlay) { closeShelf(); return; }
        const close = e.target.closest('[data-act="close"]'); if (close) { closeShelf(); return; }
        const clear = e.target.closest('[data-act="clear"]'); if (clear) { setShelf([]); renderShelf(); showToast('已清空语言架'); return; }
        const remove = e.target.closest('[data-act="remove"]'); if (remove) { const arr = getShelf().filter(x => x !== remove.dataset.key); setShelf(arr); renderShelf(); return; }
        const open = e.target.closest('[data-act="open"]'); if (open) { const k = open.dataset.key; closeShelf(); if (languageDatabase[k]) openLanguage(k); return; }
        const row = e.target.closest('.shelf-row'); if (row && languageDatabase[row.dataset.key]) { closeShelf(); openLanguage(row.dataset.key); }
      });
    }
    const shelfFab = document.getElementById('shelfFab');
    if (shelfFab) shelfFab.addEventListener('click', openShelf);

    // 首屏初始化语言架徽标
    updateShelfBadge();

    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) shareBtn.addEventListener('click', copyShareLink);
    // 首屏：若 URL 携带深链则还原（在图谱稳定后调用，确保节点/镜头就绪）
    function honorInitialHash() { onHashChange(); }

    /* =========================================================
       11. 着色方案：按语系 ⇄ 按 UNESCO 濒危等级
       —— 语义化着色，让“谁在消失”一目了然 —— */
    const DANGER = { safe: '#5E9E6A', vuln: '#D9B36B', end: '#E0955A', crit: '#D9604A', extinct: '#9A9088' };
    const LEVEL_RANK = { safe: 0, vuln: 1, end: 2, crit: 3, extinct: 4 };
    function dangerLevelOf(dbKey) {
      const v = VITALITY[dbKey];
      if (!v) return 'safe';
      const l = v.label || '';
      if (l.includes('极度') || l.includes('重度')) return 'crit';
      if (l.includes('濒危')) return 'end';
      if (l.includes('脆弱') || l.includes('复兴')) return 'vuln';
      return 'vuln';
    }
    function dangerColorOf(dbKey) { return DANGER[dangerLevelOf(dbKey)]; }
    // 中间层/语系节点：取其下辖语种中最严重的等级
    function nodeDangerColor(n) {
      if (n.kind === 'leaf') return dangerColorOf(n.dbKey);
      let worst = 'safe';
      if (n.descLeaves) for (const k of n.descLeaves) { const lv = dangerLevelOf(k); if (LEVEL_RANK[lv] > LEVEL_RANK[worst]) worst = lv; }
      return DANGER[worst];
    }
    // 语言在地图上的颜色（随当前着色方案）
    function langColorOf(k) { return colorScheme === 'endanger' ? dangerColorOf(k) : famColorOf((LEAF_PATHS[k] || [])[0]); }

    let colorScheme = 'family';
    function nodeColorOf(n) { return colorScheme === 'endanger' ? nodeDangerColor(n) : famColorOf(n.family); }

    function applyColorScheme(scheme) {
      colorScheme = scheme;
      const lightOn = document.documentElement.dataset.theme === 'light';
      const leafFont = lightOn ? '#5A5040' : '#B6AC98';
      const leafStroke = lightOn ? '#FFFFFF' : '#17140F';
      const upd = [];
      data.nodes.forEach(n => {
        if (n.kind === 'root') return;
        const c = nodeColorOf(n), neon = NEON[c] || '#FFFFFF';
        if (n.kind === 'leaf') {
          upd.push({ id: n.id, color: { background: c, border: c, highlight: { background: neon, border: '#F1E9DA' }, hover: { background: neon, border: '#F1E9DA' } },
                    shadow: { enabled: true, color: hexA(c, 0.32), size: 10, x: 0, y: 1 },
                    font: { size: 14, color: leafFont, face: FACE, strokeWidth: 3, strokeColor: leafStroke } });
        } else if (n.kind === 'family') {
          upd.push({ id: n.id, color: { background: c, border: hexA(c, 0.9), highlight: { background: neon, border: '#F1E9DA' }, hover: { background: neon, border: '#F1E9DA' } } });
        } else {
          upd.push({ id: n.id, color: { background: '#241E15', border: c, highlight: { background: '#322A1D', border: neon }, hover: { background: '#322A1D', border: neon } } });
        }
      });
      data.nodes.update(upd);
      // 连线：随目标节点配色
      const eupd = [];
      data.edges.forEach(e => { const toN = data.nodes.get(e.to); const c = nodeColorOf(toN);
        eupd.push({ id: e.id, neon: c, color: { color: EDGE_IDLE, highlight: hexA(c, 0.95), hover: hexA(c, 0.85), inherit: false } }); });
      data.edges.update(eupd);
      // 地图撒点同步（濒危节点锁定危险色，不被语系配色覆盖）
      document.querySelectorAll('#mapSvg .mpl').forEach(g => {
        const k = g.dataset.k;
        const c = VITALITY[k] ? dangerColorOf(k) : langColorOf(k);
        const dot = g.querySelector('.mpl-dot'), halo = g.querySelector('.mpl-halo'), ember = g.querySelector('.mpl-ember');
        if (dot) dot.style.fill = c; if (halo) halo.style.fill = c; if (ember) ember.style.fill = c;
      });
      // 谱系树节点同步（若已构建）
      if (treeBuilt) {
        document.querySelectorAll('#treeSvg .tnode').forEach(g => {
          const n = treeNodeById[g.dataset.id]; if (!n) return;
          const isEnd = n.kind === 'leaf' && n.dbKey && VITALITY[n.dbKey];
          const c = isEnd ? dangerColorOf(n.dbKey) : treeNodeColor(n);
          const dot = g.querySelector('.tn-dot'), box = g.querySelector('.tn-box'), ember = g.querySelector('.tn-ember');
          if (dot) dot.style.fill = c; if (box) box.style.fill = c; if (ember) ember.style.fill = c;
        });
      }
      updateLegend();
      document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('mode-active', b.dataset.color === scheme));
    }
    function updateLegend() {
      const el = document.getElementById('legend'); if (!el) return;
      if (colorScheme === 'family') {
        el.innerHTML = [['#7E8FB0', '印欧'], ['#C6A15B', '汉藏'], ['#8A9A6B', '乌拉尔/非洲'], ['#C0785B', '美洲'], ['#6E9E9A', '南岛'], ['#B07C9E', '孤立']]
          .map(([c, t]) => `<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${c}"></span>${t}</span>`).join('');
      } else {
        el.innerHTML = [['#5E9E6A', '安全'], ['#D9B36B', '脆弱'], ['#E0955A', '濒危'], ['#D9604A', '极危']]
          .map(([c, t]) => `<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${c}"></span>${t}</span>`).join('');
      }
    }
    document.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => applyColorScheme(b.dataset.color)));
    document.querySelector('[data-color="family"]').classList.add('mode-active');
    applyColorScheme('family');   // 初始化图例 + 着色

    /* =========================================================
       12.5 濒危语言「余烬闪烁」—— 图谱节点(JS 调制阴影) 持续闪烁
       （地图/树用 SVG CSS 动画，见 styles.css；此处负责 canvas 节点） */
    const EMBER_NODES = [];
    data.nodes.forEach(n => {
      if (n.kind === 'leaf' && n.dbKey && VITALITY[n.dbKey]) {
        n.endangered = true;
        n.emberColor = dangerColorOf(n.dbKey);
        n.vitality = VITALITY[n.dbKey].vitality || 40;
        n.emberPhase = Math.random() * Math.PI * 2;
        EMBER_NODES.push(n);
      }
    });
    function emberTick() {
      if (!EMBER_NODES.length) return;
      const t = performance.now() / 1000;
      const upd = [];
      for (const n of EMBER_NODES) {
        // 烛火：正弦底光 + 偶发骤暗（活力越低，熄灭越频繁）
        const base = 0.5 + 0.5 * Math.sin(t * (1.6 + n.vitality / 60) + n.emberPhase);
        const sputter = Math.random() < (0.02 + (1 - n.vitality / 100) * 0.08) ? Math.random() * 0.6 : 0;
        const f = Math.max(0.12, base - sputter);
        const size = 9 + f * 16;
        const alpha = 0.28 + f * 0.5;
        upd.push({
          id: n.id,
          shadow: { enabled: true, color: hexA(n.emberColor, alpha), size: size, x: 0, y: 0 },
          color: { background: n.color.background, border: n.emberColor, highlight: n.color.highlight, hover: n.color.hover },
        });
      }
      try { data.nodes.update(upd); } catch (e) {}
      setTimeout(emberTick, 55);
    }
    emberTick();

    /* =========================================================
       12. 深浅色主题切换（持久化到 localStorage）
       —— 浅色“羊皮纸”模式，整站 Chrome 与图谱同步翻转 —— */
    const THEME_KEY = 'lr-theme';
    function applyTheme(t) {
      document.documentElement.dataset.theme = t;
      document.body.classList.toggle('light-theme', t === 'light');
      const btn = document.getElementById('themeBtn');
      if (btn) { btn.innerHTML = t === 'light' ? '<i data-lucide="sun" class="w-4 h-4"></i>' : '<i data-lucide="moon" class="w-4 h-4"></i>'; lucide.createIcons(); }
      recolorForTheme(t);
      try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    }
    function recolorForTheme(t) {
      EDGE_IDLE = t === 'light' ? 'rgba(20,16,10,0.07)' : 'rgba(255,255,255,0.05)';
      applyColorScheme(colorScheme);   // 刷新节点/连线（含主题字体色）/地图/图例
    }
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
    // 初始主题（优先读取用户偏好）
    let _savedTheme = 'dark';
    try { _savedTheme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) {}
    applyTheme(_savedTheme);

    lucide.createIcons();