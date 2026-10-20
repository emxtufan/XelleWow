// Storefront API access shared by the site (compiled in by build_xelle.cjs) and
// by build_xelle_shop.mjs, which saves the catalog snapshot the site starts from.
// The public token is meant for browsers: it only reads published products and
// builds carts. Payment, emails, invoices, stock and orders stay in Shopify.
const XELLE_SHOP_ENDPOINT = 'https://xelle.ro/api/2026-07/graphql.json';
const XELLE_SHOP_TOKEN = '8464d9a81a63c065662f2b6099279b54';

// "thumb" serves grids, thumbnails and suggestions; "url" the product gallery.
const XELLE_PRODUCT_FRAGMENT = `
fragment XelleProduct on Product {
  id handle title vendor updatedAt availableForSale descriptionHtml
  images(first: 10) { nodes { url(transform: {maxWidth: 1400}) thumb: url(transform: {maxWidth: 700}) altText } }
  variants(first: 50) { nodes { id title availableForSale price { amount currencyCode } compareAtPrice { amount currencyCode } } }
  note: metafield(namespace: "custom", key: "note") { value }
  ingrediente: metafield(namespace: "custom", key: "ingrediente") { value }
  bineDeStiut: metafield(namespace: "custom", key: "bine_de_stiut") { value }
}`;
const XELLE_CART_FRAGMENT = `
fragment XelleCart on Cart {
  id checkoutUrl totalQuantity
  cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
  discountCodes { code applicable }
  appliedGiftCards { id lastCharacters amountUsed { amount currencyCode } balance { amount currencyCode } }
  lines(first: 100) { nodes {
    id quantity
    cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
    discountAllocations {
      discountedAmount { amount currencyCode }
      ... on CartAutomaticDiscountAllocation { title }
      ... on CartCodeDiscountAllocation { code }
      ... on CartCustomDiscountAllocation { title }
    }
    # Order discounts too, shared out over the lines: only their names are used.
    allDiscounts: discountAllocations(lineLevelOnly: false) {
      ... on CartAutomaticDiscountAllocation { title }
      ... on CartCodeDiscountAllocation { code }
      ... on CartCustomDiscountAllocation { title }
    }
    merchandise { ... on ProductVariant {
      id title price { amount currencyCode }
      product { handle title featuredImage { url(transform: {maxWidth: 240}) altText } }
    } }
  } }
}`;
const XELLE_CART_RESULT = 'cart { ...XelleCart } userErrors { code message } warnings { code message }';
const XELLE_SHOP_QUERIES = {
  catalog: `${XELLE_PRODUCT_FRAGMENT}
query XelleCatalog @inContext(country: RO, language: RO) {
  collections(first: 20) { nodes {
    handle title description updatedAt
    image { url(transform: {maxWidth: 1200}) altText }
    products(first: 100) { nodes { handle } }
  } }
  products(first: 100) { nodes { ...XelleProduct } }
}`,
  // Small and fast: stock and prices, plus the dates that reveal any other change.
  live: `
query XelleLive @inContext(country: RO, language: RO) {
  collections(first: 20) { nodes { handle updatedAt } }
  products(first: 100) { nodes {
    handle updatedAt availableForSale
    variants(first: 50) { nodes { id availableForSale price { amount currencyCode } compareAtPrice { amount currencyCode } } }
  } }
}`,
  recommendations: `
query XelleRecommendations($productId: ID!) @inContext(country: RO, language: RO) {
  productRecommendations(productId: $productId) { handle }
}`,
  cart: `${XELLE_CART_FRAGMENT}
query XelleCartGet($id: ID!) @inContext(country: RO, language: RO) { cart(id: $id) { ...XelleCart } }`,
  create: `${XELLE_CART_FRAGMENT}
mutation XelleCartCreate($lines: [CartLineInput!]!, $discountCodes: [String!]) @inContext(country: RO, language: RO) {
  cartCreate(input: {lines: $lines, discountCodes: $discountCodes, buyerIdentity: {countryCode: RO}}) { ${XELLE_CART_RESULT} }
}`,
  add: `${XELLE_CART_FRAGMENT}
mutation XelleCartAdd($id: ID!, $lines: [CartLineInput!]!) @inContext(country: RO, language: RO) {
  cartLinesAdd(cartId: $id, lines: $lines) { ${XELLE_CART_RESULT} }
}`,
  update: `${XELLE_CART_FRAGMENT}
mutation XelleCartUpdate($id: ID!, $lines: [CartLineUpdateInput!]!) @inContext(country: RO, language: RO) {
  cartLinesUpdate(cartId: $id, lines: $lines) { ${XELLE_CART_RESULT} }
}`,
  remove: `${XELLE_CART_FRAGMENT}
mutation XelleCartRemove($id: ID!, $lineIds: [ID!]!) @inContext(country: RO, language: RO) {
  cartLinesRemove(cartId: $id, lineIds: $lineIds) { ${XELLE_CART_RESULT} }
}`,
  discounts: `${XELLE_CART_FRAGMENT}
mutation XelleCartDiscounts($id: ID!, $codes: [String!]!) @inContext(country: RO, language: RO) {
  cartDiscountCodesUpdate(cartId: $id, discountCodes: $codes) { ${XELLE_CART_RESULT} }
}`,
  giftCardAdd: `${XELLE_CART_FRAGMENT}
mutation XelleCartGiftCardAdd($id: ID!, $codes: [String!]!) @inContext(country: RO, language: RO) {
  cartGiftCardCodesAdd(cartId: $id, giftCardCodes: $codes) { ${XELLE_CART_RESULT} }
}`,
  giftCardRemove: `${XELLE_CART_FRAGMENT}
mutation XelleCartGiftCardRemove($id: ID!, $ids: [ID!]!) @inContext(country: RO, language: RO) {
  cartGiftCardCodesRemove(cartId: $id, appliedGiftCardIds: $ids) { ${XELLE_CART_RESULT} }
}`,
};
