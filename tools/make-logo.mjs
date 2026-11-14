// Generates assets/logo.svg — the "MCTIERS" wordmark in the Minecraft style:
// "MC" is carved from a grass block, "TIERS" from a gold/amber block, both with
// a 3D extrusion, a hard outline and a drop shadow.
import fs from "node:fs";

const GLYPHS = {
  M: [
    "100000001",
    "110000011",
    "111000111",
    "111101111",
    "111111111",
    "110101011",
    "100111001",
    "100101001",
    "100000001",
  ],
  C: [
    "011111110",
    "110000011",
    "110000011",
    "100000001",
    "100000001",
    "100000001",
    "110000011",
    "110000011",
    "011111110",
  ],
  T: [
    "111111111",
    "111111111",
    "000010000",
    "000010000",
    "000010000",
    "000010000",
    "000010000",
    "000010000",
    "000010000",
  ],
  I: [
    "111111111",
    "000010000",
    "000010000",
    "000010000",
    "000010000",
    "000010000",
    "000010000",
    "000010000",
    "111111111",
  ],
  E: [
    "111111111",
    "100000001",
    "100000001",
    "100000001",
    "111111100",
    "100000001",
    "100000001",
    "100000001",
    "111111111",
  ],
  R: [
    "111111100",
    "110000110",
    "110000110",
    "111111100",
    "110110000",
    "110011000",
    "110001100",
    "110001100",
    "110000110",
  ],
  S: [
    "011111110",
    "110000011",
    "110000000",
    "011111100",
    "000001100",
    "000000011",
    "110000011",
    "110000011",
    "011111100",
  ],
};

const WORD = "MCTIERS";
const W = 9;
const H = 9;
const GAP = 1;
const COLS = WORD.length * (W + GAP) - GAP;
const PAD = 2;
const DEPTH = 3; // 3D extrusion, in pixels

// ------------------------------------------------------------------ helpers

const px = (x, y) => ({ x: x + PAD, y: y + PAD });

function isOn(x, y) {
  if (y < 0 || y >= H) return false;
  const gi = Math.floor(x / (W + GAP));
  if (gi < 0 || gi >= WORD.length) return false;
  const lx = x - gi * (W + GAP);
  if (lx < 0 || lx >= W) return false;
  const g = GLYPHS[WORD[gi]];
  return g[y][lx] === "1";
}

function letterIndexAt(x) {
  const gi = Math.floor(x / (W + GAP));
  if (gi < 0 || gi >= WORD.length) return -1;
  const lx = x - gi * (W + GAP);
  return lx >= W ? -1 : gi;
}

// Deterministic pseudo-random so the texture never changes between runs.
function hash(n) {
  let h = 2166136261;
  h ^= n * 2654435761;
  h = Math.imul(h, 16777619);
  return (h >>> 0) / 4294967296;
}

const rects = (list, fill, extra) =>
  list.map((p) => `<rect x="${p.x}" y="${p.y}" width="1.02" height="1.02"${extra || ""}/>`).join("");

// ------------------------------------------------------------------- layers

let shadow = "";
let grass = "";
let dirt = "";
let grassDark = "";
let dirtDark = "";
let gold = "";
let goldDark = [];
let outline = [];

const solids = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < COLS; x++) {
    if (isOn(x, y)) solids.push({ x, y });
  }
}

// 3D extrusion + drop shadow, drawn from the whole silhouette.
for (const p of solids) {
  const q = px(p.x, p.y);
  shadow += `<rect x="${q.x + DEPTH}" y="${q.y + DEPTH}" width="1.02" height="1.02"/>`;
}

// Per-letter colouring: M and C are grass blocks, T I E R S are gold blocks.
for (const p of solids) {
  const q = px(p.x, p.y);
  const gi = letterIndexAt(p.x);
  const isGrassLetter = gi < 2; // M, C

  if (isGrassLetter) {
    // Grass sits on the top of the letter, dirt underneath, with a ragged
    // boundary and a few grass drips running down.
    const edge = 4 + (p.x % 4 === 0 ? 1 : 0);
    if (p.y < edge) {
      grass += `<rect x="${q.x}" y="${q.y}" width="1.02" height="1.02"/>`;
    } else {
      if (p.y === edge && hash(p.x * 31 + p.y * 7) > 0.45) {
        grass += `<rect x="${q.x}" y="${q.y}" width="1.02" height="1.02"/>`;
      } else {
        dirt += `<rect x="${q.x}" y="${q.y}" width="1.02" height="1.02"/>`;
        if (hash(p.x * 17 + p.y * 13) > 0.74) {
          dirtDark += `<rect x="${q.x}" y="${q.y}" width="1.02" height="1.02"/>`;
        }
      }
    }
    if (p.y === 0 && hash(p.x * 3) > 0.5) {
      grassDark += `<rect x="${q.x}" y="${q.y}" width="1.02" height="1.02"/>`;
    }
  } else {
    gold += `<rect x="${q.x}" y="${q.y}" width="1.02" height="1.02"/>`;
    // Bottom row darkens into a deep red-brown like the real wordmark.
    if (p.y >= H - 1) goldDark.push(q);
  }
}

// Hard outline around the whole word.
for (let y = -1; y <= H; y++) {
  for (let x = -1; x <= COLS; x++) {
    if (isOn(x, y)) continue;
    const near =
      isOn(x - 1, y) || isOn(x + 1, y) || isOn(x, y - 1) || isOn(x, y + 1) ||
      isOn(x - 1, y - 1) || isOn(x + 1, y - 1) || isOn(x - 1, y + 1) || isOn(x + 1, y + 1);
    if (near) {
      const q = px(x, y);
      outline.push(q);
    }
  }
}

const vw = COLS + PAD * 2 + DEPTH;
const vh = H + PAD * 2 + DEPTH;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" shape-rendering="crispEdges" role="img" aria-label="MCTiers">
<defs>
  <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8fd14f"/>
    <stop offset="0.55" stop-color="#6fb331"/>
    <stop offset="1" stop-color="#4f8b21"/>
  </linearGradient>
  <linearGradient id="dirt" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#a9703c"/>
    <stop offset="0.5" stop-color="#8b5a2b"/>
    <stop offset="1" stop-color="#63401c"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fdf3d2"/>
    <stop offset="0.2" stop-color="#f8e3a6"/>
    <stop offset="0.46" stop-color="#eec267"/>
    <stop offset="0.68" stop-color="#dd9a37"/>
    <stop offset="0.86" stop-color="#c06f22"/>
    <stop offset="1" stop-color="#9c3f16"/>
  </linearGradient>
  <linearGradient id="goldDeep" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#a8451a"/>
    <stop offset="1" stop-color="#6d220f"/>
  </linearGradient>
  <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#4a3218"/>
    <stop offset="1" stop-color="#2a1b0c"/>
  </linearGradient>
</defs>
<g fill="#000" opacity=".38">${shadow}</g>
<g fill="url(#edge)">${rects(outline)}</g>
<g fill="url(#dirt)">${dirt}</g>
<g fill="#5c3a19" opacity=".55">${dirtDark}</g>
<g fill="url(#grass)">${grass}</g>
<g fill="#4f8b21" opacity=".5">${grassDark}</g>
<g fill="url(#gold)">${gold}</g>
<g fill="url(#goldDeep)">${rects(goldDark)}</g>
</svg>
`;

fs.mkdirSync("assets", { recursive: true });
fs.writeFileSync("assets/logo.svg", svg);
console.log("wrote assets/logo.svg", vw + "x" + vh);
