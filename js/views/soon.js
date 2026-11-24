import { el } from "../ui.js";

export function render(root, { title }) {
  root.append(el("h1", {}, title), el("p", { class: "empty" }, "Bu ekran sonraki aşamada gelecek."));
}
