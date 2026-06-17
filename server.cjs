/**
 * Waypoints Editor — локальний сервер
 * Запуск: node server.js
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;
const DIST = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  // Decode URL and strip query string
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);

  // SPA fallback: if file not found serve index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log('================================================');
  console.log('  Waypoints Editor запущено!');
  console.log(`  Відкрий браузер: ${url}`);
  console.log('  Для зупинки натисни Ctrl+C');
  console.log('================================================');

  // Автоматично відкрити браузер
  const { exec } = require('child_process');
  const cmd =
    process.platform === 'win32'  ? `start ${url}` :
    process.platform === 'darwin' ? `open ${url}`  :
                                    `xdg-open ${url}`;
  exec(cmd, err => { if (err) console.log(`Відкрий вручну: ${url}`); });
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Порт ${PORT} вже зайнятий. Закрий іншу копію програми.`);
  } else {
    console.error('Помилка сервера:', err.message);
  }
  process.exit(1);
});
