// ═══════════════════════════════════════════════════════════════
//  gangsters.js  –  GANG SYSTEM  (Logic, data, spawning, turf)
//
//  Owns:
//    GANG_DEFS, gangs[], gangKills
//    spawnGangster(), repopGangs(), updateGangSpawns(dt)
//    getTurfFaction(), isInGangTurf(), gangCountInZone()
//    resetGangs()
//
//  Does NOT handle: AI movement/shooting (ai.js), rendering (game.js)
//  Depends on: world.js, cops.js  →  load AFTER both
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── GANG FACTION DEFINITIONS ──────────────────────────────────
const GANG_DEFS = {
  east: {
    name: 'EAST SIDE CREW', zone: null,
    col: '#cc2200', glowCol: 'rgba(200,30,0,0.5)',
    hp: 45, maxHp: 45, spd: 75,
    cashDrop: 30, scoreWorth: 80, symbol: 'E',
  },
  west: {
    name: 'WEST BLOCK', zone: null,
    col: '#8800cc', glowCol: 'rgba(130,0,200,0.5)',
    hp: 50, maxHp: 50, spd: 70,
    cashDrop: 35, scoreWorth: 90, symbol: 'W',
  },
};
GANG_DEFS.east.zone = SPECIAL_ZONES.gangA;
GANG_DEFS.west.zone = SPECIAL_ZONES.gangB;

const GANG_TURF_ZONES = [SPECIAL_ZONES.gangA, SPECIAL_ZONES.gangB];

// ── ENTITY ARRAY ──────────────────────────────────────────────
const gangs = [];
let gangKills = 0;

// ── SPAWN CONSTANTS ───────────────────────────────────────────
const MAX_GANG_PER_ZONE = 8;

// ── SPAWN FUNCTIONS ───────────────────────────────────────────

function spawnGangster(x, y, faction) {
  if (!faction) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    faction = (tx >= SPECIAL_ZONES.gangA.x1 && tx < SPECIAL_ZONES.gangA.x2 &&
               ty >= SPECIAL_ZONES.gangA.y1 && ty < SPECIAL_ZONES.gangA.y2)
              ? 'east' : 'west';
  }
  const def = GANG_DEFS[faction] || GANG_DEFS.east;
  gangs.push({
    x, y, w: 11, h: 11,
    hp: def.hp, maxHp: def.maxHp, spd: def.spd,
    angle: 0, atkCd: 0, shootCd: 0,
    col: def.col, glowCol: def.glowCol,
    homeX: x, homeY: y, wanderT: 0,
    faction,
    cashDrop: def.cashDrop, scoreWorth: def.scoreWorth, symbol: def.symbol,
  });
}

function repopGangs() {
  for (const [faction, def] of Object.entries(GANG_DEFS)) {
    const z = def.zone;
    const inZone = gangs.filter(g => {
      const gx = Math.floor(g.x / T), gy = Math.floor(g.y / T);
      return gx >= z.x1 && gx < z.x2 && gy >= z.y1 && gy < z.y2;
    }).length;
    if (inZone >= MAX_GANG_PER_ZONE) continue;
    const toSpawn = Math.min(2, MAX_GANG_PER_ZONE - inZone);
    for (let i = 0; i < toSpawn; i++) {
      const tx = z.x1 + Math.floor(Math.random() * (z.x2 - z.x1));
      const ty = z.y1 + Math.floor(Math.random() * (z.y2 - z.y1));
      spawnGangster(tx * T + T / 2, ty * T + T / 2, faction);
    }
  }
}
repopGangs();

// ── SPAWN TICK ────────────────────────────────────────────────
let _gangSpawnT = 0;
function updateGangSpawns(dt) {
  _gangSpawnT += dt;
  if (_gangSpawnT > 8) { _gangSpawnT = 0; repopGangs(); }
}

// ── TURF QUERY HELPERS ────────────────────────────────────────

function getTurfFaction(tx, ty) {
  for (const [faction, def] of Object.entries(GANG_DEFS)) {
    const z = def.zone;
    if (tx >= z.x1 && tx < z.x2 && ty >= z.y1 && ty < z.y2) return faction;
  }
  return null;
}

function isInGangTurf(tx, ty, margin) {
  margin = margin || 0;
  for (const z of GANG_TURF_ZONES)
    if (tx >= z.x1 - margin && tx < z.x2 + margin &&
        ty >= z.y1 - margin && ty < z.y2 + margin) return true;
  return false;
}

function gangCountInZone(faction) {
  const z = GANG_DEFS[faction] && GANG_DEFS[faction].zone;
  if (!z) return 0;
  return gangs.filter(g => {
    const gx = Math.floor(g.x / T), gy = Math.floor(g.y / T);
    return gx >= z.x1 && gx < z.x2 && gy >= z.y1 && gy < z.y2;
  }).length;
}

// ── RESET ─────────────────────────────────────────────────────
function resetGangs() {
  gangs.length = 0;
  gangKills    = 0;
  _gangSpawnT  = 0;
  repopGangs();
}
