/* ==========================================================================
   MCTiers — effects layer
   Ambient particles, cursor light, scroll progress, aurora hero band,
   page transitions and the gamemode marquee. All of it is CSS-driven where
   possible and everything is skipped under prefers-reduced-motion.
   ========================================================================== */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  /** Motion follows the in-site toggle (header sun icon), not the OS setting. */
  const reduced = () => document.documentElement.classList.contains("motion-off");

  /* ------------------------------------------------------------- page veil */

  function initVeil() {
    const veil = document.createElement("div");
    veil.className = "page-veil";
    document.body.appendChild(veil);

    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) return;
      if (/^[a-z]+:\/\//i.test(href)) return; // external
      e.preventDefault();
      veil.classList.add("leaving");
      setTimeout(() => {
        location.href = href;
      }, 170);
    });

    window.addEventListener("pageshow", () => veil.classList.remove("leaving"));
  }

  /* -------------------------------------------------------- scroll progress */

  function initScrollProgress() {
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    document.body.appendChild(bar);
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    };
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      },
      { passive: true }
    );
    window.addEventListener("resize", update);
    update();
  }

  /* ---------------------------------------------------------- cursor light */

  function initSpotlight() {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const light = document.createElement("div");
    light.className = "fx-spotlight";
    document.body.appendChild(light);

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    let raf = null;

    const step = () => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      light.style.transform = "translate3d(" + (x - 310).toFixed(1) + "px," + (y - 310).toFixed(1) + "px,0)";
      if (Math.abs(tx - x) > 0.4 || Math.abs(ty - y) > 0.4) {
        raf = requestAnimationFrame(step);
      } else {
        raf = null;
      }
    };

    window.addEventListener(
      "mousemove",
      (e) => {
        tx = e.clientX;
        ty = e.clientY;
        light.style.opacity = "1";
        if (!raf) raf = requestAnimationFrame(step);
      },
      { passive: true }
    );
    document.addEventListener("mouseleave", () => {
      light.style.opacity = "0";
    });
  }

  /* --------------------------------------------------------- particle dust */

  function initParticles() {
    const canvas = document.createElement("canvas");
    canvas.className = "fx-canvas";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let dots = [];
    let sparks = [];
    let mx = -1;
    let my = -1;
    let lmx = -1;
    let lmy = -1;
    let raf = null;
    let running = false;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(18, Math.min(64, Math.round((w * h) / 26000)));
      dots = new Array(count).fill(0).map(() => spawn(true));
    };

    const spawn = (anywhere) => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 12,
      r: Math.random() < 0.85 ? 1 : 1.8,
      vy: -(0.12 + Math.random() * 0.34),
      vx: (Math.random() - 0.5) * 0.16,
      a: 0.12 + Math.random() * 0.4,
      gold: Math.random() < 0.72,
      tw: Math.random() * Math.PI * 2,
    });

    const frame = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      /* constellation links between nearby particles */
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 9025) {
            const alpha = (1 - Math.sqrt(d2) / 95) * 0.14;
            ctx.strokeStyle = "rgba(175,152,105," + alpha.toFixed(3) + ")";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      /* gold sparks trail the pointer */
      if (mx >= 0 && Math.abs(mx - lmx) + Math.abs(my - lmy) > 8) {
        lmx = mx;
        lmy = my;
        sparks.push({
          x: mx,
          y: my,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2 - 0.3,
          life: 1,
          r: Math.random() * 1.6 + 0.9,
        });
        if (sparks.length > 90) sparks.splice(0, sparks.length - 90);
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.014;
        s.life -= 0.022;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.fillStyle = "rgba(232,186,58," + (s.life * 0.8).toFixed(3) + ")";
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        d.x += d.vx;
        d.y += d.vy;
        d.tw += 0.03;
        /* the pointer pushes dust away */
        if (mx >= 0) {
          const pdx = d.x - mx;
          const pdy = d.y - my;
          const pd2 = pdx * pdx + pdy * pdy;
          if (pd2 < 14400 && pd2 > 0.01) {
            const pd = Math.sqrt(pd2);
            const push = (1 - pd / 120) * 1.1;
            d.x += (pdx / pd) * push;
            d.y += (pdy / pd) * push;
          }
        }
        if (d.y < -14 || d.x < -20 || d.x > w + 20) dots[i] = spawn(false);
        const alpha = d.a * (0.6 + 0.4 * Math.sin(d.tw));
        ctx.fillStyle = d.gold ? "rgba(232,186,58," + alpha.toFixed(3) + ")" : "rgba(120,170,255," + alpha.toFixed(3) + ")";
        ctx.fillRect(d.x, d.y, d.r, d.r);
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    };

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    window.addEventListener(
      "mousemove",
      (e) => {
        mx = e.clientX;
        my = e.clientY;
      },
      { passive: true }
    );
    resize();
    if (reduced()) stop();
    else start();
    return { start, stop };
  }

  /** Follow the header toggle so particles stop when motion is switched off. */
  function watchMotionToggle() {
    if (!("MutationObserver" in window)) return;
    new MutationObserver(() => {
      const off = reduced();
      document.querySelectorAll(".fx-canvas, .fx-spotlight").forEach((n) => {
        n.style.display = off ? "none" : "";
      });
      if (window.MCTFx && typeof window.MCTFx.sync === "function") window.MCTFx.sync(off);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }

  /* ------------------------------------------------------------ hero aurora */

  function initAurora() {
    const host = $(".hero");
    if (!host) return;
    const band = document.createElement("div");
    band.className = "hero-aurora";
    band.setAttribute("aria-hidden", "true");
    host.insertBefore(band, host.firstChild);
  }

  /* ---------------------------------------------------------------- ticker */

  function initTicker() {
    const host = $("#ticker");
    if (!host) return;
    const modes = (window.MCT && window.MCT.gamemodes) || [];
    if (!modes.length) return;
    const strip = modes
      .map(
        (g) =>
          '<span class="ticker-item"><img src="assets/icons/' +
          g.icon +
          '.svg" alt="">' +
          g.name +
          "</span>"
      )
      .join("");
    host.innerHTML = '<div class="ticker-track">' + strip + strip + "</div>";
  }

  /* ------------------------------------------------------- shooting stars */

  /** Occasional star streaks across the hero band. */
  function initShootingStars() {
    const host = $(".hero");
    if (!host) return;
    const wrap = document.createElement("div");
    wrap.className = "hero-stars";
    wrap.setAttribute("aria-hidden", "true");
    // top / right placement + delay per streak
    const streaks = [
      { top: "14%", right: "8%", delay: "0s" },
      { top: "34%", right: "26%", delay: "2.7s" },
      { top: "8%", right: "44%", delay: "4.6s" },
    ];
    streaks.forEach((s) => {
      const star = document.createElement("span");
      star.className = "shooting-star";
      star.style.top = s.top;
      star.style.right = s.right;
      star.style.animationDelay = s.delay;
      wrap.appendChild(star);
    });
    host.appendChild(wrap);
  }

  /* ------------------------------------------------------------- card tilt */

  /** Subtle 3D tilt on grid cards (fine pointers only, honours Motion toggle). */
  function initTilt() {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const cards = Array.from(document.querySelectorAll(".gm-tile, .event, .stat"));
    if (!cards.length) return;
    const MAX = 6;
    cards.forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        if (reduced()) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          "perspective(700px) rotateX(" + (-py * MAX).toFixed(2) +
          "deg) rotateY(" + (px * MAX).toFixed(2) +
          "deg) translateY(-3px)";
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
      });
    });
  }

  /* ---------------------------------------------------- panel cursor glow */

  /** Gold light that follows the pointer across every panel. */
  function initPanelGlow() {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    document.querySelectorAll(".panel").forEach((p) => {
      p.addEventListener("mousemove", (e) => {
        const r = p.getBoundingClientRect();
        p.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(2) + "%");
        p.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(2) + "%");
      });
      p.addEventListener("mouseleave", () => {
        p.style.removeProperty("--mx");
        p.style.removeProperty("--my");
      });
    });
  }

  /* ---------------------------------------------------- magnetic buttons */

  /** Hero call-to-action buttons lean toward the pointer. */
  function initMagnetic() {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    document.querySelectorAll(".hero-actions .btn").forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        if (reduced()) return;
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        btn.style.transform = "translate(" + (dx * 0.16).toFixed(1) + "px," + (dy * 0.3).toFixed(1) + "px)";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
      });
    });
  }

  /* --------------------------------------------------------- click ripple */

  function initRipple() {
    document.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest(".btn") : null;
      if (!btn || reduced()) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const s = document.createElement("span");
      s.className = "ripple";
      s.style.width = size + "px";
      s.style.height = size + "px";
      s.style.left = e.clientX - r.left - size / 2 + "px";
      s.style.top = e.clientY - r.top - size / 2 + "px";
      btn.appendChild(s);
      setTimeout(() => s.remove(), 700);
    });
  }

  /* ------------------------------------------------------------ count up */

  /** Stat values count up the first time they scroll into view. */
  function initCountUp() {
    const targets = Array.from(document.querySelectorAll(".stat .v"));
    if (!targets.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          const el = en.target;
          if (reduced()) return;
          // Only plain numeric text nodes animate — mixed markup stays untouched.
          if (el.childNodes.length !== 1 || el.firstChild.nodeType !== 3) return;
          const m = el.textContent.match(/\d[\d,]*(\.\d+)?/);
          if (!m) return;
          const end = parseFloat(m[0].replace(/,/g, ""));
          if (!isFinite(end) || end > 1e7) return;
          const before = el.textContent.slice(0, m.index);
          const after = el.textContent.slice(m.index + m[0].length);
          const t0 = performance.now();
          const dur = 850;
          const tick = (t) => {
            const p = Math.min(1, (t - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = before + Math.round(end * eased).toLocaleString("en-US") + after;
            if (p < 1) requestAnimationFrame(tick);
          };
          el.textContent = before + "0" + after;
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.4 }
    );
    targets.forEach((t) => io.observe(t));
  }

  /* ------------------------------------------------------ cursor halo ring */

  /** A soft gold ring that trails the pointer and reacts to interactive items. */
  function initCursorRing() {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const ring = document.createElement("div");
    ring.className = "fx-cursor-ring";
    ring.setAttribute("aria-hidden", "true");
    document.body.appendChild(ring);

    let tx = -200;
    let ty = -200;
    let x = -200;
    let y = -200;
    let raf = null;

    const tick = () => {
      if (reduced()) {
        raf = null;
        return;
      }
      x += (tx - x) * 0.16;
      y += (ty - y) * 0.16;
      ring.style.transform =
        "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) translate(-50%,-50%)";
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.4) raf = requestAnimationFrame(tick);
      else raf = null;
    };

    window.addEventListener(
      "mousemove",
      (e) => {
        tx = e.clientX;
        ty = e.clientY;
        ring.classList.add("on");
        if (!raf) {
          /* snap on the first frame so the ring never flies in from the corner */
          x = tx;
          y = ty;
          ring.style.transform =
            "translate3d(" + x + "px," + y + "px,0) translate(-50%,-50%)";
        }
        if (!raf && !reduced()) raf = requestAnimationFrame(tick);
        else if (reduced()) {
          ring.style.transform =
            "translate3d(" + tx + "px," + ty + "px,0) translate(-50%,-50%)";
        }
      },
      { passive: true }
    );
    document.addEventListener("mouseleave", () => ring.classList.remove("on"));
    document.addEventListener("mousedown", () => ring.classList.add("press"));
    document.addEventListener("mouseup", () => ring.classList.remove("press"));
    document.addEventListener("mouseover", (e) => {
      const hit = e.target.closest && e.target.closest("a, button, summary, .gm-tile, .ov-card");
      ring.classList.toggle("hot", !!hit);
    });
  }

  /* --------------------------------------------------- hero logo parallax */

  /** Wraps the hero logo so it can drift against the pointer without fighting
      the float animation already applied to the image itself. */
  function initHeroParallax() {
    const hero = $(".hero");
    const logo = $(".hero-logo");
    if (!hero || !logo || !window.matchMedia("(pointer: fine)").matches) return;

    let wrap = logo.parentElement;
    if (!wrap || !wrap.classList.contains("hero-logo-wrap")) {
      wrap = document.createElement("span");
      wrap.className = "hero-logo-wrap";
      logo.parentNode.insertBefore(wrap, logo);
      const glow = document.createElement("span");
      glow.className = "hero-logo-glow";
      glow.setAttribute("aria-hidden", "true");
      wrap.appendChild(glow);
      wrap.appendChild(logo);
    }

    hero.addEventListener("mousemove", (e) => {
      if (reduced()) return;
      const r = hero.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      wrap.style.transform =
        "translate3d(" + (dx * 16).toFixed(1) + "px," + (dy * 9).toFixed(1) + "px,0)";
    });
    hero.addEventListener("mouseleave", () => {
      wrap.style.transform = "";
    });
  }

  /* ------------------------------------------------------- back to top ring */

  function initBackTop() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "back-top";
    btn.setAttribute("aria-label", "Back to top");
    btn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"/></svg>';
    document.body.appendChild(btn);

    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
      btn.style.setProperty("--p", pct.toFixed(1) + "%");
      btn.classList.toggle("show", window.scrollY > 320);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
    });
    onScroll();
  }

  /* ------------------------------------------------------- Konami gold rush */

  function initKonami() {
    const seq = ["arrowup", "arrowup", "arrowdown", "arrowdown",
                 "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
    let idx = 0;

    const burst = () => {
      const colors = ["#e8ba3a", "#ffe9a3", "#96c5ff", "#ffffff", "#f0a35e"];
      const n = reduced() ? 24 : 96;
      for (let i = 0; i < n; i++) {
        const c = document.createElement("span");
        c.className = "gold-confetti";
        c.setAttribute("aria-hidden", "true");
        c.style.left = Math.random() * 100 + "vw";
        c.style.background = colors[i % colors.length];
        c.style.setProperty("--dx", (Math.random() * 260 - 130).toFixed(0) + "px");
        c.style.setProperty("--rot", (Math.random() * 760 - 380).toFixed(0) + "deg");
        c.style.animationDelay = (Math.random() * 0.4).toFixed(2) + "s";
        c.style.animationDuration = (1.7 + Math.random() * 1.5).toFixed(2) + "s";
        c.style.width = (5 + Math.random() * 6).toFixed(0) + "px";
        c.style.height = (8 + Math.random() * 10).toFixed(0) + "px";
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 3800);
      }
      document.documentElement.classList.add("gold-rush");
      setTimeout(() => document.documentElement.classList.remove("gold-rush"), 6500);
      if (window.MCTApp && typeof window.MCTApp.toast === "function") {
        window.MCTApp.toast("\u2191\u2191\u2193\u2193\u2190\u2192\u2190\u2192BA \u2014 gold rush unlocked");
      }
    };

    document.addEventListener("keydown", (e) => {
      const key = (e.key || "").toLowerCase();
      if (key === seq[idx]) {
        idx += 1;
        if (idx === seq.length) {
          idx = 0;
          burst();
        }
      } else {
        idx = key === seq[0] ? 1 : 0;
      }
    });
  }

  /* --------------------------------------------------------------- boot */

  let particlesCtl = null;

  function init() {
    /* The profile page stays lean: no particles, tilt, ripples or glow loops. */
    const profile = document.body.classList.contains("page-profile");
    initVeil();
    initScrollProgress();
    if (!profile) {
      initSpotlight();
      particlesCtl = initParticles();
      initAurora();
      initShootingStars();
      initTilt();
      initPanelGlow();
      initMagnetic();
      initRipple();
      initCursorRing();
      initHeroParallax();
      initCountUp();
    }
    initTicker();
    initBackTop();
    initKonami();
    watchMotionToggle();
  }

  function sync(off) {
    if (!particlesCtl) return;
    if (off) particlesCtl.stop();
    else particlesCtl.start();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.MCTFx = { init, sync };
})();
