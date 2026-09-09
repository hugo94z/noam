/* ===== MONDE v2 — cohérent + deluxe : lane libre, barrières, chemin, vie ===== */
(function(){
  let scene=null;
  const platforms=[];
  const waters=[], lavas=[], lavaLights=[], clouds=[], flags=[], beams=[], floaters=[];
  const butterflies=[], gulls=[], fishes=[], bubbles=[], sparkles=[];
  let skyDome=null;
  let finishGroup=null, btnTop=null, btnTopMat=null;
  const _c1=new THREE.Color(), _c2=new THREE.Color();
  const LANE=5.5;      // demi-largeur de la piste de jeu (doit rester dégagée)
  const WALL_X=13.2;   // murs latéraux visibles (expliquent le blocage X)

  function mat(color, opts){
    opts=opts||{};
    return new THREE.MeshStandardMaterial(Object.assign({color, roughness:0.9, metalness:0.04}, opts));
  }
  function sideMat(tex, color){
    return new THREE.MeshStandardMaterial({map:tex||null, color:color||0xffffff, roughness:1});
  }
  // Sol avec dessus différent des côtés (style Mario, cohérent)
  function addGround(x,y,z,w,h,d, topMaterial, sideMaterial, type){
    const side=sideMaterial, top=topMaterial, bottom=mat(0x2a2018);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), [side,side,top,bottom,side,side]);
    mesh.position.set(x,y,z);
    mesh.receiveShadow=true; mesh.castShadow=false;
    scene.add(mesh);
    const p={mesh,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,top:y+h/2,type:type||"normal"};
    platforms.push(p);
    return p;
  }
  function addSolid(x,y,z,w,h,d,material,type){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
    mesh.position.set(x,y,z);
    mesh.receiveShadow=true; mesh.castShadow=(h>0.6);
    scene.add(mesh);
    const p={mesh,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,top:y+h/2,type:type||"normal"};
    platforms.push(p);
    return p;
  }
  function groundY(x,z){
    let best=-999;
    for(const p of platforms){
      if(x>=p.minX&&x<=p.maxX&&z>=p.minZ&&z<=p.maxZ){ if(p.top>best) best=p.top; }
    }
    return best;
  }
  function sideX(){ // position décor hors-piste, alternée
    const s=Math.random()<0.5?-1:1;
    return s*(7.6+Math.random()*4.2);
  }

  /* ---------- CIEL ---------- */
  function buildSky(){
    const geo=new THREE.SphereGeometry(430,24,16);
    const smat=new THREE.ShaderMaterial({
      side:THREE.BackSide, depthWrite:false, fog:false,
      uniforms:{ top:{value:new THREE.Color(0x3a8fd6)}, bottom:{value:new THREE.Color(0xcfeaff)} },
      vertexShader:"varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader:"uniform vec3 top; uniform vec3 bottom; varying vec3 vP;\
        void main(){ float h=normalize(vP).y*0.5+0.5; vec3 c=mix(bottom,top,smoothstep(0.02,0.65,h));\
        c+=vec3(1.0,0.93,0.75)*pow(max(0.0,dot(normalize(vP),normalize(vec3(0.45,0.5,-0.6)))),24.0)*0.9;\
        gl_FragColor=vec4(c,1.0); }"
    });
    skyDome=new THREE.Mesh(geo,smat);
    scene.add(skyDome);
    // socle lointain pour boucher le vide sous le monde
    const far=new THREE.Mesh(new THREE.BoxGeometry(300,2,600), mat(0x1d3a2a,{roughness:1}));
    far.position.set(0,-6,-190); scene.add(far);
    // anneau de montagnes lointaines (silhouettes)
    const farM=mat(0x6a7f9a,{roughness:1,flatShading:true});
    for(let i=0;i<22;i++){
      const a=(i/22)*Math.PI*2;
      const r=210+Math.random()*60;
      const h=26+Math.random()*30;
      const m=new THREE.Mesh(new THREE.ConeGeometry(20+Math.random()*14,h,5), farM);
      m.position.set(Math.cos(a)*r, h/2-6, -190+Math.sin(a)*r);
      scene.add(m);
    }
    // nuages
    const cloudMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,transparent:true,opacity:0.94});
    for(let i=0;i<16;i++){
      const grp=new THREE.Group();
      const n=3+((Math.random()*3)|0);
      for(let k=0;k<n;k++){
        const s=new THREE.Mesh(new THREE.SphereGeometry(2+Math.random()*2.4,10,8),cloudMat);
        s.position.set(k*3-n*1.4+Math.random(),Math.random()*1.1,Math.random()*2);
        s.scale.y=0.55; grp.add(s);
      }
      grp.position.set((Math.random()-0.5)*170,34+Math.random()*22,-20-Math.random()*390);
      const sc2=1+Math.random()*1.6; grp.scale.set(sc2,sc2,sc2);
      scene.add(grp);
      clouds.push({g:grp,sp:0.4+Math.random()*0.9});
    }
  }

  /* ---------- PROPS (tous posés AU SOL, hors-piste sauf mini) ---------- */
  function grassTuft(x,z){
    const y=groundY(x,z); if(y<-50)return;
    const g=new THREE.Group();
    for(let i=0;i<5;i++){
      const b=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.5+Math.random()*0.4,5), mat(0x2e8f2e));
      b.position.set((Math.random()-0.5)*0.5,0.25,(Math.random()-0.5)*0.5);
      b.rotation.z=(Math.random()-0.5)*0.4; g.add(b);
    }
    g.position.set(x,y,z); scene.add(g);
  }
  function flower(x,z,color){
    const y=groundY(x,z); if(y<-50)return;
    const g=new THREE.Group();
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.6,6), mat(0x2e7d22)); stem.position.y=0.3; g.add(stem);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,8), mat(color||0xff5d8a,{roughness:0.5})); head.position.y=0.65; head.castShadow=true; g.add(head);
    const heart=new THREE.Mesh(new THREE.SphereGeometry(0.07,6,6), mat(0xffcf2e)); heart.position.set(0,0.65,0.13); g.add(heart);
    g.position.set(x,y,z); scene.add(g);
  }
  function tree(x,z,s){
    s=s||1; const y=groundY(x,z); if(y<-50)return;
    const g=new THREE.Group();
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.28*s,0.44*s,1.9*s,9), mat(0x7a4a21,{roughness:1}));
    trunk.position.y=0.95*s; trunk.castShadow=true; g.add(trunk);
    const greens=[0x2e9e44,0x37b34f,0x25803a];
    for(let i=0;i<3;i++){
      const cone=new THREE.Mesh(new THREE.ConeGeometry((1.75-i*0.42)*s,1.55*s,9), mat(greens[i%3],{roughness:0.85,flatShading:true}));
      cone.position.y=(2.1+i*1.05)*s; cone.castShadow=true; g.add(cone);
    }
    g.position.set(x,y,z); scene.add(g);
  }
  function palm(x,z){
    const y=groundY(x,z); if(y<-50)return;
    const g=new THREE.Group();
    let px=0;
    for(let i=0;i<4;i++){
      const t=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.27,1.15,8), mat(0x9a6a35,{roughness:1}));
      t.position.set(px,0.55+i*1.0,0); t.rotation.z=0.13; t.castShadow=true; g.add(t); px+=0.13;
    }
    for(let i=0;i<6;i++){
      const leaf=new THREE.Mesh(new THREE.SphereGeometry(1.15,8,6), mat(i%2?0x2fbf5a:0x27a84e,{roughness:0.8}));
      leaf.scale.set(1.5,0.22,0.55);
      const a=i/6*Math.PI*2;
      leaf.position.set(px+Math.cos(a)*1.35,4.35,Math.sin(a)*1.35);
      leaf.rotation.y=-a; leaf.castShadow=true; g.add(leaf);
    }
    [[0.2,4.0,0.1],[-0.15,4.0,-0.1]].forEach(p=>{
      const c=new THREE.Mesh(new THREE.SphereGeometry(0.26,8,8),mat(0x5a3a1a)); c.position.set(px+p[0],p[1],p[2]); c.castShadow=true; g.add(c);
    });
    g.position.set(x,y,z); scene.add(g);
  }
  function snowPine(x,z,s){
    s=s||1; const y=groundY(x,z); if(y<-50)return;
    const g=new THREE.Group();
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.24*s,0.33*s,1.2*s,8), mat(0x5a3a22)); trunk.position.y=0.6*s; trunk.castShadow=true; g.add(trunk);
    for(let i=0;i<3;i++){
      const c=new THREE.Mesh(new THREE.ConeGeometry((1.5-i*0.32)*s,1.35*s,9), mat(0x2a7d4f,{flatShading:true})); c.position.y=(1.55+i*0.92)*s; c.castShadow=true; g.add(c);
      const sn=new THREE.Mesh(new THREE.ConeGeometry((1.5-i*0.32)*s*0.62,0.55*s,9), mat(0xffffff,{roughness:0.6})); sn.position.y=(2.0+i*0.92)*s; g.add(sn);
    }
    g.position.set(x,y,z); scene.add(g);
  }
  function snowman(x,z){
    const y=groundY(x,z); if(y<-50)return;
    const g=new THREE.Group();
    const wm=mat(0xffffff,{roughness:0.55});
    const b1=new THREE.Mesh(new THREE.SphereGeometry(0.95,14,12),wm); b1.position.y=0.9; b1.castShadow=true;
    const b2=new THREE.Mesh(new THREE.SphereGeometry(0.68,14,12),wm); b2.position.y=2.15; b2.castShadow=true;
    const h=new THREE.Mesh(new THREE.SphereGeometry(0.46,14,12),wm); h.position.y=3.05; h.castShadow=true;
    g.add(b1,b2,h);
    const eyeM=new THREE.MeshBasicMaterial({color:0x111111});
    [-0.15,0.15].forEach(dx=>{ const e=new THREE.Mesh(new THREE.SphereGeometry(0.06,6,6),eyeM); e.position.set(dx,3.15,0.4); g.add(e); });
    const nose=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.45,8), mat(0xff7a2e)); nose.position.set(0,3.05,0.6); nose.rotation.x=Math.PI/2; g.add(nose);
    const scarf=new THREE.Mesh(new THREE.TorusGeometry(0.4,0.13,8,16), mat(0xe33d2e)); scarf.position.y=2.65; scarf.rotation.x=Math.PI/2; g.add(scarf);
    g.position.set(x,y,z); scene.add(g);
  }
  function crystal(x,z,color){
    const y=groundY(x,z); if(y<-50) return;
    const m=new THREE.Mesh(new THREE.OctahedronGeometry(0.5+Math.random()*0.45),
      new THREE.MeshStandardMaterial({color:color||0x7ad4ff,roughness:0.15,metalness:0.1,transparent:true,opacity:0.92,emissive:color||0x226688,emissiveIntensity:0.4}));
    m.position.set(x,y+0.7,z); m.castShadow=true; m.rotation.y=Math.random()*3;
    scene.add(m); floaters.push({m,baseY:m.position.y,ph:Math.random()*6});
  }
  function coral(x,z,color){
    const g=new THREE.Group();
    for(let i=0;i<3;i++){
      const c=new THREE.Mesh(new THREE.ConeGeometry(0.28,1+Math.random()*0.9,7), mat(color,{roughness:0.7,emissive:color,emissiveIntensity:0.18}));
      c.position.set((Math.random()-0.5)*0.8,0.5,(Math.random()-0.5)*0.8); c.castShadow=true; g.add(c);
    }
    g.position.set(x,-1.9,z); scene.add(g); // sous l'eau, au fond
  }
  function rockSpike(x,z,color,s){
    s=s||1; const y=groundY(x,z); if(y<-50)return;
    const m=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0), mat(color,{roughness:1,flatShading:true}));
    m.position.set(x,y+s*0.45,z); m.rotation.set(Math.random()*3,Math.random()*3,0);
    m.castShadow=true; m.receiveShadow=true; scene.add(m);
  }
  function torchPillar(x,z,withLight){
    const y=groundY(x,z); if(y<-50)return;
    const p=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.48,2.6,8), mat(0x2c2c34)); p.position.set(x,y+1.3,z); p.castShadow=true; scene.add(p);
    const bowl=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.3,0.4,8), mat(0x1a1a20)); bowl.position.set(x,y+2.75,z); scene.add(bowl);
    const f=new THREE.Mesh(new THREE.SphereGeometry(0.34,10,10), new THREE.MeshBasicMaterial({color:0xffb02e})); f.position.set(x,y+3.1,z); scene.add(f);
    // PERF : seulement 1 torche sur 2 a une vraie lumière, les autres = flamme émissive
    if(withLight){
      const li=new THREE.PointLight(0xff8a2e,1.1,13,2); li.position.set(x,y+3.2,z); scene.add(li);
      lavaLights.push({li,base:1.1,ph:Math.random()*6});
    }
    floaters.push({m:f,baseY:y+3.1,ph:Math.random()*6,flame:true});
  }
  function fenceRun(x,z0,z1,woodM){
    for(let z=z0;z>z1;z-=3){
      const y=groundY(x,z); if(y<-50)continue;
      const post=new THREE.Mesh(new THREE.BoxGeometry(0.22,1.1,0.22), woodM);
      post.position.set(x,y+0.55,z); post.castShadow=true; scene.add(post);
      if(z-1.5>z1){
        const rail=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.14,3.1), woodM);
        rail.position.set(x,y+0.85,z-1.5); scene.add(rail);
      }
    }
  }
  function barrierWall(x,z0,z1,material,h){
    h=h||2.2;
    const len=z0-z1, zc=(z0+z1)/2;
    const m=new THREE.Mesh(new THREE.BoxGeometry(1.2,h,len), material);
    m.position.set(x,h/2-0.2,zc); m.receiveShadow=true; m.castShadow=true; scene.add(m);
    const trim=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.3,len), mat(0xffffff,{roughness:0.6}));
    trim.position.set(x,h-0.1,zc); scene.add(trim);
  }
  function buoy(x,z){
    const g=new THREE.Group();
    const b=new THREE.Mesh(new THREE.SphereGeometry(0.55,10,10), mat(0xff4d4d,{roughness:0.5})); b.position.y=0; b.castShadow=true;
    const stripe=new THREE.Mesh(new THREE.CylinderGeometry(0.56,0.56,0.25,10), mat(0xffffff)); stripe.position.y=0.1; g.add(b,stripe);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(0.15,0.5,8), mat(0x333333)); tip.position.y=0.85; g.add(tip);
    g.position.set(x,-0.9,z); scene.add(g);
    floaters.push({m:g,baseY:-0.9,ph:x,flame:false,buoy:true});
  }

  /* ---------- VIE AMBIANTE ---------- */
  function butterfly(x,y,z,color){
    const g=new THREE.Group();
    const wm=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});
    const w1=new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.4),wm); w1.position.x=-0.15;
    const w2=w1.clone(); w2.position.x=0.15;
    g.add(w1,w2); g.position.set(x,y,z); scene.add(g);
    butterflies.push({g,w1,w2,cx:x,cy:y,cz:z,ph:Math.random()*10,sp:0.5+Math.random()});
  }
  function gull(x,y,z){
    const g=new THREE.Group();
    const m=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide});
    const w1=new THREE.Mesh(new THREE.PlaneGeometry(1.1,0.3),m); w1.position.x=-0.5;
    const w2=w1.clone(); w2.position.x=0.5;
    g.add(w1,w2); g.position.set(x,y,z); scene.add(g);
    gulls.push({g,w1,w2,cx:x,cy:y,cz:z,ph:Math.random()*10,r:6+Math.random()*8,sp:0.3+Math.random()*0.3});
  }
  function fish(x,z,color){
    const g=new THREE.Group();
    const b=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.8,8), mat(color,{roughness:0.5}));
    b.rotation.x=Math.PI/2; g.add(b);
    const tail=new THREE.Mesh(new THREE.ConeGeometry(0.2,0.4,6), mat(color)); tail.rotation.x=-Math.PI/2; tail.position.z=0.55; g.add(tail);
    g.position.set(x,-1.3,z); scene.add(g);
    fishes.push({g,cx:x,cz:z,ph:Math.random()*10,r:2+Math.random()*2.5});
  }

  /* ---------- CONSTRUCTION ---------- */
  window.World = {
    platforms, waters, lavas,
    finishGroup:null, btnTop:null, btnTopMat:null,
    build(sc){
      scene=sc;
      buildSky();
      const grassTop=new THREE.MeshStandardMaterial({map:TEX.grass,roughness:0.95});
      const dirtSide=new THREE.MeshStandardMaterial({map:TEX.dirt,roughness:1});
      const sandTop=new THREE.MeshStandardMaterial({map:TEX.sand,roughness:1});
      const sandSide=new THREE.MeshStandardMaterial({map:TEX.dirt,color:0xe0c080,roughness:1});
      const rockTop=new THREE.MeshStandardMaterial({map:TEX.rock,roughness:1});
      const rockSide=new THREE.MeshStandardMaterial({map:TEX.rock,color:0x9a9aa2,roughness:1});
      const darkTop=new THREE.MeshStandardMaterial({map:TEX.dark,roughness:1});
      const darkSide=new THREE.MeshStandardMaterial({color:0x0c0c10,roughness:1});
      const snowTop=new THREE.MeshStandardMaterial({map:TEX.snow,roughness:0.85});
      const snowSide=new THREE.MeshStandardMaterial({map:TEX.dirt,color:0xbcd0e8,roughness:1});
      const woodM=mat(0x8a5a26,{roughness:0.9});
      const stoneM=mat(0x9aa5ad,{roughness:0.9});

      // ===== 1. PLAINES (z 12 → -70) =====
      addGround(0,-1,-29,26,2,86, grassTop, dirtSide,"normal");
      // chemin guide central
      const pathM=new THREE.MeshStandardMaterial({map:TEX.path,roughness:1});
      const path1=new THREE.Mesh(new THREE.PlaneGeometry(4.6,80), pathM);
      path1.rotation.x=-Math.PI/2; path1.position.set(0,0.03,-29); path1.receiveShadow=true; scene.add(path1);
      barrierWall(-WALL_X,12,-70, mat(0x4a7a3a,{roughness:1}),2.0);
      barrierWall( WALL_X,12,-70, mat(0x4a7a3a,{roughness:1}),2.0);
      fenceRun(-7.2,8,-66,woodM); fenceRun(7.2,8,-66,woodM);

      // ===== 2. PLAGES (z -70 → -130) =====
      addGround(0,-1,-100,26,2,62, sandTop, sandSide,"sand");
      const path2=new THREE.Mesh(new THREE.PlaneGeometry(4.6,56), pathM.clone());
      path2.material.map=TEX.path.clone(); path2.material.map.needsUpdate=true;
      path2.rotation.x=-Math.PI/2; path2.position.set(0,0.03,-100); path2.receiveShadow=true; scene.add(path2);
      barrierWall(-WALL_X,-70,-130, mat(0xd9b45e,{roughness:1}),1.6);
      barrierWall( WALL_X,-70,-130, mat(0xd9b45e,{roughness:1}),1.6);
      // parasols rangés sur les côtés (cohérents, hors-piste)
      [[-9,-82],[9,-92],[-9,-104],[9,-116]].forEach(([px,pz],i)=>{
        const y=groundY(px,pz);
        const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,2.6,8), mat(0xffffff)); pole.position.set(px,y+1.3,pz); pole.castShadow=true; scene.add(pole);
        const top=new THREE.Mesh(new THREE.ConeGeometry(1.7,0.95,10), mat(i%2?0xff5d5d:0x4dd8ff,{roughness:0.6})); top.position.set(px,y+2.8,pz); top.castShadow=true; scene.add(top);
        const towel=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.08,2), mat(i%2?0x4dd8ff:0xffcf2e)); towel.position.set(px+1.6,y+0.06,pz+0.5); towel.receiveShadow=true; scene.add(towel);
      });

      // ===== 3. AQUATIQUE (z -130 → -190) : mer + plots alignés =====
      const waterM=new THREE.MeshStandardMaterial({map:TEX.water,transparent:true,opacity:0.88,roughness:0.22,metalness:0.3});
      const sea=new THREE.Mesh(new THREE.BoxGeometry(46,1,68,14,1,14), waterM);
      sea.position.set(0,-1.75,-160); sea.receiveShadow=true; scene.add(sea);
      waters.push(sea);
      addSolid(0,-2.7,-160,46,0.6,68,mat(0xc9a86a),"water"); // fond sableux
      const plots=[[-5,-136],[4,-142],[-4,-149],[5,-155],[-4,-162],[4,-169],[-2,-176],[0,-184]];
      plots.forEach(([x,z],i)=>{
        addSolid(x,-0.55,z,5.4,1.5,5.4,sandTop,"normal");
        addSolid(x,0.32,z,3.6,0.35,3.6,stoneM);
        if(i%2===0) addSolid(x,1.75,z-0.4,2.4,0.6,2.4,new THREE.MeshStandardMaterial({map:TEX.wood,roughness:0.9}));
        // anneau d'écume cohérent autour du plot
        const foam=new THREE.Mesh(new THREE.TorusGeometry(3.4,0.28,8,24), new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.75}));
        foam.rotation.x=Math.PI/2; foam.position.set(x,-1.15,z); scene.add(foam);
        floaters.push({m:foam,baseY:-1.15,ph:i,flame:false});
        // flèche guide sur le plot
        const chev=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.0),
          new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.85}));
        chev.rotation.x=-Math.PI/2; chev.rotation.z=Math.PI; chev.position.set(x,0.52,z+0.8); scene.add(chev);
        if(i<plots.length-1) buoy(x+4.5,z-3.5);
        coral(x+6,-1.9,z+2,[0xff6a9a,0xff9a3d,0xb46aff][i%3]);
        fish(x-3,z-1,[0xff9a3d,0x4dd8ff,0xffe62e][i%3]);
      });

      // ===== 4. MONTAGNES (z -190 → -260) =====
      addGround(0,-1,-225,26,2,72, rockTop, rockSide,"normal");
      // blocs d'escalade CENTRÉS et espacés (parkour lisible)
      const climb=[[-4,0.4,-203,5], [4,1.4,-213,5.5], [-4,2.4,-224,5.5], [4,3.4,-236,6], [0,1.2,-248,7]];
      climb.forEach(([x,y,z,s])=>{
        addSolid(x,y,z,s,Math.max(2,y*2+1.4),s,rockTop);
        const cap=new THREE.Mesh(new THREE.BoxGeometry(s+0.3,0.45,s+0.3), snowTop);
        cap.position.set(x,y+Math.max(2,y*2+1.4)/2+0.2,z); cap.receiveShadow=true; cap.castShadow=true; scene.add(cap);
      });
      // pics de fond (hors-piste, loin)
      for(let i=0;i<8;i++){
        const px=-34+i*9, pz=-198-Math.random()*52;
        const h=15+Math.random()*13;
        const peak=new THREE.Mesh(new THREE.ConeGeometry(7.5,h,6), rockTop);
        peak.position.set(px,h/2-2,pz); scene.add(peak);
        const capS=new THREE.Mesh(new THREE.ConeGeometry(2.7,4.2,6), snowTop);
        capS.position.set(px,h-3.8,pz); scene.add(capS);
      }
      barrierWall(-WALL_X,-190,-260, rockSide,2.6);
      barrierWall( WALL_X,-190,-260, rockSide,2.6);

      // ===== 5. LAVE (z -260 → -330) =====
      addGround(0,-1,-295,26,2,72, darkTop, darkSide,"dark");
      const lavaM=new THREE.MeshStandardMaterial({map:TEX.lava,emissive:0xff4400,emissiveMap:TEX.lava,emissiveIntensity:1.5,roughness:0.55});
      function lavaPool(x,z,w,d){
        const m=new THREE.Mesh(new THREE.BoxGeometry(w,0.35,d), lavaM);
        m.position.set(x,-0.62,z); scene.add(m); lavas.push(m);
        addSolid(x,-0.85,z,w,d,0.3,mat(0x000000),"lava");
        const li=new THREE.PointLight(0xff5a00,1.5,20); li.position.set(x,1.6,z); scene.add(li);
        lavaLights.push({li,base:1.5,ph:x+z});
        // croûtes noires flottantes (cohérence : lave pas uniforme)
        for(let i=0;i<3;i++){
          const crust=new THREE.Mesh(new THREE.BoxGeometry(1+Math.random()*1.6,0.12,1+Math.random()*1.4), darkSide);
          crust.position.set(x+(Math.random()-0.5)*(w-2),-0.4,z+(Math.random()-0.5)*(d-2));
          crust.rotation.y=Math.random()*3; scene.add(crust);
          floaters.push({m:crust,baseY:-0.4,ph:Math.random()*6,flame:false});
          const bub=new THREE.Mesh(new THREE.SphereGeometry(0.3+Math.random()*0.3,8,8),
            new THREE.MeshBasicMaterial({color:0xffcf2e,transparent:true,opacity:0.9}));
          bub.position.set(x+(Math.random()-0.5)*w,-0.35,z+(Math.random()-0.5)*d); scene.add(bub);
          bubbles.push({m:bub,ph:Math.random()*6});
        }
      }
      lavaPool(-5.5,-280,8,10); lavaPool(6,-295,9,12); lavaPool(-4,-312,10,10);
      // îlots sûrs BIEN espacés (sauts lisibles, pas dans la lave)
      addSolid(-5.5,0.1,-285,3.2,1.8,3.2,darkTop);
      addSolid(6,0.1,-300,3.2,1.8,3.2,darkTop);
      addSolid(-4,0.1,-308,3.6,1.8,3.6,darkTop);
      addSolid(2.5,-0.1,-290,2.6,1.2,2.6,darkTop);
      addSolid(0,0,-305,2.4,1.3,2.4,darkTop);
      // chemin de pierres sûres au centre (guide visuel)
      [[0,-266],[1,-272],[-1,-318],[0,-324]].forEach(([x,z])=>{
        addSolid(x,-0.15,z,3,1.1,3,darkTop);
      });
      barrierWall(-WALL_X,-260,-330, darkSide,2.8);
      barrierWall( WALL_X,-260,-330, darkSide,2.8);

      // ===== 6. NEIGES (z -330 → -412) =====
      addGround(0,-1,-371,28,2,84, snowTop, snowSide,"ice");
      const path3=new THREE.Mesh(new THREE.PlaneGeometry(4.6,76), pathM.clone());
      path3.rotation.x=-Math.PI/2; path3.position.set(0,0.03,-371); path3.receiveShadow=true; scene.add(path3);
      const iceLakeM=new THREE.MeshStandardMaterial({color:0x9fd8ff,roughness:0.12,metalness:0.4,transparent:true,opacity:0.85});
      const lake=new THREE.Mesh(new THREE.CircleGeometry(4.5,24), iceLakeM);
      lake.rotation.x=-Math.PI/2; lake.position.set(-8,0.05,-356); lake.receiveShadow=true; scene.add(lake);
      barrierWall(-WALL_X,-330,-412, snowSide,2.2);
      barrierWall( WALL_X,-330,-412, snowSide,2.2);
      const igloo=new THREE.Mesh(new THREE.SphereGeometry(2.5,14,10,0,Math.PI*2,0,Math.PI/2), snowTop);
      igloo.position.set(9.5,0,-360); igloo.castShadow=true; igloo.receiveShadow=true; scene.add(igloo);
      const hole=new THREE.Mesh(new THREE.CircleGeometry(0.9,14), mat(0x223344));
      hole.position.set(9.5,0.9,-357.6); hole.rotation.x=-0.3; scene.add(hole);

      // ----- lignes + portails de zones (cohérents : ligne au sol + arche) -----
      ZONES.forEach((z,i)=>{
        const gz=z.z1+4;
        const pilM=mat(i===5?0xff4d7a:0xf2f4f8,{roughness:0.4});
        [-8,8].forEach(x=>{
          const y=groundY(x,gz);
          const pil=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.72,5.6,10), pilM);
          pil.position.set(x,(y<0?0:y)+2.6,gz); pil.castShadow=true; scene.add(pil);
          const orb=new THREE.Mesh(new THREE.SphereGeometry(0.5,12,12),
            new THREE.MeshStandardMaterial({color:0xffcf2e,emissive:0xff9a00,emissiveIntensity:1.1}));
          orb.position.set(x,(y<0?0:y)+5.7,gz); scene.add(orb);
          floaters.push({m:orb,baseY:(y<0?0:y)+5.7,ph:x,flame:false});
        });
        // poutre haute + ligne au sol
        const top=new THREE.Mesh(new THREE.BoxGeometry(17,0.7,0.7), pilM);
        top.position.set(0,5.4,gz); top.castShadow=true; scene.add(top);
        const line=new THREE.Mesh(new THREE.PlaneGeometry(16,1.1),
          new THREE.MeshBasicMaterial({map:TEX.checker,transparent:false}));
        line.rotation.x=-Math.PI/2; line.position.set(0,0.06,gz); line.receiveShadow=true; scene.add(line);
        const label=makeTextSprite(z.name.replace(/^[^\s]+\s/,""), "ZONE "+(i+1));
        label.position.set(0,8.2,gz); scene.add(label);
      });

      // ----- panneaux tuto au départ (cohérents, en bois) -----
      [["COURS !","Z / W pour accélérer",-3.5,-8],["SAUTE !","ESPACE x3 = triple saut",3.5,-14],["FRAPPE !","E + X = pound",-3.5,-20]].forEach(([t,s,x,z])=>{
        const y=groundY(x,z);
        const post=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,1.8,8), woodM); post.position.set(x,y+0.9,z); scene.add(post);
        const sp=makeTextSprite(t,s); sp.scale.set(5,1.9,1); sp.position.set(x,y+2.6,z); scene.add(sp);
      });

      // ----- décors HORS-PISTE (jamais au centre !) -----
      for(let i=0;i<12;i++) tree(sideX(),-4-Math.random()*58,0.85+Math.random()*0.6);
      for(let i=0;i<16;i++){ const x=-12+Math.random()*24; if(Math.abs(x)<LANE&&Math.random()<0.7) continue; grassTuft(x,-4-Math.random()*60); }
      for(let i=0;i<8;i++) flower(sideX(),-6-Math.random()*56,[0xff5d8a,0xffcf2e,0xc742ff,0xffffff][i%4]);
      for(let i=0;i<7;i++) palm(sideX(),-74-Math.random()*50);
      for(let i=0;i<3;i++) butterfly(-6+Math.random()*12,1.5+Math.random(),-10-Math.random()*40,[0xff9ad4,0x7ad4ff,0xffcf2e][i%3]);
      for(let i=0;i<5;i++) gull(-8+Math.random()*16,10+Math.random()*5,-80-Math.random()*60);
      for(let i=0;i<5;i++) rockSpike(sideX(),-196-Math.random()*54,0x5a5e66,0.9+Math.random()*1.1);
      for(let i=0;i<5;i++) snowPine(sideX(),-196-Math.random()*50,0.9);
      for(let i=0;i<7;i++) rockSpike(sideX(),-264-Math.random()*60,0x0a0a0a,1+Math.random()*1.4);
      for(let i=0;i<4;i++) torchPillar(i%2?9.5:-9.5,-272-(i*14), i<2);
      for(let i=0;i<7;i++) snowPine(sideX(),-334-Math.random()*44,0.9+Math.random()*0.6);
      snowman(-9,-348); snowman(9.5,-372);
      for(let i=0;i<8;i++){ crystal(sideX(),-336-Math.random()*44, i%2?0x7ad4ff:0xc49aff); if(i<4)sparkles.push({x:sideX(),z:-336-Math.random()*44,ph:Math.random()*6}); }
      // étincelles de neige (petits points brillants au sol)
      sparkles.forEach(o=>{
        const m=new THREE.Mesh(new THREE.SphereGeometry(0.09,6,6), new THREE.MeshBasicMaterial({color:0xffffff}));
        const y=groundY(o.x,o.z); m.position.set(o.x,y+0.1,o.z); scene.add(m); o.m=m;
      });

      // ----- ARRIVÉE : tapis + podium + arche damier -----
      const carpet=new THREE.Mesh(new THREE.PlaneGeometry(4.6,12), mat(0xd42a2a,{roughness:0.8}));
      carpet.rotation.x=-Math.PI/2; carpet.position.set(0,0.04,-392); carpet.receiveShadow=true; scene.add(carpet);
      const checkerLine=new THREE.Mesh(new THREE.PlaneGeometry(8,1.4), new THREE.MeshBasicMaterial({map:TEX.checker}));
      checkerLine.rotation.x=-Math.PI/2; checkerLine.position.set(0,0.05,-387.5); scene.add(checkerLine);
      finishGroup=new THREE.Group();
      const socle=new THREE.Mesh(new THREE.CylinderGeometry(4.5,5.1,1,28), mat(0x3a3f4d,{roughness:0.5,metalness:0.3}));
      socle.position.y=0.5; socle.receiveShadow=true; socle.castShadow=true; finishGroup.add(socle);
      const base=new THREE.Mesh(new THREE.CylinderGeometry(3.3,3.7,1.2,28), mat(0x9aa0aa,{roughness:0.35,metalness:0.5}));
      base.position.y=1.6; base.castShadow=true; finishGroup.add(base);
      btnTopMat=new THREE.MeshStandardMaterial({color:0xff5d8a,roughness:0.3,emissive:0xaa1133,emissiveIntensity:0.7});
      btnTop=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,0.75,28), btnTopMat);
      btnTop.position.y=2.55; btnTop.castShadow=true; finishGroup.add(btnTop);
      const faceC=document.createElement("canvas"); faceC.width=faceC.height=128;
      const fg=faceC.getContext("2d");
      fg.fillStyle="#ff5d8a"; fg.fillRect(0,0,128,128);
      fg.fillStyle="#111"; fg.beginPath(); fg.arc(44,52,10,0,7); fg.arc(84,52,10,0,7); fg.fill();
      fg.strokeStyle="#111"; fg.lineWidth=7; fg.lineCap="round"; fg.beginPath(); fg.arc(64,72,30,0.3,Math.PI-0.3); fg.stroke();
      const faceT=new THREE.CanvasTexture(faceC); faceT.encoding=THREE.sRGBEncoding;
      const face=new THREE.Mesh(new THREE.CircleGeometry(1.5,24), new THREE.MeshBasicMaterial({map:faceT,transparent:true}));
      face.rotation.x=-Math.PI/2; face.position.y=2.94; finishGroup.add(face);
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.1,30,20,1,true),
        new THREE.MeshBasicMaterial({color:0xff8ab0,transparent:true,opacity:0.26,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
      beam.position.y=16; finishGroup.add(beam); beams.push(beam);
      // arche damier
      const archM=mat(0x14141c);
      [-4.6,4.6].forEach(x=>{
        const p=new THREE.Mesh(new THREE.BoxGeometry(0.8,8,0.8), archM); p.position.set(x,4,0); p.castShadow=true; finishGroup.add(p);
      });
      const archTop=new THREE.Mesh(new THREE.BoxGeometry(10,1.4,1),
        new THREE.MeshStandardMaterial({map:TEX.checker,roughness:0.7}));
      archTop.position.set(0,8.2,0); finishGroup.add(archTop);
      const winLabel=makeTextSprite("ARRIVEE","POUND SUR LE BOUTON !");
      winLabel.position.set(0,10.4,0); finishGroup.add(winLabel);
      finishGroup.position.set(0,0,-398);
      scene.add(finishGroup);
      addSolid(0,-0.5,-398,12,1,12,mat(0xdddddd),"finish");
      // projecteurs
      [[-6,-395],[6,-395]].forEach(([x,z])=>{
        const spot=new THREE.SpotLight(0xffffff,1.1,40,0.5,0.4);
        spot.position.set(x,9,z); spot.target.position.set(0,1,-398);
        scene.add(spot); scene.add(spot.target);
        const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,9,8), mat(0x333344,{metalness:0.5,roughness:0.4}));
        pole.position.set(x,4.5,z); pole.castShadow=true; scene.add(pole);
        const flag=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.3,6,1), mat(0xffcf2e,{side:THREE.DoubleSide,roughness:0.7}));
        flag.position.set(x+(x<0?1.15:-1.15),8,z); scene.add(flag);
        flags.push({m:flag,ph:x});
      });
      this.finishGroup=finishGroup; this.btnTop=btnTop; this.btnTopMat=btnTopMat;
    },

    groundHeightAt(x,z,py){
      let best=-999, typ="void";
      for(const p of platforms){
        if(x>=p.minX&&x<=p.maxX&&z>=p.minZ&&z<=p.maxZ){
          if(py>=p.top-1.4&&p.top>best){best=p.top;typ=p.type;}
        }
      }
      return {y:best,type:typ};
    },
    zoneAt(z){
      for(let i=0;i<ZONES.length;i++){ if(z<=ZONES[i].z0&&z>ZONES[i].z1) return i; }
      return z>ZONES[0].z0?0:5;
    },
    pressButton(){
      if(btnTop) btnTop.position.y=1.95;
      if(btnTopMat){ btnTopMat.color.set(0x7dff8a); btnTopMat.emissive.set(0x1a8822); }
    },
    update(dt,t,playerPos){
      if(skyDome) skyDome.position.copy(playerPos);
      const zi=this.zoneAt(playerPos.z);
      const zc=ZONES[zi];
      _c1.set(zc.sky); _c2.set(zc.fog);
      scene.background.lerp(_c1,dt*1.4);
      if(scene.fog) scene.fog.color.lerp(_c2,dt*1.4);
      if(skyDome){
        skyDome.material.uniforms.top.value.lerp(_c1,dt*1.4);
        skyDome.material.uniforms.bottom.value.lerp(_c2,dt*1.4);
      }
      TEX.water.offset.y+=dt*0.05; TEX.water.offset.x+=dt*0.018;
      waters.forEach((w,i)=>{ w.position.y=-1.75+Math.sin(t*1.3+i)*0.1; });
      TEX.lava.offset.y-=dt*0.1; TEX.lava.offset.x+=dt*0.045;
      lavas.forEach((m,i)=>{ m.position.y=-0.62+Math.sin(t*3+i*2)*0.045; });
      lavaLights.forEach(o=>{ o.li.intensity=o.base+Math.sin(t*9+o.ph)*0.35+Math.random()*0.08; });
      clouds.forEach(c=>{ c.g.position.x+=c.sp*dt; if(c.g.position.x>100)c.g.position.x=-100; });
      flags.forEach(f=>{
        const p=f.m.geometry.attributes.position;
        for(let i=0;i<p.count;i++){ const x=p.getX(i); p.setZ(i,Math.sin(t*5+x*2+f.ph)*0.18*(x+1.1)); }
        p.needsUpdate=true;
      });
      floaters.forEach(o=>{
        if(o.buoy){ o.m.position.y=o.baseY+Math.sin(t*2+o.ph)*0.22; o.m.rotation.z=Math.sin(t*1.5+o.ph)*0.15; }
        else{ o.m.position.y=o.baseY+Math.sin(t*2+o.ph)*0.16; if(o.flame) o.m.scale.setScalar(1+Math.sin(t*11+o.ph)*0.16); else o.m.rotation.y+=dt*0.7; }
      });
      butterflies.forEach(b=>{
        const tt=t*b.sp+b.ph;
        b.g.position.set(b.cx+Math.sin(tt*0.9)*3, b.cy+Math.sin(tt*2.2)*0.7, b.cz+Math.cos(tt*0.7)*3);
        b.g.rotation.y=Math.sin(tt*0.9)*0.8;
        const flap=Math.sin(t*16+b.ph)*0.9;
        b.w1.rotation.y=flap; b.w2.rotation.y=-flap;
      });
      gulls.forEach(gl=>{
        const a=t*gl.sp+gl.ph;
        gl.g.position.set(gl.cx+Math.cos(a)*gl.r, gl.cy+Math.sin(t*0.9+gl.ph)*0.8, gl.cz+Math.sin(a)*gl.r);
        gl.g.rotation.y=-a;
        const f=Math.sin(t*7+gl.ph)*0.5;
        gl.w1.rotation.z=f; gl.w2.rotation.z=-f;
      });
      fishes.forEach(f=>{
        const a=t*0.8+f.ph;
        f.g.position.set(f.cx+Math.cos(a)*f.r, -1.3+Math.sin(t*2+f.ph)*0.15, f.cz+Math.sin(a)*f.r);
        f.g.rotation.y=-a+Math.PI/2;
      });
      bubbles.forEach(b=>{ const s=1+Math.sin(t*4+b.ph)*0.35; b.m.scale.set(s,s*0.8,s); });
      sparkles.forEach(s=>{ if(s.m) s.m.material.color.setScalar(0.75+Math.sin(t*5+s.ph)*0.25); });
      if(btnTop&&btnTop.position.y>2.2) btnTop.position.y=2.55+Math.sin(t*3)*0.11;
      if(btnTopMat&&btnTopMat.color.getHex()!==0x7dff8a) btnTopMat.emissiveIntensity=0.7+Math.sin(t*4)*0.3;
      // fumée de lave : petite contribution continue
      if(playerPos.z<-258&&playerPos.z>-332&&Math.random()<dt*8){
        const sx=playerPos.x+(Math.random()-0.5)*20, sz=playerPos.z+(Math.random()-0.5)*14;
        Effects.dust(new THREE.Vector3(sx,0.2,sz),0x333333,1,1,4);
      }
    }
  };
})();
