/* ===== TEXTURES procédurales HD 512 — style cohérent ===== */
(function(){
  function canvasTex(size, draw, repeatX, repeatY){
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    draw(g, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX||4, repeatY||4);
    t.anisotropy = 8;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function noise(g,s,n,colors,rMin,rMax,aMin,aMax){
    for(let i=0;i<n;i++){
      g.fillStyle = colors[(Math.random()*colors.length)|0];
      g.globalAlpha = (aMin||0.25) + Math.random()*((aMax||0.75)-(aMin||0.25));
      const r = rMin + Math.random()*(rMax-rMin);
      g.beginPath(); g.arc(Math.random()*s, Math.random()*s, r, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }

  window.TEX = {};
  window.initTextures = function(){
    const S=512;
    // HERBE : base + patchs + brins fins (cohérent, pas trop criard)
    TEX.grass = canvasTex(S,(g,s)=>{
      g.fillStyle="#5fbf4a"; g.fillRect(0,0,s,s);
      noise(g,s,900,["#4da93a","#6ede58","#3f8f2e","#8ee27a","#57b846"],2,7);
      g.strokeStyle="rgba(35,110,30,.85)"; g.lineWidth=3; g.lineCap="round";
      for(let i=0;i<260;i++){ const x=Math.random()*s,y=Math.random()*s;
        g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+2,y-8,x+(Math.random()*8-4),y-12-Math.random()*8); g.stroke(); }
      // petites fleurs blanches rares
      g.fillStyle="#ffffff";
      for(let i=0;i<12;i++){ const x=Math.random()*s,y=Math.random()*s;
        for(let p=0;p<5;p++){ g.beginPath(); g.arc(x+Math.cos(p/5*6.28)*4,y+Math.sin(p/5*6.28)*4,3,0,7); g.fill(); } }
    },9,9);
    // TERRE (côtés des plateformes) : marron cohérent
    TEX.dirt = canvasTex(S,(g,s)=>{
      g.fillStyle="#7a5230"; g.fillRect(0,0,s,s);
      noise(g,s,900,["#5e3d22","#8f653a","#6b4a29","#a67c4b"],3,10);
      g.fillStyle="rgba(0,0,0,.18)";
      for(let i=0;i<40;i++) g.fillRect(Math.random()*s,Math.random()*s,6+Math.random()*20,4+Math.random()*8);
    },6,2);
    // CHEMIN guide : sable clair + flèches subtiles + bordure
    TEX.path = canvasTex(S,(g,s)=>{
      g.fillStyle="#e8d9a0"; g.fillRect(0,0,s,s);
      noise(g,s,600,["#dcc987","#f5e9bd","#cbb572"],2,6);
      g.fillStyle="rgba(120,90,30,.25)";
      g.fillRect(0,0,14,s); g.fillRect(s-14,0,14,s); // bordures
      // chevrons guide vers le haut (-Z)
      g.fillStyle="rgba(255,255,255,.55)";
      for(let y=60;y<s;y+=150){
        g.beginPath(); g.moveTo(s/2-60,y+50); g.lineTo(s/2,y); g.lineTo(s/2+60,y+50);
        g.lineTo(s/2+40,y+50); g.lineTo(s/2,y+20); g.lineTo(s/2-40,y+50); g.closePath(); g.fill();
      }
    },1,14);
    // SABLE plage
    TEX.sand = canvasTex(S,(g,s)=>{
      g.fillStyle="#f0d68a"; g.fillRect(0,0,s,s);
      noise(g,s,1100,["#e6c876","#ffe9ad","#d9b45e","#fff6d8"],1,5);
      g.fillStyle="rgba(190,150,90,.5)";
      for(let i=0;i<14;i++){ const x=Math.random()*s,y=Math.random()*s;
        g.beginPath(); g.ellipse(x,y,10+Math.random()*10,6,Math.random()*3,0,7); g.stroke(); }
    },9,9);
    // ROCHE
    TEX.rock = canvasTex(S,(g,s)=>{
      g.fillStyle="#8a8f98"; g.fillRect(0,0,s,s);
      noise(g,s,700,["#6f747d","#a7adb6","#5a5e66","#c9cdd4"],3,14);
      g.strokeStyle="rgba(40,42,50,.45)"; g.lineWidth=3;
      for(let i=0;i<14;i++){ g.beginPath(); let x=Math.random()*s,y=Math.random()*s; g.moveTo(x,y);
        for(let k=0;k<3;k++){x+=Math.random()*80-40;y+=Math.random()*80-40;g.lineTo(x,y);} g.stroke(); }
    },7,7);
    // ROCHE NOIRE
    TEX.dark = canvasTex(S,(g,s)=>{
      g.fillStyle="#202027"; g.fillRect(0,0,s,s);
      noise(g,s,650,["#2c2c36","#101014","#3d3d4a","#000000"],3,13);
      g.strokeStyle="rgba(255,90,0,.6)"; g.lineWidth=3; g.shadowColor="#ff5a00"; g.shadowBlur=8;
      for(let i=0;i<9;i++){ g.beginPath(); let x=Math.random()*s,y=Math.random()*s; g.moveTo(x,y);
        for(let k=0;k<4;k++){ x+=Math.random()*70-35; y+=Math.random()*70-35; g.lineTo(x,y);} g.stroke(); }
      g.shadowBlur=0;
    },7,7);
    // NEIGE
    TEX.snow = canvasTex(S,(g,s)=>{
      g.fillStyle="#eef4ff"; g.fillRect(0,0,s,s);
      noise(g,s,500,["#ffffff","#dbe9ff","#c9dcff"],2,5);
      g.fillStyle="rgba(255,255,255,.95)";
      for(let i=0;i<90;i++){ const x=Math.random()*s,y=Math.random()*s;
        g.save(); g.translate(x,y); g.rotate(Math.random()*3);
        g.fillRect(-3,-1,6,2); g.fillRect(-1,-3,2,6); g.restore(); }
    },9,9);
    // LAVE
    TEX.lava = canvasTex(S,(g,s)=>{
      const grad=g.createLinearGradient(0,0,s,s);
      grad.addColorStop(0,"#ff3d00"); grad.addColorStop(.35,"#ff7a00");
      grad.addColorStop(.6,"#ffcf2e"); grad.addColorStop(1,"#b81a00");
      g.fillStyle=grad; g.fillRect(0,0,s,s);
      noise(g,s,420,["#ffef2e","#ff5a00","#7a0e00","#ffd76a"],4,18);
      g.strokeStyle="rgba(40,0,0,.65)"; g.lineWidth=6;
      for(let i=0;i<12;i++){ g.beginPath(); let x=Math.random()*s,y=Math.random()*s; g.moveTo(x,y);
        for(let k=0;k<5;k++){ x+=Math.random()*90-45; y+=Math.random()*90-45; g.lineTo(x,y);} g.stroke(); }
    },3,3);
    // EAU
    TEX.water = canvasTex(S,(g,s)=>{
      const grad=g.createLinearGradient(0,0,0,s);
      grad.addColorStop(0,"#37c2f2"); grad.addColorStop(.5,"#1a9ad8"); grad.addColorStop(1,"#0b5fa8");
      g.fillStyle=grad; g.fillRect(0,0,s,s);
      g.strokeStyle="rgba(255,255,255,.55)"; g.lineWidth=4; g.lineCap="round";
      for(let y=20;y<s;y+=44){ for(let x=0;x<s;x+=56){
        g.beginPath(); g.arc(x+((y*7)%20),y,14,Math.PI*0.12,Math.PI*0.88); g.stroke(); } }
      noise(g,s,180,["#bff0ff","#0a4f9e"],2,5);
    },7,7);
    // BOIS
    TEX.wood = canvasTex(256,(g,s)=>{
      g.fillStyle="#a97436"; g.fillRect(0,0,s,s);
      for(let p=0;p<4;p++){
        g.fillStyle=p%2?"#b98140":"#9c652c"; g.fillRect(0,p*64,s,62);
        g.fillStyle="rgba(60,32,8,.6)"; g.fillRect(0,p*64+60,s,4);
        g.strokeStyle="rgba(70,40,12,.4)"; g.lineWidth=2;
        for(let i=0;i<6;i++){ const y=p*64+10+Math.random()*45;
          g.beginPath(); g.moveTo(0,y); g.bezierCurveTo(80,y+4,170,y-4,256,y); g.stroke(); }
      }
    },2,2);
    // DAMIER arrivée
    TEX.checker = canvasTex(256,(g,s)=>{
      const n=8, c=s/n;
      for(let y=0;y<n;y++)for(let x=0;x<n;x++){ g.fillStyle=(x+y)%2?"#111":"#fff"; g.fillRect(x*c,y*c,c,c); }
    },4,1);
  };

  window.makeTextSprite = function(text, sub){
    const c=document.createElement("canvas"); c.width=512; c.height=192;
    const g=c.getContext("2d");
    g.fillStyle="rgba(10,16,34,.92)";
    g.beginPath();
    if(g.roundRect) g.roundRect(6,6,500,180,34); else g.rect(6,6,500,180);
    g.fill();
    g.lineWidth=8; g.strokeStyle="#ffcf2e"; g.stroke();
    // petit point lumineux
    g.fillStyle="#ffcf2e"; g.beginPath(); g.arc(56,60,14,0,7); g.fill();
    g.fillStyle="#fff"; g.font="900 54px Segoe UI, Arial"; g.textAlign="center";
    g.fillText(text,276,88);
    g.fillStyle="#ffcf2e"; g.font="700 32px Segoe UI, Arial";
    g.fillText(sub||"",276,142);
    const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=4;
    const m=new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false});
    const sp=new THREE.Sprite(m); sp.scale.set(8.4,3.15,1);
    return sp;
  };
})();
