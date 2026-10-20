ui({
  __name: "XelleSceneNavigation",
  props: { sceneCount: { default: 0 }, activeIndex: { default: 0 } },
  setup(props) {
    const labels = [
      "Spiced Peach Negroni", "Pornstar Martini", "Prosecco di Cherry",
      "Maracuja Mojito", "Filmul Xellé", "Galerie audio Xellé",
    ];
    async function selectScene(event, index) {
      event.stopPropagation();
      await Yr.initialized;
      Ps().setPodcastMode(false);
      Ir.viewsManager.get("mainScene")?.instance.scrollCamera.scrollToScene(index + 1, 1.5);
    }
    return () => Na("nav", { class: "xelle-scene-nav", "aria-label": "Scenele experienței" }, [
      Na("button", {type: "button", class: "xelle-scene-nav__intro", "aria-label": "Înapoi la intrarea Xellé", title: "Înapoi la intrarea Xellé", onClick: event => selectScene(event, -1)}, [Na("span", {"aria-hidden": "true"}, "↑")]),
      ...labels.slice(0, props.sceneCount).map((label, index) => Na("button", {
        type: "button",
        "aria-label": label,
        "aria-current": Number(props.activeIndex) === index ? "step" : undefined,
        title: label,
        onClick: event => selectScene(event, index),
      }, [Na("span", { "aria-hidden": "true" })]))]);
  },
})
