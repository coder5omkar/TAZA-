/* ==========================================================================
   Upload storage — product photos, avatars (and future kinds)
   - Files live in UPLOADS_DIR (Railway: a mounted Volume, e.g. /data/uploads;
     local dev: ./uploads). NEVER inside the app bundle.
   - Images are re-encoded with sharp: a "full" (max 1000px, jpeg q80) and a
     small "thumb" (240px) — this also strips EXIF and rejects non-images.
   - Filenames are generated server-side, so client names can't do path tricks.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

const ROOT = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(ROOT, { recursive: true });

/* multipart "image" field, max 5 MB, kept in memory for sharp */
const imageUpload = function (req, res, next) {
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
  }).single('image')(req, res, function (err) {
    if (err) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({ error: tooBig ? 'Image too large (max 5 MB)' : 'Upload failed — use a photo file' });
    }
    next();
  });
};

function kindDir(kind) {
  const safe = String(kind).replace(/[^a-z0-9_-]/gi, '');
  const dir = path.join(ROOT, safe);
  fs.mkdirSync(dir, { recursive: true });
  return { safe: safe, dir: dir };
}

/* process + save one image; returns { path, thumb } public URLs */
async function saveImageSet(kind, nameBase, buffer) {
  if (!buffer || !buffer.length) throw new Error('Empty upload');

  let full, thumb;
  try {
    full = await sharp(buffer)
      .rotate()                                    /* honour camera orientation */
      .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    thumb = await sharp(buffer)
      .rotate()
      .resize({ width: 240, height: 240, fit: 'cover' })
      .jpeg({ quality: 78 })
      .toBuffer();
  } catch (e) {
    throw new Error('That file is not a readable image');
  }

  const k = kindDir(kind);
  const base = String(nameBase).replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'img';
  const stamp = Date.now() + '-' + Math.round(Math.random() * 1e4);
  const fullName = base + '-' + stamp + '.jpg';
  const thumbName = base + '-' + stamp + '-t.jpg';

  fs.writeFileSync(path.join(k.dir, fullName), full);
  fs.writeFileSync(path.join(k.dir, thumbName), thumb);

  return {
    path: '/uploads/' + k.safe + '/' + fullName,
    thumb: '/uploads/' + k.safe + '/' + thumbName
  };
}

/* best-effort delete by public path ('/uploads/products/x.jpg') */
function removeImage(publicPath) {
  const rel = String(publicPath || '').replace(/^\/uploads\//, '');
  if (!rel || rel.indexOf('..') !== -1) return;
  fs.unlink(path.join(ROOT, rel), function () { /* ignore */ });
}

module.exports = {
  ROOT: ROOT,
  imageUpload: imageUpload,
  saveImageSet: saveImageSet,
  removeImage: removeImage
};
