/* ===== JOUEUR — Noam deluxe : hoodie, écharpe, réacteur, animations ===== */
(function(){
  let scene=null;
  const group=new THREE.Group();
  const parts={};
  const P={
    pos:new THREE.Vector3(0,0.5,-2), vel:new THREE.Vector3(),
    yaw:Math.PI, onGround:true, groundType:"normal",
    speedRun:0, jumpChain:0, lastLand:-9, coyote:0, airJumps:1,
    crouch:false, floatEnergy:1, floating:false,
    pounding:false, punchCd:0, invuln:0, hearts:3,
    backflipT:0, runTime:0, dead:false, finished:false,
    checkpoint:new THREE.Vector3(0,0.5,-2), zoneIdx:0,
  };
  let blob=null, reactorFlame=null, reactorLight=null;

  function M(color,opts){ return new THREE.MeshStandardMaterial(Object.assign({color,roughness:0.65,metalness:0.05},opts||{})); }

  window.PlayerSys = {
    group, parts, P,
    create(sc){
      scene=sc;
      // jambes + chaussures
      parts.legL=new THREE.Group(); parts.legR=new THREE.Group();
      [[parts.legL,-0.22],[parts.legR,0.22]].forEach(([leg,x])=>{
        const pant=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.19,0.55,10), M(0x2a3560)); pant.position.y=0.62; pant.castShadow=true;
        const shoe=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.2,0.5), M(0xff3842,{roughness:0.4})); shoe.position.set(0,0.12,-0.06); shoe.castShadow=true;
        const sole=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.07,0.52), M(0xffffff)); sole.position.set(0,0.035,-0.06);
        leg.add(pant,shoe,sole); leg.position.set(x,0,0); group.add(leg);
      });
      // corps hoodie bleu
      const body=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.5,0.85,14), M(0x2e7bff,{roughness:0.55}));
      body.position.y=1.25; body.castShadow=true; group.add(body); parts.body=body;
      const pocket=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.25,0.12), M(0x1e5fd6)); pocket.position.set(0,1.05,-0.44); group.add(pocket);
      const zip=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.7,0.05), M(0xffffff)); zip.position.set(0,1.28,-0.47); group.add(zip);
      // bras + gants
      parts.armL=new THREE.Group(); parts.armR=new THREE.Group();
      [[parts.armL,-0.62],[parts.armR,0.62]].forEach(([arm,x])=>{
        const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.15,0.5,10), M(0x2e7bff)); sleeve.position.y=-0.2; sleeve.castShadow=true;
        const glove=new THREE.Mesh(new THREE.SphereGeometry(0.17,10,10), M(0xffffff,{roughness:0.4})); glove.position.y=-0.52; glove.castShadow=true;
        arm.add(sleeve,glove); arm.position.set(x,1.55,0); group.add(arm);
      });
      // poing éclair (frappe)
      parts.fist=new THREE.Mesh(new THREE.SphereGeometry(0.3,12,12),
        new THREE.MeshStandardMaterial({color:0xffcf2e,emissive:0xcc7700,emissiveIntensity:0.9}));
      parts.fist.position.set(0.62,1.1,-1.25); parts.fist.visible=false; group.add(parts.fist);
      // tête
      const head=new THREE.Mesh(new THREE.SphereGeometry(0.42,18,16), M(0xffc79a,{roughness:0.6}));
      head.position.y=2.05; head.castShadow=true; group.add(head); parts.head=head;
      // yeux + reflets
      const eyeW=new THREE.MeshBasicMaterial({color:0xffffff});
      const eyeB=new THREE.MeshBasicMaterial({color:0x141828});
      [-0.15,0.15].forEach(dx=>{
        const w=new THREE.Mesh(new THREE.SphereGeometry(0.11,10,10),eyeW); w.position.set(dx,2.1,-0.34); w.scale.z=0.5; group.add(w);
        const b=new THREE.Mesh(new THREE.SphereGeometry(0.055,8,8),eyeB); b.position.set(dx,2.1,-0.42); group.add(b);
        const hl=new THREE.Mesh(new THREE.SphereGeometry(0.02,6,6),new THREE.MeshBasicMaterial({color:0xffffff})); hl.position.set(dx+0.02,2.13,-0.46); group.add(hl);
      });
      // sourire
      const smileC=document.createElement("canvas"); smileC.width=64; smileC.height=32;
      const sg=smileC.getContext("2d"); sg.strokeStyle="#5a2a1a"; sg.lineWidth=5; sg.lineCap="round";
      sg.beginPath(); sg.arc(32,10,18,0.4,Math.PI-0.4); sg.stroke();
      const smileT=new THREE.CanvasTexture(smileC);
      const smile=new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.15), new THREE.MeshBasicMaterial({map:smileT,transparent:true}));
      smile.position.set(0,1.88,-0.415); smile.rotation.y=Math.PI; group.add(smile);
      // casquette rouge Speedway
      const cap=new THREE.Mesh(new THREE.SphereGeometry(0.45,16,12,0,Math.PI*2,0,Math.PI/2.1), M(0xe33d2e,{roughness:0.45}));
      cap.position.y=2.18; group.add(cap);
      const brim=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.07,0.5), M(0xb3241a)); brim.position.set(0,2.18,-0.58); group.add(brim);
      const bolt=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,8), M(0xffcf2e,{emissive:0xaa7700,emissiveIntensity:0.6})); bolt.position.y=2.62; group.add(bolt);
      // écharpe du speeder (flotte au vent !) : DERRIÈRE le sac (pas dedans)
      const scarfM=new THREE.MeshStandardMaterial({color:0xffcf2e,roughness:0.7,side:THREE.DoubleSide});
      const scarf=new THREE.Mesh(new THREE.PlaneGeometry(0.42,1.1,1,6), scarfM);
      scarf.position.set(0,1.92,0.74); scarf.rotation.x=0.5; scarf.castShadow=true; group.add(scarf);
      parts.scarf=scarf;
      const knot=new THREE.Mesh(new THREE.SphereGeometry(0.14,8,8), M(0xe33d2e)); knot.position.set(0,1.92,0.62); group.add(knot);
      // sac réacteur speeder
      const pack=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.65,0.3), M(0xffb02e,{roughness:0.35,metalness:0.35}));
      pack.position.set(0,1.35,0.5); pack.castShadow=true; group.add(pack);
      // tuyère : joint entre sac et flamme (la flamme ne sort plus du sac)
      const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,0.18,10), M(0x333844,{metalness:0.6,roughness:0.4}));
      nozzle.position.set(0,0.98,0.5); group.add(nozzle);
      reactorFlame=new THREE.Mesh(new THREE.ConeGeometry(0.16,0.55,10),
        new THREE.MeshBasicMaterial({color:0x4dd8ff,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false}));
      reactorFlame.position.set(0,0.62,0.5); reactorFlame.rotation.x=Math.PI; group.add(reactorFlame);
      parts.flame=reactorFlame;
      reactorLight=new THREE.PointLight(0x4dd8ff,0,6,2); reactorLight.position.set(0,1,0.8); group.add(reactorLight);
      // ombre blob
      blob=new THREE.Mesh(new THREE.CircleGeometry(0.75,20), new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.28,depthWrite:false}));
      blob.rotation.x=-Math.PI/2; scene.add(blob);

      scene.add(group);
      group.position.copy(P.pos);
    },
    animate(dt,t,speed){
      const run=speed;
      P.runTime+=dt*(2+run*1.2);
      const sw=Math.sin(P.runTime*2.2)*Math.min(1,run/7)*0.75;
      if(P.backflipT>0){ group.rotation.x-=dt*13; }
      else group.rotation.x=P.crouch&&P.onGround?0.35:(-Math.min(0.35,run*0.018));
      group.scale.y=(P.crouch&&P.onGround)?0.74:1;
      if(!P.onGround){
        if(P.pounding){ parts.armL.rotation.x=-0.4; parts.armR.rotation.x=-0.4; parts.legL.rotation.x=0.25; parts.legR.rotation.x=0.25; }
        else if(P.floating){ parts.armL.rotation.x=-2.7; parts.armR.rotation.x=-2.7; parts.legL.rotation.x=0.5; parts.legR.rotation.x=0.5; }
        else{ parts.armL.rotation.x=-2.5; parts.armR.rotation.x=-2.5; parts.legL.rotation.x=0.55; parts.legR.rotation.x=-0.45; }
      }else{
        parts.legL.rotation.x=sw; parts.legR.rotation.x=-sw;
        parts.armL.rotation.x=-sw*0.9; parts.armR.rotation.x=sw*0.9;
        if(P.punchCd>0.15) parts.armR.rotation.x=-1.9;
        if(P.crouch){ parts.legL.rotation.x=1.1; parts.legR.rotation.x=1.1; }
      }
      // écharpe ondule avec la vitesse
      const sp=parts.scarf.geometry.attributes.position;
      for(let i=0;i<sp.count;i++){
        const y=sp.getY(i);
        const k=(0.55-y); // plus loin = plus de vague
        sp.setZ(i,Math.sin(t*(6+run*0.9)+y*6)*0.16*k*(1+run*0.12));
      }
      sp.needsUpdate=true;
      parts.scarf.rotation.x=0.4+Math.min(1.1,run*0.09);
      // réacteur : flamme + lumière selon vitesse
      const f=0.4+ (run/CONFIG.topSpeed)*1.6 + (P.floating?0.5:0);
      parts.flame.scale.set(0.8,0.5+f,0.8);
      parts.flame.material.opacity=0.55+Math.random()*0.3;
      reactorLight.intensity=run>9?1.2:0.25;
      // invincibilité clignote
      group.visible=P.invuln>0?(Math.floor(performance.now()/90)%2===0):true;
    },
    syncShadow(groundY){
      if(!blob) return;
      blob.position.set(P.pos.x,groundY+0.06,P.pos.z);
      const h=Math.max(0,P.pos.y-groundY);
      blob.scale.setScalar(Math.max(0.15,1-h*0.11));
      blob.material.opacity=Math.max(0,0.3-h*0.028);
    }
  };
})();
