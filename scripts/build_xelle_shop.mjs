// Saves the Xellé catalog the site starts from: public/xelle/shop/catalog.json.
// Run it after editing products in Shopify for the fastest first view. Until
// then the site still notices the change by itself (live dates) and fetches the
// new catalog from Shopify; stock and prices are always read live.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'public', 'xelle', 'shop', 'catalog.json');
const context = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts', 'xelle-shop-queries.js'), 'utf8')
  + '\nthis.shop = {XELLE_SHOP_ENDPOINT, XELLE_SHOP_TOKEN, XELLE_SHOP_QUERIES};', context);
const {XELLE_SHOP_ENDPOINT: endpoint, XELLE_SHOP_TOKEN: token, XELLE_SHOP_QUERIES: queries} = context.shop;

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token},
  body: JSON.stringify({query: queries.catalog}),
});
if (!response.ok) throw new Error(`Shopify answered ${response.status}; the saved catalog was left unchanged`);
const body = await response.json();
if (body.errors) throw new Error(`Shopify errors: ${JSON.stringify(body.errors)}; the saved catalog was left unchanged`);
const {products, collections} = body.data;
if (!products.nodes.length) throw new Error('Shopify returned no products; the saved catalog was left unchanged');

fs.mkdirSync(path.dirname(output), {recursive: true});
fs.writeFileSync(output, JSON.stringify({savedAt: new Date().toISOString(), data: body.data}));
console.log(`Catalog saved: ${products.nodes.length} products, ${collections.nodes.length} collections, ${(fs.statSync(output).size / 1024).toFixed(1)} KB -> ${path.relative(root, output)}`);
