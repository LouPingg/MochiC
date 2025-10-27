/* ================ API CONFIG ================ */
const PROD_API = "https://mochibc.onrender.com";
const FORCE_PROD_API = true;
const isProdHost = /github\.io|netlify\.app$/i.test(location.hostname);
const API = FORCE_PROD_API || isProdHost ? PROD_API : "http://127.0.0.1:5000";

/* ================ TOKEN HELPERS ================ */
function getToken() {
  try {
    return localStorage.getItem("mochi_token") || "";
  } catch {
    return "";
  }
}
function setToken(t) {
  try {
    t
      ? localStorage.setItem("mochi_token", t)
      : localStorage.removeItem("mochi_token");
  } catch {}
}
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: "Bearer " + t } : {};
}

/* ================ SELECTORS ================ */
const albumsGrid = document.getElementById("albums-grid");
const albumsMsg = document.getElementById("albums-msg");
const headerActionBtn = document.getElementById("header-action-btn");
const createAlbumForm = document.getElementById("create-album-form");
const createAlbumMsg = document.getElementById("create-album-msg");
const addPhotoForm = document.getElementById("add-photo-form");
const addPhotoMsg = document.getElementById("add-photo-msg");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const loginModal = document.getElementById("login-modal");
const loginForm = document.getElementById("login-form");

/* ================ STATE ================ */
let albums = [];
let images = [];
let isAdmin = false;
let currentFilter = "portrait";
let lbIndex = 0;

/* ================ HELPERS ================ */
function setMsg(el, text, type = "") {
  if (!el) return;
  el.textContent = text || "";
  el.classList.remove("msg--error", "msg--ok");
  if (type) el.classList.add(type);
}
function updateHeaderAction() {
  if (!headerActionBtn) return;
  headerActionBtn.textContent = isAdmin ? "Log out" : "Admin login";
}
function toggleAdminUI() {
  console.log("[DEBUG] toggleAdminUI() | isAdmin =", isAdmin);
  document.body.classList.toggle("is-auth", !!isAdmin);
  updateHeaderAction();

  // activate Create Album form
  if (createAlbumForm && isAdmin && !createAlbumForm.dataset.bound) {
    createAlbumForm.addEventListener("submit", handleCreateAlbumSubmit);
    createAlbumForm.dataset.bound = "true";
    console.log("[DEBUG] create-album listener bound dynamically");
  }
  // activate Add Photo form
  if (addPhotoForm && isAdmin && !addPhotoForm.dataset.bound) {
    addPhotoForm.addEventListener("submit", handleAddPhotoSubmit);
    addPhotoForm.dataset.bound = "true";
    console.log("[DEBUG] add-photo listener bound dynamically");
  }
}
function getOrientationFromFile(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const img = new Image();
    img.onload = () => {
      const o = img.width >= img.height ? "landscape" : "portrait";
      resolve(o);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve("");
    img.src = URL.createObjectURL(file);
  });
}

/* ================ API CALLS ================ */
async function checkAuth() {
  try {
    const r = await fetch(`${API}/auth/me`, {
      credentials: "include",
      headers: authHeaders(),
    });
    const j = await r.json();
    isAdmin = !!j.authenticated;
  } catch {
    isAdmin = false;
  }
  toggleAdminUI();
}
async function loadAlbums() {
  try {
    setMsg(albumsMsg, "Loading albums…");
    const r = await fetch(`${API}/albums`, {
      credentials: "include",
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error("Error loading albums");
    albums = await r.json();
    renderAlbums();
    setMsg(albumsMsg, "");
  } catch (err) {
    console.error(err);
    setMsg(albumsMsg, "Failed to load albums.", "msg--error");
  }
}

/* ================ RENDER ================ */
function renderAlbums() {
  if (!albumsGrid) return;
  albumsGrid.innerHTML = albums
    .map(
      (a, i) => `
    <figure class="card ${a.orientation}" data-index="${i}">
      <img src="${a.coverUrl}" alt="${a.title}">
      <figcaption>${a.title}</figcaption>
    </figure>`
    )
    .join("");
  if (!albums.length) setMsg(albumsMsg, "No albums yet.");
}

/* ================ LIGHTBOX ================ */
function openLightbox(index) {
  if (!albums.length || !lightbox) return;
  lbIndex = Math.max(0, Math.min(index, albums.length - 1));
  lightboxImage.src = albums[lbIndex].coverUrl;
  lightbox.classList.remove("hidden");
}
function closeLightbox() {
  lightbox?.classList.add("hidden");
  lightboxImage.src = "";
}

/* ================ ADMIN LOGIN ================ */
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const body = { username: fd.get("username"), password: fd.get("password") };
  const msgEl = document.getElementById("login-msg");
  setMsg(msgEl, "Signing in…");

  try {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "Invalid login");
    if (j?.token) setToken(j.token);
    isAdmin = true;
    toggleAdminUI();
    await loadAlbums();
    setMsg(msgEl, "Connected ✅", "msg--ok");
  } catch (err) {
    console.error("Login error:", err);
    setMsg(msgEl, err.message || "Login failed", "msg--error");
  } finally {
    setTimeout(() => setMsg(msgEl, ""), 2000);
  }
});

/* ================ CREATE ALBUM ================ */
async function handleCreateAlbumSubmit(e) {
  e.preventDefault();
  console.log("[DEBUG] create-album submit intercepted ✅");

  const form = e.currentTarget;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "Creating…";

  const fd = new FormData(form);
  const title = fd.get("title")?.toString().trim();
  const url = fd.get("url")?.toString().trim();
  const file = fd.get("file");
  const orientation = fd.get("orientation")?.toString();

  try {
    if (!title) throw new Error("Album title required");
    if (!url && !(file && file.size > 0))
      throw new Error("Provide an image or URL.");

    let res;
    if (file && file.size > 0) {
      const detected = await getOrientationFromFile(file);
      const formData = new FormData();
      formData.append("title", title);
      formData.append("file", file);
      formData.append("orientation", orientation || detected || "");
      res = await fetch(`${API}/albums`, {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: formData,
      });
    } else {
      res = await fetch(`${API}/albums`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ title, url, orientation }),
      });
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Album creation failed");
    await loadAlbums();
    form.reset();
    setMsg(createAlbumMsg, "Album created ✅", "msg--ok");
  } catch (err) {
    console.error("Album creation error:", err);
    setMsg(createAlbumMsg, err.message, "msg--error");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
    setTimeout(() => setMsg(createAlbumMsg, ""), 2500);
  }
}

/* ================ ADD PHOTO (later) ================ */
async function handleAddPhotoSubmit(e) {
  e.preventDefault();
  console.log("[DEBUG] add-photo submit intercepted ✅");
  // TODO: to implement after albums exist
}

/* ================ INIT ================ */
console.log("[Mochi] API =", API, "| host =", location.hostname);
(async () => {
  await checkAuth();
  await loadAlbums();
})();
