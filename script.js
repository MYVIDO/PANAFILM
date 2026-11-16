"use strict";

(() => {
  // Edit these if the repository or branch name changes.
  const CFG = { owner: "MYVIDO", repo: "PANAFILM", branch: "main", ttl: 2 * 60 * 1000 };

  const VIDEO = /\.(mp4|m4v|webm|ogv|mov)$/i;
  const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;
  const SKIP = /(^|\/)(\.[^/]+|node_modules)(\/|$)/;
  const STAMP = /(\d{4})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})(\d{2})/;
  const CACHE = "panafilm:media:v1";
  const onPages = location.hostname.endsWith(".github.io");

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const grid = $("grid"), status = $("status"), viewer = $("viewer"), stage = $("stage");
  const dateFmt = new Intl.DateTimeFormat("ar", { dateStyle: "long", timeStyle: "short" });
  let items = [], filter = "all", current = -1;

  /* ---------- Data ---------- */

  const urlFor = (path) =>
    (onPages ? "" : `https://raw.githubusercontent.com/${CFG.owner}/${CFG.repo}/${CFG.branch}/`) +
    path.split("/").map(encodeURIComponent).join("/");

  function toItem(path) {
    const name = path.split("/").pop();
    const base = name.replace(/\.[^.]+$/, "");
    const m = base.match(STAMP);
    let key = "", label = base.replace(/[_-]+/g, " ").trim();
    if (m) {
      key = m.slice(1, 7).join("");
      const d = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
      if (!isNaN(d)) label = dateFmt.format(d);
    }
    return { path, name, key, label, kind: VIDEO.test(path) ? "video" : "image", url: urlFor(path), broken: false };
  }

  // Newest first (by the date in phone-style file names), then by name.
  const byNewest = (a, b) =>
    b.key.localeCompare(a.key) || a.name.localeCompare(b.name, "ar", { numeric: true });

  async function loadPaths() {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE)); } catch (e) { /* ignore */ }
    if (cached && !Array.isArray(cached.paths)) cached = null;
    if (cached && Date.now() - cached.at < CFG.ttl) return cached.paths;
    try {
      const res = await fetch(`https://api.github.com/repos/${CFG.owner}/${CFG.repo}/git/trees/${CFG.branch}?recursive=1`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const paths = data.tree
        .filter((n) => n.type === "blob" && !SKIP.test(n.path) && (VIDEO.test(n.path) || IMAGE.test(n.path)))
        .map((n) => n.path);
      try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), paths })); } catch (e) { /* ignore */ }
      return paths;
    } catch (err) {
      if (cached) return cached.paths; // fall back to the last saved list
      throw err;
    }
  }

  const list = () => items.filter((i) => !i.broken && (filter === "all" || i.kind === filter));

  /* ---------- Gallery ---------- */

  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      }), { threshold: 0.1 })
    : null;

  function card(item, i) {
    const b = el("button", "card");
    b.type = "button";
    b.style.setProperty("--d", Math.min(i, 12) * 70 + "ms");
    b.setAttribute("aria-label", (item.kind === "video" ? "تشغيل: " : "عرض: ") + item.label);

    let media;
    if (item.kind === "video") {
      media = el("video", "thumb");
      media.muted = true;
      media.playsInline = true;
      media.preload = "metadata";
      media.src = item.url + "#t=0.1";
    } else {
      media = el("img", "thumb");
      media.loading = "lazy";
      media.decoding = "async";
      media.alt = "";
      media.src = item.url;
    }
    media.addEventListener("error", () => { item.broken = true; b.hidden = true; });

    const frame = el("span", "frame");
    frame.append(media, el("span", "badge", item.kind === "video" ? "فيديو" : "صورة"));
    if (item.kind === "video") frame.append(el("span", "play"));
    b.append(frame, el("span", "cap", item.label));

    b.addEventListener("click", () => open(item));
    io ? io.observe(b) : b.classList.add("in");
    return b;
  }

  function render() {
    const shown = list();
    document.querySelectorAll(".tab").forEach((t) => {
      const n = t.querySelector(".n");
      const f = t.dataset.filter;
      if (n) n.textContent = items.filter((i) => !i.broken && (f === "all" || i.kind === f)).length;
    });
    grid.replaceChildren(...shown.map(card));
    status.hidden = shown.length > 0;
    if (!shown.length) {
      status.textContent = items.length
        ? "لا توجد عناصر في هذا القسم."
        : "لا توجد فيديوهات أو صور بعد. ارفع ملفاً إلى المستودع وسيظهر هنا تلقائياً.";
    }
  }

  /* ---------- Viewer ---------- */

  function clearStage() {
    stage.querySelectorAll("video").forEach((v) => { v.pause(); v.removeAttribute("src"); v.load(); });
    stage.replaceChildren();
  }

  function show() {
    const item = list()[current];
    if (!item) return;
    clearStage();
    $("v-title").textContent = item.label;
    if (item.kind === "image") {
      const img = el("img", "full");
      img.alt = item.label;
      img.src = item.url;
      stage.append(img);
      return;
    }
    const v = el("video", "full");
    v.playsInline = true;
    v.preload = "auto";
    v.src = item.url;
    v.addEventListener("error", () => stage.append(el("p", "err", "تعذّر تشغيل هذا الفيديو.")));
    stage.append(v, controls(v));
    v.play()?.catch(() => {});
  }

  function open(item) {
    current = list().indexOf(item);
    show();
    if (!viewer.open) viewer.showModal();
  }

  function step(d) {
    const n = list().length;
    if (n < 2) return;
    current = (current + d + n) % n;
    show();
  }

  $("v-close").addEventListener("click", () => viewer.close());
  $("v-prev").addEventListener("click", () => step(-1));
  $("v-next").addEventListener("click", () => step(1));
  viewer.addEventListener("close", clearStage);
  viewer.addEventListener("click", (e) => { if (e.target === viewer) viewer.close(); });
  viewer.addEventListener("keydown", (e) => {
    if (e.target.type === "range") return;
    if (e.key === "ArrowLeft") step(1);   // RTL: next item is to the left
    if (e.key === "ArrowRight") step(-1);
  });

  /* ---------- Player controls ---------- */

  function controls(v) {
    const bar = el("div", "ctl"), row = el("div", "seekrow"), btns = el("div", "buttons");
    const cur = el("span", "time", "0:00"), tot = el("span", "time", "0:00");
    const seek = el("input", "seek");
    Object.assign(seek, { type: "range", min: 0, max: 1000, step: 1, value: 0 });
    seek.setAttribute("aria-label", "شريط التقدّم");
    row.append(cur, seek, tot);

    const t = (s) => {
      s = isFinite(s) ? s : 0;
      return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
    };
    const mk = (text, fn, cls = "") => {
      const b = el("button", "btn " + cls, text);
      b.type = "button";
      b.addEventListener("click", fn);
      btns.append(b);
      return b;
    };

    const play = mk("إيقاف مؤقت", () => (v.paused || v.ended ? v.play()?.catch(() => {}) : v.pause()), "btn-primary");
    mk("\u221210 ث", () => { v.currentTime = Math.max(0, v.currentTime - 10); });
    mk("+10 ث", () => { v.currentTime = Math.min(v.duration || 1e9, v.currentTime + 10); });
    const rates = [0.5, 1, 1.5, 2];
    const speed = mk("1\u00D7", () => { v.playbackRate = rates[(rates.indexOf(v.playbackRate) + 1) % rates.length]; });
    const mute = mk("كتم", () => { v.muted = !v.muted; });
    const loop = mk("تكرار", () => { v.loop = !v.loop; loop.setAttribute("aria-pressed", String(v.loop)); });
    mute.setAttribute("aria-pressed", "false");
    loop.setAttribute("aria-pressed", "false");
    mk("ملء الشاشة", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {});
      else v.webkitEnterFullscreen?.();
    });

    let scrubbing = false;
    seek.addEventListener("pointerdown", () => { scrubbing = true; });
    seek.addEventListener("change", () => { scrubbing = false; });
    seek.addEventListener("input", () => { if (v.duration) v.currentTime = (seek.value / 1000) * v.duration; });

    const update = () => {
      cur.textContent = t(v.currentTime);
      if (!scrubbing && v.duration) seek.value = Math.round((v.currentTime / v.duration) * 1000);
    };
    const sync = () => { play.textContent = v.ended ? "إعادة التشغيل" : v.paused ? "تشغيل" : "إيقاف مؤقت"; };

    v.addEventListener("timeupdate", update);
    v.addEventListener("loadedmetadata", () => { tot.textContent = t(v.duration); update(); });
    ["play", "pause", "ended"].forEach((e) => v.addEventListener(e, sync));
    v.addEventListener("ratechange", () => { speed.textContent = v.playbackRate + "\u00D7"; });
    v.addEventListener("volumechange", () => mute.setAttribute("aria-pressed", String(v.muted)));
    v.addEventListener("click", () => play.click());

    bar.append(row, btns);
    return bar;
  }

  /* ---------- Init ---------- */

  document.querySelectorAll(".tab").forEach((b) =>
    b.addEventListener("click", () => {
      filter = b.dataset.filter;
      document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-pressed", String(t === b)));
      render();
    })
  );

  $("year").textContent = String(new Date().getFullYear());

  grid.setAttribute("aria-busy", "true");
  grid.replaceChildren(...Array.from({ length: 6 }, () => el("span", "skeleton")));

  loadPaths()
    .then((paths) => { items = paths.map(toItem).sort(byNewest); render(); })
    .catch(() => {
      grid.replaceChildren();
      status.textContent = "تعذّر تحميل المعرض من GitHub (ربما بلغت حدّ الطلبات). أعد المحاولة بعد قليل.";
      status.hidden = false;
    })
    .finally(() => grid.removeAttribute("aria-busy"));
})();
