// The shop files the site and search engines start from, built from the live
// Shopify catalog: xelle/shop/catalog.json (the snapshot the shop opens with),
// sitemap.xml and llms.txt. server.mjs rewrites them into data/public/ every
// few minutes, so new products and collections need no build and no deploy;
// build_xelle_shop.mjs writes them into public/ by hand (the copies kept in
// git); build_xelle.cjs uses seoFiles.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const SNAPSHOT = 'xelle/shop/catalog.json';
const names = [SNAPSHOT, 'sitemap.xml', 'llms.txt'];

// sitemap.xml and llms.txt for a catalog (the "data" of a Storefront answer),
// so every product, collection and footer page has its address.
function seoFiles(catalog) {
  const site = 'https://xelle.ro';
  const description = /<meta name="description" content="([^"]*)"/.exec(read('public/index.html'))[1];
  const shopPages = [...read('scripts/xelle-shop.js').match(/const XELLE_SHOP_PAGES = \{[\s\S]*?\n\};/)[0].matchAll(/'([a-z-]+)': \{title: '([^']+)'/g)];
  const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const short = html => { const t = text(html || ''); return t.length > 220 ? t.slice(0, t.lastIndexOf(' ', 220)) + '…' : t; };
  // A handle may hold diacritics (parfumuri-pentru-barbați): encoded for the address.
  const collection = c => `/?colectie=${encodeURIComponent(c.handle)}`;
  const product = p => `/?produs=${encodeURIComponent(p.handle)}`;
  const urls = [
    {loc: '/'}, {loc: '/?sectiune=colectii'}, {loc: '/?sectiune=produse'},
    ...catalog.collections.nodes.map(c => ({loc: collection(c), lastmod: c.updatedAt})),
    ...catalog.products.nodes.map(p => ({loc: product(p), lastmod: p.updatedAt})),
    ...shopPages.map(([, slug]) => ({loc: `/?pagina=${slug}`})),
  ];
  return {
    'sitemap.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + urls.map(u => `  <url><loc>${site}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`).join('\n') + '\n</urlset>\n',
    'llms.txt': [
      '# Xellé', '', `> ${description}`, '',
      'Site-ul xelle.ro este o experiență 3D cu magazin integrat: coșul și plata se fac prin Shopify. Prețurile și stocul actuale sunt pe paginile de produs.', '',
      '## Produse', ...catalog.products.nodes.map(p => `- [${p.title}](${site}${product(p)})${short(p.descriptionHtml) ? ': ' + short(p.descriptionHtml) : ''}`), '',
      '## Colecții', ...catalog.collections.nodes.map(c => `- [${c.title}](${site}${collection(c)})${c.description ? ': ' + short(c.description) : ''}`), '',
      '## Informații', ...shopPages.map(([, slug, title]) => `- [${title}](${site}/?pagina=${slug})`), '',
    ].join('\n'),
  };
}

// Asks Shopify for the catalog and writes, under dir, the files that changed;
// returns their names. A failed or empty answer throws and leaves every file
// as it was.
async function syncShop(dir) {
  const context = {};
  vm.runInNewContext(read('scripts/xelle-shop-queries.js')
    + '\nthis.shop = {XELLE_SHOP_ENDPOINT, XELLE_SHOP_TOKEN, XELLE_SHOP_QUERIES};', context);
  const {XELLE_SHOP_ENDPOINT: endpoint, XELLE_SHOP_TOKEN: token, XELLE_SHOP_QUERIES: queries} = context.shop;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token},
    body: JSON.stringify({query: queries.catalog}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Shopify answered ${response.status}`);
  const body = await response.json();
  if (body.errors) throw new Error(`Shopify errors: ${JSON.stringify(body.errors)}`);
  if (!body.data.products.nodes.length) throw new Error('Shopify returned no products');

  const files = {[SNAPSHOT]: JSON.stringify({savedAt: new Date().toISOString(), data: body.data}), ...seoFiles(body.data)};
  // The saving time alone is not a change.
  const bare = text => (text || '').replace(/^\{"savedAt":"[^"]*",/, '{');
  const changed = [];
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(dir, name);
    if (fs.existsSync(file) && bare(fs.readFileSync(file, 'utf8')) === bare(text)) continue;
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file + '.tmp', text);
    fs.renameSync(file + '.tmp', file); // a visitor gets the old file or the new one, never half of it
    changed.push(name);
  }
  return changed;
}

// Cloudflare keeps /xelle/ files for a day (deploy/CLOUDFLARE.md), so a new
// snapshot is dropped from its cache, with the same purge-only token as
// deploy/deploy.sh. sitemap.xml and llms.txt are not cached there.
async function purgeSnapshot() {
  const tokenFile = '/etc/xelle/cloudflare-purge-token';
  if (!fs.existsSync(tokenFile)) return `no ${tokenFile}: Cloudflare cache not purged`;
  const zone = process.env.CF_ZONE_ID || 'eed3f74e160bb156061d7064ae7cff6d';
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + fs.readFileSync(tokenFile, 'utf8').trim(), 'Content-Type': 'application/json'},
    body: JSON.stringify({files: ['xelle.ro', 'www.xelle.ro'].map(host => `https://${host}/${SNAPSHOT}`)}),
    signal: AbortSignal.timeout(30000),
  });
  return response.ok ? 'Cloudflare cache purged' : `Cloudflare cache purge failed (${response.status})`;
}

module.exports = {SNAPSHOT, names, seoFiles, syncShop, purgeSnapshot};
