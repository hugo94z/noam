/* ===== EFFETS v2 : pool + matériaux/géométries partagés, zéro fuite, qualité auto ===== */
(function(){
  let scene=null;
  const parts=[];   // {mesh,vel,life,maxLife,grav,fade,spin,grow,flat,matKey}
  const MAX_PARTS=320;
  let shakeAmt=0;
  let snow=null, snowVel=null, embers=null, emberVel=null;
  let SNOW_N=600, EMBER_N=220;
  let quality="high";
  const _shakeTmp={x:0,y:0,z:0};

  // ---- partagés ----
  const SHARED_GEO={};
  function SG(key,make){ if(!SHARED_GEO[key]) SHARED_GEO[key]=make(); return SHARED_GEO[key]; }
  const MATS={};
  function matFor(color,opacity,additive){
    const k=color+"|"+(additive?"a":"n");
    if(!MATS[k]) MATS[k]=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false,
      blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});
    return MATS[k];
  }
  const _v1=new THREE.Vector3();

  function isMobile(){ return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)||(Math.min(innerWidth,innerHeight)<700); }

  function spawnMesh(geoKey,geoMake,color,additive){
    // recycle le plus vieux si plein (stabilité : jamais plus de MAX_PARTS)
    if(parts.length>=MAX_PARTS){
      const old=parts.shift();
      if(old&&old.mesh){ scene.remove(old.mesh); }
    }
    const m=new THREE.Mesh(SG(geoKey,geoMake),matFor(color,1,additive).clone());
    // NOTE : on clone le matériau par particule pour l'opacité individuelle,
    // mais la géométrie est partagée (pas de fuite GPU). Clone mat = léger, libéré ci-dessous.
    scene.add(m);
    return m;
  }
  function freePart(p){
    scene.remove(p.mesh);
    if(p.mesh.material&&p.mesh.material.dispose) p.mesh.material.dispose(); // clone individuel
    // géométrie partagée : NE PAS dispose
  }

  window.Effects = {
    init(sc){
      scene=sc;
      if(isMobile()){ SNOW_N=320; EMBER_N=130; quality="low"; }
      // --- neige ---
      const sg=new THREE.BufferGeometry();
      const sp=new Float32Array(SNOW_N*3); snowVel=new Float32Array(SNOW_N);
      for(let i=0;i<SNOW_N;i++){ sp[i*3]=(Math.random()-0.5)*90; sp[i*3+1]=Math.random()*40; sp[i*3+2]=Math.random()*120-110; snowVel[i]=1+Math.random()*2.5; }
      sg.setAttribute("position", new THREE.BufferAttribute(sp,3));
      snow=new THREE.Points(sg, new THREE.PointsMaterial({color:0xffffff,size:0.28,transparent:true,opacity:0.9,depthWrite:false}));
      snow.frustumCulled=false; scene.add(snow);
      // --- braises ---
      const eg=new THREE.BufferGeometry();
      const ep=new Float32Array(EMBER_N*3); emberVel=new Float32Array(EMBER_N);
      for(let i=0;i<EMBER_N;i++){ ep[i*3]=(Math.random()-0.5)*30; ep[i*3+1]=Math.random()*8; ep[i*3+2]=-260-Math.random()*70; emberVel[i]=1+Math.random()*3; }
      eg.setAttribute("position", new THREE.BufferAttribute(ep,3));
      embers=new THREE.Points(eg, new THREE.PointsMaterial({color:0xff8a2e,size:0.32,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending}));
      embers.frustumCulled=false; scene.add(embers);
    },
    setQuality(q){
      quality=q;
      if(snow) snow.visible=(q!=="off");
      if(embers) embers.visible=(q!=="off");
    },
    shake(a){ shakeAmt=Math.min(1.2,shakeAmt+a); },
    offset(out){
      if(shakeAmt>0.01){
        out.set((Math.random()-0.5)*shakeAmt*0.7,(Math.random()-0.5)*shakeAmt*0.7,(Math.random()-0.5)*shakeAmt*0.4);
        shakeAmt*=0.88;
      } else out.set(0,0,0);
      return out;
    },
    dust(pos,color,n,spread,up){
      if(!scene) return;
      color=(color==null?0xffffff:color); n=Math.min(n||8,(quality==="low"?5:10)); spread=spread||3; up=(up==null?4:up);
      for(let i=0;i<n;i++){
        const s=0.12+Math.random()*0.28;
        const m=spawnMesh("puff",()=>new THREE.SphereGeometry(1,6,6),color,false);
        m.scale.setScalar(s);
        m.position.set(pos.x+(Math.random()-0.5)*1,pos.y+Math.random()*0.5,pos.z+(Math.random()-0.5)*1);
        m.material.opacity=0.85;
        parts.push({mesh:m,vel:new THREE.Vector3((Math.random()-0.5)*spread,Math.random()*up,(Math.random()-0.5)*spread),
          life:0,maxLife:0.45+Math.random()*0.4,grav:6,fade:true});
      }
    },
    splash(pos){ this.dust(pos,0x9fe4ff,10,6,7); },
    lavaBurst(pos){ this.dust(pos,0xff7a00,12,7,9); this.dust(pos,0xffef2e,6,4,10); },
    snowPuff(pos){ this.dust(pos,0xffffff,8,4,5); },
    confetti(pos){
      if(!scene) return;
      const cols=[0xff5a2e,0xffcf2e,0x2eff7a,0x4dd8ff,0xc742ff,0xffffff];
      const n=(quality==="low"?40:80);
      for(let i=0;i<n;i++){
        const m=spawnMesh("conf",()=>new THREE.BoxGeometry(0.22,0.22,0.05),cols[i%cols.length],false);
        m.position.set(pos.x,pos.y+1+Math.random()*2,pos.z);
        m.material.opacity=1;
        parts.push({mesh:m,vel:new THREE.Vector3((Math.random()-0.5)*12,6+Math.random()*8,(Math.random()-0.5)*12),
          life:0,maxLife:1.4+Math.random(),grav:9,fade:false,spin:true});
      }
    },
    fireworks(pos){
      if(!scene) return;
      for(let k=0;k<3;k++){
        setTimeout(()=>{
          if(!scene) return;
          const col=[0xff5a2e,0x4dd8ff,0xffcf2e][k];
          for(let i=0;i<20;i++){
            const m=spawnMesh("spark",()=>new THREE.SphereGeometry(0.14,6,6),col,true);
            m.scale.setScalar(1);
            m.position.set(pos.x,pos.y+4+k*2,pos.z);
            const a=(i/20)*Math.PI*2, r=6+Math.random()*4;
            m.material.opacity=1;
            parts.push({mesh:m,vel:new THREE.Vector3(Math.cos(a)*r,Math.random()*4,Math.sin(a)*r),life:0,maxLife:1.0,grav:4,fade:true});
          }
          if(window.AudioSys) AudioSys.ko();
        }, k*350);
      }
    },
    ring(pos,color){
      if(!scene) return;
      const m=spawnMesh("ring",()=>new THREE.TorusGeometry(0.9,0.1,8,28),color||0xffffff,false);
      m.scale.setScalar(1);
      m.position.set(pos.x,pos.y+1,pos.z);
      m.rotation.set(Math.PI/2,0,0);
      m.material.opacity=0.95;
      parts.push({mesh:m,vel:_v1.set(0,1.5,0).clone(),life:0,maxLife:0.45,grav:0,fade:true,grow:9});
    },
    shock(pos,color,maxR){
      if(!scene) return;
      const m=new THREE.Mesh(SG("shock",()=>new THREE.RingGeometry(0.4,1,32)),matFor(color||0xff8800,1,false).clone());
      m.position.set(pos.x,pos.y+0.25,pos.z); m.rotation.x=-Math.PI/2; scene.add(m);
      if(parts.length>=MAX_PARTS){ const o=parts.shift(); if(o) freePart(o); }
      parts.push({mesh:m,vel:new THREE.Vector3(),life:0,maxLife:0.5,grav:0,fade:true,grow:(maxR||7)*2.4,flat:true});
    },
    update(dt, camPos){
      if(!scene) return;
      const nowSec=performance.now()/1000; // 1 seul appel (perf)
      for(let i=parts.length-1;i>=0;i--){
        const p=parts[i]; p.life+=dt;
        if(p.life>=p.maxLife){ freePart(p); parts.splice(i,1); continue; }
        const k=p.life/p.maxLife;
        p.vel.y-=p.grav*dt;
        p.mesh.position.x+=p.vel.x*dt; p.mesh.position.y+=p.vel.y*dt; p.mesh.position.z+=p.vel.z*dt;
        if(p.spin){ p.mesh.rotation.x+=8*dt; p.mesh.rotation.y+=6*dt; }
        if(p.grow){ const s=1+p.life*p.grow; if(p.flat){p.mesh.scale.set(s,s,1);} else p.mesh.scale.set(s,s,s); }
        if(p.fade){ p.mesh.material.opacity=Math.max(0,1-k); }
        if(p.mesh.position.y<0&&p.grav>0){ p.mesh.position.y=0; p.vel.y*=-0.3; p.vel.x*=0.7; p.vel.z*=0.7; }
      }
      if(snow&&snow.visible){
        const a=snow.geometry.attributes.position.array;
        const showSnow = camPos.z < -300;
        const targetO=showSnow?1:0.22;
        snow.material.opacity+=(targetO-snow.material.opacity)*Math.min(1,dt*2);
        const fall=(showSnow?2.2:1);
        for(let i=0;i<SNOW_N;i++){
          a[i*3+1]-=snowVel[i]*dt*fall;
          a[i*3]+=Math.sin(nowSec+i)*dt*0.6;
          if(a[i*3+1]<0){ a[i*3+1]=34; a[i*3]=camPos.x+(Math.random()-0.5)*90; a[i*3+2]=camPos.z+(Math.random()-0.5)*90; }
        }
        snow.geometry.attributes.position.needsUpdate=true;
      }
      if(embers&&embers.visible){
        const a=embers.geometry.attributes.position.array;
        for(let i=0;i<EMBER_N;i++){
          a[i*3+1]+=emberVel[i]*dt;
          a[i*3]+=Math.sin(nowSec*1.1+i*2)*dt*1.2;
          if(a[i*3+1]>14){ a[i*3+1]=0; a[i*3]=(Math.random()-0.5)*30; a[i*3+2]=-260-Math.random()*70; }
        }
        embers.geometry.attributes.position.needsUpdate=true;
      }
      void _shakeTmp;
    }
  };
})();
