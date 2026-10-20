ui({
  __name: "XelleShopLayer",
  setup() {
    const shop = xelleShop();
    const root = Pa(null), cartPanel = Pa(null);
    const filter = Pa("all"), sort = Pa("title-asc"), quantity = Pa(1), imageIndex = Pa(0), variantId = Pa(null), code = Pa("");
    xelleLoadCart();
    // A shop address (?produs=, ?colectie=, ?sectiune=colectii|produse) opens
    // its page at once, without waiting for the 3D scene still loading below.
    const initialView = xelleShopViewFromUrl();
    if (initialView) {
      xelleSectionState.opened = true;
      xelleShopOpen(initialView, "replace");
    }

    // Every page opens at its top with fresh choices and focus on its title.
    Tr(() => shop.view.value, view => {
      filter.value = "all"; sort.value = "title-asc"; quantity.value = 1; imageIndex.value = 0; variantId.value = null;
      shop.cartMessage.value = "";
      if (view) vs().then(() => {
        if (!root.value) return;
        root.value.scrollTop = 0;
        root.value.querySelector("[data-xelle-focus]")?.focus({ preventScroll: true });
      });
    });
    Tr(() => [shop.view.value, shop.catalog.value], ([view, catalog]) => {
      const product = view && view.name === "product" && catalog && catalog.byHandle[view.handle];
      if (product) xelleLoadRecommendations(product);
    });
    Tr(() => shop.cartOpen.value, open => {
      if (open) vs().then(() => cartPanel.value?.querySelector(".xelle-cart__close")?.focus());
    });

    // Links to xelle.ro products and collections (the perfume pages' buttons)
    // open the matching page here, with the cart; the logo leaves the shop.
    // The layer lives as long as the page, so these listeners stay.
    document.addEventListener("click", event => {
      const link = event.target.closest && event.target.closest("a[href]");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (link.classList.contains("headerBlock__logoLink")) { xelleShopClose(); return; }
      const match = /^https:\/\/xelle\.ro\/(products|collections)\/([^/?#]+)/.exec(link.href);
      if (!match) return;
      event.preventDefault();
      event.stopPropagation();
      xelleShopOpen(match[1] === "products" ? { name: "product", handle: match[2] } : { name: "collection", handle: match[2] });
    }, true);
    window.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      if (shop.cartOpen.value) shop.cartOpen.value = false;
      else if (shop.view.value && !document.querySelector(".xelle-menu--open")) xelleShopClose();
    });

    // Wheel and touch inside the shop must not drive the scene behind it.
    const keep = event => event.stopPropagation();
    const count = n => n === 1 ? "1 produs" : (n % 100 === 0 || n % 100 >= 20 ? `${n} de produse` : `${n} produse`);
    const link = (view, attrs, children) => Na("a", {
      ...attrs, href: xelleShopUrl(view),
      onClick: event => { event.preventDefault(); xelleShopOpen(view); },
    }, children);
    const price = (variant, className) => Na("p", { class: className }, xelleOnSale(variant)
      ? [Na("s", { class: "xelle-shop-price__old" }, xelleMoney(variant.compareAtPrice)), Na("span", { class: "xelle-shop-price__sale" }, xelleMoney(variant.price))]
      : [Na("span", null, xelleMoney(variant && variant.price))]);
    const badge = product => !product.availableForSale
      ? Na("span", { class: "xelle-shop-badge" }, "Stoc epuizat")
      : xelleOnSale(product.variant) ? Na("span", { class: "xelle-shop-badge xelle-shop-badge--sale" }, "Reducere") : null;
    const select = (label, value, options, onChange) => Na("label", { class: "xelle-shop-select" }, [
      Na("span", { class: "xelle-shop-select__label" }, label),
      Na("select", { onChange: event => onChange(event.target.value) },
        options.map(([optionValue, text]) => Na("option", { value: optionValue, selected: optionValue === value }, text))),
    ]);
    const stepper = (value, onChange, label, disabled) => Na("div", { class: "xelle-shop-stepper", role: "group", "aria-label": label }, [
      Na("button", { type: "button", "aria-label": "Scade cantitatea", disabled: disabled || value <= 1, onClick: () => onChange(value - 1) }, "−"),
      Na("output", { "aria-live": "polite" }, String(value)),
      Na("button", { type: "button", "aria-label": "Crește cantitatea", disabled: disabled || value >= 99, onClick: () => onChange(value + 1) }, "+"),
    ]);
    const title = text => Na("h1", { class: "xelle-shop-title", tabindex: "-1", "data-xelle-focus": "" }, text);

    function card(product, from) {
      const image = product.images[0];
      return link({ name: "product", handle: product.handle, from }, { class: "xelle-shop-card" }, [
        Na("div", { class: "xelle-shop-card__media" }, [
          image ? Na("img", { src: image.thumb || image.url, alt: image.altText || product.title, loading: "lazy", decoding: "async" }) : null,
          badge(product),
        ]),
        Na("p", { class: "xelle-shop-card__title" }, product.title),
        price(product.variant, "xelle-shop-card__price"),
      ]);
    }

    function grid(products, from) {
      const [key, direction] = sort.value.split("-");
      const list = products
        .filter(p => filter.value === "all" || (filter.value === "in") === p.availableForSale)
        .sort((a, b) => (key === "price"
          ? Number(a.variant.price.amount) - Number(b.variant.price.amount)
          : a.title.localeCompare(b.title, "ro")) * (direction === "asc" ? 1 : -1));
      return [
        Na("div", { class: "xelle-shop-toolbar" }, [
          select("Disponibilitate", filter.value, [["all", "Toate"], ["in", "În stoc"], ["out", "Stoc epuizat"]], value => { filter.value = value; }),
          select("Sortează", sort.value, [["title-asc", "Alfabetic, A–Z"], ["title-desc", "Alfabetic, Z–A"], ["price-asc", "Preț, crescător"], ["price-desc", "Preț, descrescător"]], value => { sort.value = value; }),
          Na("p", { class: "xelle-shop-toolbar__count", "aria-live": "polite" }, count(list.length)),
        ]),
        list.length
          ? Na("ul", { class: "xelle-shop-grid" }, list.map(product => Na("li", { key: product.handle }, [card(product, from)])))
          : Na("p", { class: "xelle-shop-empty" }, "Niciun produs nu corespunde filtrului ales."),
      ];
    }

    function collectionsPage(catalog) {
      return [
        title("Colecții"),
        Na("ul", { class: "xelle-shop-collections" }, catalog.collections.map(collection => Na("li", { key: collection.handle }, [
          link({ name: "collection", handle: collection.handle }, { class: "xelle-shop-collection" }, [
            Na("div", { class: "xelle-shop-collection__media" }, collection.image
              ? [Na("img", { src: collection.image.url, alt: collection.image.altText || collection.title, loading: "lazy", decoding: "async" })] : []),
            Na("p", { class: "xelle-shop-collection__title" }, [Na("span", null, collection.title), Na("span", { "aria-hidden": "true" }, "→")]),
            Na("p", { class: "xelle-shop-collection__count" }, count(collection.handles.length)),
          ]),
        ]))),
      ];
    }

    function notes(text) {
      return Na("dl", { class: "xelle-shop-notes" }, text.split("\n").filter(line => line.trim()).flatMap(line => {
        const [label, ...rest] = line.split(":");
        return rest.length ? [Na("dt", null, label.trim()), Na("dd", null, rest.join(":").trim())] : [Na("dd", null, line.trim())];
      }));
    }

    function productPage(product, view, catalog) {
      const variant = product.variants.find(v => v.id === variantId.value) || product.variant;
      const images = product.images;
      const image = images[Math.min(imageIndex.value, images.length - 1)];
      // Until the live query answers, the saved stock is not trusted for buying.
      const live = shop.live.value;
      const available = !!(variant && variant.availableForSale);
      const busy = shop.cartBusy.value;
      const sections = [
        ["Descriere", product.descriptionHtml ? Na("div", { class: "xelle-shop-rich", innerHTML: product.descriptionHtml }) : null],
        ["Note și acorduri", product.note && product.note.value ? notes(product.note.value) : null],
        ["Ingrediente", product.ingrediente && product.ingrediente.value ? Na("p", { class: "xelle-shop-plain" }, product.ingrediente.value) : null],
        ["Bine de știut", product.bineDeStiut && product.bineDeStiut.value ? Na("p", { class: "xelle-shop-plain" }, product.bineDeStiut.value) : null],
      ].filter(([, body]) => body);
      const related = (shop.recommendations.value[product.handle] || []).map(handle => catalog.byHandle[handle]).filter(Boolean).slice(0, 4);
      return [
        Na("div", { class: "xelle-shop-product" }, [
          Na("div", { class: "xelle-shop-gallery" }, [
            Na("div", { class: "xelle-shop-gallery__main" }, image ? [Na("img", { src: image.url, alt: image.altText || product.title, decoding: "async" })] : []),
            images.length > 1 ? Na("ul", { class: "xelle-shop-gallery__thumbs" }, images.map((thumb, index) => Na("li", { key: index }, [
              Na("button", {
                type: "button", "aria-label": `Imaginea ${index + 1} din ${images.length}`,
                "aria-current": index === imageIndex.value ? "true" : undefined,
                onClick: () => { imageIndex.value = index; },
              }, [Na("img", { src: thumb.thumb || thumb.url, alt: "", loading: "lazy", decoding: "async" })]),
            ]))) : null,
          ]),
          Na("div", { class: "xelle-shop-info" }, [
            Na("p", { class: "xelle-shop-info__vendor" }, product.vendor || "Xellé"),
            title(product.title),
            price(variant, "xelle-shop-info__price"),
            Na("p", { class: "xelle-shop-info__note" }, "Taxe incluse. Livrarea se calculează la finalizarea comenzii."),
            product.variants.length > 1 ? select("Variantă", variant.id,
              product.variants.map(v => [v.id, v.availableForSale ? v.title : `${v.title} — stoc epuizat`]), value => { variantId.value = value; }) : null,
            Na("div", { class: "xelle-shop-quantity" }, [
              Na("p", { class: "xelle-shop-select__label" }, "Cantitate"),
              stepper(quantity.value, value => { quantity.value = value; }, "Cantitate", !available),
            ]),
            Na("div", { class: "xelle-shop-actions" }, [
              Na("button", { type: "button", class: "xelle-shop-button", disabled: !live || !available || busy, onClick: () => xelleAddToCart(variant.id, quantity.value) },
                !live ? "Se verifică stocul…" : available ? (busy ? "Se adaugă…" : "Adaugă în coș") : "Stoc epuizat"),
              live && available ? Na("button", { type: "button", class: "xelle-shop-button xelle-shop-button--primary", disabled: busy, onClick: () => xelleBuyNow(variant.id, quantity.value) }, "Cumpără acum") : null,
            ]),
            shop.cartMessage.value && !shop.cartOpen.value ? Na("p", { class: "xelle-shop-message", role: "alert" }, shop.cartMessage.value) : null,
            sections.length ? Na("div", { class: "xelle-shop-accordions" }, sections.map(([heading, body]) => Na("details", { key: heading }, [
              Na("summary", null, heading),
              Na("div", { class: "xelle-shop-accordions__body" }, [body]),
            ]))) : null,
          ]),
        ]),
        related.length ? Na("section", { class: "xelle-shop-related", "aria-labelledby": "xelle-shop-related-title" }, [
          Na("h2", { id: "xelle-shop-related-title", class: "xelle-shop-subtitle" }, "S-ar putea să-ți placă"),
          Na("ul", { class: "xelle-shop-grid" }, related.map(item => Na("li", { key: item.handle }, [card(item, view.from)]))),
        ]) : null,
      ];
    }

    function content(view, catalog) {
      if (!catalog) return shop.catalogFailed.value
        ? [Na("div", { class: "xelle-shop-state", role: "alert" }, [
            Na("p", null, "Nu am putut încărca produsele."),
            Na("button", { type: "button", class: "xelle-shop-button", "data-xelle-focus": "", onClick: () => xelleLoadCatalog(true) }, "Încearcă din nou"),
          ])]
        : [Na("p", { class: "xelle-shop-state", "aria-busy": "true" }, "Se încarcă produsele…")];
      if (view.name === "collections") return collectionsPage(catalog);
      if (view.name === "products") return [title("Toate produsele"), ...grid(catalog.products, view)];
      if (view.name === "collection") {
        const collection = catalog.collections.find(c => c.handle === view.handle);
        if (collection) return [
          title(collection.title),
          collection.description ? Na("p", { class: "xelle-shop-lead" }, collection.description) : null,
          ...grid(collection.handles.map(handle => catalog.byHandle[handle]).filter(Boolean), view),
        ];
      }
      if (view.name === "product" && catalog.byHandle[view.handle]) return productPage(catalog.byHandle[view.handle], view, catalog);
      return [Na("div", { class: "xelle-shop-state" }, [
        Na("p", null, "Pagina căutată nu există."),
        link({ name: "products" }, { class: "xelle-shop-button", "data-xelle-focus": "" }, "Vezi toate produsele"),
      ])];
    }

    function page(view, catalog) {
      const back = view.name === "product" ? (view.from || { name: "products" }) : view.name === "collection" ? { name: "collections" } : null;
      const backLabel = back && (back.name === "collections" ? "Colecții"
        : back.name === "collection" ? (catalog?.collections.find(c => c.handle === back.handle)?.title || "Colecție")
        : "Toate produsele");
      const section = view.name === "collections" || view.name === "collection" ? "collections" : "products";
      return Na("div", { ref: root, class: "xelle-shop-page", role: "dialog", "aria-modal": "true", "aria-label": "Magazinul Xellé", onWheel: keep, onTouchstart: keep, onTouchmove: keep }, [
        Na("div", { class: "xelle-shop-page__inner" }, [
          Na("nav", { class: "xelle-shop-nav", "aria-label": "Magazin" }, [
            back ? link(back, { class: "xelle-shop-nav__back" }, `← ${backLabel}`)
              : Na("button", { type: "button", class: "xelle-shop-nav__back", onClick: xelleShopClose }, "← Înapoi la experiență"),
            Na("div", { class: "xelle-shop-nav__tabs" }, [
              link({ name: "collections" }, { "aria-current": section === "collections" ? "page" : undefined }, "Colecții"),
              link({ name: "products" }, { "aria-current": section === "products" ? "page" : undefined }, "Produse"),
            ]),
          ]),
          ...content(view, catalog),
        ]),
      ]);
    }

    function drawer() {
      const cart = shop.cart.value;
      const lines = cart ? cart.lines.nodes : [];
      const busy = shop.cartBusy.value;
      const open = shop.cartOpen.value;
      const discountName = allocation => allocation.title || allocation.code;
      // Order discounts are what separates the subtotal from Shopify's total; line discounts already show on the lines.
      const orderDiscount = cart ? Math.round((cart.cost.subtotalAmount.amount - cart.cost.totalAmount.amount) * 100) / 100 : 0;
      const orderDiscountNames = [...new Set(lines.flatMap(line => line.allDiscounts.map(discountName))
        .filter(name => !lines.some(line => line.discountAllocations.some(allocation => discountName(allocation) === name))))];
      const applyCode = async event => {
        event.preventDefault();
        await xelleApplyCode(code.value);
        if (!shop.codeMessage.value) code.value = "";
      };
      return Na("div", { class: zr(["xelle-cart", { "xelle-cart--open": open }]), onWheel: keep, onTouchstart: keep, onTouchmove: keep }, [
        Na("div", { class: "xelle-cart__backdrop", onClick: () => { shop.cartOpen.value = false; } }),
        Na("aside", { ref: cartPanel, class: "xelle-cart__panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "xelle-cart-title", "aria-hidden": String(!open) }, [
          Na("div", { class: "xelle-cart__head" }, [
            Na("h2", { id: "xelle-cart-title", class: "xelle-cart__title" }, "Coșul tău"),
            Na("button", { type: "button", class: "xelle-cart__close", onClick: () => { shop.cartOpen.value = false; } }, "Închide"),
          ]),
          lines.length ? Na("ul", { class: "xelle-cart__lines", "aria-busy": String(busy) }, lines.map(line => {
            const item = line.merchandise;
            const image = item.product.featuredImage;
            return Na("li", { key: line.id, class: "xelle-cart__line" }, [
              link({ name: "product", handle: item.product.handle }, { class: "xelle-cart__media", tabindex: "-1", "aria-hidden": "true" },
                image ? [Na("img", { src: image.url, alt: "", loading: "lazy", decoding: "async" })] : []),
              Na("div", { class: "xelle-cart__details" }, [
                link({ name: "product", handle: item.product.handle }, { class: "xelle-cart__name" }, item.product.title),
                item.title !== "Default Title" ? Na("p", { class: "xelle-cart__variant" }, item.title) : null,
                Na("p", { class: "xelle-cart__unit" }, xelleMoney(item.price)),
                ...line.discountAllocations.map(allocation => Na("p", { class: "xelle-cart__discount" },
                  `${discountName(allocation)} (−${xelleMoney(allocation.discountedAmount)})`)),
                Na("div", { class: "xelle-cart__controls" }, [
                  stepper(line.quantity, value => xelleSetCartQuantity(line, value), `Cantitate ${item.product.title}`, busy),
                  Na("button", { type: "button", class: "xelle-cart__remove", disabled: busy, onClick: () => xelleSetCartQuantity(line, 0) }, "Elimină"),
                ]),
              ]),
              Na("p", { class: "xelle-cart__total" }, line.cost.totalAmount.amount !== line.cost.subtotalAmount.amount
                ? [Na("s", { class: "xelle-shop-price__old" }, xelleMoney(line.cost.subtotalAmount)), " ", Na("span", { class: "xelle-shop-price__sale" }, xelleMoney(line.cost.totalAmount))]
                : xelleMoney(line.cost.totalAmount)),
            ]);
          })) : Na("div", { class: "xelle-cart__empty" }, [
            Na("p", null, "Coșul tău este gol."),
            Na("button", { type: "button", class: "xelle-shop-button", onClick: () => xelleShopOpen({ name: "products" }) }, "Vezi produsele"),
          ]),
          shop.cartMessage.value && open ? Na("p", { class: "xelle-shop-message", role: "alert" }, shop.cartMessage.value) : null,
          lines.length ? Na("div", { class: "xelle-cart__foot" }, [
            Na("form", { class: "xelle-cart__code", onSubmit: applyCode }, [
              Na("input", { type: "text", value: code.value, onInput: event => { code.value = event.target.value; }, placeholder: "Cod de reducere sau card cadou", "aria-label": "Cod de reducere sau card cadou", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", disabled: busy }),
              Na("button", { type: "submit", class: "xelle-shop-button", disabled: busy || !code.value.trim() }, "Aplică"),
            ]),
            shop.codeMessage.value ? Na("p", { class: "xelle-cart__code-message", role: "alert" }, shop.codeMessage.value) : null,
            ...cart.discountCodes.map(entry => Na("p", { class: "xelle-cart__applied" }, [
              Na("span", null, entry.applicable ? entry.code : `${entry.code} · nu se aplică încă`),
              Na("button", { type: "button", class: "xelle-cart__remove", disabled: busy, onClick: () => xelleRemoveCode(entry.code), "aria-label": `Elimină codul ${entry.code}` }, "Elimină"),
            ])),
            Na("p", { class: "xelle-cart__subtotal" }, [Na("span", null, "Subtotal"), Na("span", null, xelleMoney(cart.cost.subtotalAmount))]),
            orderDiscount > 0 ? Na("p", { class: "xelle-cart__row xelle-cart__row--sale" },
              [Na("span", null, orderDiscountNames.join(", ") || "Reducere"), Na("span", null, `−${xelleMoney({ amount: orderDiscount, currencyCode: cart.cost.totalAmount.currencyCode })}`)]) : null,
            orderDiscount > 0 ? Na("p", { class: "xelle-cart__subtotal" }, [Na("span", null, "Total"), Na("span", null, xelleMoney(cart.cost.totalAmount))]) : null,
            ...cart.appliedGiftCards.map(card => Na("p", { class: "xelle-cart__row" }, [
              Na("span", null, [`Card cadou ••••${card.lastCharacters} `,
                Na("button", { type: "button", class: "xelle-cart__remove", disabled: busy, onClick: () => xelleRemoveGiftCard(card.id), "aria-label": `Elimină cardul cadou ${card.lastCharacters}` }, "Elimină")]),
              Na("span", null, `−${xelleMoney(card.amountUsed)}`),
            ])),
            Na("p", { class: "xelle-cart__note" }, cart.appliedGiftCards.length
              ? "Taxe incluse. Cardul cadou se scade la plată. Livrarea se calculează la finalizarea comenzii."
              : "Taxe incluse. Livrarea se calculează la finalizarea comenzii."),
            Na("button", { type: "button", class: "xelle-shop-button xelle-shop-button--primary", disabled: busy, onClick: xelleCheckout }, "Finalizează comanda"),
          ]) : null,
        ]),
      ]);
    }

    return () => {
      const view = shop.view.value;
      return Na("div", { class: "xelle-shop" }, [view ? page(view, shop.catalog.value) : null, drawer()]);
    };
  },
})
