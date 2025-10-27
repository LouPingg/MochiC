/* ================ API CONFIG ================ */
const PROD_API = "https://mochibc.onrender.com";
const API = PROD_API;

/* ================ SELECTORS ================ */
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

/* ====== Filter ====== */
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
    const r = await fetch(`${API}/albums`, { credentials: "include" });
    const j = await r.json();

    // 🧩 Force une orientation sûre
    albums = j.map((a) => ({
      ...a,
      orientation: a.orientation || "portrait",
    }));

    renderAlbums();
    setMsg(albumsMsg, "");
  } catch (err) {
    console.error(err);
    setMsg(albumsMsg, "Failed to load albums", "msg--error");
  }
}

/* ====== Render albums ====== */
function renderAlbums() {
  if (!albums.length) {
    albumsGrid.innerHTML = "";
    setMsg(albumsMsg, "No albums yet.", "msg--error");
    return;
  }

  // ✅ Filtrage strict selon orientation
  const visible = albums.filter((a) => a.orientation === currentFilter);

  albumsGrid.innerHTML = visible
    .map(
      (a) => `
      <figure class="card ${a.orientation}">
        <img src="${a.coverUrl || "assets/placeholder.jpg"}" alt="${a.title}">
        <figcaption>${a.title}</figcaption>
        ${
          isAdmin
            ? `<button class="btn-delete-album" data-title="${a.title}" aria-label="Delete album">🗑️</button>`
            : ""
        }
      </figure>`
    )
    .join("");

  if (!visible.length)
    setMsg(albumsMsg, `No ${currentFilter} albums yet.`, "msg--error");
  else setMsg(albumsMsg, "");
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
      credentials: "include",
    });

    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "failed");

    albums.push(j);
    renderAlbums();
    createAlbumForm?.reset();
    setMsg(createMsg, "Album created ✅", "msg--ok");
  } catch (err) {
    console.error("Album create error:", err);
    setMsg(createMsg, err.message, "msg--error");
  } finally {
    setTimeout(() => setMsg(createMsg, ""), 2500);
  }
});

/* ====== ADMIN LOGIN ====== */
const loginModal = document.getElementById("login-modal");
const headerActionBtn = document.getElementById("header-action-btn");
const closeLoginBtn = document.getElementById("close-login-btn");
const loginForm = document.getElementById("login-form");
const loginMsg = document.getElementById("login-msg");

let isAdmin = false;

function openLoginModal() {
  loginModal?.classList.remove("hidden");
}
function closeLoginModal() {
  loginModal?.classList.add("hidden");
  setMsg(loginMsg, "");
}
function updateHeaderAction() {
  headerActionBtn.textContent = isAdmin ? "Log out" : "Admin login";
}
function toggleAdminUI() {
  document.body.classList.toggle("is-auth", !!isAdmin);
  updateHeaderAction();
}

/* ====== Auth check ====== */
async function checkAuth() {
  try {
    const r = await fetch(`${API}/auth/me`, { credentials: "include" });
    const j = await r.json();
    isAdmin = !!j.authenticated;
  } catch {
    isAdmin = false;
  }
  toggleAdminUI();
}

/* ====== Login ====== */
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const body = {
    username: fd.get("username"),
    password: fd.get("password"),
  };
  setMsg(loginMsg, "Signing in…");

  try {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Invalid login");

    isAdmin = true;
    toggleAdminUI();
    closeLoginModal();
    setMsg(loginMsg, "Connected ✅", "msg--ok");
  } catch (err) {
    console.error("Login error:", err);
    setMsg(loginMsg, err.message, "msg--error");
  } finally {
    setTimeout(() => setMsg(loginMsg, ""), 2500);
  }
});

/* ====== Events ====== */
headerActionBtn?.addEventListener("click", () => {
  if (isAdmin) {
    fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    isAdmin = false;
    toggleAdminUI();
  } else {
    openLoginModal();
  }
});
closeLoginBtn?.addEventListener("click", closeLoginModal);
loginModal?.addEventListener("click", (e) => {
  if (e.target === loginModal) closeLoginModal();
});

/* ====== Filters ====== */
btnPortrait?.addEventListener("click", () => {
  console.log("→ switch to portrait");
  setFilter("portrait");
});
btnLandscape?.addEventListener("click", () => {
  console.log("→ switch to landscape");
  setFilter("landscape");
});

/* ====== Album detail view ====== */
const albumsView = document.getElementById("albums-view");
const photosView = document.getElementById("photos-view");
const photosGrid = document.getElementById("photos-grid");
const photosMsg = document.getElementById("photos-msg");
const backToAlbumsBtn = document.getElementById("back-to-albums");
const addPhotoForm = document.getElementById("add-photo-form");
const addPhotoMsg = document.getElementById("add-photo-msg");

let currentAlbum = null;

/* ---- Open album ---- */
albumsGrid?.addEventListener("click", (e) => {
  const card = e.target.closest("figure.card");
  if (!card) return;

  // Delete album
  const btn = e.target.closest(".btn-delete-album");
  if (btn) {
    const title = btn.dataset.title;
    if (confirm(`Delete album "${title}" ?`)) deleteAlbum(title);
    return;
  }

  const title = card.querySelector("figcaption")?.textContent;
  const album = albums.find((a) => a.title === title);
  if (!album) return;
  openAlbum(album);
});

async function deleteAlbum(title) {
  try {
    const r = await fetch(`${API}/albums/${encodeURIComponent(title)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) throw new Error("Delete failed");
    albums = albums.filter((a) => a.title !== title);
    renderAlbums();
  } catch (err) {
    alert("Error deleting album");
    console.error(err);
  }
}

function openAlbum(album) {
  currentAlbum = album;
  albumsView.classList.add("hidden");
  photosView.classList.remove("hidden");

  document.getElementById("album-title").textContent = album.title;
  isAdmin
    ? addPhotoForm?.classList.remove("hidden")
    : addPhotoForm?.classList.add("hidden");

  loadPhotos(album.title);
}

/* ---- Back to albums ---- */
backToAlbumsBtn?.addEventListener("click", () => {
  photosView.classList.add("hidden");
  albumsView.classList.remove("hidden");
  photosGrid.innerHTML = "";
  currentAlbum = null;
});

/* ---- Load photos ---- */
async function loadPhotos(albumTitle) {
  try {
    setMsg(photosMsg, "Loading photos…");
    const r = await fetch(
      `${API}/albums/${encodeURIComponent(albumTitle)}/photos`,
      { credentials: "include" }
    );
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Failed to load photos");
    renderPhotos(j);
    setMsg(photosMsg, "");
  } catch (err) {
    console.error(err);
    setMsg(photosMsg, "Failed to load photos", "msg--error");
  }
}

/* ---- Render photos ---- */
function renderPhotos(list) {
  if (!Array.isArray(list)) return;
  photosGrid.innerHTML = list
    .map(
      (p) => `
      <figure class="card ${p.orientation}">
        <img src="${p.url}" alt="${p.orientation}">
        ${
          isAdmin
            ? `<button class="btn-delete" data-id="${p.id}" aria-label="Delete photo">🗑️</button>`
            : ""
        }
      </figure>`
    )
    .join("");

  if (!list.length)
    setMsg(photosMsg, "No photos in this album yet.", "msg--error");
}

/* ---- Add photo ---- */
addPhotoForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentAlbum) return;
  const fd = new FormData(e.currentTarget);
  const url = (fd.get("url") || "").toString().trim();
  const file = fd.get("file");
  const selectedOrientation = (fd.get("orientation") || "").toString();
  setMsg(addPhotoMsg, "Adding photo…");

  try {
    let r;
    if (file && file.size > 0) {
      const form = new FormData();
      form.append("file", file);
      form.append("orientation", selectedOrientation);
      r = await fetch(
        `${API}/albums/${encodeURIComponent(currentAlbum.title)}/photos`,
        { method: "POST", credentials: "include", body: form }
      );
    } else if (url) {
      r = await fetch(
        `${API}/albums/${encodeURIComponent(currentAlbum.title)}/photos`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, orientation: selectedOrientation }),
        }
      );
    } else throw new Error("Provide a URL or a file.");

    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Upload failed");
    loadPhotos(currentAlbum.title);
    addPhotoForm?.reset();
    setMsg(addPhotoMsg, "Photo added ✅", "msg--ok");
  } catch (err) {
    console.error("Upload error:", err);
    setMsg(addPhotoMsg, err.message, "msg--error");
  } finally {
    setTimeout(() => setMsg(addPhotoMsg, ""), 2500);
  }
});

/* ---- Delete photo ---- */
photosGrid?.addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-delete");
  if (!btn) return;
  e.stopPropagation();
  const id = btn.dataset.id;
  if (!confirm("Delete this photo?")) return;
  try {
    const r = await fetch(`${API}/photos/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) throw new Error("Delete failed");
    loadPhotos(currentAlbum.title);
  } catch (err) {
    console.error("Delete error:", err);
    alert("Failed to delete photo");
  }
});

/* ====== Init ====== */
(async () => {
  await checkAuth();
  console.log("[Mochi] API =", API);
  setFilter("portrait");
  loadAlbums();
})();
