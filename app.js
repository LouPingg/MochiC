const PROD_API = "https://mochibc.onrender.com";
const API = PROD_API;

const albumsGrid = document.getElementById("albums-grid");
const albumsMsg = document.getElementById("albums-msg");
const btnPortrait = document.querySelector('[data-filter="portrait"]');
const btnLandscape = document.querySelector('[data-filter="landscape"]');
const createAlbumForm = document.getElementById("create-album-form");
const createMsg = document.getElementById("create-album-msg");

let albums = [];
let currentFilter = "portrait";

/* ====== Utils ====== */
function setMsg(el, text, type = "") {
  if (!el) return;
  el.textContent = text;
  el.className = "msg " + type;
}
function setFilter(value) {
  currentFilter = value;
  document
    .querySelectorAll("[data-filter]")
    .forEach((b) => b.classList.remove("is-active"));
  (value === "portrait" ? btnPortrait : btnLandscape)?.classList.add(
    "is-active"
  );
  renderAlbums();
}

/* ====== Load albums ====== */
async function loadAlbums() {
  try {
    setMsg(albumsMsg, "Loading albums…");
    const r = await fetch(`${API}/albums`);
    const j = await r.json();
    albums = j;
    renderAlbums();
    setMsg(albumsMsg, "");
  } catch (err) {
    console.error(err);
    setMsg(albumsMsg, "Failed to load albums", "msg--error");
  }
}

/* ====== Render ====== */
function renderAlbums() {
  const visible = albums.filter((a) => a.orientation === currentFilter);
  albumsGrid.innerHTML = visible
    .map(
      (a) => `
      <figure class="card ${a.orientation}">
        <img src="${a.coverUrl}" alt="${a.title}">
        <figcaption>${a.title}</figcaption>
      </figure>`
    )
    .join("");
  if (!visible.length)
    setMsg(albumsMsg, `No ${currentFilter} albums yet.`, "msg--error");
}

/* ====== Create album ====== */
createAlbumForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const file = fd.get("file");
  const title = fd.get("title");
  if (!title) return setMsg(createMsg, "Title required", "msg--error");
  if (!file.size) return setMsg(createMsg, "Choose a photo", "msg--error");

  setMsg(createMsg, "Creating album…");
  try {
    const form = new FormData();
    form.append("title", title);
    form.append("file", file);

    const r = await fetch(`${API}/albums`, {
      method: "POST",
      body: form,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "failed");

    // Ajout immédiat sans reload :
    albums.push(j);
    renderAlbums();
    e.currentTarget.reset();
    setMsg(createMsg, "Album created ✅", "msg--ok");
  } catch (err) {
    console.error("Album create error:", err);
    setMsg(createMsg, err.message, "msg--error");
  } finally {
    setTimeout(() => setMsg(createMsg, ""), 2500);
  }
});

/* ====== Filtres ====== */
btnPortrait?.addEventListener("click", () => setFilter("portrait"));
btnLandscape?.addEventListener("click", () => setFilter("landscape"));

/* ====== Init ====== */
console.log("[Mochi] API =", API);
setFilter("portrait");
loadAlbums();
