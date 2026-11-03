import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { AppDatabase } from './db.ts';
import { createApiHandler } from './apiRouter.ts';
import { enforceIpWhitelist, getAllowedIpsFromEnv } from './ipFilter.ts';

const PORT = Number(process.env.PORT || 3000);
const DIST_DIR = path.resolve(process.cwd(), 'dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const appDb = new AppDatabase();
const apiHandler = createApiHandler(appDb, { enforceIp: false });

const server = http.createServer(async (req, res) => {
  // 1. Verifica a whitelist de IPs (IPv4 e CIDR IPv6 /48) antes de qualquer rota ou arquivo estático
  if (!enforceIpWhitelist(req, res)) {
    return;
  }

  // 2. Rotas de API (/api/*)
  const handledByApi = await apiHandler(req, res);
  if (handledByApi) {
    return;
  }

  // 3. Arquivos estáticos do frontend compilado (dist/)
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const safePath = path.normalize(decodeURIComponent(urlObj.pathname)).replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = path.join(DIST_DIR, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    // Fallback SPA para index.html
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Build de produção (dist/) não encontrado. Execute "npm run build" primeiro.');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Erro ao ler arquivo estático.');
    }
  });
  stream.pipe(res);
});

server.listen(PORT, () => {
  const allowed = getAllowedIpsFromEnv();
  console.log(`[BENHERMES] Servidor iniciado na porta ${PORT}`);
  console.log(`[BENHERMES] IPs/CIDRs liberados (${allowed.length}): ${allowed.join(', ')}`);
});
