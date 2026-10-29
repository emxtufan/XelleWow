// Visit statistics, newsletter sign-ups and the /admin page. The password is
// ADMIN_PASSWORD in .env; the data lives in data/ as JSON lines, never in git.
// No IP is stored: a visitor is a daily anonymous hash, a visit is one tab session.
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(envFile)) {
  if (typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);
  else console.warn('.env not loaded: Node 20.12+ needed');
}

const dataDir = fileURLToPath(new URL('./data/', import.meta.url));
const eventsFile = dataDir + 'events.jsonl', subscribersFile = dataDir + 'subscribers.jsonl';
const adminPage = fileURLToPath(new URL('./admin.html', import.meta.url));
const LIVE_MS = 60000, SESSION_MS = 12 * 3600e3;
const CONSENT = 'Sunt de acord să primesc emailuri de la Xellé. Mă pot dezabona oricând.';
const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|monitor/i;
const SOURCES = [[/instagram/, 'Instagram'], [/facebook|fb\.com|fb\.me|^fb$/, 'Facebook'], [/tiktok/, 'TikTok'], [/google/, 'Google'],
  [/youtube|youtu\.be/, 'YouTube'], [/whatsapp|wa\.me/, 'WhatsApp'], [/(^|\.)t\.co$|twitter|(^|\.)x\.com$/, 'X'], [/pinterest/, 'Pinterest'],
  [/bing|yahoo|duckduckgo|yandex/, 'Alte căutări'], [/^ig$/, 'Instagram']];

const dayOf = t => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Bucharest' });
const events = [], subscribers = [], emails = new Set(), live = new Map(), hits = new Map();

// ponytail: everything is kept in memory and scanned per request; fine for
// hundreds of thousands of events, move to SQLite if the files reach GBs.
async function load(file, into) {
  if (!existsSync(file)) return;
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    if (!line) continue;
    try { into.push(JSON.parse(line)); } catch { console.warn('Skipped a damaged line in', file); }
  }
}
await mkdir(dataDir, { recursive: true });
await load(eventsFile, events);
await load(subscribersFile, subscribers);
for (const entry of subscribers) emails.add(entry.email);

function save(file, into, entry) {
  into.push(entry);
  appendFile(file, JSON.stringify(entry) + '\n').catch(error => console.error('Could not save to', file, error.message));
}

// Cloudflare adds the visitor's country (and city, with "Add visitor location headers").
const header = (req, name) => {
  const value = String(req.headers[name] || '');
  return Buffer.from(value, 'latin1').toString('utf8').slice(0, 80);
};
const clientIp = req => String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '');
const device = ua => /iPad|Tablet/i.test(ua) ? 'Tabletă' : /Mobi|Android|iPhone/i.test(ua) ? 'Telefon' : 'Desktop';

function source({ ref, utm, click }, ua) {
  const named = text => SOURCES.find(([pattern]) => pattern.test(text))?.[1];
  if (utm) return named(utm.toLowerCase()) || utm.slice(0, 40);
  if (/Instagram/.test(ua)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'Facebook';
  if (/TikTok|BytedanceWebview|musical_ly/.test(ua)) return 'TikTok';
  if (click === 'fbclid') return 'Facebook';
  if (click === 'gclid') return 'Google';
  const host = URL.canParse(ref) ? new URL(ref).hostname.replace(/^www\./, '') : '';
  if (!host || /(^|\.)xelle\.ro$/.test(host)) return 'Direct';
  return named(host) || host;
}

function limited(req, bucket, max) {
  const key = bucket + clientIp(req), now = Date.now(), entry = hits.get(key);
  if (!entry || entry.until < now) {
    if (hits.size > 20000) hits.clear();
    hits.set(key, { count: 1, until: now + 60000 });
    return false;
  }
  return ++entry.count > max;
}

function track(req, body) {
  const ua = String(req.headers['user-agent'] || '');
  const sid = String(body.sid || '');
  if (BOTS.test(ua) || !/^[\w-]{8,64}$/.test(sid)) return;
  const now = Date.now(), type = body.type;
  const path = String(body.path || '/').slice(0, 200);
  const page = { t: now, path };
  const known = live.get(sid);
  if (type === 'visit' || !known) {
    const visit = {
      src: source({ ref: String(body.ref || ''), utm: String(body.utm || ''), click: String(body.click || '') }, ua),
      country: header(req, 'cf-ipcountry'), city: header(req, 'cf-ipcity'), device: device(ua),
    };
    live.set(sid, { ...visit, start: now, ...page });
    if (type === 'visit') {
      const vid = createHash('sha256').update(dayOf(now) + clientIp(req) + ua + (process.env.ADMIN_PASSWORD || '')).digest('base64url').slice(0, 16);
      save(eventsFile, events, { t: now, day: dayOf(now), type, sid, vid, ...visit, path });
    }
  } else Object.assign(known, page);
  if (['product', 'cart', 'checkout'].includes(type)) {
    const handle = /^[a-z0-9-]{1,100}$/.test(body.handle || '') ? body.handle : '';
    save(eventsFile, events, { t: now, day: dayOf(now), type, sid, handle });
  }
  if (live.size > 5000) for (const [key, entry] of live) if (entry.t < now - LIVE_MS) live.delete(key);
}

function subscribe(req, body) {
  const email = String(body.email || '').trim().toLowerCase();
  if (body.website) return true; // the hidden field only bots fill in
  if (body.consent !== true || email.length > 254 || !/^[^\s@,;"<>]+@[^\s@,;"<>]+\.[^\s@,;"<>]{2,}$/.test(email)) return false;
  if (!emails.has(email)) {
    emails.add(email);
    save(subscribersFile, subscribers, {
      t: Date.now(), email, source: body.source === 'popup' ? 'popup' : 'footer',
      country: header(req, 'cf-ipcountry'), city: header(req, 'cf-ipcity'), consent: CONSENT,
    });
  }
  return true;
}

const tally = (list, key) => [...list.reduce((map, item) => map.set(key(item), (map.get(key(item)) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]);
const sessions = (list, type) => new Set(list.filter(e => e.type === type).map(e => e.sid)).size;

function stats(days) {
  const now = Date.now();
  const keys = Array.from({ length: days }, (_, i) => dayOf(now - i * 864e5)).reverse();
  const range = new Set(keys);
  const picked = events.filter(e => range.has(e.day));
  const visits = picked.filter(e => e.type === 'visit');
  for (const [key, entry] of live) if (entry.t < now - LIVE_MS) live.delete(key);
  const handles = new Map();
  for (const e of picked) {
    if (!e.handle || (e.type !== 'product' && e.type !== 'cart')) continue;
    const row = handles.get(e.handle) || { handle: e.handle, views: 0, carts: 0 };
    row[e.type === 'product' ? 'views' : 'carts']++;
    handles.set(e.handle, row);
  }
  return {
    days, now,
    totals: {
      visits: visits.length,
      visitors: new Set(visits.map(e => e.day + e.vid)).size,
      product: sessions(picked, 'product'), cart: sessions(picked, 'cart'), checkout: sessions(picked, 'checkout'),
      subscribers: subscribers.filter(s => range.has(dayOf(s.t))).length,
    },
    daily: keys.map(day => {
      const list = picked.filter(e => e.day === day), dayVisits = list.filter(e => e.type === 'visit');
      return { day, visits: dayVisits.length, visitors: new Set(dayVisits.map(e => e.vid)).size, cart: sessions(list, 'cart'), checkout: sessions(list, 'checkout') };
    }),
    sources: tally(visits, e => e.src),
    places: tally(visits, e => (e.country || '') + '|' + (e.city || '')),
    devices: tally(visits, e => e.device),
    products: [...handles.values()].sort((a, b) => b.views - a.views || b.carts - a.carts),
    live: [...live.values()].sort((a, b) => b.start - a.start),
    subscribers: subscribers.slice().reverse().map(({ t, email, source, country, city }) => ({ t, email, source, country, city })),
  };
}

const csvCell = value => {
  const text = String(value ?? '');
  return '"' + (/^[=+\-@]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
};
const subscribersCsv = () => '﻿' + [['email', 'data', 'sursa', 'tara', 'oras', 'acord'],
  ...subscribers.map(s => [s.email, new Date(s.t).toISOString(), s.source, s.country, s.city, s.consent])].map(row => row.map(csvCell).join(',')).join('\r\n');

// Admin session: a signed expiry in an HttpOnly cookie. Changing the password
// signs everyone out.
const password = () => process.env.ADMIN_PASSWORD || '';
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const sign = exp => exp + '.' + createHmac('sha256', 'xelle-admin:' + password()).update(String(exp)).digest('base64url');
function signedIn(req) {
  const token = /(?:^|;\s*)xelle_admin=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  if (!token || !password()) return false;
  const exp = Number(token.split('.')[0]);
  return exp > Date.now() && same(token, sign(exp));
}
const secure = req => req.headers['x-forwarded-proto'] === 'https' || String(req.headers['cf-visitor'] || '').includes('https');
const cookie = (req, value, maxAge) => `xelle_admin=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure(req) ? '; Secure' : ''}`;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 8192) { reject(new Error('Body too large')); req.destroy(); } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
async function readJson(req) {
  try { return JSON.parse(await readBody(req)); } catch { return null; }
}

const send = (res, status, body = '', headers = {}) => res.writeHead(status, { 'Cache-Control': 'no-store', ...headers }).end(body);
const json = (res, status, data, headers = {}) => send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', ...headers });

// Returns true when the request was one of ours.
export async function handleAdmin(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const route = req.method + ' ' + url.pathname.replace(/\/+$/, '');
  try {
    switch (route) {
      case 'POST /api/t': {
        const body = await readJson(req);
        if (body && !limited(req, 't', 240)) track(req, body);
        send(res, 204);
        return true;
      }
      case 'POST /api/newsletter': {
        if (limited(req, 'n', 6)) { json(res, 429, { error: 'Prea multe încercări. Încearcă din nou peste un minut.' }); return true; }
        const body = await readJson(req);
        if (body && subscribe(req, body)) json(res, 200, { ok: true });
        else json(res, 400, { error: 'Verifică adresa de email și bifează acordul.' });
        return true;
      }
      case 'GET /admin':
      case 'HEAD /admin':
        send(res, 200, req.method === 'HEAD' ? '' : await readFile(adminPage), {
          'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
        });
        return true;
      case 'POST /api/admin/login': {
        if (!password()) { json(res, 503, { error: 'ADMIN_PASSWORD nu este setat în .env pe server.' }); return true; }
        if (limited(req, 'l', 5)) { json(res, 429, { error: 'Prea multe încercări. Așteaptă un minut.' }); return true; }
        const body = await readJson(req);
        const hash = text => createHash('sha256').update(String(text)).digest('hex');
        if (!body || !same(hash(body.password), hash(password()))) { json(res, 401, { error: 'Parolă greșită.' }); return true; }
        json(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, sign(Date.now() + SESSION_MS), SESSION_MS / 1000) });
        return true;
      }
      case 'POST /api/admin/logout':
        json(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, '', 0) });
        return true;
      case 'GET /api/admin/stats':
        if (!signedIn(req)) { json(res, 401, { error: 'signin' }); return true; }
        json(res, 200, stats([1, 7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 7));
        return true;
      case 'GET /api/admin/abonati.csv':
        if (!signedIn(req)) { send(res, 401); return true; }
        send(res, 200, subscribersCsv(), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="abonati-xelle-${dayOf(Date.now())}.csv"` });
        return true;
      default:
        if (url.pathname.startsWith('/api/')) { send(res, 404); return true; }
        return false;
    }
  } catch (error) {
    console.error('admin', route, error);
    if (!res.headersSent) send(res, 500);
    return true;
  }
}
