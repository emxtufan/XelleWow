ui({
  __name: "XelleNotesBlock",
  props: { groups: { type: Array, default: () => [] } },
  setup(props) {
    return () => Na("section", { class: "xelle-notes", "aria-label": "Piramida olfactivă" },
      props.groups.map(group => Na("div", { class: "xelle-notes__group" }, [
        Na("h3", { class: "xelle-notes__title" }, group.title),
        Na("ul", { class: "xelle-notes__list" },
          group.notes.map(note => Na("li", { class: "xelle-notes__note" }, note))),
      ])));
  },
})
