/* Static reference data. The roster lives in localStorage and is managed by the admin.
   "roster" is the demo roster that is seeded the first time the site runs with no
   player accounts yet — the admin can re-seed it from the admin panel. */
window.MCT = {
  "site": "MCTiers",
  "points": { "HT1": 60, "LT1": 45, "HT2": 30, "LT2": 20, "HT3": 10, "LT3": 6, "HT4": 4, "LT4": 3, "HT5": 2, "LT5": 1 },
  "titles": [
    { "name": "Rookie", "min": 0 },
    { "name": "Combat Novice", "min": 10 },
    { "name": "Combat Cadet", "min": 20 },
    { "name": "Combat Specialist", "min": 50 },
    { "name": "Combat Ace", "min": 100 },
    { "name": "Combat Master", "min": 250 },
    { "name": "Combat Grandmaster", "min": 400 }
  ],
  "regions": {
    "NA": "North America", "EU": "Europe", "AS": "Asia", "SA": "South America",
    "OC": "Oceania", "AU": "Australia", "ME": "Middle East", "AF": "Africa"
  },
  "gamemodes": [
    { "id": "vanilla", "name": "Vanilla", "full": "Vanilla (Crystal PvP)", "icon": "vanilla", "blurb": "Crystal PvP" },
    { "id": "uhc", "name": "UHC", "full": "UHC (Ultra Hardcore)", "icon": "uhc", "blurb": "Golden apple duels" },
    { "id": "pot", "name": "Pot", "full": "Pot (Potion PvP)", "icon": "pot", "blurb": "Potion PvP" },
    { "id": "nethop", "name": "NethOP", "full": "NethOP (Netherite OP)", "icon": "nethop", "blurb": "Netherite OP" },
    { "id": "smp", "name": "SMP", "full": "SMP", "icon": "smp", "blurb": "Survival PvP" },
    { "id": "sword", "name": "Sword", "full": "Sword", "icon": "sword", "blurb": "Sword duels" },
    { "id": "axe", "name": "Axe", "full": "Axe", "icon": "axe", "blurb": "Axe duels" },
    { "id": "mace", "name": "Mace", "full": "Mace", "icon": "mace", "blurb": "Mace PvP" }
  ],
  "roster": [
    {
      "name": "Technoblade", "region": "NA", "skin": "Technoblade",
      "bio": "Speedrunner turned sword specialist. Holds the record for most consecutive sword duel wins on the ladder and never loses the same crystal fight twice.",
      "tiers": { "vanilla": "HT2", "uhc": "HT1", "pot": "HT2", "nethop": "HT1", "smp": "HT2", "sword": "HT1", "axe": "HT1", "mace": "HT1" },
      "since": { "vanilla": "Jan 12, 2026", "sword": "Jan 12, 2026", "axe": "Feb 3, 2026", "mace": "Mar 18, 2026" }
    },
    {
      "name": "Dream", "region": "NA", "skin": "Dream",
      "bio": "The original crystal PvP champion. Plays slow, builds traps everywhere and turns every 1v1 into a mind game before the first hit lands.",
      "tiers": { "vanilla": "HT1", "uhc": "HT1", "pot": "HT1", "nethop": "HT2", "smp": "HT2", "sword": "HT1", "axe": "HT1", "mace": "HT2" },
      "since": { "vanilla": "Jan 10, 2026", "sword": "Jan 10, 2026", "pot": "Feb 21, 2026" }
    },
    {
      "name": "TommyInnit", "region": "EU", "skin": "TommyInnit",
      "bio": "Two-time world champion who plays the game loud and fast. Best known for closing out a fight in the first five seconds.",
      "tiers": { "vanilla": "HT1", "uhc": "HT2", "pot": "HT1", "nethop": "HT1", "smp": "HT1", "sword": "HT2", "axe": "HT2", "mace": "HT2" },
      "since": { "vanilla": "Jan 18, 2026", "smp": "Jan 18, 2026", "pot": "Mar 2, 2026" }
    },
    {
      "name": "GeorgeNotFound", "region": "OC", "skin": "GeorgeNotFound",
      "bio": "Content king with the fastest click on the server. Makes impossible angles look like beginner luck.",
      "tiers": { "vanilla": "HT2", "uhc": "HT2", "pot": "HT2", "nethop": "HT1", "smp": "HT2", "sword": "HT2", "axe": "HT2", "mace": "HT3" },
      "since": { "vanilla": "Feb 4, 2026", "sword": "Feb 4, 2026", "nethop": "Apr 9, 2026" }
    },
    {
      "name": "Sapnap", "region": "NA", "skin": "Sapnap",
      "bio": "Chaos agent and survival PvP specialist. Wins by making the whole arena move the way he wants it to.",
      "tiers": { "vanilla": "HT2", "uhc": "HT3", "pot": "HT3", "nethop": "HT2", "smp": "HT1", "sword": "HT2", "axe": "HT3", "mace": "HT3" },
      "since": { "smp": "Jan 22, 2026", "sword": "Mar 11, 2026" }
    },
    {
      "name": "Quackity", "region": "NA", "skin": "Quackity",
      "bio": "Former Minecraft champion and tournament organiser. The swords are sharp and so is the mind behind the bracket.",
      "tiers": { "vanilla": "HT2", "uhc": "HT2", "pot": "HT2", "nethop": "HT2", "smp": "HT2", "sword": "HT2", "axe": "HT3", "mace": "HT3" },
      "since": { "sword": "Feb 11, 2026", "vanilla": "Feb 11, 2026" }
    },
    {
      "name": "Fundy", "region": "NA", "skin": "Fundy",
      "bio": "Creative builder who plays survival PvP like a raid. Reads terrain better than anyone on the ladder.",
      "tiers": { "vanilla": "HT3", "uhc": "HT2", "pot": "HT3", "nethop": "HT3", "smp": "HT2", "sword": "HT3", "axe": "HT2", "mace": "HT4" },
      "since": { "smp": "Feb 19, 2026", "axe": "Apr 2, 2026" }
    },
    {
      "name": "Copse", "region": "NA", "skin": "Copse",
      "bio": "Minecraft's resident chef and a terrifying potion duellist. The potions are always pre-mixed.",
      "tiers": { "vanilla": "HT3", "uhc": "HT2", "pot": "HT1", "nethop": "HT3", "smp": "HT3", "sword": "HT3", "axe": "HT3", "mace": "HT4" },
      "since": { "pot": "Mar 6, 2026" }
    },
    {
      "name": "Vechs", "region": "NA", "skin": "Vechs",
      "bio": "Super hostile veteran. Fills the inventory with traps and never takes a hit without taking one back.",
      "tiers": { "vanilla": "HT3", "uhc": "HT3", "pot": "HT3", "nethop": "HT2", "smp": "HT2", "sword": "HT3", "axe": "HT3", "mace": "HT3" },
      "since": { "smp": "Mar 14, 2026", "nethop": "May 1, 2026" }
    },
    {
      "name": "Etho", "region": "NA", "skin": "Etho",
      "bio": "SMP raid leader with a decade of muscle memory. Bow arcs and axe timing are unmatched.",
      "tiers": { "vanilla": "HT4", "uhc": "HT3", "pot": "HT3", "nethop": "HT3", "smp": "HT2", "sword": "HT3", "axe": "HT2", "mace": "HT3" },
      "since": { "axe": "Mar 22, 2026", "smp": "May 8, 2026" }
    },
    {
      "name": "ilMango", "region": "EU", "skin": "ilMango",
      "bio": "European crystal player with the cleanest crosshair placement in the game.",
      "tiers": { "vanilla": "HT1", "uhc": "HT2", "pot": "HT2", "nethop": "HT2", "smp": "HT3", "sword": "HT1", "axe": "HT2", "mace": "HT2" },
      "since": { "vanilla": "Apr 7, 2026", "sword": "Apr 7, 2026" }
    },
    {
      "name": "Smajor", "region": "NA", "skin": "Smajor",
      "bio": "Sword main with the biggest community on the server. Duel requests everyone, wins more than half.",
      "tiers": { "vanilla": "HT3", "uhc": "HT3", "pot": "HT3", "nethop": "HT3", "smp": "HT3", "sword": "HT2", "axe": "HT3", "mace": "HT3" },
      "since": { "sword": "Apr 15, 2026" }
    },
    {
      "name": "Shubble", "region": "NA", "skin": "Shubble",
      "bio": "Canadian duellist known for the most unhinged item timings in high level Minecraft PvP.",
      "tiers": { "vanilla": "HT3", "uhc": "HT3", "pot": "HT2", "nethop": "HT4", "smp": "HT3", "sword": "HT2", "axe": "HT3", "mace": "HT4" },
      "since": { "sword": "Apr 24, 2026", "pot": "May 12, 2026" }
    },
    {
      "name": "Smallishbeans", "region": "NA", "skin": "Smallishbeans",
      "bio": "Bedrock side legend who took the Java ladder apart before anyone knew his name.",
      "tiers": { "vanilla": "HT2", "uhc": "HT3", "pot": "HT3", "nethop": "HT3", "smp": "HT3", "sword": "HT2", "axe": "HT4", "mace": "HT3" },
      "since": { "vanilla": "May 3, 2026" }
    },
    {
      "name": "Philza", "region": "EU", "skin": "Philza",
      "bio": "Hardcore legend who survived a thousand days of Minecraft and brought the PvP with him.",
      "tiers": { "vanilla": "HT3", "uhc": "HT3", "pot": "HT4", "nethop": "HT4", "smp": "HT2", "sword": "HT3", "axe": "HT3", "mace": "HT4" },
      "since": { "smp": "May 11, 2026" }
    },
    {
      "name": "Wisp", "region": "AS", "skin": "Wisp",
      "bio": "Mechanic, miner and a terrifying close range fighter once the axe comes up.",
      "tiers": { "vanilla": "HT4", "uhc": "HT4", "pot": "HT3", "nethop": "HT3", "smp": "HT3", "sword": "HT4", "axe": "HT3", "mace": "HT3" },
      "since": { "axe": "May 19, 2026" }
    },
    {
      "name": "Tarik", "region": "ME", "skin": "Tarik",
      "bio": "Middle Eastern server regular who grinds the ladder every night after work.",
      "tiers": { "vanilla": "LT1", "uhc": "HT3", "pot": "HT3", "nethop": "HT4", "smp": "HT3", "sword": "HT3", "axe": "HT4", "mace": "HT3" },
      "since": { "uhc": "May 27, 2026" }
    },
    {
      "name": "Cubito", "region": "SA", "skin": "Cubito",
      "bio": "South American crystal grinder with the most consistent late game on the server.",
      "tiers": { "vanilla": "LT1", "uhc": "HT3", "pot": "HT4", "nethop": "HT4", "smp": "HT4", "sword": "HT3", "axe": "HT4", "mace": "HT4" },
      "since": { "vanilla": "Jun 4, 2026" }
    },
    {
      "name": "Jax", "region": "AF", "skin": "Jax",
      "bio": "Northern African duellist, first African player to reach Combat Master.",
      "tiers": { "vanilla": "LT1", "uhc": "HT4", "pot": "HT4", "nethop": "HT4", "smp": "HT4", "sword": "HT3", "axe": "HT5", "mace": "HT4" },
      "since": { "vanilla": "Jun 12, 2026" }
    },
    {
      "name": "Koda", "region": "AU", "skin": "Koda",
      "bio": "Australian pot PvP specialist. Brings a full brewing stand to every duel.",
      "tiers": { "vanilla": "LT2", "uhc": "HT4", "pot": "HT3", "nethop": "HT4", "smp": "HT4", "sword": "HT4", "axe": "HT5", "mace": "LT1" },
      "since": { "pot": "Jun 20, 2026" }
    },
    {
      "name": "Rei", "region": "AS", "skin": "Rei",
      "bio": "Asian mace main who started duelling on the server last season and already scares everyone.",
      "tiers": { "vanilla": "LT2", "uhc": "HT4", "pot": "LT1", "nethop": "HT4", "smp": "HT4", "sword": "HT4", "axe": "HT5", "mace": "HT3" },
      "since": { "mace": "Jun 28, 2026" }
    }
  ],
  "players": {},
  "overall": [],
  "totalRanked": 0
};
