/* build.cjs — 把 css / 纹样引擎 / 交互逻辑内联进模板，产出单文件 H5 */
const fs = require('fs');
const path = require('path');
const here = __dirname;
const root = path.join(here, '..');

const tpl = fs.readFileSync(path.join(here, 'index.template.html'), 'utf8');
const css = fs.readFileSync(path.join(here, 'app.css'), 'utf8');
const pat = fs.readFileSync(path.join(here, 'weave-pattern.js'), 'utf8');
const app = fs.readFileSync(path.join(here, 'app.js'), 'utf8');

const out = tpl
  .replace('</head>', '<style>\n' + css + '\n</style>\n</head>')
  .replace('</body>', '<script>\n' + pat + '\n</script>\n<script>\n' + app + '\n</script>\n</body>');

/* 本地工程输出到 01_H5/；若源码被单独抽出（如仓库中）则输出到根 index.html */
var sub = fs.existsSync(path.join(root, '01_H5')) ? '01_H5' : '';
var dst = path.join(root, sub, 'index.html');
fs.writeFileSync(dst, out);
console.log('built', path.relative(root, dst), (out.length / 1024).toFixed(1) + ' KB');
