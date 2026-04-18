// ═══════════════════════════════════════════════════════════════
//  cops.js  –  COP SYSTEM  (Logic, data, spawning, HQ, raids)
//
//  Owns:
//    COP_GRADES, cops[], pcars[]
//    mkPoliceCar(), spawnCop(), repopCopHQ(), launchRaid()
//    snapToRoad(), safePatrolPt(), randRoadPt(), raidPt()
//    isTileInGangZone(), GANG_ZONES_AVOID, GANG_AVOID_MARGIN
//    updateCopSpawns(dt), resetCops()
//    addWanted(), WANTED_DECAY_TIME
//
//  Does NOT handle: AI movement/shooting (ai.js), rendering (game.js)
//  Depends on: world.js  →  load cops.js AFTER world.js
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── COP GRADES ────────────────────────────────────────────────
const COP_GRADES = [
  { name:'PATROL',    col:'#1a55cc', trim:'#88aaff', hp:50,  maxHp:50,  spd:88,  dmg:10, shootCd:1.1, atkDmg:8,  reward:200, w:11, h:11, hasCar:true,  carMinWanted:0  },
  { name:'SERGEANT',  col:'#1a3a99', trim:'#5577ee', hp:80,  maxHp:80,  spd:95,  dmg:14, shootCd:0.9, atkDmg:11, reward:350, w:12, h:12, hasCar:true,  carMinWanted:2  },
  { name:'DETECTIVE', col:'#3a2a55', trim:'#9988cc', hp:70,  maxHp:70,  spd:100, dmg:16, shootCd:0.8, atkDmg:13, reward:400, w:11, h:11, hasCar:false, carMinWanted:99 },
  { name:'SWAT',      col:'#111111', trim:'#444444', hp:130, maxHp:130, spd:82,  dmg:22, shootCd:0.7, atkDmg:18, reward:600, w:13, h:13, hasCar:true,  carMinWanted:3  },
];

// ── ENTITY ARRAYS ─────────────────────────────────────────────
const cops  = [];
const pcars = [];

// ── GANG ZONE REFERENCES (used by cop patrol avoidance) ───────
const GANG_ZONES_AVOID  = [SPECIAL_ZONES.gangA, SPECIAL_ZONES.gangB];
const GANG_AVOID_MARGIN = 8;

function isTileInGangZone(tx, ty, margin) {
  for (const z of GANG_ZONES_AVOID)
    if (tx >= z.x1 - margin && tx < z.x2 + margin &&
        ty >= z.y1 - margin && ty < z.y2 + margin) return true;
  return false;
}

// ── ROAD POINT HELPERS ────────────────────────────────────────

function randRoadPt() {
  const tiles = [];
  for (let y = MAP_EDGE_MARGIN; y < WH - MAP_EDGE_MARGIN; y++)
    for (let x = MAP_EDGE_MARGIN; x < WW - MAP_EDGE_MARGIN; x++)
      if (WD[y][x] === 1) tiles.push({ x, y });
  const t = tiles[Math.floor(Math.random() * tiles.length)];
  return { x: t.x * T + T / 2, y: t.y * T + T / 2 };
}

function safePatrolPt() {
  const tiles = [];
  for (let y = MAP_EDGE_MARGIN; y < WH - MAP_EDGE_MARGIN; y++)
    for (let x = MAP_EDGE_MARGIN; x < WW - MAP_EDGE_MARGIN; x++)
      if (WD[y][x] === 1 && !isTileInGangZone(x, y, GANG_AVOID_MARGIN))
        tiles.push({ x, y });
  if (!tiles.length)
    for (let y = 1; y < WH - 1; y++)
      for (let x = 1; x < WW - 1; x++)
        if (WD[y][x] === 1) tiles.push({ x, y });
  const t = tiles[Math.floor(Math.random() * tiles.length)];
  return { px: t.x * T + T / 2, py: t.y * T + T / 2 };
}

function raidPt(zone) {
  const tx = zone.x1 + Math.floor(Math.random() * (zone.x2 - zone.x1));
  const ty = zone.y1 + Math.floor(Math.random() * (zone.y2 - zone.y1));
  return { px: tx * T + T / 2, py: ty * T + T / 2 };
}

function newPatrolWP() { return safePatrolPt(); }

function snapToRoad(wx, wy) {
  const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
  if (ty >= 0 && ty < WH && tx >= 0 && tx < WW && WD[ty][tx] === 1)
    return { x: tx * T + T / 2, y: ty * T + T / 2 };
  for (let r = 1; r <= 8; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (ny >= 1 && ny < WH - 1 && nx >= 1 && nx < WW - 1 && WD[ny][nx] === 1)
          return { x: nx * T + T / 2, y: ny * T + T / 2 };
      }
  return { x: WW * T / 2, y: WH * T / 2 };
}

// ── POLICE CAR FACTORY ────────────────────────────────────────

function mkPoliceCar(x, y, grade) {
  const gd = COP_GRADES[grade];
  const isSWAT = grade === 3;
  return {
    x, y,
    w: isSWAT ? 38 : 30,   h: isSWAT ? 18 : 14,
    angle: 0, speed: 0,
    maxS: isSWAT ? 155 : 185,
    acc:  isSWAT ? 180 : 250,
    trn:  isSWAT ? 4.5 : 6.0,
    col:  isSWAT ? '#222' : '#1144cc',
    style: isSWAT ? 'suv' : 'sedan',
    grade, health: isSWAT ? 100 : 70,
    driven: false, copIdx: -1, lightT: 0,
    name: gd.name + ' CAR', isSWAT,
  };
}

// ── COP SPAWNING ──────────────────────────────────────────────

function spawnCop(x, y, gradeOverride) {
  x = Math.max((MAP_EDGE_MARGIN + 1) * T, Math.min((WW - MAP_EDGE_MARGIN - 1) * T, x));
  y = Math.max((MAP_EDGE_MARGIN + 1) * T, Math.min((WH - MAP_EDGE_MARGIN - 1) * T, y));
  const snapped = snapToRoad(x, y);
  x = snapped.x; y = snapped.y;

  const wanted = PL ? PL.wanted : 0;
  const grade  = gradeOverride != null ? gradeOverride :
    wanted >= 4 ? 3 :
    wanted >= 3 ? (Math.random() < 0.4 ? 3 : 2) :
    wanted >= 2 ? (Math.random() < 0.5 ? 1 : 2) :
    (Math.random() < 0.3 ? 1 : 0);

  const gd = COP_GRADES[grade];
  const wp = safePatrolPt();
  const cop = {
    x, y, w: gd.w, h: gd.h,
    hp: gd.hp, maxHp: gd.maxHp, spd: gd.spd,
    angle: 0, atkCd: 0, shootCd: 0,
    px: wp.px, py: wp.py,
    patrolT: 0, raiding: false,
    grade, name: gd.name, carIdx: -1,
  };
  cops.push(cop);
  const ci = cops.length - 1;

  if (gd.hasCar && wanted >= gd.carMinWanted) {
    const pc = mkPoliceCar(x + 20, y, grade);
    pc.driven = true; pc.copIdx = ci;
    pcars.push(pc);
    cop.carIdx = pcars.length - 1;
  }
}

// ── HQ REPOPULATION ───────────────────────────────────────────
const COP_HQ_MIN_COUNT = 6;

function repopCopHQ() {
  const z     = SPECIAL_ZONES.copHQ;
  const count = cops.filter(c => {
    const tx = Math.floor(c.x / T), ty = Math.floor(c.y / T);
    return tx >= z.x1 && tx < z.x2 && ty >= z.y1 && ty < z.y2;
  }).length;
  if (count < COP_HQ_MIN_COUNT) {
    const tx = z.x1 + Math.floor(Math.random() * (z.x2 - z.x1));
    const ty = z.y1 + Math.floor(Math.random() * (z.y2 - z.y1));
    spawnCop(tx * T + T / 2, ty * T + T / 2);
  }
}

// ── RAID SYSTEM ───────────────────────────────────────────────
const RAID_INTERVAL   = 30;
const RAID_SQUAD_SIZE = 5;
let   raidTimer       = 20;

function launchRaid(targetZone) {
  targetZone = targetZone ||
    GANG_ZONES_AVOID[Math.floor(Math.random() * GANG_ZONES_AVOID.length)];

  const zCX = (targetZone.x1 + targetZone.x2) / 2 * T;
  const zCY = (targetZone.y1 + targetZone.y2) / 2 * T;

  for (let ri = 0; ri < RAID_SQUAD_SIZE; ri++) {
    const ang  = Math.random() * Math.PI * 2;
    const dist = 320 + Math.random() * 80;
    const sx   = Math.max((MAP_EDGE_MARGIN + 1) * T,
                  Math.min((WW - MAP_EDGE_MARGIN - 1) * T, zCX + Math.cos(ang) * dist));
    const sy   = Math.max((MAP_EDGE_MARGIN + 1) * T,
                  Math.min((WH - MAP_EDGE_MARGIN - 1) * T, zCY + Math.sin(ang) * dist));

    const wp        = raidPt(targetZone);
    const raidGrade = ri === 0 ? 1 : 0;
    const rgd       = COP_GRADES[raidGrade];

    const rc = {
      x: sx, y: sy, w: rgd.w, h: rgd.h,
      hp: rgd.hp + 15, maxHp: rgd.maxHp + 15, spd: rgd.spd + 10,
      angle: 0, atkCd: 0, shootCd: 0,
      px: wp.px, py: wp.py,
      patrolT: 25, raiding: true,
      grade: raidGrade, name: rgd.name, carIdx: -1,
    };
    cops.push(rc);
    const rpc = mkPoliceCar(sx + 20, sy, raidGrade);
    rpc.driven = true; rpc.copIdx = cops.length - 1;
    pcars.push(rpc);
    rc.carIdx = pcars.length - 1;
  }
  if (typeof showNotif === 'function') showNotif('[ RAID ] COP RAID ON GANG TURF!');
}

// ── SPAWN TICK (called from game.js update) ───────────────────
let _copSpawnT = 0;

function updateCopSpawns(dt) {
  // HQ repop
  _copSpawnT += dt;
  if (_copSpawnT > 5) { _copSpawnT = 0; repopCopHQ(); }

  // Periodic raids
  raidTimer -= dt;
  if (raidTimer <= 0) {
    raidTimer = RAID_INTERVAL + Math.random() * 15;
    launchRaid();
  }

  // Wanted-level response — approval multiplier adjusts INTERVAL not hard cap
  // Use floor of wanted*3 as absolute minimum so low approval never starves spawns
  const mult = typeof approvalCopSpawnMult === 'function' ? approvalCopSpawnMult() : 1;
  const capMin = PL.wanted * 3;                        // absolute minimum cap
  const cap    = Math.max(capMin, capMin * mult);      // approval can only increase cap
  if (PL.wanted > 0 && cops.length < cap) {
    const a  = Math.random() * Math.PI * 2;
    const sd = 270 + Math.random() * 130;
    const sx = Math.max((MAP_EDGE_MARGIN + 1) * T,
                Math.min((WW - MAP_EDGE_MARGIN - 1) * T, PL.x + Math.cos(a) * sd));
    const sy = Math.max((MAP_EDGE_MARGIN + 1) * T,
                Math.min((WH - MAP_EDGE_MARGIN - 1) * T, PL.y + Math.sin(a) * sd));
    spawnCop(sx, sy);
  }
}

// ── WANTED SYSTEM ─────────────────────────────────────────────
const WANTED_DECAY_TIME = [0, 8, 12, 18, 25, 35];

function addWanted(n) {
  PL.wanted = Math.min(5, PL.wanted + n);
  PL.wantT  = WANTED_DECAY_TIME[PL.wanted] || 8;
}

// ── RESET ─────────────────────────────────────────────────────
function resetCops() {
  cops.length  = 0;
  pcars.length = 0;
  raidTimer    = 20;
  _copSpawnT   = 0;
  PL.wanted    = 0;
  PL.wantT     = 0;
  for (let i = 0; i < COP_HQ_MIN_COUNT; i++) {
    const z  = SPECIAL_ZONES.copHQ;
    const tx = z.x1 + Math.floor(Math.random() * (z.x2 - z.x1));
    const ty = z.y1 + Math.floor(Math.random() * (z.y2 - z.y1));
    spawnCop(tx * T + T / 2, ty * T + T / 2);
  }
}
