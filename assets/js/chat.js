/* ==========================================================================
   MCTiers — tier test chat
   Joins a test with the code from /tiertest, talks to the testers and lets a
   tester award the tier. Everything goes through the local tier-test hub.
   ========================================================================== */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const API = "/api/tiertest";

  let me = null;
  let state = { codes: {}, rooms: {}, tiers: {}, profiles: {} };
  let current = null; /* room object */
  let mode = "chat"; /* chat | code */
  let pollTimer = null;

  const TIERS = ["HT1", "LT1", "HT2", "LT2", "HT3", "LT3", "HT4", "LT4", "HT5", "LT5"];

  /* ------------------------------------------------------------- helpers */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function api(path, body) {
    return fetch(API + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Could not reach the tier hub." }));
  }

  function session() {
    try {
      return window.MCTApp && MCTApp.Store ? MCTApp.Store.session() : null;
    } catch (e) {
      return null;
    }
  }

  /** A tester is anybody with a rank on the site, plus the admin. */
  function isTester(name) {
    if (!name) return false;
    if (String(name).toLowerCase() === "admin") return true;
    const tiers = (state.tiers && state.tiers[name]) || {};
    return Object.keys(tiers).some((k) => k !== "__tester" && !k.endsWith("_since"));
  }

  function myTiers() {
    if (!me) return {};
    const rec = (state.tiers && me && state.tiers[me.name]) || {};
    const out = {};
    Object.keys(rec).forEach((k) => {
      if (k === "__tester" || k.endsWith("_since")) return;
      out[k] = rec[k];
    });
    return out;
  }

  function toast(msg) {
    if (window.MCTApp && typeof MCTApp.toast === "function") return MCTApp.toast(msg);
    console.log("[chat]", msg);
  }

  /* --------------------------------------------------------------- render */

  /* The hub is polled every few seconds. Re-rendering a list that did not
     change would swallow clicks and make the page flicker, so each list keeps
     a signature of its content and is only rebuilt when it really changed. */
  let listSignature = "";
  let queueSignature = "";

  function renderList() {
    const host = $("#chatList");
    if (!host) return;
    if (!me) {
      listSignature = "";
      host.innerHTML = `<div class="chat-side-empty">Log in to chat with the testers.</div>`;
      return;
    }
    const rooms = Object.values(state.rooms || {})
      .filter((r) => me && (r.player === me.name || r.tester === me.name))
      .sort((a, b) => (b.messages && b.messages.length ? b.messages[b.messages.length - 1].at : 0) -
                       (a.messages && a.messages.length ? a.messages[a.messages.length - 1].at : 0));
    const signature = rooms
      .map((r) => r.id + ":" + (r.messages ? r.messages.length : 0) + ":" + (r.status || ""))
      .join("|");
    if (signature === listSignature) return;
    listSignature = signature;
    if (!rooms.length) {
      host.innerHTML = `<div class="chat-side-empty">No chats yet.<br>Create one called <b>get tier</b>.</div>`;
      return;
    }
    host.innerHTML = rooms
      .map((r) => {
        const last = r.messages && r.messages.length ? r.messages[r.messages.length - 1].text : "";
        const active = current && current.id === r.id ? " active" : "";
        return `<button class="chat-item${active}" data-room="${esc(r.id)}" type="button">
          <span class="chat-item-top"><b>${esc(r.kind === "tier" ? "Tier test · " + r.player : r.title || "Chat")}</b>
          ${r.status === "done" ? '<span class="chat-badge done">done</span>' : ""}</span>
          <span class="chat-item-sub">${esc(last)}</span>
        </button>`;
      })
      .join("");
    host.querySelectorAll("[data-room]").forEach((b) => {
      b.addEventListener("click", () => openRoom(b.getAttribute("data-room")));
    });
  }

  function renderQueue() {
    const host = $("#chatQueue");
    if (!host) return;
    const codes = Object.values(state.codes || {})
      .filter((c) => c.status !== "done" && c.status !== "expired")
      .sort((a, b) => a.createdAt - b.createdAt);
    const signature = codes.map((c) => c.code + ":" + c.status + ":" + (c.tester || "")).join("|");
    if (signature === queueSignature) return;
    queueSignature = signature;
    const meName = me ? me.name : "";
    if (!codes.length) {
      host.innerHTML = `<div class="chat-side-empty">No open requests.</div>`;
      return;
    }
    host.innerHTML = codes
      .map((c) => {
        const taken = c.status === "claimed";
        const mine = taken && me && c.tester === me.name;
        const own = me && c.player === me.name;
        const label = taken ? "with " + esc(c.tester) : own ? "your request" : "waiting";
        return `<div class="queue-item${mine ? " mine" : ""}">
          <div class="queue-top"><b>${esc(c.player)}</b><span class="chat-badge${taken ? " taken" : ""}">${label}</span></div>
          <div class="queue-code">${esc(c.code)}</div>
          ${
            mine
              ? `<button class="btn btn-ghost btn-sm" data-open="${esc(c.room || "")}" type="button">Open chat</button>`
              : own
                ? `<span class="tiny muted">Waiting for a tester to pick it up.</span>`
                : `<button class="btn btn-ghost btn-sm" data-claim="${esc(c.code)}" type="button">Take this test</button>`
          }
        </div>`;
      })
      .join("");
    host.querySelectorAll("[data-claim]").forEach((b) =>
      b.addEventListener("click", () => claim(b.getAttribute("data-claim")))
    );
    host.querySelectorAll("[data-open]").forEach((b) =>
      b.addEventListener("click", () => b.getAttribute("data-open") && openRoom(b.getAttribute("data-open")))
    );
  }

  let threadSignature = "";

  function renderThread() {
    const host = $("#chatThread");
    if (!host) return;
    if (!current) {
      threadSignature = "";
      host.innerHTML = `<div class="chat-empty">
        <div class="chat-empty-icon">💬</div>
        <h3>No chat selected</h3>
        <p class="muted">Create a chat called <b>get tier</b> and paste the code from <code>/tiertest</code>
           to start a tier test with one of the ranked testers.</p>
      </div>`;
      return;
    }
    const signature = current.id + ":" + (current.messages ? current.messages.length : 0) + ":" +
      Object.keys(current.tiers || {}).length + ":" + (current.status || "");
    const keepScroll = host.scrollTop;
    if (signature === threadSignature) return;
    threadSignature = signature;
    const msgs = (current.messages || []).map((m) => {
      const mine = me && m.from === me.name;
      const system = m.role === "system";
      const who = system ? "" : `<span class="msg-from">${esc(m.from)}</span>`;
      const time = new Date(m.at || Date.now()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      return `<div class="msg${mine ? " mine" : ""}${system ? " system" : ""}">
        <div class="msg-body">${who}<span class="msg-text">${esc(m.text)}</span></div>
        <span class="msg-time">${time}</span>
      </div>`;
    });
    const tiers = current.tiers && Object.keys(current.tiers).length
      ? `<div class="msg-system">Tiers so far: ${Object.keys(current.tiers)
          .map((k) => `<b>${esc(k.toUpperCase())} ${esc(current.tiers[k])}</b>`)
          .join(" · ")}</div>`
      : "";
    host.innerHTML = msgs.join("") + tiers;
    host.scrollTop = keepScroll || host.scrollHeight;
  }

  function render() {
    renderList();
    renderQueue();
    renderThread();
    const tester = isTester(me ? me.name : "");
    const awardBlock = $("#awardBlock");
    if (awardBlock) awardBlock.hidden = !tester;
    const queueWho = $("#queueWho");
    if (queueWho) queueWho.textContent = tester ? "you are a tester" : "your requests";
    const hubState = $("#hubState");
    if (hubState) {
      const open = Object.values(state.codes || {}).filter((c) => c.status !== "done").length;
      hubState.textContent = me
        ? `signed in as ${me.name}${tester ? " · tester" : ""} · ${open} open request${open === 1 ? "" : "s"}`
        : "not signed in";
    }
    if (tester && me) api("/tester", { name: me.name, value: true });
  }

  /* -------------------------------------------------------------- actions */

  function openRoom(id) {
    const room = (state.rooms || {})[id];
    if (!room) return;
    current = room;
    mode = "chat";
    const head = $("#chatHead");
    if (head) {
      $("#chatTitle").textContent = room.kind === "tier" ? `Tier test · ${room.player}` : room.title || "Chat";
      $("#chatMeta").textContent =
        room.kind === "tier"
          ? `code ${room.code} · ${room.tester ? "tester " + room.tester : "waiting for a tester"}${
              room.status === "done" ? " · finished" : ""}`
          : "";
    }
    const composer = $("#chatComposer");
    const row = $("#msgRow");
    const hint = $("#chatCodeHint");
    if (composer) composer.hidden = false;
    if (row) row.hidden = false;
    if (hint) hint.hidden = true;
    render();
    const input = $("#msgInput");
    if (input) input.focus();
  }

  function newChat() {
    const title = prompt("Name this chat. Use “get tier” to join a tier test with your code.");
    if (!title) return;
    const isTier = /tier/i.test(title);
    if (!isTier) {
      toast("Chat created — only tier chats are wired up for now.");
      return;
    }
    openTierFlow("");
  }

  /** Open the "get tier" flow and fill the code box. If the player is signed in,
      the code is submitted automatically. */
  function openTierFlow(prefill) {
    mode = "code";
    current = null;
    const composer = $("#chatComposer");
    const row = $("#msgRow");
    const hint = $("#chatCodeHint");
    if (composer) composer.hidden = false;
    if (row) row.hidden = true;
    if (hint) hint.hidden = false;
    const err = $("#codeErr");
    if (err) err.textContent = "";
    $("#chatTitle").textContent = "get tier";
    $("#chatMeta").textContent = "paste your code to join the queue";
    $("#chatThread").innerHTML = `<div class="chat-empty">
      <div class="chat-empty-icon">🎟️</div>
      <h3>Get tier</h3>
      <p class="muted">Paste the code from <code>/tiertest</code> below and you will be put in a chat
         with the tester team.</p>
    </div>`;
    const input = $("#codeInput");
    if (input) input.value = prefill || "";
    if (prefill && me) submitCode();
  }

  async function claim(code) {
    if (!me) return toast("Log in first");
    if (!me) return toast("Log in first"); const res = await api("/claim", { code, tester: me.name });
    if (!res.ok) return toast(res.error || "Could not claim that test");
    current = res.room;
    state.rooms[res.room.id] = res.room;
    openRoom(res.room.id);
    toast("You are now testing " + res.room.player);
  }

  async function submitCode() {
    const input = $("#codeInput");
    const err = $("#codeErr");
    const code = input ? input.value.trim().toUpperCase() : "";
    if (!code) {
      if (err) err.textContent = "Paste the code you got in game.";
      return;
    }
    /* The player joins their own request — a tester takes it from the queue. */
    const res = await api("/join", { code, player: me ? me.name : "" });
    if (!res.ok) {
      if (err) err.textContent = res.error || "Invalid code.";
      return;
    }
    if (err) err.textContent = "";
    state.rooms[res.room.id] = res.room;
    openRoom(res.room.id);
    toast("Code accepted — waiting for a tester");
  }

  async function send() {
    const input = $("#msgInput");
    const text = input ? input.value.trim() : "";
    if (!text || !current) return;
    if (input) input.value = "";
    const res = await api("/message", {
      id: current.id,
      from: me ? me.name : "guest",
      role: current.tester === (me && me.name) ? "tester" : "player",
      text,
    });
    if (res.ok && res.room) {
      state.rooms[res.room.id] = res.room;
      current = res.room;
      render();
    }
  }

  async function award() {
    const gm = $("#awardGm").value;
    const tier = $("#awardTier").value;
    const err = $("#awardErr");
    if (!current) {
      if (err) err.textContent = "Select a test first.";
      return;
    }
    const res = await api("/tier", {
      player: current.player,
      gm,
      tier,
      tester: me ? me.name : "",
      room: current.id,
    });
    if (!res.ok) {
      if (err) err.textContent = res.error || "Could not set that tier.";
      return;
    }
    if (err) err.textContent = "";
    toast(`${current.player} is now ${gm.toUpperCase()} ${tier}`);
    await refresh();
  }

  async function finish() {
    const err = $("#awardErr");
    if (!current) {
      if (err) err.textContent = "Select a test first.";
      return;
    }
    const res = await api("/finish", { id: current.id, tester: me ? me.name : "" });
    if (!res.ok) {
      if (err) err.textContent = res.error || "Could not finish that test.";
      return;
    }
    if (err) err.textContent = "";
    toast("Test finished");
    await refresh();
  }

  /* ---------------------------------------------------------------- boot */

  async function refresh() {
    const res = await api("/state");
    if (res && res.ok) {
      setHubAvailable(true);
      state = { codes: res.codes || {}, rooms: res.rooms || {}, tiers: res.tiers || {}, profiles: res.profiles || {} };
      /* keep the open thread in sync with the hub */
      if (current && state.rooms[current.id]) current = state.rooms[current.id];
    } else {
      setHubAvailable(false);
    }
    render();
  }

  /** GitHub Pages / static hosts have no /api/tiertest/*. Show a clear
      message instead of an empty broken queue and stop polling. */
  let hubAvailable = true;
  function setHubAvailable(ok) {
    if (hubAvailable === ok) return;
    hubAvailable = ok;
    const banner = document.getElementById("staticBanner");
    if (ok) {
      if (banner) banner.remove();
      return;
    }
    /* stop the poll — a static host will never serve the hub */
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    const wrap = document.querySelector(".chat-layout");
    if (wrap) {
      const div = document.createElement("div");
      div.id = "staticBanner";
      div.innerHTML =
        '<div class="panel" style="border-color:#3b4d63;margin-bottom:12px;padding:18px 20px">' +
        '<div style="font-weight:800;letter-spacing:.02em;color:#f6e2a8;margin-bottom:6px">static deployment</div>' +
        '<div style="font-size:13.5px;color:#cbd5e1;line-height:1.6">الموقع حالياً static على GitHub Pages، فما فيه API endpoints. الترتيب، التايرات، البروفايلات وكل الصفحات تعمل كالمعتاد.</div>' +
        '<div style="font-size:13px;color:#9fb0c3;margin-top:8px;line-height:1.7">لتشغيل <b>الدردشة والكود والطابور</b> من داخل اللعبة تحتاج سيرفر Node يشغل <code>tools/serve.mjs</code>. أسهل خيار مجاني: <b>Render</b> — اقرأ تعليمات الملف README.md تحت عنوان "Host this repo for free on Render".</div>' +
        '</div>';
      wrap.parentNode.insertBefore(div, wrap);
    }
    const btn = document.getElementById("newChatBtn");
    if (btn) btn.setAttribute("disabled", "");
    const testerPanel = document.getElementById("testerPanel");
    if (testerPanel) testerPanel.hidden = true;
    const composer = document.getElementById("chatComposer");
    if (composer) composer.hidden = true;
    const thread = document.getElementById("chatThread");
    if (thread) {
      thread.innerHTML = `<div class="chat-empty">
        <div class="chat-empty-icon">💬</div>
        <h3>static deployment — البهائد مشتغل</h3>
        <p class="muted">هذا الموقع static، فالكود والطابور والدعم ما يشتغلون هنا. اللي يشتغل طبيعي: الترتيب، التايرات، البروفايلات، ورفع أي صورة. البرومبت الكامل نزّله حتى تنزل بعده سيرفر Node على أي منصة مجانية.</p>
      </div>`;
    }
  }

  function wire() {
    const newBtn = $("#newChatBtn");
    if (newBtn) newBtn.addEventListener("click", newChat);
    const codeSubmit = $("#codeSubmit");
    if (codeSubmit) codeSubmit.addEventListener("click", submitCode);
    const codeInput = $("#codeInput");
    if (codeInput) {
      codeInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submitCode();
        }
      });
    }
    const msgSend = $("#msgSend");
    if (msgSend) msgSend.addEventListener("click", send);
    const msgInput = $("#msgInput");
    if (msgInput) {
      msgInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          send();
        }
      });
    }
    const awardBtn = $("#awardBtn");
    if (awardBtn) awardBtn.addEventListener("click", award);
    const finishBtn = $("#finishBtn");
    if (finishBtn) finishBtn.addEventListener("click", finish);

    const gm = $("#awardGm");
    const tier = $("#awardTier");
    const gms = (window.MCT && MCT.gamemodes) || [];
    if (gm) gm.innerHTML = gms.map((g) => `<option value="${esc(g.id)}">${esc(g.full)}</option>`).join("");
    if (tier) tier.innerHTML = TIERS.map((t) => `<option value="${t}">${t}</option>`).join("");
  }

  function init() {
    me = session();
    wire();

    /* the plugin links /tiertest players to the chat with the code in the URL */
    let code = null;
    try {
      const url = new URL(location.href);
      code = (url.searchParams.get("code") || "").trim().toUpperCase();
      if (code) {
        url.searchParams.delete("code");
        history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    } catch (e) {
      code = null;
    }

    /* First refresh decides whether the hub exists (GitHub Pages = no /api). */
    refresh().then(() => {
      if (code && hubAvailable) openTierFlow(code);
      /* Only sync with the hub when the hub exists (not on GitHub Pages). */
      if (hubAvailable && window.MCTApp && typeof MCTApp.syncHub === "function") MCTApp.syncHub();
    });
    pollTimer = setInterval(refresh, 3000);
    window.addEventListener("beforeunload", () => pollTimer && clearInterval(pollTimer));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
