// Quick smoke test: node test-ws.js   (server must be running with DEMO_DELAY=0 for speed)
const WebSocket = require('ws');
const URL = 'ws://localhost:' + (process.env.PORT || 3000) + '/ws';

function run(label, payload, extra) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL); const seen = []; const t = setTimeout(() => reject(new Error(label + ' timeout; saw ' + seen.join(','))), 30000);
    ws.on('message', (raw) => {
      const m = JSON.parse(raw); seen.push(m.event);
      if (m.event === 'hello') ws.send(JSON.stringify({ type: 'submit', ...payload }));
      if (m.event === 'choices') ws.send(JSON.stringify({ type: 'choose', index: 1 }));
      if (m.event === 'layout') console.log(`  [${label}] layout (${m.data.architect}):`, m.data.components.map((c) => c.type + (c.data && c.data.id ? ':' + c.data.id : '')).join(' > '));
      if (m.event === 'haunt_match' && !m.data.recheck) console.log(`  [${label}] haunt ${m.data.score}: ${m.data.reason}`);
      if (m.event === 'weather') console.log(`  [${label}] weather (${m.data.source}): ${m.data.temperature_c}C wind ${m.data.wind_kmh} tags=${m.data.tags} confirmed=${m.data.match.confirmed}`);
      if (m.event === 'error') console.log(`  [${label}] ERROR`, m.data);
      if (extra) extra(ws, m);
      if (m.event === 'done') { clearTimeout(t); resolve({ ws, seen }); }
    });
  });
}

(async () => {
  for (const id of ['edinburgh', 'flannan', 'eastern-state']) {
    const { ws, seen } = await run(id, { demoId: id });
    console.log(id, '->', seen.join(' > ')); ws.close();
  }
  // typed text in demo mode, ambiguous -> choices
  const a = await run('typed-ambiguous', { text: 'something creepy near me', demo: true }); a.ws.close();
  const b = await run('typed-keywords', { text: 'a lighthouse in a storm', demo: true }); b.ws.close();

  // multi-user: A views edinburgh, B joins, B's report should reach A and trigger a re-check
  console.log('multi-user:');
  let gotReport = false, gotRecheck = false;
  const A = await run('A', { demoId: 'edinburgh' }, (ws, m) => { if (m.event === 'report' && !m.data.report.mine) gotReport = true; if (m.event === 'haunt_match' && m.data.recheck) { gotRecheck = true; console.log('  A re-check:', m.data.score, m.data.reason); } });
  await new Promise((r) => setTimeout(r, 300));
  const B = await run('B', { demoId: 'edinburgh' });
  await new Promise((r) => setTimeout(r, 300));
  B.ws.send(JSON.stringify({ type: 'report', text: 'Full moon and a thick haar creeping up the hill' }));
  await new Promise((r) => setTimeout(r, 800));
  console.log('A saw B report:', gotReport, '| A saw haunt re-check:', gotRecheck);
  A.ws.close(); B.ws.close();
  process.exit(0);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
