/* ================ API CONFIG ================ */
const PROD_API = "https://mochi-backend-ix9y.onrender.com";

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
  // show add-photo form only in photos-view and when auth
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

async function loadAlbums() {
  try {
    setMsg(albumsMsg, "Loading albums…");
    const res = await fetch(`${API}/albums`, {
      credentials: "include",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Error loading /albums " + res.status);
    albums = await res.json();
    // normalize
    albums.forEach((a) => {
      a.photos = Array.isArray(a.photos) ? a.photos : [];
    });
    renderAlbums();
    setMsg(albumsMsg, "");
  } catch (err) {
    console.error(err);
    setMsg(albumsMsg, "Failed to load albums.", "msg--error");
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
        ${
          isAdmin
            ? `<button class="btn-trash" data-del-album="${a.id}">🗑</button>`
            : ""
        }
      </article>`;
    })
    .join("");

  if (!visible.length) {
    albumsGrid.innerHTML = "";
    setMsg(albumsMsg, `No album contains ${currentFilter} photos.`);
  } else {
    setMsg(albumsMsg, "");
  }

  photosView.classList.add("hidden");
  albumsView.classList.remove("hidden");
  // hide add-photo admin form outside photos view
  addPhotoForm?.classList.add("hidden");
}

function renderPhotos() {
  if (!currentAlbum || !photosGrid || !albumTitle || !albumsView || !photosView)
    return;
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
    setMsg(photosMsg, `No ${currentFilter} photos in this album.`);
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
/* Albums grid interactions */
albumsGrid?.addEventListener("click", (e) => {
  const del = e.target.closest("[data-del-album]");
  if (del && isAdmin) {
    const id = del.dataset.delAlbum;
    if (confirm("Delete this album?")) {
      fetch(`${API}/albums/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: authHeaders(),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(() => {
          albums = albums.filter((a) => a.id !== id);
          if (currentAlbum?.id === id) currentAlbum = null;
          renderAlbums();
        })
        .catch(() => {});
    }
    return;
  }
  const card = e.target.closest("[data-album]");
  if (card) openAlbum(card.dataset.album);
});
albumsGrid?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const card = e.target.closest("[data-album]");
    if (card) openAlbum(card.dataset.album);
  }
});

/* Photos grid interactions */
photosGrid?.addEventListener("click", (e) => {
  const del = e.target.closest("[data-del-photo]");
  if (del && isAdmin) {
    const id = del.dataset.delPhoto;
    if (confirm("Delete this photo?")) {
      fetch(`${API}/photos/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: authHeaders(),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(() => {
          currentAlbum.photos = currentAlbum.photos.filter((p) => p.id !== id);
          renderPhotos();
        })
        .catch(() => {});
    }
    return;
  }
  const fig = e.target.closest("figure.card");
  if (!fig) return;
  openLightbox(Number(fig.dataset.index));
});

backBtn?.addEventListener("click", backToAlbums);

homeLink?.addEventListener("click", async (e) => {
  e.preventDefault();
  currentAlbum = null;
  await loadAlbums();
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
  const lb = document.getElementById("lightbox");
  if (!lb || lb.classList.contains("hidden")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowRight") nextPhoto();
  if (e.key === "ArrowLeft") prevPhoto();
});

/* ===== Header action: login or logout ===== */
headerActionBtn?.addEventListener("click", async () => {
  if (!isAdmin) {
    openLoginModal();
  } else {
    // logout directly
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

/* ================ ADMIN FLOWS ================ */
/* Login */
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formEl = e.currentTarget;
  const fd = new FormData(formEl);
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
    await loadAlbums();
    formEl?.reset?.();
    closeLoginModal();
  } catch (err) {
    setMsg(document.getElementById("login-msg"), err.message, "msg--error");
  } finally {
    setTimeout(() => setMsg(document.getElementById("login-msg"), ""), 2000);
  }
});

/* Create album (+ optional first photo) */
createAlbumForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formEl = e.currentTarget;
  const submitBtn = formEl.querySelector('button[type="submit"]');
  const msgEl = createAlbumMsg;
  submitBtn.disabled = true;
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = "Creating…";
  setMsg(msgEl, "");

  const fd = new FormData(formEl);
  const title = (fd.get("title") || "").toString().trim();
  const file = fd.get("file");
  const url = (fd.get("url") || "").toString().trim();
  const selectedOrientation = (fd.get("orientation") || "").toString();

  try {
    if (!title) throw new Error("Please enter an album title.");

    // enforce orientation when URL is provided
    if (url && !file && !selectedOrientation) {
      throw new Error("Select an orientation when using an image URL.");
    }

    // 1) create album
    let r = await fetch(`${API}/albums`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ title }),
    });
    let data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Album creation failed");

    const album = data;
    if (!Array.isArray(album.photos)) album.photos = [];
    albums.push(album);

    let createdOrientation = null;

    // 2) optional first photo
    if ((file && file.size > 0) || url) {
      if (file && file.size > 0) {
        // detect orientation client-side for file
        const detected = await getOrientationFromFile(file);
        const orientationToSend = selectedOrientation || detected || "";
        const form = new FormData();
        form.append("albumId", album.id);
        form.append("file", file);
        if (orientationToSend) form.append("orientation", orientationToSend);
        r = await fetch(`${API}/photos`, {
          method: "POST",
          credentials: "include",
          headers: authHeaders(), // no content-type for FormData
          body: form,
        });
      } else {
        r = await fetch(`${API}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          credentials: "include",
          body: JSON.stringify({
            albumId: album.id,
            url,
            orientation: selectedOrientation,
          }),
        });
      }

      data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Photo upload failed");

      const photo = data;
      const a = albums.find((x) => x.id === album.id);
      if (a) {
        if (!Array.isArray(a.photos)) a.photos = [];
        a.photos.push(photo);
      }
      createdOrientation = photo.orientation || null;
    }

    currentAlbum = null;
    if (createdOrientation) setFilter(createdOrientation);
    else setFilter(currentFilter);
    renderAlbums();
    formEl?.reset?.();
    setMsg(msgEl, "Album created.", "msg--ok");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    setMsg(msgEl, err.message, "msg--error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
    setTimeout(() => setMsg(msgEl, ""), 2500);
  }
});

/* Add photo to current album */
addPhotoForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formEl = e.currentTarget;
  const submitBtn = formEl.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = "Adding…";
  setMsg(addPhotoMsg, "");

  const fd = new FormData(formEl);
  const url = (fd.get("url") || "").toString().trim();
  const file = fd.get("file");
  const selectedOrientation = (fd.get("orientation") || "").toString();

  try {
    if (!currentAlbum) throw new Error("No album selected.");
    if (!url && !(file && file.size > 0)) {
      throw new Error("Provide a file or a URL.");
    }
    if (url && !selectedOrientation) {
      throw new Error("Select an orientation when using an image URL.");
    }

    let r, data;
    if (file && file.size > 0) {
      const detected = await getOrientationFromFile(file);
      const orientationToSend = selectedOrientation || detected || "";
      const form = new FormData();
      form.append("albumId", currentAlbum.id);
      form.append("file", file);
      if (orientationToSend) form.append("orientation", orientationToSend);
      r = await fetch(`${API}/photos`, {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: form,
      });
    } else {
      r = await fetch(`${API}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({
          albumId: currentAlbum.id,
          url,
          orientation: selectedOrientation,
        }),
      });
    }

    data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Photo upload failed");

    const photo = data;
    currentAlbum.photos.push(photo);
    renderPhotos();
    formEl?.reset?.();
    setMsg(addPhotoMsg, "Photo added.", "msg--ok");
  } catch (err) {
    setMsg(addPhotoMsg, err.message, "msg--error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
    setTimeout(() => setMsg(addPhotoMsg, ""), 2500);
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
    await loadAlbums();
  } catch {}
  // safety: ensure UI coherent if cookie expired
  setTimeout(() => {
    isAdmin = !!isAdmin;
    toggleAdminUI();
  }, 800);
})();
