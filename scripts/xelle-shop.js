// Live link between the experience and the Xellé Shopify store (xelle.ro).
// Queries, endpoint and public token live in xelle-shop-queries.js.
const XELLE_CART_KEY = 'xelle-cart-id';
// A code from a ?discount=<code> link waits here until there is a cart to put it on.
const XELLE_DISCOUNT_KEY = 'xelle-discount';
// Codes that may start to apply as the cart changes stay on it, as in Shopify's own cart.
const XELLE_DISCOUNT_LATER = ['DISCOUNT_NO_ENTITLED_LINE_ITEMS', 'DISCOUNT_PURCHASE_NOT_IN_RANGE', 'DISCOUNT_QUANTITY_NOT_IN_RANGE'];
const XELLE_SNAPSHOT_URL = '/xelle/shop/catalog.json';
const XELLE_LIVE_MAX_AGE = 60000;
const XELLE_STOCK_CODES = ['MERCHANDISE_NOT_ENOUGH_STOCK', 'MERCHANDISE_OUT_OF_STOCK', 'MERCHANDISE_NOT_ENOUGH_STOCK_AVAILABLE'];

let xelleShopStore = null;
function xelleShop() {
  // Built on first use, once Vue's reactivity is available.
  if (!xelleShopStore) xelleShopStore = {
    catalog: Pa(null), catalogFailed: Pa(false), recommendations: Pa({}),
    cart: Pa(null), cartBusy: Pa(false), cartMessage: Pa(''), codeMessage: Pa(''), cartOpen: Pa(false),
    view: Pa(null), live: Pa(false), catalogRequest: null, catalogLoading: false, liveAt: 0,
    warmedUp: false, cartLoaded: false, wasPaused: false,
    policies: Pa(null), policiesFailed: Pa(false), policiesRequest: null,
  };
  return xelleShopStore;
}

// Footer pages. Policies come from the store; the contact details are those of
// the store's contact-information page.
const XELLE_SHOP_PAGES = {
  'politica-de-confidentialitate': {title: 'Politica de confidențialitate', policy: 'privacyPolicy'},
  'politica-de-retur': {title: 'Politică de Retur', policy: 'refundPolicy'},
  'politica-de-garantie': {title: 'Politică de Garanție', policy: 'shippingPolicy'},
  'termeni-si-conditii': {title: 'Termeni si Conditii', policy: 'termsOfService'},
  'contact': {title: 'Contact'},
};

function xelleLoadPolicies(retry = false) {
  const shop = xelleShop();
  if (shop.policiesRequest && !retry) return shop.policiesRequest;
  shop.policiesFailed.value = false;
  shop.policiesRequest = xelleShopRequest(XELLE_SHOP_QUERIES.policies)
    .then(data => { shop.policies.value = data.shop; })
    .catch(error => {
      console.warn('[Xellé shop]', error);
      shop.policiesRequest = null;
      shop.policiesFailed.value = true;
    });
  return shop.policiesRequest;
}

async function xelleShopRequest(query, variables = {}) {
  const response = await fetch(XELLE_SHOP_ENDPOINT, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': XELLE_SHOP_TOKEN},
    body: JSON.stringify({query, variables}),
  });
  if (!response.ok) throw new Error('Shopify ' + response.status);
  const body = await response.json();
  if (body.errors && body.errors.length) throw new Error(body.errors[0].message);
  return body.data;
}

function xelleMoney(money) {
  if (!money) return '';
  const value = Number(money.amount).toLocaleString('ro-RO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return money.currencyCode === 'RON' ? value + ' lei' : value + ' ' + money.currencyCode;
}

function xelleOnSale(variant) {
  return !!(variant && variant.compareAtPrice && Number(variant.compareAtPrice.amount) > Number(variant.price.amount));
}

function xelleShopProduct(node) {
  const variants = node.variants.nodes;
  return {...node, variants, images: node.images.nodes, variant: variants.find(v => v.availableForSale) || variants[0]};
}

function xelleCatalogFrom(data) {
  const products = data.products.nodes.map(xelleShopProduct);
  return {
    products,
    byHandle: Object.fromEntries(products.map(product => [product.handle, product])),
    collections: data.collections.nodes.map(collection => ({...collection, handles: collection.products.nodes.map(p => p.handle)})),
  };
}

// Live stock and prices replace the snapshot's. Returns false when the live
// dates show any other change (a product or collection added, removed or
// edited in Shopify), which only the full catalog query can bring in.
function xelleApplyLive(catalog, live) {
  const products = live.products.nodes, collections = live.collections.nodes;
  const unchanged = products.length === catalog.products.length && collections.length === catalog.collections.length
    && products.every(p => catalog.byHandle[p.handle] && catalog.byHandle[p.handle].updatedAt === p.updatedAt)
    && collections.every(c => catalog.collections.some(known => known.handle === c.handle && known.updatedAt === c.updatedAt));
  if (!unchanged) return false;
  products.forEach(p => {
    const product = catalog.byHandle[p.handle];
    const fresh = Object.fromEntries(p.variants.nodes.map(v => [v.id, v]));
    product.availableForSale = p.availableForSale;
    product.variants = product.variants.map(v => fresh[v.id] ? {...v, ...fresh[v.id]} : v);
    product.variant = product.variants.find(v => v.availableForSale) || product.variants[0];
  });
  return true;
}

// The saved snapshot (build_xelle_shop.mjs) shows the shop at once; a small
// live query then sets stock and prices, and the full catalog is requested
// only when Shopify reports a change the snapshot does not have yet.
function xelleLoadCatalog(retry = false) {
  const shop = xelleShop();
  if (shop.catalogRequest && (!retry || shop.catalogLoading)) return shop.catalogRequest;
  shop.catalogFailed.value = false;
  shop.catalogLoading = true;
  shop.catalogRequest = (async () => {
    const live = xelleShopRequest(XELLE_SHOP_QUERIES.live);
    live.catch(() => {}); // awaited below; this only keeps an early failure from being reported twice
    if (!shop.catalog.value) {
      try {
        const response = await fetch(XELLE_SNAPSHOT_URL, {cache: 'no-cache'});
        if (response.ok) shop.catalog.value = xelleCatalogFrom((await response.json()).data);
      } catch (error) {
        console.warn('[Xellé shop] snapshot unavailable, loading live', error);
      }
    }
    const fresh = await live;
    if (!shop.catalog.value || !xelleApplyLive(shop.catalog.value, fresh)) {
      shop.catalog.value = xelleCatalogFrom(await xelleShopRequest(XELLE_SHOP_QUERIES.catalog));
    }
    shop.liveAt = Date.now();
    shop.live.value = true;
  })().catch(error => {
    console.warn('[Xellé shop]', error);
    shop.catalogRequest = null;
    if (!shop.catalog.value) shop.catalogFailed.value = true;
  }).finally(() => {
    shop.catalogLoading = false;
  });
  return shop.catalogRequest;
}

// Stock is checked again whenever the shop opens after a minute or more.
function xelleRefreshLive() {
  const shop = xelleShop();
  if (!shop.liveAt || Date.now() - shop.liveAt > XELLE_LIVE_MAX_AGE) xelleLoadCatalog(true);
}

// Entering the site: once the experience has loaded, the catalog arrives and
// the product photos download in the background, so the shop opens with its
// pictures ready. Small images come first, large ones after, and visitors
// saving data or on a slow connection get the small ones only.
function xelleShopWarmup() {
  const shop = xelleShop();
  if (shop.warmedUp) return;
  shop.warmedUp = true;
  xelleLoadCart();
  xelleLoadCatalog().then(() => {
    const catalog = shop.catalog.value;
    if (!catalog) return;
    const connection = navigator.connection;
    const light = !!connection && (connection.saveData || /2g/.test(connection.effectiveType || ''));
    const queue = [...new Set([
      ...catalog.collections.map(collection => collection.image && collection.image.url),
      ...catalog.products.map(product => product.images[0] && product.images[0].thumb),
      ...(light ? [] : catalog.products.flatMap(product => product.images.flatMap(image => [image.url, image.thumb]))),
    ].filter(Boolean))];
    const idle = window.requestIdleCallback ? task => window.requestIdleCallback(task, {timeout: 2000}) : task => setTimeout(task, 200);
    const next = () => {
      const url = queue.shift();
      if (!url) return;
      const image = new Image();
      image.decoding = 'async';
      image.onload = image.onerror = () => idle(next);
      image.src = url;
    };
    for (let lane = 0; lane < 3; lane++) idle(next);
  });
}

async function xelleLoadRecommendations(product) {
  const shop = xelleShop();
  if (shop.recommendations.value[product.handle]) return;
  try {
    const data = await xelleShopRequest(XELLE_SHOP_QUERIES.recommendations, {productId: product.id});
    shop.recommendations.value = {...shop.recommendations.value, [product.handle]: (data.productRecommendations || []).map(p => p.handle)};
  } catch (error) {
    console.warn('[Xellé shop]', error);
  }
}

// The cart id survives reloads in this browser only. Storage can be blocked
// (private mode); the cart then simply lasts for the current visit.
function xelleStored(key, value) {
  try {
    if (value === undefined) return window.localStorage.getItem(key);
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch (error) {
    console.warn('[Xellé shop] cart storage unavailable', error);
  }
  return null;
}
const xelleCartId = value => xelleStored(XELLE_CART_KEY, value);

async function xelleLoadCart() {
  const shop = xelleShop();
  if (shop.cartLoaded) return;
  shop.cartLoaded = true;
  const linked = new URLSearchParams(window.location.search).get('discount');
  if (linked && linked.trim()) xelleStored(XELLE_DISCOUNT_KEY, linked.trim());
  const id = xelleCartId();
  if (!id) return;
  try {
    const data = await xelleShopRequest(XELLE_SHOP_QUERIES.cart, {id});
    // A cart that went through checkout no longer exists: forget it.
    if (data.cart) shop.cart.value = data.cart;
    else xelleCartId(null);
    xelleApplyLinkedCode();
  } catch (error) {
    console.warn('[Xellé shop]', error);
    shop.cartLoaded = false;
  }
}

function xelleCartProblem(result) {
  // Discount warnings are answered next to the code field instead.
  const problem = (result.userErrors || [])[0] || (result.warnings || []).find(warning => !warning.code.startsWith('DISCOUNT_'));
  if (!problem) return '';
  return XELLE_STOCK_CODES.includes(problem.code)
    ? 'Nu mai sunt suficiente bucăți în stoc pentru cantitatea aleasă.'
    : 'Coșul nu a putut fi actualizat. Încearcă din nou.';
}

async function xelleCartChange(name, field, variables) {
  const shop = xelleShop();
  shop.cartBusy.value = true;
  shop.cartMessage.value = '';
  try {
    const result = (await xelleShopRequest(XELLE_SHOP_QUERIES[name], variables))[field];
    if (result.cart) {
      shop.cart.value = result.cart;
      xelleCartId(result.cart.id);
    }
    shop.cartMessage.value = xelleCartProblem(result);
    return result;
  } catch (error) {
    console.warn('[Xellé shop]', error);
    shop.cartMessage.value = 'Coșul nu a putut fi actualizat. Verifică conexiunea și încearcă din nou.';
    return null;
  } finally {
    shop.cartBusy.value = false;
  }
}

async function xelleAddToCart(variantId, quantity) {
  const shop = xelleShop();
  await xelleLoadCart();
  const lines = [{merchandiseId: variantId, quantity}];
  let cart = shop.cart.value ? (await xelleCartChange('add', 'cartLinesAdd', {id: shop.cart.value.id, lines}))?.cart : null;
  // No cart yet, or the stored one expired: start a new one.
  if (!cart) cart = (await xelleCartChange('create', 'cartCreate', {lines}))?.cart;
  if (cart && !shop.cartMessage.value) { shop.cartOpen.value = true; xelleTrackVariant('cart', variantId); }
  await xelleApplyLinkedCode();
}

async function xelleApplyLinkedCode() {
  const code = xelleStored(XELLE_DISCOUNT_KEY);
  if (!code || !xelleShop().cart.value) return;
  xelleStored(XELLE_DISCOUNT_KEY, null);
  await xelleApplyCode(code);
}

// One field for both, like Shopify's checkout: a discount code first, then a gift card.
async function xelleApplyCode(input) {
  const shop = xelleShop();
  const cart = shop.cart.value;
  const code = input.trim();
  shop.codeMessage.value = '';
  if (!code || !cart) return;
  const same = entry => entry.code.toLowerCase() === code.toLowerCase();
  if (cart.discountCodes.some(same)) return;
  const codes = cart.discountCodes.map(entry => entry.code);
  const result = await xelleCartChange('discounts', 'cartDiscountCodesUpdate', {id: cart.id, codes: [...codes, code]});
  if (!result || !result.cart) return;
  if (result.cart.discountCodes.find(same)?.applicable) return;
  const warning = (result.warnings || []).find(entry => entry.code.startsWith('DISCOUNT_'));
  if (warning && XELLE_DISCOUNT_LATER.includes(warning.code)) {
    shop.codeMessage.value = `Codul ${code} este valid, dar nu se aplică încă produselor din coș.`;
    return;
  }
  await xelleCartChange('discounts', 'cartDiscountCodesUpdate', {id: cart.id, codes});
  const giftCards = (shop.cart.value || cart).appliedGiftCards.length;
  const gift = await xelleCartChange('giftCardAdd', 'cartGiftCardCodesAdd', {id: cart.id, codes: [code]});
  if (!gift || (gift.cart && gift.cart.appliedGiftCards.length > giftCards)) return;
  shop.codeMessage.value = warning && warning.code !== 'DISCOUNT_NOT_FOUND'
    ? `Codul ${code} nu mai poate fi folosit.`
    : `Codul ${code} nu este valid.`;
}

function xelleRemoveCode(code) {
  const cart = xelleShop().cart.value;
  xelleShop().codeMessage.value = '';
  return cart && xelleCartChange('discounts', 'cartDiscountCodesUpdate', {id: cart.id, codes: cart.discountCodes.map(entry => entry.code).filter(entry => entry !== code)});
}

function xelleRemoveGiftCard(giftCardId) {
  const cart = xelleShop().cart.value;
  return cart && xelleCartChange('giftCardRemove', 'cartGiftCardCodesRemove', {id: cart.id, ids: [giftCardId]});
}

// "Cumpără acum" goes to checkout with this product alone and leaves the cart as it is.
async function xelleBuyNow(variantId, quantity) {
  const shop = xelleShop();
  shop.cartBusy.value = true;
  shop.cartMessage.value = '';
  try {
    const discountCodes = (shop.cart.value?.discountCodes || []).map(entry => entry.code).concat(xelleStored(XELLE_DISCOUNT_KEY) || []);
    const result = (await xelleShopRequest(XELLE_SHOP_QUERIES.create, {lines: [{merchandiseId: variantId, quantity}], discountCodes})).cartCreate;
    shop.cartMessage.value = xelleCartProblem(result);
    if (result.cart && !shop.cartMessage.value) {
      xelleTrackVariant('cart', variantId);
      xelleTrack('checkout');
      window.location.href = result.cart.checkoutUrl;
    }
  } catch (error) {
    console.warn('[Xellé shop]', error);
    shop.cartMessage.value = 'Nu am putut deschide finalizarea comenzii. Încearcă din nou.';
  } finally {
    shop.cartBusy.value = false;
  }
}

function xelleSetCartQuantity(line, quantity) {
  const cart = xelleShop().cart.value;
  if (!cart) return null;
  return quantity > 0
    ? xelleCartChange('update', 'cartLinesUpdate', {id: cart.id, lines: [{id: line.id, quantity}]})
    : xelleCartChange('remove', 'cartLinesRemove', {id: cart.id, lineIds: [line.id]});
}

function xelleCheckout() {
  const cart = xelleShop().cart.value;
  if (cart && cart.totalQuantity > 0) {
    xelleTrack('checkout');
    window.location.href = cart.checkoutUrl;
  }
}

// Shop pages have their own addresses next to the scroll stages:
// ?sectiune=colectii, ?sectiune=produse, ?colectie=<handle>, ?produs=<handle>, ?pagina=<slug>.
function xelleShopUrl(view) {
  const url = new URL(window.location.href);
  ['sectiune', 'colectie', 'produs', 'pagina'].forEach(key => url.searchParams.delete(key));
  if (view.name === 'page') url.searchParams.set('pagina', view.handle);
  if (view.name === 'collections') url.searchParams.set('sectiune', 'colectii');
  if (view.name === 'products') url.searchParams.set('sectiune', 'produse');
  if (view.name === 'collection') url.searchParams.set('colectie', view.handle);
  if (view.name === 'product') url.searchParams.set('produs', view.handle);
  return url.pathname + url.search + url.hash;
}

// Each shop address is its own page for search engines: title, description,
// canonical address and, for a product, its structured data. Closing the shop
// gives the experience its head back.
let xelleSavedHead = null;
function xelleShopHead(view, catalog) {
  const description = document.querySelector('meta[name="description"]');
  const canonical = document.querySelector('link[rel="canonical"]');
  document.getElementById('xelle-product-ld')?.remove();
  if (!view) {
    if (!xelleSavedHead) return;
    document.title = xelleSavedHead.title;
    description?.setAttribute('content', xelleSavedHead.description);
    canonical?.setAttribute('href', xelleSavedHead.canonical);
    xelleSavedHead = null;
    return;
  }
  if (!xelleSavedHead) xelleSavedHead = {title: document.title, description: description?.content || '', canonical: canonical?.href || ''};
  const text = html => (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const product = view.name === 'product' && catalog && catalog.byHandle[view.handle];
  const collection = view.name === 'collection' && catalog && catalog.collections.find(c => c.handle === view.handle);
  const title = product ? product.title : collection ? collection.title
    : view.name === 'page' ? XELLE_SHOP_PAGES[view.handle]?.title
    : view.name === 'collections' ? 'Colecții' : view.name === 'products' ? 'Toate produsele' : null;
  document.title = `${title || 'Magazin'} — Xellé`;
  const summary = text(product ? product.descriptionHtml : collection ? collection.description : '').slice(0, 160);
  description?.setAttribute('content', summary || xelleSavedHead.description);
  canonical?.setAttribute('href', 'https://xelle.ro' + xelleShopUrl(view).replace(/#.*$/, ''));
  if (!product) return;
  const variant = product.variant;
  const data = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: product.title, description: text(product.descriptionHtml),
    image: product.images.map(image => image.url),
    brand: {'@type': 'Brand', name: product.vendor || 'Xellé'},
    url: 'https://xelle.ro/?produs=' + product.handle,
    offers: variant && {
      '@type': 'Offer', price: variant.price.amount, priceCurrency: variant.price.currencyCode,
      availability: variant.availableForSale ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: 'https://xelle.ro/?produs=' + product.handle,
    },
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'xelle-product-ld';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

function xelleShopViewFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('pagina')) return {name: 'page', handle: params.get('pagina')};
  if (params.get('produs')) return {name: 'product', handle: params.get('produs')};
  if (params.get('colectie')) return {name: 'collection', handle: params.get('colectie')};
  if (params.get('sectiune') === 'colectii') return {name: 'collections'};
  if (params.get('sectiune') === 'produse') return {name: 'products'};
  return null;
}

// Shop pages are browser history entries, so Back and Forward move between
// them and the experience. history: 'push' (a visitor's step), 'replace' (the
// page opened from its own address) or 'none' (already moved by Back/Forward).
function xelleShopHistory(mode, url) {
  if (mode === 'push' && url !== window.location.pathname + window.location.search + window.location.hash) window.history.pushState(window.history.state, '', url);
  else if (mode !== 'none') window.history.replaceState(window.history.state, '', url);
}

function xelleShopOpen(view, history = 'push') {
  const shop = xelleShop();
  xelleShopWarmup();
  xelleRefreshLive();
  if (!shop.view.value) {
    // The pages cover the scene completely, so it stops rendering meanwhile.
    const webgl = Ps();
    shop.wasPaused = webgl.mainScenePaused;
    webgl.setMainScenePaused(true);
  }
  shop.view.value = view;
  shop.cartOpen.value = false;
  xelleShopHistory(history, xelleShopUrl(view));
}

function xelleShopClose(history = 'push') {
  const shop = xelleShop();
  if (!shop.view.value) return;
  shop.view.value = null;
  Ps().setMainScenePaused(shop.wasPaused);
  xelleShopHistory(history, xelleSectionUrl(xelleSectionIndex()));
}

window.addEventListener('popstate', () => {
  const view = xelleShopViewFromUrl();
  if (view) xelleShopOpen(view, 'none');
  else if (xelleShopIsOpen()) xelleShopClose('none');
});

function xelleShopIsOpen() {
  return !!xelleShop().view.value;
}

// The shop pages hide the scene completely, so once it has finished loading
// the render loop rests (build_xelle.cjs) and the graphics card serves the page.
function xelleShopCoversScene() {
  return xelleShopIsOpen() && no().mainLoader.progressComplete;
}
