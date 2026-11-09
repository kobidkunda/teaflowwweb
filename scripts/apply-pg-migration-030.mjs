import pg from "pg";
const { Client } = pg;

const pgConfig = {
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5433", 10),
  user: process.env.PGUSER || "teafloww",
  password: process.env.PGPASSWORD || "teafloww",
  database: process.env.PGDATABASE || "teafloww",
};

async function applyMigration030() {
  const client = new Client(pgConfig);
  await client.connect();
  console.log("Connected to PostgreSQL successfully.");

  try {
    await client.query("BEGIN");

    console.log("Applying 030_update_tea_rituals_video...");

    // 1. Fetch current homepage_content_v1 from store_settings
    const res = await client.query("SELECT value FROM store_settings WHERE key = 'homepage_content_v1'");
    let targetVideoUrl = "https://www.youtube.com/watch?v=iD_Q88tX-H4";
    let targetVideoTitle = "Tea Rituals of North Bengal";

    if (res.rows.length > 0 && res.rows[0].value) {
      try {
        const content = JSON.parse(res.rows[0].value);
        if (content?.story?.video_url && !content.story.video_url.includes("0hBfp43vJ_c")) {
          targetVideoUrl = content.story.video_url;
        }
        if (content?.story?.video_title) {
          targetVideoTitle = content.story.video_title;
        }
        content.story = content.story || {};
        content.story.video_url = targetVideoUrl;
        content.story.video_title = targetVideoTitle;

        await client.query(
          "UPDATE store_settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = 'homepage_content_v1'",
          [JSON.stringify(content)]
        );
        console.log(`Updated store_settings homepage_content_v1 with video: ${targetVideoUrl}`);
      } catch (err) {
        console.error("Error parsing/updating homepage_content_v1:", err);
      }
    }

    // 2. Upsert site_content_blocks for video url and title
    await client.query(
      `INSERT INTO site_content_blocks (key, content, content_type, description, updated_at)
       VALUES ('home.story_video_url', $1, 'url', 'YouTube video link for North Bengal tea rituals on homepage story section', CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP`,
      [targetVideoUrl]
    );

    await client.query(
      `INSERT INTO site_content_blocks (key, content, content_type, description, updated_at)
       VALUES ('home.story_video_title', $1, 'text', 'Title / badge label for homepage story video', CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP`,
      [targetVideoTitle]
    );
    console.log("Upserted site_content_blocks for home.story_video_url and home.story_video_title");

    // 3. Record migration in schema_migrations
    await client.query(
      `INSERT INTO schema_migrations (version, applied_at)
       VALUES ('030_update_tea_rituals_video', CURRENT_TIMESTAMP)
       ON CONFLICT (version) DO NOTHING`
    );
    console.log("Recorded 030_update_tea_rituals_video in schema_migrations");

    await client.query("COMMIT");
    console.log("Migration 030 applied successfully to PostgreSQL!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration 030 failed, rolled back:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration030();
