// Storage abstraction — local filesystem or S3
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

let s3Client = null;
let s3Bucket = '';
let useS3 = false;

function initS3() {
  const { S3Client } = require('@aws-sdk/client-s3');
  s3Bucket = process.env.S3_BUCKET || '';
  if (!s3Bucket) {
    console.warn('[storage] S3_BUCKET not set, S3 disabled');
    return false;
  }
  s3Client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true' || undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
  useS3 = true;
  console.log('[storage] S3 enabled, bucket:', s3Bucket);
  return true;
}

function init() {
  if (process.env.S3_BUCKET) {
    try { initS3(); } catch (e) {
      console.warn('[storage] S3 init failed, falling back to local fs:', e.message);
    }
  }
}

function localPath(subdir, filename) {
  const base = subdir === 'media' ? process.env.MEDIA_DIR || path.resolve(__dirname, 'media')
    : subdir === 'cache' ? process.env.CACHE_DIR || path.resolve(__dirname, 'cache')
    : path.resolve(__dirname, subdir);
  return path.join(base, filename);
}

async function ensureDir(subdir) {
  if (useS3) return;
  const base = subdir === 'media' ? process.env.MEDIA_DIR || path.resolve(__dirname, 'media')
    : subdir === 'cache' ? process.env.CACHE_DIR || path.resolve(__dirname, 'cache')
    : path.resolve(__dirname, subdir);
  fs.mkdirSync(base, { recursive: true });
}

async function writeFile(subdir, filename, buffer) {
  if (useS3) {
    const { Upload } = require('@aws-sdk/lib-storage');
    const key = `${subdir}/${filename}`;
    const upload = new Upload({
      client: s3Client,
      params: { Bucket: s3Bucket, Key: key, Body: Readable.from(buffer) },
    });
    await upload.done();
    return;
  }
  const fp = localPath(subdir, filename);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, buffer);
}

async function readFile(subdir, filename) {
  if (useS3) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const cmd = new GetObjectCommand({ Bucket: s3Bucket, Key: `${subdir}/${filename}` });
    const resp = await s3Client.send(cmd);
    return resp.Body;
  }
  return fs.readFileSync(localPath(subdir, filename));
}

async function fileExists(subdir, filename) {
  if (useS3) {
    try {
      const { HeadObjectCommand } = require('@aws-sdk/client-s3');
      await s3Client.send(new HeadObjectCommand({ Bucket: s3Bucket, Key: `${subdir}/${filename}` }));
      return true;
    } catch { return false; }
  }
  return fs.existsSync(localPath(subdir, filename));
}

async function deleteFile(subdir, filename) {
  if (useS3) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: `${subdir}/${filename}` }));
    return;
  }
  const fp = localPath(subdir, filename);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

async function renameFile(subdir, oldName, newName) {
  if (useS3) {
    const { CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const prefix = `${subdir}/`;
    await s3Client.send(new CopyObjectCommand({ Bucket: s3Bucket, CopySource: `${s3Bucket}/${prefix}${oldName}`, Key: `${prefix}${newName}` }));
    await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: `${prefix}${oldName}` }));
    return;
  }
  const src = localPath(subdir, oldName);
  const dst = localPath(subdir, newName);
  fs.renameSync(src, dst);
}

function createReadStream(subdir, filename) {
  if (useS3) {
    throw new Error('S3 read stream not implemented, use readFile');
  }
  return fs.createReadStream(localPath(subdir, filename));
}

function stat(subdir, filename) {
  if (useS3) throw new Error('S3 stat not implemented');
  return fs.statSync(localPath(subdir, filename));
}

function getMediaUrl(filename, port) {
  if (useS3) {
    const baseUrl = process.env.S3_PUBLIC_URL || `https://${s3Bucket}.s3.amazonaws.com`;
    return `${baseUrl}/media/${filename}`;
  }
  return `http://localhost:${port}/media/${filename}`;
}

module.exports = { init, ensureDir, writeFile, readFile, fileExists, deleteFile, renameFile, createReadStream, stat, getMediaUrl, localPath };
