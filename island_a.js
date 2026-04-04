// ═══════════════════════════════════════════════════════════════
//  island_a.js  –  MISSIONS SYSTEM (Future Update Slot A)
//
//  Drop-in expansion module. Activate by adding this file to
//  index.html after game.js:
//    <script src="island_a.js"></script>
//
//  Then call  initMissions()  inside startGame() in game.js.
//
//  Depends on: world.js, assets.js, game.js
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── MISSION REGISTRY ──────────────────────────────────────────
// Each mission: { id, name, desc, reward, wantedPenalty,
//                zone, type, target, count, progress, done }
const MISSIONS = [
  {
    id: 'delivery_01',
    name: 'HOT PACKAGE',
    desc: 'Pick up the package and deliver it before the timer runs out.',
    reward: 500,
    wantedPenalty: 0,
    zone: null,          // set on spawn
    type: 'delivery',
    target: null,        // world-space {x,y} set on spawn
    count: 1,
    progress: 0,
    done: false,
    timerMax: 60,        // seconds
    timer: 0,
  },
  {
    id: 'hit_01',
    name: 'THE CONTRACT',
    desc: 'Eliminate the target. Do not attract police attention.',
    reward: 800,
    wantedPenalty: 2,
    zone: null,
    type: 'elimination',
    target: null,        // NPC entity reference set on spawn
    count: 1,
    progress: 0,
    done: false,
  },
  {
    id: 'rampage_01',
    name: 'GANG SWEEP',
    desc: 'Take out 10 gang members in under 90 seconds.',
    reward: 1200,
    wantedPenalty: 1,
    zone: 'gangA',
    type: 'rampage',
    target: 'gang',
    count: 10,
    progress: 0,
    done: false,
    timerMax: 90,
    timer: 0,
  },
  {
    id: 'escape_01',
    name: 'HOT PURSUIT',
    desc: 'Reach the safe house while being chased by 5+ stars.',
    reward: 1500,
    wantedPenalty: 0,
    zone: null,
    type: 'escape',
    target: null,        // safe house coords
    count: 1,
    progress: 0,
    done: false,
  },
];

let activeMission = null;
let missionPhase  = 'idle'; // 'idle' | 'active' | 'success' | 'failed'
let missionNotifEl = null;

// ── PUBLIC API ────────────────────────────────────────────────

/** Called from game.js startGame() – sets up the missions HUD element */
function initMissions() {
  missionNotifEl = document.createElement('div');
  missionNotifEl.id = 'missionBanner';
  missionNotifEl.style.cssText = `
    position:absolute; bottom:200px; left:50%; transform:translateX(-50%);
    background:rgba(5,5,15,0.92); border:1px solid rgba(255,200,0,0.4);
    border-radius:4px; padding:8px 18px; font-family:'Bebas Neue',sans-serif;
    font-size:14px; color:#ffc820; letter-spacing:2px; z-index:22;
    opacity:0; transition:opacity .3s; pointer-events:none; white-space:nowrap;
    text-align:center; line-height:1.6;
  `;
  document.getElementById('gc').appendChild(missionNotifEl);
  console.log('[island_a] Missions system initialised – ' + MISSIONS.length + ' missions loaded');
}

/** Start a specific mission by id. Call from a mission-board pickup or phone */
function startMission(id) {
  const m = MISSIONS.find(m => m.id === id && !m.done);
  if (!m) return;
  activeMission = m;
  m.progress = 0;
  if (m.timer !== undefined) m.timer = m.timerMax;
  missionPhase = 'active';
  _showMissionBanner('MISSION START\n' + m.name.toUpperCase());
  _spawnMissionTarget(m);
}

/** Tick – call this inside game.js update(dt) if island_a is loaded */
function updateMissions(dt) {
  if (missionPhase !== 'active' || !activeMission) return;
  const m = activeMission;

  // Timer countdown
  if (m.timer !== undefined) {
    m.timer -= dt;
    if (m.timer <= 0) {
      _failMission('TIME EXPIRED');
      return;
    }
  }

  // Progress checks per mission type
  if (m.type === 'rampage') {
    // Hook: game.js notifies via  reportMissionKill('gang')
    if (m.progress >= m.count) _completeMission();
  }
  if (m.type === 'delivery') {
    // Hook: game.js checks player proximity to m.target
    if (m.target && typeof PL !== 'undefined') {
      const dx = PL.x - m.target.x, dy = PL.y - m.target.y;
      if (dx*dx + dy*dy < 50*50) _completeMission();
    }
  }
  if (m.type === 'escape') {
    if (m.target && typeof PL !== 'undefined') {
      const dx = PL.x - m.target.x, dy = PL.y - m.target.y;
      if (dx*dx + dy*dy < 60*60 && typeof PL.wanted !== 'undefined' && PL.wanted >= 5) _completeMission();
    }
  }
}

/** Call from game.js whenever a relevant kill happens */
function reportMissionKill(faction) {
  if (missionPhase !== 'active' || !activeMission) return;
  const m = activeMission;
  if (m.type === 'rampage' && m.target === faction) {
    m.progress++;
    _showMissionBanner(m.name + '\n' + m.progress + ' / ' + m.count);
  }
  if (m.type === 'elimination' && faction === 'npc' && m.progress === 0) {
    m.progress = 1;
    _completeMission();
  }
}

// ── INTERNALS ─────────────────────────────────────────────────

function _spawnMissionTarget(m) {
  // Stub: real implementation would place a blinking waypoint on the map
  // and optionally spawn a special NPC entity
  if (m.type === 'delivery' || m.type === 'escape') {
    // Place target at a random safe road tile far from player
    let tx, ty;
    for (let tries = 0; tries < 100; tries++) {
      tx = Math.floor(Math.random() * WW);
      ty = Math.floor(Math.random() * WH);
      if (typeof WD !== 'undefined' && WD[ty] && WD[ty][tx] === 1) break;
    }
    m.target = { x: tx * (typeof T !== 'undefined' ? T : 40) + 20,
                 y: ty * (typeof T !== 'undefined' ? T : 40) + 20 };
  }
}

function _completeMission() {
  if (!activeMission) return;
  const m = activeMission;
  m.done = true;
  missionPhase = 'success';
  if (typeof PL !== 'undefined') {
    PL.cash  = (PL.cash  || 0) + m.reward;
    PL.score = (PL.score || 0) + m.reward;
  }
  _showMissionBanner('MISSION COMPLETE\n+$' + m.reward);
  setTimeout(() => { missionPhase = 'idle'; activeMission = null; }, 3000);
}

function _failMission(reason) {
  missionPhase = 'failed';
  if (activeMission && typeof PL !== 'undefined' && activeMission.wantedPenalty > 0) {
    if (typeof addWanted === 'function') addWanted(activeMission.wantedPenalty);
  }
  _showMissionBanner('MISSION FAILED\n' + (reason || ''));
  setTimeout(() => { missionPhase = 'idle'; activeMission = null; }, 2500);
}

function _showMissionBanner(text) {
  if (!missionNotifEl) return;
  missionNotifEl.textContent = text;
  missionNotifEl.style.opacity = '1';
  clearTimeout(missionNotifEl._t);
  missionNotifEl._t = setTimeout(() => { missionNotifEl.style.opacity = '0'; }, 3000);
}

// ── RENDER HOOK (call from game.js render() if island_a loaded) ──
function renderMissions(CX, cam, W, H) {
  if (missionPhase !== 'active' || !activeMission) return;
  const m = activeMission;
  if (!m.target) return;

  // Draw waypoint arrow / blinking circle on map
  const s = typeof ws === 'function' ? ws(m.target.x, m.target.y) : null;
  if (!s) return;

  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 280);
  CX.save();
  CX.strokeStyle = `rgba(255,200,0,${0.6 + pulse * 0.4})`;
  CX.lineWidth = 2.5;
  CX.setLineDash([6, 4]);
  CX.beginPath();
  CX.arc(s.x, s.y, 18 + pulse * 6, 0, Math.PI * 2);
  CX.stroke();
  CX.setLineDash([]);

  CX.fillStyle = `rgba(255,200,0,${pulse * 0.3})`;
  CX.beginPath();
  CX.arc(s.x, s.y, 14, 0, Math.PI * 2);
  CX.fill();

  CX.fillStyle = '#ffc820';
  CX.font = 'bold 11px monospace';
  CX.textAlign = 'center';
  CX.textBaseline = 'middle';
  CX.fillText('★', s.x, s.y);

  // Timer display near target
  if (m.timer !== undefined) {
    CX.fillStyle = m.timer < 15 ? '#f44' : '#ffc820';
    CX.font = 'bold 12px monospace';
    CX.fillText(Math.ceil(m.timer) + 's', s.x, s.y - 26);
  }
  CX.restore();
}
