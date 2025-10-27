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
const btnPortrait = document.querySelector('[data-filter="portrait"]');
const btnLandscape = document.querySelector('[data-filter="landscape"]');
const headerActionBtn = document.getElementById("header-action-btn");
const addPhotoForm = document.getElementById("add-photo-form");
const addPhotoMsg = document.getElementById("add-photo-msg");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const loginModal = document.getElementById("login-modal");
const closeLoginBtn = document.getElementById("close-login-btn");
const loginForm = document.getElementById("login-form");

/* ================ STATE ================ */
let images = [];
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
  renderGallery();
}
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
  document.body.classList.toggle("is-auth", !!isAdmin);
  updateHeaderAction();
  addPhotoForm?.classList.toggle("hidden", !isAdmin);
}
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
async function loadImages() {
  try {
    setMsg(albumsMsg, "Loading gallery…");
    const res = await fetch(`${API}/images`, {
      credentials: "include",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Error loading /images " + res.status);
    const data = await res.json();
    images = data.map((img) => ({
      id: img.public_id,
      url: img.url,
      orientation: img.width >= img.height ? "landscape" : "portrait",
    }));
    renderGallery();
    setMsg(albumsMsg, "");
  } catch (err) {
    console.error(err);
    setMsg(albumsMsg, "Failed to load gallery.", "msg--error");
  }
}

/* ================ RENDER ================ */
function renderGallery() {
  if (!albumsGrid) return;
  const visible = images.filter((p) => p.orientation === currentFilter);
  albumsGrid.innerHTML = visible
    .map(
      (p, i) => `
      <figure class="card ${p.orientation}" data-index="${i}">
        <img src="${p.url}" alt="${p.orientation}">
      </figure>`
    )
    .join("");
  if (!visible.length) setMsg(albumsMsg, `No ${currentFilter} photos found.`);
  else setMsg(albumsMsg, "");
}

/* ================ LIGHTBOX ================ */
function openLightbox(index) {
  const visible = images.filter((p) => p.orientation === currentFilter);
  if (!visible.length || !lightbox) return;
  lbIndex = Math.max(0, Math.min(index, visible.length - 1));
  lightboxImage.src = visible[lbIndex].url;
  lightbox.classList.remove("hidden");
}
function closeLightbox() {
  lightbox?.classList.add("hidden");
  lightboxImage.src = "";
}

/* ================ EVENTS ================ */
albumsGrid?.addEventListener("click", (e) => {
  const fig = e.target.closest("figure.card");
  if (!fig) return;
  openLightbox(Number(fig.dataset.index));
});
btnPortrait?.addEventListener("click", () => setFilter("portrait"));
btnLandscape?.addEventListener("click", () => setFilter("landscape"));

/* ================ ADMIN LOGIN (FIXED) ================ */
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
    await new Promise((r) => setTimeout(r, 500));
    await loadImages();
    e.currentTarget.reset();
    closeLoginModal();
    setMsg(msgEl, "Connected ✅", "msg--ok");
  } catch (err) {
    console.error("Login error:", err);
    setMsg(msgEl, err.message || "Login failed", "msg--error");
  } finally {
    setTimeout(() => setMsg(msgEl, ""), 2500);
  }
});

/* ================ ADMIN UPLOAD (CLOUDINARY ONLY) ================ */
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
    console.log("[UPLOAD]", {
      url,
      hasFile: !!file,
      orientation: selectedOrientation,
    });
    if (!url && !(file && file.size > 0)) {
      throw new Error("Provide a file or a URL.");
    }

    let r, data;
    if (file && file.size > 0) {
      const detected = await getOrientationFromFile(file);
      const orientationToSend = selectedOrientation || detected || "";
      const form = new FormData();
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
        body: JSON.stringify({ url, orientation: selectedOrientation }),
      });
    }

    data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Photo upload failed");
    await loadImages();
    formEl?.reset?.();
    setMsg(addPhotoMsg, "Photo added.", "msg--ok");
  } catch (err) {
    console.error("Upload error:", err);
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
(async () => {
  await checkAuth();
  await loadImages();
})();
