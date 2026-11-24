import { el } from "../ui.js";
import { categoryTiles } from "./category.js";

export async function render(root) {
  root.append(
    el("h1", {}, "Kategoriler"),
    el("p", { class: "dim" }, "Bir kategori seç, içindeki konulara gir, sonra kelimelerle çalış."),
    el("p", {}, el("a", { class: "btn", href: "#/card/new" }, "＋ Yeni kart")),
    await categoryTiles());
}
