import { it, expect } from "vitest";
import Database from "better-sqlite3";
import { up } from "../../scripts/migrations/014_masala_homepage_image.mjs";
it("repairs only the incorrect demo association and preserves operator replacement images", () => {
  const db = new Database(":memory:");
  try {
    db.exec("CREATE TABLE products(id INTEGER PRIMARY KEY,slug TEXT); CREATE TABLE product_images(id INTEGER PRIMARY KEY,product_id INTEGER,url TEXT,alt_text TEXT,media_id INTEGER);");
    db.prepare("INSERT INTO products VALUES (?,?)").run(42,"masala-chai-reserve");
    db.prepare("INSERT INTO products VALUES (?,?)").run(81,"assam-golden-breakfast");
    const insert=db.prepare("INSERT INTO product_images VALUES (?,?,?,?,?)");
    insert.run(1,42,"/uploads/product-assam-tin.jpg","Wrong label",6);
    insert.run(2,42,"/uploads/operator-chai.webp","Operator photo",12);
    insert.run(3,81,"/uploads/product-assam-tin.jpg","Assam",6);
    up(db); up(db);
    expect(db.prepare("SELECT url,media_id FROM product_images WHERE id=1").get()).toEqual({url:"/images/home/masala-chai.webp",media_id:null});
    expect(db.prepare("SELECT url,media_id FROM product_images WHERE id=2").get()).toEqual({url:"/uploads/operator-chai.webp",media_id:12});
    expect(db.prepare("SELECT url,media_id FROM product_images WHERE id=3").get()).toEqual({url:"/uploads/product-assam-tin.jpg",media_id:6});
  } finally { db.close(); }
});
