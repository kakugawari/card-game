/* 全部を 1 枚の HTML にまとめる (テストプレイ用): node bundle.js [出力先] */
const fs = require('node:fs');
const path = require('node:path');

const out = process.argv[2] || path.join(__dirname, 'animal-packs.html');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="\.\/styles\.css">/, () => '<style>\n' + read('styles.css') + '\n</style>');
html = html.replace(/<link rel="icon"[^>]*>/, () => {
  const svg = read('icon.svg');
  return '<link rel="icon" href="data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') + '">';
});
['core.js', 'animals.js', 'app.js'].forEach((f) => {
  html = html.replace('<script src="./' + f + '"></script>', () => '<script>\n' + read(f).replace(/<\/script>/g, '<\\/script>') + '\n</script>');
});
fs.writeFileSync(out, html);
console.log(out + ' (' + Math.round(html.length / 1024) + 'KB)');
