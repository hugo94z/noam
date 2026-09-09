/* ===== ENNEMIS v2 : assemblage cohérent (aucun membre/arme ne traverse) + optimisé =====
   Conventions :
   - Avant = +Z (face au joueur qui arrive de +Z). rotation.y = atan2(dx,dz) => +Z vers cible.
   - Chaque pièce est POSÉE sur la surface de l'autre (chevauchement max 0.1 = joint), jamais plantée dedans.
   - Zéro PointLight par ennemi (émissif uniquement) pour la perf.
*/
(function(){
  let scene=null;
  const list=[], projectiles=[];
  const MAX_PROJ=12;

  // ---- caches partagés (stabilité + perf : 1 géométrie / matériau réutilisé) ----
  const GEO={}, MATCACHE={};
  function geo(key, make){ if(!GEO[key]) GEO[key]=make(); return GEO[key]; }
  function M(c,o){
    const k=c+JSON.stringify(o||{});
    if(!MATCACHE[k]) MATCACHE[k]=new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:0.7,metalness:0.05},o||{}));
    return MATCACHE[k];
  }
  function BM(c,o){ // basic (yeux, gems) : partagé aussi
    const k="b"+c+JSON.stringify(o||{});
    if(!MATCACHE[k]) MATCACHE[k]=new THREE.MeshBasicMaterial(Object.assign({color:c},o||{}));
    return MATCACHE[k];
  }
  const _tmpA=new THREE.Vector3(), _tmpB=new THREE.Vector3();

  /* ---------------- BLOUP (Goomba gluant, petit) ----------------
     Corps : sphère aplatie centre y=0.55, rayons (1.22, 0.72, 0.95) [0.95*1.28 etc.]
     Tout est posé SUR la surface, pas dedans. Échelle groupe 0.68.
  */
  function makeBloup(x,y,z){
    const g=new THREE.Group();
    const slimeM=new THREE.MeshStandardMaterial({color:0x2fbf5a,roughness:0.25,metalness:0.05,transparent:true,opacity:0.96});
    const slime=new THREE.Mesh(geo("slime",()=>new THREE.SphereGeometry(0.95,18,14)),slimeM);
    slime.scale.set(1.28,0.76,1.0); slime.position.y=0.55; slime.castShadow=true; g.add(slime);
    // ventre : patch collé DEVANT (+Z), juste la bordure qui touche
    const belly=new THREE.Mesh(geo("belly",()=>new THREE.SphereGeometry(0.62,14,12)),M(0xd8ffd0,{roughness:0.4}));
    belly.scale.set(1.0,0.6,0.42); belly.position.set(0,0.48,0.78); g.add(belly);
    // taches : posées sur la calotte haute (pas enterrées) via angle sphérique
    const spotM=M(0x1d7a35);
    const spotGeo=geo("spot",()=>new THREE.SphereGeometry(0.1,6,6));
    for(let i=0;i<4;i++){
      const a=Math.PI*(0.15+Math.random()*0.35), th=Math.random()*Math.PI*2; // haut du slime
      const sx=Math.sin(a)*Math.cos(th)*1.22, sy=0.55+Math.cos(a)*0.72, sz=Math.sin(a)*Math.sin(th)*1.0;
      const s=new THREE.Mesh(spotGeo,spotM);
      const sc=0.7+Math.random()*0.6; s.scale.setScalar(sc);
      // pousse légèrement vers l'extérieur le long de la normale
      _tmpA.set(sx,sy-0.55,sz).normalize();
      s.position.set(sx+_tmpA.x*0.02,sy+_tmpA.y*0.02,sz+_tmpA.z*0.02);
      s.scale.z*=0.45; // aplatit comme un patch, pas une bille plantée
      g.add(s);
    }
    // yeux : tiges POSÉES sur le sommet (base à y≈1.22 = surface), pas enterrées
    const eyeM=BM(0xffe62e), pupM=BM(0x111111);
    const stalkGeo=geo("stalk",()=>new THREE.CylinderGeometry(0.08,0.11,0.34,8));
    const eyeGeo=geo("beye",()=>new THREE.ConeGeometry(0.22,0.55,10));
    const pupGeo=geo("bpup",()=>new THREE.SphereGeometry(0.065,6,6));
    [-0.3,0.3].forEach(dx=>{
      const stalk=new THREE.Mesh(stalkGeo,slimeM); stalk.position.set(dx,1.32,0.12); g.add(stalk); // base 1.15≈surface, sommet 1.49
      const eye=new THREE.Mesh(eyeGeo,eyeM); eye.position.set(dx,1.72,0.10); eye.rotation.x=0.18; g.add(eye);
      const pup=new THREE.Mesh(pupGeo,pupM); pup.position.set(dx,1.70,0.30); g.add(pup); // DEVANT (+Z), sur le cône
    });
    // reflet : patch fin collé sur le flanc avant-gauche
    const gloss=new THREE.Mesh(geo("gloss",()=>new THREE.SphereGeometry(0.24,10,10)),BM(0xffffff,{transparent:true,opacity:0.5}));
    gloss.position.set(-0.72,0.85,0.62); gloss.scale.set(1,0.55,0.35); g.add(gloss);
    g.position.set(x,y,z); scene.add(g);
    g.scale.setScalar(0.68);
    list.push({type:"Bloup",mesh:g,slime,slimeBaseY:0.55,hp:1,baseX:x,baseZ:z,baseY:y,baseScale:0.68,
      t:Math.random()*6,range:2.8,hitCd:0,dead:false,r:0.7});
  }

  /* ---------------- GOLDONAX (golem, grand) : pile verticale sans chevauchement profond ----------------
     0.00-0.80 jambes | 0.80-0.90 joint | corps centre 1.62 (r 0.85 => 0.77-2.47)
     cou 2.47-2.60 | tête centre 2.98 (2.56-3.40) | casque 3.45 | crête 3.85
     Bras : épaules à ±1.28 (hors corps r 0.85 + bras r 0.5 => contact à 1.35, on met 1.42 = joint fin)
  */
  function makeGoldonax(x,y,z){
    const g=new THREE.Group();
    const stone=M(0xd9d5cc,{roughness:0.95,flatShading:true});
    const dark=M(0x8a857a,{roughness:1,flatShading:true});
    const moss=M(0x4da93a,{roughness:1});
    // jambes : deux piliers séparés, sommet 0.80
    [-0.42,0.42].forEach(dx=>{
      const l=new THREE.Mesh(geo("gleg",()=>new THREE.BoxGeometry(0.55,0.8,0.7)),dark);
      l.position.set(dx,0.4,0); l.castShadow=true; g.add(l);
    });
    // bassin (joint fin entre jambes et corps)
    const hips=new THREE.Mesh(geo("ghips",()=>new THREE.BoxGeometry(1.0,0.25,0.8)),dark);
    hips.position.y=0.9; g.add(hips);
    // corps : dodécaèdre r 0.85, centre 1.62 (bas 0.77 => touche le bassin, pas planté)
    const body=new THREE.Mesh(geo("gbody",()=>new THREE.DodecahedronGeometry(0.85,0)),stone);
    body.position.y=1.62; body.castShadow=true; g.add(body);
    const patch=new THREE.Mesh(geo("gpatch",()=>new THREE.SphereGeometry(0.34,7,7)),moss);
    patch.position.set(0.55,1.85,0.55); patch.scale.set(1,1,0.4); g.add(patch); // patch de mousse collé
    // épaules : petites rotules qui relient corps et bras (pas de vide, pas de traversée)
    [-1.18,1.18].forEach(dx=>{
      const sh=new THREE.Mesh(geo("gsho",()=>new THREE.SphereGeometry(0.3,8,8)),dark);
      sh.position.set(dx,1.85,0); g.add(sh);
    });
    // bras : sphères roche r 0.5, centre ±1.62 => bord interne 1.12... contact épaule, pas dans le corps
    const armGeo=geo("garm",()=>new THREE.DodecahedronGeometry(0.5,0));
    const armL=new THREE.Mesh(armGeo,stone); armL.position.set(-1.62,1.7,0); armL.castShadow=true; g.add(armL);
    const armR=new THREE.Mesh(armGeo,stone); armR.position.set(1.62,1.7,0); armR.castShadow=true; g.add(armR);
    // poings plus petits SOUS les bras (pas dedans)
    const fistGeo=geo("gfist",()=>new THREE.DodecahedronGeometry(0.32,0));
    const fistL=new THREE.Mesh(fistGeo,dark); fistL.position.set(-1.62,1.0,0); fistL.castShadow=true; g.add(fistL);
    const fistR=new THREE.Mesh(fistGeo,dark); fistR.position.set(1.62,1.0,0); fistR.castShadow=true; g.add(fistR);
    // cou + tête : tête posée SUR le corps (bas tête 2.56 vs haut corps 2.47 = joint 0.09)
    const neck=new THREE.Mesh(geo("gneck",()=>new THREE.CylinderGeometry(0.3,0.35,0.25,8)),dark);
    neck.position.y=2.52; g.add(neck);
    const head=new THREE.Mesh(geo("ghead",()=>new THREE.BoxGeometry(1.0,0.82,0.9)),stone);
    head.position.y=2.98; head.castShadow=true; g.add(head);
    const helm=new THREE.Mesh(geo("ghelm",()=>new THREE.BoxGeometry(1.1,0.34,1.0)),dark);
    helm.position.y=3.5; helm.castShadow=true; g.add(helm);
    const crest=new THREE.Mesh(geo("gcrest",()=>new THREE.ConeGeometry(0.28,0.62,6)),
      new THREE.MeshStandardMaterial({color:0xff5a00,emissive:0xff3300,emissiveIntensity:0.7,roughness:0.6}));
    crest.position.y=3.95; g.add(crest);
    // visage AVANT (+Z) : bandeau collé sur la face (face à z=+0.45, bandeau à +0.47)
    const band=new THREE.Mesh(geo("gband",()=>new THREE.BoxGeometry(0.82,0.26,0.1)),
      new THREE.MeshStandardMaterial({color:0x331100,emissive:0xff3300,emissiveIntensity:1.2}));
    band.position.set(0,3.02,0.47); g.add(band);
    const eyeGeo=geo("geye",()=>new THREE.ConeGeometry(0.15,0.3,6));
    const eyeMat=BM(0xffef2e);
    const eyeL=new THREE.Mesh(eyeGeo,eyeMat); eyeL.position.set(-0.2,3.02,0.56); eyeL.rotation.x=Math.PI/2; g.add(eyeL);
    const eyeR=new THREE.Mesh(eyeGeo,eyeMat); eyeR.position.set(0.2,3.02,0.56); eyeR.rotation.x=Math.PI/2; g.add(eyeR);
    // PAS de PointLight (émissif suffit) -> perf
    g.position.set(x,y,z); scene.add(g);
    list.push({type:"Goldonax",mesh:g,armL,armR,fistL,fistR,band,hp:3,baseX:x,baseZ:z,baseY:y,baseScale:1,
      t:Math.random()*6,shootT:1.2+Math.random()*2,hitCd:0,dead:false,r:1.15});
  }

  /* ---------------- CORHOG (lancier) : tout à l'EXTÉRIEUR du corps ----------------
     Corps : sphère r 0.78 aplatie, centre y 0.78 (bas ≈0.1, ne touche pas le sol).
     Pieds : SOUS le corps (sommet 0.32 vs bas corps 0.15 => joint).
     Ventre/oeil : DEVANT +Z sur la surface. Cape : DERRIÈRE -Z décollée. Lance : main droite x=+1.1.
  */
  function makeCorhog(x,y,z){
    const g=new THREE.Group();
    const purp=M(0x7a3cff,{roughness:0.5});
    const body=new THREE.Mesh(geo("cbody",()=>new THREE.SphereGeometry(0.78,16,14)),purp);
    body.position.y=0.82; body.scale.set(1,0.88,1.05); body.castShadow=true; g.add(body);
    // ventre clair collé devant (+Z) : surface z≈0.82, centre ventre z=0.72 (moitié dedans = patch)
    const belly=new THREE.Mesh(geo("cbelly",()=>new THREE.SphereGeometry(0.46,12,10)),M(0xc9b8ff,{roughness:0.5}));
    belly.position.set(0,0.62,0.62); belly.scale.set(0.78,0.66,0.4); g.add(belly);
    // pieds : boudins sous le corps, pas dedans
    const footGeo=geo("cfoot",()=>new THREE.SphereGeometry(0.27,8,8));
    const footM=M(0x4a2390);
    [-0.34,0.34].forEach(dx=>{
      const f=new THREE.Mesh(footGeo,footM); f.position.set(dx,0.16,0.12); f.scale.set(1,0.6,1.35); f.castShadow=true; g.add(f);
    });
    // oeil DEVANT : base du cône posée sur la surface (z≈0.78), pointe vers l'avant
    const eye=new THREE.Mesh(geo("ceye",()=>new THREE.ConeGeometry(0.28,0.55,10)),BM(0xffe62e));
    eye.position.set(0,1.18,0.72); eye.rotation.x=Math.PI/2-0.25; g.add(eye); // pointe +Z
    const pup=new THREE.Mesh(geo("cpup",()=>new THREE.SphereGeometry(0.09,8,8)),BM(0xcc0022));
    pup.position.set(0,1.22,1.0); g.add(pup); // au bout de l'oeil, dans le vide
    // bandeau : anneau autour du haut, rayon 0.5 > corps 0.78*? non : corps r haut ≈0.5 à y 1.35, anneau 0.52 = posé
    const band=new THREE.Mesh(geo("cband",()=>new THREE.TorusGeometry(0.42,0.1,8,16)),M(0xff2e6a));
    band.position.set(0,1.38,0.05); band.rotation.x=Math.PI/2-0.25; g.add(band);
    const knot=new THREE.Mesh(geo("cknot",()=>new THREE.BoxGeometry(0.18,0.18,0.34)),M(0xff2e6a));
    knot.position.set(0.42,1.36,0.3); knot.rotation.y=0.5; g.add(knot); // flot hors tête
    // cape : DERRIÈRE (-Z), décollée de 0.25 (surface -0.82, cape à -1.0)
    const cape=new THREE.Mesh(geo("ccape",()=>new THREE.PlaneGeometry(0.85,1.0,1,4)),M(0x2a1350,{side:THREE.DoubleSide,roughness:0.9}));
    cape.position.set(0,0.95,-1.02); cape.rotation.x=-0.3; cape.rotation.y=Math.PI; g.add(cape);
    // LANCE tenue à droite : main en (1.02, 1.0, 0.25) hors corps (corps x max 0.78)
    const hand=new THREE.Mesh(geo("chand",()=>new THREE.SphereGeometry(0.17,8,8)),M(0x4a2390));
    hand.position.set(1.02,1.0,0.25); g.add(hand);
    const spear=new THREE.Group();
    const stick=new THREE.Mesh(geo("stick",()=>new THREE.CylinderGeometry(0.06,0.06,2.5,8)),M(0x6a3a1a,{roughness:0.9}));
    stick.rotation.x=Math.PI/2; // le long de Z (avant/arrière), PAS à travers le corps
    stick.castShadow=true; spear.add(stick);
    const tip=new THREE.Mesh(geo("stip",()=>new THREE.ConeGeometry(0.3,0.7,8)),M(0xb9c2cc,{metalness:0.7,roughness:0.25}));
    tip.position.set(0,0,1.55); tip.rotation.x=Math.PI/2; tip.castShadow=true; spear.add(tip); // pointe +Z devant
    const butt=new THREE.Mesh(geo("sbutt",()=>new THREE.SphereGeometry(0.09,6,6)),M(0x333333));
    butt.position.set(0,0,-1.25); spear.add(butt);
    const gem=new THREE.Mesh(geo("sgem",()=>new THREE.SphereGeometry(0.11,8,8)),BM(0x4dd8ff));
    gem.position.set(0,0.12,0.9); spear.add(gem); // sur le manche, devant la main
    spear.position.set(1.02,1.0,0.25); spear.rotation.y=-0.15;
    g.add(spear);
    g.position.set(x,y,z); scene.add(g);
    list.push({type:"Corhog",mesh:g,spear,cape,hand,hp:2,baseX:x,baseZ:z,baseY:y,baseScale:1,
      t:Math.random()*6,speed:3.4,hitCd:0,dead:false,r:0.95});
  }

  function groundSafe(x,z,curY){
    const g=World.groundHeightAt(x,z,curY+1.2);
    if(!g||g.y<-500) return null;
    if(g.type==="lava"||g.type==="water"||g.type==="void") return null;
    if(Math.abs(g.y-curY)>3.2) return null;
    return g;
  }

  window.EnemiesSys = {
    list, projectiles,
    spawnAll(sc){
      scene=sc;
      // vide si re-spawn (stabilité)
      while(list.length) list.pop();
      while(projectiles.length){ const p=projectiles.pop(); if(p.mesh&&p.mesh.parent) p.mesh.parent.remove(p.mesh); }
      makeBloup(-4,0,-20); makeBloup(5,0,-35); makeBloup(0,0,-52);
      makeCorhog(4,0,-85); makeBloup(-5,0,-95); makeCorhog(-4,0,-115);
      makeBloup(5,-0.2,-141); makeBloup(-4,-0.2,-154);
      makeGoldonax(6,0.4,-215); makeGoldonax(-5,2.9,-226); makeBloup(0,3.2,-238);
      makeGoldonax(-6,0,-272); makeCorhog(5,0,-290); makeBloup(3,0,-305); makeGoldonax(-3,0,-315);
      makeCorhog(-5,0,-350); makeBloup(5,0,-365); makeGoldonax(0,0,-380);
      for(const e of list){
        const gh=World.groundHeightAt(e.mesh.position.x,e.mesh.position.z,12);
        if(gh.y>-900){ e.mesh.position.y=gh.y; e.baseY=gh.y; }
      }
    },
    throwRock(from,target){
      if(projectiles.length>=MAX_PROJ) return; // plafond (stabilité)
      const m=new THREE.Mesh(geo("rock",()=>new THREE.SphereGeometry(0.36,10,10)),M(0x4a4a52,{roughness:1,flatShading:true}));
      m.position.copy(from); m.castShadow=true; scene.add(m);
      // PAS de PointLight par projectile (coûtait 1 lumière chacun !)
      _tmpA.copy(target).sub(from); _tmpA.y+=3;
      const l=_tmpA.length()||1; _tmpA.multiplyScalar(13/l);
      projectiles.push({mesh:m,vel:new THREE.Vector3(_tmpA.x,7.5,_tmpA.z),life:4,
        sx:(Math.random()*6-3),sy:(Math.random()*6-3)});
    },
    damage(e,dmg){
      e.hp-=dmg; e.hitCd=0.35;
      const b=e.baseScale||1;
      e.mesh.scale.set(b*1.3,b*0.65,b*1.3);
      setTimeout(()=>{ if(!e.dead) e.mesh.scale.setScalar(b); },130);
      if(e.hp<=0){
        e.dead=true;
        if(e.mesh.parent) e.mesh.parent.remove(e.mesh);
        Effects.dust(e.mesh.position,0xffffff,14,6,7);
        Effects.ring(e.mesh.position,0xffcf2e);
        return true;
      }
      return false;
    },
    update(dt,t,P){
      for(let ei=0;ei<list.length;ei++){
        const e=list[ei];
        if(e.dead) continue;
        e.t+=dt; if(e.hitCd>0)e.hitCd-=dt;
        const ep=e.mesh.position;
        const dx=P.pos.x-ep.x, dz=P.pos.z-ep.z;
        const distP=Math.sqrt(dx*dx+dz*dz);
        if(e.type==="Bloup"){
          const nextX=e.baseX+Math.sin(e.t*0.9)*e.range;
          const gs=groundSafe(nextX,e.baseZ,ep.y);
          if(gs){ ep.x=nextX; ep.y+=(gs.y-ep.y)*Math.min(1,dt*8); }
          else e.t+=Math.PI;
          e.mesh.rotation.y=Math.cos(e.t*0.9)*0.6;
          const sq=0.76+Math.abs(Math.sin(e.t*6))*0.12;
          e.slime.scale.set(1.28,sq,1.0);
        }else if(e.type==="Corhog"){
          if(distP<9.5&&distP>0.001){
            const inv=1/distP;
            const nx=ep.x+dx*inv*e.speed*dt, nz=ep.z+dz*inv*e.speed*dt;
            const gs=groundSafe(nx,nz,ep.y);
            if(gs){ ep.x=Math.max(-12,Math.min(12,nx)); ep.z=nz; ep.y+=(gs.y-ep.y)*Math.min(1,dt*8); }
            e.mesh.rotation.y=Math.atan2(dx,dz); // +Z vers joueur, pas de retournement
            if(e.spear) e.spear.rotation.x=Math.sin(e.t*9)*0.18; // petit geste, la lance reste hors corps
            if(P.onGround&&((ei+t*10)|0)%20===0) Effects.dust(ep,0xcfc0ff,1,2,2);
          }else{
            const nx=e.baseX+Math.sin(e.t*0.7)*2, nz=e.baseZ+Math.cos(e.t*0.5)*2;
            const gs=groundSafe(nx,nz,ep.y);
            if(gs){ ep.x=nx; ep.z=nz; ep.y+=(gs.y-ep.y)*Math.min(1,dt*6); }
            e.mesh.rotation.y=Math.sin(e.t*0.7)*0.5;
          }
          if(e.cape){
            const cp=e.cape.geometry.attributes.position;
            for(let i=0;i<cp.count;i++){ const y=cp.getY(i); cp.setZ(i,Math.sin(t*6+y*5)*0.1); }
            cp.needsUpdate=true;
          }
        }else{ // Goldonax : fixe, pivote juste la tête ? on pivote tout le corps (pieds fixes OK car y reste)
          e.mesh.rotation.y=Math.atan2(dx,dz);
          const bob=Math.sin(e.t*2)*0.12;
          if(e.armL){ e.armL.position.y=1.7+bob; e.armR.position.y=1.7-bob; }
          if(e.fistL){ e.fistL.position.y=1.0+bob; e.fistR.position.y=1.0-bob; }
          e.shootT-=dt;
          if(e.shootT<0.6&&e.shootT>0&&e.armR) e.armR.position.y=2.5; // télégraphe bras levé
          if(e.shootT<=0&&distP<27&&distP>0.5&&Math.abs(P.pos.y-ep.y)<9){
            e.shootT=2.7;
            if(e.armR) e.armR.position.y=2.3;
            _tmpB.copy(ep); _tmpB.y+=3.6;
            _tmpA.copy(P.pos);
            this.throwRock(_tmpB,_tmpA);
            AudioSys.throwRock();
          }
        }
      }
      // projectiles : zéro allocation chaude (vecteurs réutilisés)
      for(let i=projectiles.length-1;i>=0;i--){
        const pr=projectiles[i];
        pr.life-=dt; pr.vel.y-=19*dt;
        pr.mesh.position.x+=pr.vel.x*dt; pr.mesh.position.y+=pr.vel.y*dt; pr.mesh.position.z+=pr.vel.z*dt;
        pr.mesh.rotation.x+=pr.sx*dt; pr.mesh.rotation.y+=pr.sy*dt;
        const px=pr.mesh.position.x-P.pos.x, py=pr.mesh.position.y-(P.pos.y+1.1), pz=pr.mesh.position.z-P.pos.z;
        const d2=px*px+py*py+pz*pz;
        if(d2<1.32&&P.invuln<=0){
          scene.remove(pr.mesh); projectiles.splice(i,1);
          window.__hurtPlayer(1,pr.mesh.position);
          continue;
        }
        const gh=World.groundHeightAt(pr.mesh.position.x,pr.mesh.position.z,pr.mesh.position.y+1);
        if((gh.y>-900&&pr.mesh.position.y<=gh.y+0.2)||pr.life<=0||pr.mesh.position.y<-4){
          Effects.dust(pr.mesh.position,0x888888,6,4,4);
          scene.remove(pr.mesh); projectiles.splice(i,1);
        }
      }
    }
  };
})();
