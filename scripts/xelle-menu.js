ui({
  __name: "XelleMenu",
  props: { hidden: { default: false } },
  setup(props) {
    const open = Pa(false), active = Pa(0);
    // After the scroll stages come the shop pages, numbered on from them.
    const shopItems = [
      { label: "Colecții", view: { name: "collections" }, match: ["collections", "collection"] },
      { label: "Produse", view: { name: "products" }, match: ["products", "product"] },
    ];
    function toggle(value) {
      if (value) {
        const view = xelleShop().view.value;
        const item = view && shopItems.findIndex(entry => entry.match.includes(view.name));
        active.value = view ? XELLE_SECTIONS.length + item : xelleSectionIndex();
      }
      open.value = value;
    }
    async function select(event, index) {
      event.preventDefault();
      toggle(false);
      xelleShopClose();
      await xelleGoToSection(index);
    }
    function openShop(event, view) {
      event.preventDefault();
      toggle(false);
      xelleShopOpen(view);
    }
    const entry = (index, label, href, onClick) => Na("li", null, [
      Na("a", {
        href,
        class: "xelle-menu__link",
        tabindex: open.value ? undefined : "-1",
        "aria-current": active.value === index ? "location" : undefined,
        onClick,
      }, [
        Na("span", { class: "xelle-menu__number", "aria-hidden": "true" }, String(index + 1).padStart(2, "0")),
        Na("span", { class: "xelle-menu__label" }, label),
      ]),
    ]);
    // The header lives as long as the page, so this listener is never removed.
    window.addEventListener("keydown", event => { if (event.key === "Escape" && open.value) toggle(false); });
    // Wheel and touch over the open panel must not move the scene behind it.
    const keep = event => event.stopPropagation();
    return () => Na("div", { class: zr(["xelle-menu", { "xelle-menu--open": open.value, "xelle-menu--hidden": props.hidden && !open.value && !xelleShopIsOpen() }]) }, [
      Na("button", {
        type: "button",
        class: "xelle-menu__toggle",
        "aria-expanded": String(open.value),
        "aria-controls": "xelle-menu-panel",
        onClick: () => toggle(!open.value),
      }, open.value ? "Închide" : "Meniu"),
      Na("nav", {
        id: "xelle-menu-panel",
        class: "xelle-menu__panel",
        "aria-label": "Secțiunile Xellé",
        "aria-hidden": String(!open.value),
        onWheel: keep, onTouchstart: keep, onTouchmove: keep,
      }, [
        Na("ol", { class: "xelle-menu__list" }, [
          ...XELLE_SECTIONS.map((section, index) => entry(index, section.label, xelleSectionUrl(index), event => select(event, index))),
          ...shopItems.map((item, offset) => entry(XELLE_SECTIONS.length + offset, item.label, xelleShopUrl(item.view), event => openShop(event, item.view))),
        ]),
      ]),
    ]);
  },
})
