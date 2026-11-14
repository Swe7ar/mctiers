/* ==========================================================================
   MCTiers — offline edition
   Static site. The roster lives in localStorage; only the admin can set tiers.
   ========================================================================== */
(function () {
  "use strict";

  const D = window.MCT;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const GM = Object.fromEntries(D.gamemodes.map((g) => [g.id, g]));
  const TIER_ORDER = ["HT1", "LT1", "HT2", "LT2", "HT3", "LT3", "HT4", "LT4", "HT5", "LT5"];
  const ADMIN_NAME = "admin";
  const ADMIN_PASSWORD = "admin1234";

  const pointsFor = (tier) => D.points[tier] || 0;
  function titleFor(points) {
    let out = D.titles[0];
    for (const t of D.titles) if (points >= t.min) out = t;
    return out.name;
  }

  /** Small rank badge shown next to a title (same set as the live site). */
  const TITLE_ICON = {
    Rookie: "rookie",
    "Combat Novice": "combat_novice",
    "Combat Cadet": "combat_cadet",
    "Combat Specialist": "combat_specialist",
    "Combat Ace": "combat_ace",
    "Combat Master": "combat_master",
    "Combat Grandmaster": "combat_grandmaster",
  };
  const TITLE_TINT = {
    Rookie: { bg: "#2a3242", fg: "#9fb0c3" },
    "Combat Novice": { bg: "#27364a", fg: "#8fb8e8" },
    "Combat Cadet": { bg: "#253c4a", fg: "#7fc7d8" },
    "Combat Specialist": { bg: "#3b2f52", fg: "#c3a7f0" },
    "Combat Ace": { bg: "#4a3a1d", fg: "#e8ba3a" },
    "Combat Master": { bg: "#5c3418", fg: "#f89f5a" },
    "Combat Grandmaster": { bg: "#5e2318", fg: "#ff8f6b" },
  };
  function titleIcon(title, size) {
    const key = TITLE_ICON[title];
    if (!key) return "";
    const px = size || 24;
    return `<img class="title-icon" src="assets/titles/${key}.png" width="${px}" height="${px}" alt="" loading="lazy">`;
  }
  /** Coloured pill that carries the title, like the live site's title row. */
  function titlePill(title) {
    const t = TITLE_TINT[title];
    if (!t) return `<span class="title-pill" style="background:#2a3242;color:#9fb0c3">${esc(title)}</span>`;
    return `<span class="title-pill" style="background:${t.bg};color:${t.fg}">${titleIcon(title, 18)}${esc(title)}</span>`;
  }
  function nextTitle(points) {
    return D.titles.find((t) => t.min > points) || null;
  }
  const regionName = (code) => D.regions[code] || "Unknown";
  const gmCount = (tiers) => Object.values(tiers || {}).filter(Boolean).length;

  /* --------------------------------------------------------------- avatars */

  function hash32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SKINS = ["#f2c9a0", "#e0aa7a", "#c98d5e", "#a76a3f", "#8a5430", "#6b3f24"];
  const HAIRS = ["#2b2b2b", "#4b3621", "#7a4a20", "#a8762f", "#1f2937", "#3b2f2f", "#5b3a29", "#243447"];
  const BGS = ["#1d2a3a", "#232f42", "#1a2534", "#20293b"];

  /** Deterministic 8x8 pixel avatar, generated locally (works fully offline). */
  function faceDataURI(name) {
    const seed = hash32(String(name).toLowerCase());
    const rnd = mulberry(seed);
    const skin = SKINS[Math.floor(rnd() * SKINS.length)];
    const hair = HAIRS[Math.floor(rnd() * HAIRS.length)];
    const bg = BGS[Math.floor(rnd() * BGS.length)];
    const shirt = `hsl(${Math.floor(rnd() * 360)} 42% 38%)`;
    const grid = [
      "HHHHHHHH",
      "HHHHHHHH",
      "HSSSSSSH",
      "SSSSSSSS",
      "SEESSEES",
      "SSSSSSSS",
      "SSSMMSSS",
      "SSSSSSSS",
    ];
    const colors = { H: hair, S: skin, E: "#161616", M: "#8a5a4a" };
    let rects = `<rect width="8" height="8" fill="${bg}"/><rect y="7" width="8" height="1" fill="${shirt}"/>`;
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 8; x++) {
        const c = grid[y][x];
        if (c === "S" && y === 6 && (x === 0 || x === 7)) continue;
        rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[c]}"/>`;
      }
    }
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges">${rects}</svg>`
    );
  }
  window.faceFor = faceDataURI;

  /* ----------------------------------------------------------------- skins */

  /**
   * Players paste their Minecraft name or their NameMC profile link.
   * Accepts "Notch", a UUID, or https://namemc.com/profile/Notch.
   */
  function skinRef(raw) {
    const s = String(raw == null ? "" : raw).trim();
    if (!s) return "";
    if (s.startsWith("data:image/")) return s;
    if (/^https?:\/\//i.test(s)) return s;
    const namemc = s.match(/namemc\.com\/(?:profile|uuid)\/([A-Za-z0-9_-]{2,40})/i);
    if (namemc) return namemc[1];
    const uuid = s.match(/[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}/);
    if (uuid) return uuid[0].replace(/-/g, "").toLowerCase();
    const name = s.match(/[A-Za-z0-9_]{3,16}/);
    return name ? name[0] : "";
  }
  const nameMcUrl = (skin) => {
    const ref = skinRef(skin);
    if (!ref || ref.startsWith("data:image/") || /^https?:\/\//i.test(ref)) return "";
    return "https://namemc.com/profile/" + encodeURIComponent(ref);
  };

  /** Remote skin render; falls back to minotar, then to the generated pixel face. */
  function skinImg(ref, size, cls, kind, alt) {
    const r = String(ref || "");
    if (r.startsWith("data:image/")) {
      const dims = kind === "body" ? `height="${size}"` : `width="${size}" height="${size}"`;
      return `<img class="${cls || ""}" src="${esc(r)}" ${dims} alt="${esc(alt || "")}" loading="lazy" decoding="async" style="image-rendering:pixelated">`;
    }
    if (/^https?:\/\//i.test(r)) {
      const dims = kind === "body" ? `height="${size}"` : `width="${size}" height="${size}"`;
      return `<img class="${cls || ""}" src="${esc(r)}" ${dims} alt="${esc(alt || "")}" loading="lazy" decoding="async" style="image-rendering:pixelated" referrerpolicy="no-referrer">`;
    }
    const isBody = kind === "body";
    const src = isBody
      ? `https://mc-heads.net/body/${encodeURIComponent(r)}/${size}`
      : `https://mc-heads.net/avatar/${encodeURIComponent(r)}/${size}`;
    const dims = isBody ? `height="${size}"` : `width="${size}" height="${size}"`;
    return `<img class="${cls || ""}" src="${src}" ${dims} alt="${esc(alt || "")}" loading="lazy" decoding="async" data-skin-ref="${esc(r)}" data-skin-kind="${isBody ? "body" : "head"}" data-skin-size="${size}" data-skin-fallback="${faceDataURI(alt || r)}">`;
  }

  /** True when the stored skin is an uploaded photo / direct image, not a Minecraft name. */
  function isPhotoRef(ref) {
    const r = String(ref || "");
    return !!r && (r.startsWith("data:image/") || /^https?:\/\//i.test(r));
  }

  function face(name, skin, cls, size) {
    const px = size || 32;
    const ref = skinRef(skin);
    if (!ref) {
      return `<img class="${cls || ""}" src="${faceDataURI(name)}" alt="${esc(name)}" width="${px}" height="${px}" style="image-rendering:pixelated" loading="lazy">`;
    }
    if (isPhotoRef(ref)) {
      return `<img class="${(cls ? cls + " " : "")}photo-face" src="${esc(ref)}" alt="${esc(name)}" width="${px}" height="${px}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
    }
    if (!navigator.onLine) {
      return `<img class="${cls || ""}" src="${faceDataURI(name)}" alt="${esc(name)}" width="${px}" height="${px}" style="image-rendering:pixelated" loading="lazy">`;
    }
    return skinImg(ref, px, cls, "head", name);
  }

  /** Draw a square-cropped region of a photo into a skin texture cell. */
  function drawPhotoRegion(ctx, img, dx, dy, dw, dh, mirror) {
    const s = Math.min(img.width || 1, img.height || 1);
    ctx.save();
    if (mirror) {
      /* mirror inside the cell: x' = 2*dx + dw - x, y' = y */
      ctx.translate(dx + dw, 0);
      ctx.scale(-1, 1);
      ctx.translate(-dx, 0);
    }
    ctx.drawImage(img, ((img.width || 1) - s) / 2, ((img.height || 1) - s) / 2, s, s, dx, dy, dw, dh);
    ctx.restore();
  }

  /** Build a real 64x64 Minecraft skin texture from a photo.
      Layout: head (0,0) · body (16,16) · arm (40,16) · leg (0,16). */
  function buildSkinTexture(img, tones) {
    try {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      const x = c.getContext("2d");
      if (!x) return null;
      x.clearRect(0, 0, 64, 64);
      const body = (tones && tones.body) || "#3b6ea5";
      const limb = (tones && tones.limb) || "#d7a06a";
      const dark = (tones && tones.dark) || "#1b2430";

      /* head: photo on the front, mirrored on both sides, photo on top */
      drawPhotoRegion(x, img, 8, 8, 8, 8, false);
      drawPhotoRegion(x, img, 0, 8, 8, 8, true);
      drawPhotoRegion(x, img, 16, 8, 8, 8, true);
      x.drawImage(img, 8, 0, 8, 8);
      x.fillStyle = dark;
      x.fillRect(16, 0, 8, 8);
      drawPhotoRegion(x, img, 24, 8, 8, 8, true);

      /* body */
      x.fillStyle = body;
      x.fillRect(20, 20, 8, 12);
      x.fillStyle = dark;
      x.fillRect(32, 20, 8, 12);
      x.fillStyle = limb;
      x.fillRect(16, 20, 4, 12);
      x.fillRect(28, 20, 4, 12);

      /* arms + legs */
      x.fillStyle = limb;
      x.fillRect(44, 20, 4, 12);
      x.fillRect(40, 20, 4, 12);
      x.fillStyle = dark;
      x.fillRect(4, 20, 4, 12);
      x.fillRect(8, 20, 4, 12);

      return c.toDataURL("image/png");
    } catch (e) {
      return null;
    }
  }

  /** Render a 64x64 skin texture as a 3/4 blocky Minecraft character. */
  function skinTextureFigure(texture, size) {
    const h = size || 190;
    const s = (h / 32).toFixed(3);
    return `<div class="skin3d" style="--s:${s}px;--tex:url('${esc(texture)}')">
      <div class="sk3d-shadow"></div>
      <div class="p3 p3-arm-l"><i class="f f-front"></i></div>
      <div class="p3 p3-leg-l"><i class="f f-front"></i></div>
      <div class="p3 p3-leg-r"><i class="f f-front"></i><i class="f f-side"></i></div>
      <div class="p3 p3-arm-r"><i class="f f-front"></i><i class="f f-side"></i></div>
      <div class="p3 p3-body"><i class="f f-front"></i><i class="f f-side"></i></div>
      <div class="p3 p3-head"><i class="f f-front"></i><i class="f f-side"></i></div>
    </div>`;
  }

  /** A blocky Minecraft-style character wearing the player's photo as the head. */
  function photoFigure(src, size, tones) {
    const h = size || 168;
    const u = (h / 32).toFixed(3);
    const body = (tones && tones.body) || "#3b6ea5";
    const limb = (tones && tones.limb) || "#d7a06a";
    return `<div class="mc-figure-wrap" style="height:${h}px">
      <div class="mc-figure" style="--u:${u}px;--mc-body:${esc(body)};--mc-limb:${esc(limb)}">
        <div class="mc-limb mc-arm mc-arm-l"></div>
        <div class="mc-limb mc-arm mc-arm-r"></div>
        <div class="mc-limb mc-leg mc-leg-l"></div>
        <div class="mc-limb mc-leg mc-leg-r"></div>
        <div class="mc-torso"></div>
        <div class="mc-head"><img src="${esc(src)}" alt=""></div>
      </div>
    </div>`;
  }

  /** Full-body skin for profile pages (head only when offline / no skin set). */
  function skinFigure(name, skin, size, tones, texture) {
    const ref = skinRef(skin);
    const h = size || 168;
    if (texture) return skinTextureFigure(texture, h);
    if (!ref) return face(name, skin, "", h);
    if (isPhotoRef(ref)) return photoFigure(ref, h, tones);
    if (!navigator.onLine) return face(name, skin, "", h);
    return skinImg(ref, h, "skin-figure", "body", name);
  }

  function installSkinFallback() {
    if (document.__mctSkinFallback) return;
    document.__mctSkinFallback = true;
    document.addEventListener(
      "error",
      (e) => {
        const img = e.target;
        if (!img || img.tagName !== "IMG" || !img.dataset.skinRef) return;
        const step = Number(img.dataset.skinStep || 0);
        const ref = encodeURIComponent(img.dataset.skinRef);
        const px = img.dataset.skinSize || "64";
        if (step === 0) {
          img.dataset.skinStep = "1";
          img.src = img.dataset.skinKind === "body"
            ? `https://minotar.net/armor/body/${ref}/${px}.png`
            : `https://minotar.net/helm/${ref}/${px}.png`;
        } else if (step === 1) {
          img.dataset.skinStep = "2";
          img.src = img.dataset.skinFallback;
        }
      },
      true
    );
  }

  /* ------------------------------------------------------- image uploads */

  /** Average colours of an image, used to tint the Minecraft-style figure. */
  function imageTones(source) {
    try {
      const c = document.createElement("canvas");
      c.width = 8;
      c.height = 8;
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(source, 0, 0, 8, 8);
      const data = ctx.getImageData(0, 0, 8, 8).data;
      let r = 0;
      let g = 0;
      let b = 0;
      const n = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      const mix = (mul, add) => {
        const rr = Math.max(0, Math.min(255, Math.round((r / n) * mul + add)));
        const gg = Math.max(0, Math.min(255, Math.round((g / n) * mul + add)));
        const bb = Math.max(0, Math.min(255, Math.round((b / n) * mul + add)));
        return "#" + [rr, gg, bb].map((v) => v.toString(16).padStart(2, "0")).join("");
      };
      return { body: mix(0.5, 12), limb: mix(1.05, 26) };
    } catch (e) {
      return null;
    }
  }

  /** Read + downscale an image file into a compact data URL. */
  function readImageFile(file, maxW, maxH, mime, cb) {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      toast("Please choose an image file");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast("Image too large — max 6MB");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast("Could not read that file");
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => toast("Could not read that image");
      img.onload = () => {
        const scale = Math.min(1, maxW / (img.width || 1), maxH / (img.height || 1));
        const w = Math.max(1, Math.round((img.width || 1) * scale));
        const h = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cb(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        let url = "";
        try {
          url = canvas.toDataURL(mime || "image/jpeg", 0.85);
        } catch (e) {
          try {
            url = canvas.toDataURL("image/png");
          } catch (e2) {
            url = String(reader.result);
          }
        }
        cb(url, imageTones(img), img);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  /** Accept a pasted image URL / data URI, reject junk. */
  function lookImageRef(raw) {
    const s = String(raw == null ? "" : raw).trim();
    if (!s) return "";
    if (s.startsWith("data:image/")) return s;
    if (/^https?:\/\//i.test(s)) return s;
    return "";
  }

  function saveLook(acc, key, url, rerender, msg) {
    const prev = acc[key];
    acc[key] = url || null;
    if (key === "skin" && !url) {
      acc.skinColors = null;
      acc.skinTexture = null;
    }
    const ok = Store.saveAccount(acc);
    if (!ok) {
      toast("Storage full — image too large to save");
      acc[key] = prev;
      Store.saveAccount(acc);
      return;
    }
    toast(msg);
    refreshChrome();
    if (rerender) rerender();
    pushProfile(acc);
  }

  /** Skin + banner + wallpaper editor, shared by the dashboard, the admin's own
      profile and the admin's player editor. "px" keeps the ids unique. */
  function profileLookHTML(acc, px) {
    const p = px || "pl";
    const skinVal = acc.skin && !String(acc.skin).startsWith("data:image/") ? acc.skin : "";
    const bannerVal = acc.banner && !String(acc.banner).startsWith("data:image/") ? acc.banner : "";
    const wallVal = acc.wallpaper && !String(acc.wallpaper).startsWith("data:image/") ? acc.wallpaper : "";
    const bannerBg = acc.banner ? ` style="background-image:url('${esc(acc.banner)}')"` : "";
    const wallBg = acc.wallpaper ? ` style="background-image:url('${esc(acc.wallpaper)}')"` : "";
    return `
      <div class="panel profile-look-panel" style="overflow:hidden;margin-bottom:14px">
        <div class="panel-head">Profile look <span class="spacer"></span><span class="tiny" style="text-transform:none;letter-spacing:0;color:#7d8798">skin · banner · wallpaper</span></div>
        <div class="profile-look-grid">
          <div class="profile-look-preview">
            <div class="pl-banner"${bannerBg}></div>
            <div class="pl-wall"${wallBg}></div>
            <div class="pl-avatar${acc.skinTexture || isPhotoRef(acc.skin) ? " is-figure" : ""}">${
              acc.skinTexture
                ? skinTextureFigure(acc.skinTexture, 128)
                : isPhotoRef(acc.skin)
                  ? photoFigure(acc.skin, 128, acc.skinColors)
                  : face(acc.name, acc.skin, "", 64)
            }</div>
            ${acc.skinTexture ? `<div class="pl-texture"><img src="${esc(acc.skinTexture)}" alt="Generated 64×64 Minecraft skin"><span>64×64 skin</span></div>` : ""}
            <div class="pl-name">${esc(acc.name)}</div>
          </div>
          <div class="profile-look-controls">
            <div class="pl-section">
              <div class="pl-title">Avatar / skin</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <input class="input" id="${px}SkinInput" style="flex:1;min-width:180px" placeholder="Minecraft name, NameMC link or image URL" value="${esc(skinVal)}">
                <button class="btn btn-primary btn-sm" id="${px}SkinSave" type="button">Save</button>
              </div>
              <div class="pl-actions">
                <label class="btn btn-ghost btn-sm" style="cursor:pointer"><input type="file" id="${px}SkinFile" accept="image/*" hidden>Upload image</label>
                <button class="btn btn-ghost btn-sm" id="${px}Discord" type="button">Connect with Discord</button>
                <button class="btn btn-ghost btn-sm" id="${px}SkinClear" type="button">Clear</button>
              </div>
            </div>
            <div class="pl-section">
              <div class="pl-title">Profile banner</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <input class="input" id="${px}BannerUrl" style="flex:1;min-width:180px" placeholder="Paste a banner image URL" value="${esc(bannerVal)}">
                <button class="btn btn-ghost btn-sm" id="${px}BannerSave" type="button">Save URL</button>
              </div>
              <div class="pl-actions">
                <label class="btn btn-ghost btn-sm" style="cursor:pointer"><input type="file" id="${px}BannerFile" accept="image/*" hidden>Upload banner</label>
                <button class="btn btn-ghost btn-sm" id="${px}BannerClear" type="button">Clear</button>
              </div>
            </div>
            <div class="pl-section">
              <div class="pl-title">Profile wallpaper</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <input class="input" id="${px}WallUrl" style="flex:1;min-width:180px" placeholder="Paste a wallpaper image URL" value="${esc(wallVal)}">
                <button class="btn btn-ghost btn-sm" id="${px}WallSave" type="button">Save URL</button>
              </div>
              <div class="pl-actions">
                <label class="btn btn-ghost btn-sm" style="cursor:pointer"><input type="file" id="${px}WallFile" accept="image/*" hidden>Upload wallpaper</label>
                <button class="btn btn-ghost btn-sm" id="${px}WallClear" type="button">Clear</button>
              </div>
            </div>
            <div class="tiny muted">Images are resized and stored locally in your browser. Discord: paste your avatar image URL (copy the image address from your Discord profile).</div>
          </div>
        </div>
      </div>`;
  }

  function initProfileLook(root, acc, rerender, px) {
    const p = px || "pl";
    const skinInput = document.getElementById(p + "SkinInput");
    const skinSave = document.getElementById(p + "SkinSave");
    const skinFile = document.getElementById(p + "SkinFile");
    const skinClear = document.getElementById(p + "SkinClear");
    const discord = document.getElementById(p + "Discord");
    const bannerUrl = document.getElementById(p + "BannerUrl");
    const bannerSave = document.getElementById(p + "BannerSave");
    const bannerFile = document.getElementById(p + "BannerFile");
    const bannerClear = document.getElementById(p + "BannerClear");
    const wallUrl = document.getElementById(p + "WallUrl");
    const wallSave = document.getElementById(p + "WallSave");
    const wallFile = document.getElementById(p + "WallFile");
    const wallClear = document.getElementById(p + "WallClear");

    if (skinSave && skinInput) {
      const save = () => {
        const ref = skinRef(skinInput.value);
        if (ref) {
          acc.skinColors = null;
          acc.skinTexture = null;
        }
        saveLook(acc, "skin", ref, rerender, ref ? "Skin saved" : "Skin cleared");
      };
      skinSave.addEventListener("click", save);
      skinInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          save();
        }
      });
    }
    if (skinFile) {
      skinFile.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = "";
        readImageFile(file, 256, 256, "image/png", (url, tones, img) => {
          acc.skinColors = tones || null;
          acc.skinTexture = img ? buildSkinTexture(img, tones) : null;
          saveLook(acc, "skin", url, rerender, "Avatar uploaded");
        });
      });
    }
    if (discord) {
      discord.addEventListener("click", () => {
        const val = prompt(
          "Paste your Discord avatar image URL.\n\nTip: open Discord → your profile → right-click your avatar → Copy Image Address."
        );
        if (!val) return;
        const ref = lookImageRef(val);
        if (!ref) {
          toast("That doesn't look like an image URL — paste the avatar image address");
          return;
        }
        acc.skinColors = null;
        acc.skinTexture = null;
        saveLook(acc, "skin", ref, rerender, "Discord avatar linked");
      });
    }
    if (skinClear) {
      skinClear.addEventListener("click", () => {
        if (skinInput) skinInput.value = "";
        saveLook(acc, "skin", null, rerender, "Skin cleared");
      });
    }

    const bindUrl = (input, btn, fileInput, clearBtn, key, label, maxH) => {
      if (btn && input) {
        const save = () => {
          const ref = lookImageRef(input.value);
          if (input.value.trim() && !ref) {
            toast("That doesn't look like an image URL");
            return;
          }
          saveLook(acc, key, ref, rerender, ref ? label + " saved" : label + " cleared");
        };
        btn.addEventListener("click", save);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        });
      }
      if (fileInput) {
        fileInput.addEventListener("change", (e) => {
          const file = e.target.files && e.target.files[0];
          e.target.value = "";
          readImageFile(file, 1920, maxH, "image/jpeg", (url) => saveLook(acc, key, url, rerender, label + " uploaded"));
        });
      }
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          if (input) input.value = "";
          saveLook(acc, key, null, rerender, label + " cleared");
        });
      }
    };

    bindUrl(bannerUrl, bannerSave, bannerFile, bannerClear, "banner", "Banner", 640);
    bindUrl(wallUrl, wallSave, wallFile, wallClear, "wallpaper", "Wallpaper", 1200);
  }

  const tierPill = (tier, lg) =>
    tier ? `<span class="tier${lg ? " tier-lg" : ""}" data-t="${esc(tier)}">${esc(tier)}</span>` : `<span class="muted small">—</span>`;
  const regionPill = (r) => `<span class="region" data-r="${esc(r || "NA")}">${esc(r || "NA")}</span>`;

  /* ----------------------------------------------------------------- store */

  const KEY_ACCOUNTS = "mctiers.accounts.v1";
  const KEY_SESSION = "mctiers.session.v1";
  const KEY_MOTION = "mctiers.motion.v1";
  const KEY_THEME = "mctiers.theme.v1";

  /* ------------------------------------------------------------------ theme */

  const THEMES = ["glass", "solid", "amoled"];
  const THEME_LABEL = { glass: "Glass", solid: "Solid", amoled: "AMOLED" };

  function themeName() {
    const t = Store.read(KEY_THEME, "glass");
    return THEMES.indexOf(t) >= 0 ? t : "glass";
  }
  function setTheme(name) {
    const t = THEMES.indexOf(name) >= 0 ? name : "glass";
    Store.write(KEY_THEME, t);
    document.documentElement.setAttribute("data-theme", t);
    return t;
  }

  /* Motion is on by default (the OS "animation effects" switch is often off).
     The header has a toggle that remembers the choice in localStorage. */
  function motionEnabled() {
    const stored = Store.read(KEY_MOTION, null);
    return stored === null ? true : !!stored;
  }
  function setMotion(on) {
    Store.write(KEY_MOTION, !!on);
    document.documentElement.classList.toggle("motion-off", !on);
  }

  const Store = {
    read(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    accounts() {
      return this.read(KEY_ACCOUNTS, {});
    },
    saveAccount(acc) {
      const all = this.accounts();
      all[acc.name.toLowerCase()] = acc;
      return this.write(KEY_ACCOUNTS, all);
    },
    removeAccount(name) {
      const all = this.accounts();
      delete all[name.toLowerCase()];
      this.write(KEY_ACCOUNTS, all);
    },
    session() {
      const s = this.read(KEY_SESSION, null);
      if (!s) return null;
      return this.accounts()[String(s).toLowerCase()] || null;
    },
    login(name) {
      this.write(KEY_SESSION, name);
    },
    logout() {
      try { localStorage.removeItem(KEY_SESSION); } catch (e) {}
    },
  };

  // Local-only password obfuscation. Not real authentication, never leaves the browser.
  function hashPassword(pw, name) {
    let h1 = 5381, h2 = 52711;
    const s = name.toLowerCase() + "::" + pw;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = (Math.imul(h1, 33) ^ c) >>> 0;
      h2 = (Math.imul(h2, 31) + c) >>> 0;
    }
    return h1.toString(16) + h2.toString(16);
  }

  const validName = (name) => /^[A-Za-z0-9_]{3,16}$/.test(name);

  /** The admin account always exists and is the only role that can set tiers. */
  function seedAdmin() {
    const all = Store.accounts();
    if (all[ADMIN_NAME]) return all[ADMIN_NAME];
    const acc = {
      name: "admin",
      role: "admin",
      region: "NA",
      pass: hashPassword(ADMIN_PASSWORD, ADMIN_NAME),
      tiers: {},
      since: {},
      skin: null,
      bio: "Site admin. Sets every tier, uploads player photos and writes the descriptions you see on each profile.",
      createdAt: new Date().toISOString(),
    };
    Store.saveAccount(acc);
    return acc;
  }

  /** Seed the demo roster with real players the first time the site runs.
      Never touches existing accounts — only fills in when there are none. */
  function seedRoster(force) {
    const all = Store.accounts();
    const players = Object.keys(all).filter((k) => all[k].role !== "admin");
    if (players.length && !force) return 0;
    const roster = D.roster || [];
    roster.forEach((r) => {
      const acc = {
        name: r.name,
        role: "player",
        region: r.region || "NA",
        pass: null,
        tiers: Object.assign({}, r.tiers || {}),
        since: Object.assign({}, r.since || {}),
        skin: r.skin || null,
        bio: r.bio || "",
        createdAt: new Date().toISOString(),
      };
      Store.saveAccount(acc);
    });
    return roster.length;
  }

  /* ------------------------------------------------------------ tier hub */

  /** Merge the shared tier-test hub (server + plugin) into the local roster. */
  async function syncHub() {
    if (typeof fetch !== "function") return;
    let data = null;
    try {
      const res = await fetch("/api/tiertest/state");
      if (!res.ok) return;
      data = await res.json();
    } catch (e) {
      return; /* offline — the site keeps working from localStorage */
    }
    if (!data || !data.ok) return;
    const accounts = Store.accounts();
    let changed = false;

    Object.keys(data.tiers || {}).forEach((name) => {
      const rec = data.tiers[name] || {};
      const key = String(name).toLowerCase();
      if (!accounts[key]) return;
      const acc = accounts[key];
      acc.tiers = Object.assign({}, acc.tiers);
      acc.since = Object.assign({}, acc.since);
      Object.keys(rec).forEach((k) => {
        if (k === "__tester") return;
        if (k.endsWith("_since")) {
          const gm = k.replace(/_since$/, "");
          if (acc.since[gm] !== rec[k]) {
            acc.since[gm] = rec[k];
            changed = true;
          }
        } else if (acc.tiers[k] !== rec[k]) {
          acc.tiers[k] = rec[k];
          changed = true;
        }
      });
    });

    Object.keys(data.profiles || {}).forEach((name) => {
      const key = String(name).toLowerCase();
      if (!accounts[key]) return;
      const acc = accounts[key];
      const prof = data.profiles[name] || {};
      ["bio", "skin", "skinTexture", "skinColors", "banner", "wallpaper"].forEach((k) => {
        if (prof[k] !== undefined && acc[k] !== prof[k]) {
          acc[k] = prof[k];
          changed = true;
        }
      });
    });

    if (!changed) return;
    Store.write(KEY_ACCOUNTS, accounts);
    const page = document.body.getAttribute("data-page");
    if (page === "home") renderHome();
    if (page === "rankings") rankingView();
    if (page === "player") playerView();
    if (page === "account") accountView();
  }

  /** Push a profile change (picture / description) to the shared hub. */
  function pushProfile(acc) {
    if (!acc || typeof fetch !== "function") return;
    try {
      fetch("/api/tiertest/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player: acc.name,
          bio: acc.bio || "",
          skin: acc.skin || null,
          skinTexture: acc.skinTexture || null,
          skinColors: acc.skinColors || null,
          banner: acc.banner || null,
          wallpaper: acc.wallpaper || null,
        }),
      }).catch(() => {});
    } catch (e) {
      /* offline */
    }
  }

  /** Push every local tier and profile to the shared hub in one request. */
  async function pushAllToHub() {
    if (typeof fetch !== "function") return 0;
    const accounts = Store.accounts();
    const tierPayload = {};
    const profilePayload = {};
    Object.keys(accounts).forEach((key) => {
      const acc = accounts[key];
      const tiers = {};
      Object.keys(acc.tiers || {}).forEach((gm) => {
        if (GM[gm] && acc.tiers[gm]) {
          tiers[gm] = acc.tiers[gm];
          const since = (acc.since && acc.since[gm]) || "";
          if (since) tiers[gm + "_since"] = since;
        }
      });
      tierPayload[acc.name] = tiers;
      profilePayload[acc.name] = {
        bio: acc.bio || "",
        skin: acc.skin || null,
        skinTexture: acc.skinTexture || null,
        skinColors: acc.skinColors || null,
        banner: acc.banner || null,
        wallpaper: acc.wallpaper || null,
      };
    });

    /* the plugin also needs to know who the testers are (ranked players) */
    try {
      const res = await fetch("/api/tiertest/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiers: tierPayload, profiles: profilePayload }),
      });
      if (!res.ok) return 0;
      const data = await res.json();
      /* register the ranked players as testers */
      await Promise.all(
        Object.keys(tierPayload)
          .map((name) =>
            fetch("/api/tiertest/tester", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, value: true }),
            }).catch(() => {})
          )
      );
      return data && data.names ? data.names : 0;
    } catch (e) {
      return 0; /* offline — the site keeps working, the hub just stays behind */
    }
  }

  /** Push a tier change to the shared hub so the game server picks it up. */
  function pushTier(acc, gm, tier) {
    if (!acc || typeof fetch !== "function") return;
    try {
      fetch("/api/tiertest/admin-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player: acc.name,
          gm,
          tier: tier || "",
          since: (acc.since && acc.since[gm]) || "",
        }),
      }).catch(() => {});
    } catch (e) {
      /* offline */
    }
  }

  function toast(msg) {
    let host = $(".toasts");
    if (!host) {
      host = document.createElement("div");
      host.className = "toasts";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 240);
    }, 3000);
  }

  /* ------------------------------------------------------------------ model */

  function accountList() {
    return Object.values(Store.accounts());
  }
  const isAdmin = (acc) => !!acc && acc.role === "admin";
  const playerAccounts = () => accountList().filter((a) => !isAdmin(a));

  function toProfile(acc) {
    const tiers = Object.entries(acc.tiers || {})
      .filter(([gm, t]) => t && GM[gm])
      .map(([gm, tier]) => ({ gm, tier, points: pointsFor(tier), since: (acc.since || {})[gm] || null }))
      .sort((a, b) => b.points - a.points || a.gm.localeCompare(b.gm));
    const points = tiers.reduce((s, t) => s + t.points, 0);
    return {
      name: acc.name,
      region: acc.region || "NA",
      skin: acc.skin || null,
      skinColors: acc.skinColors || null,
      skinTexture: acc.skinTexture || null,
      bio: acc.bio || "",
      banner: acc.banner || null,
      wallpaper: acc.wallpaper || null,
      role: acc.role || "player",
      tiers,
      points,
      rank: null,
      title: titleFor(points),
    };
  }

  function leaderboard() {
    const list = playerAccounts()
      .map(toProfile)
      .filter((p) => p.tiers.length > 0)
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    list.forEach((p, i) => (p.rank = i + 1));
    return list;
  }

  function profileFor(name) {
    const acc = Store.accounts()[String(name || "").toLowerCase()];
    if (!acc) return null;
    return toProfile(acc);
  }

  /* ---------------------------------------------------------------- chrome */

  function gmIcon(id) {
    return `<img class="d-icon" src="assets/icons/${id}.svg" alt="">`;
  }
  const EXTRA_ICONS = {
    overall: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3"/><path d="M12 13v4M9 20h6"/></svg>',
    server: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/></svg>',
    events: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    guides: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2Z"/><path d="M8 7h6M8 11h6"/></svg>',
    account: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  };
  const icon = (id) => (GM[id] ? gmIcon(id) : EXTRA_ICONS[id] || "");

  function headerHTML() {
    const user = Store.session();
    const RANKS_MEGAMENU = `
  <div class="nav-mega" id="ranksMega" role="menu" aria-label="All rankings">
    <div class="nav-mega-grid">
      <div class="nav-mega-col">
        <div class="nav-mega-head">Overall</div>
        <a class="nav-mega-item nav-mega-overall" href="rankings.html?gm=overall" role="menuitem">
          <img src="assets/icons/overall.svg" alt="">
          <div>
            <div class="nav-mega-title">Overall Leaderboard</div>
            <div class="nav-mega-sub">Points across all gamemodes</div>
          </div>
          <span class="nav-mega-arrow">→</span>
        </a>
      </div>
      <div class="nav-mega-col nav-mega-col-wide">
        <div class="nav-mega-head">Gamemodes</div>
        <div class="nav-mega-gmgrid">
          ${D.gamemodes.map((g) => `<a class="nav-mega-item" href="rankings.html?gm=${g.id}" role="menuitem">
              <img src="assets/icons/${g.icon || g.id}.svg" alt="">
              <div>
                <div class="nav-mega-title">${esc(g.name)}</div>
                <div class="nav-mega-sub">${esc(g.full)}</div>
              </div>
            </a>`).join("")}
        </div>
      </div>
      <div class="nav-mega-col">
        <div class="nav-mega-head">Explore</div>
        <a class="nav-mega-item" href="server-ip.html" role="menuitem">${icon("server")}<div><div class="nav-mega-title">CrackedMCTiers</div><div class="nav-mega-sub">130.78.218.210:25606 · Java & Bedrock</div></div></a>
        <a class="nav-mega-item" href="chat.html" role="menuitem">${icon("events")}<div><div class="nav-mega-title">Tier test chat</div><div class="nav-mega-sub">Paste your /tiertest code and get ranked</div></div></a>
        <a class="nav-mega-item" href="events.html" role="menuitem">${icon("events")}<div><div class="nav-mega-title">Events</div><div class="nav-mega-sub">Upcoming & past events</div></div></a>
        <a class="nav-mega-item" href="guides.html" role="menuitem">${icon("guides")}<div><div class="nav-mega-title">Guides</div><div class="nav-mega-sub">How tiers, points & titles work</div></div></a>
        <a class="nav-mega-item" href="account.html" role="menuitem">${icon("account")}<div><div class="nav-mega-title">${user ? (isAdmin(user) ? "Admin panel" : "My account") : "Log in"}</div><div class="nav-mega-sub">Manage your profile</div></div></a>
      </div>
    </div>
    <div class="nav-mega-foot">
      <span class="tiny">Tip: press <kbd>/</kbd> to search players instantly</span>
      <span class="spacer"></span>
      <a class="btn btn-ghost btn-sm" href="rankings.html?gm=overall">View full leaderboard →</a>
    </div>
  </div>
`;
  return `<header class="site-header site-header--taskbar">
  <div class="header-inner">
    <a class="brand" href="index.html" aria-label="MCTiers home"><img src="assets/logo.svg" alt="MCTiers"></a>
    <nav class="site-nav" aria-label="Primary">
      <button class="nav-trigger" id="ranksTrigger" aria-haspopup="menu" aria-expanded="false" aria-controls="ranksMega">
        <span class="nav-trigger-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10l1 7H6l1-7Zm-1 7h12l-1.2 5.4A2 2 0 0 1 14.8 18H9.2a2 2 0 0 1-1.98-1.6L6 11Z"/></svg>
        </span>
        <span>Ranks &amp; Explore</span>
        <svg class="nav-trigger-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <a class="nav-link" href="rankings.html?gm=overall">Overall</a>
      <div class="nav-divider"></div>
      ${D.gamemodes.slice(0, 3).map((g) => `<a class="nav-link nav-link-gm" href="rankings.html?gm=${g.id}"><img src="assets/icons/${g.icon || g.id}.svg" alt="">${esc(g.name)}</a>`).join("")}
      <a class="nav-link nav-link-more" href="rankings.html?gm=vanilla">More gamemodes</a>
    </nav>
    ${RANKS_MEGAMENU}
    <div class="search" role="search">
      <svg class="s-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="searchInput" type="search" placeholder="Search player…" autocomplete="off" spellcheck="false" aria-label="Search player">
      <kbd>/</kbd>
      <div class="search-results" id="searchResults"></div>
    </div>
    <div class="header-actions">
      ${
        user
          ? `<a class="account-chip" href="account.html" title="${isAdmin(user) ? "Admin panel" : "My account"}">${face(user.name, user.skin, "", 28)}<span class="offline-dot"></span><span class="nm">${esc(user.name)}</span>${isAdmin(user) ? '<span class="badge-admin">ADMIN</span>' : ""}</a>`
          : `<a class="btn btn-ghost btn-sm" href="account.html">Log in</a>`
      }
      <div class="theme-wrap">
        <button class="icon-btn" id="themeBtn" title="Theme: ${esc(THEME_LABEL[themeName()])}" aria-label="Change theme" aria-haspopup="menu" aria-expanded="false">
          ${
            themeName() === "glass"
              ? '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 15h18M8 4v11"/></svg>'
              : themeName() === "solid"
                ? '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg>'
                : '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" stroke="none"/></svg>'
          }
        </button>
        <div class="theme-menu" id="themeMenu" role="menu" aria-label="Theme">
          ${THEMES.map(
            (t) => `<button class="theme-opt${t === themeName() ? " active" : ""}" data-theme-set="${t}" role="menuitemradio" aria-checked="${t === themeName() ? "true" : "false"}">
              <span class="theme-swatch sw-${t}"></span>
              <span class="theme-opt-text"><b>${THEME_LABEL[t]}</b><small>${
                t === "glass" ? "Frosted, blurred surfaces" : t === "solid" ? "Flat, opaque and fast" : "Pure black OLED"
              }</small></span>
            </button>`
          ).join("")}
        </div>
      </div>
      <button class="icon-btn" id="motionBtn" title="${motionEnabled() ? "Motion on" : "Motion off"}" aria-label="Toggle animations" aria-pressed="${motionEnabled() ? "true" : "false"}">
        ${
          motionEnabled()
            ? '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.4"/></svg>'
            : '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8"/><path d="M5.6 5.6l12.8 12.8"/></svg>'
        }
      </button>
      <button class="icon-btn" id="menuBtn" aria-label="Open navigation" aria-expanded="false">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
    </div>
  </div>
</header>
<div class="nav-mega-backdrop" id="ranksMegaBackdrop"></div>
<div class="drawer-backdrop" id="drawerBackdrop"></div>
<aside class="drawer" id="drawer" aria-hidden="true">
  <div class="drawer-top">
    <img src="assets/logo.svg" alt="MCTiers" style="height:20px">
    <button class="icon-btn" data-close-drawer aria-label="Close navigation">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>
  <h6>Rankings</h6>
  <a class="d-item" href="rankings.html?gm=overall">${icon("overall")} Overall</a>
  ${D.gamemodes.map((g) => `<a class="d-item" href="rankings.html?gm=${g.id}">${gmIcon(g.id)} ${esc(g.name)}</a>`).join("")}
  <h6>Explore</h6>
  <a class="d-item" href="chat.html">${icon("events")} Tier test chat</a>
  <a class="d-item" href="server-ip.html">${icon("server")} Server IP</a>
  <a class="d-item" href="events.html">${icon("events")} Events</a>
  <a class="d-item" href="guides.html">${icon("guides")} Guides</a>
  <a class="d-item" href="account.html">${icon("account")} ${user ? (isAdmin(user) ? "Admin panel" : "My account") : "Log in"}</a>
</aside>`;
  }

  function footerHTML() {
    const ranked = leaderboard().length;
    const gm = D.gamemodes.map((g) => `<a href="rankings.html?gm=${g.id}">${esc(g.name)}</a>`).join("");
    return `<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <img src="assets/logo.svg" alt="MCTiers">
      <p>The Minecraft PvP tier list. Rankings, tier tests and events for Java and Bedrock players.</p>
      <p class="small" style="color:#7d8798">Local roster · ${playerAccounts().length} accounts · ${ranked} ranked</p>
      <div class="tiny" id="netState" style="color:#7d8798;margin-top:-4px"></div>
      <a class="btn btn-ghost btn-sm" href="server-ip.html" style="display:inline-flex;margin-top:10px"><b>CrackedMCTiers</b><span style="font-family:ui-monospace,monospace">130.78.218.210:25606</span></a>
    </div>
    <div><h5>Rankings</h5><div class="footer-cols"><a href="rankings.html?gm=overall">Overall</a>${gm}</div></div>
    <div><h5>Explore</h5><a href="chat.html">Tier test chat</a><a href="server-ip.html">Server IP</a><a href="events.html">Events</a><a href="guides.html">Guides</a><a href="account.html">${Store.session() ? "My account" : "Log in"}</a></div>
  </div>
  <div class="footer-bottom">
    <span>© ${new Date().getFullYear()} MCTiers clone. Fan-made recreation for offline use.</span>
    <span>Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.</span>
  </div>
</footer>`;
  }

  function initMegaMenu() {
    const trigger = $("#ranksTrigger");
    const mega = $("#ranksMega");
    const backdrop = $("#ranksMegaBackdrop");
    if (!trigger || !mega) return;

    const open = () => {
      mega.classList.add("open");
      if (backdrop) backdrop.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
    };
    const close = () => {
      mega.classList.remove("open");
      if (backdrop) backdrop.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    };
    const toggle = () => (mega.classList.contains("open") ? close() : open());

    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      toggle();
    });
    if (backdrop) backdrop.addEventListener("click", close);
    document.addEventListener("click", (e) => {
      if (e.target.closest(".site-nav") || e.target.closest(".nav-mega")) return;
      close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
    mega.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
  }

  function initChrome() {
    const top = $("#chrome-top");
    if (top) top.outerHTML = headerHTML();
    const foot = $("#chrome-footer");
    if (foot) foot.outerHTML = footerHTML();
    initSearch();
    initDrawer();
    initMotionToggle();
    initThemePicker();
    initShortcuts();
    initMegaMenu();
  }

  function refreshChrome() {
    const old = document.querySelector(".site-header");
    if (!old) return;
    initSearch();
    initDrawer();
    initMotionToggle();
    initThemePicker();
    initMegaMenu();
  }

  function initDrawer() {
    const btn = $("#menuBtn");
    const drawer = $("#drawer");
    const backdrop = $("#drawerBackdrop");
    if (!btn || !drawer) return;
    const close = () => {
      drawer.classList.remove("open");
      backdrop.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      drawer.setAttribute("aria-hidden", "true");
    };
    btn.addEventListener("click", () => {
      const open = !drawer.classList.contains("open");
      drawer.classList.toggle("open", open);
      backdrop.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
      drawer.setAttribute("aria-hidden", String(!open));
    });
    backdrop.addEventListener("click", close);
    $$("[data-close-drawer]", drawer).forEach((b) => b.addEventListener("click", close));
  }

  function initMotionToggle() {
    const btn = $("#motionBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const next = !motionEnabled();
      setMotion(next);
      toast(next ? "Animations on" : "Animations off");
      refreshChrome();
    });
  }

  function initThemePicker() {
    const btn = $("#themeBtn");
    const menu = $("#themeMenu");
    if (!btn || !menu) return;
    const close = () => {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    };
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !menu.classList.contains("open");
      menu.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.querySelectorAll("[data-theme-set]").forEach((opt) => {
      opt.addEventListener("click", () => {
        const t = setTheme(opt.getAttribute("data-theme-set"));
        close();
        toast(THEME_LABEL[t] + " theme");
        refreshChrome();
      });
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".theme-wrap")) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  function initShortcuts() {
    if (document.__mctKeys) return;
    document.__mctKeys = true;
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        const input = $("#searchInput");
        if (input) input.focus();
      }
      if (e.key === "Escape") {
        $$(".drawer.open, .drawer-backdrop.open").forEach((n) => n.classList.remove("open"));
      }
    });
  }

  function initSearch() {
    const input = $("#searchInput");
    const box = $("#searchResults");
    if (!input || !box) return;
    let active = -1;
    const people = playerAccounts().map(toProfile);

    function render(q) {
      const query = q.trim().toLowerCase();
      if (!query) {
        box.innerHTML = `<div class="sr-empty">Type a player name</div>`;
        return;
      }
      const hits = people
        .filter((p) => p.name.toLowerCase().includes(query))
        .sort((a, b) => b.points - a.points)
        .slice(0, 8);
      active = -1;
      box.innerHTML = hits.length
        ? hits
            .map(
              (p) => `<a class="sr-row" href="player.html?name=${encodeURIComponent(p.name)}" data-profile="${esc(p.name)}">
                ${face(p.name, p.skin, "", 26)}
                <span class="n">${esc(p.name)}</span>
                ${p.tiers.length ? `<span class="tiny" style="color:#8b95a5">${p.points} pts</span>` : '<span class="tiny" style="color:#6b7686">unranked</span>'}
                <span class="r region" data-r="${esc(p.region)}">${esc(p.region)}</span>
              </a>`
            )
            .join("")
        : `<div class="sr-empty">No player called “${esc(q)}” yet.</div>`;
      initProfilePopups(box);
    }

    input.addEventListener("input", () => {
      render(input.value);
      box.classList.add("open");
    });
    input.addEventListener("focus", () => {
      render(input.value);
      box.classList.add("open");
    });
    input.addEventListener("keydown", (e) => {
      const rows = $$(".sr-row", box);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + Math.max(rows.length, 1)) % Math.max(rows.length, 1);
        rows.forEach((r, i) => r.classList.toggle("active", i === active));
      } else if (e.key === "Enter" && rows[Math.max(active, 0)]) {
        window.location.href = rows[Math.max(active, 0)].getAttribute("href");
      } else if (e.key === "Escape") {
        box.classList.remove("open");
      }
    });
    if (!document.__mctSearchBound) {
      document.__mctSearchBound = true;
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".search")) {
          const b = $("#searchResults");
          if (b) b.classList.remove("open");
        }
      });
    }
  }

  /* ------------------------------------------------------------------ home */

  function renderHome() {
    const board = leaderboard();
    const host = $("#top-players");
    if (host) {
      host.innerHTML = board.length
        ? board.slice(0, 3).map((p, i) => topPlayerRow(p, i)).join("")
        : `<div class="empty-state">
             <div class="empty-icon">🏆</div>
             <div>
               <div class="empty-title">No ranked players yet</div>
               <p class="small muted" style="margin:4px 0 10px">The roster starts empty. Create an account, then the admin sets the tiers.</p>
               <a class="btn btn-primary btn-sm" href="account.html">Create an account</a>
             </div>
           </div>`;
      initProfilePopups(host);
    }

    const gmHost = $("#gm-grid");
    if (gmHost) {
      gmHost.innerHTML = D.gamemodes
        .map((g) => {
          const count = board.filter((p) => p.tiers.some((t) => t.gm === g.id)).length;
          return `<a class="gm-tile" href="rankings.html?gm=${g.id}">
            <img src="assets/icons/${g.icon}.svg" alt="">
            <span><span class="gm-name">${esc(g.name)}</span><br><span class="gm-count">${count} ranked</span></span>
            <span class="chev">›</span>
          </a>`;
        })
        .join("");
    }

    const tierHost = $("#tier-table tbody");
    if (tierHost) {
      tierHost.innerHTML = [1, 2, 3, 4, 5]
        .map((n) => {
          const ht = "HT" + n, lt = "LT" + n;
          return `<tr><td style="width:130px"><span style="display:flex;gap:6px;align-items:center">${n <= 3 ? `<img class="tier-icon" src="assets/icons/tier_${n}.svg" alt="" width="18" height="18">` : ""}${tierPill(ht)}${tierPill(lt)}</span></td>
            <td style="width:120px;font-weight:700">${pointsFor(ht)} / ${pointsFor(lt)} pts</td>
            <td style="color:#8b95a5">${n === 1 ? "Best of the best" : n === 2 ? "Top of the ladder" : n === 3 ? "Strong, consistent" : n === 4 ? "Improving" : "Entry point"}</td></tr>`;
        })
        .join("");
    }

    const titleHost = $("#title-list");
    if (titleHost) {
      titleHost.innerHTML = [...D.titles]
        .reverse()
        .map((t) => {
          const next = D.titles[D.titles.indexOf(t) + 1];
          const pct = Math.max(6, (t.min / 400) * 100);
          return `<div class="title-row">
            <span class="title-dot" style="background:${t.min >= 250 ? "#e8ba3a" : t.min >= 100 ? "#c084fc" : t.min >= 50 ? "#60a5fa" : "#64748b"}"></span>
            ${titleIcon(t.name, 22)}
            <span class="tname">${esc(t.name)}</span>
            <span class="title-bar"><i style="width:${pct}%"></i></span>
            <span class="tpts">${t.min}${next ? "–" + (next.min - 1) : "+"} pts</span>
          </div>`;
        })
        .join("");
    }

    renderEvents($("#event-list"));
  }

  function topPlayerRow(p, i) {
    const plate = ["1-shimmer", "2-shimmer", "3-shimmer"][i] || "other";
    const chips = p.tiers
      .slice(0, 8)
      .map((t) => `<span class="chip">${GM[t.gm] ? `<img src="assets/icons/${t.gm}.svg" alt="">` : ""}${esc(t.tier)}</span>`)
      .join("");
    return `<a class="tp-row" data-place="${i + 1}" data-profile="${esc(p.name)}" href="player.html?name=${encodeURIComponent(p.name)}">
      <div class="rank-plate">
        <img class="shimmer" src="assets/placements/${plate}.svg" alt="">
        <span class="num">${p.rank}</span>
        ${face(p.name, p.skin, "face", 54)}
      </div>
      <div class="tp-main">
        <div class="tp-name">${esc(p.name)}</div>
        <div class="tp-title">${titleIcon(p.title, 24)} <span>${esc(p.title)}</span> <span style="color:#64748b">·</span> <span class="points-big">${p.points} points</span></div>
        <div class="tp-chips">${chips}</div>
      </div>
      <div class="tp-side">${regionPill(p.region)}</div>
    </a>`;
  }

  const EVENTS = [
    { date: "2026-11-14T04:00", d: "14", m: "Nov", title: "Open Testing Weekend", desc: "Extra testers online all weekend in every gamemode, so tier test queues move much faster.", tags: ["Every gamemode", "1v1", "All regions"] },
    { date: "2026-11-20T17:00", d: "20", m: "Nov", title: "Pot PvP Ladder Night", desc: "Two hours of Pot PvP on a live ladder. Win to climb, lose to drop, and finish as high as you can.", tags: ["Pot", "1v1", "NA"] },
    { date: "2026-12-05T10:00", d: "05", m: "Dec", title: "NethOP Team Clash", desc: "16 teams of four in full Netherite OP gear. Best-of-5 team fights, single elimination.", tags: ["NethOP", "4v4", "EU"] },
  ];

  function renderEvents(host) {
    if (!host) return;
    host.innerHTML = EVENTS.map((ev) => {
      const when = new Date(ev.date);
      const diff = when - Date.now();
      const days = Math.floor(diff / 864e5);
      const hours = Math.floor((diff % 864e5) / 36e5);
      const countdown = diff > 0 ? `Starts in ${days}d ${hours}h` : "Finished";
      const time = when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `<a class="event" href="events.html">
        <div class="event-date"><span class="d">${ev.d}</span><span class="m">${ev.m}</span></div>
        <div style="min-width:0">
          <h4>${esc(ev.title)}</h4>
          <p>${esc(ev.desc)}</p>
          <div class="meta">${ev.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}<span class="tiny" style="color:#7d8798;align-self:center">· ${time}</span></div>
        </div>
        <span class="countdown">${countdown}</span>
      </a>`;
    }).join("");
  }

  /* ------------------------------------------------------------- profile modal */

  /** Quick player preview, the same shape as the live site's profile popup. */
  function profileModal(name) {
    const p = profileFor(name);
    if (!p) return;
    const board = leaderboard();
    const row = board.find((x) => x.name.toLowerCase() === p.name.toLowerCase());
    const rank = row ? row.rank : null;
    const plate = rank && rank <= 3 ? ["1-shimmer", "2-shimmer", "3-shimmer"][rank - 1] : "other";

    const slots = D.gamemodes
      .map((g) => {
        const t = p.tiers.find((x) => x.gm === g.id);
        const ht = t && t.tier.startsWith("HT");
        return `<a class="pp-slot${t ? "" : " empty"}" href="rankings.html?gm=${g.id}" title="${esc(g.full)}${t ? " — " + esc(t.tier) : " — unranked"}">
          <span class="pp-slot-icon"><img src="assets/icons/${g.icon}.svg" alt=""></span>
          <span class="pp-slot-tier" data-t="${esc(t ? t.tier : "")}">${t ? esc(t.tier) : "—"}</span>
        </a>`;
      })
      .join("");

    const overlay = document.createElement("div");
    overlay.className = "pp-overlay";
    overlay.innerHTML = `<div class="pp-card" role="dialog" aria-modal="true" aria-label="${esc(p.name)} profile">
      <button class="pp-close" type="button" aria-label="Close profile">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div class="pp-avatar">${face(p.name, p.skin, "pp-face", 96)}</div>
      <h2 class="pp-name">${esc(p.name)}</h2>
      <div class="pp-title">${titleIcon(p.title, 22)}<span>${esc(p.title)}</span></div>
      <div class="pp-region">${esc(regionName(p.region))}</div>
      <div class="pp-actions">
        <a class="btn btn-ghost btn-sm" href="${nameMcUrl(p.skin) || "https://namemc.com/"}" target="_blank" rel="noopener">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M9 1h6v6h-2V4.41l-6.3 6.3-1.4-1.42L11.59 3H9V1Zm-6 3h2v4h4v2H5a2 2 0 0 1-2-2V4Z"/></svg>
          NameMC
        </a>
        <a class="btn btn-ghost btn-sm" href="player.html?name=${encodeURIComponent(p.name)}">
          View full profile
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M9 1h6v6h-2V4.41l-6.3 6.3-1.4-1.42L11.59 3H9V1Zm-6 3h2v4h4v2H5a2 2 0 0 1-2-2V4Z"/></svg>
        </a>
      </div>

      <h3 class="pp-label">Position</h3>
      <div class="pp-position">
        <span class="pp-plate"><img src="assets/placements/${plate}.svg" alt=""><b>${rank ? rank + "." : "—"}</b></span>
        <span class="pp-trophy"><img src="assets/icons/trophy.avif" alt=""></span>
        <strong>Overall</strong>
        <span class="pp-points">(${p.points} points)</span>
      </div>

      <h3 class="pp-label">Tiers</h3>
      <div class="pp-tiers">${slots}</div>
    </div>`;

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    const close = () => {
      overlay.classList.remove("open");
      setTimeout(() => overlay.remove(), 200);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.closest(".pp-close")) close();
    });
    document.addEventListener("keydown", onKey);
    // The overlay animates in via CSS, so it is visible straight away.
    overlay.classList.add("open");
  }

  /** Player names open the quick preview everywhere except the full profile page. */
  function initProfilePopups(root) {
    $$("[data-profile]", root).forEach((el) => {
      el.addEventListener("click", (e) => {
        // Tier-slot links go to their gamemode instead of opening the popup.
        if (e.target.closest(".ov-slot")) return;
        e.preventDefault();
        e.stopPropagation();
        profileModal(el.getAttribute("data-profile"));
      });
    });
  }

  /* -------------------------------------------------------------- rankings */

  /** Folder-style tab strip that sits on top of the rankings card. */
  function rankingTabs(gm) {
    const item = (id, label, iconId) =>
      `<a class="rank-tab${id === gm ? " active" : ""}" href="rankings.html?gm=${id}">
        <img src="assets/icons/${iconId}.svg" width="30" height="30" alt="">
        <strong>${esc(label)}</strong>
      </a>`;
    return `<section class="rank-tabs">${item("overall", "Overall", "overall")}${D.gamemodes
      .map((g) => item(g.id, g.name, g.icon))
      .join("")}</section>`;
  }

  const infoPanel = `<div class="rank-info" id="rank-info">
    <div class="rank-info-col">
      <h4>Points</h4>
      <p>Every tier is worth points: HT1 60, LT1 45, HT2 30, LT2 20, HT3 10, LT3 6, HT4 4, LT4 3, HT5 2 and LT5 1. Points from all eight gamemodes add up and decide the overall leaderboard.</p>
    </div>
    <div class="rank-info-col">
      <h4>Titles</h4>
      <p>Rookie below 10 points, Combat Novice from 10, Combat Cadet from 20, Combat Specialist from 50, Combat Ace from 100, Combat Master from 250 and Combat Grandmaster from 400.</p>
    </div>
    <div class="rank-info-col">
      <h4>Tier test</h4>
      <p>Join <b>130.78.218.210:25606</b> on Java or Bedrock and type <b>/tiertest</b>. Pick your gamemode and region, fight the tester and your tier lands on your profile.</p>
    </div>
  </div>`;

  function rankingView() {
    const params = new URLSearchParams(location.search);
    const gm = params.get("gm") || "overall";
    const isOverall = gm === "overall";
    const meta = GM[gm];
    const board = leaderboard();
    const ranked = isOverall ? board.length : board.filter((p) => p.tiers.some((t) => t.gm === gm)).length;

    const head = `<div class="rank-head">
      <div class="rank-head-main">
        <h1>${isOverall ? "Overall Minecraft PvP Rankings" : esc(meta.full) + " Tier List"}</h1>
        <p>${isOverall ? board.length + " players ranked by points across 8 gamemodes" : ranked + " ranked players, from HT1 to LT5"}</p>
      </div>
      <div class="rank-head-side">
        <button class="btn btn-ghost btn-sm info-btn" type="button" data-info-toggle>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/></svg>
          Information
        </button>
        <div class="ip-block">
          <img class="ip-trophy" src="assets/icons/trophy.avif" width="50" height="50" alt="">
          <div>
            <div class="ip-label">Server IP</div>
            <div class="ip-row">
              <span class="ip-chip">130.78.218.210:25606
                <button class="ip-copy" type="button" data-copy-ip title="Copy server IP" aria-label="Copy server IP">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1Z"/></svg>
                </button>
              </span>
              <span class="ip-status"><span class="live-dot"></span> Online · Java &amp; Bedrock</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;

    const body = isOverall ? overallTable(board) : tierColumns(gm, board);
    const root = $("#page");
    if (root) {
      root.innerHTML = `<div class="rank-shell">${rankingTabs(gm)}${head}${body}</div>`;
      const copy = $("[data-copy-ip]", root);
      if (copy) {
        copy.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText("130.78.218.210:25606");
            toast("IP copied — 130.78.218.210:25606");
          } catch (e) {
            toast("130.78.218.210:25606");
          }
        });
      }
      const info = $("[data-info-toggle]", root);
      if (info) {
        info.addEventListener("click", () => {
          const panel = $("#rank-info", root);
          if (panel) panel.classList.toggle("open");
        });
      }
      initProfilePopups(root);
    }
    document.title = (isOverall ? "Top Minecraft PvP Players - Overall Rankings" : meta.full + " Tier List") + " | MCTiers";
  }

  /** Big player cards, exactly like the live overall leaderboard. */
  function overallTable(list) {
    if (!list.length) {
      return `<div class="rank-empty">${emptyBlock(
        "The leaderboard is empty",
        "Nobody has a tier yet. Create an account, then log in as <b>admin</b> to add tiers.",
        "account.html",
        "Create an account"
      )}</div>${infoPanel}`;
    }
    const me = Store.session();
    const cards = list
      .map((p) => {
        const mine = me && p.name.toLowerCase() === me.name.toLowerCase();
        const plate = p.rank <= 3 ? ["1-shimmer", "2-shimmer", "3-shimmer"][p.rank - 1] : "other";
        const slots = p.tiers
          .map(
            (t) =>
              `<a class="ov-slot" href="rankings.html?gm=${t.gm}" title="${esc(GM[t.gm] ? GM[t.gm].name : t.gm)} — ${esc(t.tier)}">
                <img src="assets/icons/${t.gm}.svg" alt=""><span>${esc(t.tier)}</span>
              </a>`
          )
          .join("");
        return `<div class="ov-card${mine ? " mine" : ""}" data-place="${p.rank}" data-profile="${esc(p.name)}">
          <div class="ov-main">
            <a class="ov-head" href="player.html?name=${encodeURIComponent(p.name)}">
              <div class="ov-plate">
                <img class="shimmer" src="assets/placements/${plate}.svg" alt="">
                <span class="num">${p.rank}.</span>
                ${face(p.name, p.skin, "ov-face", 60)}
              </div>
              <div class="ov-info">
                <h2>${esc(p.name)}</h2>
                <h3>${titleIcon(p.title, 24)}<span class="ov-title">${esc(p.title)}</span> <span class="ov-pts">(${p.points} points)</span></h3>
              </div>
            </a>
            <div class="ov-region"><span class="region" data-r="${esc(p.region)}">${esc(p.region)}</span></div>
          </div>
          <div class="ov-tiers">
            <h4 class="ov-label">Tiers</h4>
            <div class="ov-slots">${slots || '<span class="tiny muted">Unranked</span>'}</div>
          </div>
        </div>`;
      })
      .join("");
    return `<div class="ov-list">${cards}</div>${infoPanel}`;
  }

  function tierColumns(gm, board) {
    const me = Store.session();
    const columns = [1, 2, 3, 4, 5].map((n) => {
      const rows = board
        .filter((p) => {
          const t = p.tiers.find((x) => x.gm === gm);
          return t && (t.tier === "HT" + n || t.tier === "LT" + n);
        })
        .sort((a, b) => {
          const ta = a.tiers.find((x) => x.gm === gm).tier;
          const tb = b.tiers.find((x) => x.gm === gm).tier;
          return ta.localeCompare(tb) || a.name.localeCompare(b.name);
        })
        .map((p) => {
          const t = p.tiers.find((x) => x.gm === gm);
          const mine = me && p.name.toLowerCase() === me.name.toLowerCase();
          const high = t.tier.startsWith("HT");
          return `<a class="rank-row${high ? " high" : " low"}" data-profile="${esc(p.name)}" href="player.html?name=${encodeURIComponent(p.name)}">
            <span class="strip" data-r="${esc(p.region)}"><span>${esc(p.region)}</span></span>
            ${face(p.name, p.skin, "face", 30)}
            <span class="nm">${esc(p.name)}</span>
            ${mine ? '<span class="owner">YOU</span>' : `<span class="tier-mini">${high ? tierArrowUp() : tierArrowDown()}</span>`}
          </a>`;
        })
        .join("");
      return `<section class="tier-col" data-t="${n}">
        <div class="tier-col-head">
          ${n <= 3 ? `<img class="tier-icon" src="assets/icons/tier_${n}.svg" alt="" width="32" height="32">` : `<span class="medal">${medal()}</span>`}
          Tier ${n}
        </div>
        ${rows || `<div class="col-empty">No players</div>`}
      </section>`;
    });
    return `<div class="tier-grid">${columns.join("")}</div>${infoPanel}`;
  }

  const tierArrowUp = () =>
    '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="m6 11 1.41 1.41L12 7.83l4.59 4.58L18 11l-6-6z"/><path d="M6 17.59 7.41 19 12 14.42 16.59 19 18 17.59l-6-6z"/></svg>';
  const tierArrowDown = () =>
    '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="m6 11 1.41 1.41L12 7.83l4.59 4.58L18 11l-6-6z"/><path d="M6 17.59 7.41 19 12 14.42 16.59 19 18 17.59l-6-6z"/></svg>';

  const medal = () =>
    '<svg class="medal" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12v5a6 6 0 0 1-12 0V3Zm-2 1h2v4a3 3 0 0 1-2-3V4Zm14 0h2v1a3 3 0 0 1-2 3V4ZM11 15h2v4h3v2H8v-2h3v-4Z"/></svg>';

  function emptyBlock(title, text, href, cta) {
    return `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <div>
        <div class="empty-title">${title}</div>
        <p class="small muted" style="margin:4px 0 10px">${text}</p>
        ${href ? `<a class="btn btn-primary btn-sm" href="${href}">${esc(cta)}</a>` : ""}
      </div>
    </div>`;
  }

  /* ---------------------------------------------------------------- player */

  function playerView() {
    document.body.dataset.page = "player";
    document.body.classList.add("page-profile");
    const name = new URLSearchParams(location.search).get("name") || "";
    const p = profileFor(name);
    const root = $("#page");
    if (!root) return;

    if (!p) {
      root.innerHTML = `<div class="panel panel-pad" style="margin-top:40px">${emptyBlock(
        "Player not found",
        `“${esc(name)}” is not registered on this device. Accounts are local — create one here, then ask the admin to set tiers.`,
        "account.html",
        "Create an account"
      )}</div>`;
      document.title = "Player not found — MCTiers";
      return;
    }

    const me = Store.session();
    const isMe = me && p.name.toLowerCase() === me.name.toLowerCase();
    const isAdminUser = !!p.role && p.role === "admin";
    // profileFor() is not ranked; resolve the player's position once here.
    const board = leaderboard();
    const boardCount = board.length;
    const boardRow = board.find((x) => x.name.toLowerCase() === p.name.toLowerCase());
    p.rank = boardRow ? boardRow.rank : null;

    const rows = p.tiers
      .map((t) => {
        const g = GM[t.gm] || { name: t.gm, full: t.gm };
        return `<tr>
          <td><a class="gm-cell" href="rankings.html?gm=${t.gm}"><img src="assets/icons/${g.icon || g.id || "overall"}.svg" alt="">${esc(g.full)}</a></td>
          <td>${tierPill(t.tier)}</td>
          <td style="color:#9fb0c3">${t.since ? esc(t.since) : "—"}</td>
          <td class="num" style="font-weight:700">${t.points}</td>
        </tr>`;
      })
      .join("");

    const sameTier = p.tiers
      .map((t) => {
        const g = GM[t.gm];
        if (!g) return "";
        const others = leaderboard()
          .filter((o) => o.name !== p.name && o.tiers.some((x) => x.gm === t.gm && x.tier === t.tier))
          .slice(0, 5);
        if (!others.length) return "";
        return `<div style="padding:9px 16px;border-bottom:1px solid #151d27">
          <span class="tiny muted">Also ${esc(t.tier)} in ${esc(g.name)}:</span>
          <span class="small">${others
            .map((o) => `<a href="player.html?name=${encodeURIComponent(o.name)}" style="color:#93c5fd">${esc(o.name)}</a>`)
            .join(" · ")}</span>
        </div>`;
      })
      .join("");

    const next = nextTitle(p.points);
    const pct = next ? Math.min(100, Math.round((p.points / next.min) * 100)) : 100;

    // Profile chrome: custom wallpaper behind everything + a banner on top.
    document.querySelectorAll(".profile-bg").forEach((n) => n.remove());
    const bg = document.createElement("div");
    bg.className = "profile-bg";
    if (p.wallpaper) bg.style.backgroundImage = "url('" + esc(p.wallpaper) + "')";
    document.body.appendChild(bg);

    const bannerStyle = p.banner ? ` style="background-image:url('${esc(p.banner)}')"` : "";
    const bannerOverlay = p.banner ? "" : `<div class="profile-banner-default"></div>`;

    root.innerHTML = `<div style="padding-top:22px">
      ${isMe && !isAdminUser ? `<div class="offline-note"><span>⊙</span><span><b>This is you.</b> Tiers are set by the admin — <a href="account.html" style="color:#f6e2a8;text-decoration:underline">view your account</a>.</span></div>` : ""}
      ${isAdminUser ? `<div class="offline-note"><span>⚙</span><span><b>Admin account.</b> Staff accounts are not ranked. <a href="account.html" style="color:#f6e2a8;text-decoration:underline">Open the admin panel</a>.</span></div>` : ""}
      <div class="profile-hero">
        <div class="profile-banner${p.banner ? " has-image" : ""}"${bannerStyle}>
          ${bannerOverlay}
          <div class="profile-banner-shade"></div>
          <div class="profile-handle">${esc(p.name)}</div>
        </div>
        <div class="profile-stage">
          <div class="profile-character">${skinFigure(p.name, p.skin, 210, p.skinColors, p.skinTexture)}</div>
          <div class="panel profile-card-panel" style="overflow:hidden">
            <div class="profile-card profile-card--cool">
              <div style="min-width:0">
                <h1 class="profile-name">${esc(p.name)} ${isAdminUser ? '<span class="badge-admin" style="vertical-align:middle">ADMIN</span>' : ""}</h1>
                <span class="profile-title">${titleIcon(p.title, 26)} ${esc(p.title)}</span>
                <div class="profile-meta">
                  ${p.rank ? `<b>#${p.rank}</b> of ${boardCount} ranked · ` : "<b>Unranked</b> · "}
                  <b>${p.points}</b> points · ${esc(regionName(p.region))}
                </div>
              </div>
              <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap" class="top-actions">
                ${nameMcUrl(p.skin) ? `<a class="btn btn-ghost btn-sm" href="${nameMcUrl(p.skin)}" target="_blank" rel="noopener">NameMC ↗</a>` : ""}
                ${isMe ? `<a class="btn btn-ghost btn-sm" href="account.html">Edit profile look</a>` : ""}
                <a class="btn btn-ghost btn-sm" href="rankings.html?gm=overall">Leaderboard</a>
              </div>
            </div>
            <div class="profile-bio">${bio(p, boardCount)}</div>
          </div>
          <div class="profile-skin-box">
            ${
              p.skinTexture
                ? `<img src="${esc(p.skinTexture)}" alt="64×64 Minecraft skin">`
                : `<div class="profile-skin-fallback">${face(p.name, p.skin, "", 64)}</div>`
            }
            <span>${p.skinTexture ? "64×64 skin" : "avatar"}</span>
          </div>
        </div>
        <div class="profile-foot-name">${esc(p.name)}</div>
      </div>

      <div class="section" style="margin-top:22px">
        <h2 class="section-title">Tiers</h2>
        <div class="panel" style="overflow:hidden">
          <table class="dtable">
            <thead><tr><th>Gamemode</th><th>Tier</th><th>Since</th><th class="num">Points</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="4" style="padding:22px;text-align:center;color:#6b7686">No tiers yet — the admin sets them.</td></tr>`}</tbody>
          </table>
        </div>
      </div>

      ${sameTier ? `<div class="section"><h2 class="section-title">Players in the same tier</h2><div class="panel" style="overflow:hidden">${sameTier}</div></div>` : ""}

      <div class="section" style="margin-top:22px">
        <div class="panel panel-pad" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:220px">
            <div class="tiny muted">NEXT TITLE ${next ? "· " + esc(next.name) : ""}</div>
            <div style="height:8px;border-radius:99px;background:#1b2431;overflow:hidden;margin-top:8px">
              <i style="display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,#8a6a1e,#e8ba3a)"></i>
            </div>
            <div class="tiny muted" style="margin-top:6px">${next ? `${next.min - p.points} points to ${esc(next.name)}` : "Highest title reached"}</div>
          </div>
          <a class="btn btn-ghost btn-sm" href="guides.html">How points work</a>
        </div>
      </div>
    </div>`;
    document.title = `${p.name} — Minecraft PvP Tier Profile | MCTiers`;
  }

  function bio(p, boardCount) {
    /* An admin-written description always wins over the generated summary. */
    if (p.bio) return esc(p.bio);
    if (p.role === "admin") return `${esc(p.name)} is the site admin. Staff accounts can set tiers for every player but are not ranked themselves.`;
    const parts = p.tiers.map((t) => `<b>${esc(t.tier)}</b> in ${esc(GM[t.gm] ? GM[t.gm].full : t.gm)}`);
    if (!parts.length) return `${esc(p.name)} is registered but has no tiers yet. The admin adds tiers after a test.`;
    const last = parts.length > 1 ? parts.pop() : null;
    const total = typeof boardCount === "number" ? boardCount : (typeof leaderboard === "function" ? leaderboard().length : 0);
    return `${esc(p.name)} is a ${esc(regionName(p.region))} Minecraft PvP player ranked <b>#${p.rank}</b> of ${total} with <b>${p.points} points</b> (${esc(p.title)}): ${parts.join(", ")}${last ? " and " + last : ""}.`;
  }

  /* --------------------------------------------------------------- account */

  function accountView() {
    const root = $("#page");
    if (!root) return;
    const user = Store.session();
    if (!user) return renderAuth(root);
    if (isAdmin(user)) return renderAdmin(root, user);
    renderPlayerDash(root, user);
  }

  function renderAuth(root) {
    const accounts = Store.accounts();
    const players = Object.keys(accounts).length;
    root.innerHTML = `
      <div class="page-head">
        <h1>Log in</h1>
        <div class="sub">Accounts are local to this browser. Tiers are set by the admin.</div>
      </div>
      <div class="offline-note">
        <span>⚙</span>
        <span><b>Admin login:</b> username <b>admin</b> · password <b>admin1234</b>. Only the admin can edit tiers; everyone else is read-only.</span>
      </div>
      <div class="auth-wrap">
        <form class="panel" id="createForm" autocomplete="off">
          <div class="panel-head">Create a player account</div>
          <div class="panel-pad">
            <div class="form-row">
              <label for="newName">Player name</label>
              <input class="input" id="newName" maxlength="16" placeholder="e.g. SkyeRanks" required>
              <div class="hint">3–16 characters: letters, numbers and underscores. This is your listing name.</div>
            </div>
            <div class="form-row">
              <label for="newPass">Password <span class="muted">(optional, local only)</span></label>
              <input class="input" id="newPass" type="password" placeholder="Anything you'll remember">
            </div>
            <div class="form-row">
              <label for="newRegion">Region</label>
              <select class="select" id="newRegion">
                ${Object.entries(D.regions).map(([k, v]) => `<option value="${k}">${esc(v)} (${k})</option>`).join("")}
              </select>
            </div>
            <div class="form-row">
              <label for="newSkin">Minecraft skin <span class="muted">(optional)</span></label>
              <input class="input" id="newSkin" placeholder="Notch or https://namemc.com/profile/Notch">
              <div class="hint">Paste your Minecraft name or NameMC link. It can be changed later from your account.</div>
            </div>
            <div class="err" id="createErr"></div>
            <button class="btn btn-primary" type="submit" style="width:100%">Create account</button>
          </div>
        </form>

        <form class="panel" id="loginForm" autocomplete="off">
          <div class="panel-head">Sign in on this device</div>
          <div class="panel-pad">
            ${
              players
                ? `<div class="form-row"><label>Saved accounts</label>
                    <div style="display:flex;flex-direction:column;gap:6px">
                      ${Object.values(accounts)
                        .map((a) => `<button type="button" class="btn btn-ghost" data-pick="${esc(a.name)}" style="justify-content:flex-start">${face(a.name, a.skin, "", 24)}<span>${esc(a.name)}</span><span class="tiny muted" style="margin-left:auto">${isAdmin(a) ? "admin" : gmCount(a.tiers) + " tiers"}</span></button>`)
                        .join("")}
                    </div></div>`
                : `<p class="small muted" style="margin-top:0">No accounts on this device yet.</p>`
            }
            <div class="form-row" style="margin-top:14px">
              <label for="loginName">Username</label>
              <input class="input" id="loginName" placeholder="admin">
            </div>
            <div class="form-row">
              <label for="loginPass">Password</label>
              <input class="input" id="loginPass" type="password" placeholder="Leave empty if you set none">
            </div>
            <div class="err" id="loginErr"></div>
            <button class="btn btn-ghost" type="submit" style="width:100%">Sign in</button>
          </div>
        </form>
      </div>

      <div class="section">
        <h2 class="section-title">How this works</h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px" class="how-grid">
          ${[
            ["1 · Players register", "Create an account with the name you want listed. No email, no Mojang login — it stays in this browser."],
            ["2 · Admin sets tiers", "Log in as admin to give players HT1–LT5 in any of the eight gamemodes."],
            ["3 · Leaderboard updates", "Points, titles and the overall ranking are calculated from the tiers the admin saves."],
          ]
            .map(([t, d]) => `<div class="menu-card"><span class="t">${t}</span><span class="d">${d}</span></div>`)
            .join("")}
        </div>
      </div>`;
    document.title = "Log in — MCTiers";

    $("#createForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#newName").value.trim();
      const pass = $("#newPass").value;
      const region = $("#newRegion").value;
      const err = $("#createErr");
      if (!validName(name)) {
        err.textContent = "Name must be 3–16 characters: letters, numbers or underscores.";
        return;
      }
      if (name.toLowerCase() === ADMIN_NAME) {
        err.textContent = "“admin” is reserved for the site admin.";
        return;
      }
      if (Store.accounts()[name.toLowerCase()]) {
        err.textContent = "That name is already registered on this device.";
        return;
      }
      const acc = {
        name,
        role: "player",
        region,
        pass: pass ? hashPassword(pass, name) : null,
        tiers: {},
        since: {},
        skin: skinRef($("#newSkin").value) || null,
        createdAt: new Date().toISOString(),
      };
      Store.saveAccount(acc);
      Store.login(name);
      toast(`Welcome, ${name}`);
      refreshChrome();
      renderPlayerDash($("#page"), acc, true);
    });

    $$("[data-pick]").forEach((b) =>
      b.addEventListener("click", () => {
        $("#loginName").value = b.getAttribute("data-pick");
        const acc = Store.accounts()[b.getAttribute("data-pick").toLowerCase()];
        if (acc && acc.pass) $("#loginPass").focus();
      })
    );

    $("#loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#loginName").value.trim();
      const pass = $("#loginPass").value;
      const err = $("#loginErr");
      const acc = Store.accounts()[name.toLowerCase()];
      if (!acc) {
        err.textContent = "No account with that username on this device.";
        return;
      }
      if (acc.pass && acc.pass !== hashPassword(pass, acc.name)) {
        err.textContent = "Wrong password.";
        return;
      }
      Store.login(acc.name);
      toast(`Signed in as ${acc.name}`);
      refreshChrome();
      if (isAdmin(acc)) renderAdmin($("#page"), acc, true);
      else renderPlayerDash($("#page"), acc, true);
    });
  }

  /* ----------------------------------------------------------- player dash */

  function renderPlayerDash(root, acc, replace) {
    const p = toProfile(acc);
    const board = leaderboard();
    const rank = p.rank || (board.find((x) => x.name === acc.name) || {}).rank || null;
    const next = nextTitle(p.points);

    root.innerHTML = `
      <div class="page-head">
        <h1>My account</h1>
        <div class="sub">Signed in on this device · ${esc(regionName(acc.region))}</div>
      </div>
      <div class="offline-note">
        <span>🔒</span>
        <span><b>Tiers are read-only.</b> Only the <b>admin</b> can edit tiers. Ask the admin to update your profile, or log in as admin if that's you.</span>
      </div>
      <div class="panel" style="overflow:hidden;margin-bottom:14px">
        <div class="profile-card">
          ${face(acc.name, acc.skin, "profile-face", 96)}
          <div style="min-width:0">
            <h2 class="profile-name" style="font-size:28px;margin-bottom:6px">${esc(acc.name)}</h2>
            <span class="profile-title">${titleIcon(p.title, 22)} ${esc(p.title)}</span>
            <div class="profile-meta">${rank ? `<b>#${rank}</b> of ${board.length} ranked · ` : "<b>Unranked</b> · "}<b>${p.points}</b> points</div>
          </div>
          <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
            <a class="btn btn-primary btn-sm" href="player.html?name=${encodeURIComponent(acc.name)}">View profile</a>
            <button class="btn btn-ghost btn-sm" id="logoutBtn">Sign out</button>
          </div>
        </div>
      </div>

      <div class="stat-grid" style="margin-bottom:14px">
        <div class="stat"><div class="k">Points</div><div class="v">${p.points}</div></div>
        <div class="stat"><div class="k">Overall rank</div><div class="v">${rank ? "#" + rank : "—"}</div></div>
        <div class="stat"><div class="k">Gamemodes</div><div class="v">${p.tiers.length}<small>/ 8</small></div></div>
        <div class="stat"><div class="k">Next title</div><div class="v" style="font-size:15px;padding-top:5px">${next ? esc(next.name) : "Max"}</div></div>
      </div>

      ${profileLookHTML(acc, "own")}

      <div class="panel" style="overflow:hidden;margin-bottom:14px">
        <div class="panel-head">My tiers <span class="spacer"></span><span class="tiny" style="text-transform:none;letter-spacing:0;color:#7d8798">set by the admin</span></div>
        ${
          p.tiers.length
            ? `<table class="dtable">
                 <thead><tr><th>Gamemode</th><th>Tier</th><th>Since</th><th class="num">Points</th></tr></thead>
                 <tbody>${p.tiers
                   .map((t) => `<tr><td class="gm-cell"><img src="assets/icons/${t.gm}.svg" alt="">${esc(GM[t.gm].full)}</td><td>${tierPill(t.tier)}</td><td style="color:#9fb0c3">${t.since ? esc(t.since) : "—"}</td><td class="num">${t.points}</td></tr>`)
                   .join("")}</tbody>
               </table>`
            : `<div style="padding:22px;text-align:center;color:#6b7686" class="small">No tiers yet. The admin hasn't ranked you.</div>`
        }
      </div>

      <div class="menu-grid">
        <a class="menu-card" href="rankings.html?gm=overall"><span class="t">Overall leaderboard</span><span class="d">See where you land.</span></a>
        <a class="menu-card" href="guides.html"><span class="t">How tiers work</span><span class="d">HT1 to LT5, points and titles explained.</span></a>
        <button class="menu-card" id="deleteBtn"><span class="t" style="color:#ff9a9a">Delete my account</span><span class="d">Removes this profile from the browser.</span></button>
      </div>`;

    document.title = `${acc.name} — My account | MCTiers`;
    if (replace) window.scrollTo({ top: 0, behavior: "smooth" });

    initProfileLook(root, acc, () => renderPlayerDash(root, acc, false), "own");

    $("#logoutBtn").addEventListener("click", () => {
      Store.logout();
      toast("Signed out");
      refreshChrome();
      accountView();
    });

    $("#deleteBtn").addEventListener("click", () => {
      if (!confirm(`Delete the account “${acc.name}” from this browser?`)) return;
      Store.removeAccount(acc.name);
      Store.logout();
      toast("Account deleted");
      refreshChrome();
      accountView();
    });
  }

  /* ------------------------------------------------------------ admin panel */

  function renderAdmin(root, admin) {
    const params = new URLSearchParams(location.search);
    const editName = params.get("edit");
    const players = playerAccounts();
    const board = leaderboard();
    const pointsGiven = board.reduce((s, p) => s + p.points, 0);
    const editing = editName ? Store.accounts()[editName.toLowerCase()] : null;

    root.innerHTML = `
      <div class="page-head">
        <h1>Admin panel <span class="badge-admin" style="vertical-align:middle">ADMIN</span></h1>
        <div class="sub">Signed in as <b>admin</b> · ${players.length} player accounts · ${board.length} ranked</div>
      </div>
      ${editing && !isAdmin(editing) ? editorBlock(editing) : ""}

      ${profileLookHTML(admin, "own")}

      <div class="stat-grid" style="margin-bottom:14px">
        <div class="stat"><div class="k">Players</div><div class="v">${players.length}</div></div>
        <div class="stat"><div class="k">Ranked</div><div class="v">${board.length}</div></div>
        <div class="stat"><div class="k">Points awarded</div><div class="v">${pointsGiven}</div></div>
        <div class="stat"><div class="k">Top player</div><div class="v" style="font-size:15px;padding-top:5px">${board[0] ? esc(board[0].name) : "—"}</div></div>
      </div>

      <div class="panel" style="overflow:hidden;margin-bottom:14px">
        <div class="panel-head">Add a player</div>
        <form class="panel-pad" id="addForm" autocomplete="off" style="display:grid;grid-template-columns:1fr 1fr 160px auto;gap:10px;align-items:end">
          <div class="form-row" style="margin:0"><label for="addName">Player name</label><input class="input" id="addName" maxlength="16" placeholder="e.g. SkyeRanks" required></div>
          <div class="form-row" style="margin:0"><label for="addPass">Password (optional)</label><input class="input" id="addPass" type="text" placeholder="they can change it later"></div>
          <div class="form-row" style="margin:0"><label for="addRegion">Region</label>
            <select class="select" id="addRegion">${Object.entries(D.regions).map(([k, v]) => `<option value="${k}">${esc(v)} (${k})</option>`).join("")}</select>
          </div>
          <button class="btn btn-primary" type="submit">Add player</button>
        </form>
        <div class="err" id="addErr" style="padding:0 18px 12px"></div>
      </div>

      <div class="panel" style="overflow:hidden;margin-bottom:14px">
        <div class="panel-head">Roster <span class="spacer"></span><span class="tiny" style="text-transform:none;letter-spacing:0;color:#7d8798">only the admin can edit tiers</span></div>
        ${
          players.length
            ? `<table class="dtable">
                 <thead><tr><th>Player</th><th>Region</th><th>Tiers</th><th class="num">Points</th><th style="width:170px"></th></tr></thead>
                 <tbody>${players
                   .map((acc) => {
                     const p = toProfile(acc);
                     const rank = (board.find((x) => x.name === acc.name) || {}).rank;
                     return `<tr>
                       <td><a href="player.html?name=${encodeURIComponent(acc.name)}" style="display:flex;align-items:center;gap:10px">${face(acc.name, acc.skin, "", 28)}<span style="font-weight:600">${esc(acc.name)}</span>${rank ? `<span class="tiny" style="color:#7d8798">#${rank}</span>` : '<span class="tiny" style="color:#56606e">unranked</span>'}</a></td>
                       <td>${regionPill(acc.region)}</td>
                       <td>${gmCount(acc.tiers)} / 8</td>
                       <td class="num" style="font-weight:700">${p.points}</td>
                       <td style="text-align:right">
                         <a class="btn btn-ghost btn-sm" href="account.html?edit=${encodeURIComponent(acc.name)}">Edit tiers</a>
                         <button class="btn btn-danger btn-sm" data-del="${esc(acc.name)}">Delete</button>
                       </td>
                     </tr>`;
                   })
                   .join("")}</tbody>
               </table>`
            : `<div style="padding:22px;text-align:center;color:#6b7686" class="small">No players yet. Add one above, or share this page — accounts are local to each browser.</div>`
        }
      </div>

      <div class="menu-grid">
        <button class="menu-card" id="exportBtn"><span class="t">Export roster</span><span class="d">Download every local account as JSON.</span></button>
        <label class="menu-card" style="cursor:pointer"><span class="t">Import roster</span><span class="d">Restore accounts from a backup file.</span><input type="file" id="importFile" accept="application/json" hidden></label>
        <button class="menu-card" id="reseedBtn"><span class="t">Restore demo roster</span><span class="d">Replace all player accounts with the real-player roster.</span></button>
        <button class="menu-card" id="syncHubBtn"><span class="t">Sync roster to the game hub</span><span class="d">Push every tier and profile to the server so the plugin picks it up.</span></button>
        <button class="menu-card" id="logoutBtn"><span class="t">Sign out</span><span class="d">Leave the admin panel.</span></button>
      </div>`;

    document.title = "Admin panel — MCTiers";
    if (editing) setTimeout(() => $("#editor") && $("#editor").scrollIntoView({ behavior: "smooth", block: "start" }), 60);

    initProfileLook(root, admin, () => renderAdmin(root, admin, false), "own");

    $("#addForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#addName").value.trim();
      const pass = $("#addPass").value;
      const region = $("#addRegion").value;
      const err = $("#addErr");
      if (!validName(name)) {
        err.textContent = "Name must be 3–16 characters: letters, numbers or underscores.";
        return;
      }
      if (name.toLowerCase() === ADMIN_NAME) {
        err.textContent = "“admin” is reserved.";
        return;
      }
      if (Store.accounts()[name.toLowerCase()]) {
        err.textContent = "That name already exists.";
        return;
      }
      Store.saveAccount({
        name,
        role: "player",
        region,
        pass: pass ? hashPassword(pass, name) : null,
        tiers: {},
        since: {},
        skin: null,
        createdAt: new Date().toISOString(),
      });
      toast(`${name} added`);
      location.href = "account.html?edit=" + encodeURIComponent(name);
    });

    $$("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        const name = b.getAttribute("data-del");
        if (!confirm(`Delete the player “${name}” and all their tiers?`)) return;
        Store.removeAccount(name);
        toast(`${name} deleted`);
        location.href = "account.html";
      })
    );

    $("#logoutBtn").addEventListener("click", () => {
      Store.logout();
      toast("Signed out");
      refreshChrome();
      accountView();
    });

    $("#exportBtn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify({ v: 1, accounts: Store.accounts() }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "mctiers-roster.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast("Roster exported");
    });

    const reseed = $("#reseedBtn");
    if (reseed) {
      reseed.addEventListener("click", () => {
        if (!confirm("Replace every player account with the real-player demo roster?")) return;
        const all = Store.accounts();
        Object.keys(all).forEach((k) => {
          if (all[k].role !== "admin") Store.removeAccount(all[k].name);
        });
        const n = seedRoster(true);
        toast(n + " players restored");
        pushAllToHub().then(() => toast("Roster pushed to the game hub"));
        refreshChrome();
        renderAdmin(root, admin, false);
      });
    }
    const syncBtn = $("#syncHubBtn");
    if (syncBtn) {
      syncBtn.addEventListener("click", async () => {
        const n = await pushAllToHub();
        toast(n > 0 ? "Roster pushed to the game hub (" + n + ")" : "The game hub is not reachable");
      });
    }

    $("#importFile").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const incoming = parsed.accounts || parsed;
          let n = 0;
          for (const key of Object.keys(incoming)) {
            const acc = incoming[key];
            if (!acc || !validName(acc.name || "")) continue;
            if (isAdmin(acc)) continue;
            acc.role = "player";
            Store.saveAccount(acc);
            n++;
          }
          toast(`Imported ${n} account${n === 1 ? "" : "s"}`);
          renderAdmin(root, admin, true);
          refreshChrome();
        } catch (err) {
          toast("That file isn't a roster backup");
        }
      };
      reader.readAsText(file);
    });

    if (editing && !isAdmin(editing)) wireEditor(root, admin, editing);
  }

  function editorBlock(acc) {
    const p = toProfile(acc);
    return `<div id="editor-wrap">
      <div class="panel" id="editor" style="overflow:hidden;margin-bottom:14px;border-color:#3b4d63">
        <div class="panel-head">Editing ${esc(acc.name)} <span class="spacer"></span>
          <a href="account.html" style="text-transform:none;letter-spacing:0;font-size:12.5px;color:#93c5fd">Done</a>
        </div>
        <div class="profile-card" style="padding:14px 18px">
          <div class="skin-preview" style="width:88px;height:112px">${skinFigure(acc.name, acc.skin, 112, acc.skinColors, acc.skinTexture)}</div>
          <div>
            <div style="font-size:24px;font-weight:800">${esc(acc.name)}</div>
            <div class="small muted">${esc(p.title)} · ${p.points} points · ${p.tiers.length} of 8 gamemodes</div>
          </div>
          <a class="btn btn-ghost btn-sm" style="margin-left:auto" href="player.html?name=${encodeURIComponent(acc.name)}">View profile</a>
        </div>
        <div class="editor-row" style="grid-template-columns:1fr;align-items:start;gap:8px">
          <span class="gm">Description <span class="muted" style="font-weight:400;font-size:12px">(shown on the player's profile, max 400 characters)</span></span>
          <textarea class="input textarea" id="editorBio" rows="3" maxlength="400" placeholder="Write a short description for this player…">${esc(acc.bio || "")}</textarea>
        </div>
        <div id="editorRows">
          ${D.gamemodes
            .map((g) => {
              const cur = (acc.tiers && acc.tiers[g.id]) || "";
              return `<div class="editor-row">
                <span class="gm"><img src="assets/icons/${g.icon}.svg" alt="">${esc(g.full)}</span>
                <select class="select" data-gm="${g.id}">
                  <option value="">Unranked</option>
                  ${TIER_ORDER.map((t) => `<option value="${t}"${t === cur ? " selected" : ""}>${t} · ${pointsFor(t)} pts</option>`).join("")}
                </select>
              </div>`;
            })
            .join("")}
        </div>
        <div class="panel-foot"><span class="small muted">Changes save immediately and update the leaderboard.</span></div>
      </div>
      ${profileLookHTML(acc, "ed")}
    </div>`;
  }

  function wireEditor(root, admin, acc) {
    const bioField = $("#editorBio", $("#editor"));
    if (bioField) {
      const saveBio = () => {
        const text = bioField.value.trim().slice(0, 400);
        if (text === (acc.bio || "")) return;
        acc.bio = text;
        Store.saveAccount(acc);
        toast("Description saved");
        pushProfile(acc);
      };
      bioField.addEventListener("change", saveBio);
      bioField.addEventListener("blur", saveBio);
    }

    $$("[data-gm]", $("#editor")).forEach((sel) => {
      sel.addEventListener("change", () => {
        acc.tiers = acc.tiers || {};
        acc.since = acc.since || {};
        const gm = sel.getAttribute("data-gm");
        if (sel.value) {
          acc.tiers[gm] = sel.value;
          acc.since[gm] = acc.since[gm] || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        } else {
          delete acc.tiers[gm];
          delete acc.since[gm];
        }
        Store.saveAccount(acc);
        toast("Tier saved");
        pushTier(acc, gm, sel.value);
        renderAdmin(root, admin, false);
      });
    });

    /* The admin edits the player's photo, banner, wallpaper and description. */
    initProfileLook(root, acc, () => renderAdmin(root, admin, false), "ed");
  }

  /* ------------------------------------------------------------------ boot */

  const prefersReducedMotion = () =>
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Motion is on unless the user switched it off from the header. */
  const motionOn = () => motionEnabled();

  /** Fade sections in as they scroll into view. The class is added by JS only,
      so the page stays fully visible when scripting or motion is disabled. */
  function initReveal() {
    if (!("IntersectionObserver" in window)) return;
    if (!document.__mctRevealIO) {
      document.__mctRevealIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("in");
            document.__mctRevealIO.unobserve(entry.target);
          });
        },
        { threshold: 0.06, rootMargin: "0px 0px -6% 0px" }
      );
    }
    const io = document.__mctRevealIO;
    const fold = window.innerHeight * 0.92;
    $$(".section").forEach((el, i) => {
      if (el.dataset.reveal) return;
      // Never hide something that is already on screen — that would flash.
      if (el.getBoundingClientRect().top < fold) return;
      el.dataset.reveal = "1";
      el.classList.add("reveal");
      el.style.transitionDelay = Math.min(i, 3) * 45 + "ms";
      io.observe(el);
    });
    // Safety net: if the observer never reports, show anything already in view.
    if (!document.__mctRevealSafety) {
      document.__mctRevealSafety = true;
      setTimeout(() => {
        $$(".reveal:not(.in)").forEach((el) => {
          if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("in");
        });
      }, 2500);
    }
  }

  /** Count stat numbers up from zero when they first appear. */
  function animateCounters() {
    if (!motionOn() || document.visibilityState !== "visible") return;
    $$(".stat .v").forEach((el) => {
      const text = el.textContent.trim();
      if (!/^\d{1,4}$/.test(text) || el.dataset.counted === text) return;
      const target = Number(text);
      el.dataset.counted = text;
      if (target < 2) return;
      const started = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - started) / 550);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = String(target);
      };
      el.textContent = "0";
      requestAnimationFrame(tick);
    });
  }

  function watchMotion() {
    const run = () => {
      initReveal();
      animateCounters();
    };
    if ("MutationObserver" in window) {
      let queued = false;
      new MutationObserver(() => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => {
          queued = false;
          run();
        });
      }).observe(document.body, { childList: true, subtree: true });
    }
    run();
    // Safety net: if the compositor never advanced the entrance animations
    // (background tab, throttled rendering) the page must still be readable.
    const settle = () => document.documentElement.classList.add("settled");
    setTimeout(settle, 1400);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) settle();
    });
    window.addEventListener("focus", settle);
    window.addEventListener("pageshow", settle);
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) =>
      window.addEventListener(ev, settle, { once: true, passive: true })
    );
  }

  function updateOnlineBadge() {
    const el = $("#netState");
    if (!el) return;
    el.textContent = navigator.onLine ? "Connected · 3D skins enabled" : "Offline · generated pixel avatars";
  }

  function renderStaticExtras() {
    const host = $("#gm-links");
    if (host) {
      host.innerHTML = D.gamemodes
        .map((g) => `<a class="gm-tile" href="rankings.html?gm=${g.id}"><img src="assets/icons/${g.id}.svg" alt=""><span class="gm-name">${esc(g.name)}</span><span class="chev">›</span></a>`)
        .join("");
    }
    renderEvents($("#event-list"));
  }

  function init() {
    seedAdmin();
    seedRoster(false);
    setMotion(motionEnabled());
    setTheme(themeName());
    installSkinFallback();
    /* keep the shared hub in step with the local roster */
    pushAllToHub();
    initChrome();
    const page = document.body.getAttribute("data-page");
    if (page === "home") renderHome();
    if (page === "rankings") rankingView();
    if (page === "player") playerView();
    if (page === "account") accountView();
    if (page === "chat") syncHub();
    if (page === "static") renderStaticExtras();
    watchMotion();
    updateOnlineBadge();
    window.addEventListener("online", updateOnlineBadge);
    window.addEventListener("offline", updateOnlineBadge);
  }

  window.MCTApp = { init, toast, faceDataURI, Store, leaderboard, toProfile, profileFor, pointsFor, titleFor, isAdmin, skinRef, nameMcUrl, syncHub, pushProfile };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
