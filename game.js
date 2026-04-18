// ═══════════════════════════════════════════════════════════════
//  game.js  –  Input, Shop, HUD, Minimap bg, Game state,
//              update() AI/physics, render() scene, Main loop
//  Depends on: world.js, assets.js
// ═══════════════════════════════════════════════════════════════

//  INPUT
// ══════════════════════════════════════════
const inp={dx:0,dy:0,atk:false,spr:false,ent:false,entUsed:false};
let jOn=false,jO={x:0,y:0};
const jk=document.getElementById('jk'),jz=document.getElementById('jz'),MK=46;
jz.addEventListener('touchstart',e=>{e.preventDefault();const r=jz.getBoundingClientRect();jO={x:r.left+r.width/2,y:r.top+r.height/2};jOn=true;},{passive:false});
jz.addEventListener('touchmove',e=>{e.preventDefault();if(!jOn)return;const t=e.touches[0];let dx=t.clientX-jO.x,dy=t.clientY-jO.y,d=Math.sqrt(dx*dx+dy*dy);if(d>MK){dx=dx/d*MK;dy=dy/d*MK;}jk.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;inp.dx=dx/MK;inp.dy=dy/MK;},{passive:false});
function rjoy(){jOn=false;jk.style.transform='translate(-50%,-50%)';inp.dx=0;inp.dy=0;}
jz.addEventListener('touchend',e=>{e.preventDefault();rjoy();});
jz.addEventListener('touchcancel',e=>{e.preventDefault();rjoy();});
document.getElementById('bA').addEventListener('touchstart',e=>{e.preventDefault();inp.atk=true;});
document.getElementById('bA').addEventListener('touchend',e=>{e.preventDefault();inp.atk=false;});
document.getElementById('bS').addEventListener('touchstart',e=>{e.preventDefault();inp.spr=true;});
document.getElementById('bS').addEventListener('touchend',e=>{e.preventDefault();inp.spr=false;});
// CAR button: set a one-shot flag (not hold) so entry/exit fires once per tap
document.getElementById('bE').addEventListener('touchstart',e=>{
  e.preventDefault();
  if(!inp.entUsed){inp.ent=true;inp.entUsed=true;}
});
document.getElementById('bE').addEventListener('touchend',e=>{
  e.preventDefault();
  inp.entUsed=false;
});
document.getElementById('bSw').addEventListener('touchstart',e=>{e.preventDefault();if(wSlots.length>1)swapW();else showNotif('BUY MORE GUNS AT SHOP');});
document.getElementById('bSh').addEventListener('touchstart',e=>{e.preventDefault();openShop();});

// Keyboard
const keys={};
window.addEventListener('keydown',e=>keys[e.key]=true);
window.addEventListener('keyup',e=>keys[e.key]=false);
let ep=false,ap=false,qp=false;
function applyKeys(){
  let dx=0,dy=0;
  if(keys['ArrowLeft']||keys['a']||keys['A'])dx-=1;if(keys['ArrowRight']||keys['d']||keys['D'])dx+=1;
  if(keys['ArrowUp']||keys['w']||keys['W'])dy-=1;if(keys['ArrowDown']||keys['s']||keys['S'])dy+=1;
  if(dx||dy){inp.dx=dx;inp.dy=dy;}
  if(keys[' ']&&!ap){inp.atk=true;ap=true;}if(!keys[' '])ap=false;
  inp.spr=!!keys['Shift'];
  const ek=keys['e']||keys['E'];if(ek&&!ep){inp.ent=true;ep=true;}if(!ek)ep=false;
  const qk=keys['q']||keys['Q'];if(qk&&!qp){if(wSlots.length>1)swapW();qp=true;}if(!qk)qp=false;
  if((keys['b']||keys['B'])&&gameRunning&&!shopOpen)openShop();
}

// ══════════════════════════════════════════
//  SHOP (fixed – works on touch and click)
// ══════════════════════════════════════════
let shopOpen=false;

function openShop(){
  shopOpen=true;
  const el=document.getElementById('shopOverlay');
  el.style.display='flex';
  document.getElementById('shopMoney').textContent='Cash: $'+PL.cash;
}
function closeShop(){
  shopOpen=false;
  document.getElementById('shopOverlay').style.display='none';
}
// Wire close button BOTH click and touch
const cBtn=document.getElementById('shopCloseBtn');
cBtn.addEventListener('click',closeShop);
cBtn.addEventListener('touchend',e=>{e.preventDefault();closeShop();});

// ══════════════════════════════════════════
//  FULL MAP OVERLAY
// ══════════════════════════════════════════
let fullMapOpen=false;
const fmOverlay=document.getElementById('fullMapOverlay');
const fmCanvas =document.getElementById('fullMapCanvas');
const fmCtx    =fmCanvas.getContext('2d');

// Scale the full-map canvas to fill available space nicely
// Called once on open and on resize
function sizeFMCanvas(){
  const wrap=document.getElementById('fullMapWrap');
  const ww=wrap.clientWidth-16;
  const wh=wrap.clientHeight-16;
  const side=Math.min(ww,wh);
  const S=4; // 4px per tile
  fmCanvas.width=WW*S;
  fmCanvas.height=WH*S;
  fmCanvas.style.width=side+'px';
  fmCanvas.style.height=side+'px';
}

function renderFullMap(){
  const S=4; // internal scale: 4px per tile → 400×400 canvas
  const CW=WW*S, CH=WH*S;
  fmCtx.clearRect(0,0,CW,CH);

  // ── Base tile layer ──────────────────────────────────────────
  const FCOL={
    0:'#1a2e10', // grass
    1:'#4a4a4a', // road  (drawn again below as brighter strip)
    2:'#2d2d2d', // building
    3:'#3a3a30', // sidewalk
    4:'#1e4a14', // park
    5:'#0e2a5a', // water
    6:'#0a280a', // hospital
    7:'#280a0a', // gang turf
    8:'#0a0a28', // cop HQ
    9:'#1e0e00'  // shop
  };
  for(let ty=0;ty<WH;ty++)for(let tx=0;tx<WW;tx++){
    fmCtx.fillStyle=FCOL[WD[ty][tx]]||'#1a1a1a';
    fmCtx.fillRect(tx*S,ty*S,S,S);
  }

  // ── Named zone overlays (subtle tint) ────────────────────────
  const ZCOL={
    DOWNTOWN:'rgba(80,80,120,0.18)',
    DOCKLANDS:'rgba(60,50,20,0.18)',
    SUBURBS:'rgba(30,60,20,0.14)',
    INDUSTRIAL:'rgba(50,40,20,0.20)',
    'EAST SIDE':'rgba(60,20,60,0.15)',
    MIDTOWN:'rgba(20,50,60,0.16)',
    WESTGATE:'rgba(40,40,20,0.15)',
  };
  for(const z of NZONES){
    fmCtx.fillStyle=ZCOL[z.name]||'rgba(255,255,255,0.04)';
    fmCtx.fillRect(z.x1*S,z.y1*S,(z.x2-z.x1)*S,(z.y2-z.y1)*S);
  }

  // ── Roads (bright lines) ─────────────────────────────────────
  for(let ty=0;ty<WH;ty++)for(let tx=0;tx<WW;tx++){
    if(WD[ty][tx]!==1)continue;
    fmCtx.fillStyle='#5a5a5a';
    fmCtx.fillRect(tx*S,ty*S,S,S);
    // Centre dash
    fmCtx.fillStyle='rgba(255,255,80,0.18)';
    fmCtx.fillRect(tx*S+S/2-0.5,ty*S,1,S);
  }

  // ── Special zone fills & labels ──────────────────────────────
  const SLABS=[
    {z:SPECIAL_ZONES.hospital, col:'rgba(0,180,60,0.28)',  border:'rgba(0,255,80,0.55)', label:'H'},
    {z:SPECIAL_ZONES.gangA,    col:'rgba(200,20,20,0.28)', border:'rgba(255,50,50,0.55)', label:'G'},
    {z:SPECIAL_ZONES.gangB,    col:'rgba(200,20,20,0.28)', border:'rgba(255,50,50,0.55)', label:'G'},
    {z:SPECIAL_ZONES.copHQ,    col:'rgba(20,60,200,0.28)', border:'rgba(60,120,255,0.55)',label:'P'},
    {z:SPECIAL_ZONES.shopA,    col:'rgba(200,100,0,0.28)', border:'rgba(255,160,0,0.55)', label:'$'},
    {z:SPECIAL_ZONES.shopB,    col:'rgba(200,100,0,0.28)', border:'rgba(255,160,0,0.55)', label:'$'},
    {z:SPECIAL_ZONES.shopC,    col:'rgba(200,100,0,0.28)', border:'rgba(255,160,0,0.55)', label:'$'},
    {z:SPECIAL_ZONES.shopD,    col:'rgba(200,100,0,0.28)', border:'rgba(255,160,0,0.55)', label:'$'},
  ];
  // Add mission zones if missions system is loaded
  if(typeof MISSION_ZONES!=='undefined'){
    for(const mz of MISSION_ZONES){
      SLABS.push({z:mz,col:'rgba(255,200,0,0.22)',border:'rgba(255,220,60,0.7)',label:'M',isMission:true});
    }
  }
  for(const{z,col,border,label,isMission} of SLABS){
    const zx=z.x1*S,zy=z.y1*S,zw=(z.x2-z.x1)*S,zh=(z.y2-z.y1)*S;
    fmCtx.fillStyle=col; fmCtx.fillRect(zx,zy,zw,zh);
    fmCtx.strokeStyle=border; fmCtx.lineWidth=isMission?1.5:1;
    fmCtx.strokeRect(zx+0.5,zy+0.5,zw-1,zh-1);
    // Label badge at zone centre
    const cx=(z.x1+z.x2)/2*S, cy=(z.y1+z.y2)/2*S;
    const br=isMission?5:4;
    fmCtx.fillStyle=border;
    fmCtx.beginPath();fmCtx.arc(cx,cy,br,0,Math.PI*2);fmCtx.fill();
    fmCtx.fillStyle='rgba(0,0,0,0.9)';
    fmCtx.font=`bold ${isMission?6:5}px monospace`;
    fmCtx.textAlign='center';fmCtx.textBaseline='middle';
    fmCtx.fillText(label,cx,cy+0.5);
  }

  // ── Zone name text labels ─────────────────────────────────────
  fmCtx.font='bold 5px monospace';
  fmCtx.textAlign='center';fmCtx.textBaseline='middle';
  for(const z of NZONES){
    const cx=(z.x1+z.x2)/2*S, cy=(z.y1+z.y2)/2*S;
    fmCtx.fillStyle='rgba(255,255,255,0.18)';
    fmCtx.fillText(z.name,cx,cy);
  }

  // ── Water shimmer ─────────────────────────────────────────────
  fmCtx.fillStyle='rgba(40,100,220,0.22)';
  for(let ty=0;ty<WH;ty++)for(let tx=0;tx<WW;tx++){
    if(WD[ty][tx]===5) fmCtx.fillRect(tx*S,ty*S,S,S);
  }

  // ── Traffic cars ─────────────────────────────────────────────
  fmCtx.fillStyle='rgba(200,200,60,0.5)';
  for(const tc of traf){
    const mx=tc.x/T*S, my=tc.y/T*S;
    fmCtx.fillRect(mx-1,my-1,2,2);
  }

  // ── NPC civilians ─────────────────────────────────────────────
  fmCtx.fillStyle='rgba(80,220,80,0.55)';
  for(const n of npcs){
    fmCtx.beginPath();fmCtx.arc(n.x/T*S,n.y/T*S,1.2,0,Math.PI*2);fmCtx.fill();
  }

  // ── Gangsters ─────────────────────────────────────────────────
  fmCtx.fillStyle='rgba(255,40,40,0.9)';
  for(const g of gangs){
    fmCtx.beginPath();fmCtx.arc(g.x/T*S,g.y/T*S,1.8,0,Math.PI*2);fmCtx.fill();
  }

  // ── Police cars ───────────────────────────────────────────────
  fmCtx.fillStyle='rgba(60,160,255,0.85)';
  for(const pc of pcars){
    fmCtx.beginPath();fmCtx.arc(pc.x/T*S,pc.y/T*S,2.5,0,Math.PI*2);fmCtx.fill();
  }

  // ── Cops on foot ──────────────────────────────────────────────
  fmCtx.fillStyle='rgba(40,100,255,0.8)';
  for(const c of cops){
    fmCtx.beginPath();fmCtx.arc(c.x/T*S,c.y/T*S,1.8,0,Math.PI*2);fmCtx.fill();
  }

  // ── Mission waypoint ──────────────────────────────────────────
  if(typeof activeMission!=='undefined'&&activeMission&&activeMission.target){
    const mx=activeMission.target.x/T*S, my=activeMission.target.y/T*S;
    const pulse=0.5+0.5*Math.sin(Date.now()/300);
    fmCtx.strokeStyle=`rgba(255,220,0,${0.7+pulse*0.3})`;
    fmCtx.lineWidth=1.5;
    fmCtx.beginPath();fmCtx.arc(mx,my,4+pulse*2,0,Math.PI*2);fmCtx.stroke();
    fmCtx.fillStyle='rgba(255,220,0,0.9)';
    fmCtx.font='bold 6px monospace';
    fmCtx.textAlign='center';fmCtx.textBaseline='middle';
    fmCtx.fillText('★',mx,my);
  }

  // ── Player ────────────────────────────────────────────────────
  const px=PL.x/T*S, py=PL.y/T*S;
  // Outer glow
  fmCtx.shadowColor='rgba(255,180,0,0.9)';fmCtx.shadowBlur=8;
  fmCtx.fillStyle='rgba(255,170,0,0.95)';
  fmCtx.beginPath();fmCtx.arc(px,py,3.5,0,Math.PI*2);fmCtx.fill();
  fmCtx.shadowBlur=0;
  // Direction arrow
  fmCtx.strokeStyle='rgba(255,230,100,0.95)';fmCtx.lineWidth=1.5;
  fmCtx.beginPath();
  fmCtx.moveTo(px,py);
  fmCtx.lineTo(px+Math.cos(PL.angle)*8,py+Math.sin(PL.angle)*8);
  fmCtx.stroke();
  // White dot center
  fmCtx.fillStyle='#fff';
  fmCtx.beginPath();fmCtx.arc(px,py,1.2,0,Math.PI*2);fmCtx.fill();

  // ── View-cone circle ─────────────────────────────────────────
  const viewR=(1500/2)/T*S;
  fmCtx.strokeStyle='rgba(255,200,0,0.12)';fmCtx.lineWidth=0.8;
  fmCtx.setLineDash([3,3]);
  fmCtx.beginPath();fmCtx.arc(px,py,viewR,0,Math.PI*2);fmCtx.stroke();
  fmCtx.setLineDash([]);

  // ── Scanline overlay ─────────────────────────────────────────
  fmCtx.fillStyle='rgba(0,0,0,0.07)';
  for(let sy=0;sy<CH;sy+=2) fmCtx.fillRect(0,sy,CW,1);

  // ── Coords label ─────────────────────────────────────────────
  const zone=getZone(Math.floor(PL.x/T),Math.floor(PL.y/T));
  const sp=getSpecial(Math.floor(PL.x/T),Math.floor(PL.y/T));
  const areaName=sp?sp.name:(zone?zone.name:'CITY');
  document.getElementById('fullMapCoords').textContent=
    areaName+'  X:'+(PL.x/T|0)+' Y:'+(PL.y/T|0)+'  TAP TO CLOSE';
}

function openFullMap(){
  if(!gameRunning)return;
  fullMapOpen=true;
  fmOverlay.classList.add('open');
  sizeFMCanvas();
  renderFullMap();
}
function closeFullMap(){
  fullMapOpen=false;
  fmOverlay.classList.remove('open');
}

// Minimap click/tap → open full map
const mmEl=document.getElementById('mm');
mmEl.addEventListener('click', openFullMap);
mmEl.addEventListener('touchend',e=>{e.preventDefault();openFullMap();});

// Click anywhere on overlay → close
fmOverlay.addEventListener('click',closeFullMap);
fmOverlay.addEventListener('touchend',e=>{e.preventDefault();closeFullMap();});

// Close button stops propagation so only one handler fires
const fmClose=document.getElementById('fullMapCloseBtn');
fmClose.addEventListener('click',e=>{e.stopPropagation();closeFullMap();});
fmClose.addEventListener('touchend',e=>{e.preventDefault();e.stopPropagation();closeFullMap();});

// Re-size canvas if window resizes while map is open
window.addEventListener('resize',()=>{if(fullMapOpen){sizeFMCanvas();renderFullMap();}});

function shopBuy(item,price){
  // Balance check
  if(PL.cash<price){
    showNotif('NOT ENOUGH CASH — NEED $'+price);
    return;
  }

  // Validate item exists
  const validItems=['medkit','armor','ammo','pistol','shotgun','uzi','sniper','rocket'];
  if(!validItems.includes(item)){showNotif('UNKNOWN ITEM');return;}

  // Pre-purchase checks
  if(item==='medkit'&&PL.hp>=PL.maxHp){showNotif('ALREADY AT FULL HEALTH');return;}
  if(item==='armor'&&PL.maxHp>=150){showNotif('ARMOR ALREADY EQUIPPED');return;}
  if(item==='ammo'){
    const refillable=wSlots.filter(w=>w.ammo!==Infinity&&w.ammo<WDEFS[w.id].max);
    if(!refillable.length){showNotif('ALL GUNS ALREADY FULL');return;}
  }

  // Deduct cost AFTER all checks pass
  PL.cash-=price;

  // Apply effect
  if(item==='medkit'){
    PL.hp=Math.min(PL.maxHp,PL.hp+50);
    showNotif('+50 HP  [$'+price+']');
  } else if(item==='armor'){
    const prevMax=PL.maxHp;
    PL.maxHp=150;
    PL.hp=Math.min(150,PL.hp+(150-prevMax));
    showNotif('ARMOR ON — MAX 150HP  [$'+price+']');
  } else if(item==='ammo'){
    refillAll();
    showNotif('ALL AMMO REFILLED  [$'+price+']');
    buildWHUD();
  } else {
    const isNew=giveW(item);
    if(isNew){
      showNotif(WDEFS[item].name+' ACQUIRED  [$'+price+']');
    } else {
      // Already owned — treat as ammo refill for that gun only
      showNotif(WDEFS[item].name+' AMMO REFILLED  [$'+price+']');
    }
    buildWHUD();
  }

  // Update displays
  document.getElementById('shopMoney').textContent='Cash: $'+PL.cash;
  updateHUD();buildWHUD();
}

// ══════════════════════════════════════════
//  NOTIFICATIONS & HUD
// ══════════════════════════════════════════
let nT=0;const nEl=document.getElementById('notif');
function showNotif(m){nEl.textContent=m;nEl.style.opacity='1';nT=2.2;}
function updateHUD(){
  document.getElementById('hpV').textContent=Math.max(0,Math.floor(PL.hp));
  document.getElementById('hpFill').style.width=Math.max(0,PL.hp/PL.maxHp*100)+'%';
  document.getElementById('scV').textContent=PL.score;
  document.getElementById('caV').textContent='$'+PL.cash;
  for(let i=1;i<=5;i++)document.getElementById('s'+i).classList.toggle('on',PL.wanted>=i);
  const sb=document.getElementById('spdBox');
  if(PL.inCar&&PL.car){sb.style.display='block';document.getElementById('carNm').textContent=PL.car.name;document.getElementById('spdVal').textContent=Math.abs(Math.floor(PL.car.speed*0.44));}
  else sb.style.display='none';
}

// Minimap background (pre-rendered)
const mmBg=document.createElement('canvas');mmBg.width=WW;mmBg.height=WH;
const mmBC=mmBg.getContext('2d');
function buildMM(){
  for(let ty=0;ty<WH;ty++)for(let tx=0;tx<WW;tx++){
    const t=WD[ty][tx];
    mmBC.fillStyle=t===1?'#666':t===2?'#2a2a2a':t===4?'#2a5a1a':t===5?'#1a3a6a':t===6?'#0a3a0a':t===7?'#3a0a0a':t===8?'#0a0a3a':t===9?'#3a1800':'#182510';
    mmBC.fillRect(tx,ty,1,1);
  }
  // Labels on minimap
  mmBC.fillStyle='rgba(0,255,0,0.6)';mmBC.fillRect(8,8,12,12);        // hospital
  mmBC.fillStyle='rgba(255,0,0,0.6)';mmBC.fillRect(105,15,18,18);mmBC.fillRect(27,105,18,18); // gangs
  mmBC.fillStyle='rgba(0,0,255,0.6)';mmBC.fillRect(66,66,18,18);       // cop HQ
  mmBC.fillStyle='rgba(255,128,0,0.7)';mmBC.fillRect(2,2,5,5);mmBC.fillRect(141,2,5,5);mmBC.fillRect(2,141,5,5);mmBC.fillRect(141,141,5,5); // shops
}
buildMM();

// ══════════════════════════════════════════
//  GAME STATE
// ══════════════════════════════════════════
let gameRunning=false,lastT=0;
document.getElementById('startBtn').addEventListener('click',async()=>{
  document.getElementById('startBtn').textContent='LOADING...';
  document.getElementById('startBtn').disabled=true;
  await initSprites();
  document.getElementById('startScreen').style.display='none';
  if(typeof initAI==='function')initAI();
  if(typeof initMissions==='function')initMissions();
  if(typeof initApproval==='function')initApproval();
  gameRunning=true;lastT=performance.now();buildWHUD();requestAnimationFrame(loop);
});
document.getElementById('reBtn').addEventListener('click',()=>{
  document.getElementById('goScreen').style.display='none';
  resetGame();
  if(typeof initAI==='function')initAI();
  // Re-init missions/approval state only (UI already exists from first start)
  if(typeof initMissions==='function')initMissions();
  if(typeof initApproval==='function')initApproval();
  gameRunning=true;lastT=performance.now();requestAnimationFrame(loop);
});
function resetGame(){
  // ── Player state ──
  PL.x=3000;PL.y=3000;
  PL.hp=100;PL.maxHp=100;
  PL.angle=0;PL.inv=0;PL.atkCd=0;
  PL.inCar=false;PL.car=null;
  PL.score=0;PL.cash=0;
  PL.wanted=0;PL.wantT=0;
  PL.spd=118;PL.spM=1.8;  // restore in case modifiers were applied

  // ── Input state (prevent ghost inputs on restart) ──
  inp.dx=0;inp.dy=0;inp.atk=false;inp.spr=false;inp.ent=false;inp.entUsed=false;

  // ── Economy / progress ──

  // ── Weapon inventory: reset to fists only ──
  wSlots=[{...WDEFS.fists}];wIdx=0;

  // ── Clear all dynamic entities ──
  bullets.length=0;parts.length=0;
  npcs.length=0;picks.length=0;
  resetCops();  // clears cops[], pcars[], raidTimer
  resetGangs(); // clears gangs[], gangKills

  // ── Reset parked cars: restore hp, unoccupy, stop ──
  for(const c of cars){
    c.health=80;c.hp=80;  // normalise both fields
    c.driven=false;c.speed=0;
  }
  // ── Reset traffic cars — rebuild array to restore destroyed ones ──
  traf.length = 0;
  const _rtRoad = [];
  for (let y = MAP_EDGE_MARGIN; y < WH - MAP_EDGE_MARGIN; y++)
    for (let x = MAP_EDGE_MARGIN; x < WW - MAP_EDGE_MARGIN; x++)
      if (WD[y][x] === 1) _rtRoad.push({x, y});
  for (let i = 0; i < 38; i++) {
    const t = _rtRoad[Math.floor(Math.random() * _rtRoad.length)];
    const tc = mkCar(t.x*T+T/2, t.y*T+T/2, i%5, PAL[(i+6)%PAL.length]);
    tc.angle = Math.round(Math.random()*4)*(Math.PI/2);
    tc.speed = 25 + Math.random()*28; tc.tT = 2 + Math.random()*4; tc.isTraf = true;
    traf.push(tc);
  }

  // ── Re-spawn pickups (with edge margin) ──
  for(let i=0;i<60;i++){
    let tx,ty;
    do{tx=MAP_EDGE_MARGIN+Math.floor(Math.random()*(WW-MAP_EDGE_MARGIN*2));
       ty=MAP_EDGE_MARGIN+Math.floor(Math.random()*(WH-MAP_EDGE_MARGIN*2));}
    while(!isW(tx,ty));
    spawnPick(tx*T+T/2,ty*T+T/2,Math.random()<0.5?'hp':'cash');
  }

  // ── Re-populate world ──
  // Clear NPCs (including any stale mission target NPCs) before re-spawning
  npcs.length = 0;
  spawnNPCs();
  // gangs and cops reset via resetCops()/resetGangs() already called above

  // ── Camera snap to player ──
  cam.x=PL.x;cam.y=PL.y;

  buildWHUD();updateHUD();
}

// ══════════════════════════════════════════
//  UPDATE
// ══════════════════════════════════════════
function update(dt){
  if(shopOpen)return;
  applyKeys();
  if(!jOn&&!keys['ArrowLeft']&&!keys['ArrowRight']&&!keys['ArrowUp']&&!keys['ArrowDown']&&!keys['a']&&!keys['d']&&!keys['w']&&!keys['s']&&!keys['A']&&!keys['D']&&!keys['W']&&!keys['S']){inp.dx=0;inp.dy=0;}

  if(nT>0){nT-=dt;if(nT<=0)nEl.style.opacity='0';}
  PL.atkCd=Math.max(0,PL.atkCd-dt);PL.inv=Math.max(0,PL.inv-dt);

  // ── Wanted decay ──
  // cleanTime accumulates while player avoids cops+gangs.
  // Decay threshold per star level defined in world.js: WANTED_DECAY_TIME[]
  if(PL.wanted>0){
    const copNear=cops.some(c=>d2(c.x,c.y,PL.x,PL.y)<320*320);
    const gangNear=gangs.some(g=>d2(g.x,g.y,PL.x,PL.y)<220*220);
    if(!copNear&&!gangNear){
      PL.wantT-=dt;
      if(PL.wantT<=0){
        PL.wanted=Math.max(0,PL.wanted-1);
        if(PL.wanted===0){
          showNotif('WANTED CLEARED — YOU GOT AWAY');
        } else {
          showNotif('★'.repeat(PL.wanted)+' — KEEP HIDING');
          PL.wantT=WANTED_DECAY_TIME[PL.wanted]||8;
        }
      }
    } else {
      // Being actively pursued — reset decay window
      PL.wantT=WANTED_DECAY_TIME[PL.wanted]||8;
    }
  }

  // Spawn cops based on wanted
  if(PL.wanted>0&&cops.length<PL.wanted*3){
    const a=Math.random()*Math.PI*2,dist=270+Math.random()*130;
    const sx=Math.max((MAP_EDGE_MARGIN+1)*T,Math.min((WW-MAP_EDGE_MARGIN-1)*T,PL.x+Math.cos(a)*dist));
    const sy=Math.max((MAP_EDGE_MARGIN+1)*T,Math.min((WH-MAP_EDGE_MARGIN-1)*T,PL.y+Math.sin(a)*dist));
    spawnCop(sx,sy);
  }

  // Repopulate gang turfs & cop HQ
  updateCopSpawns(dt);
  updateGangSpawns(dt);

  // Current tile
  const ptx=Math.floor(PL.x/T),pty=Math.floor(PL.y/T);
  const tileType=(pty>=0&&pty<WH&&ptx>=0&&ptx<WW)?WD[pty][ptx]:0;
  const sp=getSpecial(ptx,pty);

  // HOSPITAL: detect via adjacent tiles (not just current tile centre)
  // Player counts as "in hospital" if any of 4 corner tiles is type 6
  const _hx=PL.x,_hy=PL.y,_hr=10;
  const inHospital=[
    [Math.floor((_hx-_hr)/T),Math.floor((_hy-_hr)/T)],
    [Math.floor((_hx+_hr)/T),Math.floor((_hy-_hr)/T)],
    [Math.floor((_hx-_hr)/T),Math.floor((_hy+_hr)/T)],
    [Math.floor((_hx+_hr)/T),Math.floor((_hy+_hr)/T)],
  ].some(([tx2,ty2])=>ty2>=0&&ty2<WH&&tx2>=0&&tx2<WW&&WD[ty2][tx2]===6);

  if(inHospital){
    let enemyNear=false;
    for(const c of cops){if(d2(c.x,c.y,PL.x,PL.y)<200*200){enemyNear=true;break;}}
    if(!enemyNear)for(const g of gangs){if(d2(g.x,g.y,PL.x,PL.y)<200*200){enemyNear=true;break;}}
    if(enemyNear){
      document.getElementById('areaTag').textContent='[ HOSPITAL ] ENEMY NEARBY — BLOCKED';
    } else {
      // Heal rapidly; snap to full if within 2hp to avoid float drift
      PL.hp=Math.min(PL.maxHp,PL.hp+30*dt);
      if(PL.maxHp-PL.hp<2) PL.hp=PL.maxHp;
      if(PL.hp>=PL.maxHp){
        document.getElementById('areaTag').textContent='[ HOSPITAL ] FULL HEALTH';
      } else {
        document.getElementById('areaTag').textContent='[ HOSPITAL ] HEALING... '+Math.floor(PL.hp)+'/'+PL.maxHp;
      }
    }
  } else if(sp){
    document.getElementById('areaTag').textContent=
      sp.key==='gangA'||sp.key==='gangB'?'[ GANG TURF ] DANGER!':
      sp.key==='copHQ'?'[ COP HQ ] HIGH ALERT':
      sp.key.startsWith('shop')?'[ SHOP ] TAP SHOP TO BUY':
      sp.name;
  } else {
    const z=getZone(ptx,pty);
    document.getElementById('areaTag').textContent=z?z.name:'';
  }

  // ── IN CAR ──
  if(PL.inCar&&PL.car){
    const car=PL.car,len=Math.sqrt(inp.dx**2+inp.dy**2);
    if(len>0.1){
      const ta=Math.atan2(inp.dy,inp.dx);let diff=ta-car.angle;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;
      car.angle+=diff*car.trn*dt;car.speed=Math.min(car.speed+car.acc*dt*len,car.maxS);
    }else car.speed*=0.88;
    const cx=car.x+Math.cos(car.angle)*car.speed*dt,cy=car.y+Math.sin(car.angle)*car.speed*dt;
    if(!tColl(cx-car.w/2,car.y-car.h/2,car.w,car.h))car.x=cx;else car.speed*=-0.28;
    if(!tColl(car.x-car.w/2,cy-car.h/2,car.w,car.h))car.y=cy;else car.speed*=-0.28;
    PL.x=car.x;PL.y=car.y;PL.angle=car.angle;
    if(inp.ent){
  inp.ent=false;inp.entUsed=false;
  PL.inCar=false;car.driven=false;car.speed=0;PL.car=null;
  // Place player slightly to the side of the car on exit
  PL.x=car.x+Math.cos(car.angle+Math.PI/2)*20;
  PL.y=car.y+Math.sin(car.angle+Math.PI/2)*20;
  // Clamp to valid tile
  const etx=Math.floor(PL.x/T),ety=Math.floor(PL.y/T);
  if(!isW(etx,ety)){PL.x=car.x;PL.y=car.y;}
  showNotif('EXIT: '+car.name);
}
    if(inp.atk){inp.atk=false;showNotif('EXIT CAR TO SHOOT');}
    // Ram NPCs
    const cr=[car.x-car.w/2,car.y-car.h/2,car.w,car.h];
    for(let i=npcs.length-1;i>=0;i--){const n=npcs[i];if(Math.abs(car.speed)>35&&rR(...cr,n.x-n.w/2,n.y-n.h/2,n.w,n.h)){spawnPts(n.x,n.y,n.col,12);PL.score+=50;PL.cash+=n.cash;addWanted(1);recordKill('npc');if(typeof onApprovalCarHit==='function')onApprovalCarHit();npcs.splice(i,1);showNotif('+$'+n.cash+' RUN DOWN');}}
    for(let i=gangs.length-1;i>=0;i--){const g=gangs[i];if(Math.abs(car.speed)>35&&rR(...cr,g.x-g.w/2,g.y-g.h/2,g.w,g.h)){spawnPts(g.x,g.y,'#f00',12);PL.score+=80;PL.cash+=30;recordKill('gang');gangs.splice(i,1);showNotif('GANGSTER +$30');}}
    for(let i=traf.length-1;i>=0;i--){const tc=traf[i];if(Math.abs(car.speed)>50&&rR(...cr,tc.x-tc.w/2,tc.y-tc.h/2,tc.w,tc.h)){spawnPts(tc.x,tc.y,'#f80',10);PL.score+=20;addWanted(1);traf.splice(i,1);}}
    for(let i=cops.length-1;i>=0;i--){const c=cops[i];if(Math.abs(car.speed)>40&&rR(...cr,c.x-c.w/2,c.y-c.h/2,c.w,c.h)){c.hp-=car.speed*0.06;if(c.hp<=0){
  const gr2=COP_GRADES[c.grade||0];
  spawnPts(c.x,c.y,'#00f',12);PL.score+=gr2.reward;PL.cash+=gr2.reward;
  if(c.carIdx>=0&&c.carIdx<pcars.length)pcars[c.carIdx].copIdx=-1;
  recordKill('cop');cops.splice(i,1);showNotif(gr2.name+' +$'+gr2.reward);addWanted(2);}}}
  } else {
    // ── ON FOOT ──
    const len=Math.sqrt(inp.dx**2+inp.dy**2);
    if(len>0.1){const spd=inp.spr?PL.spd*PL.spM:PL.spd,nx=inp.dx/(len>1?len:1),ny=inp.dy/(len>1?len:1);PL.angle=Math.atan2(ny,nx);mvE(PL,nx*spd*dt,ny*spd*dt);}
    if(inp.ent){
  inp.ent=false;inp.entUsed=false;
  let best=null,bD=Infinity;
  for(const c of cars){
    const dd=d2(c.x,c.y,PL.x,PL.y);
    // Only enter if close enough, not already driven, and car is on a walkable tile
    const ctx2=Math.floor(c.x/T),cty2=Math.floor(c.y/T);
    if(dd<1500&&!c.driven&&dd<bD&&isW(ctx2,cty2)){bD=dd;best=c;}
  }
  if(best){
    PL.inCar=true;PL.car=best;best.driven=true;best.speed=0;
    showNotif('JACKED: '+best.name+' — MAX '+Math.floor(best.maxS*0.44)+'MPH');
  } else {
    showNotif('NO CAR NEARBY');
  }
}
    if(inp.atk&&PL.atkCd<=0){
      inp.atk=false;
      const w=curW();PL.atkCd=w.rate;
      if(w.melee){
        let hit=false;
        for(let i=npcs.length-1;i>=0;i--){const n=npcs[i];if(d2(n.x,n.y,PL.x,PL.y)<28*28){n.hp-=w.dmg;n.flee=true;spawnPts(n.x,n.y,'#f80',6);if(n.hp<=0){PL.score+=30;PL.cash+=n.cash;addWanted(1);recordKill('npc');spawnPts(n.x,n.y,n.col,12);npcs.splice(i,1);showNotif('+$'+n.cash);}hit=true;}}
        for(let i=gangs.length-1;i>=0;i--){const g=gangs[i];if(d2(g.x,g.y,PL.x,PL.y)<28*28){g.hp-=w.dmg;spawnPts(g.x,g.y,'#f00',6);if(g.hp<=0){PL.score+=80;PL.cash+=30;recordKill('gang');gangs.splice(i,1);showNotif('GANGSTER +$30');}hit=true;}}
        if(!hit)showNotif('NOTHING IN RANGE');
      }else{fireW(PL.x+Math.cos(PL.angle)*16,PL.y+Math.sin(PL.angle)*16,PL.angle);}
    }
  }

  // ── AI tick (traffic, NPCs, gangsters, cops, bullets, pickups, particles) ──
  if(typeof updateAI==='function')updateAI(dt);
  if(typeof updateMissions==='function')updateMissions(dt);
  if(typeof updateApproval==='function')updateApproval(dt);
  if(typeof updateArchitecture==='function')updateArchitecture();

  cam.x+=(PL.x-cam.x)*9*dt;cam.y+=(PL.y-cam.y)*9*dt;

  if(PL.hp<=0){PL.hp=0;gameRunning=false;document.getElementById('goScore').textContent='Score: '+PL.score+'\nCash: $'+PL.cash;document.getElementById('goScreen').style.display='flex';}
  updateHUD();
}

// ══════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════
function render(){
  const now=Date.now();
  CX.clearRect(0,0,W,H);

  // ── Night sky vignette ──
  const vg=CX.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.85);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,0.45)');

  const tx0=Math.floor((cam.x-W/2)/T)-1,ty0=Math.floor((cam.y-H/2)/T)-1;
  const tx1=Math.ceil((cam.x+W/2)/T)+1,ty1=Math.ceil((cam.y+H/2)/T)+1;

  for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
    const type=(ty>=0&&ty<WH&&tx>=0&&tx<WW)?WD[ty][tx]:2;
    const sx=(tx*T-cam.x)+W/2,sy=(ty*T-cam.y)+H/2;
    const seed=(tx*79+ty*41+tx*ty*3)&0xff;

    // Base tile
    CX.fillStyle=TCOL[type]||'#222';CX.fillRect(sx,sy,T+1,T+1);

    if(type===0){ // Grass
      if(SP.tiles[0])CX.drawImage(SP.tiles[0],sx,sy,T,T);
    }
    if(type===1){ // Road
      if(SP.tiles[1])CX.drawImage(SP.tiles[1],sx,sy,T,T);
      else{CX.fillStyle='#3a3a3a';CX.fillRect(sx,sy,T,T);}
      // Tyre scuff marks (subtle)
      if(seed%9===0){CX.fillStyle='rgba(0,0,0,0.12)';CX.fillRect(sx+seed%16+4,sy+2,6,T-4);}
      // Lane centre dashes — only on every other tile to avoid double-drawing
      const isHRoad=WD[ty]&&WD[ty][tx-1]===1&&WD[ty]&&WD[ty][tx+1]===1;
      const isVRoad=WD[ty-1]&&WD[ty-1][tx]===1&&WD[ty+1]&&WD[ty+1][tx]===1;
      if(isHRoad&&!isVRoad){
        CX.strokeStyle='rgba(255,255,80,0.25)';CX.lineWidth=1.5;CX.setLineDash([8,10]);
        CX.beginPath();CX.moveTo(sx,sy+T/2);CX.lineTo(sx+T,sy+T/2);CX.stroke();CX.setLineDash([]);
      } else if(isVRoad&&!isHRoad){
        CX.strokeStyle='rgba(255,255,80,0.25)';CX.lineWidth=1.5;CX.setLineDash([8,10]);
        CX.beginPath();CX.moveTo(sx+T/2,sy);CX.lineTo(sx+T/2,sy+T);CX.stroke();CX.setLineDash([]);
      }
      // Crosswalk stripes at intersections
      if(isHRoad&&isVRoad){
        CX.fillStyle='rgba(255,255,255,0.08)';
        for(let str=4;str<T-4;str+=7){CX.fillRect(sx+str,sy+2,4,T-4);}
      }
    }
    if(type===2&&tx>=0&&ty>=0&&tx<WW&&ty<WH){ // Building — pseudo-3D top-down
      const bc=BC[ty]&&BC[ty][tx]||'#444';
      const arch=seed%5;            // 0=office 1=residential 2=brutalist 3=brick 4=glass
      const W3=10;                  // wall depth in pixels
      const RW=T-W3, RH=T-W3;      // roof dimensions
      const tickSlot=Math.floor(now/4000);

      // ─── 0. Full-tile shadow base ──────────────────────────────
      CX.fillStyle='rgba(0,0,0,0.7)';CX.fillRect(sx,sy,T,T);

      // ─── 1. ROOF (top-left area) ───────────────────────────────
      // Colour: desaturated, lighter — concrete/tar seen from above
      const roofBase=arch===4?'#3a5070':arch===3?shadeCol(bc,28):shadeCol(bc,20);
      if(arch===4){
        // Glass tower roof: blue reflective panels
        const rg=CX.createLinearGradient(sx+1,sy+1,sx+RW,sy+RH);
        rg.addColorStop(0,'rgba(80,140,200,0.9)');rg.addColorStop(1,'rgba(40,80,150,0.95)');
        CX.fillStyle=rg;CX.fillRect(sx+1,sy+1,RW-1,RH-1);
        // Sky reflection streak
        CX.fillStyle='rgba(200,230,255,0.18)';CX.fillRect(sx+3,sy+2,RW-10,3);
      } else {
        // Concrete / tar roof
        const rg=CX.createLinearGradient(sx+1,sy+1,sx+RW,sy+RH);
        rg.addColorStop(0,shadeCol(roofBase,8));rg.addColorStop(1,roofBase);
        CX.fillStyle=rg;CX.fillRect(sx+1,sy+1,RW-1,RH-1);
        // Gravel/tar texture lines
        CX.strokeStyle='rgba(0,0,0,0.10)';CX.lineWidth=1;
        for(let rl=4;rl<RH-2;rl+=7){
          CX.beginPath();CX.moveTo(sx+2,sy+rl);CX.lineTo(sx+RW-2,sy+rl);CX.stroke();
        }
        // Brick roof: raised parapet line
        if(arch===3){
          CX.strokeStyle='rgba(0,0,0,0.2)';CX.lineWidth=1.5;
          CX.strokeRect(sx+1,sy+1,RW-2,RH-2);
        }
      }

      // Roof details
      if(seed%3===0){ // AC unit
        CX.fillStyle='rgba(70,72,80,0.95)';CX.fillRect(sx+RW-9,sy+2,8,5);
        CX.fillStyle='rgba(110,115,125,0.7)';CX.fillRect(sx+RW-8,sy+3,6,1);
        // Vent grille shadow
        CX.fillStyle='rgba(0,0,0,0.3)';CX.fillRect(sx+RW-9,sy+6,8,1);
      }
      if(seed%7===1){ // Stairwell shed
        CX.fillStyle='rgba(55,50,50,0.9)';CX.fillRect(sx+3,sy+2,9,7);
        CX.fillStyle='rgba(80,75,75,0.7)';CX.fillRect(sx+4,sy+3,7,2);
      }
      if(seed%5===2){ // Water tower legs + tank
        CX.fillStyle='rgba(60,40,20,0.8)';
        CX.fillRect(sx+4,sy+RH-7,2,6);CX.fillRect(sx+8,sy+RH-7,2,6);
        CX.fillStyle='rgba(80,60,30,0.85)';CX.fillRect(sx+3,sy+RH-9,9,4);
      }
      if(seed%11===3){ // Solar panels
        CX.fillStyle='rgba(20,40,80,0.85)';CX.fillRect(sx+5,sy+4,RW-12,RH-10);
        CX.strokeStyle='rgba(30,60,120,0.5)';CX.lineWidth=0.8;
        for(let sp2=6;sp2<RW-8;sp2+=4){CX.beginPath();CX.moveTo(sx+sp2,sy+4);CX.lineTo(sx+sp2,sy+RH-6);CX.stroke();}
      }

      // Roof edge highlight (NW lit edge)
      CX.strokeStyle='rgba(255,255,255,0.14)';CX.lineWidth=1;
      CX.beginPath();CX.moveTo(sx+1,sy+RH);CX.lineTo(sx+1,sy+1);CX.lineTo(sx+RW,sy+1);CX.stroke();

      // ─── 2. SOUTH WALL (bottom strip, full width) ──────────────
      // This is the front face of the building — full facade colour
      const sWallCol=arch===4?'#2a4870':arch===2?shadeCol(bc,-5):arch===3?shadeCol(bc,12):shadeCol(bc,8);
      if(arch===4){ // glass curtain wall south face
        const swg=CX.createLinearGradient(sx+1,sy+RH,sx+RW,sy+T-1);
        swg.addColorStop(0,'rgba(60,110,190,0.92)');swg.addColorStop(1,'rgba(30,70,140,0.95)');
        CX.fillStyle=swg;CX.fillRect(sx+1,sy+RH,RW-1,W3-1);
      } else {
        CX.fillStyle=sWallCol;CX.fillRect(sx+1,sy+RH,RW-1,W3-1);
        // Facade texture carries down
        if(arch===3){ // Brick south face
          CX.strokeStyle='rgba(0,0,0,0.15)';CX.lineWidth=0.8;
          CX.beginPath();CX.moveTo(sx+1,sy+RH+3);CX.lineTo(sx+RW,sy+RH+3);CX.stroke();
          CX.beginPath();CX.moveTo(sx+1,sy+RH+6);CX.lineTo(sx+RW,sy+RH+6);CX.stroke();
        }
        if(arch===2){ // Brutalist ribs continue
          CX.fillStyle='rgba(0,0,0,0.10)';
          for(let rb=6;rb<RW-4;rb+=8){CX.fillRect(sx+rb,sy+RH,2,W3-1);}
        }
      }

      // South wall windows (small, 3-4px tall)
      const swWin=arch===4?4:arch===1?5:4;  // window width
      const swH2=arch===4?4:3;              // window height
      const swCols=arch===4?4:arch===1?2:3;
      const swPad=Math.floor((RW-2-swCols*(swWin+2))/2);
      for(let sc=0;sc<swCols;sc++){
        const swx=sx+1+swPad+sc*(swWin+2);
        const swy=sy+RH+2;
        const swLit=(seed+sc*5+tickSlot)%7>1;
        const swWarm=(seed+sc*3)%3===0;
        CX.fillStyle='rgba(0,0,0,0.5)';CX.fillRect(swx-1,swy-1,swWin+2,swH2+2); // frame
        if(swLit){
          CX.fillStyle=swWarm?`rgba(255,205,70,${0.8+(seed%3)*0.07})`:`rgba(200,225,255,${0.7+(seed%4)*0.07})`;
          CX.fillRect(swx,swy,swWin,swH2);
        } else {
          CX.fillStyle='rgba(2,5,12,0.9)';CX.fillRect(swx,swy,swWin,swH2);
        }
      }

      // South wall bottom edge (street-level shadow)
      CX.fillStyle='rgba(0,0,0,0.45)';CX.fillRect(sx+1,sy+T-2,RW-1,2);
      // Ground contact line
      CX.strokeStyle='rgba(0,0,0,0.6)';CX.lineWidth=1;
      CX.beginPath();CX.moveTo(sx+1,sy+T-1);CX.lineTo(sx+RW,sy+T-1);CX.stroke();

      // ─── 3. EAST WALL (right strip, full height) ───────────────
      // Shadow face — significantly darker (no direct sunlight from NW)
      const eWallCol=arch===4?'#1a3055':shadeCol(sWallCol,-28);
      CX.fillStyle=eWallCol;CX.fillRect(sx+RW,sy+1,W3-1,T-2);

      // East wall windows (even smaller — angled away from viewer)
      if(arch!==2){ // brutalist has no visible E-wall windows
        const ewH=swCols>2?2:2, ewCols=2;
        const ewPad=Math.floor((T-2-ewCols*(3+2))/2);
        for(let ec=0;ec<ewCols;ec++){
          const ewx=sx+RW+2;
          const ewy=sy+1+ewPad+ec*((T-4)/ewCols);
          const ewLit=(seed+ec*11+tickSlot)%9>2;
          CX.fillStyle='rgba(0,0,0,0.55)';CX.fillRect(ewx-1,ewy,4,ewH+2);
          if(ewLit){CX.fillStyle=`rgba(180,200,240,0.5)`;CX.fillRect(ewx,ewy+1,3,ewH);}
          else{CX.fillStyle='rgba(0,2,8,0.9)';CX.fillRect(ewx,ewy+1,3,ewH);}
        }
      }

      // East wall right edge shadow
      CX.fillStyle='rgba(0,0,0,0.5)';CX.fillRect(sx+T-1,sy+1,1,T-2);

      // ─── 4. SE CORNER BLOCK ────────────────────────────────────
      // Intersection of south + east walls — deepest shadow
      CX.fillStyle='rgba(0,0,0,0.55)';CX.fillRect(sx+RW,sy+RH,W3-1,W3-1);

      // ─── 5. ROOF-TO-WALL LEDGE LINE ────────────────────────────
      // Crisp line where roof meets south wall (the parapet edge)
      CX.strokeStyle='rgba(255,255,255,0.18)';CX.lineWidth=1;
      CX.beginPath();CX.moveTo(sx+1,sy+RH);CX.lineTo(sx+RW,sy+RH);CX.stroke();
      // Roof-to-east wall ledge
      CX.strokeStyle='rgba(255,255,255,0.10)';
      CX.beginPath();CX.moveTo(sx+RW,sy+1);CX.lineTo(sx+RW,sy+RH);CX.stroke();

      // ─── 6. OUTER BORDER ───────────────────────────────────────
      CX.strokeStyle='rgba(0,0,0,0.4)';CX.lineWidth=1;CX.strokeRect(sx,sy,T,T);
    }
    if(type===3){ // Sidewalk
      if(SP.tiles[3])CX.drawImage(SP.tiles[3],sx,sy,T,T);
      else{CX.fillStyle='#686858';CX.fillRect(sx,sy,T,T);}
      // Paving slab joints
      CX.strokeStyle='rgba(0,0,0,0.18)';CX.lineWidth=0.8;
      const slabW=20,slabH=20;
      const offX=(tx%2)*10,offY=(ty%2)*10;
      for(let sl=offX;sl<T;sl+=slabW){CX.beginPath();CX.moveTo(sx+sl,sy);CX.lineTo(sx+sl,sy+T);CX.stroke();}
      for(let sl=offY;sl<T;sl+=slabH){CX.beginPath();CX.moveTo(sx,sy+sl);CX.lineTo(sx+T,sy+sl);CX.stroke();}
      // Crack on worn slabs
      if(seed%7===0){CX.strokeStyle='rgba(0,0,0,0.2)';CX.lineWidth=0.5;
        CX.beginPath();CX.moveTo(sx+seed%15+3,sy+seed%12+2);CX.lineTo(sx+seed%15+11,sy+seed%12+10);CX.stroke();}
    }
    if(type===4){ // Park
      if(SP.tiles[4])CX.drawImage(SP.tiles[4],sx,sy,T,T);
      else{CX.fillStyle='#2a5818';CX.fillRect(sx,sy,T,T);}
      const ptree=(tx*31+ty*17)%4;
      if(ptree===0){ // Tree with shadow
        CX.save();
        // Shadow ellipse
        CX.fillStyle='rgba(0,0,0,0.2)';CX.beginPath();CX.ellipse(sx+T/2+3,sy+T/2+4,10,6,0,0,Math.PI*2);CX.fill();
        // Trunk
        CX.fillStyle='#5a3010';CX.fillRect(sx+T/2-2,sy+T/2,4,7);
        // Canopy layers
        CX.shadowColor='rgba(0,80,0,0.4)';CX.shadowBlur=6;
        CX.fillStyle='#0d3808';CX.beginPath();CX.arc(sx+T/2,sy+T/2-2,12,0,Math.PI*2);CX.fill();
        CX.fillStyle='#185c10';CX.beginPath();CX.arc(sx+T/2-2,sy+T/2-4,9,0,Math.PI*2);CX.fill();
        CX.fillStyle='#22741a';CX.beginPath();CX.arc(sx+T/2+2,sy+T/2-6,7,0,Math.PI*2);CX.fill();
        // Highlight
        CX.fillStyle='rgba(80,180,40,0.25)';CX.beginPath();CX.arc(sx+T/2-3,sy+T/2-7,4,0,Math.PI*2);CX.fill();
        CX.shadowBlur=0;CX.restore();
      } else if(ptree===1){ // Bench + path stone
        CX.fillStyle='rgba(100,80,50,0.5)';CX.fillRect(sx+8,sy+16,24,6);
        CX.fillStyle='rgba(140,120,80,0.35)';CX.fillRect(sx+8,sy+16,24,2);
      } else if(ptree===2){ // Flower patch
        const fcols=['rgba(255,80,80,0.7)','rgba(255,200,0,0.7)','rgba(200,80,255,0.7)','rgba(80,160,255,0.7)'];
        for(let fi=0;fi<5;fi++){
          CX.fillStyle=fcols[(seed+fi)%4];
          CX.beginPath();CX.arc(sx+6+fi*6,sy+8+(fi%3)*8,3,0,Math.PI*2);CX.fill();
        }
      }
      // Grass texture dots
      CX.fillStyle='rgba(20,60,10,0.2)';
      for(let gi=0;gi<4;gi++){CX.fillRect(sx+(seed*gi+5)%32+2,sy+(seed+gi*9)%28+2,2,1);}
    }
    if(type===5){ // Water
      if(SP.tiles[5])CX.drawImage(SP.tiles[5],sx,sy,T,T);
      else{const wg=CX.createLinearGradient(sx,sy,sx+T,sy+T);wg.addColorStop(0,'#1a3a6a');wg.addColorStop(1,'#0e2050');CX.fillStyle=wg;CX.fillRect(sx,sy,T,T);}
      // Animated ripples (tile-offset so they look continuous)
      const wt=now/900;
      const w1=Math.sin((tx*0.8+ty*0.4+wt)*1.2)*0.06+0.05;
      const w2=Math.sin((tx*0.5-ty*0.7+wt*0.7)*1.5)*0.05+0.04;
      CX.fillStyle=`rgba(100,170,255,${w1})`;CX.fillRect(sx,sy,T+1,T+1);
      CX.fillStyle=`rgba(60,120,220,${w2})`;CX.fillRect(sx,sy+6,T+1,3);CX.fillRect(sx,sy+18,T+1,3);CX.fillRect(sx,sy+30,T+1,3);
      // Foam at edge
      if(WD[ty]&&WD[ty][tx-1]!==5){CX.fillStyle='rgba(200,220,255,0.15)';CX.fillRect(sx,sy,3,T);}
      if(WD[ty]&&WD[ty][tx+1]!==5){CX.fillStyle='rgba(200,220,255,0.15)';CX.fillRect(sx+T-3,sy,3,T);}
    }
    if(type===6){ // Hospital
      const p=0.55+0.35*Math.sin(now/400);
      CX.fillStyle='rgba(0,200,80,0.1)';CX.fillRect(sx,sy,T+1,T+1);
      CX.save();CX.shadowColor=`rgba(0,255,80,${p*0.6})`;CX.shadowBlur=12;
      CX.fillStyle='#0a2a12';CX.fillRect(sx+4,sy+4,T-8,T-8);
      CX.fillStyle=`rgba(0,255,100,${p})`;
      CX.fillRect(sx+T/2-7,sy+T/2-2,14,5);CX.fillRect(sx+T/2-2,sy+T/2-7,5,14);
      CX.restore();
      CX.strokeStyle=`rgba(0,255,80,${0.3+p*0.3})`;CX.lineWidth=1.5;CX.strokeRect(sx+1,sy+1,T-2,T-2);
    }
    if(type===7){ // Gang turf
      const p=0.4+0.35*Math.sin(now/300+tx*0.6+ty*0.4);
      CX.fillStyle='rgba(180,0,0,0.08)';CX.fillRect(sx,sy,T+1,T+1);
      CX.save();
      // Graffiti tags — varied patterns based on seed
      const gtag=seed%6;
      CX.shadowColor=`rgba(255,0,0,${p*0.45})`;CX.shadowBlur=8;
      if(gtag===0){
        // Skull
        CX.fillStyle=`rgba(220,30,0,${p*0.9})`;
        CX.font='bold 14px serif';CX.textAlign='center';CX.textBaseline='middle';
        CX.fillText('☠',sx+T/2,sy+T/2);
      } else if(gtag===1){
        // Spray can tag lines
        CX.strokeStyle=`rgba(220,40,0,${p*0.6})`;CX.lineWidth=2.5;CX.lineCap='round';
        CX.beginPath();CX.moveTo(sx+5,sy+seed%20+8);CX.bezierCurveTo(sx+12,sy+6,sx+24,sy+30,sx+T-5,sy+seed%18+6);CX.stroke();
        CX.strokeStyle=`rgba(180,0,0,${p*0.4})`;CX.lineWidth=1.5;
        CX.beginPath();CX.moveTo(sx+8,sy+T-10);CX.lineTo(sx+T-8,sy+10);CX.stroke();
      } else if(gtag===2){
        // X mark
        CX.strokeStyle=`rgba(200,0,0,${p*0.7})`;CX.lineWidth=3;CX.lineCap='round';
        CX.beginPath();CX.moveTo(sx+8,sy+8);CX.lineTo(sx+T-8,sy+T-8);CX.stroke();
        CX.beginPath();CX.moveTo(sx+T-8,sy+8);CX.lineTo(sx+8,sy+T-8);CX.stroke();
      } else if(gtag===3){
        // Arrow + initials
        CX.fillStyle=`rgba(200,20,0,${p*0.7})`;
        CX.font='bold 10px monospace';CX.textAlign='center';CX.textBaseline='middle';
        CX.fillText('E.S.',sx+T/2,sy+T/2-4);
        CX.fillStyle=`rgba(180,0,0,${p*0.5})`;CX.lineWidth=2;
        CX.beginPath();CX.moveTo(sx+T/2-8,sy+T/2+6);CX.lineTo(sx+T/2+8,sy+T/2+6);CX.lineTo(sx+T/2+4,sy+T/2+3);CX.stroke();
      } else {
        // Diagonal stripe graffiti
        CX.strokeStyle=`rgba(200,0,0,${p*0.35})`;CX.lineWidth=4;CX.lineCap='butt';
        for(let gs=0;gs<3;gs++){
          CX.beginPath();CX.moveTo(sx+(gs*16)%T,sy);CX.lineTo(sx+T,sy+T-(gs*16)%T);CX.stroke();
        }
      }
      CX.shadowBlur=0;CX.restore();
      CX.strokeStyle=`rgba(200,0,0,${0.12+p*0.12})`;CX.lineWidth=1;CX.strokeRect(sx,sy,T,T);
    }
    if(type===8){ // Cop HQ
      const p=0.45+0.4*Math.sin(now/200+ty*0.5);
      const fl=Math.floor(now/400)%2===0;
      // Dark blue tile base
      CX.fillStyle='#0a0e20';CX.fillRect(sx,sy,T+1,T+1);
      // Concrete slab lines
      CX.strokeStyle='rgba(40,60,120,0.35)';CX.lineWidth=1;
      CX.beginPath();CX.moveTo(sx,sy+T/2);CX.lineTo(sx+T,sy+T/2);CX.stroke();
      CX.beginPath();CX.moveTo(sx+T/2,sy);CX.lineTo(sx+T/2,sy+T);CX.stroke();
      // Siren / patrol marker on some tiles
      if((tx+ty)%4===1){
        CX.save();
        CX.shadowColor=fl?'rgba(40,120,255,0.9)':'rgba(255,40,40,0.9)';CX.shadowBlur=16;
        CX.fillStyle=fl?'rgba(20,80,255,0.5)':'rgba(255,20,20,0.5)';
        CX.beginPath();CX.arc(sx+T/2,sy+T/2,10,0,Math.PI*2);CX.fill();
        CX.shadowBlur=0;CX.restore();
        // Badge symbol
        CX.fillStyle=fl?'rgba(80,160,255,0.8)':'rgba(255,80,80,0.8)';
        CX.font='bold 9px monospace';CX.textAlign='center';CX.textBaseline='middle';
        CX.fillText('PD',sx+T/2,sy+T/2);
      } else if((tx+ty)%4===3){
        // Security camera corner
        CX.fillStyle='rgba(80,100,160,0.5)';CX.fillRect(sx+2,sy+2,8,5);
        CX.fillStyle='rgba(40,60,140,0.7)';CX.beginPath();CX.arc(sx+12,sy+4.5,3,0,Math.PI*2);CX.fill();
      }
      CX.strokeStyle=`rgba(40,80,200,${0.2+p*0.18})`;CX.lineWidth=1.5;CX.strokeRect(sx+1,sy+1,T-2,T-2);
    }
    if(type===9){ // Shop
      const p=0.55+0.35*Math.sin(now/280);
      // Warm storefront base
      CX.fillStyle='#1e1206';CX.fillRect(sx,sy,T+1,T+1);
      // Awning stripe
      const aw1=`rgba(200,80,0,${p*0.8})`,aw2=`rgba(220,120,0,${p*0.6})`;
      for(let as2=0;as2<T;as2+=8){CX.fillStyle=as2%16===0?aw1:aw2;CX.fillRect(sx+as2,sy,8,12);}
      // Signboard
      CX.fillStyle='rgba(0,0,0,0.6)';CX.fillRect(sx+2,sy+12,T-4,10);
      CX.save();CX.shadowColor=`rgba(255,160,0,${p*0.8})`;CX.shadowBlur=8*p;
      CX.fillStyle=`rgba(255,${160+p*40|0},0,${0.8+p*0.2})`;
      CX.font='bold 7px monospace';CX.textAlign='center';CX.textBaseline='middle';
      CX.fillText('SHOP',sx+T/2,sy+17);CX.shadowBlur=0;CX.restore();
      // Display window
      CX.fillStyle='rgba(140,200,255,0.15)';CX.fillRect(sx+3,sy+23,T-6,T-26);
      CX.strokeStyle='rgba(100,60,0,0.5)';CX.lineWidth=1;CX.strokeRect(sx+3,sy+23,T-6,T-26);
      // Neon glow edge
      CX.strokeStyle=`rgba(255,140,0,${0.3+p*0.35})`;CX.lineWidth=2;CX.strokeRect(sx+1,sy+1,T-2,T-2);
    }
  }

  // ── Architecture (landmark buildings over tile layer) ──
  if(typeof renderArchitecture==='function')renderArchitecture(CX,cam,W,H,now);

  // Traffic cars
  for(const tc of traf){const s=ws(tc.x,tc.y);if(s.x<-60||s.x>W+60||s.y<-60||s.y>H+60)continue;CX.save();CX.translate(s.x,s.y);CX.rotate(tc.angle);drawCar(CX,tc,false);CX.restore();}
  // Parked cars
  for(const c of cars){if(c.driven&&PL.inCar&&PL.car===c)continue;const s=ws(c.x,c.y);if(s.x<-60||s.x>W+60||s.y<-60||s.y>H+60)continue;CX.save();CX.translate(s.x,s.y);CX.rotate(c.angle);drawCar(CX,c,false);CX.restore();}

  // ── Pickups ──
  for(const p of picks){
    const s=ws(p.x,p.y),bob=Math.sin(p.bob*3.5)*3.5;
    CX.save();CX.translate(s.x,s.y+bob);
    const scale=0.9+0.1*Math.sin(now/600);CX.scale(scale,scale);
    CX.shadowBlur=14;
    if(SP.ready&&SP.imgs.hp&&p.t==='hp'){
      CX.shadowColor='rgba(255,60,60,0.8)';CX.drawImage(SP.imgs.hp,-14,-14,28,28);
    } else if(SP.ready&&SP.imgs.cash&&p.t==='cash'){
      CX.shadowColor='rgba(255,200,0,0.7)';CX.drawImage(SP.imgs.cash,-14,-14,28,28);
    } else if(SP.ready&&SP.imgs.gun&&p.t==='gun'){
      CX.shadowColor='rgba(0,220,220,0.7)';CX.drawImage(SP.imgs.gun,-14,-14,28,28);
    } else {
      // Fallback
      CX.shadowColor=p.t==='hp'?'#f44':'#ff0';
      CX.fillStyle=p.t==='hp'?'#ff2222':'#ffd700';
      if(p.t==='hp'){CX.fillRect(-9,-3,18,7);CX.fillRect(-3,-9,7,18);}
      else{CX.font='bold 16px serif';CX.textAlign='center';CX.textBaseline='middle';CX.fillText('$',0,1);}
    }
    CX.shadowBlur=0;CX.restore();
  }

  // ── NPCs ──
  for(const n of npcs){
    const s=ws(n.x,n.y);if(s.x<-40||s.x>W+40||s.y<-40||s.y>H+40)continue;
    CX.save();CX.translate(s.x,s.y);CX.rotate(n.angle);
    if(SP.ready&&SP.imgs.npcs&&SP.imgs.npcs[n.colorIdx]){
      const nsp=SP.imgs.npcs[n.colorIdx];
      CX.drawImage(nsp,-12,-12,24,24);
    } else {
      CX.fillStyle=n.col;CX.beginPath();CX.arc(0,0,5,0,Math.PI*2);CX.fill();
      CX.fillStyle=shadeCol(n.col,30);CX.beginPath();CX.arc(4,0,3,0,Math.PI*2);CX.fill();
    }
    CX.restore();
  }

  // ── Gangsters ──
  for(const g of gangs){
    const s=ws(g.x,g.y);if(s.x<-50||s.x>W+50||s.y<-50||s.y>H+50)continue;
    CX.save();CX.translate(s.x,s.y);
    // Pulsing danger aura (use faction glow colour if available)
    const aura=0.12+0.1*Math.sin(now/200);
    const _gc=g.glowCol||'rgba(200,0,0,0.5)';
    CX.shadowColor=_gc;CX.shadowBlur=10;
    CX.fillStyle=_gc.replace(/[\d.]+\)$/,aura+')');CX.beginPath();CX.arc(0,0,14,0,Math.PI*2);CX.fill();
    CX.shadowBlur=0;
    CX.rotate(g.angle);
    if(SP.ready&&SP.imgs.gang){
      CX.drawImage(SP.imgs.gang,-16,-16,32,32);
    } else {
      CX.fillStyle='#c00';CX.beginPath();CX.arc(0,0,6,0,Math.PI*2);CX.fill();
      CX.fillStyle='#f00';CX.beginPath();CX.arc(5,0,3,0,Math.PI*2);CX.fill();
    }
    CX.restore();
    // HP bar
    if(g.hp<g.maxHp){
      const bw=24;
      CX.fillStyle='rgba(0,0,0,0.7)';CX.beginPath();roundRect(CX,s.x-bw/2,s.y-18,bw,5,2);CX.fill();
      CX.fillStyle='#f00';CX.beginPath();roundRect(CX,s.x-bw/2,s.y-18,bw*(g.hp/g.maxHp),5,2);CX.fill();
      CX.strokeStyle='rgba(255,60,60,0.5)';CX.lineWidth=0.5;CX.strokeRect(s.x-bw/2,s.y-18,bw,5);
    }
  }

  // ── Police Cars ──
  for(const pc of pcars){
    const s=ws(pc.x,pc.y);if(s.x<-60||s.x>W+60||s.y<-60||s.y>H+60)continue;
    const fl=Math.floor((now+pc.lightT*1000)/250)%2===0;
    CX.save();CX.translate(s.x,s.y);
    // Siren light glow
    CX.shadowColor=fl?'rgba(0,100,255,0.9)':'rgba(255,20,20,0.9)';
    CX.shadowBlur=pc.isSWAT?20:14;
    CX.rotate(pc.angle);
    // Car body
    const isSWAT=pc.isSWAT;
    const pbg=CX.createLinearGradient(-pc.w/2,-pc.h/2,pc.w/2,pc.h/2);
    pbg.addColorStop(0,isSWAT?'#2a2a2a':'#ffffff');
    pbg.addColorStop(0.5,isSWAT?'#111':'#ddddee');
    pbg.addColorStop(1,isSWAT?'#333':'#aabbcc');
    CX.fillStyle=pbg;CX.beginPath();roundRect(CX,-pc.w/2,-pc.h/2,pc.w,pc.h,3);CX.fill();
    CX.shadowBlur=0;
    // Blue/white stripe
    if(!isSWAT){
      CX.fillStyle='#1144cc';
      CX.fillRect(-pc.w/2,pc.h/2-5,pc.w,5);
      CX.fillRect(-pc.w/2,-pc.h/2,pc.w,5);
    } else {
      // SWAT: all black with yellow stripe
      CX.fillStyle='#333';CX.fillRect(-pc.w/2,-pc.h/2,pc.w,pc.h);
      CX.fillStyle='#ffcc00';CX.fillRect(-pc.w/2,-pc.h/2+5,pc.w,4);CX.fillRect(-pc.w/2,pc.h/2-9,pc.w,4);
    }
    // Light bar on roof
    const lbCol=fl?'#4488ff':'#ff2222';
    CX.fillStyle=lbCol;CX.shadowColor=lbCol;CX.shadowBlur=12;
    CX.fillRect(-8,-pc.h/2-3,16,4);
    CX.shadowBlur=0;
    // Windshield
    CX.fillStyle='rgba(140,210,255,0.78)';CX.fillRect(pc.w/2-11,-pc.h/2+3,9,pc.h-6);
    // Rear window
    CX.fillStyle='rgba(140,210,255,0.35)';CX.fillRect(-pc.w/2+2,-pc.h/2+3,5,pc.h-6);
    // Wheels
    CX.fillStyle='#0e0e0e';
    [[-pc.w/2,-pc.h/2-3],[-pc.w/2,pc.h/2-2],[pc.w/2-9,-pc.h/2-3],[pc.w/2-9,pc.h/2-2]].forEach(([wx,wy])=>{
      CX.beginPath();roundRect(CX,wx,wy,8,5,1.5);CX.fill();
    });
    CX.fillStyle='rgba(200,200,200,0.7)';
    [[-pc.w/2,-pc.h/2-3],[-pc.w/2,pc.h/2-2],[pc.w/2-9,-pc.h/2-3],[pc.w/2-9,pc.h/2-2]].forEach(([wx,wy])=>{
      CX.fillRect(wx+2,wy+1,4,3);
    });
    // Headlights
    CX.fillStyle='rgba(255,255,180,0.95)';CX.fillRect(pc.w/2-2,-pc.h/2+1,2,4);CX.fillRect(pc.w/2-2,pc.h/2-5,2,4);
    // Taillights
    CX.fillStyle='rgba(255,20,20,0.9)';CX.fillRect(-pc.w/2,-pc.h/2+1,2,4);CX.fillRect(-pc.w/2,pc.h/2-5,2,4);
    // POLICE text
    CX.fillStyle=isSWAT?'#ffcc00':'#1144cc';
    CX.font=`bold ${isSWAT?7:6}px monospace`;CX.textAlign='center';CX.textBaseline='middle';
    CX.fillText(isSWAT?'SWAT':'POLICE',0,0);
    CX.restore();
    // HP bar if damaged
    if(pc.health<(isSWAT?100:70)){
      const bw=pc.w+8,bx=s.x-bw/2,by=s.y-pc.h-8;
      CX.fillStyle='rgba(0,0,0,0.6)';CX.fillRect(bx,by,bw,4);
      CX.fillStyle='#4af';CX.fillRect(bx,by,bw*(pc.health/(isSWAT?100:70)),4);
    }
  }

  // ── Cops (foot officers) ──
  for(const c of cops){
    const s=ws(c.x,c.y);if(s.x<-50||s.x>W+50||s.y<-50||s.y>H+50)continue;
    const gd=COP_GRADES[c.grade||0];
    const fl=Math.floor(now/160)%2===0;
    CX.save();CX.translate(s.x,s.y);
    // Siren halo for raiding cops or SWAT
    if(c.raiding||c.grade===3){
      CX.shadowColor=fl?'rgba(40,120,255,0.9)':'rgba(255,30,30,0.9)';CX.shadowBlur=16;
      CX.fillStyle=fl?'rgba(0,80,255,0.18)':'rgba(255,0,0,0.16)';
      CX.beginPath();CX.arc(0,0,16,0,Math.PI*2);CX.fill();CX.shadowBlur=0;
    }
    CX.rotate(c.angle);
    if(SP.ready&&SP.imgs.cop){
      // Tint cop sprite by grade
      const sz=c.grade===3?36:32;
      CX.drawImage(SP.imgs.cop,-sz/2,-sz/2,sz,sz);
    } else {
      CX.fillStyle=gd.col;CX.beginPath();CX.arc(0,0,6,0,Math.PI*2);CX.fill();
    }
    CX.restore();
    // Grade badge above cop head
    const badgeColors=['#4488ff','#ff9900','#aa44ff','#111111'];
    const badgeText=['P','SGT','DET','SWAT'];
    CX.save();CX.translate(s.x,s.y-16);
    CX.fillStyle=badgeColors[c.grade||0];
    CX.beginPath();roundRect(CX,-10,-5,20,10,3);CX.fill();
    CX.fillStyle='#fff';CX.font='bold 6px monospace';CX.textAlign='center';CX.textBaseline='middle';
    CX.fillText(badgeText[c.grade||0],0,0);
    CX.restore();
    // HP bar if injured
    if(c.hp<c.maxHp){
      const bw=22,bx=s.x-bw/2,by=s.y-18;
      CX.fillStyle='rgba(0,0,0,0.6)';CX.fillRect(bx,by,bw,3);
      CX.fillStyle=gd.col;CX.fillRect(bx,by,bw*(c.hp/c.maxHp),3);
    }
  }

  // ── Player ──
  {const s=ws(PL.x,PL.y);CX.save();CX.translate(s.x,s.y);
    if(PL.inCar&&PL.car){
      CX.rotate(PL.car.angle);drawCar(CX,PL.car,true);
    } else {
      const fl=PL.inv>0&&Math.floor(PL.inv*10)%2===0;
      // Glow ring
      if(!fl){
        CX.shadowColor='rgba(255,160,0,0.7)';CX.shadowBlur=18;
        CX.strokeStyle='rgba(255,160,0,0.35)';CX.lineWidth=2;
        CX.beginPath();CX.arc(0,0,13,0,Math.PI*2);CX.stroke();
        CX.shadowBlur=0;
      }
      CX.rotate(PL.angle);
      if(SP.ready&&SP.imgs.player&&!fl){
        CX.drawImage(SP.imgs.player,-17,-17,34,34);
      } else {
        // Flash white when invincible
        CX.fillStyle=fl?'rgba(255,255,255,0.9)':'#f80';
        CX.beginPath();CX.arc(0,0,8,0,Math.PI*2);CX.fill();
        CX.strokeStyle=fl?'#fff':'rgba(255,200,80,0.8)';CX.lineWidth=1.5;CX.stroke();
      }
      // Weapon icon overlay
      const w=curW();if(w.id!=='fists'){
        CX.font='11px serif';CX.textAlign='left';CX.textBaseline='middle';
        CX.fillText(w.ico,10,-1);
      }
    }
    CX.restore();}

  // ── Bullets ──
  for(const b of bullets){const s=ws(b.x,b.y);
    CX.save();
    if(b.spl>0){
      // Rocket – elongated with trail
      CX.translate(s.x,s.y);CX.rotate(Math.atan2(b.vy,b.vx));
      CX.shadowColor='#f80';CX.shadowBlur=12;
      CX.fillStyle='#ff8800';CX.beginPath();roundRect(CX,-8,-2.5,16,5,2);CX.fill();
      CX.fillStyle='#fff';CX.fillRect(6,-1.5,3,3);
    } else {
      // Glowing bullet with tail
      const len=Math.sqrt(b.vx*b.vx+b.vy*b.vy);
      const tailX=s.x-b.vx/len*8,tailY=s.y-b.vy/len*8;
      const grad=CX.createLinearGradient(tailX,tailY,s.x,s.y);
      grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,b.col);
      CX.strokeStyle=grad;CX.lineWidth=2;CX.beginPath();CX.moveTo(tailX,tailY);CX.lineTo(s.x,s.y);CX.stroke();
      CX.shadowColor=b.col;CX.shadowBlur=b.fp?8:5;
      CX.fillStyle=b.col;CX.beginPath();CX.arc(s.x,s.y,b.fp?2.5:2,0,Math.PI*2);CX.fill();
    }
    CX.shadowBlur=0;CX.restore();
  }

  // ── Particles ──
  for(const p of parts){
    const s=ws(p.x,p.y),a=Math.max(0,p.life/(p.ml||1));
    CX.globalAlpha=a;
    CX.fillStyle=p.c;
    CX.shadowColor=p.c;CX.shadowBlur=4;
    CX.beginPath();CX.arc(s.x,s.y,p.r,0,Math.PI*2);CX.fill();
  }
  CX.globalAlpha=1;CX.shadowBlur=0;

  // Night vignette overlay
  CX.fillStyle=vg;CX.fillRect(0,0,W,H);

  // ── MINIMAP (80px circle, shows 1500×1500px world around player) ──
  const MM=80,VIEW=1500,mms=MM/VIEW;
  const mvx=PL.x-VIEW/2,mvy=PL.y-VIEW/2;
  MC.clearRect(0,0,MM,MM);
  MC.save();
  MC.beginPath();MC.arc(MM/2,MM/2,MM/2,0,Math.PI*2);MC.clip();
  // Draw world tile background (viewport-relative)
  const srcX=Math.max(0,mvx/T),srcY=Math.max(0,mvy/T),srcW=VIEW/T,srcH=VIEW/T;
  MC.drawImage(mmBg,srcX,srcY,srcW,srcH,0,0,MM,MM);
  // Helper: world → minimap coords
  function wm(wx,wy){return{x:(wx-mvx)*mms,y:(wy-mvy)*mms};}
  // Traffic
  MC.fillStyle='rgba(180,180,60,0.5)';
  for(const tc of traf){const p=wm(tc.x,tc.y);MC.fillRect(p.x,p.y,2,2);}
  // Parked cars
  MC.fillStyle='rgba(120,120,120,0.4)';
  for(const c of cars)if(!c.driven){const p=wm(c.x,c.y);MC.fillRect(p.x,p.y,2,2);}
  // NPCs
  MC.fillStyle='rgba(80,200,80,0.5)';
  for(const n of npcs){const p=wm(n.x,n.y);MC.fillRect(p.x,p.y,2,2);}
  // Gangs
  MC.fillStyle='rgba(255,40,40,0.85)';
  for(const g of gangs){const p=wm(g.x,g.y);MC.beginPath();MC.arc(p.x,p.y,2.5,0,Math.PI*2);MC.fill();}
  // Cops (flashing) + police cars
  const cpfl=Math.floor(Date.now()/300)%2===0;
  MC.fillStyle=cpfl?'#6af':'#11f';
  for(const pc of pcars){const p=wm(pc.x,pc.y);MC.beginPath();MC.arc(p.x,p.y,3.5,0,Math.PI*2);MC.fill();}
  MC.fillStyle=cpfl?'#4af':'#22f';
  for(const c of cops){const p=wm(c.x,c.y);MC.beginPath();MC.arc(p.x,p.y,2.5,0,Math.PI*2);MC.fill();}
  // Player — always centre, pulsing gold dot
  const ppls=0.8+0.2*Math.sin(Date.now()/400);
  MC.shadowColor='rgba(255,160,0,0.9)';MC.shadowBlur=6;
  MC.fillStyle=`rgba(255,160,0,${ppls})`;
  MC.beginPath();MC.arc(MM/2,MM/2,4,0,Math.PI*2);MC.fill();
  MC.shadowBlur=0;
  // Direction arrow
  MC.strokeStyle='rgba(255,160,0,0.8)';MC.lineWidth=1.5;
  MC.beginPath();MC.moveTo(MM/2,MM/2);
  MC.lineTo(MM/2+Math.cos(PL.angle)*10,MM/2+Math.sin(PL.angle)*10);
  MC.stroke();
  MC.restore();
  // Mission waypoints overlay
  if(typeof renderMissions==='function')renderMissions(CX,cam,W,H);
}

// ══════════════════════════════════════════
//  LOOP
// ══════════════════════════════════════════
function loop(ts){
  if(!gameRunning)return;
  if(shopOpen||fullMapOpen){lastT=ts;requestAnimationFrame(loop);return;}
  const dt=Math.min((ts-lastT)/1000,0.05);lastT=ts;
  update(dt);render();
  requestAnimationFrame(loop);
}