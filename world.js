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
const T=40,WW=150,WH=150;
const WD=[],BC=[];

// Special zone definitions (world coordinates)
// Hospital zone: tiles 6-14, 6-14
// Gang turf A: tiles 70-80, 10-22
// Gang turf B: tiles 20-30, 70-80
// Cop HQ: tiles 45-55, 45-55
// Shop locations: fixed spots
const SPECIAL_ZONES={
  hospital:{x1:8,y1:8,x2:20,y2:20,name:'HOSPITAL',col:'#0a2a0a'},
  gangA:   {x1:105,y1:15,x2:123,y2:33,name:'GANG TURF',col:'#2a0a0a'},
  gangB:   {x1:27,y1:105,x2:45,y2:123,name:'GANG TURF',col:'#2a0a0a'},
  copHQ:   {x1:66,y1:66,x2:84,y2:84,name:'COP HQ',col:'#0a0a2a'},
  shopA:   {x1:2,y1:2,x2:7,y2:7,name:'SHOP'},
  shopB:   {x1:141,y1:2,x2:147,y2:7,name:'SHOP'},
  shopC:   {x1:2,y1:141,x2:7,y2:147,name:'SHOP'},
  shopD:   {x1:141,y1:141,x2:147,y2:147,name:'SHOP'},
};

const NZONES=[
  {name:'DOWNTOWN',   x1:52,y1:52,x2:97,y2:97, den:0.75,bc:'#4a4a5a'},
  {name:'DOCKLANDS',  x1:108,y1:97,x2:150,y2:150,den:0.45,bc:'#4a3a2a'},
  {name:'SUBURBS',    x1:0,  y1:82,x2:48,y2:150,den:0.30,bc:'#5a4a3a'},
  {name:'INDUSTRIAL', x1:0,  y1:0, x2:48,y2:72, den:0.55,bc:'#3a3a3a'},
  {name:'EAST SIDE',  x1:108,y1:0, x2:150,y2:87,den:0.42,bc:'#4a3a4a'},
  {name:'MIDTOWN',    x1:48,y1:0,  x2:108,y2:52,den:0.60,bc:'#3a4a4a'},
  {name:'WESTGATE',   x1:0,  y1:72,x2:48,y2:82, den:0.38,bc:'#4a4a3a'},
  {name:'NORTHGATE',  x1:48,y1:97,x2:108,y2:150,den:0.35,bc:'#3a4a3a'},
  {name:'HARBOUR',    x1:108,y1:87,x2:150,y2:97, den:0.40,bc:'#2a3a4a'},
];
function getZone(tx,ty){for(const z of NZONES)if(tx>=z.x1&&tx<z.x2&&ty>=z.y1&&ty<z.y2)return z;return NZONES[0];}
function getSpecial(tx,ty){for(const[k,z] of Object.entries(SPECIAL_ZONES)){if(tx>=z.x1&&tx<z.x2&&ty>=z.y1&&ty<z.y2)return{key:k,...z};}return null;}

const MH=[5,15,25,35,45,55,65,75,85,95,105,115,125,135,145];
const MV=[5,15,25,35,45,55,65,75,85,95,105,115,125,135,145];
const LH=[10,20,30,40,50,60,70,80,90,100,110,120,130,140];
const LV=[10,20,30,40,50,60,70,80,90,100,110,120,130,140];

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
    if(x>122&&y>122){WD[y][x]=5;continue;}
    if((x>=27&&x<=36&&y>=27&&y<=36)||(x>=90&&x<=100&&y>=60&&y<=69)||(x>=63&&x<=72&&y>=90&&y<=99)||(x>=110&&x<=118&&y>=30&&y<=38)){WD[y][x]=4;continue;}
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
  for(let i=0;i<80;i++){const t=rt[Math.floor(Math.random()*rt.length)];const c=mkCar(t.x*T+T/2,t.y*T+T/2,i%CT.length,PAL[i%PAL.length]);c.angle=Math.round(Math.random()*4)*(Math.PI/2);cars.push(c);}
  for(let i=0;i<38;i++){const t=rt[Math.floor(Math.random()*rt.length)];const c=mkCar(t.x*T+T/2,t.y*T+T/2,i%5,PAL[(i+6)%PAL.length]);c.angle=Math.round(Math.random()*4)*(Math.PI/2);c.speed=25+Math.random()*28;c.tT=2+Math.random()*4;c.isTraf=true;traf.push(c);}
}
spawnCars();

// ══════════════════════════════════════════
//  PLAYER
// ══════════════════════════════════════════
const PL={x:3000,y:3000,w:14,h:14,spd:118,spM:1.8,hp:100,maxHp:100,angle:0,inCar:false,car:null,atkCd:0,inv:0,score:0,cash:0,wanted:0,wantT:0};

// ══════════════════════════════════════════
//  NPCs / GANGSTERS / COPS
// ══════════════════════════════════════════
const npcs=[];

// Central kill reporter — increments counters AND notifies missions system
function recordKill(faction){
  if(faction==='gang')gangKills++;
  if(typeof reportMissionKill==='function')reportMissionKill(faction);
  if(typeof onApprovalKill==='function')onApprovalKill(faction);
}
// Margin (tiles) to keep all spawns away from map edges and prevent out-of-bounds placement
const MAP_EDGE_MARGIN=2;

function spawnNPCs(){
  for(let i=0;i<70;i++){
    let tx,ty;do{tx=MAP_EDGE_MARGIN+Math.floor(Math.random()*(WW-MAP_EDGE_MARGIN*2));ty=MAP_EDGE_MARGIN+Math.floor(Math.random()*(WH-MAP_EDGE_MARGIN*2));}while(!isW(tx,ty)||WD[ty][tx]===1||WD[ty][tx]>=6);
    const ci=Math.floor(Math.random()*6);npcs.push({x:tx*T+T/2,y:ty*T+T/2,w:10,h:10,hp:30,maxHp:30,spd:30+Math.random()*28,angle:Math.random()*Math.PI*2,timer:Math.random()*3,col:'hsl('+Math.floor(Math.random()*360)+',55%,58%)',cash:Math.floor(Math.random()*70+15),flee:false,colorIdx:ci,type:'civilian',state:'idle'});
  }
}
spawnNPCs();

// ── Cops, gangsters, their arrays and spawn logic → cops.js / gangsters.js ──

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
for(let i=0;i<60;i++){let tx,ty;do{tx=MAP_EDGE_MARGIN+Math.floor(Math.random()*(WW-MAP_EDGE_MARGIN*2));ty=MAP_EDGE_MARGIN+Math.floor(Math.random()*(WH-MAP_EDGE_MARGIN*2));}while(!isW(tx,ty));spawnPick(tx*T+T/2,ty*T+T/2,Math.random()<0.5?'hp':'cash');}

function explode(x,y,r,dmg){
  spawnPts(x,y,'#f80',18);spawnPts(x,y,'#f00',10);spawnPts(x,y,'#ff0',8);
  for(let i=npcs.length-1;i>=0;i--){const n=npcs[i];if(d2(n.x,n.y,x,y)<r*r){n.hp-=dmg;if(n.hp<=0){PL.score+=30;PL.cash+=n.cash;addWanted(1);recordKill('npc');npcs.splice(i,1);}}}
  for(let i=gangs.length-1;i>=0;i--){const g=gangs[i];if(d2(g.x,g.y,x,y)<r*r){g.hp-=dmg*1.2;if(g.hp<=0){PL.score+=80;PL.cash+=30;recordKill('gang');gangs.splice(i,1);}}}
  for(let i=cops.length-1;i>=0;i--){const c=cops[i];if(d2(c.x,c.y,x,y)<r*r){c.hp-=dmg*1.5;if(c.hp<=0){const cg=COP_GRADES[c.grade||0];PL.score+=cg.reward;PL.cash+=cg.reward;recordKill('cop');cops.splice(i,1);}}}
  if(!PL.inCar&&d2(PL.x,PL.y,x,y)<r*r&&PL.inv<=0){PL.hp-=dmg*0.4;PL.inv=0.4;}
}

// WANTED system → cops.js (addWanted, WANTED_DECAY_TIME)

