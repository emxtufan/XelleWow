// Statistics for /admin (admin.mjs): one "visit" per tab session, a ping every
// 30 s while the page is visible (the live list), and the shop steps. No cookies;
// the server keeps a daily anonymous hash, never the IP.
const xelleTrackSession = (() => {
  try {
    const storage = window.sessionStorage;
    const first = !storage.getItem('xelle-sid');
    if (first) storage.setItem('xelle-sid', crypto.randomUUID());
    return { sid: storage.getItem('xelle-sid'), first };
  } catch (error) {
    console.warn('[Xellé] session storage unavailable', error);
    return { sid: crypto.randomUUID(), first: true };
  }
})();

function xelleTrack(type, extra) {
  const params = new URLSearchParams(window.location.search);
  const body = JSON.stringify({
    type, sid: xelleTrackSession.sid, path: window.location.search || '/', ref: document.referrer,
    utm: params.get('utm_source') || '', click: params.has('fbclid') ? 'fbclid' : params.has('gclid') ? 'gclid' : '', ...extra,
  });
  // A beacon still leaves when the page is going to the checkout.
  if (navigator.sendBeacon && navigator.sendBeacon('/api/t', new Blob([body], { type: 'application/json' }))) return;
  fetch('/api/t', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } })
    .catch(error => console.warn('[Xellé] statistics', error));
}

// The product a cart variant belongs to, for the product table in /admin.
function xelleTrackVariant(type, variantId) {
  const product = xelleShop().catalog.value?.products.find(p => p.variants.some(v => v.id === variantId));
  xelleTrack(type, { handle: product ? product.handle : '' });
}

xelleTrack(xelleTrackSession.first ? 'visit' : 'ping');
setInterval(() => { if (document.visibilityState === 'visible') xelleTrack('ping'); }, 30000);

async function xelleSubscribe(email, consent, source, website) {
  const response = await fetch('/api/newsletter', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, consent, source, website }),
  });
  if (response.ok) return '';
  const data = await response.json().catch(() => ({}));
  return data.error || 'Nu am putut salva adresa. Încearcă din nou.';
}
