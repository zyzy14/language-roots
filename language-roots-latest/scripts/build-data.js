#!/usr/bin/env node
// 由 data/*.json 重建 js/data.js 的 5 个全局常量。
// 用法：node scripts/build-data.js
const fs = require('fs');
const root = __dirname + '/..';
const read = p => JSON.parse(fs.readFileSync(root + p, 'utf8'));

const languages = read('/data/languages.json');
const cats = read('/data/categories.json');
const geoRegions = read('/data/geo_regions.json');
const geoCoords = read('/data/geo_coords.json');

let out = '// AUTO-GENERATED from data/*.json。改 JSON 后重跑 `node scripts/build-data.js`\n';
out += `const languageDatabase = ${JSON.stringify(languages, null, 2)};\n`;
out += `const categoryDatabase = ${JSON.stringify(cats.categoryDatabase, null, 2)};\n`;
out += `const CATEGORY_ALIAS = ${JSON.stringify(cats.CATEGORY_ALIAS, null, 2)};\n`;
out += `const GEO_REGIONS = ${JSON.stringify(geoRegions, null, 2)};\n`;
out += `const GEO_COORDS = ${JSON.stringify(geoCoords, null, 2)};\n`;

fs.writeFileSync(root + '/js/data.js', out);
console.log('✅ js/data.js 已由 data/*.json 重新生成');
