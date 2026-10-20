ui({
  __name: "XelleCartButton",
  props: { hidden: { default: false } },
  setup(props) {
    const shop = xelleShop();
    xelleLoadCart();
    return () => {
      const count = shop.cart.value ? shop.cart.value.totalQuantity : 0;
      return Na("button", {
        type: "button",
        class: zr(["xelle-cart-button", { "xelle-cart-button--hidden": props.hidden && !xelleShopIsOpen() }]),
        "aria-label": count ? `Coș, ${count === 1 ? "1 produs" : count + " produse"}` : "Coș, gol",
        "aria-expanded": String(shop.cartOpen.value),
        onClick: () => { shop.cartOpen.value = !shop.cartOpen.value; },
      }, ["Coș", count ? Na("span", { class: "xelle-cart-button__count", "aria-hidden": "true" }, String(count)) : null]);
    };
  },
})
