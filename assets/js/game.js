const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const shell = document.getElementById('gameShell');
const $ = (id) => document.getElementById(id);

const screens = {
  menu: $('menuScreen'), pause: $('pauseScreen'),
  level: $('levelScreen'), gameOver: $('gameOverScreen'), shop: $('shopScreen')
};

const levels = [
  { name:'Nível 1, Praça Limpa', short:'Praça Limpa', goal:20, time:90, caps:28, tabs:0, rare:0, obstacles:4,
    fact:'Separar tampinhas e lacres ensina que pequenos hábitos podem virar ajuda real quando muitas pessoas participam.',
    animal:'+2 animais receberam ração virtual no abrigo.' },
  { name:'Nível 2, Parque dos Pets', short:'Parque dos Pets', goal:30, time:80, caps:25, tabs:14, rare:0, obstacles:7,
    fact:'Lacres de alumínio ocupam pouco espaço, mas mobilizam campanhas inteiras de arrecadação.',
    animal:'+4 pets ganharam cuidado, água limpa e alimentação.' },
  { name:'Nível 3, Centro da Cidade', short:'Centro da Cidade', goal:42, time:70, caps:30, tabs:20, rare:0, obstacles:10,
    fact:'Quando a coleta é organizada, praças, ruas e escolas ficam mais limpas.',
    animal:'+7 animais foram encaminhados para atendimento virtual.' },
  { name:'Nível 4, Feira Sustentável', short:'Feira Sustentável', goal:55, time:72, caps:32, tabs:20, rare:8, obstacles:12,
    fact:'Eventos sustentáveis podem transformar visitantes em multiplicadores de boas práticas.',
    animal:'+10 pets receberam ajuda no mutirão da comunidade.' },
  { name:'Nível 5, Grande Mutirão Animal', short:'Grande Mutirão', goal:75, time:85, caps:40, tabs:28, rare:10, obstacles:15,
    fact:'Campanhas de reciclagem ganham força quando existe uma meta clara, simples e compartilhável.',
    animal:'Um abrigo inteiro foi salvo pelo mutirão EcoPatinhas.' }
];

const state = {
  mode: 'menu',
  theme: localStorage.getItem('ecopatinhas_theme') || 'green',
  levelIndex: Number(localStorage.getItem('ecopatinhas_level') || 0),
  bankCoins: Number(localStorage.getItem('ecopatinhas_coins') || 0),
  bagUpgrade: Number(localStorage.getItem('ecopatinhas_bag') || 0),
  speedUpgrade: Number(localStorage.getItem('ecopatinhas_speed') || 0),
  specialSkin: localStorage.getItem('ecopatinhas_skin') === 'true',
  timeLeft: 90, lastTime: 0,
  deliveredScore: 0, carriedScore: 0,
  carriedItems: [], items: [], obstacles: [], particles: [], floatingTexts: [],
  levelCoinsEarned: 0,
  communityTotal: Number(localStorage.getItem('ecopatinhas_total') || 0),
  player: { x:120, y:270, r:20, speed:165, inv:0 },
  keys: {},
  joystick: { active:false, dx:0, dy:0 },
  deliveredNear: false
};

// World (logical size, fixed)
const world = { w:960, h:540 };
const deliverZone = { x:790, y:362, w:126, h:112 };

// Camera
const cam = { x:0, y:0, zoom:1 };

// ─── CAMERA ─────────────────────────────────────────────────────────────────
function updateCamera() {
  const shellW = shell.clientWidth;
  const shellH = shell.clientHeight;

  // Fit zoom: fill the shell while keeping world aspect, then clamp
  const scaleX = shellW / world.w;
  const scaleY = shellH / world.h;
  const isMobile = shellW < 760;
  // On mobile: zoom in a bit so map isn't tiny
  let baseZoom = isMobile ? Math.max(scaleX, scaleY) * 1.05 : Math.min(scaleX, scaleY);
  baseZoom = Math.max(0.4, Math.min(2.5, baseZoom));
  cam.zoom = baseZoom;

  // Follow player — keep centred in view
  const viewW = shellW / cam.zoom;
  const viewH = shellH / cam.zoom;
  const p = state.player;
  cam.x = clamp(p.x - viewW / 2, 0, Math.max(0, world.w - viewW));
  cam.y = clamp(p.y - viewH / 2, 0, Math.max(0, world.h - viewH));
}

// ─── CANVAS RESIZE ──────────────────────────────────────────────────────────
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = shell.clientWidth;
  const h = shell.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ─── HELPERS ────────────────────────────────────────────────────────────────
function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function circleRectCollision(c, r) {
  const cx = clamp(c.x, r.x, r.x + r.w);
  const cy = clamp(c.y, r.y, r.y + r.h);
  return Math.hypot(c.x - cx, c.y - cy) < c.r;
}
function bagLimit() { return 10 + state.bagUpgrade * 5; }
function playerSpeed() { return 165 + state.speedUpgrade * 22; }
function currentLevel() { return levels[state.levelIndex]; }
function cssVar(n) { return getComputedStyle(document.body).getPropertyValue(n).trim(); }

// ─── PERSIST ────────────────────────────────────────────────────────────────
function saveProgress() {
  localStorage.setItem('ecopatinhas_theme', state.theme);
  localStorage.setItem('ecopatinhas_level', String(Math.min(state.levelIndex, levels.length-1)));
  localStorage.setItem('ecopatinhas_coins', String(state.bankCoins));
  localStorage.setItem('ecopatinhas_bag', String(state.bagUpgrade));
  localStorage.setItem('ecopatinhas_speed', String(state.speedUpgrade));
  localStorage.setItem('ecopatinhas_skin', String(state.specialSkin));
  localStorage.setItem('ecopatinhas_total', String(state.communityTotal));
}

// ─── THEME ──────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  state.theme = theme;
  document.body.className = theme === 'pop' ? 'theme-pop' : theme === 'city' ? 'theme-city' : '';
  document.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === theme));
  saveProgress();
}

// ─── SCREENS ────────────────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  if (name && screens[name]) screens[name].classList.add('active');
}

// ─── TOAST ──────────────────────────────────────────────────────────────────
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1700);
}

// ─── WORLD SPAWN ────────────────────────────────────────────────────────────
function spawnPoint(avoidZone = true) {
  let p, ok = false, tries = 0;
  while (!ok && tries < 1000) {
    tries++;
    p = { x: rand(54, world.w-54), y: rand(92, world.h-54) };
    ok = true;
    const dzCenter = { x: deliverZone.x + deliverZone.w/2, y: deliverZone.y + deliverZone.h/2 };
    if (avoidZone && Math.hypot(p.x - dzCenter.x, p.y - dzCenter.y) < 150) ok = false;
    if (Math.hypot(p.x - 120, p.y - 270) < 100) ok = false;
    for (const o of state.obstacles) {
      if (p.x > o.x-38 && p.x < o.x+o.w+38 && p.y > o.y-38 && p.y < o.y+o.h+38) ok = false;
    }
  }
  return p;
}

function buildLevel() {
  const level = currentLevel();
  state.timeLeft = level.time; state.deliveredScore = 0; state.carriedScore = 0;
  state.carriedItems = []; state.items = []; state.obstacles = [];
  state.particles = []; state.floatingTexts = [];
  state.levelCoinsEarned = 0; state.deliveredNear = false;
  state.player.x = 120; state.player.y = 270; state.player.inv = 0;

  for (let i = 0; i < level.obstacles; i++) {
    let size = rand(34, 54);
    const p = spawnPoint(false);
    state.obstacles.push({ x:p.x, y:p.y, w:size+rand(-6,20), h:size+rand(-8,14), type:['trash','puddle','bike'][i%3] });
  }
  for (let i = 0; i < level.caps; i++) addItem('cap');
  for (let i = 0; i < level.tabs; i++) addItem('tab');
  for (let i = 0; i < level.rare; i++) addItem('rare');
  updateHud();
}

function addItem(type) {
  const p = spawnPoint();
  const values = { cap:1, tab:2, rare:5 };
  state.items.push({ x:p.x, y:p.y, r:type==='rare'?12:10, type, value:values[type], pulse:rand(0,Math.PI*2) });
}

// ─── GAME FLOW ───────────────────────────────────────────────────────────────
function startGame() {
  state.mode = 'playing';
  buildLevel();
  showScreen(null);
  toast('Colete e entregue no ponto ♻️');
}
function pauseGame() { if (state.mode!=='playing') return; state.mode='pause'; showScreen('pause'); }
function resumeGame() { state.mode='playing'; showScreen(null); state.lastTime = performance.now(); }
function goMenu() { state.mode='menu'; showScreen('menu'); updateShop(); hideObjIndicator(); }

function completeLevel() {
  const level = currentLevel();
  const bonus = 10 + state.levelIndex*6 + Math.max(0, Math.floor(state.timeLeft/5));
  state.bankCoins += bonus; state.levelCoinsEarned += bonus;
  state.communityTotal += state.deliveredScore;
  $('levelTitle').textContent = state.levelIndex===levels.length-1 ? 'Grande mutirão concluído!' : 'Fase concluída!';
  $('levelSummary').textContent = `Você entregou ${state.deliveredScore} pts e acumulou ${state.levelCoinsEarned} EcoCoins.`;
  $('ecoFact').textContent = level.fact;
  $('animalsHelped').textContent = level.animal;
  $('rewardText').textContent = `+${bonus} EcoCoins. Total da comunidade: ${state.communityTotal.toLocaleString('pt-BR')} recicláveis.`;
  $('nextLevelBtn').textContent = state.levelIndex===levels.length-1 ? 'Jogar novamente' : 'Próxima fase';
  state.mode = 'level'; showScreen('level');
  saveProgress(); updateHud(); updateShop(); hideObjIndicator();
}

function nextLevel() {
  if (state.levelIndex < levels.length-1) state.levelIndex++; else state.levelIndex=0;
  saveProgress(); startGame();
}

function gameOver() {
  state.bankCoins += Math.floor(state.carriedScore/2);
  saveProgress();
  $('gameOverText').textContent = `Você entregou ${state.deliveredScore}/${currentLevel().goal}. EcoCoins totais: ${state.bankCoins}.`;
  state.mode = 'gameOver'; showScreen('gameOver'); updateShop(); hideObjIndicator();
}

function collectItem(item, index) {
  if (state.carriedItems.length >= bagLimit()) { toast('Mochila cheia, vá ao ponto de coleta!'); return; }
  state.carriedItems.push(item); state.carriedScore += item.value;
  state.items.splice(index, 1);
  state.floatingTexts.push({ x:item.x, y:item.y, text:item.type==='cap'?'+tampinha':item.type==='tab'?'+lacre':'+item raro', life:1 });
  for (let i=0;i<8;i++) state.particles.push({ x:item.x, y:item.y, vx:rand(-60,60), vy:rand(-60,40), life:rand(.25,.55), r:rand(2,4) });
  updateHud();
  if (state.carriedItems.length >= bagLimit()) toast('Mochila cheia! Entregue ♻️');
}

function deliverItems() {
  if (!state.deliveredNear) { toast('Chegue perto do EcoPonto.'); return; }
  if (!state.carriedItems.length) { toast('Colete tampinhas e lacres primeiro.'); return; }
  let score = state.carriedScore;
  state.deliveredScore += score; state.levelCoinsEarned += score; state.bankCoins += score;
  state.carriedItems = []; state.carriedScore = 0;
  state.floatingTexts.push({ x:deliverZone.x+deliverZone.w/2, y:deliverZone.y, text:`+${score} EcoCoins`, life:1.2 });
  toast(`Entrega feita! +${score} EcoCoins`);
  saveProgress(); updateHud();
  if (state.deliveredScore >= currentLevel().goal) completeLevel();
}

// ─── HUD + SHOP ──────────────────────────────────────────────────────────────
function updateHud() {
  const level = currentLevel();
  $('levelName').textContent = level.short;
  $('goalText').textContent = `${Math.min(state.deliveredScore, level.goal)}/${level.goal}`;
  $('bagText').textContent = `${state.carriedItems.length}/${bagLimit()}`;
  $('coinsText').textContent = state.bankCoins;
  $('timeText').textContent = Math.max(0, Math.ceil(state.timeLeft));
  $('progressBar').style.width = `${clamp((state.deliveredScore/level.goal)*100, 0, 100)}%`;
}
function updateShop() {
  $('shopCoinsText').textContent = `Você tem ${state.bankCoins} EcoCoins.`;
  $('buyBagBtn').textContent = state.bagUpgrade>=3 ? 'Mochila no máximo' : `Comprar, ${40+state.bagUpgrade*30} moedas`;
  $('buyBagBtn').disabled = state.bagUpgrade>=3;
  $('buySpeedBtn').textContent = state.speedUpgrade>=3 ? 'Velocidade no máximo' : `Comprar, ${55+state.speedUpgrade*35} moedas`;
  $('buySpeedBtn').disabled = state.speedUpgrade>=3;
  $('buySkinBtn').textContent = state.specialSkin ? 'Skin desbloqueada' : 'Comprar, 75 moedas';
  $('buySkinBtn').disabled = state.specialSkin;
}
function buy(type) {
  let cost = 0;
  if (type==='bag') cost = 40+state.bagUpgrade*30;
  if (type==='speed') cost = 55+state.speedUpgrade*35;
  if (type==='skin') cost = 75;
  if (state.bankCoins < cost) { toast('EcoCoins insuficientes.'); return; }
  state.bankCoins -= cost;
  if (type==='bag') state.bagUpgrade++;
  if (type==='speed') state.speedUpgrade++;
  if (type==='skin') state.specialSkin = true;
  saveProgress(); updateHud(); updateShop(); toast('Melhoria desbloqueada!');
}

// ─── OBJECTIVE INDICATOR ─────────────────────────────────────────────────────
const objEl = $('objIndicator');

function hideObjIndicator() { objEl.style.display = 'none'; }

function updateObjIndicator() {
  if (state.mode !== 'playing') { hideObjIndicator(); return; }

  const shellW = shell.clientWidth;
  const shellH = shell.clientHeight;

  // World pos of EcoPonto center
  const dzWx = deliverZone.x + deliverZone.w/2;
  const dzWy = deliverZone.y + deliverZone.h/2;

  // Convert world -> screen
  const sx = (dzWx - cam.x) * cam.zoom;
  const sy = (dzWy - cam.y) * cam.zoom;

  const margin = 26;
  const inView = sx > margin && sx < shellW - margin && sy > margin && sy < shellH - margin;

  if (inView) {
    hideObjIndicator();
    return;
  }

  // Clamp to edge
  const cx = clamp(sx, margin, shellW - margin);
  const cy = clamp(sy, margin, shellH - margin);

  objEl.style.display = 'flex';
  objEl.style.left = (cx - 18) + 'px';
  objEl.style.top  = (cy - 18) + 'px';

  // Rotate arrow to point towards the ecoponto
  const angle = Math.atan2(sy - shellH/2, sx - shellW/2);
  objEl.style.transform = `rotate(${angle}rad)`;
  objEl.textContent = '➤'; // simple arrow
}

// ─── JOYSTICK ────────────────────────────────────────────────────────────────
const jZone = $('joystickZone');
const jBase = $('joystickBase');
const jThumb = $('joystickThumb');
const JOYSTICK_MAX = 46;
let jsTouch = null;
let jsOrigin = { x:0, y:0 };

function getJoystickRect() { return jZone.getBoundingClientRect(); }

jZone.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  jsTouch = t.identifier;
  const r = getJoystickRect();
  jsOrigin.x = t.clientX - r.left;
  jsOrigin.y = t.clientY - r.top;
  // Move base to touch origin
  jBase.style.left = (jsOrigin.x - 60) + 'px';
  jBase.style.top  = (jsOrigin.y - 60) + 'px';
  jBase.style.transform = 'none';
  jThumb.style.left = (jsOrigin.x - 26) + 'px';
  jThumb.style.top  = (jsOrigin.y - 26) + 'px';
  jThumb.style.transform = 'none';
  state.joystick.active = true;
}, { passive: false });

jZone.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier !== jsTouch) continue;
    const r = getJoystickRect();
    const dx = t.clientX - r.left - jsOrigin.x;
    const dy = t.clientY - r.top  - jsOrigin.y;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, JOYSTICK_MAX);
    const nx = dx / len * clamped;
    const ny = dy / len * clamped;
    state.joystick.dx = dx / len;
    state.joystick.dy = dy / len;
    jThumb.style.left = (jsOrigin.x + nx - 26) + 'px';
    jThumb.style.top  = (jsOrigin.y + ny - 26) + 'px';
  }
}, { passive: false });

function resetJoystick() {
  jsTouch = null;
  state.joystick.active = false;
  state.joystick.dx = 0;
  state.joystick.dy = 0;
  // Reset base to center
  jBase.style.left = ''; jBase.style.top = ''; jBase.style.transform = '';
  jThumb.style.left = ''; jThumb.style.top = ''; jThumb.style.transform = '';
}

jZone.addEventListener('touchend', e => { for (const t of e.changedTouches) if (t.identifier===jsTouch) resetJoystick(); }, { passive: false });
jZone.addEventListener('touchcancel', e => { for (const t of e.changedTouches) if (t.identifier===jsTouch) resetJoystick(); }, { passive: false });

$('deliverBtn').addEventListener('pointerdown', e => { e.preventDefault(); deliverItems(); });

// ─── KEYBOARD ────────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  const k = e.key.length===1 ? e.key.toLowerCase() : e.key;
  state.keys[k] = true;
  if ((e.key===' ' || e.key==='Enter') && state.mode==='playing') e.preventDefault();
  if (e.key==='Escape' && state.mode==='playing') pauseGame();
});
window.addEventListener('keyup', e => { const k = e.key.length===1 ? e.key.toLowerCase() : e.key; state.keys[k] = false; });

// ─── UPDATE ──────────────────────────────────────────────────────────────────
function update(dt) {
  if (state.mode !== 'playing') return;
  const p = state.player;
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) { state.timeLeft=0; updateHud(); gameOver(); return; }
  p.inv = Math.max(0, p.inv - dt);

  let x = 0, y = 0;
  if (state.keys.ArrowLeft || state.keys.a) x -= 1;
  if (state.keys.ArrowRight || state.keys.d) x += 1;
  if (state.keys.ArrowUp || state.keys.w) y -= 1;
  if (state.keys.ArrowDown || state.keys.s) y += 1;
  if (state.joystick.active) { x += state.joystick.dx; y += state.joystick.dy; }

  const mag = Math.hypot(x, y) || 1;
  x /= mag; y /= mag;
  p.speed = playerSpeed();
  let nx = p.x + x * p.speed * dt;
  let ny = p.y + y * p.speed * dt;
  nx = clamp(nx, p.r+8, world.w-p.r-8);
  ny = clamp(ny, p.r+78, world.h-p.r-8);

  let hit = false;
  for (const o of state.obstacles) {
    if (circleRectCollision({x:nx, y:ny, r:p.r}, o)) { hit=true; break; }
  }
  if (!hit) { p.x = nx; p.y = ny; }
  else if (p.inv <= 0) {
    p.inv = .85; state.timeLeft = Math.max(0, state.timeLeft-2);
    toast('Cuidado! Obstáculo tira tempo.');
  }

  for (let i = state.items.length-1; i >= 0; i--) {
    if (dist(p, state.items[i]) < p.r + state.items[i].r + 4) collectItem(state.items[i], i);
  }

  state.deliveredNear = circleRectCollision({x:p.x, y:p.y, r:p.r}, deliverZone);
  $('deliverBtn').classList.toggle('near-zone', state.deliveredNear && state.carriedItems.length > 0);

  if (state.deliveredNear && state.carriedItems.length && (state.keys[' '] || state.keys.Enter)) {
    state.keys[' '] = false; state.keys.Enter = false; deliverItems();
  }

  if (state.items.length < 16 && state.deliveredScore + state.carriedScore < currentLevel().goal) {
    const c = Math.random();
    if (c < .02) addItem('cap');
    else if (c < .032 && state.levelIndex>=1) addItem('tab');
    else if (c < .037 && state.levelIndex>=3) addItem('rare');
  }

  updateCamera();
  updateObjIndicator();
  updateHud();
}

// ─── DRAW HELPERS ────────────────────────────────────────────────────────────
function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

// ─── DRAW ────────────────────────────────────────────────────────────────────
function draw(dt, t) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply camera transform
  ctx.scale(dpr * cam.zoom, dpr * cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  drawBackground();
  drawItems(t);
  drawObstacles();
  drawPlayer();
  drawParticles(dt);
  if (state.mode === 'playing') drawHelperText();
  if (state.mode === 'menu') {
    ctx.save();
    ctx.globalAlpha = .9;
    ctx.font = '900 34px system-ui';
    ctx.fillStyle = 'rgba(24,49,39,.35)';
    ctx.textAlign = 'center';
    ctx.fillText('EcoPatinhas', world.w/2, 278);
    ctx.font = '700 17px system-ui';
    ctx.fillText('colete • recicle • ajude animais', world.w/2, 308);
    ctx.restore();
  }

  ctx.restore();
}

function drawBackground() {
  ctx.fillStyle = cssVar('--tile-a');
  ctx.fillRect(0, 0, world.w, world.h);

  ctx.globalAlpha = .45;
  ctx.fillStyle = cssVar('--road');
  drawRoundedRect(64, 160, 840, 86, 44); ctx.fill();
  drawRoundedRect(310, 60, 90, 420, 45); ctx.fill();
  drawRoundedRect(70, 386, 760, 72, 36); ctx.fill();
  ctx.globalAlpha = 1;

  for (let gy=34; gy<world.h; gy+=68) {
    for (let gx=32; gx<world.w; gx+=84) {
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.arc(gx, gy, 2.2, 0, Math.PI*2); ctx.fill();
    }
  }

  drawDeliverZone();
  drawMapDecor();
}

function drawMapDecor() {
  const trees = [[70,80],[870,104],[90,462],[516,83],[720,486]];
  for (const [tx,ty] of trees) {
    ctx.fillStyle = 'rgba(60,120,70,.25)';
    ctx.beginPath(); ctx.arc(tx, ty+16, 18, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = cssVar('--primary');
    ctx.beginPath(); ctx.arc(tx, ty, 22, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(80,54,28,.55)';
    drawRoundedRect(tx-5, ty+15, 10, 24, 4); ctx.fill();
  }
  ctx.font = '700 16px system-ui';
  ctx.fillStyle = 'rgba(24,49,39,.42)';
  ctx.fillText('ONG Amiga dos Pets', 748, 496);
  ctx.fillText('EcoPonto', deliverZone.x+22, deliverZone.y-8);
}

function drawDeliverZone() {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 16;
  ctx.fillStyle = cssVar('--zone');
  drawRoundedRect(deliverZone.x, deliverZone.y, deliverZone.w, deliverZone.h, 24); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = state.deliveredNear ? cssVar('--primary') : 'rgba(0,0,0,.12)';
  ctx.lineWidth = state.deliveredNear ? 5 : 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  drawRoundedRect(deliverZone.x+18, deliverZone.y+22, deliverZone.w-36, 52, 16); ctx.fill();
  ctx.font = '34px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('♻️', deliverZone.x+deliverZone.w/2, deliverZone.y+60);
  ctx.font = '800 12px system-ui'; ctx.fillStyle = '#553f12';
  ctx.fillText('ENTREGAR', deliverZone.x+deliverZone.w/2, deliverZone.y+93);
  ctx.restore();
}

function drawItems(t) {
  for (const item of state.items) {
    item.pulse += .04;
    const bob = Math.sin(item.pulse) * 2;
    ctx.save(); ctx.translate(item.x, item.y + bob);
    ctx.shadowColor = 'rgba(0,0,0,.16)'; ctx.shadowBlur = 8;
    if (item.type === 'cap') {
      ctx.fillStyle = '#4aa3df';
      ctx.beginPath(); ctx.arc(0, 0, item.r, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath(); ctx.arc(0, -2, item.r*.48, 0, Math.PI*2); ctx.fill();
    } else if (item.type === 'tab') {
      ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(0,0,11,7,.25,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle = '#f3f3f3'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0,0,6,3,.25,0,Math.PI*2); ctx.stroke();
    } else {
      ctx.fillStyle = cssVar('--secondary');
      ctx.beginPath();
      for (let si=0; si<5; si++) {
        const a = -Math.PI/2 + si*Math.PI*2/5;
        const ix = Math.cos(a)*item.r; const iy = Math.sin(a)*item.r;
        si===0 ? ctx.moveTo(ix,iy) : ctx.lineTo(ix,iy);
        const b = a + Math.PI/5;
        ctx.lineTo(Math.cos(b)*item.r*.45, Math.sin(b)*item.r*.45);
      }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

function drawObstacles() {
  for (const o of state.obstacles) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 10;
    if (o.type === 'trash') {
      ctx.fillStyle = '#6b7b84';
      drawRoundedRect(o.x, o.y, o.w, o.h, 12); ctx.fill();
      ctx.fillStyle = '#46535a';
      drawRoundedRect(o.x+6, o.y-7, o.w-12, 10, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillRect(o.x+o.w*.35, o.y+8, o.w*.1, o.h-14);
      ctx.fillRect(o.x+o.w*.58, o.y+8, o.w*.1, o.h-14);
    } else if (o.type === 'puddle') {
      ctx.fillStyle = 'rgba(83,171,220,.72)';
      ctx.beginPath(); ctx.ellipse(o.x+o.w/2, o.y+o.h/2, o.w*.58, o.h*.42, -.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.beginPath(); ctx.ellipse(o.x+o.w*.42, o.y+o.h*.38, o.w*.18, o.h*.09, -.2, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.strokeStyle = '#42464d'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(o.x+10, o.y+o.h-10, 12, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(o.x+o.w-10, o.y+o.h-10, 12, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(o.x+10, o.y+o.h-10);
      ctx.lineTo(o.x+o.w*.5, o.y+10);
      ctx.lineTo(o.x+o.w-10, o.y+o.h-10);
      ctx.lineTo(o.x+o.w*.35, o.y+o.h-10);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPlayer() {
  const p = state.player;
  ctx.save(); ctx.translate(p.x, p.y);
  const blink = p.inv>0 && Math.floor(p.inv*12)%2===0;
  ctx.globalAlpha = blink ? .55 : 1;
  ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 16;
  ctx.fillStyle = state.specialSkin ? cssVar('--secondary') : cssVar('--primary');
  ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.96)';
  ctx.beginPath(); ctx.arc(-7,-4,4,0,Math.PI*2); ctx.arc(7,-4,4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#183127';
  ctx.beginPath(); ctx.arc(-7,-4,1.7,0,Math.PI*2); ctx.arc(7,-4,1.7,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#183127'; ctx.lineWidth=2; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(0,4,7,0,Math.PI); ctx.stroke();
  ctx.font = '20px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(state.specialSkin?'🐱':'🐶', 0, -23);
  if (state.carriedItems.length) {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    drawRoundedRect(-16, 14, 32, 20, 8); ctx.fill();
    ctx.fillStyle = cssVar('--primary-dark');
    ctx.font = '800 11px system-ui'; ctx.fillText(state.carriedItems.length, 0, 28);
  }
  ctx.restore();
}

function drawParticles(dt) {
  for (let i=state.particles.length-1; i>=0; i--) {
    const p = state.particles[i];
    p.life -= dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 80*dt;
    if (p.life<=0) { state.particles.splice(i,1); continue; }
    ctx.globalAlpha = clamp(p.life*2, 0, 1);
    ctx.fillStyle = cssVar('--secondary');
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (let i=state.floatingTexts.length-1; i>=0; i--) {
    const f = state.floatingTexts[i];
    f.life -= dt; f.y -= 32*dt;
    if (f.life<=0) { state.floatingTexts.splice(i,1); continue; }
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.font = '900 18px system-ui'; ctx.textAlign = 'center';
    ctx.fillStyle = '#183127'; ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
}

function drawHelperText() {
  const msg = state.deliveredNear
    ? 'Aperte ESPAÇO ou toque ♻️ para entregar.'
    : 'Colete tampinhas e lacres. Leve até o EcoPonto!';
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.78)';
  drawRoundedRect(28, world.h-54, 420, 34, 17); ctx.fill();
  ctx.fillStyle = '#183127'; ctx.font = '800 14px system-ui'; ctx.textAlign = 'left';
  ctx.fillText(msg, 46, world.h-32);
  ctx.restore();
}

// ─── MAIN LOOP ────────────────────────────────────────────────────────────────
function loop(t) {
  const dt = Math.min(.033, (t - state.lastTime) / 1000 || 0);
  state.lastTime = t;
  update(dt);
  draw(dt, t/1000);
  requestAnimationFrame(loop);
}

// ─── AUDIO ENGINE ────────────────────────────────────────────────────────────
const audio = (() => {
  let ctx = null;
  let masterGain = null;
  let menuMusicNode = null;
  let menuMusicGain = null;
  let muted = false;
  let menuPlaying = false;

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.72;
      masterGain.connect(ctx.destination);
    } catch(e) { /* no audio support */ }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function toggleMute() {
    if (!ctx) return;
    muted = !muted;
    masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, ctx.currentTime, 0.05);
    $('muteBtn').textContent = muted ? '🔇' : '🔊';
  }

  // Generic oscillator-based synth helper
  function synth({ type='sine', freq=440, freqEnd=null, attack=0.01, hold=0, decay=0.25,
                   vol=0.35, volEnd=0, detune=0, when=0, dest=null }) {
    if (!ctx) return;
    const now = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + attack + hold + decay);
    if (detune) osc.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    if (hold > 0) gain.gain.setValueAtTime(vol, now + attack + hold);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volEnd), now + attack + hold + decay);
    gain.gain.linearRampToValueAtTime(0.0001, now + attack + hold + decay + 0.02);
    osc.connect(gain);
    gain.connect(dest || masterGain);
    osc.start(now);
    osc.stop(now + attack + hold + decay + 0.05);
    return { osc, gain };
  }

  // Noise burst for percussive sounds
  function noise({ duration=0.1, vol=0.3, attack=0.005, freq=800, q=1, when=0 }) {
    if (!ctx) return;
    const now = ctx.currentTime + (when || 0);
    const bufSize = Math.ceil(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0; i<bufSize; i++) data[i] = Math.random()*2-1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter); filter.connect(gain); gain.connect(masterGain);
    src.start(now); src.stop(now + duration + 0.05);
  }

  // ── SOUND DEFINITIONS ──────────────────────────────────────────────────────

  // 1) COLLECT PLASTIC CAP — light click + pop
  function collectCap() {
    init(); resume();
    // Soft pop
    synth({ type:'sine', freq:680, freqEnd:280, attack:0.005, hold:0, decay:0.12, vol:0.28 });
    noise({ duration:0.06, vol:0.1, attack:0.002, freq:1200, q:2 });
  }

  // 2) COLLECT METAL TAB — metallic clink
  function collectTab() {
    init(); resume();
    // High metallic ping
    synth({ type:'triangle', freq:1320, freqEnd:880, attack:0.002, hold:0.01, decay:0.22, vol:0.3, detune:5 });
    synth({ type:'sine',     freq:1320, freqEnd:660, attack:0.002, hold:0,    decay:0.18, vol:0.18, detune:-5, when:0.005 });
    noise({ duration:0.04, vol:0.12, attack:0.001, freq:2400, q:3 });
  }

  // 3) COLLECT RARE ITEM — sparkly stars
  function collectRare() {
    init(); resume();
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      synth({ type:'sine', freq:f, freqEnd:f*1.05, attack:0.01, hold:0.04, decay:0.28, vol:0.22, when:i*0.06 });
      synth({ type:'triangle', freq:f*2, attack:0.005, hold:0, decay:0.15, vol:0.1, when:i*0.06 });
    });
  }

  // 4) DELIVER TO ECOPONTO — warm chime chord + "reward" feel
  function deliver(score) {
    init(); resume();
    // Rising arpeggio
    const chord = score > 10 ? [523, 659, 784, 1047] : [440, 554, 659];
    chord.forEach((f, i) => {
      synth({ type:'sine',     freq:f,   attack:0.01, hold:0.12, decay:0.45, vol:0.26, when:i*0.07 });
      synth({ type:'triangle', freq:f*2, attack:0.01, hold:0.05, decay:0.3,  vol:0.1,  when:i*0.07 });
    });
    // Final sparkle
    noise({ duration:0.12, vol:0.14, attack:0.003, freq:3000, q:2, when:chord.length*0.07 });
  }

  // 5) LEVEL COMPLETE — victory fanfare
  function levelComplete() {
    init(); resume();
    // Triumphant ascending melody
    const melody = [
      { f:523, w:0.00 }, { f:659, w:0.12 }, { f:784, w:0.24 },
      { f:1047, w:0.36 }, { f:1047, w:0.48 }, { f:1175, w:0.60 },
      { f:1047, w:0.80 }
    ];
    melody.forEach(({ f, w }) => {
      synth({ type:'sine',     freq:f,   attack:0.01, hold:0.1, decay:0.28, vol:0.3,  when:w });
      synth({ type:'triangle', freq:f*2, attack:0.01, hold:0.05, decay:0.2, vol:0.12, when:w });
    });
    // Stars/glitter noise bursts
    [0.36, 0.6, 0.9].forEach(w => {
      noise({ duration:0.15, vol:0.18, attack:0.003, freq:2800, q:1.5, when:w });
    });
    // Bass hit at start
    synth({ type:'sine', freq:130, freqEnd:65, attack:0.01, hold:0.08, decay:0.4, vol:0.38 });
  }

  // 6) GAME OVER — drooping sad tones, not annoying
  function gameOver() {
    init(); resume();
    const sad = [
      { f:392, w:0.00 }, { f:370, w:0.22 }, { f:330, w:0.44 }, { f:262, w:0.70 }
    ];
    sad.forEach(({ f, w }) => {
      synth({ type:'sine',     freq:f,   attack:0.02, hold:0.14, decay:0.4, vol:0.28, when:w });
      synth({ type:'triangle', freq:f*.5, attack:0.02, hold:0.1, decay:0.5, vol:0.12, when:w });
    });
    // Low thud
    synth({ type:'sine', freq:80, freqEnd:40, attack:0.01, hold:0.05, decay:0.6, vol:0.3, when:0.75 });
  }

  // 7) OBSTACLE HIT — quick warning bump
  function obstacleHit() {
    init(); resume();
    synth({ type:'sawtooth', freq:220, freqEnd:110, attack:0.005, hold:0, decay:0.18, vol:0.28 });
    noise({ duration:0.07, vol:0.15, attack:0.002, freq:600, q:1.5 });
  }

  // 8) MENU MUSIC — gentle looping ambient music
  function buildMenuMusic() {
    if (!ctx || menuPlaying) return;
    menuPlaying = true;

    menuMusicGain = ctx.createGain();
    menuMusicGain.gain.value = 0;
    menuMusicGain.connect(masterGain);

    // Fade in
    menuMusicGain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 1.2);

    // Schedule notes in a loop using a recursive scheduler
    const tempo = 0.52; // seconds per beat
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]; // C major
    let beat = 0;
    let stopped = false;

    const melodyPattern = [0, 2, 4, 5, 4, 2, 0, 3, 2, 4, 5, 7, 5, 4, 2, 0];
    const bassPattern   = [0, 0, 4, 4, 3, 3, 2, 2];
    let melBeat = 0, bassBeat = 0;

    function scheduleLoop() {
      if (stopped || !ctx) return;
      const now = ctx.currentTime;
      const lookAhead = 0.6;

      // Melody
      while (melBeat * tempo < now + lookAhead - (menuMusicGain._startTime || 0)) {
        const noteTime = (menuMusicGain._startTime || ctx.currentTime) + melBeat * tempo;
        if (noteTime >= now) {
          const noteIdx = melodyPattern[melBeat % melodyPattern.length];
          const freq = scale[noteIdx];
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, noteTime);
          gain.gain.linearRampToValueAtTime(0.18, noteTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + tempo * 0.75);
          osc.connect(gain); gain.connect(menuMusicGain);
          osc.start(noteTime); osc.stop(noteTime + tempo * 0.8);

          // Harmony (3rd above)
          const harmIdx = (noteIdx + 2) % scale.length;
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.value = scale[harmIdx];
          gain2.gain.setValueAtTime(0.0001, noteTime);
          gain2.gain.linearRampToValueAtTime(0.09, noteTime + 0.02);
          gain2.gain.exponentialRampToValueAtTime(0.0001, noteTime + tempo * 0.65);
          osc2.connect(gain2); gain2.connect(menuMusicGain);
          osc2.start(noteTime); osc2.stop(noteTime + tempo * 0.7);
        }
        melBeat++;
      }

      // Bass (every 2 beats)
      while (bassBeat * tempo * 2 < now + lookAhead - (menuMusicGain._startTime || 0)) {
        const noteTime = (menuMusicGain._startTime || ctx.currentTime) + bassBeat * tempo * 2;
        if (noteTime >= now) {
          const noteIdx = bassPattern[bassBeat % bassPattern.length];
          const freq = scale[noteIdx] * 0.25;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, noteTime);
          gain.gain.linearRampToValueAtTime(0.14, noteTime + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + tempo * 1.4);
          osc.connect(gain); gain.connect(menuMusicGain);
          osc.start(noteTime); osc.stop(noteTime + tempo * 1.5);
        }
        bassBeat++;
      }

      menuMusicNode = setTimeout(scheduleLoop, 200);
    }

    menuMusicGain._startTime = ctx.currentTime + 0.05;
    menuMusicGain._stop = () => { stopped = true; clearTimeout(menuMusicNode); };
    scheduleLoop();
  }

  function startMenuMusic() {
    init(); resume();
    if (!menuPlaying) buildMenuMusic();
  }

  function stopMenuMusic() {
    if (!ctx || !menuPlaying) return;
    menuPlaying = false;
    if (menuMusicGain) {
      menuMusicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      if (menuMusicGain._stop) menuMusicGain._stop();
      menuMusicGain = null;
    }
  }

  return {
    collectCap, collectTab, collectRare,
    deliver, levelComplete, gameOver, obstacleHit,
    startMenuMusic, stopMenuMusic,
    toggleMute, init, resume
  };
})();

// ─── AUDIO HOOKS ─────────────────────────────────────────────────────────────
// Wire audio to game events — we patch the existing functions

const _origCollectItem = collectItem;
// Override collectItem with audio
window._audioCollectItem = function(item, index) {
  if (item.type === 'cap') audio.collectCap();
  else if (item.type === 'tab') audio.collectTab();
  else if (item.type === 'rare') audio.collectRare();
};

const _origDeliverItems = deliverItems;
const _origCompleteLevel = completeLevel;
const _origGameOver = gameOver;
const _origGoMenu = goMenu;
const _origStartGame = startGame;

// Patch collectItem
function collectItem(item, index) {
  if (state.carriedItems.length >= bagLimit()) { toast('Mochila cheia, vá ao ponto de coleta!'); return; }
  if (item.type === 'cap') audio.collectCap();
  else if (item.type === 'tab') audio.collectTab();
  else if (item.type === 'rare') audio.collectRare();
  state.carriedItems.push(item); state.carriedScore += item.value;
  state.items.splice(index, 1);
  state.floatingTexts.push({ x:item.x, y:item.y, text:item.type==='cap'?'+tampinha':item.type==='tab'?'+lacre':'+item raro', life:1 });
  for (let i=0;i<8;i++) state.particles.push({ x:item.x, y:item.y, vx:rand(-60,60), vy:rand(-60,40), life:rand(.25,.55), r:rand(2,4) });
  updateHud();
  if (state.carriedItems.length >= bagLimit()) toast('Mochila cheia! Entregue ♻️');
}

function deliverItems() {
  if (!state.deliveredNear) { toast('Chegue perto do EcoPonto.'); return; }
  if (!state.carriedItems.length) { toast('Colete tampinhas e lacres primeiro.'); return; }
  let score = state.carriedScore;
  state.deliveredScore += score; state.levelCoinsEarned += score; state.bankCoins += score;
  state.carriedItems = []; state.carriedScore = 0;
  state.floatingTexts.push({ x:deliverZone.x+deliverZone.w/2, y:deliverZone.y, text:`+${score} EcoCoins`, life:1.2 });
  toast(`Entrega feita! +${score} EcoCoins`);
  audio.deliver(score);
  saveProgress(); updateHud();
  if (state.deliveredScore >= currentLevel().goal) completeLevel();
}

function completeLevel() {
  const level = currentLevel();
  const bonus = 10 + state.levelIndex*6 + Math.max(0, Math.floor(state.timeLeft/5));
  state.bankCoins += bonus; state.levelCoinsEarned += bonus;
  state.communityTotal += state.deliveredScore;
  $('levelTitle').textContent = state.levelIndex===levels.length-1 ? 'Grande mutirão concluído!' : 'Fase concluída!';
  $('levelSummary').textContent = `Você entregou ${state.deliveredScore} pts e acumulou ${state.levelCoinsEarned} EcoCoins.`;
  $('ecoFact').textContent = level.fact;
  $('animalsHelped').textContent = level.animal;
  $('rewardText').textContent = `+${bonus} EcoCoins. Total da comunidade: ${state.communityTotal.toLocaleString('pt-BR')} recicláveis.`;
  $('nextLevelBtn').textContent = state.levelIndex===levels.length-1 ? 'Jogar novamente' : 'Próxima fase';
  state.mode = 'level'; showScreen('level');
  audio.levelComplete();
  saveProgress(); updateHud(); updateShop(); hideObjIndicator();
}

function gameOver() {
  state.bankCoins += Math.floor(state.carriedScore/2);
  saveProgress();
  $('gameOverText').textContent = `Você entregou ${state.deliveredScore}/${currentLevel().goal}. EcoCoins totais: ${state.bankCoins}.`;
  state.mode = 'gameOver'; showScreen('gameOver'); updateShop(); hideObjIndicator();
  audio.gameOver();
}

function startGame() {
  audio.stopMenuMusic();
  audio.init(); audio.resume();
  state.mode = 'playing';
  buildLevel();
  showScreen(null);
  toast('Colete e entregue no ponto ♻️');
}

function goMenu() {
  state.mode='menu'; showScreen('menu'); updateShop(); hideObjIndicator();
  audio.startMenuMusic();
}

// Patch obstacle hit in update
const _origUpdate = update;
function update(dt) {
  if (state.mode !== 'playing') return;
  const p = state.player;
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) { state.timeLeft=0; updateHud(); gameOver(); return; }
  const prevInv = p.inv;
  p.inv = Math.max(0, p.inv - dt);

  let x = 0, y = 0;
  if (state.keys.ArrowLeft || state.keys.a) x -= 1;
  if (state.keys.ArrowRight || state.keys.d) x += 1;
  if (state.keys.ArrowUp || state.keys.w) y -= 1;
  if (state.keys.ArrowDown || state.keys.s) y += 1;
  if (state.joystick.active) { x += state.joystick.dx; y += state.joystick.dy; }

  const mag = Math.hypot(x, y) || 1;
  x /= mag; y /= mag;
  p.speed = playerSpeed();
  let nx = p.x + x * p.speed * dt;
  let ny = p.y + y * p.speed * dt;
  nx = clamp(nx, p.r+8, world.w-p.r-8);
  ny = clamp(ny, p.r+78, world.h-p.r-8);

  let hit = false;
  for (const o of state.obstacles) {
    if (circleRectCollision({x:nx, y:ny, r:p.r}, o)) { hit=true; break; }
  }
  if (!hit) { p.x = nx; p.y = ny; }
  else if (p.inv <= 0) {
    p.inv = .85; state.timeLeft = Math.max(0, state.timeLeft-2);
    toast('Cuidado! Obstáculo tira tempo.');
    audio.obstacleHit();
  }

  for (let i = state.items.length-1; i >= 0; i--) {
    if (dist(p, state.items[i]) < p.r + state.items[i].r + 4) collectItem(state.items[i], i);
  }

  state.deliveredNear = circleRectCollision({x:p.x, y:p.y, r:p.r}, deliverZone);
  $('deliverBtn').classList.toggle('near-zone', state.deliveredNear && state.carriedItems.length > 0);

  if (state.deliveredNear && state.carriedItems.length && (state.keys[' '] || state.keys.Enter)) {
    state.keys[' '] = false; state.keys.Enter = false; deliverItems();
  }

  if (state.items.length < 16 && state.deliveredScore + state.carriedScore < currentLevel().goal) {
    const c = Math.random();
    if (c < .02) addItem('cap');
    else if (c < .032 && state.levelIndex>=1) addItem('tab');
    else if (c < .037 && state.levelIndex>=3) addItem('rare');
  }

  updateCamera();
  updateObjIndicator();
  updateHud();
}

// Start menu music on first user interaction
document.addEventListener('pointerdown', () => { audio.init(); audio.resume(); audio.startMenuMusic(); }, { once: true });
document.addEventListener('keydown', () => { audio.init(); audio.resume(); audio.startMenuMusic(); }, { once: true });

// ─── EVENT WIRING ────────────────────────────────────────────────────────────
$('startBtn').addEventListener('click', startGame);
$('pauseBtn').addEventListener('click', pauseGame);
$('resumeBtn').addEventListener('click', resumeGame);
$('backMenuBtn').addEventListener('click', goMenu);
$('nextLevelBtn').addEventListener('click', nextLevel);
$('menuAfterLevelBtn').addEventListener('click', goMenu);
$('retryBtn').addEventListener('click', startGame);
$('menuAfterGameOverBtn').addEventListener('click', goMenu);
$('shopBtn').addEventListener('click', () => { updateShop(); showScreen('shop'); });
$('closeShopBtn').addEventListener('click', () => showScreen('menu'));
$('buyBagBtn').addEventListener('click', () => buy('bag'));
$('buySpeedBtn').addEventListener('click', () => buy('speed'));
$('buySkinBtn').addEventListener('click', () => buy('skin'));
$('muteBtn').addEventListener('click', () => { audio.init(); audio.resume(); audio.toggleMute(); });
$('resetBtn').addEventListener('click', () => {
  if (!confirm('Zerar moedas, fases e melhorias?')) return;
  ['ecopatinhas_level','ecopatinhas_coins','ecopatinhas_bag','ecopatinhas_speed','ecopatinhas_skin','ecopatinhas_total'].forEach(k => localStorage.removeItem(k));
  state.levelIndex=0; state.bankCoins=0; state.bagUpgrade=0; state.speedUpgrade=0; state.specialSkin=false; state.communityTotal=0;
  updateHud(); updateShop(); toast('Progresso zerado.');
});
document.querySelectorAll('.theme-card').forEach(card => card.addEventListener('click', () => applyTheme(card.dataset.theme)));

// ─── BOOT ────────────────────────────────────────────────────────────────────
applyTheme(state.theme);
resizeCanvas();
updateCamera();
buildLevel();
updateShop();
requestAnimationFrame(loop);
