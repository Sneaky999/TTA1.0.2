// ═══════════════════════════════════════════════════════════════
//  world.js  –  Canvas, Map, Zones, Tiles, Weapons, Cars,
//               Player, Entities (NPCs/Cops/Gangs), Bullets,
//               Pickups, Wanted system, Cop grade definitions
//  Loads first — all other files depend on globals defined here.
// ═══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
//  CANVAS
// ══════════════════════════════════════════
const CV=document.getElementById('gameCanvas');
const CX=CV.getContext('2d');
const mmC=document.getElementById('mm2');
const MC=mmC.getContext('2d');
let W,H;
function resize(){W=CV.width=window.innerWidth;H=CV.height=window.innerHeight;}
resize();window.addEventListener('resize',resize);

// ══════════════════════════════════════════
//  WORLD 100×100
// ══════════════════════════════════════════
const T=40,WW=100,WH=100;
const WD=[],BC=[];

// Special zone definitions (world coordinates)
// Hospital zone: tiles 6-14, 6-14
// Gang turf A: tiles 70-80, 10-22
// Gang turf B: tiles 20-30, 70-80
// Cop HQ: tiles 45-55, 45-55
// Shop locations: fixed spots
const SPECIAL_ZONES={
  hospital:{x1:6,y1:6,x2:15,y2:15,name:'HOSPITAL',col:'#0a2a0a'},
  gangA:   {x1:70,y1:10,x2:82,y2:22,name:'GANG TURF',col:'#2a0a0a'},
  gangB:   {x1:18,y1:70,x2:30,y2:82,name:'GANG TURF',col:'#2a0a0a'},
  copHQ:   {x1:44,y1:44,x2:56,y2:56,name:'COP HQ',col:'#0a0a2a'},
  shopA:   {x1:2,y1:2,x2:6,y2:6,name:'SHOP'},
  shopB:   {x1:93,y1:2,x2:97,y2:6,name:'SHOP'},
  shopC:   {x1:2,y1:93,x2:6,y2:97,name:'SHOP'},
};

const NZONES=[
  {name:'DOWNTOWN',   x1:35,y1:35,x2:65,y2:65,den:0.75,bc:'#4a4a5a'},
  {name:'DOCKLANDS',  x1:72,y1:65,x2:100,y2:100,den:0.45,bc:'#4a3a2a'},
  {name:'SUBURBS',    x1:0, y1:55,x2:32,y2:100,den:0.30,bc:'#5a4a3a'},
  {name:'INDUSTRIAL', x1:0, y1:0, x2:32,y2:48,den:0.55,bc:'#3a3a3a'},
  {name:'EAST SIDE',  x1:72,y1:0, x2:100,y2:58,den:0.42,bc:'#4a3a4a'},
  {name:'MIDTOWN',    x1:32,y1:0, x2:72,y2:35,den:0.60,bc:'#3a4a4a'},
  {name:'WESTGATE',   x1:0, y1:48,x2:32,y2:55,den:0.38,bc:'#4a4a3a'},
];
function getZone(tx,ty){for(const z of NZONES)if(tx>=z.x1&&tx<z.x2&&ty>=z.y1&&ty<z.y2)return z;return NZONES[0];}
function getSpecial(tx,ty){for(const[k,z] of Object.entries(SPECIAL_ZONES)){if(tx>=z.x1&&tx<z.x2&&ty>=z.y1&&ty<z.y2)return{key:k,...z};}return null;}

const MH=[5,15,25,35,45,55,65,75,85,95];
const MV=[5,15,25,35,45,55,65,75,85,95];
const LH=[10,20,30,40,50,60,70,80,90];
const LV=[10,20,30,40,50,60,70,80,90];

// tile types: 0=grass 1=road 2=building 3=sidewalk 4=park 5=water 6=hospital 7=gangturf 8=cophq 9=shop
function buildWorld(){
  for(let y=0;y<WH;y++){WD[y]=[];BC[y]=[];for(let x=0;x<WW;x++){WD[y][x]=0;BC[y][x]='#444';}}
  for(let y=0;y<WH;y++)for(let x=0;x<WW;x++){
    const rr=MH.includes(y)||MH.includes(y-1)||LH.includes(y)||LH.includes(y-1);
    const rc=MV.includes(x)||MV.includes(x-1)||LV.includes(x)||LV.includes(x-1);
    const sp=getSpecial(x,y);
    if(sp){
      if(sp.key==='hospital') WD[y][x]=6;
      else if(sp.key==='gangA'||sp.key==='gangB') WD[y][x]=7;
      else if(sp.key==='copHQ') WD[y][x]=8;
      else if(sp.key.startsWith('shop')) WD[y][x]=9;
      continue;
    }
    if(x>82&&y>82){WD[y][x]=5;continue;}
    if((x>=18&&x<=24&&y>=18&&y<=24)||(x>=60&&x<=67&&y>=40&&y<=46)||(x>=42&&x<=48&&y>=60&&y<=66)){WD[y][x]=4;continue;}
    if(rr||rc){WD[y][x]=1;continue;}
    const near=MH.includes(y-1)||MH.includes(y+1)||MV.includes(x-1)||MV.includes(x+1)||LH.includes(y-1)||LH.includes(y+1)||LV.includes(x-1)||LV.includes(x+1);
    const z=getZone(x,y);
    if(near){WD[y][x]=3;}else{const s=(x*97+y*53)%100;WD[y][x]=s<z.den*100?2:0;}
    BC[y][x]=z.bc;
  }
}
buildWorld();

const TCOL={0:'#2a501a',1:'#363636',2:'#555',3:'#686858',4:'#2a5a1a',5:'#1a3a6a',6:'#0a2a0a',7:'#2a0a0a',8:'#0a0a2a',9:'#1a0800'};
function isW(tx,ty){if(tx<0||ty<0||tx>=WW||ty>=WH)return false;const t=WD[ty][tx];return t!==2&&t!==5;}
function tColl(ex,ey,ew,eh){const x1=Math.floor(ex/T),y1=Math.floor(ey/T),x2=Math.floor((ex+ew)/T),y2=Math.floor((ey+eh)/T);for(let ty=y1;ty<=y2;ty++)for(let tx=x1;tx<=x2;tx++)if(!isW(tx,ty))return true;return false;}
function mvE(e,dx,dy){const nx=e.x+dx;if(!tColl(nx-e.w/2,e.y-e.h/2,e.w,e.h))e.x=nx;const ny=e.y+dy;if(!tColl(e.x-e.w/2,ny-e.h/2,e.w,e.h))e.y=ny;}
function d2(ax,ay,bx,by){return(ax-bx)**2+(ay-by)**2;}
function rR(ax,ay,aw,ah,bx,by,bw,bh){return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by;}
const cam={x:1400,y:1400};
function ws(wx,wy){return{x:(wx-cam.x)+W/2,y:(wy-cam.y)+H/2};}

// ══════════════════════════════════════════
//  WEAPONS
// ══════════════════════════════════════════
const WDEFS={
  fists: {id:'fists', name:'FISTS',   ico:'👊',dmg:22, rate:0.44,ammo:Infinity,max:Infinity,spr:0,   bps:1,spd:0,  spl:0, melee:true},
  pistol:{id:'pistol',name:'PISTOL',  ico:'🔫',dmg:13, rate:0.27,ammo:30, max:30, spr:0.04,bps:1,spd:440,spl:0, melee:false},
  shotgun:{id:'shotgun',name:'SHOTGUN',ico:'🪃',dmg:8, rate:0.62,ammo:15, max:15, spr:0.20,bps:5,spd:380,spl:0, melee:false}, // 5 pellets × 8 = 40 burst dmg
  uzi:   {id:'uzi',  name:'UZI',     ico:'⚡',dmg:8,  rate:0.09,ammo:60, max:60, spr:0.09,bps:1,spd:480,spl:0, melee:false},
  sniper:{id:'sniper',name:'SNIPER',  ico:'🎯',dmg:80, rate:1.10,ammo:10, max:10, spr:0,   bps:1,spd:700,spl:0, melee:false},
  rocket:{id:'rocket',name:'RPG',     ico:'🚀',dmg:120,rate:1.30,ammo:5,  max:5,  spr:0,   bps:1,spd:280,spl:60,melee:false},
};
let wSlots=[{...WDEFS.fists}],wIdx=0;
function curW(){return wSlots[wIdx];}
function giveW(id){const d=WDEFS[id];const ex=wSlots.find(w=>w.id===id);if(ex){ex.ammo=d.max;return false;}wSlots.push({...d});return true;}
function refillAll(){for(const w of wSlots)if(w.ammo!==Infinity)w.ammo=WDEFS[w.id].max;}
function swapW(){wIdx=(wIdx+1)%wSlots.length;showNotif('WEAPON: '+curW().name);buildWHUD();}
function buildWHUD(){
  const el=document.getElementById('wHUD');el.innerHTML='';
  for(let i=0;i<wSlots.length;i++){
    const w=wSlots[i];const d=document.createElement('div');d.className='ws'+(i===wIdx?' act':'');
    const lo=w.ammo!==Infinity&&w.ammo<=Math.floor(w.max*0.25);
    d.innerHTML=`<span class="wi">${w.ico}</span><span class="wn">${w.name}</span><span class="wa${lo?' lo':''}">${w.ammo===Infinity?'∞':w.ammo}</span>`;
    el.appendChild(d);
  }
}

// ══════════════════════════════════════════
//  CAR TYPES
// ══════════════════════════════════════════
const CT=[
  {name:'SEDAN',  w:28,h:14,maxS:150,acc:200,trn:5.5,style:'sedan', col:'#c00'},
  {name:'SPORTS', w:30,h:12,maxS:240,acc:340,trn:7.0,style:'sports',col:'#f80'},
  {name:'TRUCK',  w:36,h:18,maxS:110,acc:140,trn:3.5,style:'truck', col:'#558'},
  {name:'SUV',    w:32,h:17,maxS:140,acc:175,trn:4.5,style:'suv',   col:'#484'},
  {name:'MUSCLE', w:31,h:14,maxS:220,acc:290,trn:6.0,style:'muscle',col:'#c40'},
  {name:'TAXI',   w:28,h:14,maxS:145,acc:205,trn:5.5,style:'sedan', col:'#fc0'},
  {name:'VAN',    w:36,h:16,maxS:105,acc:138,trn:3.0,style:'van',   col:'#666'},
  {name:'COUPE',  w:28,h:13,maxS:200,acc:265,trn:6.5,style:'sports',col:'#c0c'},
];
const PAL=['#c00','#06c','#c60','#0a4','#c0c','#888','#f80','#0cc','#a44','#44a','#4a4','#aaa','#c44','#48a','#8a4'];
const cars=[],traf=[];
function mkCar(x,y,ti,cl){const t=CT[ti%CT.length];return{x,y,w:t.w,h:t.h,angle:0,speed:0,maxS:t.maxS,acc:t.acc,trn:t.trn,col:cl||t.col,style:t.style,name:t.name,health:80,driven:false};}
function spawnCars(){
  const rt=[];for(let y=0;y<WH;y++)for(let x=0;x<WW;x++)if(WD[y][x]===1)rt.push({x,y});
  for(let i=0;i<50;i++){const t=rt[Math.floor(Math.random()*rt.length)];const c=mkCar(t.x*T+T/2,t.y*T+T/2,i%CT.length,PAL[i%PAL.length]);c.angle=Math.round(Math.random()*4)*(Math.PI/2);cars.push(c);}
  for(let i=0;i<22;i++){const t=rt[Math.floor(Math.random()*rt.length)];const c=mkCar(t.x*T+T/2,t.y*T+T/2,i%5,PAL[(i+6)%PAL.length]);c.angle=Math.round(Math.random()*4)*(Math.PI/2);c.speed=25+Math.random()*28;c.tT=2+Math.random()*4;c.isTraf=true;traf.push(c);}
}
spawnCars();

// ══════════════════════════════════════════
//  PLAYER
// ══════════════════════════════════════════
const PL={x:1400,y:1400,w:14,h:14,spd:118,spM:1.8,hp:100,maxHp:100,angle:0,inCar:false,car:null,atkCd:0,inv:0,score:0,cash:0,wanted:0,wantT:0};

// ══════════════════════════════════════════
//  NPCs / GANGSTERS / COPS
// ══════════════════════════════════════════
const npcs=[],gangs=[],cops=[];
let gangSpawnT=0,copSpawnT=0,gangKills=0;

// Central kill reporter — increments counters AND notifies missions system
function recordKill(faction){
  if(faction==='gang')gangKills++;
  if(typeof reportMissionKill==='function')reportMissionKill(faction);
}
// Margin (tiles) to keep all spawns away from map edges and prevent out-of-bounds placement
const MAP_EDGE_MARGIN=2;

function spawnNPCs(){
  for(let i=0;i<40;i++){
    let tx,ty;do{tx=MAP_EDGE_MARGIN+Math.floor(Math.random()*(WW-MAP_EDGE_MARGIN*2));ty=MAP_EDGE_MARGIN+Math.floor(Math.random()*(WH-MAP_EDGE_MARGIN*2));}while(!isW(tx,ty)||WD[ty][tx]===1||WD[ty][tx]>=6);
    const ci=Math.floor(Math.random()*6);npcs.push({x:tx*T+T/2,y:ty*T+T/2,w:10,h:10,hp:30,maxHp:30,spd:30+Math.random()*28,angle:Math.random()*Math.PI*2,timer:Math.random()*3,col:'hsl('+Math.floor(Math.random()*360)+',55%,58%)',cash:Math.floor(Math.random()*70+15),flee:false,colorIdx:ci,type:'civilian',state:'idle'});
  }
}
spawnNPCs();

// Gangsters – spawn in gang turf zones and chase player aggressively
function spawnGangster(x,y){
  gangs.push({x,y,w:11,h:11,hp:45,maxHp:45,spd:75,angle:0,atkCd:0,shootCd:0,col:'#a00',homeX:x,homeY:y,wanderT:0});
}
const MAX_GANG_PER_ZONE=8;  // cap per turf, not just total
function repopGangs(){
  const gangZones=[SPECIAL_ZONES.gangA,SPECIAL_ZONES.gangB];
  for(const z of gangZones){
    // Count how many gangsters are currently inside this zone
    const inZone=gangs.filter(g=>{
      const gx=Math.floor(g.x/T),gy=Math.floor(g.y/T);
      return gx>=z.x1&&gx<z.x2&&gy>=z.y1&&gy<z.y2;
    }).length;
    if(inZone>=MAX_GANG_PER_ZONE)continue;
    // Spawn up to 2 at a time per repop tick to avoid instant flooding
    const toSpawn=Math.min(2,MAX_GANG_PER_ZONE-inZone);
    for(let i=0;i<toSpawn;i++){
      const tx=z.x1+Math.floor(Math.random()*(z.x2-z.x1));
      const ty=z.y1+Math.floor(Math.random()*(z.y2-z.y1));
      spawnGangster(tx*T+T/2,ty*T+T/2);
    }
  }
}
repopGangs();

// Cops
// Gang zone centres + margin (tile units) cops avoid when patrolling normally
const GANG_ZONES_AVOID=[SPECIAL_ZONES.gangA,SPECIAL_ZONES.gangB];
const GANG_AVOID_MARGIN=8; // extra tiles of buffer around gang turf

function isTileInGangZone(tx,ty,margin){
  for(const z of GANG_ZONES_AVOID){
    if(tx>=z.x1-margin&&tx<z.x2+margin&&ty>=z.y1-margin&&ty<z.y2+margin)return true;
  }
  return false;
}

function randRoadPt(){
  const roadTiles=[];
  for(let y=MAP_EDGE_MARGIN;y<WH-MAP_EDGE_MARGIN;y++)
    for(let x=MAP_EDGE_MARGIN;x<WW-MAP_EDGE_MARGIN;x++)
      if(WD[y][x]===1)roadTiles.push({x,y});
  const t=roadTiles[Math.floor(Math.random()*roadTiles.length)];
  return{x:t.x*T+T/2,y:t.y*T+T/2};
}
// Safe patrol point: avoids gang zones
// Margin in tiles to keep spawns away from map edges (declared earlier — see above)
function safePatrolPt(){
  const roadTiles=[];
  for(let y=MAP_EDGE_MARGIN;y<WH-MAP_EDGE_MARGIN;y++)
    for(let x=MAP_EDGE_MARGIN;x<WW-MAP_EDGE_MARGIN;x++)
      if(WD[y][x]===1&&!isTileInGangZone(x,y,GANG_AVOID_MARGIN))roadTiles.push({x,y});
  if(!roadTiles.length){
    // Fallback: any road tile inside the map
    for(let y=1;y<WH-1;y++)for(let x=1;x<WW-1;x++)if(WD[y][x]===1)roadTiles.push({x,y});
  }
  const t=roadTiles[Math.floor(Math.random()*roadTiles.length)];
  return{px:t.x*T+T/2,py:t.y*T+T/2};
}
// Raid waypoint: deliberately inside a gang zone
function raidPt(zone){
  const tx=zone.x1+Math.floor(Math.random()*(zone.x2-zone.x1));
  const ty=zone.y1+Math.floor(Math.random()*(zone.y2-zone.y1));
  return{px:tx*T+T/2,py:ty*T+T/2};
}
function newPatrolWP(){return safePatrolPt();}

// ── COP GRADES ──
// grade 0=Patrol  1=Sergeant  2=Detective  3=SWAT
const COP_GRADES=[
  {name:'PATROL',    col:'#1a55cc',trim:'#88aaff',hp:50, maxHp:50, spd:88, dmg:10,shootCd:1.1,atkDmg:8, reward:200,w:11,h:11,hasCar:true, carMinWanted:0},
  {name:'SERGEANT',  col:'#1a3a99',trim:'#5577ee',hp:80, maxHp:80, spd:95, dmg:14,shootCd:0.9,atkDmg:11,reward:350,w:12,h:12,hasCar:true, carMinWanted:2},
  {name:'DETECTIVE', col:'#3a2a55',trim:'#9988cc',hp:70, maxHp:70, spd:100,dmg:16,shootCd:0.8,atkDmg:13,reward:400,w:11,h:11,hasCar:false,carMinWanted:99},
  {name:'SWAT',      col:'#111111',trim:'#444444',hp:130,maxHp:130,spd:82, dmg:22,shootCd:0.7,atkDmg:18,reward:600,w:13,h:13,hasCar:true, carMinWanted:3},
];

// Police cars array (separate from player-stealable cars)
const pcars=[];

function mkPoliceCar(x,y,grade){
  const gd=COP_GRADES[grade];
  // Police car is always blue/white, larger than a regular car
  const isSWAT=grade===3;
  return {
    x,y,
    w:isSWAT?38:30, h:isSWAT?18:14,
    angle:0,speed:0,
    maxS:isSWAT?155:185, acc:isSWAT?180:250, trn:isSWAT?4.5:6.0,
    col:isSWAT?'#222':'#1144cc',
    style:isSWAT?'suv':'sedan',
    grade,
    health:isSWAT?100:70,
    driven:false,   // driven by cop AI
    copIdx:-1,      // index of cop driving it (set after push)
    lightT:0,       // siren flash timer
    name:gd.name+' CAR',
    isSWAT,
  };
}

// Snap a world coord to the nearest road tile centre
function snapToRoad(wx,wy){
  const tx=Math.floor(wx/T),ty=Math.floor(wy/T);
  // Already on road?
  if(ty>=0&&ty<WH&&tx>=0&&tx<WW&&WD[ty][tx]===1) return{x:tx*T+T/2,y:ty*T+T/2};
  // Search outward in a spiral up to 8 tiles
  for(let r=1;r<=8;r++){
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;
      const nx=tx+dx,ny=ty+dy;
      if(ny>=1&&ny<WH-1&&nx>=1&&nx<WW-1&&WD[ny][nx]===1)
        return{x:nx*T+T/2,y:ny*T+T/2};
    }
  }
  // Ultimate fallback: centre of map
  return{x:WW*T/2,y:WH*T/2};
}

function spawnCop(x,y,gradeOverride){
  // Clamp to map bounds and snap to road before spawning
  x=Math.max(MAP_EDGE_MARGIN*T+T/2,Math.min(x,(WW-MAP_EDGE_MARGIN)*T-T/2));
  y=Math.max(MAP_EDGE_MARGIN*T+T/2,Math.min(y,(WH-MAP_EDGE_MARGIN)*T-T/2));
  const snapped=snapToRoad(x,y);x=snapped.x;y=snapped.y;
  const wanted=PL?PL.wanted:0;
  // Higher wanted level → higher grade cops spawn
  let grade=gradeOverride!=null?gradeOverride:
    wanted>=4?3:wanted>=3?Math.random()<0.4?3:2:
    wanted>=2?Math.random()<0.5?1:2:
    Math.random()<0.3?1:0;
  const gd=COP_GRADES[grade];
  const wp=safePatrolPt();
  const cop={x,y,w:gd.w,h:gd.h,hp:gd.hp,maxHp:gd.maxHp,spd:gd.spd,
    angle:0,atkCd:0,shootCd:0,px:wp.px,py:wp.py,patrolT:0,raiding:false,
    grade,name:gd.name,carIdx:-1};
  cops.push(cop);
  const ci=cops.length-1;
  // Attach a police car if this grade uses one
  if(gd.hasCar&&wanted>=gd.carMinWanted){
    const pc=mkPoliceCar(x+20,y,grade);
    pc.driven=true;pc.copIdx=ci;
    pcars.push(pc);
    cop.carIdx=pcars.length-1;
  }
}

// Periodic gang-zone raids
let raidTimer=20; // first raid in 20s
const RAID_INTERVAL=30; // seconds between raids
const RAID_SQUAD_SIZE=5;
// Cops also patrol COP HQ constantly
function repopCopHQ(){
  const z=SPECIAL_ZONES.copHQ;
  const count=cops.filter(c=>{const tx=Math.floor(c.x/T),ty=Math.floor(c.y/T);return tx>=z.x1&&tx<z.x2&&ty>=z.y1&&ty<z.y2;}).length;
  if(count<6){
    const tx=z.x1+Math.floor(Math.random()*(z.x2-z.x1));
    const ty=z.y1+Math.floor(Math.random()*(z.y2-z.y1));
    spawnCop(tx*T+T/2,ty*T+T/2);
  }
}

// ══════════════════════════════════════════
//  BULLETS / PARTICLES / PICKUPS
// ══════════════════════════════════════════
const bullets=[],parts=[],picks=[];
function shootB(fx,fy,a,fp,spd,dmg,spl,src){bullets.push({x:fx,y:fy,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,fp,dmg,spl:spl||0,life:1.4,src:src||'enemy',col:fp?'#ff0':src==='gang'?'#f44':'#88f'});}
function fireW(fx,fy,a){
  const w=curW();if(w.melee)return false;
  if(w.ammo<=0){showNotif('OUT OF AMMO!');return false;}
  for(let b=0;b<w.bps;b++)shootB(fx,fy,a+(Math.random()-0.5)*w.spr*2,true,w.spd,w.dmg,w.spl);
  if(w.ammo!==Infinity)w.ammo--;
  if(typeof panicNearby==='function')panicNearby(fx,fy);
  buildWHUD();return true;
}
function spawnPts(x,y,c,n){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*85;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:Math.random()*4+1.5,c,life:0.7+Math.random()*0.35,ml:1.05});}}
function spawnPick(x,y,t){picks.push({x,y,t,bob:Math.random()*Math.PI*2});}
for(let i=0;i<35;i++){let tx,ty;do{tx=MAP_EDGE_MARGIN+Math.floor(Math.random()*(WW-MAP_EDGE_MARGIN*2));ty=MAP_EDGE_MARGIN+Math.floor(Math.random()*(WH-MAP_EDGE_MARGIN*2));}while(!isW(tx,ty));spawnPick(tx*T+T/2,ty*T+T/2,Math.random()<0.5?'hp':'cash');}

function explode(x,y,r,dmg){
  spawnPts(x,y,'#f80',18);spawnPts(x,y,'#f00',10);spawnPts(x,y,'#ff0',8);
  for(let i=npcs.length-1;i>=0;i--){const n=npcs[i];if(d2(n.x,n.y,x,y)<r*r){n.hp-=dmg;if(n.hp<=0){PL.score+=30;PL.cash+=n.cash;addWanted(1);recordKill('npc');npcs.splice(i,1);}}}
  for(let i=gangs.length-1;i>=0;i--){const g=gangs[i];if(d2(g.x,g.y,x,y)<r*r){g.hp-=dmg*1.2;if(g.hp<=0){PL.score+=80;PL.cash+=30;recordKill('gang');gangs.splice(i,1);}}}
  for(let i=cops.length-1;i>=0;i--){const c=cops[i];if(d2(c.x,c.y,x,y)<r*r){c.hp-=dmg*1.5;if(c.hp<=0){PL.score+=300;recordKill('cop');cops.splice(i,1);}}}
  if(!PL.inCar&&d2(PL.x,PL.y,x,y)<r*r&&PL.inv<=0){PL.hp-=dmg*0.4;PL.inv=0.4;}
}

// ══════════════════════════════════════════
//  WANTED SYSTEM (5 stars)
// ══════════════════════════════════════════
// Seconds of "clean" hiding needed to lose each star level
const WANTED_DECAY_TIME=[0,8,12,18,25,35];
function addWanted(n){
  const prev=PL.wanted;
  PL.wanted=Math.min(5,PL.wanted+n);
  // Always reset decay timer when committing a crime
  PL.wantT=WANTED_DECAY_TIME[PL.wanted]||8;
}

