// ═══════════════════════════════════════════════════════════════
//  approval.js  –  CITY APPROVAL RATING
//
//  Tracks how the city feels about the player (0–100).
//  Actions raise or lower it. The rating unlocks perks at high
//  levels and imposes penalties at low levels.
//
//  TIERS:
//    80–100  HERO       — civilians tip you off, cops slower to respond
//    60–79   RESPECTED  — small cash bonus on kills, neutral civilians
//    40–59   NEUTRAL    — default city attitude
//    20–39   CRIMINAL   — civilians flee faster, gang aggro boost
//    0–19    VILLAIN    — cops spawn faster, civilians sprint away, bounty system
//
//  HOOKS (called automatically via recordKill / fireW / missions):
//    onApprovalKill(faction)   — called when player kills someone
//    onApprovalMission(won)    — called when mission completes/fails
//    onApprovalWanted(stars)   — called each frame while wanted
//
//  ACTIVATION — add in index.html after missions.js:
//    <script src="approval.js"></script>
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── TUNING ────────────────────────────────────────────────────
const APR_INIT          = 50;    // starting approval
const APR_DECAY_RATE    = 0.4;   // points/s lost while wanted (scales with stars)
const APR_REGEN_RATE    = 0.08;  // points/s slow passive regen toward NEUTRAL (40-60)
const APR_REGEN_TARGET  = 50;    // passive regen aims for this, not 100

// Per-action deltas
const APR_DELTA = {
  gang_kill   : +3,   // taking out gangsters — city likes it
  cop_kill    : -8,   // hurting law enforcement — bad look
  npc_kill    : -15,  // murdering civilians — very bad
  car_hit     : -2,   // ramming civilians in a vehicle
  mission_win : +10,  // completing a mission
  mission_fail: -4,   // failing a mission
};

// Tier thresholds
const APR_TIERS = [
  { min: 80, label: 'HERO',      color: '#00e87a', glow: 'rgba(0,232,122,0.55)'  },
  { min: 60, label: 'RESPECTED', color: '#7adf00', glow: 'rgba(122,223,0,0.45)'  },
  { min: 40, label: 'NEUTRAL',   color: '#aaaaaa', glow: 'rgba(170,170,170,0.3)' },
  { min: 20, label: 'CRIMINAL',  color: '#ff8800', glow: 'rgba(255,136,0,0.55)'  },
  { min:  0, label: 'VILLAIN',   color: '#ff2222', glow: 'rgba(255,34,34,0.65)'  },
];

// ── STATE ─────────────────────────────────────────────────────
let _approval      = APR_INIT;
let _prevTierLabel = 'NEUTRAL';
let _flashTimer    = 0;          // seconds remaining on bar flash animation
let _flashDelta    = 0;          // + or – to colour the flash
let _barEl         = null;
let _fillEl        = null;
let _labelEl       = null;
let _valueEl       = null;
let _tipTimer      = 0;          // cooldown before next civilian tip-off (HERO perk)

// ── PUBLIC API ────────────────────────────────────────────────

function initApproval() {
  _approval = APR_INIT;
  _prevTierLabel = 'NEUTRAL';
  _flashTimer = 0;
  _flashDelta = 0;
  _tipTimer   = 0;
  _buildHUD();
  _updateHUD();
  console.log('[approval] Approval rating initialised at', _approval);
}

function updateApproval(dt) {
  _tickDecay(dt);
  _tickRegen(dt);
  _tickPerks(dt);
  _flashTimer = Math.max(0, _flashTimer - dt);
  _updateHUD();
}

/** Called from recordKill() in world.js */
function onApprovalKill(faction) {
  const delta = APR_DELTA[faction + '_kill'] || 0;
  _change(delta);
}

/** Called when player rams a traffic/civilian car in game.js */
function onApprovalCarHit() {
  _change(APR_DELTA.car_hit);
}

/** Called from missions.js _completeMission / _failMission */
function onApprovalMission(won) {
  _change(won ? APR_DELTA.mission_win : APR_DELTA.mission_fail);
}

/** Returns current approval 0–100 */
function getApproval() { return _approval; }

/** Returns current tier object */
function getApprovalTier() {
  for (const t of APR_TIERS) if (_approval >= t.min) return t;
  return APR_TIERS[APR_TIERS.length - 1];
}

// ── GAMEPLAY EFFECTS (queried by other systems) ───────────────

/** Cop spawn interval multiplier — lower approval = faster spawns */
function approvalCopSpawnMult() {
  if (_approval >= 80) return 1.5;   // cops slower to respond (HERO)
  if (_approval >= 60) return 1.15;  // slightly slower
  if (_approval >= 40) return 1.0;   // normal
  if (_approval >= 20) return 0.80;  // faster spawns (CRIMINAL)
  return 0.55;                        // much faster (VILLAIN)
}

/** NPC flee range multiplier — lower approval = civilians flee sooner */
function approvalNPCFleeMult() {
  if (_approval >= 80) return 0.5;   // civilians aren't scared of you (HERO)
  if (_approval >= 60) return 0.75;
  if (_approval >= 40) return 1.0;   // normal
  if (_approval >= 20) return 1.4;
  return 2.0;                         // civilians sprint away immediately (VILLAIN)
}

/** Gang aggro range multiplier — lower approval = gangs more bold */
function approvalGangAggroMult() {
  if (_approval >= 60) return 0.85;  // gangs slightly calmer
  if (_approval >= 40) return 1.0;
  if (_approval >= 20) return 1.2;
  return 1.45;                        // gangs very aggressive (VILLAIN)
}

// ── INTERNALS ─────────────────────────────────────────────────

function _change(delta) {
  if (delta === 0) return;
  const prev = _approval;
  _approval = Math.max(0, Math.min(100, _approval + delta));

  // Flash animation
  _flashDelta = delta;
  _flashTimer = 0.7;

  // Tier-change notification
  const tier    = getApprovalTier();
  const tierNow = tier.label;
  if (tierNow !== _prevTierLabel) {
    const dir = _approval > prev ? '▲' : '▼';
    if (typeof showNotif === 'function')
      showNotif('APPROVAL ' + dir + ' ' + tierNow);
    _prevTierLabel = tierNow;
  }
}

function _tickDecay(dt) {
  if (typeof PL === 'undefined' || !PL.wanted) return;
  // Decay accelerates with star level
  const rate = APR_DECAY_RATE * PL.wanted;
  _change(-rate * dt);
}

function _tickRegen(dt) {
  // Passive regen only kicks in when no wanted stars and approval below regen target
  if (typeof PL !== 'undefined' && PL.wanted > 0) return;
  if (_approval < APR_REGEN_TARGET) {
    _approval = Math.min(APR_REGEN_TARGET, _approval + APR_REGEN_RATE * dt);
  }
}

function _tickPerks(dt) {
  // HERO perk: civilians occasionally drop cash near the player
  if (_approval >= 80 && typeof PL !== 'undefined') {
    _tipTimer -= dt;
    if (_tipTimer <= 0) {
      _tipTimer = 18 + Math.random() * 12; // every ~20s
      // Spawn a cash pickup near the player
      if (typeof spawnPick === 'function' && typeof isW === 'function' && typeof T !== 'undefined') {
        const angle = Math.random() * Math.PI * 2;
        const dist  = 60 + Math.random() * 80;
        const tx    = Math.floor((PL.x + Math.cos(angle) * dist) / T);
        const ty    = Math.floor((PL.y + Math.sin(angle) * dist) / T);
        if (tx >= 0 && ty >= 0 && tx < WW && ty < WH && isW(tx, ty)) {
          spawnPick(tx * T + T / 2, ty * T + T / 2, 'cash');
          if (typeof showNotif === 'function') showNotif('CITY TIP-OFF  +CASH  ❤');
        }
      }
    }
  } else {
    _tipTimer = 0; // reset when no longer HERO so it fires quickly on next unlock
  }
}

// ── HUD ───────────────────────────────────────────────────────

function _buildHUD() {
  // Guard: if panel already exists just grab refs, don't insert again
  const existing = document.getElementById('aprPanel');
  if (existing) {
    _fillEl  = document.getElementById('aprFill');
    _labelEl = document.getElementById('aprLabel');
    _valueEl = document.getElementById('aprValue');
    return;
  }

  const topBar = document.getElementById('topBar');
  if (!topBar) return;

  const panel = document.createElement('div');
  panel.className = 'hb';
  panel.id = 'aprPanel';
  panel.innerHTML = `
    <div class="hl">
      <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true" style="color:var(--gold)">
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm9 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-.25-6.25a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5z"/>
      </svg>
      Approval
    </div>
    <div id="aprBar" style="
      width:100%;height:4px;background:#111;border-radius:2px;
      margin:3px 0 2px;overflow:hidden;position:relative;
    ">
      <div id="aprFill" style="
        height:100%;width:50%;border-radius:2px;
        background:#aaa;transition:width .35s,background .4s;
      "></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;">
      <div class="hv" id="aprLabel" style="font-size:13px;">NEUTRAL</div>
      <div class="hv" id="aprValue" style="font-size:11px;opacity:0.6;">50</div>
    </div>
  `;
  topBar.appendChild(panel);

  _fillEl  = document.getElementById('aprFill');
  _labelEl = document.getElementById('aprLabel');
  _valueEl = document.getElementById('aprValue');
}

function _updateHUD() {
  if (!_fillEl) return;
  const tier = getApprovalTier();
  const pct  = _approval + '%';

  // Bar colour — flash briefly on change
  let col = tier.color;
  if (_flashTimer > 0) {
    col = _flashDelta > 0 ? '#00ff88' : '#ff4444';
  }

  _fillEl.style.width      = pct;
  _fillEl.style.background = col;
  _fillEl.style.boxShadow  = `0 0 6px ${tier.glow}`;
  _labelEl.textContent     = tier.label;
  _labelEl.style.color     = tier.color;
  _valueEl.textContent     = Math.floor(_approval);
}
