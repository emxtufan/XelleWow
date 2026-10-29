ui({
  __name: "XelleFooter",
  setup() {
    // The xelle.ro store footer, under the shop pages and the perfume pages.
    // Its pages open here (?pagina=).
    const home = () => { if (xelleShopIsOpen()) xelleShopClose(); else TJ("/"); };
    const pageLink = (handle, label) => shopLink({ name: "page", handle }, label);
    const shopLink = (view, label) => Na("li", null, [Na("a", {
      href: xelleShopUrl(view),
      onClick: event => { event.preventDefault(); xelleShopOpen(view); },
    }, label)]);
    const column = (heading, items) => Na("section", { class: "xelle-footer__block" }, [
      Na("h2", { class: "xelle-footer__heading" }, heading),
      Na("ul", { class: "xelle-footer__links" }, items),
    ]);
    const services = () => [shopLink({ name: "products" }, "Search"), pageLink("contact", "Contact")];
    return () => Na("footer", { class: "xelle-footer" }, [
      Na("div", { class: "xelle-footer__shell" }, [
        Na("div", { class: "xelle-footer__top" }, [
          Na("div", { class: "xelle-footer__left" }, [
            Na("div", { class: "xelle-footer__masthead" }, [
              Na("button", { type: "button", class: "xelle-footer__wordmark", "aria-label": "Xellé", onClick: home }, [
                Na("img", { src: "/xelle/footer/logo.png", alt: "", width: 120, height: 120, loading: "lazy", decoding: "async" }),
              ]),
            ]),
            rr(xelleNewsletter),
          ]),
          Na("nav", { class: "xelle-footer__blocks", "aria-label": "Footer" }, [
            column("Customer services", services()),
            column("Link utile", [
              Na("li", null, [Na("button", { type: "button", onClick: home }, "Acasa")]),
              ...[["parfum", "Parfumuri"], ["gel-de-dus", "Geluri de dus"], ["crema-de-corp", "Creme de corp"], ["seturi-cadou", "Seturi cadou"]]
                .map(([handle, label]) => shopLink({ name: "collection", handle }, label)),
              pageLink("contact", "Contact"),
            ]),
            column("Exclusive services", services()),
            column("Legal", [
              pageLink("politica-de-confidentialitate", "Politica de confidențialitate"),
              Na("li", null, [Na("a", { href: "https://anpc.ro/", target: "_blank", rel: "noopener" }, "Anpc")]),
              pageLink("politica-de-retur", "Politică de Retur"),
              pageLink("politica-de-garantie", "Politică de Garanție"),
              pageLink("termeni-si-conditii", "Termeni si Conditii"),
            ]),
            Na("section", { class: "xelle-footer__block" }, [
              Na("img", { class: "xelle-footer__badge", src: "/xelle/footer/anpc.jpg", alt: "ANPC", width: 155, height: 94, loading: "lazy", decoding: "async" }),
            ]),
          ]),
        ]),
        Na("p", { class: "xelle-footer__credit" }, [
          "Creat si gestionat de ",
          Na("a", { href: "https://www.instagram.com/esa_coder_solutions/", target: "_blank", rel: "noopener" }, "ESA CODER SOLUTIONS"),
        ]),
      ]),
    ]);
  },
})
