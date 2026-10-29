// Exercises the LIVE pipeline with mocked You.com / Parasail / Open-Meteo responses (no keys or network needed).
//   node test-live-mock.js
process.env.YDC_API_KEY = 'test-ydc';
const PROVIDER = process.env.TEST_PROVIDER || 'parasail'; // run: set TEST_PROVIDER=openai & node test-live-mock.js
if (PROVIDER === 'openai') { process.env.LLM_PROVIDER = 'openai'; process.env.OPENAI_API_KEY = 'sk-test'; process.env.OPENAI_MODEL = 'gpt-test'; } else { process.env.PARASAIL_API_KEY = 'test-ps'; process.env.PARASAIL_MODEL = 'mock-model'; }
process.env.PORT = '3107'; process.env.DEMO_DELAY = '0';

const realFetch = global.fetch;
const calls = [];
const json = (o, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } }));
const SRC = [
  { url: 'https://example.org/castle', title: 'Castle Wiki', snippets: ['A castle on a hill.'] },
  { url: 'https://example.org/ghosts', title: 'Ghost Tales', snippets: ['The grey lady appears in fog.'] },
];
const ARGS = {
  extract_clues: { place_guess: 'Old Hill Castle', region: 'Scotland', described_weather: ['thick fog', 'howling wind'], spooky_clues: ['old stone castle', 'on a hill'], mood: 'eerie' },
  pick_places: { candidates: [
    { name: 'Old Hill Castle', short: 'A ruined castle.', why_famous: 'Held out in a famous siege.', region: 'Scotland', lat: 56.0, lon: -4.0, confidence: 0.4, kind: 'castle', source_index: 1 },
    { name: 'Other Castle', short: 'Another.', why_famous: 'Also old.', region: 'Scotland', lat: null, lon: null, confidence: 0.35, kind: 'castle', source_index: 2 } ] },
  make_timeline: { events: [
    { date: '1300', year: 1300, title: 'Built', text: 'The first tower goes up.', source_index: 1 },
    { date: '1500', year: 1500, title: 'Besieged', text: 'A long siege.', source_index: 1 },
    { date: '1200', year: 1200, title: 'Hallucinated source', text: 'Should be dropped.', source_index: 9 } ] },
  make_legends: { legends: [{ title: 'The Grey Lady', story: 'Legend says a lady in grey walks the walls in fog.', conditions: ['fog', 'bogus_tag'], conditions_note: 'Seen in fog.', source_index: 2 }] },
  make_nearby: { places: [{ name: 'Haunted Abbey', lat: 56.05, lon: -4.05, legend: 'A monk is said to sing.', best_night: 'A misty evening.', source_index: 2 }] },
  ui_architect: { components: [{ type: 'LegendCard', legend_id: 'lg1' }, { type: 'PlaceCard', legend_id: null }, { type: 'Script', legend_id: null }, { type: 'WeatherPanel', legend_id: null }, { type: 'HauntMatch', legend_id: null }, { type: 'Timeline', legend_id: null }] },
};

global.fetch = async (url, opts = {}) => {
  const u = String(url); calls.push(u.replace(/\?.*/, ''));
  if (u.includes('api.parasail.io') || u.includes('api.openai.com')) {
    const body = JSON.parse(opts.body);
    if (u.includes('api.openai.com') !== (PROVIDER === 'openai')) throw new Error('wrong provider called: ' + u);
    if (PROVIDER === 'openai' && (body.temperature !== undefined || body.max_tokens !== undefined || !body.max_completion_tokens)) throw new Error('openai body params wrong');
    if (!u.endsWith('/chat/completions')) return json({ data: [{ id: body.model }] }); const name = body.tools && body.tools[0].function.name;
    if (!opts.headers.Authorization.startsWith('Bearer ')) throw new Error('missing bearer');
    if (name === 'extract_clues' && !globalThis.__failedOnce) { globalThis.__failedOnce = true; return json({ error: 'tools unsupported' }, 400); } // forces JSON-mode fallback
    const content = JSON.stringify(ARGS[name || body.messages.at(-1).content.match(/function|extract|clues/) && 'extract_clues'] || ARGS.extract_clues);
    if (body.tools) return json({ choices: [{ message: { tool_calls: [{ function: { name, arguments: JSON.stringify(ARGS[name]) } }] } }] });
    return json({ choices: [{ message: { content } }] });
  }
  if (u.includes('/v1/agents/search')) { if (opts.headers['X-API-Key'] !== 'test-ydc') throw new Error('bad key'); return json({ results: { web: SRC.map((s) => ({ url: s.url, title: s.title, description: 'd', snippets: s.snippets })) } }); }
  if (u.includes('api.you.com/v1/research')) return json({ output: { content: 'Research text.', content_type: 'text', sources: SRC } });
  if (u.includes('geocoding-api.open-meteo.com')) return json({ results: [{ latitude: 56.1, longitude: -4.1, name: 'Somewhere', admin1: 'Scotland', country: 'UK' }] });
  if (u.includes('api.open-meteo.com')) {
    const times = Array.from({ length: 8 }, (_, i) => `2026-10-28T${String(8 + i).padStart(2, '0')}:00`);
    return json({ current: { time: '2026-10-28T14:15', temperature_2m: 3.0, apparent_temperature: -1, is_day: 0, precipitation: 0, weather_code: 45, cloud_cover: 100, wind_speed_10m: 40, wind_gusts_10m: 60 },
      hourly: { time: times, temperature_2m: [9, 9, 8, 8, 7.5, 7.2, 6.8, 6.5], visibility: [900, 800, 700, 600, 500, 400, 300, 300] } });
  }
  return realFetch(url, opts);
};

require('./server.js');
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3107/ws'); const ev = {}; let layout;
ws.on('message', (raw) => {
  const m = JSON.parse(raw); ev[m.event] = m.data;
  if (m.event === 'hello') ws.send(JSON.stringify({ type: 'submit', text: 'thick fog and howling wind at an old castle in Scotland', demo: false }));
  if (m.event === 'choices') { console.log('choices offered:', m.data.options.map((o) => o.name).join(' | ')); ws.send(JSON.stringify({ type: 'choose', index: 0 })); }
  if (m.event === 'error') console.log('ERROR event:', m.data.step, m.data.detail);
  if (m.event === 'layout') layout = m.data;
  if (m.event === 'done') {
    const ok = (c, msg) => console.log((c ? 'PASS ' : 'FAIL ') + msg);
    ok(ev.received.mode === 'live', 'mode is live');
    ok(ev.place && ev.place.lat === 56 && ev.place.lon === -4, 'place coords near geocoded region kept: ' + (ev.place && [ev.place.lat, ev.place.lon]));
    ok(ev.weather.tags.includes('fog') && ev.weather.tags.includes('strong_wind') && ev.weather.tags.includes('cold'), 'weather tags: ' + ev.weather.tags);
    ok(ev.weather.temp_drop_c === 6 || ev.weather.temp_drop_c >= 3, 'temp drop computed: ' + ev.weather.temp_drop_c);
    ok(ev.weather.match.confirmed === true, 'conditions confirmed: ' + ev.weather.match.summary);
    ok(ev.history.events.length === 2 && ev.history.events[0].title === 'Built', 'timeline sorted, unsourced event dropped (' + ev.history.events.length + ')');
    ok(ev.legends.legends[0].conditions.join() === 'fog', 'bogus legend tag filtered: ' + ev.legends.legends[0].conditions);
    ok(ev.haunt_match.score >= 75, 'haunt match ' + ev.haunt_match.score);
    ok(layout.architect === 'parasail', 'layout from architect');
    ok(layout.components.map((c) => c.type).join() === 'LegendCard,PlaceCard,WeatherPanel,HauntMatch,Timeline,MapPin,Sources,ReportsFeed' || console.log('   got', layout.components.map((c) => c.type).join()), 'unknown "Script" component dropped; missing ones appended');
    ok(layout.components.every((c) => ['PlaceCard','HauntMatch','WeatherPanel','Timeline','LegendCard','MapPin','NearbyHaunts','Sources','ReportsFeed'].includes(c.type)), 'only library components');
    ok(calls.some((c) => c.includes(PROVIDER === 'openai' ? 'api.openai.com' : 'api.parasail.io')), 'used provider: ' + PROVIDER);
    console.log('upstream calls:', [...new Set(calls)].join(', '));
    process.exit(0);
  }
});
setTimeout(() => { console.log('TIMEOUT', Object.keys(ev)); process.exit(1); }, 20000);
