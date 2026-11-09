/** Accurate receipts do not promise packing before staff approve fulfillment. */
export function up(db) {
  const rows = [
    ['commerce_order_received','Commerce order received','Your TeaFloww order {{order_id}} was received','Hello {{customer_name}},\n\nWe received your tea order {{order_id}} for {{order_total}}. Payment status: {{payment_status}}.\n\nDelivery preparation and tracking updates will appear at your private order link:\n{{tracking_url}}\n\nQuestions? Contact {{support_email}}.'],
    ['commerce_payment_review','Captured payment requiring review','Payment received for TeaFloww order {{order_id}}','Hello {{customer_name}},\n\nPayment was received for order {{order_id}} ({{order_total}}). Fulfillment requires a review by our team. We will arrange delivery or a refund after resolving the issue.\n\nYour private order link:\n{{tracking_url}}\n\nQuestions? Contact {{support_email}}.'],
  ];
  for (const [key,label,subject,text] of rows) db.prepare(`INSERT INTO email_templates (key,label,description,subject,html_body,text_body,variables_json) VALUES (?,?,?,?,?,?,?) ON CONFLICT(key) DO NOTHING`).run(key,label,'Live commerce receipt',subject,`<div><h1>TeaFloww</h1><p>${text.replaceAll('\n','<br>')}</p></div>`,text,JSON.stringify(['customer_name','order_id','order_total','payment_status','tracking_url','support_email','store_name']));
}
export function down() {}
