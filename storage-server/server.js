const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { classifyImage } = require('./classify');
const Jimp = require('jimp');

const PORT = process.env.PORT || 3002;
const MEDIA_DIR = path.resolve(__dirname, 'media');
const CACHE_DIR = path.resolve(__dirname, 'cache');

fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

const app = express();

const MIME_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.ogg': 'video/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.pdf': 'application/pdf', '.zip': 'application/zip',
};

const EXT_TO_MIME = {
  jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
};

function getCacheKey(filename, opts) {
  const hash = crypto.createHash('md5').update(JSON.stringify(opts)).digest('hex').slice(0, 8);
  const ext = path.extname(filename);
  return `${path.basename(filename, ext)}_${hash}${opts.format === 'webp' ? '.webp' : opts.format === 'jpeg' || opts.format === 'jpg' ? '.jpg' : opts.format === 'png' ? '.png' : ext}`;
}

app.get(/^\/media\/(.+)/, async (req, res) => {
  const reqPath = req.params[0];
  const filePath = path.join(MEDIA_DIR, reqPath);
  const safePath = path.resolve(filePath);
  if (!safePath.startsWith(MEDIA_DIR)) return res.status(403).send('Forbidden');
  if (!fs.existsSync(safePath)) return res.status(404).send('Not found');

  const stat = fs.statSync(safePath);
  const ext = path.extname(safePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  const w = parseInt(req.query.w) || 0;
  const h = parseInt(req.query.h) || 0;
  const fit = req.query.fit || 'cover';
  const format = req.query.format || ext.slice(1);
  const quality = parseInt(req.query.q) || 80;

  const isImage = mime.startsWith('image/') && ext !== '.gif';

  if (isImage && (w > 0 || h > 0 || format !== ext.slice(1))) {
    const opts = { w, h, fit, format, quality };
    const cacheKey = getCacheKey(path.basename(safePath), opts);
    const cachePath = path.join(CACHE_DIR, cacheKey);

    if (fs.existsSync(cachePath)) {
      res.set({ 'Content-Type': EXT_TO_MIME[opts.format] || mime, 'Cache-Control': 'public, max-age=31536000' });
      return res.sendFile(cachePath);
    }

    try {
      const image = await Jimp.read(safePath);
      if (w > 0 || h > 0) {
        if (fit === 'cover') image.cover(w, h);
        else if (fit === 'contain') image.contain(w, h);
        else image.resize(w, h);
      }
      if (quality < 100) image.quality(quality);
      const mimeType = EXT_TO_MIME[opts.format] || 'image/jpeg';
      const buf = await image.getBufferAsync(mimeType);
      fs.writeFile(cachePath, buf, () => {});
      res.set({ 'Content-Type': mimeType, 'Cache-Control': 'public, max-age=31536000' });
      res.send(buf);
    } catch (e) {
      console.error('[storage] processing error:', e.message);
      res.sendFile(safePath);
    }
  } else {
    res.set({ 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000', 'Accept-Ranges': 'bytes' });
    if (req.headers.range) {
      const parts = req.headers.range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
      const stream = fs.createReadStream(safePath, { start, end });
      stream.pipe(res);
    } else {
      res.sendFile(safePath);
    }
  }
});

app.post('/classify', express.json({ limit: '1mb' }), async (req, res) => {
  const { filename } = req.body || {};
  if (!filename) return res.status(400).json({ ok: false, error: 'filename required' });
  const safePath = path.resolve(path.join(MEDIA_DIR, path.basename(filename)));
  if (!safePath.startsWith(MEDIA_DIR) || !fs.existsSync(safePath))
    return res.status(404).json({ ok: false, error: 'File not found' });
  try {
    const tags = await classifyImage(safePath);
    res.json({ ok: true, tags });
  } catch (e) {
    console.error('[classify] error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true, uptime: process.uptime() }));

app.listen(PORT, () => {
  console.log(`[storage] servidor de archivos estáticos en http://localhost:${PORT}`);
  console.log(`[storage] media dir: ${MEDIA_DIR}`);
  console.log(`[storage] cache dir: ${CACHE_DIR}`);
});
