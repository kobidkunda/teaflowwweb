// 025: Create contact_inquiries table and update contact page seed with TeaFloww branding
export function up(db) {
  // 1. Create contact_inquiries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      topic TEXT NOT NULL,
      message TEXT NOT NULL,
      order_id TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_contact_inquiries_topic ON contact_inquiries(topic);
    CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON contact_inquiries(status);
    CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created ON contact_inquiries(created_at);
  `);

  // 2. Update contact page in site_pages to reflect TeaFloww / Nirva brand details and content blocks
  const existingPage = db.prepare("SELECT id FROM site_pages WHERE slug = 'contact'").get();
  if (existingPage) {
    db.prepare(`
      UPDATE site_pages
      SET
        title = 'Contact Us',
        eyebrow = 'Customer Care & Sourcing Headquarters',
        headline = 'Connect With Our Himalayan Tea Masters',
        subtitle = 'Questions regarding brewing parameters, order status, private tasting bookings, or garden partnerships? We are here to assist.',
        body_markdown = 'Our central tasting room and dispatch facility is located in Siliguri, West Bengal, at the gateway to the Himalayan tea hills.',
        sections_json = ?,
        meta_title = 'Contact Us — Tasting Room & Sourcing Headquarters · TeaFloww',
        meta_description = 'Contact TeaFloww (Nirva) in Siliguri, West Bengal. Customer inquiries, brewing guidance, private tea tasting reservations, and wholesale partnerships.',
        updated_at = datetime('now')
      WHERE slug = 'contact'
    `).run(
      JSON.stringify([
        {
          id: "works",
          heading: "Works & Sourcing Facility",
          address: "00, Fulbari Ghoshpukur Bypass, Fulbari, Binnaguri, Dist Jalpaiguri, Siliguri, West Bengal — 734015",
          hours: "Monday – Saturday, 09:00 to 18:00 IST",
          notes: "Lot grading, sensory cupping lab, packaging & cold storage facility.",
        },
        {
          id: "office",
          heading: "Registered Office & Corporate Entity",
          entity: "Nirva",
          brand: "TeaFloww",
          gstin: "19CTHPK8646J2ZY",
          address: "Shiv Shakti Kali Bari Rd, Sukantapally East, Siliguri, West Bengal — 734005, India",
        },
        {
          id: "channels",
          heading: "Direct Contact Channels",
          email: "info@teafloww.com",
          phone: "+91 7001304853",
          whatsapp: "+91 7001304853",
          languages: ["English", "Hindi", "Bengali", "Nepali"],
        },
      ])
    );
  }
}

export function down() {}
