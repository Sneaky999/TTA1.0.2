// ═══════════════════════════════════════════════════════════════
//  assets.js  –  Sprite system, SVG sprites, tile textures,
//                drawCar(), shadeCol(), roundRect()
//  Depends on: world.js  (T, WD, WW, WH constants)
// ═══════════════════════════════════════════════════════════════

//  SPRITE SYSTEM
// ══════════════════════════════════════════
const SP={imgs:{},tiles:{},ready:false};

function svgImg(svgStr,w,h){
  return new Promise(res=>{
    const img=new Image();
    const blob=new Blob([svgStr],{type:'image/svg+xml'});
    const url=URL.createObjectURL(blob);
    img.onload=()=>{URL.revokeObjectURL(url);res(img);};
    img.onerror=()=>res(null);
    img.src=url;
  });
}

// Load an external PNG image as a Promise → Image
function loadImg(src){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>res(img);
    img.onerror=()=>{ console.warn('[assets] Failed to load:',src); res(null); };
    img.src=src;
  });
}

// Pre-render a tile texture canvas 40x40
function mkTile(drawFn){
  const c=document.createElement('canvas');c.width=40;c.height=40;
  drawFn(c.getContext('2d'));return c;
}

// Deterministic noise for textures
function dNoise(x,y,s=73){return((x*s^y*37^x*y*13)&255)/255;}

async function initSprites(){
  // ── TILE TEXTURES — PNG images ──
  // grass.png  → type 0 (grass)
  // road_straight.png → type 1 (straight road)
  // intersection.png  → type 3 (sidewalk) AND road intersections
  // crosswalk.png     → overlaid on road tiles adjacent to sidewalk
  //
  // All four are loaded as Image objects; drawImage accepts them
  // exactly the same as canvas elements, so game.js needs no changes.

  // Keep procedural fallbacks for park / water / building in case
  // those PNGs aren't provided.

  // Park
  SP.tiles[4]=mkTile(cx=>{
    cx.fillStyle='#285818';cx.fillRect(0,0,40,40);
    // Grass blades
    for(let i=0;i<40;i++){
      const x=dNoise(i,11)*38,y=dNoise(i,12)*38;
      cx.fillStyle=`rgba(${30+dNoise(i,13)*20|0},${85+dNoise(i,14)*30|0},${15+dNoise(i,15)*15|0},0.7)`;
      cx.fillRect(x,y,1,dNoise(i,16)*4+2);
    }
    // Dirt path hint
    cx.fillStyle='rgba(120,90,50,0.08)';cx.fillRect(15,0,10,40);
  });

  // Water
  SP.tiles[5]=mkTile(cx=>{
    const g=cx.createLinearGradient(0,0,0,40);
    g.addColorStop(0,'#1a3a6a');g.addColorStop(1,'#122860');
    cx.fillStyle=g;cx.fillRect(0,0,40,40);
    // Ripple lines
    for(let i=0;i<5;i++){
      const y=dNoise(i,17)*34+3;
      cx.strokeStyle=`rgba(100,160,255,${0.1+dNoise(i,18)*0.12})`;cx.lineWidth=1;cx.setLineDash([4,6]);
      cx.beginPath();cx.moveTo(0,y);cx.lineTo(40,y);cx.stroke();
    }
    cx.setLineDash([]);
  });

  // Building base (reused with zone color tint)
  SP.tiles[2]=mkTile(cx=>{
    cx.fillStyle='#4a4a5a';cx.fillRect(0,0,40,40);
    // Roof ledge
    cx.fillStyle='rgba(255,255,255,0.06)';cx.fillRect(0,0,40,2);cx.fillRect(0,0,2,40);
    cx.fillStyle='rgba(0,0,0,0.25)';cx.fillRect(38,0,2,40);cx.fillRect(0,38,40,2);
    // Windows (drawn at runtime with seed, this is just the base)
    cx.fillStyle='rgba(0,0,0,0.3)';cx.fillRect(2,2,36,36);
  });

  // ── CHARACTER SVGs ──
  const playerSVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <ellipse cx="24" cy="30" rx="16" ry="11" fill="rgba(0,0,0,0.45)"/>
    <ellipse cx="20" cy="27" rx="10" ry="9" fill="#8b3a00"/>
    <ellipse cx="20" cy="26" rx="9" ry="8" fill="#d05a10"/>
    <ellipse cx="17" cy="24" rx="6" ry="4" fill="rgba(255,150,70,0.4)"/>
    <ellipse cx="12" cy="19" rx="3.5" ry="2.2" fill="#c04808" transform="rotate(30,12,19)"/>
    <ellipse cx="12" cy="34" rx="3.5" ry="2.2" fill="#c04808" transform="rotate(-30,12,34)"/>
    <ellipse cx="18" cy="26" rx="5" ry="4.5" fill="#2a1850"/>
    <circle cx="32" cy="26" r="9" fill="#d4956a"/>
    <ellipse cx="31" cy="20" rx="8.5" ry="5.5" fill="#1a0800"/>
    <ellipse cx="31.5" cy="18" rx="6" ry="3" fill="#2e1005"/>
    <ellipse cx="24.5" cy="23" rx="2.5" ry="2" fill="#bb7a50"/>
    <ellipse cx="24.5" cy="29" rx="2.5" ry="2" fill="#bb7a50"/>
    <ellipse cx="35" cy="22.5" rx="2.2" ry="1.8" fill="white"/>
    <circle cx="35.7" cy="22.5" r="1.2" fill="#1a1830"/>
    <circle cx="36.1" cy="22" r="0.6" fill="rgba(255,255,255,0.9)"/>
    <ellipse cx="35" cy="29.5" rx="2.2" ry="1.8" fill="white"/>
    <circle cx="35.7" cy="29.5" r="1.2" fill="#1a1830"/>
    <circle cx="36.1" cy="29" r="0.6" fill="rgba(255,255,255,0.9)"/>
    <path d="M33 26 Q35 27.5 37 26" stroke="rgba(160,80,50,0.9)" stroke-width="1" fill="none" stroke-linecap="round"/>
  </svg>`;

  const copSVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <ellipse cx="24" cy="30" rx="16" ry="11" fill="rgba(0,0,0,0.45)"/>
    <ellipse cx="20" cy="27" rx="10" ry="9" fill="#0a1f6a"/>
    <ellipse cx="20" cy="26" rx="9" ry="8" fill="#1535aa"/>
    <ellipse cx="17" cy="23" rx="5" ry="3.5" fill="rgba(60,100,255,0.35)"/>
    <ellipse cx="12" cy="19" rx="3.5" ry="2.2" fill="#1030a0" transform="rotate(30,12,19)"/>
    <ellipse cx="12" cy="34" rx="3.5" ry="2.2" fill="#1030a0" transform="rotate(-30,12,34)"/>
    <polygon points="24,22 27,25 24,28 21,25" fill="#ffd700" opacity="0.9"/>
    <circle cx="32" cy="26" r="9" fill="#e0b080"/>
    <ellipse cx="31" cy="19" rx="9" ry="5.5" fill="#1030a0"/>
    <ellipse cx="31" cy="18" rx="7" ry="3" fill="#0a2080"/>
    <rect x="23" y="17" width="16" height="3" rx="1.5" fill="#0d2890"/>
    <ellipse cx="24.5" cy="23" rx="2.5" ry="2" fill="#cc9060"/>
    <ellipse cx="24.5" cy="29" rx="2.5" ry="2" fill="#cc9060"/>
    <ellipse cx="35" cy="22.5" rx="2.2" ry="1.8" fill="white"/>
    <circle cx="35.7" cy="22.5" r="1.2" fill="#1a1830"/>
    <ellipse cx="35" cy="29.5" rx="2.2" ry="1.8" fill="white"/>
    <circle cx="35.7" cy="29.5" r="1.2" fill="#1a1830"/>
  </svg>`;

  const gangSVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <ellipse cx="24" cy="30" rx="16" ry="11" fill="rgba(0,0,0,0.5)"/>
    <ellipse cx="20" cy="27" rx="10" ry="9" fill="#6a0000"/>
    <ellipse cx="20" cy="26" rx="9" ry="8" fill="#c00010"/>
    <ellipse cx="17" cy="23" rx="5.5" ry="3.5" fill="rgba(255,60,30,0.3)"/>
    <ellipse cx="12" cy="19" rx="3.5" ry="2.2" fill="#a00010" transform="rotate(30,12,19)"/>
    <ellipse cx="12" cy="34" rx="3.5" ry="2.2" fill="#a00010" transform="rotate(-30,12,34)"/>
    <ellipse cx="17" cy="25" rx="5" ry="4.5" fill="#1a0808"/>
    <circle cx="32" cy="26" r="9" fill="#c87850"/>
    <ellipse cx="31.5" cy="20" rx="8.5" ry="5.5" fill="#2a0808"/>
    <ellipse cx="30" cy="23" rx="8" ry="4" fill="#601010"/>
    <ellipse cx="24.5" cy="23.5" rx="2.5" ry="2" fill="#b06040"/>
    <ellipse cx="24.5" cy="28.5" rx="2.5" ry="2" fill="#b06040"/>
    <ellipse cx="35" cy="22.5" rx="2.2" ry="1.8" fill="white"/>
    <circle cx="35.7" cy="22.5" r="1.3" fill="#1a0808"/>
    <ellipse cx="35" cy="29.5" rx="2.2" ry="1.8" fill="white"/>
    <circle cx="35.7" cy="29.5" r="1.3" fill="#1a0808"/>
    <path d="M32.5 26 Q35 24.5 37 26" stroke="#600" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </svg>`;

  // NPC variants
  const npcColors=[
    ['#4a80c0','#2a5a9a'],['#e0a030','#b07820'],['#60b050','#3a8030'],
    ['#c060c0','#8040a0'],['#60c0c0','#3090a0'],['#e06060','#b03040']
  ];
  const npcSVGs=npcColors.map(([c1,c2])=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
    <ellipse cx="18" cy="23" rx="11" ry="8" fill="rgba(0,0,0,0.4)"/>
    <ellipse cx="15" cy="21" rx="8" ry="7" fill="${c2}"/>
    <ellipse cx="15" cy="20" rx="7" ry="6" fill="${c1}"/>
    <ellipse cx="11" cy="15" rx="3" ry="1.8" fill="${c1}" transform="rotate(25,11,15)"/>
    <ellipse cx="11" cy="27" rx="3" ry="1.8" fill="${c1}" transform="rotate(-25,11,27)"/>
    <circle cx="24" cy="20" r="7" fill="#d4a070"/>
    <ellipse cx="23.5" cy="15.5" rx="6.5" ry="4" fill="#3a2010"/>
    <ellipse cx="19" cy="18" rx="2" ry="1.6" fill="#c08050"/>
    <ellipse cx="19" cy="22.5" rx="2" ry="1.6" fill="#c08050"/>
    <ellipse cx="26.5" cy="17.5" rx="1.8" ry="1.5" fill="white"/>
    <circle cx="27.1" cy="17.5" r="0.9" fill="#1a1830"/>
    <ellipse cx="26.5" cy="22.5" rx="1.8" ry="1.5" fill="white"/>
    <circle cx="27.1" cy="22.5" r="0.9" fill="#1a1830"/>
  </svg>`);

  // ── CAR OVERLAY SVGs (windshield, roof, wheels, lights on top of colored body) ──
  // Sedan overlay (faces right, w=56 h=28)
  const sedanOvr=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 28">
    <rect x="16" y="4" width="20" height="20" rx="3" fill="rgba(0,0,0,0.35)"/>
    <rect x="34" y="6" width="12" height="16" rx="2" fill="rgba(150,220,255,0.82)"/>
    <line x1="36" y1="6" x2="40" y2="22" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
    <rect x="10" y="6" width="7" height="16" rx="2" fill="rgba(120,180,230,0.45)"/>
    <rect x="1" y="3" width="9" height="8" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="1" y="17" width="9" height="8" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="46" y="3" width="9" height="8" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="46" y="17" width="9" height="8" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="2" y="4.5" width="5" height="5" rx="1" fill="rgba(180,180,180,0.7)"/>
    <rect x="2" y="18.5" width="5" height="5" rx="1" fill="rgba(180,180,180,0.7)"/>
    <rect x="49" y="4.5" width="5" height="5" rx="1" fill="rgba(180,180,180,0.7)"/>
    <rect x="49" y="18.5" width="5" height="5" rx="1" fill="rgba(180,180,180,0.7)"/>
    <rect x="53" y="5" width="3" height="5" rx="1" fill="rgba(255,255,180,0.95)"/>
    <rect x="53" y="18" width="3" height="5" rx="1" fill="rgba(255,255,180,0.95)"/>
    <rect x="0" y="5" width="3" height="5" rx="1" fill="rgba(255,40,40,0.9)"/>
    <rect x="0" y="18" width="3" height="5" rx="1" fill="rgba(255,40,40,0.9)"/>
    <line x1="28" y1="4" x2="28" y2="24" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>
    <rect x="16" y="4" width="36" height="1.5" rx="0.75" fill="rgba(255,255,255,0.18)"/>
  </svg>`;

  const sportsOvr=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 24">
    <rect x="18" y="3" width="22" height="18" rx="3" fill="rgba(0,0,0,0.3)"/>
    <path d="M36 5 L46 7 L46 17 L36 19 Z" fill="rgba(140,215,255,0.85)"/>
    <line x1="37" y1="5" x2="41" y2="19" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
    <path d="M18 5 L24 7 L24 17 L18 19 Z" fill="rgba(120,180,230,0.4)"/>
    <rect x="1" y="2" width="8" height="7" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="1" y="15" width="8" height="7" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="51" y="2" width="8" height="7" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="51" y="15" width="8" height="7" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="2" y="3" width="5" height="4.5" rx="1" fill="rgba(180,180,180,0.7)"/>
    <rect x="2" y="16.5" width="5" height="4.5" rx="1" fill="rgba(180,180,180,0.7)"/>
    <rect x="53" y="3" width="5" height="4.5" rx="1" fill="rgba(180,180,180,0.7)"/>
    <rect x="53" y="16.5" width="5" height="4.5" rx="1" fill="rgba(180,180,180,0.7)"/>
    <rect x="57" y="4" width="3" height="4" rx="1" fill="rgba(255,255,180,0.95)"/>
    <rect x="57" y="16" width="3" height="4" rx="1" fill="rgba(255,255,180,0.95)"/>
    <rect x="0" y="4" width="3" height="4" rx="1" fill="rgba(255,40,40,0.9)"/>
    <rect x="0" y="16" width="3" height="4" rx="1" fill="rgba(255,40,40,0.9)"/>
    <rect x="18" y="3" width="30" height="1.5" rx="0.75" fill="rgba(255,255,255,0.2)"/>
  </svg>`;

  const truckOvr=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36">
    <rect x="38" y="4" width="16" height="28" rx="2" fill="rgba(0,0,0,0.25)"/>
    <rect x="44" y="6" width="12" height="24" rx="2" fill="rgba(150,215,255,0.75)"/>
    <rect x="8" y="5" width="30" height="26" rx="2" fill="rgba(0,0,0,0.4)"/>
    <rect x="1" y="3" width="10" height="10" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="1" y="23" width="10" height="10" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="61" y="3" width="10" height="10" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="61" y="23" width="10" height="10" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="2" y="4" width="7" height="7" rx="1" fill="rgba(170,170,170,0.7)"/>
    <rect x="2" y="25" width="7" height="7" rx="1" fill="rgba(170,170,170,0.7)"/>
    <rect x="63" y="4" width="7" height="7" rx="1" fill="rgba(170,170,170,0.7)"/>
    <rect x="63" y="25" width="7" height="7" rx="1" fill="rgba(170,170,170,0.7)"/>
    <rect x="69" y="5" width="3" height="7" rx="1" fill="rgba(255,255,160,0.95)"/>
    <rect x="69" y="24" width="3" height="7" rx="1" fill="rgba(255,255,160,0.95)"/>
    <rect x="0" y="5" width="3" height="7" rx="1" fill="rgba(255,30,30,0.9)"/>
    <rect x="0" y="24" width="3" height="7" rx="1" fill="rgba(255,30,30,0.9)"/>
    <line x1="8" y1="3" x2="8" y2="33" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/>
    <rect x="38" y="4" width="18" height="1.5" rx="0.75" fill="rgba(255,255,255,0.15)"/>
  </svg>`;

  const suvOvr=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 34">
    <rect x="14" y="4" width="26" height="26" rx="3" fill="rgba(0,0,0,0.3)"/>
    <rect x="36" y="6" width="14" height="22" rx="2" fill="rgba(145,215,255,0.8)"/>
    <rect x="12" y="6" width="8" height="22" rx="2" fill="rgba(120,180,230,0.42)"/>
    <rect x="1" y="3" width="10" height="10" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="1" y="21" width="10" height="10" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="53" y="3" width="10" height="10" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="53" y="21" width="10" height="10" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="2" y="4" width="7" height="7" rx="1" fill="rgba(175,175,175,0.7)"/>
    <rect x="2" y="23" width="7" height="7" rx="1" fill="rgba(175,175,175,0.7)"/>
    <rect x="55" y="4" width="7" height="7" rx="1" fill="rgba(175,175,175,0.7)"/>
    <rect x="55" y="23" width="7" height="7" rx="1" fill="rgba(175,175,175,0.7)"/>
    <rect x="61" y="5" width="3" height="6" rx="1" fill="rgba(255,255,180,0.95)"/>
    <rect x="61" y="23" width="3" height="6" rx="1" fill="rgba(255,255,180,0.95)"/>
    <rect x="0" y="5" width="3" height="6" rx="1" fill="rgba(255,35,35,0.9)"/>
    <rect x="0" y="23" width="3" height="6" rx="1" fill="rgba(255,35,35,0.9)"/>
    <line x1="27" y1="4" x2="27" y2="30" stroke="rgba(0,0,0,0.28)" stroke-width="1.2"/>
    <rect x="14" y="4" width="36" height="1.5" rx="0.75" fill="rgba(255,255,255,0.17)"/>
  </svg>`;

  const vanOvr=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 32">
    <rect x="42" y="4" width="12" height="24" rx="2" fill="rgba(0,0,0,0.28)"/>
    <rect x="43" y="5" width="11" height="22" rx="2" fill="rgba(145,210,255,0.78)"/>
    <rect x="8" y="4" width="34" height="24" rx="2" fill="rgba(0,0,0,0.38)"/>
    <rect x="12" y="6" width="7" height="20" rx="1" fill="rgba(120,180,230,0.35)"/>
    <rect x="1" y="3" width="9" height="9" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="1" y="20" width="9" height="9" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="62" y="3" width="9" height="9" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="62" y="20" width="9" height="9" rx="2" fill="rgba(0,0,0,0.85)"/>
    <rect x="2" y="4" width="6" height="6" rx="1" fill="rgba(170,170,170,0.7)"/>
    <rect x="2" y="22" width="6" height="6" rx="1" fill="rgba(170,170,170,0.7)"/>
    <rect x="64" y="4" width="6" height="6" rx="1" fill="rgba(170,170,170,0.7)"/>
    <rect x="64" y="22" width="6" height="6" rx="1" fill="rgba(170,170,170,0.7)"/>
    <rect x="69" y="5" width="3" height="6" rx="1" fill="rgba(255,255,160,0.95)"/>
    <rect x="69" y="21" width="3" height="6" rx="1" fill="rgba(255,255,160,0.95)"/>
    <rect x="0" y="5" width="3" height="6" rx="1" fill="rgba(255,30,30,0.9)"/>
    <rect x="0" y="21" width="3" height="6" rx="1" fill="rgba(255,30,30,0.9)"/>
    <line x1="8" y1="3" x2="8" y2="29" stroke="rgba(0,0,0,0.3)" stroke-width="1.5"/>
    <rect x="42" y="4" width="14" height="1.5" rx="0.75" fill="rgba(255,255,255,0.15)"/>
  </svg>`;

  // ── PICKUP SVGs ──
  const hpSVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="rgba(200,0,0,0.25)" stroke="rgba(255,50,50,0.6)" stroke-width="1.5"/>
    <rect x="6" y="11" width="16" height="6" rx="2" fill="#ff2222"/>
    <rect x="11" y="6" width="6" height="16" rx="2" fill="#ff2222"/>
    <rect x="7" y="11" width="14" height="2" rx="1" fill="rgba(255,160,160,0.5)"/>
    <rect x="11" y="7" width="2" height="14" rx="1" fill="rgba(255,160,160,0.5)"/>
  </svg>`;

  const cashSVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="rgba(50,180,0,0.2)" stroke="rgba(80,220,0,0.5)" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="9" fill="#1a8000"/>
    <circle cx="14" cy="14" r="7" fill="#22a800"/>
    <text x="14" y="19" text-anchor="middle" font-size="12" font-weight="bold" fill="#ffd700" font-family="serif">$</text>
    <circle cx="14" cy="14" r="9" fill="none" stroke="rgba(255,220,0,0.4)" stroke-width="1"/>
  </svg>`;

  const gunSVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="rgba(0,180,180,0.2)" stroke="rgba(0,220,220,0.5)" stroke-width="1.5"/>
    <rect x="6" y="12" width="15" height="5" rx="1.5" fill="#0cc"/>
    <rect x="17" y="9" width="5" height="4" rx="1" fill="#0aa"/>
    <rect x="9" y="17" width="4" height="5" rx="1.5" fill="#0aa"/>
    <rect x="7" y="13" width="12" height="2" rx="1" fill="rgba(255,255,255,0.3)"/>
  </svg>`;

  // Load all images — PNGs first, then SVG characters
  const loads=[
    // ── Tile PNGs ──
    loadImg('grass.png').then(i=>{ if(i) SP.tiles[0]=i; }),
    loadImg('road_straight.png').then(i=>{ if(i) SP.tiles[1]=i; }),
    loadImg('intersection.png').then(i=>{ if(i){ SP.tiles[3]=i; SP.tiles.inter=i; } }),
    loadImg('crosswalk.png').then(i=>{ if(i) SP.tiles.crosswalk=i; }),
    // ── Character SVGs ──
    svgImg(playerSVG,48,48).then(i=>SP.imgs.player=i),
    svgImg(copSVG,48,48).then(i=>SP.imgs.cop=i),
    svgImg(gangSVG,48,48).then(i=>SP.imgs.gang=i),
    ...npcSVGs.map((s,i)=>svgImg(s,36,36).then(im=>{ if(!SP.imgs.npcs)SP.imgs.npcs=[]; SP.imgs.npcs[i]=im; })),
    svgImg(sedanOvr,56,28).then(i=>SP.imgs.ovr={...SP.imgs.ovr,sedan:i,muscle:i,coupe:i}),
    svgImg(sportsOvr,60,24).then(i=>{SP.imgs.ovr=SP.imgs.ovr||{};SP.imgs.ovr.sports=i;}),
    svgImg(truckOvr,72,36).then(i=>{SP.imgs.ovr=SP.imgs.ovr||{};SP.imgs.ovr.truck=i;}),
    svgImg(suvOvr,64,34).then(i=>{SP.imgs.ovr=SP.imgs.ovr||{};SP.imgs.ovr.suv=i;}),
    svgImg(vanOvr,72,32).then(i=>{SP.imgs.ovr=SP.imgs.ovr||{};SP.imgs.ovr.van=i;}),
    svgImg(hpSVG,28,28).then(i=>SP.imgs.hp=i),
    svgImg(cashSVG,28,28).then(i=>SP.imgs.cash=i),
    svgImg(gunSVG,28,28).then(i=>SP.imgs.gun=i),
  ];
  await Promise.all(loads);
  SP.ready=true;
}

// ══════════════════════════════════════════
//  DRAW CAR
// ══════════════════════════════════════════
function drawCar(c2,car,isP){
  const w=car.w,h=car.h,s=car.style;

  // Drop shadow
  c2.save();c2.shadowColor='rgba(0,0,0,0.5)';c2.shadowBlur=6;c2.shadowOffsetX=3;c2.shadowOffsetY=3;
  // Body gradient
  const grad=c2.createLinearGradient(-w/2,-h/2,w/2,h/2);
  grad.addColorStop(0,shadeCol(car.col,35));grad.addColorStop(0.5,car.col);grad.addColorStop(1,shadeCol(car.col,-45));
  c2.fillStyle=grad;
  c2.beginPath();roundRect(c2,-w/2,-h/2,w,h,3);c2.fill();
  c2.restore();

  // Overlay sprite (windshield, wheels, lights etc)
  if(SP.ready&&SP.imgs.ovr){
    const ovr=SP.imgs.ovr[s]||SP.imgs.ovr.sedan;
    if(ovr)c2.drawImage(ovr,-w/2,-h/2,w,h);
  } else {
    // Fallback minimal detail
    c2.fillStyle='rgba(140,215,255,0.78)';c2.fillRect(w/2-11,-h/2+3,9,h-6);
    c2.fillStyle='#111';c2.fillRect(-w/2+1,-h/2-3,8,5);c2.fillRect(-w/2+1,h/2-2,8,5);c2.fillRect(w/2-9,-h/2-3,8,5);c2.fillRect(w/2-9,h/2-2,8,5);
    c2.fillStyle='rgba(255,255,160,.95)';c2.fillRect(w/2-2,-h/2+1,2,4);c2.fillRect(w/2-2,h/2-5,2,4);
    c2.fillStyle='rgba(255,40,40,.85)';c2.fillRect(-w/2,-h/2+1,2,4);c2.fillRect(-w/2,h/2-5,2,4);
  }

  if(isP){
    const spd=Math.abs(car.speed)/car.maxS;
    c2.fillStyle=`hsl(${120-spd*120},100%,60%)`;c2.fillRect(-w/2+2,-h/2,w-4,2);
    if(spd>0.35){
      c2.strokeStyle=`rgba(255,255,255,${spd*0.13})`;c2.lineWidth=1.5;c2.setLineDash([6,5]);
      for(let k=0;k<4;k++){const o=(k-1.5)*5;c2.beginPath();c2.moveTo(-w/2-4,o);c2.lineTo(-w/2-20,o);c2.stroke();}
      c2.setLineDash([]);
    }
  }
}

// Helper: shade a hex color
function shadeCol(hex,amt){
  let r=parseInt(hex.slice(1,3)||'88',16),g=parseInt(hex.slice(3,5)||'88',16),b=parseInt(hex.slice(5,7)||'88',16);
  r=Math.min(255,Math.max(0,r+amt));g=Math.min(255,Math.max(0,g+amt));b=Math.min(255,Math.max(0,b+amt));
  return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
}
// Helper: rounded rect path
function roundRect(c2,x,y,w,h,r){
  c2.moveTo(x+r,y);c2.lineTo(x+w-r,y);c2.quadraticCurveTo(x+w,y,x+w,y+r);
  c2.lineTo(x+w,y+h-r);c2.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c2.lineTo(x+r,y+h);c2.quadraticCurveTo(x,y+h,x,y+h-r);
  c2.lineTo(x,y+r);c2.quadraticCurveTo(x,y,x+r,y);c2.closePath();
}

