// Writes the static reference data used by the site: gamemodes, points, titles.
// The roster is empty — players are created locally and ranked by the admin.
import fs from "node:fs";
import path from "node:path";

const GAMEMODES = [
  { id: "vanilla", name: "Vanilla", full: "Vanilla (Crystal PvP)", icon: "vanilla", blurb: "Crystal PvP" },
  { id: "uhc", name: "UHC", full: "UHC (Ultra Hardcore)", icon: "uhc", blurb: "Golden apple duels" },
  { id: "pot", name: "Pot", full: "Pot (Potion PvP)", icon: "pot", blurb: "Potion PvP" },
  { id: "nethop", name: "NethOP", full: "NethOP (Netherite OP)", icon: "nethop", blurb: "Netherite OP" },
  { id: "smp", name: "SMP", full: "SMP", icon: "smp", blurb: "Survival PvP" },
  { id: "sword", name: "Sword", full: "Sword", icon: "sword", blurb: "Sword duels" },
  { id: "axe", name: "Axe", full: "Axe", icon: "axe", blurb: "Axe duels" },
  { id: "mace", name: "Mace", full: "Mace", icon: "mace", blurb: "Mace PvP" },
];

const POINTS = {
  HT1: 60, LT1: 45, HT2: 30, LT2: 20, HT3: 10,
  LT3: 6, HT4: 4, LT4: 3, HT5: 2, LT5: 1,
};

const TITLES = [
  { name: "Rookie", min: 0 },
  { name: "Combat Novice", min: 10 },
  { name: "Combat Cadet", min: 20 },
  { name: "Combat Specialist", min: 50 },
  { name: "Combat Ace", min: 100 },
  { name: "Combat Master", min: 250 },
  { name: "Combat Grandmaster", min: 400 },
];

const REGIONS = {
  NA: "North America", EU: "Europe", AS: "Asia", SA: "South America",
  OC: "Oceania", AU: "Australia", ME: "Middle East", AF: "Africa",
};

const data = {
  site: "MCTiers",
  points: POINTS,
  titles: TITLES,
  regions: REGIONS,
  gamemodes: GAMEMODES,
  players: {},
  overall: [],
  totalRanked: 0,
};

const out = path.join(process.cwd(), "assets", "js", "data.js");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  "/* Static reference data. The roster lives in localStorage and is managed by the admin. */\nwindow.MCT = " +
    JSON.stringify(data, null, 0) +
    ";\n"
);
console.log("wrote", out, "- empty roster,", GAMEMODES.length, "gamemodes");
