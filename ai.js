// ═══════════════════════════════════════════════════════════════
//  ai.js  –  AI MODULE  (Enhanced drop-in replacement)
//
//  Handles the full AI tick: Traffic, NPC civilians, Gangsters,
//  Police cars, Cops (foot), Bullets, Pickups.
//
//  IMPROVEMENTS vs game.js inline AI:
//    Traffic   ─ vehicle-ahead speed matching & avoidance
//    NPCs      ─ gunshot panic spreads to nearby civilians
//    Gangsters ─ alarm call rallies nearby allies; wounded retreat
//                & slow regen; turf-boundary aggression scaling
//    Cops      ─ dynamic flanking at wanted ≥2; surround ring at
//                wanted ≥4; SWAT helicopter drops at wanted 5
//    Bullets   ─ identical faction routing (faithful to game.js)
//    Pickups   ─ identical (faithful to game.js)
//
//  ACTIVATION — three steps:
//
//  1.  Add in index.html AFTER game.js:
//        <script src="ai.js"></script>
//
//  2.  In game.js  update(dt)  remove the AI blocks for:
//        • Traffic, NPCs, Gangsters, Police cars, Cops, Bullets,
//          Pickups (the blocks starting at "// Traffic" through
//          "// Particles")
//      and replace them with:
//        if (typeof updateAI === 'function') updateAI(dt);
//
//  3.  In game.js  resetGame() / startGame()  add:
//        if (typeof initAI === 'function') initAI();
//
//  Depends on globals from world.js:
//    PL, cops, gangs, npcs, traf, pcars, bullets, picks, parts,
//    COP_GRADES, GANG_ZONES_AVOID, SPECIAL_ZONES, gangKills,
//    d2, mvE, tColl, isW, rR, ws, T, WW, WH, MAP_EDGE_MARGIN,
//    GANG_AVOID_MARGIN, shootB, spawnPts, spawnPick, explode,
//    addWanted, spawnCop, snapToRoad, safePatrolPt, raidPt,
//    isTileInGangZone, COP_GRADES
//  Depends on globals from game.js:
//    showNotif, buildWHUD, updateHUD
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── TUNING ────────────────────────────────────────────────────
// Traffic
const AI_TRAF_LOOK_DIST      = 40;    // px ahead to check for blocking car
const AI_TRAF_SLOW_FACTOR    = 0.55;  // speed multiplier when blocked

// NPCs
const AI_NPC_PANIC_RADIUS    = 240;   // px — gunshot panic spread
const AI_NPC_PANIC_COOLDOWN  = 0.8;   // seconds between panic pulses
const AI_NPC_FLEE_RANGE      = 200;   // px — flee while player within this dist

// Gangsters
const AI_GANG_ALARM_RADIUS   = 190;   // px — alarm call range to allies
const AI_GANG_ALARM_CHANCE   = 0.010; // probability per frame (≈0.6/s at 60fps)
const AI_GANG_RETREAT_HP     = 0.30;  // retreat threshold (fraction of maxHp)
const AI_GANG_RETREAT_REGEN  = 4;     // HP/s while retreating
const AI_GANG_BASE_RANGE     = 200;   // px — normal patrol radius from home
const AI_GANG_AGGRO_BONUS    = 40;    // px of extra range per gangster kill
const AI_GANG_AGGRO_CAP      = 400;   // px — max extra range

// Cops
const AI_COP_FLANK_ANGLE     = Math.PI / 3.2;  // ~56° offset per flank side
const AI_COP_FLANK_BLEND     = 220;             // px — flank fades in below this dist
const AI_COP_SURROUND_DIST   = 115;             // px — surround ring radius (wanted≥4)
const AI_COP_SURROUND_MIN    = 55;              // px — minimum advance distance
const AI_HELI_ORBIT_SPEED    = 0.75;            // rad/s — helicopter orbit rate
const AI_HELI_ORBIT_DIST     = 260;             // px  — helicopter standoff distance
const AI_HELI_SPAWN_CHANCE   = 0.12;            // probability/s of SWAT drop at ★5
const AI_HELI_MAX_SWAT       = 2;               // max helicopter-spawned SWAT on map

// Cop patrol navigation
const AI_COP_PROBE_DIST      = 28;    // px — look-ahead wall probe distance
const AI_COP_STEER_STEP      = Math.PI / 6; // 30° steer increment when probing
const AI_COP_STEER_TRIES     = 5;    // how many angles to try before giving up
const AI_COP_STUCK_TIME      = 1.4;  // seconds before cop is considered stuck
const AI_COP_STUCK_MOVE_MIN  = 4;    // px — must move at least this far per check

// ── MODULE STATE ──────────────────────────────────────────────
let _panicCooldown  = 0;          // seconds until next NPC panic pulse allowed
let _helicopterAng  = 0;          // current helicopter orbit angle (radians)
let _copFlankSide   = new WeakMap(); // cop object → flank side (+1 or −1)

// ══════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════

/** Call from resetGame() / startGame() in game.js */
function initAI() {
  _panicCooldown = 0;
  _helicopterAng = 0;
  _copFlankSide  = new WeakMap();
}

/** Call from update(dt) in game.js — replaces all inline AI blocks */
function updateAI(dt) {
  _aiTraffic(dt);
  _aiNPCs(dt);
  _aiGangsters(dt);
  _aiPoliceCars(dt);
  _aiCops(dt);
  _aiBullets(dt);
  _aiPickups(dt);
  _aiParticles(dt);       // moved here so game.js particle block can be removed too
  if (_panicCooldown > 0) _panicCooldown -= dt;
}

/**
 * Trigger a gunshot panic pulse around (x, y).
 * Optional: call this from fireW() in game.js after a player shot to make
 * nearby NPCs scatter. e.g.:  if (typeof panicNearby==='function') panicNearby(fx,fy);
 */
function panicNearby(x, y) {
  if (_panicCooldown > 0) return;
  _panicCooldown = AI_NPC_PANIC_COOLDOWN;
  const r2 = AI_NPC_PANIC_RADIUS * AI_NPC_PANIC_RADIUS;
  for (const n of npcs) {
    if (d2(n.x, n.y, x, y) < r2) n.flee = true;
  }
}

// ══════════════════════════════════════════
//  TRAFFIC
// ══════════════════════════════════════════
function _aiTraffic(dt) {
  for (const tc of traf) {
    tc.tT -= dt;

    // Random direction change on timer
    if (tc.tT <= 0) {
      tc.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      tc.tT = 1.5 + Math.random() * 3.5;
    }

    // ── Vehicle-ahead avoidance (NEW) ──────────────────────────
    // Look one car-length ahead; slow down if another vehicle is there.
    let blocked = false;
    const lookX = tc.x + Math.cos(tc.angle) * AI_TRAF_LOOK_DIST;
    const lookY = tc.y + Math.sin(tc.angle) * AI_TRAF_LOOK_DIST;
    for (const other of traf) {
      if (other === tc) continue;
      if (d2(lookX, lookY, other.x, other.y) < 18 * 18) { blocked = true; break; }
    }
    // Also slow down near police cars
    if (!blocked) {
      for (const pc of pcars) {
        if (d2(lookX, lookY, pc.x, pc.y) < 22 * 22) { blocked = true; break; }
      }
    }

    const spd = blocked ? tc.speed * AI_TRAF_SLOW_FACTOR : tc.speed;

    // Move X
    const nx = tc.x + Math.cos(tc.angle) * spd * dt;
    if (!tColl(nx - tc.w / 2, tc.y - tc.h / 2, tc.w, tc.h)) {
      tc.x = nx;
    } else {
      tc.angle += Math.PI / 2;
      tc.tT = 0.5 + Math.random() * 2;
    }

    // Move Y
    const ny = tc.y + Math.sin(tc.angle) * spd * dt;
    if (!tColl(tc.x - tc.w / 2, ny - tc.h / 2, tc.w, tc.h)) {
      tc.y = ny;
    } else {
      tc.angle += Math.PI / 2;
    }

    // Clamp to world bounds
    tc.x = Math.max(20, Math.min(WW * T - 20, tc.x));
    tc.y = Math.max(20, Math.min(WH * T - 20, tc.y));
  }
}

// ══════════════════════════════════════════
//  NPC CIVILIANS
// ══════════════════════════════════════════
function _aiNPCs(dt) {
  for (const n of npcs) {
    n.timer -= dt;

    const dx   = PL.x - n.x;
    const dy   = PL.y - n.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // ── 😨 Scare trigger: player on foot, armed, and close ──────
    // Civilians notice a drawn weapon at 120px and panic.
    if (!PL.inCar && dist < 120 && curW().id !== 'fists') {
      n.state = 'scared';
      n.flee  = true;
    }

    // ── 🏃 Flee ──────────────────────────────────────────────────
    if (n.flee) {
      if (dist < AI_NPC_FLEE_RANGE) {
        // Run directly away from the player
        n.angle = Math.atan2(n.y - PL.y, n.x - PL.x);
        mvE(n,
          Math.cos(n.angle) * n.spd * 1.6 * dt,
          Math.sin(n.angle) * n.spd * 1.6 * dt);
        continue; // skip wander logic this frame
      } else {
        // Far enough — calm back down
        n.flee  = false;
        n.state = 'idle';
      }
    }

    // ── 🚶 Normal wander ─────────────────────────────────────────
    if (n.timer <= 0) {
      n.angle = Math.random() * Math.PI * 2;
      n.timer = 1.5 + Math.random() * 2.5;
    }
    mvE(n,
      Math.cos(n.angle) * n.spd * dt,
      Math.sin(n.angle) * n.spd * dt);
  }
}

// ══════════════════════════════════════════
//  GANGSTERS
// ══════════════════════════════════════════
function _aiGangsters(dt) {
  const maxRoam = AI_GANG_BASE_RANGE + Math.min(AI_GANG_AGGRO_CAP, gangKills * AI_GANG_AGGRO_BONUS);

  for (let i = gangs.length - 1; i >= 0; i--) {
    const g = gangs[i];
    g.atkCd   = Math.max(0, g.atkCd   - dt);
    g.shootCd = Math.max(0, g.shootCd - dt);

    const homeDist = Math.sqrt(d2(g.x, g.y, g.homeX, g.homeY));
    const pdx      = PL.x - g.x,  pdy = PL.y - g.y;
    const pdd      = Math.sqrt(pdx * pdx + pdy * pdy);
    const hpPct    = g.hp / (g.maxHp || 45);

    // ── (NEW) Wounded retreat: below threshold HP → return home ──
    if (hpPct < AI_GANG_RETREAT_HP && homeDist > 55) {
      const retreatAngle = Math.atan2(g.homeY - g.y, g.homeX - g.x);
      _gangSteerMove(g, retreatAngle, g.spd * 0.8, dt);
      // Slowly regenerate while retreating
      g.hp = Math.min(g.maxHp || 45, g.hp + AI_GANG_RETREAT_REGEN * dt);
      continue;
    }

    // ── Find nearest cop ────────────────────────────────────────
    let nearCopIdx = -1, nearCopD = Infinity;
    for (let ci = 0; ci < cops.length; ci++) {
      const cd = d2(g.x, g.y, cops[ci].x, cops[ci].y);
      if (cd < nearCopD) { nearCopD = cd; nearCopIdx = ci; }
    }
    const engageCop = nearCopIdx >= 0 && nearCopD < 200 * 200;

    if (homeDist > maxRoam && pdd > 80) {
      // ── Return to turf ─────────────────────────────────────────
      const homeAngle = Math.atan2(g.homeY - g.y, g.homeX - g.x);
      _gangSteerMove(g, homeAngle, g.spd, dt);

    } else if (engageCop) {
      // ── Fight cop (higher priority than player) ───────────────
      const tc    = cops[nearCopIdx];
      const gdist = Math.sqrt(nearCopD);
      g.angle = Math.atan2(tc.y - g.y, tc.x - g.x);

      if (gdist > 20) _gangSteerMove(g, g.angle, g.spd, dt);

      if (gdist < 220 && g.shootCd <= 0) {
        g.shootCd = 1.1;
        shootB(g.x, g.y, g.angle + (Math.random() - 0.5) * 0.3, false, 300, 9, 0, 'gang');
      }
      if (gdist < 20 && g.atkCd <= 0) {
        g.atkCd = 0.85; tc.hp -= 12; spawnPts(tc.x, tc.y, '#f44', 4);
        if (tc.hp <= 0) {
          spawnPts(tc.x, tc.y, '#00f', 10);
          if (tc.carIdx >= 0 && tc.carIdx < pcars.length) pcars[tc.carIdx].copIdx = -1;
          cops.splice(nearCopIdx, 1);
          showNotif('GANG KILLED COP!');
        }
      }

    } else if (pdd < maxRoam) {
      // ── Attack player ─────────────────────────────────────────

      // (NEW) Alarm call: close gangster rallies nearby allies toward player
      if (pdd < 120 && Math.random() < AI_GANG_ALARM_CHANCE) {
        const ar2 = AI_GANG_ALARM_RADIUS * AI_GANG_ALARM_RADIUS;
        for (const ally of gangs) {
          if (ally !== g && d2(ally.x, ally.y, g.x, g.y) < ar2) {
            // Override ally's wander so it turns toward the player
            ally.angle   = Math.atan2(PL.y - ally.y, PL.x - ally.x);
            ally.wanderT = 0; // cancel any current wander timer
          }
        }
      }

      g.angle = Math.atan2(pdy, pdx);
      if (pdd > 20) _gangSteerMove(g, g.angle, g.spd, dt);

      if (pdd < 200 && g.shootCd <= 0) {
        g.shootCd = 1.2;
        shootB(g.x, g.y, g.angle + (Math.random() - 0.5) * 0.25, false, 300, 9, 0, 'gang');
      }
      if (pdd < 20 && g.atkCd <= 0 && PL.inv <= 0) {
        g.atkCd = 0.9; PL.hp -= 10; PL.inv = 0.3; spawnPts(PL.x, PL.y, '#f00', 5);
      }

    } else {
      // ── Wander inside turf ────────────────────────────────────
      if (!g.wanderT || g.wanderT <= 0) {
        g.angle   = Math.random() * Math.PI * 2;
        g.wanderT = 1.5 + Math.random() * 2;
      }
      g.wanderT -= dt;
      _gangSteerMove(g, g.angle, g.spd * 0.5, dt);
    }
  }
}

// ══════════════════════════════════════════
//  POLICE CARS
// ══════════════════════════════════════════
function _aiPoliceCars(dt) {
  for (let pi = pcars.length - 1; pi >= 0; pi--) {
    const pc = pcars[pi];
    pc.lightT = (pc.lightT || 0) + dt;

    // Remove orphaned cars
    if (pc.copIdx < 0 || pc.copIdx >= cops.length) {
      pcars.splice(pi, 1);
      continue;
    }

    const cop = cops[pc.copIdx];
    const tdx = cop.x - pc.x, tdy = cop.y - pc.y;
    const tdd = Math.sqrt(tdx * tdx + tdy * tdy);
    const followDist = pc.isSWAT ? 55 : 44;

    // ── Follow assigned cop ───────────────────────────────────
    if (tdd > followDist) {
      const ta  = Math.atan2(tdy, tdx);
      let diff  = ta - pc.angle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      pc.angle += diff * pc.trn * dt;
      pc.speed  = Math.min(pc.speed + pc.acc * dt, Math.min(pc.maxS, tdd * 2));
    } else {
      pc.speed *= 0.82;
    }

    const nx = pc.x + Math.cos(pc.angle) * pc.speed * dt;
    const ny = pc.y + Math.sin(pc.angle) * pc.speed * dt;
    if (!tColl(nx - pc.w / 2, pc.y - pc.h / 2, pc.w, pc.h)) pc.x = nx; else pc.speed *= -0.3;
    if (!tColl(pc.x - pc.w / 2, ny - pc.h / 2, pc.w, pc.h)) pc.y = ny; else pc.speed *= -0.3;

    // ── Ram player on foot ───────────────────────────────────
    if (PL.wanted > 0 && !PL.inCar &&
        rR(pc.x - pc.w / 2, pc.y - pc.h / 2, pc.w, pc.h, PL.x - 8, PL.y - 8, 16, 16) &&
        pc.speed > 40) {
      if (PL.inv <= 0) { PL.hp -= 15; PL.inv = 0.5; spawnPts(PL.x, PL.y, '#f00', 8); }
    }

    // ── Player car rams police car ────────────────────────────
    if (PL.inCar && PL.car) {
      if (Math.abs(PL.car.speed) > 40 &&
          rR(pc.x - pc.w / 2, pc.y - pc.h / 2, pc.w, pc.h,
             PL.car.x - PL.car.w / 2, PL.car.y - PL.car.h / 2,
             PL.car.w, PL.car.h)) {
        const impact = Math.abs(PL.car.speed) * 0.05;
        pc.health -= impact;
        spawnPts(pc.x, pc.y, '#88f', 5);
        PL.car.speed *= -0.4;
        if (pc.health <= 0) {
          spawnPts(pc.x, pc.y, '#f80', 14);
          spawnPts(pc.x, pc.y, '#f00', 10);
          PL.score += COP_GRADES[pc.grade].reward;
          addWanted(1);
          showNotif('POLICE CAR DESTROYED +' + COP_GRADES[pc.grade].reward);
          if (pc.copIdx >= 0 && pc.copIdx < cops.length) cops[pc.copIdx].carIdx = -1;
          pcars.splice(pi, 1);
        }
      }
    }
  }
}

// ══════════════════════════════════════════
//  SHARED NAVIGATION HELPER  (_steerMove)
//
//  Used by cops AND gangsters.
//  Probes ahead for walls and fans left/right to find a
//  clear path. Detects stuck entities and calls onStuck()
//  so each AI type recovers in its own way.
// ══════════════════════════════════════════
function _steerMove(e, wantAngle, speed, dt, onStuck) {
  // ── Stuck detection ───────────────────────────────────────────
  if (e._checkX === undefined) {
    e._checkX = e.x; e._checkY = e.y; e._stuckT = 0;
  }
  e._stuckT += dt;
  if (e._stuckT >= AI_COP_STUCK_TIME) {
    const moved = Math.sqrt(d2(e.x, e.y, e._checkX, e._checkY));
    if (moved < AI_COP_STUCK_MOVE_MIN) {
      // Jitter position slightly to escape tight corners
      e.x += (Math.random() - 0.5) * T * 0.5;
      e.y += (Math.random() - 0.5) * T * 0.5;
      if (onStuck) onStuck(e);
    }
    e._checkX = e.x; e._checkY = e.y; e._stuckT = 0;
  }

  // ── Wall probe & steering ─────────────────────────────────────
  // Try wantAngle first, then alternate ±30° up to STEER_TRIES times.
  const step = speed * dt;
  for (let t = 0; t < AI_COP_STEER_TRIES; t++) {
    const sign  = t === 0 ? 0 : (t % 2 === 1 ? 1 : -1);
    const side  = Math.ceil(t / 2);
    const angle = wantAngle + sign * side * AI_COP_STEER_STEP;

    const probeX  = e.x + Math.cos(angle) * AI_COP_PROBE_DIST;
    const probeY  = e.y + Math.sin(angle) * AI_COP_PROBE_DIST;
    const probeTX = Math.floor(probeX / T);
    const probeTY = Math.floor(probeY / T);

    if (probeTX >= 0 && probeTX < WW && probeTY >= 0 && probeTY < WH && isW(probeTX, probeTY)) {
      e.angle = angle;
      mvE(e, Math.cos(angle) * step, Math.sin(angle) * step);
      return true;
    }
  }

  // Completely boxed in — spin and retry next frame
  e.angle = wantAngle + Math.PI / 2;
  return false;
}

// ── Cop wrapper ───────────────────────────────────────────────
function _copSteerMove(c, wantAngle, speed, dt) {
  return _steerMove(c, wantAngle, speed, dt, e => {
    const wp = safePatrolPt();
    e.px = wp.px; e.py = wp.py;
    e.patrolT = 12 + Math.random() * 8;
  });
}

// ── Gangster wrapper ──────────────────────────────────────────
function _gangSteerMove(g, wantAngle, speed, dt) {
  return _steerMove(g, wantAngle, speed, dt, e => {
    // When stuck: pick a fresh wander direction, reset timer
    e.wanderT = 0;
    e.angle   = Math.random() * Math.PI * 2;
  });
}

// ══════════════════════════════════════════
//  COPS (FOOT OFFICERS)
// ══════════════════════════════════════════
function _aiCops(dt) {

  // ── (NEW) SWAT helicopter drops at ★5 ─────────────────────
  if (PL.wanted >= 5) {
    _helicopterAng += AI_HELI_ORBIT_SPEED * dt;
    // Count how many SWAT the helicopter has already dropped (loose count)
    const swatCount = cops.filter(c => c.grade === 3).length;
    if (swatCount < AI_HELI_MAX_SWAT && Math.random() < AI_HELI_SPAWN_CHANCE * dt) {
      const hx = PL.x + Math.cos(_helicopterAng) * AI_HELI_ORBIT_DIST;
      const hy = PL.y + Math.sin(_helicopterAng) * AI_HELI_ORBIT_DIST;
      const snapped = snapToRoad(
        Math.max((MAP_EDGE_MARGIN + 1) * T, Math.min((WW - MAP_EDGE_MARGIN - 1) * T, hx)),
        Math.max((MAP_EDGE_MARGIN + 1) * T, Math.min((WH - MAP_EDGE_MARGIN - 1) * T, hy))
      );
      spawnCop(snapped.x, snapped.y, 3); // grade 3 = SWAT
      showNotif('[ SWAT DROP ] HELICOPTER INBOUND');
    }
  }

  const totalCops = cops.length;

  for (let i = cops.length - 1; i >= 0; i--) {
    const c  = cops[i];
    const gd = COP_GRADES[c.grade || 0];
    c.atkCd   = Math.max(0, c.atkCd   - dt);
    c.shootCd = Math.max(0, c.shootCd - dt);
    c.patrolT = Math.max(0, (c.patrolT || 0) - dt);

    const inGangZone = isTileInGangZone(Math.floor(c.x / T), Math.floor(c.y / T), 0);
    const pdx        = PL.x - c.x, pdy = PL.y - c.y;
    const pdd        = Math.sqrt(pdx * pdx + pdy * pdy);
    const directAim  = Math.atan2(pdy, pdx); // always points at player

    if (PL.wanted > 0) {
      // ════════════════════════════════════════
      //  PRIORITY 1: Chase wanted player
      // ════════════════════════════════════════

      // ── (NEW) Flanking ────────────────────────────────────────
      // Each cop is assigned a flank side (+1 = left, −1 = right).
      // The approach angle bends away from direct as the cop closes in,
      // so groups naturally fan out rather than stacking on one path.
      let approachAngle = directAim;
      if (PL.wanted >= 2 && totalCops > 1) {
        if (!_copFlankSide.has(c)) {
          _copFlankSide.set(c, i % 2 === 0 ? 1 : -1);
        }
        const side          = _copFlankSide.get(c);
        const flankBlend    = Math.max(0, 1 - pdd / AI_COP_FLANK_BLEND); // 0 far away → 1 up close
        approachAngle      += side * AI_COP_FLANK_ANGLE * flankBlend;
      }

      // ── (NEW) Surround ring at ★4 ─────────────────────────────
      // Inside the ring, cops hold distance and keep facing the player
      // instead of all charging into the same tile.
      if (PL.wanted >= 4 && pdd < AI_COP_SURROUND_DIST) {
        if (pdd > AI_COP_SURROUND_MIN) {
          mvE(c,
            Math.cos(approachAngle) * gd.spd * dt,
            Math.sin(approachAngle) * gd.spd * dt);
        }
        c.angle = directAim; // always face player while holding ring
      } else {
        // Normal charge / SWAT hang-back
        const chargeRange = c.grade === 3 ? 140 : 22;
        c.angle = approachAngle;
        if (pdd > chargeRange) mvE(c,
          Math.cos(c.angle) * gd.spd * dt,
          Math.sin(c.angle) * gd.spd * dt);
      }

      // ── Shoot ────────────────────────────────────────────────
      if (pdd < 220 && c.shootCd <= 0) {
        c.shootCd       = gd.shootCd;
        const spread    = c.grade === 2 ? 0.1 : c.grade === 3 ? 0.05 : 0.35;
        const bspd      = c.grade === 3 ? 500 : 330;
        // Aim at actual player position, not the flank angle
        const aimAngle  = directAim + (Math.random() - 0.5) * spread;
        shootB(c.x, c.y, aimAngle, false, bspd, gd.dmg, 0, 'cop');
        // SWAT burst-fire chance
        if (c.grade === 3 && Math.random() < 0.2) {
          shootB(c.x, c.y, directAim + (Math.random() - 0.5) * 0.08, false, 500, gd.dmg, 0, 'cop');
        }
      }

      // ── Melee ────────────────────────────────────────────────
      if (pdd < 22 && c.atkCd <= 0 && PL.inv <= 0) {
        c.atkCd = 1.1; PL.hp -= gd.atkDmg; PL.inv = 0.4;
        spawnPts(PL.x, PL.y, '#f00', 5);
      }

    } else if (c.raiding) {
      // ════════════════════════════════════════
      //  PRIORITY 2: Gang raid
      // ════════════════════════════════════════
      let nearGangIdx = -1, nearGangD = Infinity;
      for (let gi = 0; gi < gangs.length; gi++) {
        const gd2 = d2(c.x, c.y, gangs[gi].x, gangs[gi].y);
        if (gd2 < nearGangD) { nearGangD = gd2; nearGangIdx = gi; }
      }

      if (nearGangIdx >= 0 && nearGangD < 200 * 200) {
        const g     = gangs[nearGangIdx];
        const gdist = Math.sqrt(nearGangD);
        c.angle = Math.atan2(g.y - c.y, g.x - c.x);
        if (gdist > 20) mvE(c,
          Math.cos(c.angle) * gd.spd * dt,
          Math.sin(c.angle) * gd.spd * dt);
        if (gdist < 200 && c.shootCd <= 0) {
          c.shootCd = gd.shootCd * 0.85;
          shootB(c.x, c.y, c.angle + (Math.random() - 0.5) * 0.25, false, 360, gd.dmg, 0, 'cop');
        }
        if (gdist < 20 && c.atkCd <= 0) {
          c.atkCd = 0.9; g.hp -= gd.atkDmg + 6; spawnPts(g.x, g.y, '#f80', 5);
          if (g.hp <= 0) {
            spawnPts(g.x, g.y, '#f00', 10);
            gangs.splice(nearGangIdx, 1);
            showNotif('COP KILLED GANGSTER!');
          }
        }
      } else {
        // Advance to next raid waypoint
        const wdx = c.px - c.x, wdy = c.py - c.y;
        if (Math.sqrt(wdx * wdx + wdy * wdy) < 40 || c.patrolT <= 0) {
          if (c.patrolT <= 0) {
            c.raiding = false;
            const wp = safePatrolPt(); c.px = wp.px; c.py = wp.py; c.patrolT = 15;
          } else {
            const zone = GANG_ZONES_AVOID[Math.floor(Math.random() * GANG_ZONES_AVOID.length)];
            const wp   = raidPt(zone); c.px = wp.px; c.py = wp.py;
          }
        }
        c.angle = Math.atan2(wdy, wdx);
        _copSteerMove(c, c.angle, gd.spd, dt);
      }

    } else {
      // ════════════════════════════════════════
      //  PRIORITY 3: Patrol (road-following, wall-steering)
      // ════════════════════════════════════════
      if (inGangZone) {
        // Evacuate gang zone immediately — steer out
        const wp = safePatrolPt(); c.px = wp.px; c.py = wp.py; c.patrolT = 15;
        const evacAngle = Math.atan2(c.py - c.y, c.px - c.x);
        _copSteerMove(c, evacAngle, gd.spd, dt);
      } else {
        const wdx  = c.px - c.x, wdy = c.py - c.y;
        const wDist = Math.sqrt(wdx * wdx + wdy * wdy);
        const wpTX = Math.floor(c.px / T), wpTY = Math.floor(c.py / T);

        // Pick a new waypoint if: reached it, timer expired, or waypoint landed in gang zone
        if (isTileInGangZone(wpTX, wpTY, GANG_AVOID_MARGIN) || wDist < 32 || c.patrolT <= 0) {
          const wp = safePatrolPt(); c.px = wp.px; c.py = wp.py;
          c.patrolT = 14 + Math.random() * 10;
          // Reset stuck tracking when we pick a fresh target
          c._stuckT = 0; c._checkX = c.x; c._checkY = c.y;
        }

        // Steer toward waypoint at patrol speed (65% of chase speed)
        const toWP = Math.atan2(wdy, wdx);
        _copSteerMove(c, toWP, gd.spd * 0.65, dt);
      }
    }
  }
}

// ══════════════════════════════════════════
//  BULLETS (faction-aware routing)
// ══════════════════════════════════════════
function _aiBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;

    const hitWall = !isW(Math.floor(b.x / T), Math.floor(b.y / T));
    if (b.life <= 0 || hitWall) {
      if (b.spl > 0) explode(b.x, b.y, b.spl, b.dmg);
      bullets.splice(i, 1);
      continue;
    }

    if (b.fp) {
      // ── Player bullet: NPCs → gangs → cops ───────────────────
      let gone = false;

      for (let j = npcs.length - 1; j >= 0; j--) {
        const n = npcs[j];
        if (d2(b.x, b.y, n.x, n.y) < n.w * n.w) {
          n.hp -= b.dmg; n.flee = true; spawnPts(n.x, n.y, '#f80', 4);
          if (b.spl > 0) explode(b.x, b.y, b.spl, b.dmg);
          bullets.splice(i, 1);
          if (n.hp <= 0) {
            PL.score += 30; PL.cash += n.cash; addWanted(1);
            recordKill('npc');
            spawnPts(n.x, n.y, n.col, 12);
            npcs.splice(j, 1);
            showNotif('+$' + n.cash);
          }
          gone = true; break;
        }
      }

      if (!gone) for (let j = gangs.length - 1; j >= 0; j--) {
        const g = gangs[j];
        if (d2(b.x, b.y, g.x, g.y) < g.w * g.w) {
          g.hp -= b.dmg; spawnPts(g.x, g.y, '#f00', 4);
          if (b.spl > 0) explode(b.x, b.y, b.spl, b.dmg);
          bullets.splice(i, 1);
          if (g.hp <= 0) {
            PL.score += 80; PL.cash += 30; recordKill('gang');
            gangs.splice(j, 1);
            showNotif('GANG DOWN +$30 ★');
          }
          gone = true; break;
        }
      }

      if (!gone) for (let j = cops.length - 1; j >= 0; j--) {
        const c = cops[j];
        if (d2(b.x, b.y, c.x, c.y) < c.w * c.w) {
          c.hp -= b.dmg; spawnPts(c.x, c.y, '#00f', 4);
          if (b.spl > 0) explode(b.x, b.y, b.spl, b.dmg);
          bullets.splice(i, 1);
          if (c.hp <= 0) {
            const gr = COP_GRADES[c.grade || 0];
            PL.score += gr.reward; addWanted(2);
            recordKill('cop');
            spawnPts(c.x, c.y, '#00f', 14);
            showNotif(gr.name + ' DOWN +' + gr.reward);
            if (c.carIdx >= 0 && c.carIdx < pcars.length) pcars[c.carIdx].copIdx = -1;
            cops.splice(j, 1);
          }
          break;
        }
      }

    } else if (b.src === 'gang') {
      // ── Gang bullet: cops → player ────────────────────────────
      let gone = false;
      for (let j = cops.length - 1; j >= 0; j--) {
        const c = cops[j];
        if (d2(b.x, b.y, c.x, c.y) < c.w * c.w) {
          c.hp -= b.dmg; spawnPts(c.x, c.y, '#f44', 3); bullets.splice(i, 1);
          if (c.hp <= 0) {
            spawnPts(c.x, c.y, '#00f', 10);
            if (c.carIdx >= 0 && c.carIdx < pcars.length) pcars[c.carIdx].copIdx = -1;
            cops.splice(j, 1);
            showNotif('GANG KILLED COP!');
          }
          gone = true; break;
        }
      }
      if (!gone && !PL.inCar && PL.inv <= 0 && d2(b.x, b.y, PL.x, PL.y) < 12 * 12) {
        PL.hp -= b.dmg; PL.inv = 0.3; spawnPts(PL.x, PL.y, '#f00', 5);
        bullets.splice(i, 1);
      }

    } else {
      // ── Cop bullet: gangs → player ────────────────────────────
      let gone = false;
      for (let j = gangs.length - 1; j >= 0; j--) {
        const g = gangs[j];
        if (d2(b.x, b.y, g.x, g.y) < g.w * g.w) {
          g.hp -= b.dmg; spawnPts(g.x, g.y, '#f80', 3); bullets.splice(i, 1);
          if (g.hp <= 0) {
            spawnPts(g.x, g.y, '#f00', 10);
            gangs.splice(j, 1);
            showNotif('COP KILLED GANGSTER!');
          }
          gone = true; break;
        }
      }
      if (!gone && !PL.inCar && PL.inv <= 0 && d2(b.x, b.y, PL.x, PL.y) < 12 * 12) {
        PL.hp -= b.dmg; PL.inv = 0.3; spawnPts(PL.x, PL.y, '#f00', 5);
        bullets.splice(i, 1);
      }
    }
  }
}

// ══════════════════════════════════════════
//  PICKUPS
// ══════════════════════════════════════════
function _aiPickups(dt) {
  for (let i = picks.length - 1; i >= 0; i--) {
    const p = picks[i];
    p.bob += dt;
    if (d2(p.x, p.y, PL.x, PL.y) < 22 * 22) {
      if (p.t === 'hp') {
        PL.hp = Math.min(PL.maxHp, PL.hp + 25);
        showNotif('+25 HP');
      } else {
        const a = 20 + Math.floor(Math.random() * 80);
        PL.cash += a; PL.score += 10;
        showNotif('+$' + a);
      }
      spawnPts(p.x, p.y, p.t === 'hp' ? '#f44' : '#ff0', 8);
      picks.splice(i, 1);
    }
  }
}

// ══════════════════════════════════════════
//  PARTICLES  (moved out of game.js update)
// ══════════════════════════════════════════
function _aiParticles(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.87; p.vy *= 0.87;
    p.life -= dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
}
