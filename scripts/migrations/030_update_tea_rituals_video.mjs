// 030: Update homepage story video to active North Bengal tea rituals video
export function up(db) {
  const DEFAULT_VIDEO_URL = "https://www.youtube.com/watch?v=iD_Q88tX-H4";
  const DEFAULT_VIDEO_TITLE = "Tea Rituals of North Bengal";

  let targetVideoUrl = DEFAULT_VIDEO_URL;
  let targetVideoTitle = DEFAULT_VIDEO_TITLE;

  const hasStoreSettings = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='store_settings'")
    .get();

  if (hasStoreSettings) {
    const row = db.prepare("SELECT value FROM store_settings WHERE key='homepage_content_v1'").get();
    if (row && row.value) {
      try {
        const content = JSON.parse(row.value);
        if (content?.story?.video_url && !content.story.video_url.includes("0hBfp43vJ_c")) {
          targetVideoUrl = content.story.video_url;
        }
        if (content?.story?.video_title) {
          targetVideoTitle = content.story.video_title;
        }
        content.story = content.story || {};
        content.story.video_url = targetVideoUrl;
        content.story.video_title = targetVideoTitle;
        db.prepare("UPDATE store_settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key='homepage_content_v1'").run(JSON.stringify(content));
      } catch {}
    }
  }

  const hasContentBlocks = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='site_content_blocks'")
    .get();

  if (hasContentBlocks) {
    db.prepare(`
      INSERT INTO site_content_blocks (key, content, content_type, description, updated_at)
      VALUES ('home.story_video_url', ?, 'url', 'YouTube video link for North Bengal tea rituals on homepage story section', datetime('now'))
      ON CONFLICT(key) DO UPDATE SET content=excluded.content, updated_at=datetime('now')
    `).run(targetVideoUrl);

    db.prepare(`
      INSERT INTO site_content_blocks (key, content, content_type, description, updated_at)
      VALUES ('home.story_video_title', ?, 'text', 'Title / badge label for homepage story video', datetime('now'))
      ON CONFLICT(key) DO UPDATE SET content=excluded.content, updated_at=datetime('now')
    `).run(targetVideoTitle);
  }
}

export function down() {}
