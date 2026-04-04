// ═══════════════════════════════════════════════════════════════
//  island_b.js  –  DYNAMIC EVENTS & WEATHER (Future Update Slot B)
//
//  Drop-in expansion module. Activate by adding this file to
//  index.html after game.js:
//    <script src="island_b.js"></script>
//
//  Then call  initEvents()  inside startGame() in game.js.
//  Then call  updateEvents(dt)  inside update(dt) in game.js.
//  Then call  renderWeather(CX)  at end of render() in game.js.
//
//  Depends on: world.js, assets.js, game.js
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── WEATHER STATES ────────────────────────────────────────────
const WEATHERS = {
  clear:  { name: 'CLEAR',    fogAlpha: 0,    rainCount: 0,   speedMult: 1.0, visMult: 1.0 },
  cloudy: { name: 'OVERCAST', fogAlpha: 0.08, rainCount: 0,   speedMult: 1.0, visMult: 0.85 },
  rain:   { name: 'RAIN',     fogAlpha: 0.18, rainCount: 200, speedMult: 0.85,visMult: 0.7  },
  storm:  { name: 'STORM',    fogAlpha: 0.30, rainCount: 500, speedMult: 0.75,visMult: 0.55 },
  fog:    { name: 'FOGGY',    fogAlpha: 0.45, rainCount: 0,   speedMult: 0.9, visMult: 0.5  },
};
const WEATHER_ORDER = ['clear','cloudy','rain','storm','fog','clear'];

let currentWeather = 'clear';
let weatherTimer   = 60;      // seconds until next weather change
let rainDrops      = [];
let lightningT     = 0;
let lightningFlash = 0;

// ── DYNAMIC EVENTS ────────────────────────────────────────────
const EVENT_TYPES = [
  {
    id: 'car_chase',
    name: 'CAR CHASE IN PROGRESS',
    desc: 'A getaway car is being chased by cops across the city.',
    duration: 45,
    icon: '🚔',
  },
  {
    id: 'gang_war',
    name: 'GANG WAR ERUPTED',
    desc: 'Two rival gangs are fighting it out. Stay clear or get involved.',
    duration: 60,
    icon: '💀',
  },
  {
    id: 'armoured_truck',
    name: 'ARMOURED TRUCK SPOTTED',
    desc: 'An armoured cash truck is moving through the city. Rob it for a big score.',
    duration: 90,
    icon: '💰',
  },
  {
    id: 'police_sweep',
    name: 'POLICE SWEEP ACTIVE',
    desc: 'All cops are on high alert. Avoid them or lay low.',
    duration: 40,
    icon: '🚨',
  },
  {
    id: 'riot',
    name: 'CIVILIAN RIOT',
    desc: 'NPCs are rioting. Vehicle traffic is blocked in several areas.',
    duration: 75,
    icon: '🔥',
  },
];

let activeEvent    = null;
let eventTimer     = 0;
let nextEventTimer = 90 + Math.random() * 60; // first event in 90–150s
let eventBannerEl  = null;

// ── PUBLIC API ────────────────────────────────────────────────

function initEvents() {
  // Weather HUD chip
  const wEl = document.createElement('div');
  wEl.id = 'weatherChip';
  wEl.style.cssText = `
    position:absolute; top:10px; left:50%; transform:translateX(-50%);
    background:rgba(5,5,15,0.82); border:1px solid rgba(255,255,255,0.12);
    border-radius:3px; padding:3px 10px; font-family:'Share Tech Mono',monospace;
    font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.4);
    pointer-events:none; z-index:11; text-transform:uppercase;
  `;
  document.getElementById('gc').appendChild(wEl);

  // Event banner
  eventBannerEl = document.createElement('div');
  eventBannerEl.id = 'eventBanner';
  eventBannerEl.style.cssText = `
    position:absolute; top:130px; left:50%; transform:translateX(-50%);
    background:rgba(5,5,15,0.94); border:1px solid rgba(255,80,0,0.5);
    border-radius:4px; padding:8px 18px; font-family:'Bebas Neue',sans-serif;
    font-size:15px; color:#ff8800; letter-spacing:3px; z-index:22;
    opacity:0; transition:opacity .3s; pointer-events:none; text-align:center;
    line-height:1.6; max-width:280px; white-space:normal;
  `;
  document.getElementById('gc').appendChild(eventBannerEl);

  _initRain();
  console.log('[island_b] Events & Weather system initialised');
}

function updateEvents(dt) {
  _updateWeather(dt);
  _updateDynamicEvent(dt);
}

function renderWeather(CX) {
  _renderRain(CX);
  _renderFog(CX);
  _renderLightning(CX);
}

// ── WEATHER INTERNALS ─────────────────────────────────────────

function _initRain() {
  rainDrops = [];
  for (let i = 0; i < 600; i++) {
    rainDrops.push({
      x: Math.random(),   // 0–1 normalised screen x
      y: Math.random(),   // 0–1 normalised screen y
      spd: 0.4 + Math.random() * 0.6,
      len: 8 + Math.random() * 10,
      alpha: 0.3 + Math.random() * 0.4,
    });
  }
}

function _updateWeather(dt) {
  weatherTimer -= dt;
  if (weatherTimer <= 0) {
    const idx = WEATHER_ORDER.indexOf(currentWeather);
    const next = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
    _setWeather(next);
    weatherTimer = 50 + Math.random() * 60;
  }
  // Lightning in storms
  if (currentWeather === 'storm') {
    lightningT -= dt;
    if (lightningT <= 0) {
      lightningFlash = 0.08 + Math.random() * 0.12;
      lightningT = 3 + Math.random() * 5;
    }
    if (lightningFlash > 0) lightningFlash = Math.max(0, lightningFlash - dt * 3);
  }
  // Update weather chip label
  const wEl = document.getElementById('weatherChip');
  if (wEl) {
    const w = WEATHERS[currentWeather];
    const icons = { clear:'☀', cloudy:'☁', rain:'🌧', storm:'⛈', fog:'🌫' };
    wEl.textContent = (icons[currentWeather] || '') + '  ' + w.name;
  }
}

function _setWeather(name) {
  currentWeather = name;
  if (typeof showNotif === 'function') showNotif('WEATHER: ' + WEATHERS[name].name);
}

function _renderRain(CX) {
  const w = WEATHERS[currentWeather];
  if (!w || w.rainCount === 0 || typeof W === 'undefined') return;
  const count = Math.min(w.rainCount, rainDrops.length);
  CX.save();
  CX.strokeStyle = 'rgba(180,200,255,0.35)';
  CX.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const d = rainDrops[i];
    d.y += d.spd * 0.016;
    if (d.y > 1) { d.y = 0; d.x = Math.random(); }
    const sx = d.x * W, sy = d.y * H;
    CX.globalAlpha = d.alpha;
    CX.beginPath();
    CX.moveTo(sx, sy);
    CX.lineTo(sx - 2, sy + d.len);
    CX.stroke();
  }
  CX.globalAlpha = 1;
  CX.restore();
}

function _renderFog(CX) {
  const w = WEATHERS[currentWeather];
  if (!w || w.fogAlpha === 0 || typeof W === 'undefined') return;
  // Radial fog – thicker at edges
  const fg = CX.createRadialGradient(W/2, H/2, H*0.1, W/2, H/2, H*0.8);
  fg.addColorStop(0, `rgba(180,200,220,0)`);
  fg.addColorStop(1, `rgba(180,200,220,${w.fogAlpha})`);
  CX.fillStyle = fg;
  CX.fillRect(0, 0, W, H);
}

function _renderLightning(CX) {
  if (lightningFlash <= 0 || typeof W === 'undefined') return;
  CX.fillStyle = `rgba(200,220,255,${lightningFlash})`;
  CX.fillRect(0, 0, W, H);
}

// ── DYNAMIC EVENT INTERNALS ───────────────────────────────────

function _updateDynamicEvent(dt) {
  nextEventTimer -= dt;
  if (!activeEvent && nextEventTimer <= 0) {
    _triggerRandomEvent();
    nextEventTimer = 80 + Math.random() * 60;
  }
  if (activeEvent) {
    eventTimer -= dt;
    if (eventTimer <= 0) _endEvent();
  }
}

function _triggerRandomEvent() {
  const e = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  activeEvent = e;
  eventTimer  = e.duration;
  if (eventBannerEl) {
    eventBannerEl.innerHTML = e.icon + '  ' + e.name + '<br><span style="font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:1px">' + e.desc + '</span>';
    eventBannerEl.style.opacity = '1';
    clearTimeout(eventBannerEl._t);
    eventBannerEl._t = setTimeout(() => { eventBannerEl.style.opacity = '0'; }, 4000);
  }
  console.log('[island_b] Event triggered:', e.name);
}

function _endEvent() {
  console.log('[island_b] Event ended:', activeEvent && activeEvent.name);
  activeEvent = null;
}

// ── WEATHER EFFECT GETTERS (call from game.js if island_b loaded) ──

/** Returns current car speed multiplier (slippery roads in rain/storm) */
function weatherSpeedMult() {
  return WEATHERS[currentWeather] ? WEATHERS[currentWeather].speedMult : 1;
}

/** Returns current visibility multiplier (affects cop sight range) */
function weatherVisMult() {
  return WEATHERS[currentWeather] ? WEATHERS[currentWeather].visMult : 1;
}

/** Returns name of active dynamic event, or null */
function getActiveEvent() {
  return activeEvent ? activeEvent.id : null;
}
