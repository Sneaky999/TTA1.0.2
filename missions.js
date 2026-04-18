// ═══════════════════════════════════════════════════════════════
//  missions.js  –  MISSIONS SYSTEM
//
//  Walk into a mission zone to accept a job. Progress is tracked
//  via recordKill() in world.js → reportMissionKill() here.
//  Mission waypoints appear on both the main view and full map.
//
//  Activated in index.html after ai.js:
//    <script src="missions.js"></script>
//
//  Depends on: world.js, game.js, ai.js
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── MISSION PICKUP ZONES ──────────────────────────────────────
// Small areas on the map. Player walks in → mission offered/started.
// Shown as gold "M" markers on the full map.
const MISSION_ZONES = [
  { x1:30, y1:30, x2:35, y2:35, missionId:'delivery_01', name:'PHONE BOOTH'   },
  { x1:90, y1:93, x2:96, y2:99, missionId:'hit_01',      name:'CONTACT'       },
  { x1:75, y1:15, x2:81, y2:21, missionId:'rampage_01',  name:'GANG BOSS'     },
  { x1:21, y1:72, x2:27, y2:78, missionId:'escape_01',   name:'SAFEHOUSE'     },
  { x1:127,y1:45,x2:133, y2:51, missionId:'patrol_01',   name:'COP INFORMANT' },
  { x1:80, y1:112,x2:86,y2:118, missionId:'delivery_02', name:'NORTHGATE JOB' },
];

// ── MISSION DEFINITIONS ───────────────────────────────────────
const MISSION_DEFS = {

  delivery_01: {
    name: 'HOT PACKAGE',
    desc: 'Pick up the package and deliver it — fast.',
    reward: 600,
    wantedPenalty: 0,
    type: 'delivery',
    timerMax: 70,
    count: 1,
  },

  hit_01: {
    name: 'THE CONTRACT',
    desc: 'Eliminate the marked target. Stay out of sight.',
    reward: 900,
    wantedPenalty: 2,
    type: 'elimination',
    timerMax: null,
    count: 1,
  },

  rampage_01: {
    name: 'GANG SWEEP',
    desc: 'Take out 10 gang members before time runs out.',
    reward: 1400,
    wantedPenalty: 1,
    type: 'rampage',
    target: 'gang',
    timerMax: 90,
    count: 10,
  },

  escape_01: {
    name: 'HOT PURSUIT',
    desc: 'Get to 3+ stars, then reach the safe zone.',
    reward: 1600,
    wantedPenalty: 0,
    type: 'escape',
    timerMax: null,
    count: 1,
  },

  delivery_02: {
    name: 'NORTHGATE EXPRESS',
    desc: 'Deliver a package across the expanded city. Time is tight.',
    reward: 700,
    wantedPenalty: 0,
    type: 'delivery',
    timerMax: 90,
    count: 1,
  },

  patrol_01: {
    name: 'INFORMANT RUN',
    desc: 'Kill 5 cops without dying. Dirty work pays well.',
    reward: 2000,
    wantedPenalty: 3,
    type: 'rampage',
    target: 'cop',
    timerMax: 120,
    count: 5,
  },
};

// ── RUNTIME STATE ─────────────────────────────────────────────
let activeMission  = null;  // current mission object (clone of def + runtime fields)
let missionPhase   = 'idle'; // 'idle' | 'active' | 'success' | 'failed'
let _completedIds  = new Set();
let _bannerEl      = null;
let _hudEl         = null;
let _zonePromptEl  = null;
let _lastZoneId    = null;   // mission zone player is currently inside
let _offerTimer    = 0;      // auto-accept delay
let _targetNPC     = null;   // spawned hit target entity

// ── PUBLIC API ────────────────────────────────────────────────

function initMissions() {
  _buildUI();
  console.log('[missions] System ready — ' + Object.keys(MISSION_DEFS).length + ' missions loaded');
}

/** Called every frame from game.js update() hook */
function updateMissions(dt) {
  _checkZones(dt);
  if (missionPhase !== 'active' || !activeMission) return;
  const m = activeMission;

  // Countdown timer
  if (m.timerMax !== null) {
    m.timer -= dt;
    _updateHUD();
    if (m.timer <= 0) { _failMission('TIME EXPIRED'); return; }
  }

  // Per-type win condition checks
  if (m.type === 'rampage') {
    if (m.progress >= m.count) { _completeMission(); return; }
  }

  if (m.type === 'delivery') {
    if (m.phase === 'pickup' && m.pickup) {
      // Close enough to pickup point?
      if (d2(PL.x, PL.y, m.pickup.x, m.pickup.y) < 45*45) {
        m.phase = 'deliver';
        m.target = _randRoadPt(400); // new destination
        _showBanner('PACKAGE PICKED UP — DELIVER IT!');
        _updateHUD();
      }
    } else if (m.phase === 'deliver' && m.target) {
      if (d2(PL.x, PL.y, m.target.x, m.target.y) < 50*50) {
        _completeMission();
      }
    }
  }

  if (m.type === 'escape') {
    if (m.target && PL.wanted >= 3) {
      if (d2(PL.x, PL.y, m.target.x, m.target.y) < 60*60) {
        _completeMission();
      }
    }
  }

  if (m.type === 'elimination') {
    // Target NPC removed from npcs array = dead
    if (_targetNPC && !npcs.includes(_targetNPC)) {
      _completeMission();
    }
  }
}

/** Called by renderMissions hook in game.js render() */
function renderMissions(ctx, cam, W, H) {
  if (missionPhase !== 'active' || !activeMission) return;
  const m = activeMission;

  // Determine which point to draw waypoint at
  const wp = m.type === 'delivery' && m.phase === 'pickup' ? m.pickup : m.target;
  if (!wp) return;

  const sx = (wp.x - cam.x) + W/2;
  const sy = (wp.y - cam.y) + H/2;

  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 260);
  const r = 20 + pulse * 6;

  ctx.save();
  // Outer pulse ring
  ctx.strokeStyle = `rgba(255,210,0,${0.5 + pulse * 0.45})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // Inner fill
  ctx.fillStyle = `rgba(255,210,0,${0.15 + pulse * 0.12})`;
  ctx.beginPath(); ctx.arc(sx, sy, 13, 0, Math.PI * 2); ctx.fill();
  // Star icon
  ctx.fillStyle = `rgba(255,220,60,${0.85 + pulse * 0.15})`;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('★', sx, sy);

  // Off-screen arrow if waypoint is off screen
  const margin = 40;
  const offScreen = sx < margin || sx > W - margin || sy < margin || sy > H - margin;
  if (offScreen) {
    const ang = Math.atan2(wp.y - PL.y, wp.x - PL.x);
    const ax = W/2 + Math.cos(ang) * (Math.min(W, H)/2 - margin);
    const ay = H/2 + Math.sin(ang) * (Math.min(W, H)/2 - margin);
    ctx.fillStyle = 'rgba(255,210,0,0.9)';
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(10, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Timer bar
  if (m.timerMax !== null) {
    const pct = Math.max(0, m.timer / m.timerMax);
    const bw = 100, bh = 6, bx = W/2 - bw/2, by = 90;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = pct > 0.4 ? '#ffc820' : '#ff3322';
    ctx.fillRect(bx, by, bw * pct, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(m.timer) + 's', W/2, by + bh/2);
  }
  ctx.restore();
}

/** Called by recordKill() in world.js for every player kill */
function reportMissionKill(faction) {
  if (missionPhase !== 'active' || !activeMission) return;
  const m = activeMission;
  if (m.type !== 'rampage') return;
  if (m.target !== faction) return;
  m.progress++;
  _showBanner(m.name + '  ' + m.progress + ' / ' + m.count);
  _updateHUD();
}

// ── INTERNALS ─────────────────────────────────────────────────

function _checkZones(dt) {
  if (missionPhase === 'active') { _lastZoneId = null; _hideZonePrompt(); return; }

  const ptx = Math.floor(PL.x / T), pty = Math.floor(PL.y / T);
  let insideZone = null;
  for (const mz of MISSION_ZONES) {
    if (ptx >= mz.x1 && ptx < mz.x2 && pty >= mz.y1 && pty < mz.y2) {
      insideZone = mz; break;
    }
  }

  if (!insideZone) {
    _lastZoneId = null; _offerTimer = 0; _hideZonePrompt(); return;
  }

  const id = insideZone.missionId;
  if (_completedIds.has(id)) {
    _showZonePrompt('[ ' + insideZone.name + ' ] MISSION COMPLETE'); return;
  }

  // Show offer prompt
  if (_lastZoneId !== id) {
    _lastZoneId = id; _offerTimer = 0;
    const def = MISSION_DEFS[id];
    _showZonePrompt('[ ' + insideZone.name + ' ]  ' + def.name + ' — STAY TO ACCEPT');
  }

  // Auto-accept after 1.8s in zone
  _offerTimer += dt;
  if (_offerTimer >= 1.8) {
    _offerTimer = 0;
    _startMission(id, insideZone);
  }
}

function _startMission(id, zone) {
  const def = MISSION_DEFS[id];
  if (!def) return;

  activeMission = {
    id,
    ...def,
    progress : 0,
    timer    : def.timerMax || 0,
    phase    : 'pickup',       // delivery uses phase
    pickup   : null,
    target   : null,
  };
  missionPhase = 'active';
  _targetNPC   = null;
  _hideZonePrompt();

  // Set up targets
  if (def.type === 'delivery') {
    activeMission.pickup = _randRoadPt(300);
    activeMission.target = null;
  } else if (def.type === 'escape') {
    // Safe zone is the hospital area
    const hz = SPECIAL_ZONES.hospital;
    activeMission.target = {
      x: ((hz.x1 + hz.x2) / 2) * T,
      y: ((hz.y1 + hz.y2) / 2) * T,
    };
  } else if (def.type === 'elimination') {
    // Spawn a bright-red target NPC far from player
    _targetNPC = _spawnTargetNPC();
    activeMission.target = _targetNPC ? { x: _targetNPC.x, y: _targetNPC.y } : _randRoadPt(500);
  } else if (def.type === 'rampage') {
    activeMission.target = def.target; // 'gang' | 'cop'
  }

  _showBanner('MISSION START — ' + def.name.toUpperCase());
  _updateHUD();
  _buildHUD();
}

function _completeMission() {
  if (!activeMission) return;
  const m = activeMission;
  _completedIds.add(m.id);
  missionPhase = 'success';
  PL.cash  += m.reward;
  PL.score += m.reward;
  if (typeof onApprovalMission === 'function') onApprovalMission(true);
  // Remove target NPC from world if it's still alive
  if (_targetNPC) {
    const idx = npcs.indexOf(_targetNPC);
    if (idx >= 0) npcs.splice(idx, 1);
  }
  _showBanner('MISSION COMPLETE  +$' + m.reward + ' ✓');
  _hideHUD();
  setTimeout(() => { missionPhase = 'idle'; activeMission = null; _targetNPC = null; }, 3200);
}

function _failMission(reason) {
  missionPhase = 'failed';
  if (activeMission && activeMission.wantedPenalty > 0) addWanted(activeMission.wantedPenalty);
  if (typeof onApprovalMission === 'function') onApprovalMission(false);
  // Clean up target NPC
  if (_targetNPC) {
    const idx = npcs.indexOf(_targetNPC);
    if (idx >= 0) npcs.splice(idx, 1);
  }
  _showBanner('MISSION FAILED — ' + (reason || ''));
  _hideHUD();
  setTimeout(() => { missionPhase = 'idle'; activeMission = null; _targetNPC = null; }, 2800);
}

// ── HELPERS ───────────────────────────────────────────────────

function _randRoadPt(minDist) {
  const tiles = [];
  for (let y = MAP_EDGE_MARGIN; y < WH - MAP_EDGE_MARGIN; y++)
    for (let x = MAP_EDGE_MARGIN; x < WW - MAP_EDGE_MARGIN; x++)
      if (WD[y][x] === 1) {
        const wx = x * T + T/2, wy = y * T + T/2;
        if (!minDist || d2(wx, wy, PL.x, PL.y) > minDist * minDist)
          tiles.push({ x: wx, y: wy });
      }
  return tiles[Math.floor(Math.random() * tiles.length)] || { x: PL.x + 400, y: PL.y };
}

function _spawnTargetNPC() {
  // Place target NPC in a gang zone, far from player
  const zones = [SPECIAL_ZONES.gangA, SPECIAL_ZONES.gangB];
  const z = zones[Math.floor(Math.random() * zones.length)];
  const tx = z.x1 + Math.floor(Math.random() * (z.x2 - z.x1));
  const ty = z.y1 + Math.floor(Math.random() * (z.y2 - z.y1));
  const npc = {
    x: tx * T + T/2, y: ty * T + T/2,
    w: 12, h: 12,
    hp: 60, maxHp: 60,
    spd: 55,
    angle: 0, timer: 0,
    col: '#ff2200',
    cash: 200,
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
  // Guard against double-init on game restart
  const gc = document.getElementById('gc');
  if (!gc) return;
  if (document.getElementById('missionBanner')) {
    _bannerEl     = document.getElementById('missionBanner');
    _zonePromptEl = document.getElementById('missionZonePrompt');
    _hudEl        = document.getElementById('missionHud');
    return;
  }
  // Banner (middle screen flash)
  _bannerEl = document.createElement('div');
  _bannerEl.id = 'missionBanner';
  _bannerEl.style.cssText = `
    position:absolute;top:38%;left:50%;transform:translateX(-50%);
    background:rgba(5,5,15,0.93);border:1px solid rgba(255,200,0,0.45);
    border-radius:5px;padding:10px 22px;font-family:'Bebas Neue',monospace;
    font-size:15px;color:#ffc820;letter-spacing:2.5px;z-index:30;
    opacity:0;transition:opacity .25s;pointer-events:none;
    white-space:pre;text-align:center;line-height:1.7;
  `;
  document.getElementById('gc').appendChild(_bannerEl);

  // Zone prompt (bottom centre)
  _zonePromptEl = document.createElement('div');
  _zonePromptEl.id = 'missionZonePrompt';
  _zonePromptEl.style.cssText = `
    position:absolute;bottom:calc(var(--ctrl-h, 155px) + 14px);left:50%;transform:translateX(-50%);
    background:rgba(0,0,0,0.82);border:1px solid rgba(255,200,0,0.45);
    border-radius:4px;padding:8px 18px;font-family:'Share Tech Mono',monospace;
    font-size:10px;color:rgba(255,200,0,0.9);letter-spacing:1.5px;z-index:25;
    display:none;pointer-events:none;text-align:center;white-space:nowrap;
    box-shadow:0 2px 12px rgba(0,0,0,0.7);
  `;
  document.getElementById('gc').appendChild(_zonePromptEl);

  // Active mission HUD (top right under HUD)
  _hudEl = document.createElement('div');
  _hudEl.id = 'missionHud';
  _hudEl.style.cssText = `
    position:absolute;top:68px;right:12px;
    background:rgba(5,5,15,0.82);border:1px solid rgba(255,200,0,0.25);
    border-radius:4px;padding:6px 10px;font-family:'Share Tech Mono',monospace;
    font-size:9px;color:#ffc820;letter-spacing:1.5px;z-index:22;
    display:none;min-width:140px;line-height:1.6;
  `;
  document.getElementById('gc').appendChild(_hudEl);
}

function _buildHUD() {
  if (!_hudEl || !activeMission) return;
  _hudEl.style.display = 'block';
  _updateHUD();
}

function _updateHUD() {
  if (!_hudEl || !activeMission) return;
  const m = activeMission;
  let lines = '[ MISSION ]\n' + m.name;
  if (m.type === 'rampage') lines += '\n' + m.progress + ' / ' + m.count + ' kills';
  if (m.timerMax !== null)  lines += '\n⏱ ' + Math.ceil(m.timer) + 's';
  if (m.type === 'delivery' && m.phase === 'pickup') lines += '\nGO TO PICKUP';
  if (m.type === 'delivery' && m.phase === 'deliver') lines += '\nDELIVER NOW';
  if (m.type === 'escape')  lines += '\nNEED ★★★ + SAFE ZONE';
  _hudEl.style.whiteSpace = 'pre';
  _hudEl.textContent = lines;
}

function _hideHUD() { if (_hudEl) _hudEl.style.display = 'none'; }

function _showBanner(text) {
  if (!_bannerEl) return;
  _bannerEl.textContent = text;
  _bannerEl.style.opacity = '1';
  clearTimeout(_bannerEl._t);
  _bannerEl._t = setTimeout(() => { _bannerEl.style.opacity = '0'; }, 3200);
}

function _showZonePrompt(text) {
  if (!_zonePromptEl) return;
  _zonePromptEl.textContent = text;
  _zonePromptEl.style.display = 'block';
}

function _hideZonePrompt() {
  if (_zonePromptEl) _zonePromptEl.style.display = 'none';
}
