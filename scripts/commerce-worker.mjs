/** Separate worker process. HTTP keeps the Next/server DB runtime in one owner. */
const target = process.env.COMMERCE_WORKER_URL || 'http://127.0.0.1:3000/api/internal/commerce';
if (!process.env.COMMERCE_WORKER_SECRET) throw new Error('COMMERCE_WORKER_SECRET is required');
let stopped = false;
process.on('SIGTERM', () => { stopped = true; });
process.on('SIGINT', () => { stopped = true; });
while (!stopped) {
  let worked = false;
  try {
    const response = await fetch(target, { method:'POST', headers:{Authorization:`Bearer ${process.env.COMMERCE_WORKER_SECRET}`}, signal:AbortSignal.timeout(120000) });
    if (!response.ok) console.error('Commerce worker request failed:', response.status);
    else worked = (await response.json()).worked;
  } catch { console.error('Commerce worker connection unavailable'); }
  if (!worked) await new Promise(resolve => setTimeout(resolve, 5000));
}
