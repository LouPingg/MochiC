/* ================ API CONFIG ================ */
const PROD_API = "https://mochibc.onrender.com";

// Force using the prod API while developing locally with Live Server.
// Set to false if you actually run a backend on http://127.0.0.1:5000
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
const albumsView = document.getElementById("albums-view");
const albumsGrid = document.getElementById("albums-grid");
const albumsMsg = document.getElementById("albums-msg");

const photosView = document.getElementById("photos-view");
const photosGrid = document.getElementById("photos-grid");
const photosMsg = document.getElementById("photos-msg");
const albumTitle = document.getElementById("album-title");
const backBtn = document.getElementById("back-to-albums");
const homeLink = document.getElementById("home-link");

const btnPortrait = document.querySelector('[data-filter="portrait"]');
const btnLandscape = document.querySelector('[data-filter="landscape"]');

const headerActionBtn = document.getElementById("header-action-btn");

/* Admin UI */
const createAlbumForm = document.getElementById("create-album-form");
const createAlbumMsg = document.getElementById("create-album-msg");
const addPhotoForm = document.getElementById("add-photo-form");
const addPhotoMsg = document.getElementById("add-photo-msg");

/* Lightbox */
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");

/* Login Modal */
const loginModal = document.getElementById("login-modal");
const closeLoginBtn = document.getElementById("close-login-btn");
const loginForm = document.getElementById("login-form");

/* ================ STATE ================ */
let albums = [];
let currentAlbum = null;
let currentFilter = "portrait";
let isAdmin = false;
let lbIndex = 0;

/* ================ HELPERS ================ */
function setFilter(value) {
  currentFilter = value;
  document
    .querySelectorAll("[data-filter]")
    .forEach((b) => b.classList.remove("is-active"));
  (value === "portrait" ? btnPortrait : btnLandscape)?.classList.add(
    "is-active"
  );
  if (currentAlbum) renderPhotos();
  else renderAlbums();
}
function firstPhotoUrlByOrientation(album, orientation) {
  const p = album.photos.find((ph) => ph.orientation === orientation);
  return p ? p.url : "";
}
function countByOrientation(album, orientation) {
  return album.photos.filter((ph) => ph.orientation === orientation).length;
}
function getCurrentPhotoList() {
  if (!currentAlbum) return [];
  return currentAlbum.photos.filter((p) => p.orientation === currentFilter);
}
function setMsg(el, text, type = "") {
  if (!el) return;
  el.textContent = text || "";
  el.classList.remove("msg--error", "msg--ok");
  if (type) el.classList.add(type);
}

/* Admin UI toggle (header button + body class + admin panel visibility) */
function updateHeaderAction() {
  if (!headerActionBtn) return;
  if (isAdmin) {
    headerActionBtn.textContent = "Log out";
    headerActionBtn.dataset.state = "logout";
    headerActionBtn.removeAttribute("aria-haspopup");
    headerActionBtn.removeAttribute("aria-controls");
  } else {
    headerActionBtn.textContent = "Admin login";
    headerActionBtn.dataset.state = "login";
    headerActionBtn.setAttribute("aria-haspopup", "dialog");
    headerActionBtn.setAttribute("aria-controls", "login-modal");
  }
}
function toggleAdminUI() {
  document.body.classList.toggle("is-auth", !!isAdmin);
  updateHeaderAction();
  if (addPhotoForm) {
    if (isAdmin && currentAlbum) addPhotoForm.classList.remove("hidden");
    else addPhotoForm.classList.add("hidden");
  }
}

/* Modal helpers */
function openLoginModal() {
  loginModal?.classList.remove("hidden");
  setMsg(document.getElementById("login-msg"), "");
  const firstInput = loginModal?.querySelector('input[name="username"]');
  firstInput?.focus();
}
function closeLoginModal() {
  loginModal?.classList.add("hidden");
}

/* Orientation helper for FILE uploads */
function getOrientationFromFile(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const img = new Image();
    img.onload = () => {
      const orientation = img.width >= img.height ? "landscape" : "portrait";
      resolve(orientation);
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

/* ========= NEW: load images directly from Cloudinary ========= */
async function loadImages() {
  try {
    setMsg(albumsMsg, "Loading gallery…");
    const res = await fetch(`${API}/images`, {
      credentials: "include",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Error loading /images " + res.status);
    const data = await res.json();

    // Simule un album global unique contenant toutes les images Cloudinary
    albums = [
      {
        id: "mochi-all",
        title: "Gallery",
        photos: data.map((img) => ({
          id: img.public_id,
          url: img.url,
          orientation: img.width >= img.height ? "landscape" : "portrait",
        })),
      },
    ];

    renderAlbums();
    setMsg(albumsMsg, "");
  } catch (err) {
    console.error(err);
    setMsg(albumsMsg, "Failed to load gallery.", "msg--error");
  }
}

/* ================ RENDER ================ */
function renderAlbums() {
  if (!albumsGrid || !albumsView || !photosView) return;
  const visible = albums.filter(
    (a) => countByOrientation(a, currentFilter) > 0
  );

  albumsGrid.innerHTML = visible
    .map((a) => {
      const cover = firstPhotoUrlByOrientation(a, currentFilter);
      const count = countByOrientation(a, currentFilter);
      return `
      <article class="album-card" data-album="${
        a.id
      }" tabindex="0" aria-label="Open ${a.title}">
        ${
          cover
            ? `<img src="${cover}" alt="Preview ${a.title}" loading="lazy">`
            : ""
        }
        <div class="title">${a.title}</div>
        <div class="meta">${count} photo(s)</div>
      </article>`;
    })
    .join("");

  if (!visible.length) {
    albumsGrid.innerHTML = "";
    setMsg(albumsMsg, `No ${currentFilter} photos found.`);
  } else {
    setMsg(albumsMsg, "");
  }

  photosView.classList.add("hidden");
  albumsView.classList.remove("hidden");
  addPhotoForm?.classList.add("hidden");
}

function renderPhotos() {
  if (!currentAlbum || !photosGrid || !albumTitle) return;
  albumTitle.textContent = currentAlbum.title;

  const list = getCurrentPhotoList();
  photosGrid.innerHTML = list
    .map(
      (p, i) => `
      <figure class="card ${p.orientation}" data-index="${i}">
        <img src="${p.url}" alt="${p.orientation}">
        ${
          isAdmin
            ? `<button class="btn-trash" data-del-photo="${p.id}">🗑</button>`
            : ""
        }
      </figure>`
    )
    .join("");

  if (!list.length) {
    photosGrid.innerHTML = "";
    setMsg(photosMsg, `No ${currentFilter} photos.`);
  } else {
    setMsg(photosMsg, "");
  }

  albumsView.classList.add("hidden");
  photosView.classList.remove("hidden");
  if (isAdmin) addPhotoForm?.classList.remove("hidden");
}

/* ================ NAVIGATION ================ */
function openAlbum(id) {
  currentAlbum = albums.find((a) => a.id === id);
  if (!currentAlbum) return;
  renderPhotos();
}
function backToAlbums() {
  currentAlbum = null;
  renderAlbums();
}

/* ================ LIGHTBOX ================ */
function openLightbox(index) {
  const list = getCurrentPhotoList();
  if (!list.length || !lightbox) return;
  lbIndex = Math.max(0, Math.min(index, list.length - 1));
  updateLightbox();
  lightbox.classList.remove("hidden");
}
function updateLightbox() {
  const list = getCurrentPhotoList();
  if (!list.length || !lightboxImage) return;
  lightboxImage.src = list[lbIndex].url;
}
function closeLightbox() {
  if (!lightbox || !lightboxImage) return;
  lightbox.classList.add("hidden");
  lightboxImage.src = "";
}
function nextPhoto() {
  const list = getCurrentPhotoList();
  lbIndex = (lbIndex + 1) % list.length;
  updateLightbox();
}
function prevPhoto() {
  const list = getCurrentPhotoList();
  lbIndex = (lbIndex - 1 + list.length) % list.length;
  updateLightbox();
}

/* ================ EVENTS ================ */
albumsGrid?.addEventListener("click", (e) => {
  const card = e.target.closest("[data-album]");
  if (card) openAlbum(card.dataset.album);
});
albumsGrid?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const card = e.target.closest("[data-album]");
    if (card) openAlbum(card.dataset.album);
  }
});

photosGrid?.addEventListener("click", (e) => {
  const fig = e.target.closest("figure.card");
  if (!fig) return;
  openLightbox(Number(fig.dataset.index));
});

backBtn?.addEventListener("click", backToAlbums);

homeLink?.addEventListener("click", async (e) => {
  e.preventDefault();
  currentAlbum = null;
  await loadImages();
  setFilter(currentFilter);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

btnPortrait?.addEventListener("click", () => setFilter("portrait"));
btnLandscape?.addEventListener("click", () => setFilter("landscape"));

document.querySelector(".lb-close")?.addEventListener("click", closeLightbox);
document.querySelector(".lb-next")?.addEventListener("click", nextPhoto);
document.querySelector(".lb-prev")?.addEventListener("click", prevPhoto);
lightbox?.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});
window.addEventListener("keydown", (e) => {
  if (!lightbox || lightbox.classList.contains("hidden")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowRight") nextPhoto();
  if (e.key === "ArrowLeft") prevPhoto();
});

/* ===== Header action: login or logout ===== */
headerActionBtn?.addEventListener("click", async () => {
  if (!isAdmin) {
    openLoginModal();
  } else {
    try {
      setToken("");
      await fetch(`${API}/auth/logout`, {
        credentials: "include",
        headers: authHeaders(),
      });
    } catch {}
    isAdmin = false;
    toggleAdminUI();
  }
});

/* ===== Modal events ===== */
closeLoginBtn?.addEventListener("click", closeLoginModal);
loginModal?.addEventListener("click", (e) => {
  if (e.target === loginModal) closeLoginModal();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !loginModal?.classList.contains("hidden")) {
    closeLoginModal();
  }
});

/* ================ ADMIN LOGIN ================ */
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const body = { username: fd.get("username"), password: fd.get("password") };
  setMsg(document.getElementById("login-msg"), "Signing in…");

  try {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "Invalid login");
    if (j?.token) setToken(j.token);

    isAdmin = true;
    toggleAdminUI();
    await loadImages();
    e.currentTarget?.reset?.();
    closeLoginModal();
  } catch (err) {
    setMsg(document.getElementById("login-msg"), err.message, "msg--error");
  } finally {
    setTimeout(() => setMsg(document.getElementById("login-msg"), ""), 2000);
  }
});

/* ================ INIT ================ */
console.log("[Mochi] API =", API, "| host =", location.hostname);
setFilter("portrait");
requestAnimationFrame(() => {
  isAdmin = false;
  toggleAdminUI();
});
(async () => {
  try {
    await checkAuth();
  } catch {}
  try {
    await loadImages();
  } catch {}
  setTimeout(() => {
    isAdmin = !!isAdmin;
    toggleAdminUI();
  }, 800);
})();
