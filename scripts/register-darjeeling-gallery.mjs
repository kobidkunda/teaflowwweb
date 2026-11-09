// Additive, rerunnable catalogue-media import. Run db:backup before first use.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';

const assets = z.array(z.object({ filename: z.string().regex(/^[a-z0-9-]+\.webp$/), alt: z.string().min(1), caption: z.string().min(1) })).parse([
  { filename: 'darjeeling-spring-hero-v2.webp', alt: 'AI-created product illustration: Teafloww Darjeeling caddy on a sage backdrop', caption: 'AI-created product visualization; illustrative packaging, not actual product photography.' },
  { filename: 'darjeeling-spring-dry-leaf-v2.webp', alt: 'AI-created dry leaf illustration: wiry tea leaves on an ivory dish', caption: 'AI-created sensory illustration; not a photograph of this tea batch.' },
  { filename: 'darjeeling-spring-liquor-v2.webp', alt: 'AI-created liquor and brewing illustration: amber tea in an ivory cup', caption: 'AI-created brewing illustration; not a photograph of an actual product infusion.' },
  { filename: 'darjeeling-spring-wet-leaf-v2.webp', alt: 'AI-created wet leaf illustration: unfurled infused leaves on an ivory dish', caption: 'AI-created sensory illustration; not a photograph of this tea batch.' },
]);
const prepared = await Promise.all(assets.map(async asset => {
  const buffer = fs.readFileSync(path.join(process.cwd(), 'public/uploads', asset.filename));
  if (buffer.length > 5 * 1024 * 1024) throw new Error('Gallery asset exceeds upload limit.');
  const metadata = await sharp(buffer).metadata();
  if (metadata.format !== 'webp') throw new Error('Invalid gallery image type.');
  return { ...asset, size: buffer.length, width: metadata.width, height: metadata.height };
}));
const db = new Database(path.resolve(process.env.DATABASE_PATH || './data/store.sqlite'));
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
try {
  db.transaction(() => {
    const product = db.prepare('SELECT id FROM products WHERE slug=?').get('darjeeling-spring');
    if (!product) throw new Error('Darjeeling product not found; no catalogue changes made.');
    for (const [index, asset] of prepared.entries()) {
      const url = '/uploads/' + asset.filename;
      let media = db.prepare('SELECT id FROM media_uploads WHERE filename=?').get(asset.filename);
      if (!media) {
        const result = db.prepare('INSERT INTO media_uploads (filename,original_name,url,alt_text,caption,mime_type,file_size,width,height,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)').run(asset.filename,asset.filename,url,asset.alt,asset.caption,'image/webp',asset.size,asset.width,asset.height,index);
        media = { id: Number(result.lastInsertRowid) };
      }
      let image = db.prepare('SELECT id FROM product_images WHERE product_id=? AND url=?').get(product.id,url);
      const isNewImage = !image;
      if (!image) {
        const result = db.prepare('INSERT INTO product_images (product_id,media_id,url,alt_text,sort_order,is_primary) VALUES (?,?,?,?,?,?)').run(product.id,media.id,url,asset.alt,index,0);
        image = { id: Number(result.lastInsertRowid) };
      }
      if (index === 0 && isNewImage) {
        db.prepare('UPDATE product_images SET is_primary=0 WHERE product_id=? AND id<>?').run(product.id,image.id);
        db.prepare('UPDATE product_images SET is_primary=1 WHERE product_id=? AND id=?').run(product.id,image.id);
      }
    }
  })();
  console.log('Four gallery illustrations registered; previous images and media preserved.');
} finally { db.close(); }
