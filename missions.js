// ═══════════════════════════════════════════════════════════════
//  missions.js  –  MISSIONS SYSTEM  (v2 — Gang Givers Edition)
//
//  • 8 missions given by named gang members who stand in the world
//  • Gang givers are peaceful — they never attack the player
//  • Walk into a zone → see giver's dialog → tap prompt or press F
//  • Multi-target elimination, delivery, rampage, escape missions
//  • Waypoints track live targets; off-screen arrows always shown
//
//  Depends on: world.js, game.js, ai.js
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── MISSION ZONES ─────────────────────────────────────────────
// Each zone has a named gang member who gives the mission.
const MISSION_ZONES = [
  { x1:20, y1:20, x2:24, y2:24, missionId:'delivery_01', name:'PHONE BOOTH',   giver:'VINNIE',      col:'#e05010' },
  { x1:60, y1:62, x2:64, y2:66, missionId:'hit_01',      name:'CONTACT',       giver:'THE BROKER',  col:'#8030d0' },
  { x1:50, y1:10, x2:54, y2:14, missionId:'rampage_01',  name:'GANG BOSS',     giver:'BIG TOMMY',   col:'#cc2020' },
  { x1:14, y1:48, x2:18, y2:52, missionId:'escape_01',   name:'SAFEHOUSE',     giver:'LENNY',       col:'#208040' },
  { x1:85, y1:30, x2:89, y2:34, missionId:'patrol_01',   name:'COP INFORMANT', giver:'DIRTY MIKE',  col:'#404080' },
  { x1:35, y1:75, x2:39, y2:79, missionId:'heist_01',    name:'CREW BOSS',     giver:'ACE',         col:'#d04010' },
  { x1:72, y1:15, x2:76, y2:19, missionId:'convoy_01',   name:'ARMS DEALER',   giver:'SNAKE',       col:'#206060' },
  { x1:10, y1:85, x2:14, y2:89, missionId:'bounty_01',   name:'FIXER',         giver:'THE FIXER',   col:'#907030' },
];

// ── MISSION DEFINITIONS ───────────────────────────────────────
const MISSION_DEFS = {

  delivery_01: {
    name: 'HOT PACKAGE',
    dialog: "I need this package moved — fast. Don't let anyone see you.",
    // Clear numbered steps shown in briefing and HUD
    steps: [
      'Follow the YELLOW ★ on screen to the pickup spot',
      'Walk into the yellow circle to grab the package',
      'A new YELLOW ★ will appear — deliver the package there',
      'Walk into the delivery circle before time runs out',
    ],
    reward: 600, wantedPenalty: 0,
    type: 'delivery', timerMax: 70, count: 1,
  },

  hit_01: {
    name: 'THE CONTRACT',
    dialog: "Someone needs to go. The target is marked on your screen.",
    steps: [
      'Follow the RED ✕ marker on screen — that is your target',
      'If the target is off screen, follow the RED ARROW at the edge',
      'Get close and kill the target (any weapon)',
      'Watch out — killing raises your wanted level',
    ],
    reward: 900, wantedPenalty: 2,
    type: 'elimination', timerMax: null, count: 1,
  },

  rampage_01: {
    name: 'GANG SWEEP',
    dialog: "Rival crew is on our turf. Take out 10 of them.",
    steps: [
      'Find and kill RED gang members anywhere on the map',
      'Gang members wear red — they are the enemy',
      'Kill counter shows in top-right: 0 / 10',
      'Reach 10 kills before the timer hits zero',
    ],
    reward: 1400, wantedPenalty: 1,
    type: 'rampage', target: 'gang', timerMax: 90, count: 10,
  },

  escape_01: {
    name: 'HOT PURSUIT',
    dialog: "Get the cops chasing you, then lose them at the safe house.",
    steps: [
      'STEP 1 — Commit a crime to get 3 wanted stars (★★★)',
      'Punch civilians, shoot, or steal a car to raise wanted level',
      'STEP 2 — Once you have ★★★, a GREEN ★ appears',
      'Run to the GREEN ★ safe zone without dying to complete the mission',
    ],
    reward: 1600, wantedPenalty: 0,
    type: 'escape', timerMax: null, count: 1,
  },

  patrol_01: {
    name: 'INFORMANT RUN',
    dialog: "Five dirty cops need to be silenced. You know what to do.",
    steps: [
      'Find and kill BLUE cops (foot officers) anywhere on the map',
      'Cops are marked as blue dots — avoid police cars if possible',
      'Kill counter shows in top-right: 0 / 5',
      'Reach 5 cop kills before the 120s timer runs out',
    ],
    reward: 2000, wantedPenalty: 3,
    type: 'rampage', target: 'cop', timerMax: 120, count: 5,
  },

  heist_01: {
    name: 'CASH AND CARRY',
    dialog: "Armored truck is in town. Crack it and bring me the cash.",
    steps: [
      'Follow the YELLOW ★ to the armored truck pickup location',
      'Walk into the yellow circle to grab the cash',
      'A new YELLOW ★ drop point appears — head there now',
      'Deliver the cash before the 100s timer expires',
    ],
    reward: 2500, wantedPenalty: 2,
    type: 'delivery', timerMax: 100, count: 1,
  },

  convoy_01: {
    name: 'CONVOY AMBUSH',
    dialog: "Hit the convoy and take out 8 gang guards.",
    steps: [
      'Find and kill RED gang members — they are the convoy guards',
      'Gang members appear as red dots on the minimap',
      'Kill counter shows in top-right: 0 / 8',
      'Eliminate 8 guards before the 110s timer runs out',
    ],
    reward: 1800, wantedPenalty: 1,
    type: 'rampage', target: 'gang', timerMax: 110, count: 8,
  },

  bounty_01: {
    name: 'DEAD OR ALIVE',
    dialog: "Three targets are hiding out there. Hunt all of them down.",
    steps: [
      'Three RED ✕ markers show on screen — each is a target',
      'Follow any RED ARROW at the screen edge to find off-screen targets',
      'Kill each target — they are armed and will fight back',
      'Kill all 3 targets before the 150s timer runs out',
    ],
    reward: 3000, wantedPenalty: 2,
    type: 'multi_elim', timerMax: 150, count: 3,
  },

};

// ── RUNTIME STATE ─────────────────────────────────────────────
let activeMission   = null;
let missionPhase    = 'idle';   // 'idle' | 'active' | 'success' | 'failed'
let _completedIds   = new Set();
let _bannerEl       = null;
let _hudEl          = null;
let _zonePromptEl   = null;
let _lastZoneId     = null;     // which mission zone the player is currently inside
let _missionTargets = [];       // live NPC targets for elimination missions
let _missionGivers  = [];       // visual-only gang member giver objects

// ── PUBLIC API ────────────────────────────────────────────────

function initMissions() {
  _buildUI();
  _spawnMissionGivers();
  console.log('[missions] v2 ready — ' + Object.keys(MISSION_DEFS).length +
              ' missions, ' + MISSION_ZONES.length + ' givers');
}

/** Called every frame from game.js update() */
function updateMissions(dt) {
  _checkZones();
  _updateGiverFacing();

  if (missionPhase !== 'active' || !activeMission) return;
  const m = activeMission;

  // Countdown timer
  if (m.timerMax !== null) {
    m.timer -= dt;
    _updateHUD();
    if (m.timer <= 0) { _failMission('TIME EXPIRED'); return; }
  }

  // ── Rampage win check ──────────────────────────────────────
  if (m.type === 'rampage') {
    if (m.progress >= m.count) { _completeMission(); return; }
  }

  // ── Delivery ───────────────────────────────────────────────
  if (m.type === 'delivery') {
    if (m.phase === 'pickup' && m.pickup) {
      if (d2(PL.x, PL.y, m.pickup.x, m.pickup.y) < 45 * 45) {
        m.phase = 'deliver';
        m.deliverTarget = _randRoadPt(400);
        _showBanner('PACKAGE PICKED UP\nDELIVER IT — FAST!');
        _updateHUD();
      }
    } else if (m.phase === 'deliver' && m.deliverTarget) {
      if (d2(PL.x, PL.y, m.deliverTarget.x, m.deliverTarget.y) < 50 * 50) {
        _completeMission();
      }
    }
  }

  // ── Escape ─────────────────────────────────────────────────
  if (m.type === 'escape') {
    if (m.escapeTarget) {
      if (PL.wanted >= 3) {
        if (d2(PL.x, PL.y, m.escapeTarget.x, m.escapeTarget.y) < 60 * 60) {
          _completeMission();
        }
      }
    }
  }

  // ── Single elimination ─────────────────────────────────────
  if (m.type === 'elimination') {
    if (_missionTargets.length > 0) {
      const t = _missionTargets[0];
      if (!npcs.includes(t)) {
        _completeMission(); return;
      }
      // Track live target position
      m._wpX = t.x; m._wpY = t.y;
    }
  }

  // ── Multi-target elimination ───────────────────────────────
  if (m.type === 'multi_elim') {
    const alive = _missionTargets.filter(t => npcs.includes(t));
    const newProgress = m.count - alive.length;
    if (newProgress !== m.progress) {
      m.progress = newProgress;
      if (alive.length === 0) { _completeMission(); return; }
      _showBanner('TARGET DOWN  ' + m.progress + ' / ' + m.count);
      _updateHUD();
    }
    // Point to nearest living target
    if (alive.length > 0) {
      let nearest = alive[0], nd = d2(PL.x, PL.y, nearest.x, nearest.y);
      for (const t of alive) {
        const dd = d2(PL.x, PL.y, t.x, t.y);
        if (dd < nd) { nd = dd; nearest = t; }
      }
      m._wpX = nearest.x; m._wpY = nearest.y;
    }
  }
}

/** Called from render() in game.js */
function renderMissions(ctx, cam, W, H) {
  // Always draw mission givers
  _renderGivers(ctx, cam, W, H);

  if (missionPhase !== 'active' || !activeMission) return;
  const m = activeMission;

  // ── Determine primary waypoint ─────────────────────────────
  let wp = null;
  if (m.type === 'delivery') {
    wp = (m.phase === 'pickup') ? m.pickup : m.deliverTarget;
  } else if (m.type === 'escape') {
    wp = m.escapeTarget;
  } else if ((m.type === 'elimination' || m.type === 'multi_elim') && m._wpX !== undefined) {
    wp = { x: m._wpX, y: m._wpY };
  }

  // For multi_elim: draw red markers on ALL living targets
  if (m.type === 'multi_elim') {
    for (const t of _missionTargets) {
      if (!npcs.includes(t)) continue;
      _drawWaypoint(ctx, cam, W, H, { x: t.x, y: t.y }, true);
    }
  } else if (wp) {
    _drawWaypoint(ctx, cam, W, H, wp, false);
  }

  // ── Timer bar ──────────────────────────────────────────────
  if (m.timerMax !== null) {
    const pct = Math.max(0, m.timer / m.timerMax);
    const bw = 130, bh = 7, bx = W / 2 - bw / 2, by = 92;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = pct > 0.45 ? '#ffc820' : pct > 0.20 ? '#ff8800' : '#ff2200';
    ctx.fillRect(bx, by, bw * pct, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(m.timer) + 's', W / 2, by + bh / 2);
    ctx.restore();
  }
}

/** Called by recordKill() in world.js for every player kill */
function reportMissionKill(faction) {
  if (missionPhase !== 'active' || !activeMission) return;
  const m = activeMission;
  if (m.type !== 'rampage') return;
  if (m.target !== faction) return;
  m.progress++;
  _showBanner(m.name + '\n' + m.progress + ' / ' + m.count + ' ELIMINATED');
  _updateHUD();
}

// ── MISSION GIVERS ────────────────────────────────────────────

function _spawnMissionGivers() {
  _missionGivers = [];
  for (const mz of MISSION_ZONES) {
    const cx = ((mz.x1 + mz.x2) / 2) * T;
    const cy = ((mz.y1 + mz.y2) / 2) * T;
    _missionGivers.push({
      x: cx, y: cy,
      zoneId:    mz.missionId,
      giverName: mz.giver,
      col:       mz.col || '#e05010',
      angle:     0,
    });
  }
}

function _updateGiverFacing() {
  for (const gv of _missionGivers) {
    if (d2(gv.x, gv.y, PL.x, PL.y) < 200 * 200) {
      gv.angle = Math.atan2(PL.y - gv.y, PL.x - gv.x);
    }
  }
}

function _renderGivers(ctx, cam, W, H) {
  const now = Date.now();
  for (const gv of _missionGivers) {
    const sx = (gv.x - cam.x) + W / 2;
    const sy = (gv.y - cam.y) + H / 2;
    if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;

    const isDone   = _completedIds.has(gv.zoneId);
    const isActive = missionPhase === 'active' && activeMission && activeMission.id === gv.zoneId;
    const pulse    = 0.5 + 0.5 * Math.sin(now / 420);

    ctx.save();
    ctx.translate(sx, sy);

    // ── Outer glow ring (available missions only) ──────────────
    if (!isDone && !isActive) {
      ctx.shadowColor = gv.col;
      ctx.shadowBlur  = 14 + pulse * 8;
      ctx.strokeStyle = `rgba(255,200,0,${0.35 + pulse * 0.45})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // ── Body ──────────────────────────────────────────────────
    ctx.fillStyle = isDone ? '#1d6e1d' : isActive ? '#666' : gv.col;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isDone ? '#44ff44' : '#ffc820';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Centre icon ───────────────────────────────────────────
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(isDone ? '✓' : isActive ? '…' : '!', 0, 0.5);

    // ── Floating "!" exclamation badge ────────────────────────
    if (!isDone && !isActive) {
      const badgeY = -21 - pulse * 3;
      ctx.shadowColor = '#ffd000';
      ctx.shadowBlur  = 8 + pulse * 5;
      ctx.fillStyle   = `rgba(255,200,0,${0.8 + pulse * 0.2})`;
      ctx.beginPath(); ctx.arc(0, badgeY, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = '#000';
      ctx.font        = 'bold 8px monospace';
      ctx.fillText('!', 0, badgeY + 0.5);
    }

    // ── Name label (shown when player is close) ───────────────
    const distSq = d2(gv.x, gv.y, PL.x, PL.y);
    if (distSq < 180 * 180) {
      ctx.font = '7px monospace';
      const lw = ctx.measureText(gv.giverName).width + 10;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(-lw / 2, -34, lw, 12);
      ctx.fillStyle = '#ffc820';
      ctx.fillText(gv.giverName, 0, -28);
    }

    ctx.restore();
  }
}

// ── ZONE DETECTION ────────────────────────────────────────────

function _checkZones() {
  if (missionPhase === 'active') { _lastZoneId = null; _hideZonePrompt(); return; }
  if (missionPhase === 'success' || missionPhase === 'failed') { _hideZonePrompt(); return; }

  const ptx = Math.floor(PL.x / T);
  const pty = Math.floor(PL.y / T);
  let insideZone = null;
  for (const mz of MISSION_ZONES) {
    if (ptx >= mz.x1 && ptx < mz.x2 && pty >= mz.y1 && pty < mz.y2) {
      insideZone = mz; break;
    }
  }

  if (!insideZone) {
    _lastZoneId = null; _hideZonePrompt(); return;
  }

  const id  = insideZone.missionId;
  _lastZoneId = id;

  if (_completedIds.has(id)) {
    _showZonePrompt(
      insideZone.giver + '\n' +
      '[ ' + MISSION_DEFS[id].name + ' — COMPLETE ✓ ]'
    );
    return;
  }

  const def = MISSION_DEFS[id];
  _showZonePrompt(
    '"' + def.dialog + '"\n' +
    '— ' + insideZone.giver + '\n\n' +
    '[ F / TAP HERE ]  ' + def.name + '  (+$' + def.reward + ')'
  );
}

// ── START / COMPLETE / FAIL ───────────────────────────────────

function _tryAcceptZoneMission() {
  if (missionPhase !== 'idle' || !_lastZoneId) return;
  if (_completedIds.has(_lastZoneId)) return;
  const zone = MISSION_ZONES.find(mz => mz.missionId === _lastZoneId);
  if (zone) _startMission(_lastZoneId, zone);
}

function _startMission(id, zone) {
  const def = MISSION_DEFS[id];
  if (!def) return;

  activeMission = {
    id,
    ...def,
    progress:      0,
    timer:         def.timerMax || 0,
    // delivery fields
    phase:         'pickup',
    pickup:        null,
    deliverTarget: null,
    // escape field
    escapeTarget:  null,
    // elimination waypoint
    _wpX: undefined, _wpY: undefined,
  };
  missionPhase    = 'active';
  _missionTargets = [];
  _hideZonePrompt();
  _lastZoneId = null;

  // ── Set up type-specific targets ───────────────────────────
  if (def.type === 'delivery') {
    activeMission.pickup = _randRoadPt(300);

  } else if (def.type === 'escape') {
    const hz = SPECIAL_ZONES.hospital;
    activeMission.escapeTarget = {
      x: ((hz.x1 + hz.x2) / 2) * T,
      y: ((hz.y1 + hz.y2) / 2) * T,
    };

  } else if (def.type === 'elimination') {
    const t = _spawnTargetNPC();
    if (t) {
      _missionTargets = [t];
      activeMission._wpX = t.x;
      activeMission._wpY = t.y;
    }

  } else if (def.type === 'multi_elim') {
    for (let i = 0; i < def.count; i++) {
      const t = _spawnTargetNPC();
      if (t) _missionTargets.push(t);
    }
    if (_missionTargets.length > 0) {
      activeMission._wpX = _missionTargets[0].x;
      activeMission._wpY = _missionTargets[0].y;
    }
  }
  // rampage: target faction string already set from def spread

  _showBriefing(def, zone);
  _buildHUD();
}

function _completeMission() {
  if (!activeMission) return;
  const m = activeMission;
  _completedIds.add(m.id);
  missionPhase = 'success';
  PL.cash  += m.reward;
  PL.score += m.reward;
  _showBanner('MISSION COMPLETE\n+$' + m.reward + '  ✓');
  _hideHUD();
  setTimeout(() => {
    missionPhase    = 'idle';
    activeMission   = null;
    _missionTargets = [];
  }, 3400);
}

function _failMission(reason) {
  missionPhase = 'failed';
  if (activeMission && activeMission.wantedPenalty > 0) {
    addWanted(activeMission.wantedPenalty);
  }
  _showBanner('MISSION FAILED\n' + (reason || ''));
  _hideHUD();
  setTimeout(() => {
    missionPhase    = 'idle';
    activeMission   = null;
    _missionTargets = [];
  }, 2800);
}

// ── WAYPOINT RENDERING ────────────────────────────────────────

function _drawWaypoint(ctx, cam, W, H, wp, isEnemy) {
  const sx = (wp.x - cam.x) + W / 2;
  const sy = (wp.y - cam.y) + H / 2;
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 260);
  const r = 20 + pulse * 6;

  const rStr = isEnemy ? '255,80,80' : '255,210,0';
  const iStr = isEnemy ? '255,100,100' : '255,220,60';

  ctx.save();
  // Pulse ring
  ctx.strokeStyle = `rgba(${rStr},${0.45 + pulse * 0.45})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // Fill
  ctx.fillStyle = `rgba(${rStr},${0.10 + pulse * 0.10})`;
  ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.fill();
  // Star icon
  ctx.fillStyle = `rgba(${iStr},${0.85 + pulse * 0.15})`;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(isEnemy ? '✕' : '★', sx, sy);

  // Off-screen arrow
  const margin = 42;
  const offScreen = sx < margin || sx > W - margin || sy < margin || sy > H - margin;
  if (offScreen) {
    const ang = Math.atan2(wp.y - PL.y, wp.x - PL.x);
    const ax = W / 2 + Math.cos(ang) * (Math.min(W, H) / 2 - margin);
    const ay = H / 2 + Math.sin(ang) * (Math.min(W, H) / 2 - margin);
    ctx.fillStyle = isEnemy ? 'rgba(255,80,80,0.92)' : 'rgba(255,210,0,0.92)';
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(11, 0); ctx.lineTo(-7, -7); ctx.lineTo(-7, 7);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ── HELPERS ───────────────────────────────────────────────────

function _randRoadPt(minDist) {
  const tiles = [];
  for (let y = MAP_EDGE_MARGIN; y < WH - MAP_EDGE_MARGIN; y++) {
    for (let x = MAP_EDGE_MARGIN; x < WW - MAP_EDGE_MARGIN; x++) {
      if (WD[y][x] === 1) {
        const wx = x * T + T / 2, wy = y * T + T / 2;
        if (!minDist || d2(wx, wy, PL.x, PL.y) > minDist * minDist)
          tiles.push({ x: wx, y: wy });
      }
    }
  }
  if (!tiles.length) return { x: PL.x + 400, y: PL.y };
  return tiles[Math.floor(Math.random() * tiles.length)];
}

function _spawnTargetNPC() {
  // Place in a gang zone, away from player
  const zones = [SPECIAL_ZONES.gangA, SPECIAL_ZONES.gangB];
  const z = zones[Math.floor(Math.random() * zones.length)];
  const tx = z.x1 + Math.floor(Math.random() * (z.x2 - z.x1));
  const ty = z.y1 + Math.floor(Math.random() * (z.y2 - z.y1));
  const npc = {
    x: tx * T + T / 2, y: ty * T + T / 2,
    w: 12, h: 12,
    hp: 90, maxHp: 90,
    spd: 68,
    angle: 0, timer: 0,
    col: '#ff2200',
    cash: 300,
    flee: false,
    colorIdx: 0,
    type: 'target',
    state: 'idle',
    isTarget: true,
  };
  npcs.push(npc);
  return npc;
}

// ── UI ────────────────────────────────────────────────────────

function _buildUI() {
  // ── Mission start / complete banner ───────────────────────
  _bannerEl = document.createElement('div');
  _bannerEl.style.cssText = `
    position:absolute;top:38%;left:50%;transform:translateX(-50%);
    background:rgba(5,5,15,0.93);border:1px solid rgba(255,200,0,0.45);
    border-radius:5px;padding:10px 26px;font-family:'Bebas Neue',monospace;
    font-size:15px;color:#ffc820;letter-spacing:2.5px;z-index:30;
    opacity:0;transition:opacity .25s;pointer-events:none;
    white-space:pre;text-align:center;line-height:1.75;
  `;
  document.getElementById('gc').appendChild(_bannerEl);

  // ── Zone offer prompt — tappable ───────────────────────────
  _zonePromptEl = document.createElement('div');
  _zonePromptEl.style.cssText = `
    position:absolute;bottom:230px;left:50%;transform:translateX(-50%);
    background:rgba(0,0,0,0.88);border:1px solid rgba(255,200,0,0.55);
    border-radius:7px;padding:10px 20px;font-family:'Share Tech Mono',monospace;
    font-size:10px;color:rgba(255,200,0,0.92);letter-spacing:1px;z-index:25;
    display:none;cursor:pointer;text-align:center;white-space:pre;
    line-height:1.65;max-width:290px;
  `;
  document.getElementById('gc').appendChild(_zonePromptEl);

  _zonePromptEl.addEventListener('click',      _tryAcceptZoneMission);
  _zonePromptEl.addEventListener('touchstart', e => { e.preventDefault(); _tryAcceptZoneMission(); }, { passive: false });

  // F key accepts mission (avoids conflict with E = car entry)
  window.addEventListener('keydown', e => {
    if ((e.key === 'f' || e.key === 'F') && missionPhase === 'idle' && _lastZoneId) {
      _tryAcceptZoneMission();
    }
  });

  // ── Active mission HUD (top-right panel) ─────────────────────
  _hudEl = document.createElement('div');
  _hudEl.style.cssText = `
    position:absolute;top:68px;right:12px;
    background:rgba(5,5,15,0.92);border:1px solid rgba(255,200,0,0.40);
    border-radius:6px;padding:9px 13px;font-family:'Share Tech Mono',monospace;
    font-size:9px;color:#ffc820;letter-spacing:1.2px;z-index:22;
    display:none;min-width:170px;max-width:200px;line-height:1.85;
  `;
  document.getElementById('gc').appendChild(_hudEl);

  // ── Objective step bar (bottom-centre, always visible during mission) ──
  _stepEl = document.createElement('div');
  _stepEl.style.cssText = `
    position:absolute;bottom:185px;left:50%;transform:translateX(-50%);
    background:rgba(0,0,0,0.82);border:1px solid rgba(255,200,0,0.50);
    border-radius:6px;padding:7px 18px;font-family:'Share Tech Mono',monospace;
    font-size:10px;color:#fff;letter-spacing:0.8px;z-index:24;
    display:none;text-align:center;pointer-events:none;
    white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis;
  `;
  document.getElementById('gc').appendChild(_stepEl);

  // ── Mission briefing overlay (full card, shown on accept) ─────
  _briefEl = document.createElement('div');
  _briefEl.style.cssText = `
    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    background:rgba(4,4,18,0.97);border:2px solid rgba(255,200,0,0.65);
    border-radius:10px;padding:18px 26px;font-family:'Share Tech Mono',monospace;
    z-index:40;display:none;min-width:280px;max-width:340px;
    box-shadow:0 0 40px rgba(255,200,0,0.18);
  `;
  document.getElementById('gc').appendChild(_briefEl);
}

function _buildHUD() {
  if (!_hudEl || !activeMission) return;
  _hudEl.style.display = 'block';
  if (_stepEl) _stepEl.style.display = 'block';
  _updateHUD();
}

function _currentObjective(m) {
  // Returns the single most relevant action string for right now
  if (m.type === 'delivery') {
    if (m.phase === 'pickup') return '📦 Follow the YELLOW ★ — pick up the package';
    return '🏁 Follow the YELLOW ★ — deliver the package';
  }
  if (m.type === 'escape') {
    if (PL.wanted < 3) return '⚠️  Get to ★★★ wanted level first  (punch / shoot)';
    return '🏃 Now run to the GREEN ★ safe zone!';
  }
  if (m.type === 'rampage') {
    const who = m.target === 'gang' ? 'RED gang members' : 'BLUE cops';
    return '🔫 Kill ' + who + '  (' + m.progress + ' / ' + m.count + ' done)';
  }
  if (m.type === 'elimination') {
    return '🎯 Follow the RED ✕ marker and kill the target';
  }
  if (m.type === 'multi_elim') {
    const alive = _missionTargets.filter(t => npcs.includes(t)).length;
    return '🎯 Kill all RED ✕ targets  (' + (m.count - alive) + ' / ' + m.count + ' done)';
  }
  return '';
}

function _updateHUD() {
  if (!_hudEl || !activeMission) return;
  const m = activeMission;

  // ── Top-right mini panel ───────────────────────────────────
  let lines = '━ ' + m.name + ' ━';
  if (m.type === 'rampage') {
    lines += '\n🔫 KILLS  ' + m.progress + ' / ' + m.count;
  }
  if (m.type === 'multi_elim') {
    const alive = _missionTargets.filter(t => npcs.includes(t)).length;
    lines += '\n🎯 DOWN  ' + (m.count - alive) + ' / ' + m.count;
  }
  if (m.timerMax !== null) {
    const pct = m.timer / m.timerMax;
    const col = pct > 0.45 ? '#ffc820' : pct > 0.20 ? '#ff8800' : '#ff3300';
    lines += '\n⏱ TIME  ' + Math.ceil(m.timer) + 's';
    _hudEl.style.borderColor = col;
  }
  lines += '\n💰 $' + m.reward;

  _hudEl.style.whiteSpace = 'pre';
  _hudEl.textContent = lines;

  // ── Bottom objective bar ───────────────────────────────────
  if (_stepEl) {
    _stepEl.textContent = '▶  ' + _currentObjective(m);
  }
}

function _hideHUD() {
  if (_hudEl)  _hudEl.style.display  = 'none';
  if (_stepEl) _stepEl.style.display = 'none';
  if (_briefEl) _briefEl.style.display = 'none';
}

function _showBriefing(def, zone) {
  if (!_briefEl) return;
  const steps = def.steps || [];
  const stepsHtml = steps.map((s, i) =>
    `<div style="margin:3px 0;color:#e0d0a0;font-size:9px;">
      <span style="color:#ffc820;font-weight:bold;">${i+1}.</span> ${s}
    </div>`
  ).join('');
  const timer = def.timerMax ? `⏱ ${def.timerMax}s limit` : '⏱ No time limit';
  _briefEl.innerHTML = `
    <div style="color:#888;font-size:8px;letter-spacing:2px;margin-bottom:6px;">MISSION BRIEFING</div>
    <div style="color:#ffc820;font-size:13px;font-weight:bold;letter-spacing:2px;margin-bottom:4px;">${def.name}</div>
    <div style="color:#aaa;font-size:8px;margin-bottom:10px;font-style:italic;">"${def.dialog}"</div>
    <div style="color:#ffc820;font-size:8px;letter-spacing:1.5px;margin-bottom:5px;border-top:1px solid rgba(255,200,0,0.3);padding-top:7px;">OBJECTIVES</div>
    ${stepsHtml}
    <div style="margin-top:10px;border-top:1px solid rgba(255,200,0,0.25);padding-top:7px;display:flex;justify-content:space-between;font-size:8px;">
      <span style="color:#4fc870;">💰 REWARD: $${def.reward}</span>
      <span style="color:#aaa;">${timer}</span>
    </div>
    <div style="margin-top:8px;color:rgba(255,200,0,0.5);font-size:7px;text-align:center;letter-spacing:1px;">— ${zone.giver} —</div>
  `;
  _briefEl.style.display = 'block';
  clearTimeout(_briefEl._t);
  _briefEl._t = setTimeout(() => { _briefEl.style.display = 'none'; }, 5500);
}

function _showBanner(text) {
  if (!_bannerEl) return;
  _bannerEl.textContent = text;
  _bannerEl.style.opacity = '1';
  clearTimeout(_bannerEl._t);
  _bannerEl._t = setTimeout(() => { _bannerEl.style.opacity = '0'; }, 3600);
}

function _showZonePrompt(text) {
  if (!_zonePromptEl) return;
  _zonePromptEl.textContent = text;
  _zonePromptEl.style.display = 'block';
}

function _hideZonePrompt() {
  if (_zonePromptEl) _zonePromptEl.style.display = 'none';
}
