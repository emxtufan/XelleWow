// Saves, from the live Shopify catalog, the files the site starts from:
// public/xelle/shop/catalog.json, public/sitemap.xml and public/llms.txt.
// The server does the same by itself every 10 minutes (server.mjs, into
// data/public/), so new products and collections reach the site without this.
// Running it by hand only refreshes the copies kept in git, which the server
// uses until its first answer from Shopify.
import path from 'node:path';
import shopSync from './xelle-shop-sync.cjs';

const changed = await shopSync.syncShop(path.resolve(import.meta.dirname, '..', 'public'));
console.log(changed.length ? `Updated in public/: ${changed.join(', ')}` : 'Nothing new in Shopify: the files in public/ were left as they were');
