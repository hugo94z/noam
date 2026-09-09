/* ===== CONFIG — Noam Speeder ===== */
window.CONFIG = {
  baseSpeed: 7,
  topSpeed: 15.5,
  accelTime: 2.8,       // secondes pour atteindre la vitesse max
  jumpPower: 9.8,
  doubleJumpPower: 10.2,
  tripleJumpPower: 15.5,
  backflipPower: 13.5,
  floatTime: 1.0,       // seconde de flottement Yoshi
  gravity: 32,
  hearts: 3,
};

window.ZONES = [
  { id:0, name:"🌿 Plaines", sub:"Zone 1 / 6", z0:12,  z1:-70,  sky:0x87ceeb, fog:0x9fd8ef, ground:"grass" },
  { id:1, name:"🏖️ Plages", sub:"Zone 2 / 6", z0:-70, z1:-130, sky:0x8fd4ff, fog:0xffe9b0, ground:"sand" },
  { id:2, name:"🌊 Zone Aquatique", sub:"Zone 3 / 6 — plots !", z0:-130, z1:-190, sky:0x5ec4f5, fog:0x9fe4ff, ground:"water" },
  { id:3, name:"⛰️ Montagnes", sub:"Zone 4 / 6 — triple saut !", z0:-190, z1:-260, sky:0x9db8d6, fog:0xc3d3e8, ground:"rock" },
  { id:4, name:"🌋 Roches Noires et Lave", sub:"Zone 5 / 6 — lave !", z0:-260, z1:-330, sky:0x2a1420, fog:0x5a2a1a, ground:"dark" },
  { id:5, name:"❄️ Neiges", sub:"Zone 6 / 6 — ARRIVÉE !", z0:-330, z1:-412, sky:0xcfe6ff, fog:0xe8f2ff, ground:"snow" },
];

window.ENEMY_INFO = {
  Bloup:   { hp:1, name:"Bloup" },
  Goldonax:{ hp:3, name:"Goldonax" },
  Corhog:  { hp:2, name:"Corhog" },
};
