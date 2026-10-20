ui({
  __name: "XelleAudioPrompt",
  setup() {
    const uiStore = no();
    const decided = Pa(false);
    const root = Pa(null);
    // Asked over the experience only: someone shopping sees it on returning to the scene.
    const visible = fa(() => !decided.value && uiStore.mainLoader.progressComplete && !uiStore.mainLoader.visible && !xelleShopIsOpen());
    Tr(visible, shown => { if (shown) vs().then(() => root.value?.querySelector("button")?.focus()); });
    function choose(withSound) {
      if (withSound) { xelleEnableAudio(); ch.start(); }
      decided.value = true;
    }
    return () => visible.value ? Na("div", {
      ref: root, class: "xelle-audio-prompt", role: "dialog", "aria-modal": "true",
      "aria-labelledby": "xelle-audio-prompt-title",
      onKeydown: event => { if (event.key === "Escape") choose(false); },
    }, [
      Na("div", { class: "xelle-audio-prompt__box" }, [
        Na("p", { id: "xelle-audio-prompt-title", class: "xelle-audio-prompt__title" }, "Experiența Xellé are sunet"),
        Na("p", { class: "xelle-audio-prompt__text" }, "Vrei să pornești sunetul?"),
        Na("div", { class: "xelle-audio-prompt__actions" }, [
          Na("button", { type: "button", class: "xelle-audio-prompt__button xelle-audio-prompt__button--primary", onClick: () => choose(true) }, "Da, cu sunet"),
          Na("button", { type: "button", class: "xelle-audio-prompt__button", onClick: () => choose(false) }, "Nu, fără sunet"),
        ]),
        Na("p", { class: "xelle-audio-prompt__hint" }, "Îl poți porni oricând din butonul „Sunet”, în stânga sus."),
      ]),
    ]) : null;
  },
})
