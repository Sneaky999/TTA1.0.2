// ═══════════════════════════════════════════════════════════════
//  architecture.js  –  STRUCTURES & BUILDING PLACEMENT
//
//  Defines named landmark buildings drawn on top of the tile grid.
//  Each structure has:
//    • A fixed tile position (tx, ty) and size in tiles (tw, th)
//    • A type that controls how it renders
//    • Optional metadata (name, label, zone interaction)
//
//  Structures are rendered between the tile layer and entity layer
//  so they sit on top of terrain but under cars/NPCs.
//
//  ACTIVATION — add in index.html after gangsters.js:
//    <script src="architecture.js"></script>
//
//  Then in game.js render(), after the tile loop and before cars:
//    if (typeof renderArchitecture === 'function') renderArchitecture(CX, cam, W, H, now);
//
//  Depends on: world.js (T, WW, WH, SPECIAL_ZONES, NZONES, cam, ws)
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── STRUCTURE DEFINITIONS ─────────────────────────────────────
// tx, ty  = top-left tile coordinate
// tw, th  = width/height in tiles
// type    = rendering style
// name    = label shown when player is near
// z       = draw order (higher = drawn later / on top)

const STRUCTURES = [

  // ── DOWNTOWN LANDMARKS ────────────────────────────────────
  {
    id: 'city_hall', type: 'civic', z: 2,
    tx: 69, ty: 54, tw: 8, th: 7,
    name: 'CITY HALL',
    col: '#c8b87a', roofCol: '#a89050', trim: '#e8d890',
    windows: true, flagpole: true,
  },
  {
    id: 'tower_a', type: 'skyscraper', z: 3,
    tx: 60, ty: 57, tw: 6, th: 11,
    name: 'MERIDIAN TOWER',
    col: '#3a5070', roofCol: '#204060', trim: '#80c0ff',
    windows: true, antenna: true,
  },
  {
    id: 'tower_b', type: 'skyscraper', z: 3,
    tx: 84, ty: 60, tw: 4, th: 8,
    name: 'COMMERCE PLAZA',
    col: '#503a30', roofCol: '#382820', trim: '#c09060',
    windows: true, antenna: false,
  },
  {
    id: 'hotel', type: 'hotel', z: 2,
    tx: 72, ty: 82, tw: 7, th: 6,
    name: 'GRAND HOTEL',
    col: '#704830', roofCol: '#502810', trim: '#ffd080',
    windows: true, sign: 'HOTEL',
  },

  // ── MIDTOWN ───────────────────────────────────────────────
  {
    id: 'market', type: 'market', z: 1,
    tx: 57, ty: 24, tw: 8, th: 6,
    name: 'CENTRAL MARKET',
    col: '#607840', roofCol: '#485830', trim: '#a0c060',
    windows: false, awning: true,
  },
  {
    id: 'arena', type: 'arena', z: 2,
    tx: 78, ty: 30, tw: 10, th: 10,
    name: 'CITY ARENA',
    col: '#484848', roofCol: '#303030', trim: '#808080',
    windows: false, dome: true,
  },
  {
    id: 'bank', type: 'civic', z: 2,
    tx: 66, ty: 12, tw: 7, th: 6,
    name: 'FIRST NATIONAL BANK',
    col: '#c0c0a0', roofCol: '#909080', trim: '#e0e0c0',
    windows: true, flagpole: false, columns: true,
  },

  // ── INDUSTRIAL ZONE ───────────────────────────────────────
  {
    id: 'factory_a', type: 'factory', z: 1,
    tx: 12, ty: 12, tw: 14, th: 8,
    name: 'STEELWORKS',
    col: '#505050', roofCol: '#303030', trim: '#808080',
    chimneys: 3, windows: false,
  },
  {
    id: 'warehouse', type: 'warehouse', z: 1,
    tx: 9, ty: 33, tw: 11, th: 7,
    name: 'PORT STORAGE',
    col: '#604030', roofCol: '#402820', trim: '#907060',
    windows: false, loadingBay: true,
  },
  {
    id: 'factory_b', type: 'factory', z: 1,
    tx: 27, ty: 15, tw: 11, th: 7,
    name: 'AUTO PLANT',
    col: '#404848', roofCol: '#282e2e', trim: '#608080',
    chimneys: 2, windows: false,
  },

  // ── EAST SIDE / GANG TURF A ───────────────────────────────
  {
    id: 'gang_hq_a', type: 'gang_den', z: 2,
    tx: 108, ty: 18, tw: 6, th: 6,
    name: 'EAST SIDE HQ',
    col: '#3a1010', roofCol: '#280808', trim: '#cc2200',
    graffiti: true,
  },
  {
    id: 'pawn_shop', type: 'shop_small', z: 1,
    tx: 114, ty: 27, tw: 4, th: 4,
    name: 'PAWN & GUN',
    col: '#503020', roofCol: '#301808', trim: '#ff8800',
    sign: 'PAWN',
  },

  // ── WEST SUBURBS / GANG TURF B ────────────────────────────
  {
    id: 'gang_hq_b', type: 'gang_den', z: 2,
    tx: 30, ty: 108, tw: 6, th: 6,
    name: 'WEST BLOCK HQ',
    col: '#1a0838', roofCol: '#100228', trim: '#8800cc',
    graffiti: true,
  },
  {
    id: 'chop_shop', type: 'shop_small', z: 1,
    tx: 36, ty: 114, tw: 4, th: 4,
    name: 'CHOP SHOP',
    col: '#303030', roofCol: '#181818', trim: '#8800cc',
    sign: 'AUTO',
  },

  // ── DOCKLANDS ─────────────────────────────────────────────
  {
    id: 'dock_crane_a', type: 'crane', z: 3,
    tx: 120, ty: 105, tw: 4, th: 4,
    name: 'DOCK CRANE A',
    col: '#e0a800', roofCol: '#c08800', trim: '#ffcc00',
  },
  {
    id: 'dock_crane_b', type: 'crane', z: 3,
    tx: 132, ty: 117, tw: 4, th: 4,
    name: 'DOCK CRANE B',
    col: '#e0a800', roofCol: '#c08800', trim: '#ffcc00',
  },
  {
    id: 'shipping_office', type: 'warehouse', z: 1,
    tx: 114, ty: 108, tw: 8, th: 6,
    name: 'PORT AUTHORITY',
    col: '#384858', roofCol: '#202e38', trim: '#607890',
    windows: true, loadingBay: false,
  },

  // ── SUBURBS ───────────────────────────────────────────────
  {
    id: 'church', type: 'civic', z: 2,
    tx: 15, ty: 93, tw: 6, th: 7,
    name: 'ST. MICHAEL\'S',
    col: '#d0c0a0', roofCol: '#b0a080', trim: '#e8e0c0',
    windows: true, steeple: true, columns: false,
  },
  {
    id: 'motel', type: 'hotel', z: 1,
    tx: 9, ty: 111, tw: 8, th: 4,
    name: 'SUNSET MOTEL',
    col: '#a06030', roofCol: '#703810', trim: '#ff8800',
    windows: true, sign: 'MOTEL',
  },

  // ── COP HQ CAMPUS ─────────────────────────────────────────
  {
    id: 'precinct', type: 'precinct', z: 2,
    tx: 68, ty: 68, tw: 13, th: 13,
    name: 'POLICE PRECINCT',
    col: '#202860', roofCol: '#101840', trim: '#4488ff',
    windows: true, flagpole: true, helipad: true,
  },
  // ── NORTHGATE (new zone) ─────────────────────────────────
  {
    id: 'north_market', type: 'market', z: 1,
    tx: 80, ty: 110, tw: 8, th: 6,
    name: 'NORTHGATE BAZAAR',
    col: '#506040', roofCol: '#384830', trim: '#90c050',
    windows: false, awning: true,
  },
  {
    id: 'north_tower', type: 'skyscraper', z: 3,
    tx: 72, ty: 120, tw: 5, th: 10,
    name: 'NORTHGATE TOWER',
    col: '#305060', roofCol: '#183040', trim: '#60a0d0',
    windows: true, antenna: true,
  },
  {
    id: 'north_clinic', type: 'civic', z: 2,
    tx: 60, ty: 108, tw: 6, th: 5,
    name: 'NORTHGATE CLINIC',
    col: '#d0e0d0', roofCol: '#b0c8b0', trim: '#60d080',
    windows: true, flagpole: false, columns: false,
  },

  // ── HARBOUR (new zone) ───────────────────────────────────
  {
    id: 'harbour_warehouse', type: 'warehouse', z: 1,
    tx: 116, ty: 90, tw: 10, th: 5,
    name: 'HARBOUR DEPOT',
    col: '#3a4858', roofCol: '#222e38', trim: '#506878',
    windows: false, loadingBay: true,
  },
  {
    id: 'harbour_crane_c', type: 'crane', z: 3,
    tx: 130, ty: 88, tw: 4, th: 4,
    name: 'HARBOUR CRANE C',
    col: '#d09000', roofCol: '#b07000', trim: '#ffbb00',
  },
  {
    id: 'harbour_office', type: 'civic', z: 2,
    tx: 110, ty: 100, tw: 7, th: 5,
    name: 'HARBOUR AUTHORITY',
    col: '#b8c0c8', roofCol: '#8898a8', trim: '#a0c0e0',
    windows: true, flagpole: true, columns: false,
  },

  // ── EXPANDED DOCKLANDS ───────────────────────────────────
  {
    id: 'dock_crane_d', type: 'crane', z: 3,
    tx: 140, ty: 108, tw: 4, th: 4,
    name: 'DOCK CRANE D',
    col: '#e0a800', roofCol: '#c08800', trim: '#ffcc00',
  },
  {
    id: 'container_yard', type: 'warehouse', z: 1,
    tx: 120, ty: 115, tw: 12, th: 7,
    name: 'CONTAINER YARD',
    col: '#354045', roofCol: '#202830', trim: '#506070',
    windows: false, loadingBay: true,
  },

  // ── NEW EAST SIDE ─────────────────────────────────────────
  {
    id: 'east_casino', type: 'hotel', z: 2,
    tx: 118, ty: 38, tw: 8, th: 6,
    name: 'LUCKY STAR CASINO',
    col: '#600820', roofCol: '#400410', trim: '#ff2060',
    windows: true, sign: 'CASINO',
  },
  {
    id: 'east_garage', type: 'warehouse', z: 1,
    tx: 130, ty: 58, tw: 7, th: 5,
    name: 'EAST GARAGE',
    col: '#303838', roofCol: '#182020', trim: '#506060',
    windows: false, loadingBay: true,
  },

  // ── NEW INDUSTRIAL (expanded) ────────────────────────────
  {
    id: 'power_plant', type: 'factory', z: 2,
    tx: 8, ty: 40, tw: 14, th: 8,
    name: 'POWER PLANT',
    col: '#383838', roofCol: '#202020', trim: '#f0a000',
    chimneys: 4, windows: false,
  },
  {
    id: 'refinery', type: 'factory', z: 1,
    tx: 28, ty: 48, tw: 10, th: 6,
    name: 'OIL REFINERY',
    col: '#404830', roofCol: '#282e18', trim: '#c0c000',
    chimneys: 2, windows: false,
  },

  // ── SUBURBS (expanded) ───────────────────────────────────
  {
    id: 'school', type: 'civic', z: 2,
    tx: 8, ty: 100, tw: 8, th: 6,
    name: 'WESTSIDE SCHOOL',
    col: '#d0c080', roofCol: '#b0a060', trim: '#ffd040',
    windows: true, flagpole: true, columns: false,
  },
  {
    id: 'stadium', type: 'arena', z: 2,
    tx: 18, ty: 130, tw: 14, th: 12,
    name: 'CITY STADIUM',
    col: '#384050', roofCol: '#202830', trim: '#80a0c0',
    windows: false, dome: true,
  },
];
];

// ── PRE-COMPUTED LOOKUP MAP ───────────────────────────────────
// Maps "tx,ty" → structure for fast lookup during rendering
const _structureMap = new Map();
for (const s of STRUCTURES) {
  for (let dy = 0; dy < s.th; dy++)
    for (let dx = 0; dx < s.tw; dx++)
      _structureMap.set((s.tx + dx) + ',' + (s.ty + dy), s);
}

// ── QUERY API ─────────────────────────────────────────────────

/** Returns the structure occupying tile (tx, ty), or null */
function getStructure(tx, ty) {
  return _structureMap.get(tx + ',' + ty) || null;
}

/** Returns the structure the player is currently inside, or null */
function getPlayerStructure() {
  const tx = Math.floor(PL.x / T), ty = Math.floor(PL.y / T);
  return getStructure(tx, ty);
}

/** Returns all structures of a given type */
function getStructuresByType(type) {
  return STRUCTURES.filter(s => s.type === type);
}

// ── NAME TAG (shown near player when inside a structure) ──────
let _lastStructureName = '';

function updateArchitecture() {
  const s = getPlayerStructure();
  const name = s ? '[ ' + s.name + ' ]' : '';
  if (name !== _lastStructureName) {
    _lastStructureName = name;
    const el = document.getElementById('areaTag');
    // Only override if the area tag isn't already showing something more important
    if (el && (!el.textContent || el.textContent === _lastStructureName)) {
      el.textContent = name;
    }
  }
}

// ── RENDER ────────────────────────────────────────────────────
/**
 * Call from game.js render() AFTER the tile loop, BEFORE entities.
 * Draws each structure's decorative elements over the base tiles.
 */
function renderArchitecture(ctx, cam, W, H, now) {
  // Sort by z so higher structures draw on top
  const sorted = [...STRUCTURES].sort((a, b) => a.z - b.z);

  for (const s of sorted) {
    // World-space top-left corner of structure
    const wx = s.tx * T, wy = s.ty * T;
    const sw = s.tw * T, sh = s.th * T;

    // Screen position
    const sx = (wx - cam.x) + W / 2;
    const sy = (wy - cam.y) + H / 2;

    // Frustum cull — skip if completely off screen
    if (sx + sw < -20 || sx > W + 20 || sy + sh < -20 || sy > H + 20) continue;

    ctx.save();

    switch (s.type) {

      case 'skyscraper':
        _drawSkyscraper(ctx, s, sx, sy, sw, sh, now);
        break;

      case 'civic':
        _drawCivic(ctx, s, sx, sy, sw, sh, now);
        break;

      case 'hotel':
        _drawHotel(ctx, s, sx, sy, sw, sh, now);
        break;

      case 'factory':
        _drawFactory(ctx, s, sx, sy, sw, sh, now);
        break;

      case 'warehouse':
        _drawWarehouse(ctx, s, sx, sy, sw, sh, now);
        break;

      case 'gang_den':
        _drawGangDen(ctx, s, sx, sy, sw, sh, now);
        break;

      case 'shop_small':
        _drawShopSmall(ctx, s, sx, sy, sw, sh, now);
        break;

      case 'crane':
        _drawCrane(ctx, s, sx, sy, sw, sh, now);
        break;

      case 'market':
        _drawMarket(ctx, s, sx, sy, sw, sh, now);
        break;

      case 'arena':
        _drawArena(ctx, s, sx, sy, sw, sh, now);
        break;

      case 'precinct':
        _drawPrecinct(ctx, s, sx, sy, sw, sh, now);
        break;

      default:
        _drawGeneric(ctx, s, sx, sy, sw, sh);
    }

    ctx.restore();
  }
}

// ── DRAW FUNCTIONS ────────────────────────────────────────────

// ── SHARED 3D WALL HELPER ─────────────────────────────────────
// Draws south and east pseudo-3D wall faces for any structure.
// Call at END of each draw function, after the roof is drawn.
function _draw3DWalls(ctx, sx, sy, sw, sh, roofCol, wallH) {
  wallH = wallH || Math.max(8, Math.floor(sh * 0.18));

  // South wall — full width, wallH tall, below roof
  const swg = ctx.createLinearGradient(sx, sy+sh-wallH, sx, sy+sh);
  swg.addColorStop(0, roofCol);
  swg.addColorStop(1, _shade(roofCol, -22));
  ctx.fillStyle = swg;
  ctx.fillRect(sx+1, sy+sh-wallH, sw-wallH-2, wallH-1);

  // Mortar lines on south wall
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(sx+1, sy+sh-wallH+Math.floor(wallH*0.35));
  ctx.lineTo(sx+sw-wallH-1, sy+sh-wallH+Math.floor(wallH*0.35));
  ctx.stroke();

  // Ground contact shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(sx+1, sy+sh-2, sw-wallH-2, 2);

  // South wall base edge
  ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx+1, sy+sh-1); ctx.lineTo(sx+sw-wallH, sy+sh-1);
  ctx.stroke();

  // Parapet ledge line (roof edge highlight)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx+1, sy+sh-wallH); ctx.lineTo(sx+sw-wallH, sy+sh-wallH);
  ctx.stroke();

  // East wall — wallH wide, full height, darker
  const ewg = ctx.createLinearGradient(sx+sw-wallH, sy, sx+sw, sy);
  ewg.addColorStop(0, _shade(roofCol, -25));
  ewg.addColorStop(1, _shade(roofCol, -40));
  ctx.fillStyle = ewg;
  ctx.fillRect(sx+sw-wallH, sy+1, wallH-1, sh-2);

  // East wall vertical lines (facade detail)
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.8;
  for (let el = 4; el < sh-2; el += Math.floor(sh/4)) {
    ctx.beginPath();
    ctx.moveTo(sx+sw-wallH, sy+el); ctx.lineTo(sx+sw-1, sy+el);
    ctx.stroke();
  }

  // East wall right shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(sx+sw-1, sy+1, 1, sh-2);

  // SE corner (deepest shadow)
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(sx+sw-wallH, sy+sh-wallH, wallH-1, wallH-1);

  // Parapet east edge
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx+sw-wallH, sy+1); ctx.lineTo(sx+sw-wallH, sy+sh-wallH);
  ctx.stroke();
}

function _drawGeneric(ctx, s, sx, sy, sw, sh) {
  ctx.fillStyle = s.col;
  ctx.fillRect(sx + 2, sy + 2, sw - 4, sh - 4);
  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx + 2, sy + 2, sw - 4, sh - 4);  _draw3DWalls(ctx, sx, sy, sw, sh, s.col, null);
}

function _drawSkyscraper(ctx, s, sx, sy, sw, sh, now) {
  // Body gradient
  const grad = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
  grad.addColorStop(0, _shade(s.col, 20));
  grad.addColorStop(1, _shade(s.col, -20));
  ctx.fillStyle = grad;
  ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

  // Roof accent
  ctx.fillStyle = s.roofCol;
  ctx.fillRect(sx + 3, sy + 1, sw - 6, Math.floor(sh * 0.18));

  // Window grid
  if (s.windows) {
    const cols = s.tw * 2, rows = s.th * 2;
    const ww = Math.floor((sw - 8) / cols) - 1;
    const wh = Math.floor((sh - 14) / rows) - 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = ((c * 7 + r * 13 + Math.floor(now / 4000)) % 5) !== 0;
        ctx.fillStyle = lit
          ? `rgba(255,230,120,${0.5 + (c + r) % 3 * 0.15})`
          : 'rgba(0,0,20,0.7)';
        ctx.fillRect(
          sx + 4 + c * (ww + 1),
          sy + Math.floor(sh * 0.2) + r * (wh + 1),
          ww, wh
        );
      }
    }
  }

  // Trim edges
  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
  _draw3DWalls(ctx, sx, sy, sw, sh, s.roofCol, Math.max(8,Math.floor(sh*0.15)));
  // Left highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx + 2, sy + sh - 2);
  ctx.lineTo(sx + 2, sy + 2);
  ctx.lineTo(sx + sw - 2, sy + 2);
  ctx.stroke();

  // Antenna
  if (s.antenna) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 400);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2, sy + 1);
    ctx.lineTo(sx + sw / 2, sy - T * 1.5);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,40,40,${pulse})`;
    ctx.beginPath();
    ctx.arc(sx + sw / 2, sy - T * 1.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
.col;
  ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

  // Pediment (triangular roof line)
  const pc = sx + sw / 2;
  ctx.fillStyle = s.roofCol;
  ctx.beginPath();
  ctx.moveTo(sx + 2, sy + Math.floor(sh * 0.3));
  ctx.lineTo(pc, sy + 1);
  ctx.lineTo(sx + sw - 2, sy + Math.floor(sh * 0.3));
  ctx.closePath();
  ctx.fill();

  // Columns
  if (s.columns) {
    ctx.fillStyle = _shade(s.col, 25);
    const numCols = Math.floor(sw / 12);
    const colW = 4;
    for (let c = 0; c < numCols; c++) {
      const cx = sx + 6 + c * (sw - 12) / Math.max(numCols - 1, 1);
      ctx.fillRect(cx - colW / 2, sy + Math.floor(sh * 0.28), colW, Math.floor(sh * 0.65));
    }
  }

  // Windows
  if (s.windows) {
    const cols = s.tw, rows = 2;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = 'rgba(180,220,255,0.6)';
        ctx.fillRect(sx + 6 + c * (sw - 12) / cols, sy + Math.floor(sh * 0.45) + r * 12, 8, 9);
      }
  }

  // Trim
  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);

  // Flagpole
  if (s.flagpole) {
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2, sy + 1);
    ctx.lineTo(sx + sw / 2, sy - T * 0.8);
    ctx.stroke();
    // Flag
    const wave = Math.sin(now / 300) * 2;
    ctx.fillStyle = '#cc0000';
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2, sy - T * 0.8);
    ctx.lineTo(sx + sw / 2 + 12, sy - T * 0.8 + 3 + wave);
    ctx.lineTo(sx + sw / 2 + 12, sy - T * 0.8 + 9 + wave);
    ctx.lineTo(sx + sw / 2, sy - T * 0.8 + 6);
    ctx.closePath();
    ctx.fill();
  }

  // Steeple (for church)
  if (s.steeple) {
    ctx.strokeStyle = s.trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2, sy + 1);
    ctx.lineTo(sx + sw / 2, sy - T * 2);
    ctx.stroke();
    ctx.fillStyle = s.trim;
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2 - 6, sy + 1);
    ctx.lineTo(sx + sw / 2, sy - T * 2);
    ctx.lineTo(sx + sw / 2 + 6, sy + 1);
    ctx.closePath();
    ctx.fill();
    // Cross
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    const cx = sx + sw / 2, cy = sy - T * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
    ctx.moveTo(cx - 5, cy - 2); ctx.lineTo(cx + 5, cy - 2);
    ctx.stroke();
  }
}

function _drawHotel(ctx, s, sx, sy, sw, sh, now) {
  // Body
  const grad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
  grad.addColorStop(0, _shade(s.col, 15));
  grad.addColorStop(1, _shade(s.col, -10));
  ctx.fillStyle = grad;
  ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

  // Canopy at entrance (bottom centre)
  ctx.fillStyle = s.trim;
  ctx.fillRect(sx + sw / 2 - 10, sy + sh - 4, 20, 4);

  // Windows with warm hotel glow
  if (s.windows) {
    const cols = s.tw * 2, rows = s.th * 2;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const lit = ((c * 5 + r * 11 + Math.floor(now / 6000)) % 7) > 1;
        ctx.fillStyle = lit ? 'rgba(255,200,80,0.7)' : 'rgba(0,0,0,0.5)';
        ctx.fillRect(sx + 5 + c * ((sw - 10) / cols), sy + 5 + r * ((sh - 8) / rows), 7, 6);
      }
  }

  // Neon sign
  if (s.sign) {
    const pulse = 0.7 + 0.3 * Math.sin(now / 350);
    ctx.shadowColor = s.trim;
    ctx.shadowBlur = 8 * pulse;
    ctx.fillStyle = s.trim;
    ctx.font = `bold ${Math.max(6, Math.floor(sw / s.sign.length * 0.8))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.sign, sx + sw / 2, sy + sh - 10);
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
  _draw3DWalls(ctx, sx, sy, sw, sh, s.roofCol, null);
}
  // Main body
  ctx.fillStyle = s.col;
  ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

  // Sawtooth roof
  ctx.fillStyle = s.roofCol;
  const segs = s.tw;
  const segW = sw / segs;
  ctx.beginPath();
  ctx.moveTo(sx + 1, sy + Math.floor(sh * 0.35));
  for (let i = 0; i < segs; i++) {
    ctx.lineTo(sx + i * segW + segW * 0.5, sy + 1);
    ctx.lineTo(sx + (i + 1) * segW, sy + Math.floor(sh * 0.35));
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Chimneys
  if (s.chimneys) {
    for (let ci = 0; ci < s.chimneys; ci++) {
      const cx = sx + sw * (ci + 1) / (s.chimneys + 1);
      // Stack
      ctx.fillStyle = '#282828';
      ctx.fillRect(cx - 4, sy - T * 0.9, 8, T * 0.9 + 4);
      ctx.strokeStyle = '#404040';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 4, sy - T * 0.9, 8, T * 0.9 + 4);
      // Smoke puff
      const t = (now / 1200 + ci * 0.4) % 1;
      const smokeY = sy - T * 0.9 - t * 20;
      const smokeA = (1 - t) * 0.5;
      ctx.fillStyle = `rgba(180,180,180,${smokeA})`;
      ctx.beginPath();
      ctx.arc(cx, smokeY, 4 + t * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
}

function _drawWarehouse(ctx, s, sx, sy, sw, sh, now) {
  ctx.fillStyle = s.col;
  ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

  // Arched roof panels
  ctx.fillStyle = s.roofCol;
  const panels = s.tw;
  const panW = sw / panels;
  for (let i = 0; i < panels; i++) {
    ctx.beginPath();
    ctx.arc(sx + i * panW + panW / 2, sy + Math.floor(sh * 0.35), panW / 2 - 1, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Loading bay doors
  if (s.loadingBay) {
    ctx.fillStyle = '#181818';
    ctx.fillRect(sx + sw / 2 - 10, sy + sh - 14, 20, 14);
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + sw / 2 - 10, sy + sh - 14, 20, 14);
    // Bay stripes
    for (let l = 0; l < 4; l++) {
      ctx.strokeStyle = '#303030';
      ctx.beginPath();
      ctx.moveTo(sx + sw / 2 - 10, sy + sh - 14 + l * 4);
      ctx.lineTo(sx + sw / 2 + 10, sy + sh - 14 + l * 4);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
  _draw3DWalls(ctx, sx, sy, sw, sh, s.roofCol, null);
}
  const pulse = 0.3 + 0.3 * Math.sin(now / 250);
  // Dark body with faction-colour glow
  ctx.shadowColor = s.trim;
  ctx.shadowBlur = 10 * pulse;
  ctx.fillStyle = s.col;
  ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);
  ctx.shadowBlur = 0;

  // Boarded windows
  const wCount = s.tw;
  for (let i = 0; i < wCount; i++) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(sx + 4 + i * (sw - 8) / wCount, sy + 8, 10, 10);
    // Board X
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx + 4 + i * (sw - 8) / wCount, sy + 8);
    ctx.lineTo(sx + 14 + i * (sw - 8) / wCount, sy + 18);
    ctx.moveTo(sx + 14 + i * (sw - 8) / wCount, sy + 8);
    ctx.lineTo(sx + 4 + i * (sw - 8) / wCount, sy + 18);
    ctx.stroke();
  }

  // Graffiti
  if (s.graffiti) {
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = `rgba(${s.trim.includes('cc') ? '200,30,0' : '130,0,200'},${0.6 + pulse * 0.4})`;
    ctx.fillText('TURF', sx + 4, sy + sh - 13);
  }

  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
}

function _drawShopSmall(ctx, s, sx, sy, sw, sh, now) {
  ctx.fillStyle = s.col;
  ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

  // Awning stripe
  ctx.fillStyle = s.trim;
  ctx.fillRect(sx + 1, sy + Math.floor(sh * 0.35), sw - 2, 5);
  ctx.fillStyle = _shade(s.trim, -20);
  for (let i = 0; i < sw - 2; i += 8) {
    ctx.fillRect(sx + 1 + i, sy + Math.floor(sh * 0.35), 4, 5);
  }

  // Signboard
  if (s.sign) {
    const pulse = 0.6 + 0.4 * Math.sin(now / 420);
    ctx.fillStyle = '#111';
    ctx.fillRect(sx + 3, sy + 3, sw - 6, Math.floor(sh * 0.3));
    ctx.shadowColor = s.trim;
    ctx.shadowBlur = 6 * pulse;
    ctx.fillStyle = s.trim;
    ctx.font = `bold ${Math.floor(sw * 0.3)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.sign, sx + sw / 2, sy + Math.floor(sh * 0.17));
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
  _draw3DWalls(ctx, sx, sy, sw, sh, s.col, null);
}
{
  const cx = sx + sw / 2, cy = sy + sh / 2;
  // Base
  ctx.fillStyle = s.col;
  ctx.fillRect(sx + sw / 2 - 5, sy + 4, 10, sh - 4);
  // Horizontal arm
  ctx.fillRect(sx + 2, sy + 6, sw - 4, 6);
  // Diagonal support
  ctx.strokeStyle = _shade(s.col, -20);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, sy + 12);
  ctx.lineTo(sx + sw - 4, sy + 6);
  ctx.stroke();
  // Cable + hook
  const swingX = Math.sin(now / 2000) * 6;
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx + sw - 8, sy + 9);
  ctx.lineTo(sx + sw - 8 + swingX, sy + sh + T / 2);
  ctx.stroke();
  ctx.fillStyle = '#aaa';
  ctx.fillRect(sx + sw - 11 + swingX, sy + sh + T / 2, 6, 5);
  // Trim
  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 2, sy + 4, sw - 4, sh - 4);
}

function _drawMarket(ctx, s, sx, sy, sw, sh, now) {
  ctx.fillStyle = s.col;
  ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

  // Colourful awnings — one per tw tiles
  const awningCols = ['#e03030', '#30a030', '#3060e0', '#e0a030', '#a030a0', '#30a0a0'];
  for (let i = 0; i < s.tw; i++) {
    const aw = (sw - 8) / s.tw;
    ctx.fillStyle = awningCols[i % awningCols.length];
    ctx.beginPath();
    ctx.moveTo(sx + 4 + i * aw, sy + Math.floor(sh * 0.25));
    ctx.lineTo(sx + 4 + i * aw + aw / 2, sy + 4);
    ctx.lineTo(sx + 4 + (i + 1) * aw, sy + Math.floor(sh * 0.25));
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
  _draw3DWalls(ctx, sx, sy, sw, sh, s.roofCol, null);
}
const cx = sx + sw / 2, cy = sy + sh / 2;
  const rx = sw / 2 - 2, ry = sh / 2 - 2;

  // Outer body
  ctx.fillStyle = s.col;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  if (s.dome) {
    // Inner dome highlight
    ctx.fillStyle = _shade(s.col, 15);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.65, ry * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dome ribs
    ctx.strokeStyle = _shade(s.col, -15);
    ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * rx * 0.65, cy + Math.sin(a) * ry * 0.65);
      ctx.stroke();
    }
  }

  // Trim ring
  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ARENA', cx, cy);
}

function _drawPrecinct(ctx, s, sx, sy, sw, sh, now) {
  const fl = Math.floor(now / 500) % 2 === 0;
  // Main building
  ctx.fillStyle = s.col;
  ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

  // Central tower
  const tw = Math.floor(sw * 0.35), th2 = Math.floor(sh * 0.55);
  const tx2 = sx + (sw - tw) / 2, ty2 = sy + 1;
  ctx.fillStyle = _shade(s.col, -15);
  ctx.fillRect(tx2, ty2, tw, th2);

  // Windows
  if (s.windows) {
    const cols = s.tw * 2, rows = s.th * 2;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const lit = ((c * 3 + r * 7 + Math.floor(now / 5000)) % 4) !== 0;
        ctx.fillStyle = lit ? 'rgba(100,160,255,0.7)' : 'rgba(0,0,30,0.7)';
        ctx.fillRect(sx + 4 + c * ((sw - 8) / cols), sy + 8 + r * ((sh - 14) / rows), 7, 5);
      }
  }

  // Helipad on roof
  if (s.helipad) {
    const hx = tx2 + tw / 2, hy = ty2 + Math.floor(th2 * 0.25);
    ctx.strokeStyle = 'rgba(255,255,100,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hx, hy, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,100,0.6)';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', hx, hy);
  }

  // Siren light bar on roof edge
  ctx.shadowColor = fl ? 'rgba(40,120,255,0.9)' : 'rgba(255,30,30,0.9)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = fl ? '#4488ff' : '#ff3322';
  ctx.fillRect(sx + 4, sy + 1, sw - 8, 3);
  ctx.shadowBlur = 0;

  // Flagpole
  if (s.flagpole) {
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2, sy + 1);
    ctx.lineTo(sx + sw / 2, sy - T * 0.9);
    ctx.stroke();
    const wave = Math.sin(now / 280) * 1.5;
    ctx.fillStyle = '#1a44cc';
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2, sy - T * 0.9);
    ctx.lineTo(sx + sw / 2 + 14, sy - T * 0.9 + 2 + wave);
    ctx.lineTo(sx + sw / 2 + 14, sy - T * 0.9 + 8 + wave);
    ctx.lineTo(sx + sw / 2, sy - T * 0.9 + 5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
  _draw3DWalls(ctx, sx, sy, sw, sh, s.roofCol, null);
}
────────────


function _drawCivic(ctx, s, sx, sy, sw, sh, now) {
  // Base
  ctx.fillStyle = s.col;
  ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

  // Pediment (triangular roof line)
  const pc = sx + sw / 2;
  ctx.fillStyle = s.roofCol;
  ctx.beginPath();
  ctx.moveTo(sx + 2, sy + Math.floor(sh * 0.3));
  ctx.lineTo(pc, sy + 1);
  ctx.lineTo(sx + sw - 2, sy + Math.floor(sh * 0.3));
  ctx.closePath();
  ctx.fill();

  // Columns
  if (s.columns) {
    ctx.fillStyle = _shade(s.col, 25);
    const numCols = Math.floor(sw / 12);
    const colW = 4;
    for (let c = 0; c < numCols; c++) {
      const cx = sx + 6 + c * (sw - 12) / Math.max(numCols - 1, 1);
      ctx.fillRect(cx - colW / 2, sy + Math.floor(sh * 0.28), colW, Math.floor(sh * 0.65));
    }
  }

  // Windows
  if (s.windows) {
    const cols = s.tw, rows = 2;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = 'rgba(180,220,255,0.6)';
        ctx.fillRect(sx + 6 + c * (sw - 12) / cols, sy + Math.floor(sh * 0.45) + r * 12, 8, 9);
      }
  }

  // Trim
  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
  _draw3DWalls(ctx, sx, sy, sw, sh, s.roofCol, null);

  // Flagpole
  if (s.flagpole) {
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2, sy + 1);
    ctx.lineTo(sx + sw / 2, sy - T * 0.8);
    ctx.stroke();
    // Flag
    const wave = Math.sin(now / 300) * 2;
    ctx.fillStyle = '#cc0000';
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2, sy - T * 0.8);
    ctx.lineTo(sx + sw / 2 + 12, sy - T * 0.8 + 3 + wave);
    ctx.lineTo(sx + sw / 2 + 12, sy - T * 0.8 + 9 + wave);
    ctx.lineTo(sx + sw / 2, sy - T * 0.8 + 6);
    ctx.closePath();
    ctx.fill();
  }

  // Steeple (for church)
  if (s.steeple) {
    ctx.strokeStyle = s.trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2, sy + 1);
    ctx.lineTo(sx + sw / 2, sy - T * 2);
    ctx.stroke();
    ctx.fillStyle = s.trim;
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2 - 6, sy + 1);
    ctx.lineTo(sx + sw / 2, sy - T * 2);
    ctx.lineTo(sx + sw / 2 + 6, sy + 1);
    ctx.closePath();
    ctx.fill();
    // Cross
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    const cx = sx + sw / 2, cy = sy - T * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
    ctx.moveTo(cx - 5, cy - 2); ctx.lineTo(cx + 5, cy - 2);
    ctx.stroke();
  }
}

function _drawFactory(ctx, s, sx, sy, sw, sh, now) {
  // Main body
  ctx.fillStyle = s.col;
  ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

  // Sawtooth roof
  ctx.fillStyle = s.roofCol;
  const segs = s.tw;
  const segW = sw / segs;
  ctx.beginPath();
  ctx.moveTo(sx + 1, sy + Math.floor(sh * 0.35));
  for (let i = 0; i < segs; i++) {
    ctx.lineTo(sx + i * segW + segW * 0.5, sy + 1);
    ctx.lineTo(sx + (i + 1) * segW, sy + Math.floor(sh * 0.35));
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Chimneys
  if (s.chimneys) {
    for (let ci = 0; ci < s.chimneys; ci++) {
      const cx = sx + sw * (ci + 1) / (s.chimneys + 1);
      // Stack
      ctx.fillStyle = '#282828';
      ctx.fillRect(cx - 4, sy - T * 0.9, 8, T * 0.9 + 4);
      ctx.strokeStyle = '#404040';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 4, sy - T * 0.9, 8, T * 0.9 + 4);
      // Smoke puff
      const t = (now / 1200 + ci * 0.4) % 1;
      const smokeY = sy - T * 0.9 - t * 20;
      const smokeA = (1 - t) * 0.5;
      ctx.fillStyle = `rgba(180,180,180,${smokeA})`;
      ctx.beginPath();
      ctx.arc(cx, smokeY, 4 + t * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
  _draw3DWalls(ctx, sx, sy, sw, sh, s.roofCol, Math.max(8,Math.floor(sh*0.12)));
}

function _drawGangDen(ctx, s, sx, sy, sw, sh, now) {
  const pulse = 0.3 + 0.3 * Math.sin(now / 250);
  // Dark body with faction-colour glow
  ctx.shadowColor = s.trim;
  ctx.shadowBlur = 10 * pulse;
  ctx.fillStyle = s.col;
  ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);
  ctx.shadowBlur = 0;

  // Boarded windows
  const wCount = s.tw;
  for (let i = 0; i < wCount; i++) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(sx + 4 + i * (sw - 8) / wCount, sy + 8, 10, 10);
    // Board X
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx + 4 + i * (sw - 8) / wCount, sy + 8);
    ctx.lineTo(sx + 14 + i * (sw - 8) / wCount, sy + 18);
    ctx.moveTo(sx + 14 + i * (sw - 8) / wCount, sy + 8);
    ctx.lineTo(sx + 4 + i * (sw - 8) / wCount, sy + 18);
    ctx.stroke();
  }

  // Graffiti
  if (s.graffiti) {
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = `rgba(${s.trim.includes('cc') ? '200,30,0' : '130,0,200'},${0.6 + pulse * 0.4})`;
    ctx.fillText('TURF', sx + 4, sy + sh - 13);
  }

  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
  _draw3DWalls(ctx, sx, sy, sw, sh, s.col, null);
}

function _drawCrane(ctx, s, sx, sy, sw, sh, now) {
  const cx = sx + sw / 2, cy = sy + sh / 2;
  // Base
  ctx.fillStyle = s.col;
  ctx.fillRect(sx + sw / 2 - 5, sy + 4, 10, sh - 4);
  // Horizontal arm
  ctx.fillRect(sx + 2, sy + 6, sw - 4, 6);
  // Diagonal support
  ctx.strokeStyle = _shade(s.col, -20);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, sy + 12);
  ctx.lineTo(sx + sw - 4, sy + 6);
  ctx.stroke();
  // Cable + hook
  const swingX = Math.sin(now / 2000) * 6;
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx + sw - 8, sy + 9);
  ctx.lineTo(sx + sw - 8 + swingX, sy + sh + T / 2);
  ctx.stroke();
  ctx.fillStyle = '#aaa';
  ctx.fillRect(sx + sw - 11 + swingX, sy + sh + T / 2, 6, 5);
  // Trim
  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 2, sy + 4, sw - 4, sh - 4);
  _draw3DWalls(ctx, sx, sy, sw, sh, s.col, Math.max(6,Math.floor(sh*0.10)));
}

function _drawArena(ctx, s, sx, sy, sw, sh, now) {
  const cx = sx + sw / 2, cy = sy + sh / 2;
  const rx = sw / 2 - 2, ry = sh / 2 - 2;

  // Outer body
  ctx.fillStyle = s.col;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  if (s.dome) {
    // Inner dome highlight
    ctx.fillStyle = _shade(s.col, 15);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.65, ry * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dome ribs
    ctx.strokeStyle = _shade(s.col, -15);
    ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * rx * 0.65, cy + Math.sin(a) * ry * 0.65);
      ctx.stroke();
    }
  }

  // Trim ring
  ctx.strokeStyle = s.trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ARENA', cx, cy);
}
function _shade(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
