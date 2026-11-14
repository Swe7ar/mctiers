/* ==========================================================================
   Tier-test hub — the bridge between the Minecraft plugin and the website.

   The site itself is static and stores its roster in localStorage, so this
   small local API is the only shared place where a test request, its chat
   thread and the resulting tier can live. It ships with tools/serve.mjs and
   writes to data/tiertest.json.

   Endpoints (all JSON):

     POST /api/tiertest/code     { code, player, uuid }   plugin issues a code
     GET  /api/tiertest/pending                            plugin polls its codes
     GET  /api/tiertest/state                             site reads everything
     POST /api/tiertest/claim   { code, tester }          site verifies a code
     GET  /api/tiertest/room?id=                           site reads one thread
     POST /api/tiertest/message{ id, from, role, text }   site posts a message
     POST /api/tiertest/tier    { player, gm, tier, tester }
     POST /api/tiertest/finish  { id, tester }
     POST /api/tiertest/profile { player, bio, skin, skinTexture, skinColors }
     GET  /api/tiertest/result?player=                    plugin reads tiers

   Plugin-facing endpoints require the shared token (x-tier-token header).
   Website-facing endpoints are open because the server only listens on
   localhost — the same machine runs the browser and the game client.
   ========================================================================== */
import fs from "node:fs";
import path from "node:path";

const EMPTY = {
  codes: {},
  rooms: {},
  tiers: {},
  profiles: {},
};

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createHub(root, opts = {}) {
  const dir = path.join(root, "data");
  const file = path.join(dir, "tiertest.json");
  const token = opts.token || process.env.TIERHUB_TOKEN || "mctiers-local";

  function load() {
    try {
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw);
      return Object.assign({}, EMPTY, parsed);
    } catch (e) {
      return JSON.parse(JSON.stringify(EMPTY));
    }
  }

  function save(data) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      return true;
    } catch (e) {
      console.error("[hub] could not save:", e.message);
      return false;
    }
  }

  function json(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-tier-token",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    res.end(text);
  }

  function readBody(req) {
    return new Promise((resolve) => {
      let raw = "";
      req.on("data", (c) => {
        raw += c;
        if (raw.length > 2e6) req.destroy();
      });
      req.on("end", () => {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch (e) {
          resolve({});
        }
      });
      req.on("error", () => resolve({}));
    });
  }

  function isTester(name) {
    /* The hub cannot read the browser roster, so the site tells us who the
       testers are. Anyone the site marks as a tester may run a test. */
    const data = load();
    const rec = data.tiers && data.tiers[name];
    return !!(rec && rec.__tester);
  }

  async function handle(req, res) {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/")) return false;

    if (req.method === "OPTIONS") {
      json(res, 204, {});
      return true;
    }

    const route = url.pathname.replace("/api/tiertest", "") || "/";
    const body = req.method === "POST" ? await readBody(req) : {};
    const query = Object.fromEntries(url.searchParams.entries());
    const data = load();

    /* --- plugin only: requires the shared token --- */
    if (route === "/code" && req.method === "POST") {
      if (req.headers["x-tier-token"] !== token) {
        json(res, 401, { ok: false, error: "bad token" });
        return true;
      }
      const code = String(body.code || "").toUpperCase();
      if (!code) {
        json(res, 400, { ok: false, error: "missing code" });
        return true;
      }
      data.codes[code] = {
        code,
        player: String(body.player || "Unknown"),
        uuid: String(body.uuid || ""),
        status: "pending",
        tester: null,
        room: null,
        createdAt: Date.now(),
      };
      save(data);
      json(res, 200, { ok: true, code });
      return true;
    }

    if (route === "/pending" && req.method === "GET") {
      if (req.headers["x-tier-token"] !== token) {
        json(res, 401, { ok: false, error: "bad token" });
        return true;
      }
      const codes = Object.values(data.codes)
        .filter((c) => c.status !== "done" && c.status !== "expired")
        .sort((a, b) => a.createdAt - b.createdAt);
      json(res, 200, { ok: true, codes });
      return true;
    }

    /* --- shared read for both sides --- */
    if (route === "/state" && req.method === "GET") {
      json(res, 200, {
        ok: true,
        codes: data.codes,
        rooms: data.rooms,
        tiers: data.tiers,
        profiles: data.profiles,
        token,
      });
      return true;
    }

    if (route === "/result" && req.method === "GET") {
      const player = String(query.player || "");
      json(res, 200, { ok: true, tiers: data.tiers[player] || {} });
      return true;
    }

    /* --- site: the player joins their own request with their code --- */
    if (route === "/join" && req.method === "POST") {
      const code = String(body.code || "").toUpperCase().trim();
      const who = String(body.player || "").trim();
      const rec = data.codes[code];
      if (!rec) {
        json(res, 404, { ok: false, error: "That code does not exist. Run /tiertest in game and try again." });
        return true;
      }
      if (rec.status === "done") {
        json(res, 409, { ok: false, error: "That test is already finished." });
        return true;
      }
      if (who && rec.player.toLowerCase() !== who.toLowerCase()) {
        json(res, 403, { ok: false, error: "That code belongs to another player." });
        return true;
      }
      /* already joined? return the same thread */
      if (rec.room && data.rooms[rec.room]) {
        json(res, 200, { ok: true, room: data.rooms[rec.room] });
        return true;
      }
      const room = {
        id: newId("room"),
        kind: "tier",
        code,
        player: rec.player,
        uuid: rec.uuid,
        tester: null,
        status: "open",
        messages: [
          {
            from: "system",
            role: "system",
            text: `${rec.player} joined with code ${code}. Waiting for a tester to pick this up.`,
            at: Date.now(),
          },
        ],
        tiers: {},
        createdAt: Date.now(),
      };
      data.rooms[room.id] = room;
      rec.room = room.id;
      rec.status = "joined";
      save(data);
      json(res, 200, { ok: true, room });
      return true;
    }

    /* --- site: a tester takes an open request --- */
    if (route === "/claim" && req.method === "POST") {
      const code = String(body.code || "").toUpperCase().trim();
      const tester = String(body.tester || "").trim();
      const rec = data.codes[code];
      if (!rec) {
        json(res, 404, { ok: false, error: "That code does not exist. Run /tiertest in game and try again." });
        return true;
      }
      if (rec.status === "done") {
        json(res, 409, { ok: false, error: "That test is already finished." });
        return true;
      }
      if (rec.status === "claimed" && rec.tester !== tester) {
        json(res, 409, { ok: false, error: "Another tester already took this request." });
        return true;
      }
      if (!tester) {
        json(res, 400, { ok: false, error: "You need an account to become a tester." });
        return true;
      }
      if (!isTester(tester)) {
        json(res, 403, { ok: false, error: "Only testers can take a test." });
        return true;
      }
      /* A tester can never run a test on themselves. */
      if (rec.player.toLowerCase() === tester.toLowerCase()) {
        json(res, 403, { ok: false, error: "You cannot run a test on yourself." });
        return true;
      }
      let room = rec.room ? data.rooms[rec.room] : null;
      if (!room) {
        room = {
          id: newId("room"),
          kind: "tier",
          code,
          player: rec.player,
          uuid: rec.uuid,
          tester,
          status: "open",
          messages: [
            {
              from: "system",
              role: "system",
              text: `${rec.player} joined with code ${code}. ${tester} is the tester for this test.`,
              at: Date.now(),
            },
          ],
          tiers: {},
          createdAt: Date.now(),
        };
        data.rooms[room.id] = room;
        rec.room = room.id;
      }
      room.tester = tester;
      rec.status = "claimed";
      rec.tester = tester;
      save(data);
      json(res, 200, { ok: true, room });
      return true;
    }

    if (route === "/room" && req.method === "GET") {
      const room = data.rooms[String(query.id || "")];
      if (!room) {
        json(res, 404, { ok: false, error: "no room" });
        return true;
      }
      json(res, 200, { ok: true, room });
      return true;
    }

    if (route === "/message" && req.method === "POST") {
      const room = data.rooms[String(body.id || "")];
      if (!room) {
        json(res, 404, { ok: false, error: "no room" });
        return true;
      }
      const text = String(body.text || "").slice(0, 600);
      if (!text.trim()) {
        json(res, 400, { ok: false, error: "empty message" });
        return true;
      }
      room.messages.push({
        from: String(body.from || "anon"),
        role: String(body.role || "player"),
        text,
        at: Date.now(),
      });
      if (room.messages.length > 300) room.messages.splice(0, room.messages.length - 300);
      save(data);
      json(res, 200, { ok: true, room });
      return true;
    }

    /* --- site: the tester awards the tier --- */
    if (route === "/tier" && req.method === "POST") {
      const player = String(body.player || "").trim();
      const gm = String(body.gm || "").trim();
      const tier = String(body.tier || "").trim().toUpperCase();
      const tester = String(body.tester || "").trim();
      if (!player || !gm || !tier) {
        json(res, 400, { ok: false, error: "player, gm and tier are required" });
        return true;
      }
      /* A tester can never set their own tier. */
      if (player.toLowerCase() === tester.toLowerCase()) {
        json(res, 403, { ok: false, error: "You cannot set your own tier." });
        return true;
      }
      if (!isTester(tester)) {
        json(res, 403, { ok: false, error: "Only testers can award tiers." });
        return true;
      }
      data.tiers[player] = data.tiers[player] || {};
      data.tiers[player][gm] = tier;
      if (body.since) data.tiers[player][gm + "_since"] = String(body.since);
      const room = data.rooms[String(body.room || "")];
      if (room) {
        room.tiers[gm] = tier;
        room.messages.push({
          from: tester,
          role: "tester",
          text: `Set ${gm.toUpperCase()} to ${tier}.`,
          at: Date.now(),
        });
      }
      save(data);
      json(res, 200, { ok: true, tiers: data.tiers[player] });
      return true;
    }

    /* --- site: push the whole roster to the hub at once --- */
    if (route === "/bulk" && req.method === "POST") {
      const tiers = body.tiers && typeof body.tiers === "object" ? body.tiers : {};
      const profiles = body.profiles && typeof body.profiles === "object" ? body.profiles : {};
      Object.keys(tiers).forEach((name) => {
        const rec = tiers[name];
        if (!rec || typeof rec !== "object") return;
        data.tiers[name] = data.tiers[name] || {};
        Object.keys(rec).forEach((gm) => {
          if (gm === "__tester") return;
          if (gm.endsWith("_since")) {
            if (rec[gm]) data.tiers[name][gm] = rec[gm];
            return;
          }
          const t = rec[gm];
          if (t) data.tiers[name][gm] = String(t).toUpperCase();
          else delete data.tiers[name][gm];
        });
      });
      Object.keys(profiles).forEach((name) => {
        const rec = profiles[name];
        if (!rec || typeof rec !== "object") return;
        const existing = data.profiles[name] || {};
        ["bio", "skin", "skinTexture", "skinColors", "banner", "wallpaper"].forEach((key) => {
          if (rec[key] !== undefined) existing[key] = rec[key];
        });
        data.profiles[name] = existing;
      });
      save(data);
      json(res, 200, { ok: true, names: Object.keys(data.tiers).length });
      return true;
    }

    /* --- site: the admin panel edits a tier directly --- */
    if (route === "/admin-tier" && req.method === "POST") {
      const player = String(body.player || "").trim();
      const gm = String(body.gm || "").trim();
      const tier = String(body.tier ?? "").trim().toUpperCase();
      if (!player || !gm) {
        json(res, 400, { ok: false, error: "player and gm are required" });
        return true;
      }
      data.tiers[player] = data.tiers[player] || {};
      if (!tier) {
        /* empty tier = delete */
        delete data.tiers[player][gm];
        delete data.tiers[player][gm + "_since"];
      } else {
        data.tiers[player][gm] = tier;
        if (body.since) data.tiers[player][gm + "_since"] = String(body.since);
      }
      save(data);
      json(res, 200, { ok: true, tiers: data.tiers[player] });
      return true;
    }

    /* --- site: the admin edits a player's picture / description --- */
    if (route === "/profile" && req.method === "POST") {
      const player = String(body.player || "").trim();
      if (!player) {
        json(res, 400, { ok: false, error: "player is required" });
        return true;
      }
      const rec = data.profiles[player] || {};
      if (body.bio !== undefined) rec.bio = String(body.bio).slice(0, 400);
      if (body.skin !== undefined) rec.skin = body.skin;
      if (body.skinTexture !== undefined) rec.skinTexture = body.skinTexture;
      if (body.skinColors !== undefined) rec.skinColors = body.skinColors;
      if (body.banner !== undefined) rec.banner = body.banner;
      if (body.wallpaper !== undefined) rec.wallpaper = body.wallpaper;
      data.profiles[player] = rec;
      save(data);
      json(res, 200, { ok: true, profile: rec });
      return true;
    }

    /* --- tester flag: the site tells the hub who may run tests --- */
    if (route === "/tester" && req.method === "POST") {
      const name = String(body.name || "").trim();
      if (!name) {
        json(res, 400, { ok: false, error: "name is required" });
        return true;
      }
      const rec = data.tiers[name] || {};
      rec.__tester = body.value === false ? undefined : true;
      if (rec.__tester === undefined) delete rec.__tester;
      data.tiers[name] = rec;
      save(data);
      json(res, 200, { ok: true, name, tester: !!rec.__tester });
      return true;
    }

    if (route === "/finish" && req.method === "POST") {
      const room = data.rooms[String(body.id || "")];
      if (!room) {
        json(res, 404, { ok: false, error: "no room" });
        return true;
      }
      const tester = String(body.tester || "");
      if (room.tester && room.tester !== tester) {
        json(res, 403, { ok: false, error: "Only the assigned tester can finish this test." });
        return true;
      }
      room.status = "done";
      room.messages.push({
        from: tester || "system",
        role: "tester",
        text: "Test finished. The tier is now live on the leaderboard.",
        at: Date.now(),
      });
      const rec = data.codes[room.code];
      if (rec) rec.status = "done";
      save(data);
      json(res, 200, { ok: true, room });
      return true;
    }

    json(res, 404, { ok: false, error: "unknown endpoint" });
    return true;
  }

  return { handle, token, file };
}
