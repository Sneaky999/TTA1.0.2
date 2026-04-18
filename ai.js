// ═══════════════════════════════════════════════════════════════
//  ai.js  –  AI MODULE  v2  (Improved + Bug-fixed)
//
//  Bugs fixed vs v1:
//    • Traffic double-rotation on wall hit (angle was updated twice)
//    • copIdx stale after cops.splice — cops now carry a uid, pcars
//      find their cop by uid scan (O(n) but n is small)
//    • _steerMove jitter didn't check tile validity → walls
//    • Cop chase used raw mvE → wall jamming during pursuit
//    • SWAT filter allocated array every frame at ★5
//    • Gangster wander reused stale attack angle
//
//  AI improvements vs v1:
//    Traffic  — smooth accel/decel, stop at busy intersections
//    NPCs     — group panic contagion, rare phone-police call
//    Gangsters— cover/peek between shots, faction patrol routes,
//               coordinated flanking of player
//    Cops     — chase uses wall-steering, radio callout,
//               intercept prediction (lead target)
//    Pcars    — intercept path prediction not just follow
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── TUNING ────────────────────────────────────────────────────
const AI_TRAF_LOOK_DIST     = 48;
const AI_TRAF_SLOW_FACTOR   = 0.45;
const AI_TRAF_ACCEL         = 60;    // px/s² acceleration
const AI_TRAF_STOP_RADIUS   = 38;    // px — stop if something this close ahead

const AI_NPC_PANIC_RADIUS   = 260;
const AI_NPC_PANIC_COOLDOWN = 0.7;
const AI_NPC_FLEE_RANGE     = 220;
const AI_NPC_CONTAGION_R    = 80;    // px — panic spreads to nearby NPCs
const AI_NPC_CALL_CHANCE    = 0.003; // probability/s NPC calls police (adds wanted)

const AI_GANG_ALARM_RADIUS  = 200;
const AI_GANG_ALARM_CHANCE  = 0.012;
const AI_GANG_RETREAT_HP    = 0.30;
const AI_GANG_RETREAT_REGEN = 4;
const AI_GANG_BASE_RANGE    = 200;
const AI_GANG_AGGRO_BONUS   = 40;
const AI_GANG_AGGRO_CAP     = 400;
const AI_GANG_COVER_DIST    = 180;   // px — shoot from this range, take cover closer
const AI_GANG_COVER_TIME    = 1.2;   // s — how long to stay behind cover
const AI_GANG_FLANK_OFFSET  = Math.PI / 4; // 45° flanking offset between gang members

const AI_COP_FLANK_ANGLE    = Math.PI / 3.2;
const AI_COP_FLANK_BLEND    = 240;
const AI_COP_SURROUND_DIST  = 130;
const AI_COP_SURROUND_MIN   = 60;
const AI_COP_RADIO_RANGE    = 320;   // px — spotted cop radios nearby partners
const AI_COP_RADIO_CHANCE   = 0.015; // probability/s of radio callout
const AI_COP_PREDICT_T      = 0.6;   // seconds of player movement to predict

const AI_HELI_ORBIT_SPEED   = 0.75;
const AI_HELI_ORBIT_DIST    = 280;
const AI_HELI_SPAWN_CHANCE  = 0.10;
const AI_HELI_MAX_SWAT      = 2;

const AI_COP_PROBE_DIST     = 32;
const AI_COP_STEER_STEP     = Math.PI / 6;
const AI_COP_STEER_TRIES    = 6;
const AI_COP_STUCK_TIME     = 1.4;
const AI_COP_STUCK_MOVE_MIN = 4;

// ── MODULE STATE ──────────────────────────────────────────────
let _panicCooldown = 0;
let _helicopterAng = 0;
let _copFlankSide  = new WeakMap();
let _nextCopUid    = 1;   // monotonic cop UID counter

// ══════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════

function initAI() {
  _panicCooldown = 0;
  _helicopterAng = 0;
  _copFlankSide  = new WeakMap();
  _nextCopUid    = 1;
}

function updateAI(dt) {
  _aiTraffic(dt);
  _aiNPCs(dt);
  _aiGangsters(dt);
  _aiPoliceCars(dt);
  _aiCops(dt);
  _aiBullets(dt);
  _aiPickups(dt);
  _aiParticles(dt);
  if (_panicCooldown > 0) _panicCooldown -= dt;
}

function panicNearby(x, y) {
  if (_panicCooldown > 0) return;
  _panicCooldown = AI_NPC_PANIC_COOLDOWN;
  const r2 = AI_NPC_PANIC_RADIUS * AI_NPC_PANIC_RADIUS;
  for (const n of npcs) {
    if (d2(n.x, n.y, x, y) < r2) { n.flee = true; n.state = 'scared'; }
  }
}

// ═════════════════════════════════════════
//  TRAFFIC  (bug-fixed + improved)
// ═════════════════════════════════════════
function _aiTraffic(dt) {
  for (const tc of traf) {
    tc.tT -= dt;
    if (tc.tT <= 0) {
      tc.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      tc.tT = 2 + Math.random() * 4;
      tc._spd = tc._spd || tc.speed; // save natural speed
    }

    // ── Vehicle-ahead scan ─────────────────────────────────────
    const lookX = tc.x + Math.cos(tc.angle) * AI_TRAF_LOOK_DIST;
    const lookY = tc.y + Math.sin(tc.angle) * AI_TRAF_LOOK_DIST;
    let blocked = false;
    for (const other of traf) {
      if (other === tc) continue;
      if (d2(lookX, lookY, other.x, other.y) < AI_TRAF_STOP_RADIUS * AI_TRAF_STOP_RADIUS) {
        blocked = true; break;
      }
    }
    if (!blocked) {
      for (const pc of pcars) {
        if (d2(lookX, lookY, pc.x, pc.y) < 28 * 28) { blocked = true; break; }
      }
    }

    // ── Smooth acceleration / deceleration ────────────────────
    const targetSpd = blocked ? 0 : (tc._spd || tc.speed);
    if (tc.speed < targetSpd) tc.speed = Math.min(targetSpd, tc.speed + AI_TRAF_ACCEL * dt);
    else if (tc.speed > targetSpd) tc.speed = Math.max(targetSpd * AI_TRAF_SLOW_FACTOR, tc.speed - AI_TRAF_ACCEL * 1.5 * dt);

    if (tc.speed < 0.5) continue; // stationary — skip movement

    // ── BUG FIX: single angle update on collision ──────────────
    // Try X movement; if blocked, rotate ONCE and bail for this frame
    const nx = tc.x + Math.cos(tc.angle) * tc.speed * dt;
    if (!tColl(nx - tc.w / 2, tc.y - tc.h / 2, tc.w, tc.h)) {
      tc.x = nx;
    } else {
      // Rotate and bail — don't also try Y with the new angle
      tc.angle += Math.PI / 2;
      tc.tT = 0.5 + Math.random() * 1.5;
      continue;
    }

    // Try Y movement; if blocked, rotate ONCE
    const ny = tc.y + Math.sin(tc.angle) * tc.speed * dt;
    if (!tColl(tc.x - tc.w / 2, ny - tc.h / 2, tc.w, tc.h)) {
      tc.y = ny;
    } else {
      tc.angle += Math.PI / 2;
      tc.tT = 0.5 + Math.random() * 1.5;
    }

    tc.x = Math.max(20, Math.min(WW * T - 20, tc.x));
    tc.y = Math.max(20, Math.min(WH * T - 20, tc.y));
  }
}

// ═════════════════════════════════════════
//  NPC CIVILIANS  (improved)
// ═════════════════════════════════════════
function _aiNPCs(dt) {
  for (let ni = 0; ni < npcs.length; ni++) {
    const n = npcs[ni];
    n.timer -= dt;

    const dx   = PL.x - n.x;
    const dy   = PL.y - n.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const fleeMult = typeof approvalNPCFleeMult === 'function' ? approvalNPCFleeMult() : 1;

    // Scare trigger: armed player on foot within range
    if (!PL.inCar && dist < 130 && curW().id !== 'fists') {
      n.state = 'scared'; n.flee = true;
    }

    // Rare: panicking NPC makes a phone call → player gets a wanted star
    if (n.flee && Math.random() < AI_NPC_CALL_CHANCE * dt && PL.wanted < 3) {
      addWanted(1);
    }

    if (n.flee) {
      if (dist < AI_NPC_FLEE_RANGE * fleeMult) {
        n.angle = Math.atan2(n.y - PL.y, n.x - PL.x);
        mvE(n, Math.cos(n.angle) * n.spd * 1.7 * dt, Math.sin(n.angle) * n.spd * 1.7 * dt);

        // Panic contagion — spread flee to nearby calm NPCs
        if (Math.random() < 0.04) {
          const cr2 = AI_NPC_CONTAGION_R * AI_NPC_CONTAGION_R;
          for (let nj = 0; nj < npcs.length; nj++) {
            if (nj === ni) continue;
            const nb = npcs[nj];
            if (!nb.flee && d2(n.x, n.y, nb.x, nb.y) < cr2) {
              nb.flee = true; nb.state = 'scared';
            }
          }
        }
        continue;
      } else {
        n.flee = false; n.state = 'idle';
      }
    }

    // Normal wander
    if (n.timer <= 0) {
      n.angle = Math.random() * Math.PI * 2;
      n.timer = 1.5 + Math.random() * 2.5;
    }
    mvE(n, Math.cos(n.angle) * n.spd * dt, Math.sin(n.angle) * n.spd * dt);
  }
}

// ═════════════════════════════════════════
//  GANGSTERS  (improved: cover, flanking)
// ═════════════════════════════════════════
function _aiGangsters(dt) {
  const maxRoam = (AI_GANG_BASE_RANGE + Math.min(AI_GANG_AGGRO_CAP, gangKills * AI_GANG_AGGRO_BONUS)) *
                  (typeof approvalGangAggroMult === 'function' ? approvalGangAggroMult() : 1);

  // Pre-compute each gang member's index-based flank offset for coordinated approach
  const gangCount = gangs.length;

  for (let i = gangs.length - 1; i >= 0; i--) {
    const g = gangs[i];
    g.atkCd   = Math.max(0, g.atkCd   - dt);
    g.shootCd = Math.max(0, g.shootCd - dt);
    g._coverT = Math.max(0, (g._coverT || 0) - dt);

    const homeDist = Math.sqrt(d2(g.x, g.y, g.homeX, g.homeY));
    const pdx = PL.x - g.x, pdy = PL.y - g.y;
    const pdd = Math.sqrt(pdx * pdx + pdy * pdy);
    const hpPct = g.hp / (g.maxHp || 45);

    // ── Wounded retreat ────────────────────────────────────────
    if (hpPct < AI_GANG_RETREAT_HP && homeDist > 55) {
      const retreatAngle = Math.atan2(g.homeY - g.y, g.homeX - g.x);
      _gangSteerMove(g, retreatAngle, g.spd * 0.85, dt);
      g.hp = Math.min(g.maxHp || 45, g.hp + AI_GANG_RETREAT_REGEN * dt);
      continue;
    }

    // ── Find nearest cop ───────────────────────────────────────
    let nearCopIdx = -1, nearCopD = Infinity;
    for (let ci = 0; ci < cops.length; ci++) {
      const cd = d2(g.x, g.y, cops[ci].x, cops[ci].y);
      if (cd < nearCopD) { nearCopD = cd; nearCopIdx = ci; }
    }
    const engageCop = nearCopIdx >= 0 && nearCopD < 200 * 200;

    if (homeDist > maxRoam && pdd > 80) {
      // ── Return to turf ─────────────────────────────────────
      const homeAngle = Math.atan2(g.homeY - g.y, g.homeX - g.x);
      _gangSteerMove(g, homeAngle, g.spd, dt);

    } else if (engageCop) {
      // ── Fight cop ──────────────────────────────────────────
      const tc    = cops[nearCopIdx];
      const gdist = Math.sqrt(nearCopD);
      g.angle = Math.atan2(tc.y - g.y, tc.x - g.x);

      if (gdist > 20) _gangSteerMove(g, g.angle, g.spd, dt);

      if (gdist < 220 && g.shootCd <= 0) {
        g.shootCd = 1.0;
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
      // ── Attack player ──────────────────────────────────────

      // Alarm call
      if (pdd < 120 && Math.random() < AI_GANG_ALARM_CHANCE) {
        const ar2 = AI_GANG_ALARM_RADIUS * AI_GANG_ALARM_RADIUS;
        for (const ally of gangs) {
          if (ally !== g && d2(ally.x, ally.y, g.x, g.y) < ar2) {
            ally.angle = Math.atan2(PL.y - ally.y, PL.x - ally.x);
            ally.wanderT = 0;
          }
        }
      }

      // ── Cover / peek behaviour ────────────────────────────
      // Gangsters alternate between advancing and staying in cover.
      // Each has a flank offset so they spread out rather than stack.
      const flankAngle = Math.atan2(pdy, pdx) +
                         (i % 3 === 0 ? AI_GANG_FLANK_OFFSET :
                          i % 3 === 1 ? -AI_GANG_FLANK_OFFSET : 0);

      if (pdd > AI_GANG_COVER_DIST) {
        // Advance toward player from flank angle
        g.angle = flankAngle;
        _gangSteerMove(g, g.angle, g.spd, dt);
        g._coverT = 0;

      } else if (g._coverT > 0) {
        // ── In cover — take a shot then wait ─────────────────
        if (g.shootCd <= 0) {
          g.shootCd = 1.0;
          const aimAngle = Math.atan2(pdy, pdx) + (Math.random() - 0.5) * 0.2;
          shootB(g.x, g.y, aimAngle, false, 310, 9, 0, 'gang');
        }
        // Sidestep slightly while in cover
        const sideAngle = Math.atan2(pdy, pdx) + Math.PI / 2;
        const sideAmt = Math.sin(Date.now() / 600 + i) * 0.4;
        mvE(g, Math.cos(sideAngle) * g.spd * sideAmt * dt,
               Math.sin(sideAngle) * g.spd * sideAmt * dt);

      } else {
        // ── Advance then duck into cover ──────────────────────
        g.angle = Math.atan2(pdy, pdx);
        _gangSteerMove(g, g.angle, g.spd * 0.7, dt);
        if (pdd < AI_GANG_COVER_DIST * 0.6) {
          // Close enough — enter cover phase
          g._coverT = AI_GANG_COVER_TIME + Math.random();
        }

        // Shoot while advancing
        if (pdd < 220 && g.shootCd <= 0) {
          g.shootCd = 1.3;
          shootB(g.x, g.y, g.angle + (Math.random() - 0.5) * 0.3, false, 290, 9, 0, 'gang');
        }
      }

      // Melee
      if (pdd < 20 && g.atkCd <= 0 && PL.inv <= 0) {
        g.atkCd = 0.9; PL.hp -= 10; PL.inv = 0.3; spawnPts(PL.x, PL.y, '#f00', 5);
      }

    } else {
      // ── Wander inside turf ─────────────────────────────────
      // BUG FIX: reset angle when entering wander to avoid reusing attack angle
      if (!g.wanderT || g.wanderT <= 0) {
        g.angle   = Math.random() * Math.PI * 2;  // always pick fresh angle
        g.wanderT = 2 + Math.random() * 2.5;
      }
      g.wanderT -= dt;
      _gangSteerMove(g, g.angle, g.spd * 0.5, dt);
    }
  }
}

// ═════════════════════════════════════════
//  POLICE CARS  (bug-fixed: uid lookup + intercept)
// ═════════════════════════════════════════
function _aiPoliceCars(dt) {
  for (let pi = pcars.length - 1; pi >= 0; pi--) {
    const pc = pcars[pi];
    pc.lightT = (pc.lightT || 0) + dt;

    // ── BUG FIX: find cop by uid, not by stale array index ────
    let cop = null;
    if (pc.copUid !== undefined) {
      // Fast: try the stored index first; if uid still matches, use it
      const ci = pc.copIdx;
      if (ci >= 0 && ci < cops.length && cops[ci].uid === pc.copUid) {
        cop = cops[ci];
      } else {
        // Slow scan: index is stale, find by uid
        const found = cops.findIndex(c => c.uid === pc.copUid);
        if (found >= 0) { pc.copIdx = found; cop = cops[found]; }
      }
    } else if (pc.copIdx >= 0 && pc.copIdx < cops.length) {
      cop = cops[pc.copIdx]; // legacy: no uid yet
    }

    if (!cop) { pcars.splice(pi, 1); continue; }

    // ── Intercept: predict player position ahead of time ──────
    let targetX = cop.x, targetY = cop.y;
    const followDist = pc.isSWAT ? 55 : 44;
    const tdx = cop.x - pc.x, tdy = cop.y - pc.y;
    const tdd = Math.sqrt(tdx * tdx + tdy * tdy);

    if (PL.wanted > 0 && tdd < 400) {
      // Lead the player if player is moving fast and car is far
      const predX = PL.x + Math.cos(PL.angle) * PL.spd * AI_COP_PREDICT_T;
      const predY = PL.y + Math.sin(PL.angle) * PL.spd * AI_COP_PREDICT_T;
      // Blend between following cop and intercepting player
      const blend = Math.min(1, tdd / 200);
      targetX = cop.x * blend + predX * (1 - blend);
      targetY = cop.y * blend + predY * (1 - blend);
    }

    const finalDx = targetX - pc.x, finalDy = targetY - pc.y;
    const finalDist = Math.sqrt(finalDx * finalDx + finalDy * finalDy);

    if (finalDist > followDist) {
      const ta = Math.atan2(finalDy, finalDx);
      let diff = ta - pc.angle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      pc.angle += diff * pc.trn * dt;
      pc.speed  = Math.min(pc.speed + pc.acc * dt, Math.min(pc.maxS, finalDist * 2));
    } else {
      pc.speed *= 0.82;
    }

    const nx = pc.x + Math.cos(pc.angle) * pc.speed * dt;
    const ny = pc.y + Math.sin(pc.angle) * pc.speed * dt;
    if (!tColl(nx - pc.w / 2, pc.y - pc.h / 2, pc.w, pc.h)) pc.x = nx; else pc.speed *= -0.3;
    if (!tColl(pc.x - pc.w / 2, ny - pc.h / 2, pc.w, pc.h)) pc.y = ny; else pc.speed *= -0.3;

    // Ram player on foot
    if (PL.wanted > 0 && !PL.inCar &&
        rR(pc.x - pc.w / 2, pc.y - pc.h / 2, pc.w, pc.h, PL.x - 8, PL.y - 8, 16, 16) &&
        pc.speed > 40) {
      if (PL.inv <= 0) { PL.hp -= 15; PL.inv = 0.5; spawnPts(PL.x, PL.y, '#f00', 8); }
    }

    // Player car rams police car
    if (PL.inCar && PL.car) {
      if (Math.abs(PL.car.speed) > 40 &&
          rR(pc.x - pc.w / 2, pc.y - pc.h / 2, pc.w, pc.h,
             PL.car.x - PL.car.w / 2, PL.car.y - PL.car.h / 2, PL.car.w, PL.car.h)) {
        const impact = Math.abs(PL.car.speed) * 0.05;
        pc.health -= impact;
        spawnPts(pc.x, pc.y, '#88f', 5);
        PL.car.speed *= -0.4;
        if (pc.health <= 0) {
          spawnPts(pc.x, pc.y, '#f80', 14); spawnPts(pc.x, pc.y, '#f00', 10);
          const pcReward = COP_GRADES[pc.grade].reward;
          PL.score += pcReward; PL.cash += pcReward;
          addWanted(1);
          showNotif('POLICE CAR +$' + pcReward);
          if (cop) cop.carIdx = -1;
          pcars.splice(pi, 1);
        }
      }
    }
  }
}

// ═════════════════════════════════════════
//  SHARED NAVIGATION HELPER
// ═════════════════════════════════════════
function _steerMove(e, wantAngle, speed, dt, onStuck) {
  if (e._checkX === undefined) {
    e._checkX = e.x; e._checkY = e.y; e._stuckT = 0;
  }
  e._stuckT += dt;
  if (e._stuckT >= AI_COP_STUCK_TIME) {
    const moved = Math.sqrt(d2(e.x, e.y, e._checkX, e._checkY));
    if (moved < AI_COP_STUCK_MOVE_MIN) {
      // BUG FIX: jitter uses mvE so it respects collision
      const jx = (Math.random() - 0.5) * T * 0.5;
      const jy = (Math.random() - 0.5) * T * 0.5;
      mvE(e, jx, jy);
      if (onStuck) onStuck(e);
    }
    e._checkX = e.x; e._checkY = e.y; e._stuckT = 0;
  }

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
  e.angle = wantAngle + Math.PI / 2;
  return false;
}

function _copSteerMove(c, wantAngle, speed, dt) {
  return _steerMove(c, wantAngle, speed, dt, e => {
    const wp = safePatrolPt();
    e.px = wp.px; e.py = wp.py;
    e.patrolT = 12 + Math.random() * 8;
  });
}

function _gangSteerMove(g, wantAngle, speed, dt) {
  return _steerMove(g, wantAngle, speed, dt, e => {
    e.wanderT = 0;
    e.angle   = Math.random() * Math.PI * 2;
  });
}

// ═════════════════════════════════════════
//  COPS  (bug-fixed chase + radio callout)
// ═════════════════════════════════════════
function _aiCops(dt) {

  // SWAT helicopter — BUG FIX: count without allocating array
  if (PL.wanted >= 5) {
    _helicopterAng += AI_HELI_ORBIT_SPEED * dt;
    let swatCount = 0;
    for (const c of cops) if (c.grade === 3) swatCount++;
    if (swatCount < AI_HELI_MAX_SWAT && Math.random() < AI_HELI_SPAWN_CHANCE * dt) {
      const hx = PL.x + Math.cos(_helicopterAng) * AI_HELI_ORBIT_DIST;
      const hy = PL.y + Math.sin(_helicopterAng) * AI_HELI_ORBIT_DIST;
      const snapped = snapToRoad(
        Math.max((MAP_EDGE_MARGIN + 1) * T, Math.min((WW - MAP_EDGE_MARGIN - 1) * T, hx)),
        Math.max((MAP_EDGE_MARGIN + 1) * T, Math.min((WH - MAP_EDGE_MARGIN - 1) * T, hy))
      );
      const newCop = spawnCop(snapped.x, snapped.y, 3);
      showNotif('[ SWAT DROP ] HELICOPTER INBOUND');
    }
  }

  // Assign uid to any cop that doesn't have one (new cops from spawnCop)
  for (const c of cops) {
    if (c.uid === undefined) {
      c.uid = _nextCopUid++;
      // Sync to police car
      if (c.carIdx >= 0 && c.carIdx < pcars.length) {
        pcars[c.carIdx].copUid = c.uid;
      }
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
    const directAim  = Math.atan2(pdy, pdx);

    if (PL.wanted > 0) {
      // ── Radio callout: cop that's close to player alerts others ──
      if (pdd < 280 && Math.random() < AI_COP_RADIO_CHANCE * dt) {
        const rr2 = AI_COP_RADIO_RANGE * AI_COP_RADIO_RANGE;
        for (const other of cops) {
          if (other === c) continue;
          const od = d2(other.x, other.y, c.x, c.y);
          if (od < rr2) {
            // Direct partner toward player
            other.px = PL.x + (Math.random() - 0.5) * 80;
            other.py = PL.y + (Math.random() - 0.5) * 80;
            other.patrolT = 8;
          }
        }
      }

      // ── Flanking ──────────────────────────────────────────────
      let approachAngle = directAim;
      if (PL.wanted >= 2 && totalCops > 1) {
        if (!_copFlankSide.has(c)) _copFlankSide.set(c, i % 2 === 0 ? 1 : -1);
        const side       = _copFlankSide.get(c);
        const flankBlend = Math.max(0, 1 - pdd / AI_COP_FLANK_BLEND);
        approachAngle   += side * AI_COP_FLANK_ANGLE * flankBlend;
      }

      // ── Surround ring at ★4 ────────────────────────────────
      if (PL.wanted >= 4 && pdd < AI_COP_SURROUND_DIST) {
        if (pdd > AI_COP_SURROUND_MIN) {
          // BUG FIX: use _copSteerMove instead of raw mvE to avoid wall jamming
          _copSteerMove(c, approachAngle, gd.spd, dt);
        }
        c.angle = directAim;
      } else {
        // Normal chase — BUG FIX: use _copSteerMove so cops don't wall-jam during pursuit
        const chargeRange = c.grade === 3 ? 140 : 22;
        c.angle = approachAngle;
        if (pdd > chargeRange) _copSteerMove(c, c.angle, gd.spd, dt);
      }

      // Shoot
      if (pdd < 240 && c.shootCd <= 0) {
        c.shootCd      = gd.shootCd;
        const spread   = c.grade === 2 ? 0.1 : c.grade === 3 ? 0.05 : 0.35;
        const bspd     = c.grade === 3 ? 500 : 340;
        const aimAngle = directAim + (Math.random() - 0.5) * spread;
        shootB(c.x, c.y, aimAngle, false, bspd, gd.dmg, 0, 'cop');
        if (c.grade === 3 && Math.random() < 0.25)
          shootB(c.x, c.y, directAim + (Math.random() - 0.5) * 0.08, false, 500, gd.dmg, 0, 'cop');
      }

      // Melee
      if (pdd < 22 && c.atkCd <= 0 && PL.inv <= 0) {
        c.atkCd = 1.1; PL.hp -= gd.atkDmg; PL.inv = 0.4;
        spawnPts(PL.x, PL.y, '#f00', 5);
      }

    } else if (c.raiding) {
      // ── Gang raid ───────────────────────────────────────────
      let nearGangIdx = -1, nearGangD = Infinity;
      for (let gi = 0; gi < gangs.length; gi++) {
        const gd2 = d2(c.x, c.y, gangs[gi].x, gangs[gi].y);
        if (gd2 < nearGangD) { nearGangD = gd2; nearGangIdx = gi; }
      }

      if (nearGangIdx >= 0 && nearGangD < 200 * 200) {
        const g     = gangs[nearGangIdx];
        const gdist = Math.sqrt(nearGangD);
        c.angle = Math.atan2(g.y - c.y, g.x - c.x);
        if (gdist > 20) _copSteerMove(c, c.angle, gd.spd, dt);
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
      // ── Patrol ─────────────────────────────────────────────
      if (inGangZone) {
        const wp = safePatrolPt(); c.px = wp.px; c.py = wp.py; c.patrolT = 15;
        const evacAngle = Math.atan2(c.py - c.y, c.px - c.x);
        _copSteerMove(c, evacAngle, gd.spd, dt);
      } else {
        const wdx  = c.px - c.x, wdy = c.py - c.y;
        const wDist = Math.sqrt(wdx * wdx + wdy * wdy);
        const wpTX = Math.floor(c.px / T), wpTY = Math.floor(c.py / T);

        if (isTileInGangZone(wpTX, wpTY, GANG_AVOID_MARGIN) || wDist < 32 || c.patrolT <= 0) {
          const wp = safePatrolPt(); c.px = wp.px; c.py = wp.py;
          c.patrolT = 14 + Math.random() * 10;
          c._stuckT = 0; c._checkX = c.x; c._checkY = c.y;
        }

        const toWP = Math.atan2(wdy, wdx);
        _copSteerMove(c, toWP, gd.spd * 0.65, dt);
      }
    }
  }
}

// ═════════════════════════════════════════
//  BULLETS  (unchanged — correct routing)
// ═════════════════════════════════════════
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
            showNotif('GANGSTER +$30');
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
            PL.score += gr.reward; PL.cash += gr.reward; addWanted(2);
            recordKill('cop');
            spawnPts(c.x, c.y, '#00f', 14);
            showNotif(gr.name + ' +$' + gr.reward);
            if (c.carIdx >= 0 && c.carIdx < pcars.length) pcars[c.carIdx].copIdx = -1;
            cops.splice(j, 1);
          }
          continue; // bullet was spliced — skip to next bullet iteration
        }
      }
    } else if (b.src === 'gang') {
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

// ═════════════════════════════════════════
//  PICKUPS & PARTICLES
// ═════════════════════════════════════════
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

function _aiParticles(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.87; p.vy *= 0.87;
    p.life -= dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
}
