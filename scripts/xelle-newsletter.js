ui({
  __name: "XelleNewsletter",
  props: { popup: Boolean },
  setup(props) {
    // Newsletter sign-up: in the footer, and as a one-time popup on the experience
    // 20 s after the scenes are in (not over the shop or the cart). Sign-ups land in /admin.
    const shop = xelleShop();
    const email = Pa(""), consent = Pa(false), website = Pa(""), busy = Pa(false), done = Pa(false), message = Pa("");
    const open = Pa(!props.popup);
    const remember = () => {
      try { window.localStorage.setItem("xelle-newsletter", "1"); } catch (error) { console.warn("[Xellé] newsletter storage unavailable", error); }
    };
    let timer = 0;
    const close = () => { open.value = false; clearInterval(timer); remember(); };
    if (props.popup) Yi(() => {
      // Without storage the popup could not remember a "no" and would return on every visit.
      try { if (window.localStorage.getItem("xelle-newsletter")) return; } catch (error) { console.warn("[Xellé] newsletter popup off", error); return; }
      let seconds = 0;
      timer = setInterval(() => {
        // The 20 s count only while nothing else is asked or open (sound question, menu, shop, cart).
        const idle = no().mainLoader.progressComplete && !shop.view.value && !shop.cartOpen.value && document.visibilityState === "visible"
          && !document.querySelector(".xelle-audio-prompt, .xelle-menu--open");
        if (idle && ++seconds >= 20) { clearInterval(timer); open.value = true; }
      }, 1000);
    });
    Ts(() => clearInterval(timer));

    const submit = async event => {
      event.preventDefault();
      busy.value = true;
      message.value = "";
      try {
        message.value = await xelleSubscribe(email.value, consent.value, props.popup ? "popup" : "footer", website.value);
        if (!message.value) { done.value = true; remember(); }
      } catch (error) {
        console.warn("[Xellé] newsletter", error);
        message.value = "Nu am putut salva adresa. Verifică conexiunea și încearcă din nou.";
      } finally {
        busy.value = false;
      }
    };
    const keep = event => event.stopPropagation();
    const policy = () => { if (props.popup) close(); xelleShopOpen({ name: "page", handle: "politica-de-confidentialitate" }); };

    return () => {
      if (!open.value) return null;
      const body = done.value
        ? [Na("p", { class: "xelle-newsletter__message", role: "status" }, "Mulțumim! Te-am adăugat în lista Xellé.")]
        : [
          Na("div", { class: "xelle-newsletter__row" }, [
            Na("input", { type: "email", name: "email", required: true, autocomplete: "email", placeholder: "Adresa ta de email", "aria-label": "Adresa ta de email", value: email.value, onInput: event => { email.value = event.target.value; } }),
            Na("button", { type: "submit", disabled: busy.value }, "Abonează-te"),
          ]),
          Na("input", { class: "xelle-newsletter__trap", type: "text", name: "website", tabindex: "-1", autocomplete: "off", "aria-hidden": "true", value: website.value, onInput: event => { website.value = event.target.value; } }),
          Na("label", { class: "xelle-newsletter__consent" }, [
            Na("input", { type: "checkbox", required: true, checked: consent.value, onChange: event => { consent.value = event.target.checked; } }),
            Na("span", null, ["Sunt de acord să primesc emailuri de la Xellé. Mă pot dezabona oricând. ",
              Na("button", { type: "button", onClick: policy }, "Politica de confidențialitate")]),
          ]),
          message.value ? Na("p", { class: "xelle-newsletter__message", role: "alert" }, message.value) : null,
        ];
      return Na("form", {
        class: zr(["xelle-newsletter", { "xelle-newsletter--popup": props.popup }]), onSubmit: submit,
        "aria-label": "Newsletter", onWheel: keep, onTouchstart: keep, onTouchmove: keep,
      }, [
        props.popup ? Na("button", { type: "button", class: "xelle-newsletter__close", onClick: close }, "Închide") : null,
        props.popup
          ? Na("p", { class: "xelle-newsletter__title" }, "Newsletter Xellé")
          : Na("h2", { class: "xelle-footer__heading" }, "Newsletter"),
        props.popup ? Na("p", { class: "xelle-newsletter__lead" }, "Noutăți și oferte Xellé, direct pe email.") : null,
        ...body,
      ]);
    };
  },
})
