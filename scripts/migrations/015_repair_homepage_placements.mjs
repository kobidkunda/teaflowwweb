// Repair demo hero and story site_placements, preserving operator custom images.
// Replaces deprecated bento crop (with baked-in text) with clean Option 3 ritual story and hero assets.
export function up(db) {
  const hasMedia = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='media_uploads'").get();
  const hasPlacements = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='site_placements'").get();

  let heroMediaId = null;
  let storyMediaId = null;

  if (hasMedia) {
    const insertMedia = db.prepare(`
      INSERT INTO media_uploads (filename, original_name, url, alt_text, caption, mime_type, file_size, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(filename) DO UPDATE SET
        alt_text = excluded.alt_text,
        caption = excluded.caption
    `);

    insertMedia.run(
      "ritual-hero.webp",
      "ritual-hero.webp",
      "/uploads/ritual-hero.webp",
      "Decorative AI illustration of a ceramic tea cup, loose leaves and a botanical branch.",
      "Closer to the garden, better in the cup hero visual",
      "image/webp",
      81976,
      0
    );

    insertMedia.run(
      "ritual-story.webp",
      "ritual-story.webp",
      "/uploads/ritual-story.webp",
      "Decorative AI image of hands holding tea overlooking a mountain landscape.",
      "Hands holding warm tea overlooking misty mountains at dawn",
      "image/webp",
      87740,
      1
    );

    const getMedia = db.prepare("SELECT id FROM media_uploads WHERE filename = ?");
    heroMediaId = getMedia.get("ritual-hero.webp")?.id ?? null;
    storyMediaId = getMedia.get("ritual-story.webp")?.id ?? null;
  }

  if (hasPlacements) {
    // Repair home_hero if it currently uses empty or the old demo seed
    const hero = db.prepare("SELECT image_url, title FROM site_placements WHERE section_key = 'home_hero'").get();
    if (hero) {
      if (!hero.image_url || hero.image_url === "/uploads/hero-himalayan-tea.jpg") {
        db.prepare(`
          UPDATE site_placements
          SET media_id = COALESCE(?, media_id),
              image_url = '/uploads/ritual-hero.webp',
              alt_text = 'Decorative AI illustration of a ceramic tea cup, loose leaves and a botanical branch.',
              updated_at = CURRENT_TIMESTAMP
          WHERE section_key = 'home_hero'
        `).run(heroMediaId);
      }
    }

    // Repair home_story if it currently uses empty or the deprecated bento crop
    const story = db.prepare("SELECT image_url FROM site_placements WHERE section_key = 'home_story'").get();
    if (story) {
      if (!story.image_url || story.image_url === "/uploads/bento-plantation.jpg" || story.image_url === "/images/bento-plantation.jpg") {
        db.prepare(`
          UPDATE site_placements
          SET media_id = COALESCE(?, media_id),
              image_url = '/uploads/ritual-story.webp',
              alt_text = 'Decorative AI image of hands holding tea overlooking a mountain landscape.',
              updated_at = CURRENT_TIMESTAMP
          WHERE section_key = 'home_story'
        `).run(storyMediaId);
      }
    }
  }
}

export function down() {}
