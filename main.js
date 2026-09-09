/* ===== MAIN — boucle, physique parkour du plan, caméra, HUD ===== */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const container=$("game"), msgEl=$("msg");

// ---------- RENDERER / SCENE ----------
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x87ceeb);
scene.fog=new THREE.Fog(0x9fd8ef,45,170);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.1,600);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(1.5,devicePixelRatio||1)); // plafond perf (stabilité FPS)
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
container.appendChild(renderer.domElement);
// si le GPU lâche (onglet, veille), message propre au lieu de freeze
renderer.domElement.addEventListener("webglcontextlost",e=>{
  e.preventDefault();
  showMsg("⚠️ GPU en pause — recharge la page (F5)",6000);
},false);
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
// qualité auto : si ça rame, on baisse les particules/neige (1 seule fois)
let autoDegraded=false, fpsEMA=60;
function autoQuality(dt){
  if(autoDegraded||!started) return;
  const fps=1/Math.max(1e-3,dt);
  fpsEMA+=(fps-fpsEMA)*0.05;
  if(fpsEMA<36&&elapsed>6){
    autoDegraded=true;
    renderer.setPixelRatio(1);
    if(window.Effects&&Effects.setQuality) Effects.setQuality("low");
    console.log("[NoamSpeeder] qualité auto: low (fps "+Math.round(fpsEMA)+")");
  }
}
document.addEventListener("visibilitychange",()=>{
  if(!document.hidden){ clock2.getDelta(); } // évite un dt géant au retour
});

// lumières deluxe
scene.add(new THREE.HemisphereLight(0xcfeaff,0x4a7a4a,0.85));
scene.add(new THREE.AmbientLight(0xffffff,0.22));
const sun=new THREE.DirectionalLight(0xfff2d8,1.5);
sun.position.set(25,55,15); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-55; sun.shadow.camera.right=55;
sun.shadow.camera.top=55; sun.shadow.camera.bottom=-55;
sun.shadow.camera.far=160; sun.shadow.bias=-0.0006;
scene.add(sun); scene.add(sun.target);
const rim=new THREE.DirectionalLight(0x88bbff,0.5); rim.position.set(-30,20,-40); scene.add(rim);

// ---------- INIT MODULES ----------
initTextures();
World.build(scene);
PlayerSys.create(scene);
EnemiesSys.spawnAll(scene);
Effects.init(scene);

const P=PlayerSys.P;
let started=false, startTime=0, elapsed=0, kills=0;
let camYaw=0, camPitch=0.34, lastDragT=0;
// flèche guide vers l'arrivée (cohérence : on sait toujours où aller)
const guideArrow=new THREE.Group();
{
  const cone=new THREE.Mesh(new THREE.ConeGeometry(0.35,0.9,10),
    new THREE.MeshBasicMaterial({color:0xffcf2e,transparent:true,opacity:0.95,depthWrite:false}));
  cone.rotation.x=-Math.PI/2; // pointe vers -Z
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.55,0.07,8,20),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.7,depthWrite:false}));
  guideArrow.add(cone,ring);
  guideArrow.visible=false;
  scene.add(guideArrow);
}
// distance restante (créée en JS pour ne pas toucher le HTML)
const distDiv=document.createElement("div");
distDiv.style.cssText="font-size:12px;font-weight:800;color:#ffcf2e;text-shadow:0 1px 4px #000";
document.getElementById("timer").appendChild(distDiv);

// ---------- HELPERS UI ----------
let msgTO=null;
function showMsg(t,ms){
  msgEl.textContent=t; msgEl.classList.add("show");
  clearTimeout(msgTO); msgTO=setTimeout(()=>msgEl.classList.remove("show"),ms||2200);
}
function fmtTime(s){const m=Math.floor(s/60),ss=s%60;return m+":"+(ss<10?"0":"")+ss.toFixed(1);}
function updateHearts(){ $("hearts").textContent="❤️".repeat(Math.max(0,P.hearts))+"🤍".repeat(Math.max(0,CONFIG.hearts-P.hearts)); }
function updateProgress(){
  const d=$("progress").children;
  for(let i=0;i<d.length;i++){ d[i].className=i<P.zoneIdx?"done":(i===P.zoneIdx?"now":""); }
}
window.__hurtPlayer=function(dmg,from){ hurtPlayer(dmg,from); };

// ---------- ACTIONS (fidèles au papier) ----------
function tryJump(){
  if(!started||P.finished||P.hearts<=0) return;
  const now=performance.now()/1000;
  if(P.crouch&&P.onGround){
    P.vel.y=CONFIG.backflipPower;
    P.vel.x=-Math.sin(P.yaw)*9.5; P.vel.z=-Math.cos(P.yaw)*9.5;
    P.onGround=false; P.backflipT=0.65; P.jumpChain=0;
    AudioSys.backflip(); showMsg("🌀 BACKFLIP !"); Effects.ring(P.pos,0xffffff);
    Effects.dust(P.pos,0xffffff,10,4,5);
    return;
  }
  if(P.onGround||P.coyote>0){
    const running=Math.hypot(P.vel.x,P.vel.z)>6;
    const sinceLand=now-P.lastLand;
    if(sinceLand<0.4&&running) P.jumpChain++; else P.jumpChain=0;
    let power=CONFIG.jumpPower;
    if(P.jumpChain===1){ power=CONFIG.jumpPower+1; showMsg("🦘 Double saut !"); AudioSys.doubleJump(); }
    else if(P.jumpChain>=2){ power=CONFIG.tripleJumpPower; P.jumpChain=0; AudioSys.triple(); showMsg("🦘🦘🦘 TRIPLE SAUT !"); Effects.ring(P.pos,0xffcf2e); }
    else AudioSys.jump();
    P.vel.y=power; P.onGround=false; P.coyote=0; P.airJumps=1;
    Effects.dust(P.pos,0xffffff,6,3,3);
  }else if(P.airJumps>0){
    P.airJumps--; P.vel.y=CONFIG.doubleJumpPower; P.jumpChain=0;
    AudioSys.doubleJump(); showMsg("✨ Saut dans les airs !"); Effects.ring(P.pos,0x7affff);
  }
}
function tryPound(){
  if(!started||P.finished) return;
  if(!P.onGround&&!P.pounding){ P.pounding=true; P.vel.set(0,-27,0); AudioSys.pound(); showMsg("💥 GROUND POUND !"); }
}
function doPunch(){
  if(!started||P.finished||P.punchCd>0||P.hearts<=0) return;
  P.punchCd=0.42; PlayerSys.parts.fist.visible=true;
  setTimeout(()=>{ if(PlayerSys.parts.fist) PlayerSys.parts.fist.visible=false; },150);
  AudioSys.punch();
  _tmpHurt.set(P.pos.x-Math.sin(P.yaw)*1.4,P.pos.y+1.2,P.pos.z-Math.cos(P.yaw)*1.4);
  Effects.dust(_tmpHurt,0xffcf2e,5,3,3);
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);
  for(const e of EnemiesSys.list){
    if(e.dead) continue;
    const dx=e.mesh.position.x-P.pos.x,dz=e.mesh.position.z-P.pos.z;
    const dist=Math.sqrt(dx*dx+dz*dz);
    const dot=(dx*fx+dz*fz)/(dist||1);
    if(dist<3&&dot>0.35) hitEnemy(e,1,true);
  }
}
function hitEnemy(e,dmg,isPunch){
  const died=EnemiesSys.damage(e,dmg);
  if(died){ kills++; $("killCount").textContent=kills; AudioSys.ko(); showMsg(e.type+" KO ! 💥"); P.vel.y=Math.max(P.vel.y,8.5); }
  else{ AudioSys.hit(); showMsg(e.type+" touché ! ("+e.hp+"❤)"); }
}
function hurtPlayer(dmg,from){
  if(P.invuln>0||P.finished||P.hearts<=0) return;
  P.hearts-=dmg; P.invuln=1.3; AudioSys.hurt();
  updateHearts();
  $("damageFlash").style.opacity=1; setTimeout(()=>$("damageFlash").style.opacity=0,180);
  Effects.shake(0.7); Effects.dust(P.pos,0xff4444,8,5,6);
  if(from){
    _tmpHurt.copy(P.pos).sub(from); _tmpHurt.y=0;
    if(_tmpHurt.lengthSq()<1e-4) _tmpHurt.set(0,0,1); // garde-fou vecteur nul
    _tmpHurt.normalize().multiplyScalar(8);
    P.vel.x=_tmpHurt.x; P.vel.z=_tmpHurt.z; P.vel.y=8.5; P.onGround=false;
  }
  if(P.hearts<=0){
    $("loseTxt").textContent="Tu es arrivé jusqu'à "+ZONES[P.zoneIdx].name+" en "+fmtTime(elapsed)+" avec "+kills+" KO !";
    $("lose").classList.remove("hidden");
  }
}
function respawn(){
  P.pos.copy(P.checkpoint); P.pos.y+=1.5; P.vel.set(0,0,0);
  P.hearts=CONFIG.hearts; P.invuln=1.2; P.pounding=false; P.floatEnergy=1;
  updateHearts(); $("lose").classList.add("hidden");
  showMsg("↩️ Checkpoint !");
}
function winGame(){
  if(P.finished) return;
  P.finished=true; AudioSys.win();
  World.pressButton();
  Effects.confetti(World.finishGroup.position);
  Effects.fireworks(World.finishGroup.position);
  Effects.shake(0.5);
  $("winTxt").innerHTML="⏱️ Temps : <b>"+fmtTime(elapsed)+"</b> • 👾 "+kills+" monstres KO<br>Tu as traversé les 6 zones et écrasé le bouton comme sur ton dessin !";
  setTimeout(()=>$("win").classList.remove("hidden"),900);
  showMsg("🏁 BOUTON APPUYÉ ! GAGNÉ !",3200);
}

// ---------- INPUT ----------
const keys={};
addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  keys[k]=true;
  if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(k)) e.preventDefault();
  if(k===" ") tryJump();
  if(k==="e") doPunch();
  if(k==="r") respawn();
  // POUND : X / V (et pas S, sinon on pounderait dès qu'on recule en l'air !)
  if(k==="x"||k==="v") tryPound();
  // T = recentrer la caméra derrière
  if(k==="t"){ camYaw=0; camPitch=0.34; }
});
addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;});
let dragging=false,lx=0,ly=0;
renderer.domElement.addEventListener("mousedown",e=>{dragging=true;lx=e.clientX;ly=e.clientY;lastDragT=performance.now();});
addEventListener("mouseup",()=>{dragging=false;lastDragT=performance.now();});
addEventListener("mousemove",e=>{
  if(dragging){camYaw-=(e.clientX-lx)*0.0052;camPitch+=(e.clientY-ly)*0.003;camPitch=Math.max(0.06,Math.min(1.05,camPitch));lx=e.clientX;ly=e.clientY;lastDragT=performance.now();}
});
renderer.domElement.addEventListener("click",()=>{ if(started&&!P.finished&&P.hearts>0) doPunch(); });
// tactile
const joy=$("joy"),stick=$("stick");
let joyDX=0,joyDY=0,joyOn=false,touchFloat=false;
function joyPos(e){
  const r=joy.getBoundingClientRect(),cx=r.left+62,cy=r.top+62;
  const p=e.touches?e.touches[0]:e;
  let dx=(p.clientX-cx)/52,dy=(p.clientY-cy)/52;
  const l=Math.hypot(dx,dy); if(l>1){dx/=l;dy/=l;}
  joyDX=dx;joyDY=dy; stick.style.left=(37+dx*32)+"px"; stick.style.top=(37+dy*32)+"px";
}
joy.addEventListener("touchstart",e=>{joyOn=true;joyPos(e);e.preventDefault();},{passive:false});
joy.addEventListener("touchmove",e=>{joyPos(e);e.preventDefault();},{passive:false});
joy.addEventListener("touchend",()=>{joyOn=false;joyDX=joyDY=0;stick.style.left="37px";stick.style.top="37px";});
function tBind(id,down,up){const el=$(id);el.addEventListener("touchstart",e=>{e.preventDefault();down();},{passive:false});if(up)el.addEventListener("touchend",e=>{e.preventDefault();up();});}
tBind("tJump",tryJump); tBind("tHit",doPunch); tBind("tPound",tryPound);
tBind("tFloat",()=>touchFloat=true,()=>touchFloat=false);
tBind("tCrouch",()=>keys["c"]=true,()=>keys["c"]=false);

// ---------- PHYSIQUE ----------
const clock=new THREE.Clock();
const _v=new THREE.Vector3(), _shake=new THREE.Vector3(), _tmpHurt=new THREE.Vector3();
let floatSndT=0;

function update(dt,t){
  const now=performance.now()/1000;
  let ix=0,iz=0;
  if(keys["w"]||keys["z"]||keys["arrowup"])iz-=1;
  if(keys["s"]||keys["arrowdown"])iz+=1;
  if(keys["a"]||keys["q"]||keys["arrowleft"])ix-=1;
  if(keys["d"]||keys["arrowright"])ix+=1;
  if(joyOn){ix+=joyDX;iz+=joyDY;}
  const hasInput=Math.hypot(ix,iz)>0.15;
  P.crouch=!!(keys["c"]||keys["control"]);

  // accélération progressive + limite
  if(hasInput&&P.onGround) P.speedRun=Math.min(1,P.speedRun+dt/CONFIG.accelTime);
  else if(!hasInput) P.speedRun=Math.max(0,P.speedRun-dt*1.1);
  if(!P.onGround) P.speedRun=Math.max(P.speedRun,0.45);
  const curMax=CONFIG.baseSpeed+(CONFIG.topSpeed-CONFIG.baseSpeed)*P.speedRun;
  let surf=1;
  if(P.groundType==="ice")surf=1.12; else if(P.groundType==="sand")surf=0.85;
  else if(P.groundType==="water")surf=0.6; else if(P.groundType==="dark")surf=0.95;
  if(P.crouch&&P.onGround)surf*=0.32;

  let dx=0,dz=0;
  if(hasInput){
    const l=Math.hypot(ix,iz);ix/=Math.max(1,l);iz/=Math.max(1,l);
    const s=Math.sin(camYaw),c=Math.cos(camYaw);
    // CORRIGÉ : Z/W = devant (-Z quand caméra à 0), S = derrière, D = droite, Q = gauche
    // forward = (-sinYaw, -cosYaw), right = (cosYaw, -sinYaw)
    dx=ix*c+iz*s; dz=-ix*s+iz*c;
    const target=Math.atan2(-dx,-dz);
    let d=target-P.yaw; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2;
    P.yaw+=d*Math.min(1,dt*11);
  }
  const grip=P.onGround?(P.groundType==="ice"?1.7:6.5):3.2;
  P.vel.x+=(dx*curMax*surf-P.vel.x)*Math.min(1,dt*grip);
  P.vel.z+=(dz*curMax*surf-P.vel.z)*Math.min(1,dt*grip);

  // flottement Yoshi 1 sec
  const wantFloat=(keys["f"]||touchFloat)&&!P.onGround&&P.floatEnergy>0;
  P.floating=!!wantFloat;
  if(P.floating){
    P.floatEnergy-=dt;
    P.vel.y=Math.max(P.vel.y-9*dt,-2.1);
    floatSndT-=dt; if(floatSndT<=0){floatSndT=0.18;AudioSys.floatLoop();}
    if(Math.random()<0.35)Effects.dust(P.pos,0xffffff,1,1.5,0.5);
  }else{
    P.vel.y+=(P.pounding?-62:-CONFIG.gravity)*dt;
    if(P.vel.y<-31)P.vel.y=-31;
  }
  if(P.onGround)P.floatEnergy=Math.min(1,P.floatEnergy+dt*0.85);

  // garde-fou NaN (stabilité : jamais de freeze avec des NaN)
  if(!isFinite(P.pos.x+P.pos.y+P.pos.z+P.vel.x+P.vel.y+P.vel.z)){
    P.pos.copy(P.checkpoint); P.pos.y+=2; P.vel.set(0,0,0);
  }
  // intégration en sous-pas sur Y si chute très rapide (anti-traversée des sols fins)
  P.pos.x+=P.vel.x*dt; P.pos.z+=P.vel.z*dt;
  P.pos.x=Math.max(-13,Math.min(13,P.pos.x));
  const yStep=P.vel.y*dt;
  if(Math.abs(yStep)>0.6){
    const n=2, h=yStep/n;
    for(let s=0;s<n;s++){
      P.pos.y+=h;
      const mid=World.groundHeightAt(P.pos.x,P.pos.z,P.pos.y);
      if(mid.y>-900&&P.pos.y<=mid.y+0.06&&P.vel.y<=0){ break; }
    }
  }else{
    P.pos.y+=yStep;
  }

  // sol (sans allocation : calcul direct)
  const gh=World.groundHeightAt(P.pos.x,P.pos.z,P.pos.y);
  if(gh.y>-900&&P.pos.y<=gh.y+0.06&&P.vel.y<=0){
    const landed=!P.onGround;
    P.pos.y=gh.y; P.vel.y=0; P.onGround=true; P.coyote=0.13; P.airJumps=1; P.groundType=gh.type;
    if(landed){
      P.lastLand=now;
      const spd=Math.sqrt(P.vel.x*P.vel.x+P.vel.z*P.vel.z);
      Effects.dust(P.pos,P.groundType==="snow"||P.groundType==="ice"?0xffffff:0xd8c9a8,Math.min(10,3+spd),4,3);
      if(P.pounding){
        P.pounding=false; AudioSys.pound(); Effects.shake(0.9);
        Effects.shock(P.pos,0xff8800,5); Effects.dust(P.pos,0xffaa3d,14,8,7);
        for(const e of EnemiesSys.list){
          if(e.dead)continue;
          const ex=e.mesh.position.x-P.pos.x, ez=e.mesh.position.z-P.pos.z;
          if(ex*ex+ez*ez<25) hitEnemy(e,2);
        }
        { const fx=World.finishGroup.position.x-P.pos.x, fz=World.finishGroup.position.z-P.pos.z;
          if(fx*fx+fz*fz<25) winGame(); }
      }
      if(gh.type==="lava"){ _tmpHurt.set(0,0,1); _tmpHurt.add(P.pos); hurtPlayer(1,_tmpHurt); P.vel.y=9.5; Effects.lavaBurst(P.pos); }
    }else if(gh.type==="lava"&&P.invuln<=0){
      hurtPlayer(1,null); P.vel.y=9.5; Effects.lavaBurst(P.pos);
    }
    if(gh.type==="water"&&P.invuln<=0){
      if(!P._wT||now-P._wT>1.3){P._wT=now;AudioSys.splash();Effects.splash(P.pos);hurtPlayer(1,null);showMsg("🌊 Vite, remonte sur un plot !");}
    }
  }else{
    if(P.onGround)P.coyote=0.13; else P.coyote-=dt;
    P.onGround=false;
  }
  if(P.pos.y<-7){
    hurtPlayer(1,null);
    if(P.hearts>0){P.pos.copy(P.checkpoint);P.pos.y+=2;P.vel.set(0,0,0);showMsg("😵 Tombé ! Checkpoint");}
  }

  // poussière de vitesse + traces
  const speed=Math.hypot(P.vel.x,P.vel.z);
  if(P.onGround&&speed>8&&Math.random()<dt*speed*1.4)
    Effects.dust(P.pos,P.groundType==="snow"?0xffffff:(P.groundType==="sand"?0xffe9ad:0xcfc8bb),1,2,2);
  if(P.groundType==="dark"&&P.onGround&&Math.random()<dt*6)Effects.dust(P.pos,0xff7a00,1,2,3);

  // zones + checkpoints
  const zi=World.zoneAt(P.pos.z);
  if(zi!==P.zoneIdx){
    P.zoneIdx=zi;
    $("zoneLabel").innerHTML=ZONES[zi].name+"<small>"+ZONES[zi].sub+"</small>";
    updateProgress(); showMsg(ZONES[zi].name+" !",2600); AudioSys.check();
    P.checkpoint.set(P.pos.x,Math.max(0.6,P.pos.y),P.pos.z+2.5);
    if(ZONES[zi].ground==="snow")Effects.snowPuff(P.pos);
  }

  // ennemis : collision sans allocation (distances au carré)
  EnemiesSys.update(dt,t,P);
  for(let ei=0;ei<EnemiesSys.list.length;ei++){
    const e=EnemiesSys.list[ei];
    if(e.dead)continue;
    const epx=e.mesh.position.x-P.pos.x, epz=e.mesh.position.z-P.pos.z;
    const rr=1.3+e.r*0.35;
    if(epx*epx+epz*epz<rr*rr){
      const dy=P.pos.y-e.mesh.position.y;
      if(Math.abs(dy)<1.7&&P.invuln<=0){
        if(P.vel.y<-2&&P.pos.y>e.mesh.position.y+0.75){ hitEnemy(e,1); P.vel.y=11.5; P.airJumps=1; Effects.ring(P.pos,0xffffff); }
        else if(P.pounding&&!P.onGround){ hitEnemy(e,2); }
        else hurtPlayer(1,e.mesh.position);
      }
    }
  }

  P.punchCd-=dt; P.invuln-=dt; if(P.backflipT>0)P.backflipT-=dt;
  PlayerSys.group.position.copy(P.pos);
  PlayerSys.group.rotation.y=P.yaw;
  PlayerSys.animate(dt,t,speed);
  PlayerSys.syncShadow(gh.y>-900?gh.y:P.pos.y-3);

  World.update(dt,t,P.pos);
  Effects.update(dt,camera.position);

  // caméra : suit + FOV vitesse + secousse + recentrage doux si pas touchée
  if(!dragging&&performance.now()-lastDragT>3500&&hasInput){
    // recentre très doucement vers l'arrière (0) pour rester cohérent
    let d=-camYaw; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2;
    camYaw+=d*Math.min(1,dt*0.5);
  }
  const cd=8.6,ch=4.1+camPitch*4.2;
  _v.set(P.pos.x+Math.sin(camYaw)*cd*Math.cos(camPitch),P.pos.y+ch,P.pos.z+Math.cos(camYaw)*cd*Math.cos(camPitch));
  camera.position.lerp(_v,Math.min(1,dt*5));
  Effects.offset(_shake); camera.position.add(_shake);
  camera.lookAt(P.pos.x,P.pos.y+1.9,P.pos.z-2.5);
  const targetFov=62+(speed/CONFIG.topSpeed)*15+(P.pounding?4:0);
  camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*4); camera.updateProjectionMatrix();
  sun.position.set(P.pos.x+22,P.pos.y+42,P.pos.z+16);
  sun.target.position.copy(P.pos); sun.target.updateMatrixWorld();

  // flèche guide : au-dessus de Noam, pointe vers l'arrivée (-Z), pulse
  guideArrow.position.set(P.pos.x,P.pos.y+3.4+Math.sin(t*3)*0.15,P.pos.z-0.5);
  guideArrow.rotation.y=0; // monde : -Z
  guideArrow.visible=started&&!P.finished;
  guideArrow.children[0].material.opacity=0.65+Math.sin(t*5)*0.3;
  // distance restante
  const dist=Math.max(0,Math.round(P.pos.z-(-398)));
  distDiv.textContent="🏁 Reste "+dist+" m • (T = recentrer cam)";

  // HUD
  const kmh=Math.round(speed*3.6);
  $("speedBar").style.width=Math.min(100,speed/CONFIG.topSpeed*100)+"%";
  $("speedTxt").textContent=kmh+" km/h "+(P.speedRun>0.93?"🔥 MAX !":(P.speedRun>0.5?"⚡ vite !":""));
  $("speedlines").style.opacity=P.speedRun>0.85&&speed>10?0.85:(speed>12?0.6:0);
  $("floatBar").style.width=(P.floatEnergy*100)+"%";
  $("floatTxt").textContent="🎈 FLOTTER (F) : "+P.floatEnergy.toFixed(1)+"s"+(P.floating?" — ✨ je flotte !":"");
  if(started&&!P.finished){elapsed=(performance.now()-startTime)/1000;$("timeTxt").textContent=fmtTime(elapsed);}
}

// ---------- BOUCLE ----------
const clock2=new THREE.Clock();
P.pos.set(0,0.5,-2); PlayerSys.group.position.copy(P.pos);
camera.position.set(0,5.5,8); camera.lookAt(0,1,-8);
updateProgress();
const _menuPos=new THREE.Vector3(0,0,-10); // réutilisé (zéro alloc dans la boucle menu)
function loop(){
  requestAnimationFrame(loop);
  let dt=clock2.getDelta();
  if(!isFinite(dt)||dt<0) dt=0.016;
  dt=Math.min(0.033,dt);
  autoQuality(dt);
  const t=clock2.elapsedTime;
  try{
    if(started&&!P.finished&&P.hearts>0) update(dt,t);
    else if(!started){
      const tt=performance.now()/1000;
      camera.position.set(Math.sin(tt*0.25)*11,6.5,-2+Math.cos(tt*0.25)*11);
      camera.lookAt(0,1.5,-24);
      World.update(dt,tt,_menuPos);
      Effects.update(dt,camera.position);
      PlayerSys.group.position.copy(P.pos);
    }else{
      World.update(dt,t,P.pos);
      Effects.update(dt,camera.position);
    }
    renderer.render(scene,camera);
  }catch(err){
    console.error("[NoamSpeeder] boucle:",err);
    // stability: on ne crash jamais en boucle, on saute la frame
  }
}
loop();

// ---------- MENUS ----------
$("btnStart").onclick=()=>{
  AudioSys.unlock(); AudioSys.click();
  $("menu").classList.add("hidden");
  started=true; startTime=performance.now();
  showMsg("GO ! Cours, ça accélère tout seul ! ⚡",2600);
  AudioSys.check();
};
$("btnRestart").onclick=()=>location.reload();
$("btnRestart2").onclick=()=>location.reload();
updateHearts();
})();
