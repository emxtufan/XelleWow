ui({
  __name: "XelleGalleryActions",
  props: { slug: { default: "" } },
  setup(props) {
    const shop = xelleShop();
    const message = Pa("");
    xelleShopWarmup();
    // Gallery photograph (podcast slug in audit/xelle-locales.json) → Shopify product handle.
    const handles = {
      "spiced-peach-negroni": "spiced-peach-negroni",
      "pornstar-martini": "pornstar-martini-50-ml",
      "prosecco-di-cherry": "prosecco-di-cherry-50-ml",
      "maracuja-mojito": "maracuja-mojito-50-ml",
      "spiced-peach-negroni-body-cream": "spiced-peach-negroni-body-cream-250-ml",
      "pornstar-martini-body-cream": "pornstar-martini-body-cream-250-ml",
      "prosecco-di-cherry-body-cream": "prosecco-di-cherry-body-cream-250-ml",
      "maracuja-mojito-body-cream": "maracuja-mojito-body-cream-250-ml",
      "spiced-peach-negroni-body-wash": "spiced-peach-negroni-body-wash-250-ml",
      "pornstar-martini-body-wash": "pornstar-martini-body-wash-250-ml",
      "prosecco-di-cherry-body-wash": "prosecco-di-cherry-body-wash-250-ml",
      "maracuja-mojito-body-wash": "maracuja-mojito-body-wash-250-ml",
      "pornstar-martini-set": "pornstar-martini-set",
      "spiced-peach-negroni-set": "spiced-peach-negroni-1",
      "prosecco-di-cherry-set": "prosecco-di-cherry",
      "maracuja-mojito-set": "maracuja-mojito",
    };
    // The presentation sits above the shop and the cart, so it ends first.
    const leave = () => Ps().setPodcastMode(false);
    async function add(variant) {
      message.value = "";
      await xelleAddToCart(variant.id, 1);
      if (shop.cartOpen.value) leave();
      else message.value = shop.cartMessage.value;
    }
    return () => {
      const handle = handles[props.slug];
      if (!handle) return null;
      const catalog = shop.catalog.value;
      const product = catalog && catalog.byHandle[handle];
      const variant = product && product.variant;
      // Until the live query answers, the saved stock is not trusted for buying.
      const live = shop.live.value;
      const available = !!(variant && variant.availableForSale);
      const busy = shop.cartBusy.value;
      return Na("div", { class: "xelle-gallery-actions", onPointerdown: event => event.stopPropagation(), onClick: event => event.stopPropagation() }, [
        Na("div", { class: "xelle-gallery-actions__buttons" }, [
          Na("button", { type: "button", class: "xelle-gallery-actions__button", onClick: () => { leave(); xelleShopOpen({ name: "product", handle }); } }, "Vezi produsul"),
          Na("button", { type: "button", class: "xelle-gallery-actions__button xelle-gallery-actions__button--primary", disabled: !product || !live || !available || busy, onClick: () => add(variant) },
            !product || !live ? "Se verifică stocul…" : available ? (busy ? "Se adaugă…" : "Adaugă în coș") : "Stoc epuizat"),
        ]),
        message.value ? Na("p", { class: "xelle-gallery-actions__message", role: "alert" }, message.value) : null,
      ]);
    };
  },
})
