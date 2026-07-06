const Jimp = require('jimp');
const path = require('path');

const COLOR_NAMES = {
  red: { r: 255, g: 0, b: 0 }, orange: { r: 255, g: 165, b: 0 }, yellow: { r: 255, g: 255, b: 0 },
  green: { r: 0, g: 128, b: 0 }, cyan: { r: 0, g: 255, b: 255 }, blue: { r: 0, g: 0, b: 255 },
  purple: { r: 128, g: 0, b: 128 }, pink: { r: 255, g: 192, b: 203 }, brown: { r: 165, g: 42, b: 42 },
  white: { r: 255, g: 255, b: 255 }, gray: { r: 128, g: 128, b: 128 }, black: { r: 0, g: 0, b: 0 },
};

function nearestColorName(r, g, b) {
  let minDist = Infinity, name = 'unknown';
  for (const [n, c] of Object.entries(COLOR_NAMES)) {
    const d = Math.sqrt((r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2);
    if (d < minDist) { minDist = d; name = n; }
  }
  return name;
}

async function classifyImage(filePath) {
  const tags = [];
  let image;
  try {
    image = await Jimp.read(filePath);
  } catch {
    return ['corrupted'];
  }

  const width = image.bitmap.width;
  const height = image.bitmap.height;
  if (!width || !height) return ['unknown'];

  const ext = path.extname(filePath).toLowerCase();
  tags.push(ext.replace('.', ''));

  if (width > height * 1.1) tags.push('landscape');
  else if (height > width * 1.1) tags.push('portrait');
  else tags.push('square');

  const megapixels = (width * height) / 1_000_000;
  if (megapixels < 0.3) tags.push('low_res');
  else if (megapixels < 2) tags.push('medium_res');
  else tags.push('high_res');

  try {
    const thumb = image.clone().resize(50, 50, Jimp.RESIZE_BILINEAR);
    const pixels = [];
    thumb.scan(0, 0, 50, 50, function(x, y, idx) {
      pixels.push({ r: this.bitmap.data[idx], g: this.bitmap.data[idx + 1], b: this.bitmap.data[idx + 2] });
    });

    const total = pixels.length;
    const avg = pixels.reduce((a, p) => ({ r: a.r + p.r / total, g: a.g + p.g / total, b: a.b + p.b / total }), { r: 0, g: 0, b: 0 });
    const brightness = (avg.r * 0.299 + avg.g * 0.587 + avg.b * 0.114);

    tags.push(brightness > 200 ? 'very_bright' : brightness > 150 ? 'bright' : brightness > 80 ? 'medium' : brightness > 40 ? 'dark' : 'very_dark');

    const colorName = nearestColorName(Math.round(avg.r), Math.round(avg.g), Math.round(avg.b));
    tags.push(`${colorName}_dominant`);

    const vibrant = pixels.filter(p => Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b) > 80).length;
    tags.push(vibrant / total > 0.3 ? 'vibrant' : 'muted');

    const saturations = pixels.map(p => {
      const max = Math.max(p.r, p.g, p.b) / 255, min = Math.min(p.r, p.g, p.b) / 255;
      return max === 0 ? 0 : (max - min) / max;
    });
    const avgSat = saturations.reduce((a, s) => a + s, 0) / total;
    tags.push(avgSat > 0.5 ? 'saturated' : avgSat > 0.2 ? 'moderate' : 'desaturated');
  } catch {
    tags.push('analysis_error');
  }

  return tags;
}

module.exports = { classifyImage };
