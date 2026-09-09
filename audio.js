/* ===== AUDIO — petits sons rétro en WebAudio ===== */
(function(){
  let ctx = null;
  function ac(){
    if(!ctx){ try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
    if(ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, when, slideTo){
    try{
      const c = ac(); if(!c) return;
      const t = c.currentTime + (when||0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type||"square"; o.frequency.setValueAtTime(freq, t);
      if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t+dur);
      g.gain.setValueAtTime(vol||0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t+dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t+dur+0.02);
    }catch(e){}
  }
  window.AudioSys = {
    unlock(){ ac(); },
    jump(){ tone(480+Math.random()*160, .12, "square", .10, 0, 760); },
    doubleJump(){ tone(620,.1,"square",.1,0,940); },
    triple(){ tone(600,.09,"square",.12); tone(820,.09,"square",.12,.08); tone(1150,.18,"square",.13,.16); },
    backflip(){ tone(300,.22,"sawtooth",.1,0,900); },
    punch(){ tone(280,.07,"square",.13,0,140); },
    hit(){ tone(190,.14,"sawtooth",.16,0,90); },
    ko(){ tone(700,.07,"square",.12); tone(950,.13,"square",.12,.07); },
    hurt(){ tone(150,.26,"sawtooth",.18,0,60); },
    pound(){ tone(95,.3,"sine",.24,0,40); },
    splash(){ tone(900,.18,"sine",.1,0,250); },
    check(){ tone(880,.1,"triangle",.14); tone(1174,.2,"triangle",.14,.1); },
    floatLoop(){ tone(660,.06,"sine",.04); },
    throwRock(){ tone(230,.1,"sawtooth",.08,0,140); },
    win(){ [523,659,784,1046,1318,1568].forEach((f,i)=>tone(f,.24,"square",.12,i*.12)); },
    click(){ tone(700,.06,"square",.09); }
  };
})();
