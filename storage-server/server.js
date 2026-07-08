const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { execSync, exec } = require('child_process');
const { classifyImage } = require('./classify');
const sharp = require('sharp');
const multer = require('multer');
const storage = require('./storage');
const logger = require('./logger');

const PORT = process.env.PORT || 3002;
const MEDIA_DIR = process.env.MEDIA_DIR || path.resolve(__dirname, 'media');
const CACHE_DIR = process.env.CACHE_DIR || path.resolve(__dirname, 'cache');
const TEMP_DIR = path.resolve(__dirname, 'tmp_upload');

storage.init();
storage.ensureDir('media', MEDIA_DIR).catch(() => {});
storage.ensureDir('cache', CACHE_DIR).catch(() => {});
fs.rmSync(TEMP_DIR, { recursive: true, force: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

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
const MAX_IMAGE_DIM = 1920;
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  '.mp4', '.webm', '.mov', '.avi', '.mkv',
  '.mp3', '.wav', '.ogg', '.pdf', '.zip'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

const upload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_EXTS.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido'));
  },
});

function getCacheKey(filename, opts) {
  const hash = crypto.createHash('md5').update(JSON.stringify(opts)).digest('hex').slice(0, 8);
  const ext = path.extname(filename);
  const fmt = (opts.format === 'webp' ? '.webp' : opts.format === 'jpeg' || opts.format === 'jpg' ? '.jpg' : opts.format === 'png' ? '.png' : ext);
  return `${path.basename(filename, ext)}_${hash}${fmt}`;
}

function ffprobeAvailable() {
  try { execSync('ffprobe -version', { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function probeVideo(filePath) {
  return new Promise((resolve) => {
    if (!ffprobeAvailable()) return resolve({});
    exec(`ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`, { timeout: 10000 }, (err, stdout) => {
      if (err) return resolve({});
      try {
        const info = JSON.parse(stdout);
        const videoStream = (info.streams || []).find(s => s.codec_type === 'video');
        const audioStream = (info.streams || []).find(s => s.codec_type === 'audio');
        resolve({
          duration: info.format?.duration ? parseFloat(info.format.duration) : null,
          width: videoStream?.width || null, height: videoStream?.height || null,
          codec: videoStream?.codec_name || null, audio_codec: audioStream?.codec_name || null,
          fps: videoStream?.r_frame_rate || null,
          bitrate: info.format?.bit_rate ? parseInt(info.format.bit_rate) : null,
        });
      } catch { resolve({}); }
    });
  });
}

function extractFrame(filePath, outputPath) {
  return new Promise((resolve) => {
    if (!ffprobeAvailable()) return resolve(false);
    exec(`ffmpeg -y -i "${filePath}" -vframes 1 -an -s 640x360 "${outputPath}"`, { timeout: 15000 }, (err) => {
      resolve(!err && fs.existsSync(outputPath));
    });
  });
}

function nearestColorName(r, g, b) {
  const COLORS = {
    red: { r: 255, g: 0, b: 0 }, orange: { r: 255, g: 165, b: 0 }, yellow: { r: 255, g: 255, b: 0 },
    green: { r: 0, g: 128, b: 0 }, cyan: { r: 0, g: 255, b: 255 }, blue: { r: 0, g: 0, b: 255 },
    purple: { r: 128, g: 0, b: 128 }, pink: { r: 255, g: 192, b: 203 }, brown: { r: 165, g: 42, b: 42 },
    white: { r: 255, g: 255, b: 255 }, gray: { r: 128, g: 128, b: 128 }, black: { r: 0, g: 0, b: 0 },
  };
  let minDist = Infinity, name = 'unknown';
  for (const [n, c] of Object.entries(COLORS)) {
    const d = Math.sqrt((r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2);
    if (d < minDist) { minDist = d; name = n; }
  }
  return name;
}

async function extractImageMetadata(filePath) {
  const meta = await sharp(filePath).metadata();
  const w = meta.width;
  const h = meta.height;
  const ext = path.extname(filePath).toLowerCase();
  const tags = [ext.replace('.', '')];

  if (w > h * 1.1) tags.push('landscape');
  else if (h > w * 1.1) tags.push('portrait');
  else tags.push('square');

  const mp = (w * h) / 1_000_000;
  if (mp < 0.3) tags.push('low_res');
  else if (mp < 2) tags.push('medium_res');
  else tags.push('high_res');

  let dominantColor = 'gray';
  try {
    const { data } = await sharp(filePath).resize(32, 32, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
    const pixels = [];
    for (let i = 0; i < data.length; i += 3) {
      pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
    }
    const total = pixels.length;
    const avg = pixels.reduce((a, p) => ({ r: a.r + p.r / total, g: a.g + p.g / total, b: a.b + p.b / total }), { r: 0, g: 0, b: 0 });
    const brightness = avg.r * 0.299 + avg.g * 0.587 + avg.b * 0.114;
    tags.push(brightness > 200 ? 'very_bright' : brightness > 150 ? 'bright' : brightness > 80 ? 'medium' : brightness > 40 ? 'dark' : 'very_dark');
    dominantColor = nearestColorName(Math.round(avg.r), Math.round(avg.g), Math.round(avg.b));
    tags.push(`${dominantColor}_dominant`);
    const vibrant = pixels.filter(p => Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b) > 80).length;
    tags.push(vibrant / total > 0.3 ? 'vibrant' : 'muted');
    const avgSat = pixels.reduce((a, p) => {
      const max = Math.max(p.r, p.g, p.b) / 255, min = Math.min(p.r, p.g, p.b) / 255;
      return a + (max === 0 ? 0 : (max - min) / max);
    }, 0) / total;
    tags.push(avgSat > 0.5 ? 'saturated' : avgSat > 0.2 ? 'moderate' : 'desaturated');
  } catch {}

  return { width: w, height: h, tags, dominant_color: dominantColor };
}

async function processImage(filePath, filename) {
  const ext = path.extname(filename).toLowerCase();
  let meta;
  try { meta = await sharp(filePath).metadata(); }
  catch { return { error: 'Cannot read image' }; }

  const originalWidth = meta.width;
  const originalHeight = meta.height;

  let pipeline = sharp(filePath);
  if (originalWidth > MAX_IMAGE_DIM || originalHeight > MAX_IMAGE_DIM) {
    if (originalWidth > originalHeight)
      pipeline = pipeline.resize(MAX_IMAGE_DIM);
    else
      pipeline = pipeline.resize(null, MAX_IMAGE_DIM);
  }

  const imgMeta = await extractImageMetadata(filePath);
  const tags = imgMeta.tags;

  const newFilename = `${path.basename(filename, ext)}.webp`;
  const outputPath = path.join(TEMP_DIR, newFilename);
  try {
    await pipeline.webp({ quality: 82 }).toFile(outputPath);
    const buf = fs.readFileSync(outputPath);
    await storage.writeFile('media', newFilename, buf);
    fs.unlink(outputPath, () => {});
    fs.unlink(filePath, () => {});
  } catch (e) {
    const buf = fs.readFileSync(filePath);
    await storage.writeFile('media', filename, buf);
    fs.unlink(filePath, () => {});
    return { filename, width: meta.width, height: meta.height, tags, error: `webp conversion failed: ${e.message}` };
  }

  return { filename: newFilename, width: meta.width, height: meta.height, original_width: originalWidth, original_height: originalHeight, tags };
}

async function processVideo(filePath, filename) {
  let meta = {};
  try { meta = await probeVideo(filePath); } catch {}

  const thumbFilename = `${path.basename(filename, path.extname(filename))}_thumb.jpg`;
  const thumbPath = path.join(TEMP_DIR, thumbFilename);
  const hasThumb = await extractFrame(filePath, thumbPath);
  if (hasThumb) {
    try {
      const thumbMeta = await sharp(thumbPath).metadata();
      if (thumbMeta.width > 640) {
        await sharp(thumbPath).resize(640).toFile(thumbPath + '_tmp');
        fs.renameSync(thumbPath + '_tmp', thumbPath);
      }
      const buf = fs.readFileSync(thumbPath);
      await storage.writeFile('media', thumbFilename, buf);
      fs.unlink(thumbPath, () => {});
    } catch {}
  }

  const buf = fs.readFileSync(filePath);
  await storage.writeFile('media', filename, buf);
  fs.unlink(filePath, () => {});

  return {
    filename, thumbnail: hasThumb ? thumbFilename : null,
    width: meta.width || null, height: meta.height || null,
    duration: meta.duration || null, codec: meta.codec || null,
    audio_codec: meta.audio_codec || null, fps: meta.fps || null,
    bitrate: meta.bitrate || null,
    tags: ['video', path.extname(filename).replace('.', '').toLowerCase()],
  };
}

async function processAndClassify(filePath, uniqueName, originalName, mime, fileSize) {
  const ext = path.extname(uniqueName).toLowerCase();
  const result = { filename: uniqueName, original_name: originalName, mime_type: mime, file_size: fileSize, width: null, height: null, duration: null, thumbnail: null, tags: [], error: null };

  if (mime.startsWith('image/') && ext !== '.gif') {
    const imgResult = await processImage(filePath, uniqueName);
    Object.assign(result, imgResult);
    result.mime_type = 'image/webp';
  } else if (mime.startsWith('video/')) {
    const vidResult = await processVideo(filePath, uniqueName);
    Object.assign(result, vidResult);
  } else {
    const buf = fs.readFileSync(filePath);
    await storage.writeFile('media', uniqueName, buf);
    fs.unlink(filePath, () => {});
  }

  if (result.tags.length < 3 && result.filename && !result.error) {
    try {
      const localPath = path.join(TEMP_DIR, result.filename);
      const exists = await storage.fileExists('media', result.filename);
      if (exists) {
        const buf = await storage.readFile('media', result.filename);
        fs.writeFileSync(localPath, buf);
        const deepTags = await classifyImage(localPath);
        result.tags = [...new Set([...result.tags, ...deepTags])];
        fs.unlink(localPath, () => {});
      }
    } catch {}
  }

  return result;
}

// --- Multipart upload (fallback) ---
app.post('/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) return res.status(400).json({ ok: false, error: 'Archivo demasiado grande' });
      return res.status(400).json({ ok: false, error: err.message || 'Error al subir archivo' });
    }
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se envió archivo' });

    const { path: tempPath, originalname, mimetype, size } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      fs.unlink(tempPath, () => {});
      return res.status(400).json({ ok: false, error: 'Tipo de archivo no permitido' });
    }

    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(TEMP_DIR, uniqueName);
    fs.renameSync(tempPath, filePath);

    try {
      const result = await processAndClassify(filePath, uniqueName, originalname, mimetype, size);
      const url = storage.getMediaUrl(result.filename, PORT);
      res.json({ ok: true, url, metadata: result });
    } catch (e) {
      const url = storage.getMediaUrl(uniqueName, PORT);
      res.json({ ok: true, url, metadata: { filename: uniqueName, error: e.message } });
    }
  });
});

// --- Raw binary upload (no multer) ---
app.post('/upload/raw', express.raw({ limit: '100mb', type: 'application/octet-stream' }), async (req, res) => {
  const originalName = req.headers['x-filename'] || 'file.bin';
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) return res.status(400).json({ ok: false, error: 'Tipo de archivo no permitido' });

  const buf = req.body;
  if (!buf || !Buffer.isBuffer(buf) || buf.length === 0)
    return res.status(400).json({ ok: false, error: 'No se recibieron bytes' });

  const mime = req.headers['x-mime'] || MIME_TYPES[ext] || 'application/octet-stream';

  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const filePath = path.join(TEMP_DIR, uniqueName);
  fs.writeFileSync(filePath, buf);

  try {
    const result = await processAndClassify(filePath, uniqueName, originalName, mime, buf.length);
    const url = storage.getMediaUrl(result.filename, PORT);
    res.json({ ok: true, url, metadata: result });
  } catch (e) {
    const url = storage.getMediaUrl(uniqueName, PORT);
    res.json({ ok: true, url, metadata: { filename: uniqueName, error: e.message } });
  }
});

async function serveMedia(safePath, req, res) {
  const ext = path.extname(safePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const isImage = mime.startsWith('image/') && ext !== '.gif';

  const w = parseInt(req.query.w) || 0;
  const h = parseInt(req.query.h) || 0;
  const fit = req.query.fit || 'cover';
  const format = req.query.format || ext.slice(1);
  const quality = parseInt(req.query.q) || 80;

  if (isImage && (w > 0 || h > 0 || format !== ext.slice(1))) {
    const opts = { w, h, fit, format, quality };
    const cacheKey = getCacheKey(path.basename(safePath), opts);
    const cachePath = path.join(CACHE_DIR, cacheKey);

    if (fs.existsSync(cachePath)) {
      res.set({ 'Content-Type': EXT_TO_MIME[opts.format] || mime, 'Cache-Control': 'public, max-age=31536000' });
      return res.sendFile(cachePath);
    }
    try {
      let pipeline = sharp(safePath);
      if (w > 0 || h > 0) {
        const fitOpt = fit === 'cover' ? 'cover' : fit === 'contain' ? 'contain' : 'fill';
        pipeline = pipeline.resize(w || null, h || null, { fit: fitOpt });
      }
      const mimeType = EXT_TO_MIME[opts.format] || 'image/jpeg';
      if (mimeType === 'image/webp') pipeline = pipeline.webp({ quality });
      else if (mimeType === 'image/png') pipeline = pipeline.png({ quality: quality > 90 ? undefined : Math.round(quality / 10) });
      else pipeline = pipeline.jpeg({ quality });
      const outBuf = await pipeline.toBuffer();
      fs.writeFile(cachePath, outBuf, () => {});
      res.set({ 'Content-Type': mimeType, 'Cache-Control': 'public, max-age=31536000' });
      return res.send(outBuf);
    } catch (e) {
      logger.error({ err: e.message }, 'processing error');
      return res.sendFile(safePath);
    }
  }

  const stat = fs.statSync(safePath);
  res.set({ 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000', 'Accept-Ranges': 'bytes' });
  if (req.headers.range) {
    const parts = req.headers.range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(safePath, { start, end }).pipe(res);
  } else {
    res.sendFile(safePath);
  }
}

app.get(/^\/(media|uploads)\/(.+)/, async (req, res) => {
  const filename = req.params[1];
  const safeFilename = path.basename(filename);

  // Try local MEDIA_DIR first, then S3
  const localPath = path.join(MEDIA_DIR, safeFilename);
  if (fs.existsSync(localPath)) {
    return serveMedia(localPath, req, res);
  }

  // Check for webp variant locally
  const webpPath = localPath.replace(/\.\w+$/, '.webp');
  if (fs.existsSync(webpPath)) {
    return serveMedia(webpPath, req, res);
  }

  // Try S3: download to temp and serve
  const exists = await storage.fileExists('media', safeFilename).catch(() => false);
  if (exists) {
    const buf = await storage.readFile('media', safeFilename);
    fs.writeFileSync(localPath, buf);
    return serveMedia(localPath, req, res);
  }

  // Check webp variant on S3
  const webpName = safeFilename.replace(/\.\w+$/, '.webp');
  if (webpName !== safeFilename) {
    const webpExists = await storage.fileExists('media', webpName).catch(() => false);
    if (webpExists) {
      const buf = await storage.readFile('media', webpName);
      fs.writeFileSync(webpPath, buf);
      return serveMedia(webpPath, req, res);
    }
  }

  res.status(404).send('Not found');
});

app.post('/classify', express.json({ limit: '1mb' }), async (req, res) => {
  const { filename } = req.body || {};
  if (!filename) return res.status(400).json({ ok: false, error: 'filename required' });
  const safeFilename = path.basename(filename);
  const localPath = path.join(MEDIA_DIR, safeFilename);
  if (!fs.existsSync(localPath)) {
    const exists = await storage.fileExists('media', safeFilename).catch(() => false);
    if (!exists) return res.status(404).json({ ok: false, error: 'File not found' });
    const buf = await storage.readFile('media', safeFilename);
    fs.writeFileSync(localPath, buf);
  }
  try {
    const tags = await classifyImage(localPath);
    res.json({ ok: true, tags });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true, uptime: process.uptime() }));

const server = http.createServer({ maxHeaderSize: 65536 }, app);
server.listen(PORT, () => {
  logger.info({ port: PORT, action: 'startup' }, 'Storage server iniciado');
  logger.info({ dir: MEDIA_DIR }, 'Media directory');
  logger.info({ dir: CACHE_DIR }, 'Cache directory');
});

function shutdown() {
  logger.info('Storage server shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
