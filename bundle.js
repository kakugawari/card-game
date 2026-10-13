/*
 * 全部を 1 枚の HTML にまとめる (テストプレイ用)
 *   node bundle.js [出力先]              ふつうの 1 枚 HTML
 *   node bundle.js --artifact [出力先]   Claude の Artifact 用 (外側の <html> などは足してもらうので、中身だけ)
 */
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const artifact = args.includes('--artifact');
const out = args.find((a) => !a.startsWith('--')) || path.join(__dirname, 'animal-packs.html');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

let html = read('index.html');
const css = ['styles.css', 'card.css', 'opening.css'].map(read).join('\n');
const scripts = ['packs.js', 'cards.js', 'core.js', 'animals.js', 'scenery.js', 'card.js', 'fx.js', 'minigames.js', 'opening.js', 'app.js'];

if (artifact) {
  const title = html.match(/<title>[^<]*<\/title>/)[0];
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1]
    .replace(/<script src="[^"]*"><\/script>\s*/g, '');
  // Artifact の入れ物は上下に安全域のぶん余白を足す。こちらでは二重に取らず、高さは親に合わせる
  const fit = ':root { --safe-top: 0px; --safe-bottom: 0px; }\nhtml, body { height: 100%; }\n';
  html = title + '\n<style>\n' + css + '\n' + fit + '</style>\n' + body +
    scripts.map((f) => '<script>\n' + read(f).replace(/<\/script>/g, '<\\/script>') + '\n</script>\n').join('');
} else {
  html = html.replace(/<link rel="stylesheet" href="\.\/styles\.css">/, () => '<style>\n' + css + '\n</style>');
  html = html.replace(/<link rel="stylesheet" href="\.\/(card|opening)\.css">\n?/g, '');
  const png = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, f)).toString('base64');
  html = html.replace(/<link rel="icon"[^>]*>/, () => '<link rel="icon" href="' + png('icon-64.png') + '">');
  html = html.replace(/<link rel="apple-touch-icon"[^>]*>/, () => '<link rel="apple-touch-icon" href="' + png('apple-touch-icon.png') + '">');
  scripts.forEach((f) => {
    html = html.replace('<script src="./' + f + '"></script>', () => '<script>\n' + read(f).replace(/<\/script>/g, '<\\/script>') + '\n</script>');
  });
}
// タイトルの絵は 1 枚の HTML の中へ埋め込む
html = html.replace(/\.\/title\.jpg/g, () => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, 'title.jpg')).toString('base64'));
fs.writeFileSync(out, html);
console.log(out + ' (' + Math.round(html.length / 1024) + 'KB)');
