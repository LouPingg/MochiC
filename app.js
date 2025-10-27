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
    const r = await fetch(`${API}/albums`, { credentials: "include" }); // ✅ ajoute credentials
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
  // ✅ tolère les albums sans orientation
  const visible = albums.filter(
    (a) => a.orientation === currentFilter || !a.orientation
  );

  albumsGrid.innerHTML = visible
    .map(
      (a) => `
      <figure class="card ${a.orientation}">
        <img src="${a.coverUrl || "assets/placeholder.jpg"}" alt="${a.title}">
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
      credentials: "include",
    });

    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "failed");

    // ✅ Ajout immédiat sans reload
    albums.push(j);
    renderAlbums();

    // ✅ reset protégé
    createAlbumForm?.reset();

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
  if (!headerActionBtn) return;
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

/* ====== Init (async wrapper) ====== */
(async () => {
  await checkAuth();
  console.log("[Mochi] API =", API);
  setFilter("portrait");
  loadAlbums();
})();
