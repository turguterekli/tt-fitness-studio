// Web uygulamasının dosyalarını, Capacitor'ın mağaza paketine koyacağı "www" klasörüne kopyalar.
// Web sitesi (GitHub Pages) repo kökünden yayınlanmaya devam eder; www/ sadece yerel uygulama içindir.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'www');
const items = ['index.html', 'privacy-policy.html', 'manifest.json', 'fonts', 'vendor',
  'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of items) {
  const src = path.join(root, item);
  if (!fs.existsSync(src)) { console.warn('atlandı (yok):', item); continue; }
  fs.cpSync(src, path.join(out, item), { recursive: true, filter: s => !s.endsWith('README.md') });
}
console.log('www/ hazır:', fs.readdirSync(out).join(', '));
