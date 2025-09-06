/* ========================
   Bubble Pop - starter
   ======================== */
const BUILD = 15; // زوّد الرقم عند كل نشر
const LEVELS_URL = (window.BP_CFG && window.BP_CFG.json) || ('bubble.json?v=' + BUILD);
const START_LEVEL = (window.BP_CFG && +window.BP_CFG.start) || 0;

const Q = (id) => document.getElementById(id);

// DOM refs
const cvs = Q('stage');
const ctx = cvs.getContext('2d');
const hudLevel = Q('hudLevel');
const hudHits  = Q('hudHits');
const hudTime  = Q('hudTime');
const s1 = Q('s1'), s2 = Q('s2'), s3 = Q('s3');
const progressBar = Q('progressBar');
const overlay = Q('overlay');
const ovTitle = Q('ovTitle');
const ovMsg = Q('ovMsg');
const btnRetry = Q('btnRetry');
const btnNext = Q('btnNext');

// State
let DATA = null;
let LVL = START_LEVEL;
let running = false;
let t0 = 0, now = 0;
let hits = 0;
let stars = 0;
let guardUntil = 0;             // Guard window ms timestamp
let bubbles = [];
let nextSpawnAt = 0;

// helpers
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const ms = ()=>performance.now();
function fmtTime(msLeft){
  const s = Math.max(0, Math.ceil(msLeft/1000));
  const mm = String(Math.floor(s/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${mm}:${ss}`;
}

async function loadJSON(url){
  const r = await fetch(url, {cache:'no-store'});
  if(!r.ok) throw new Error('JSON fetch failed: ' + r.status);
  return r.json();
}

// Visuals
function drawBG(){
  // خلفية داكنة + هالة خفيفة
  const g = ctx.createRadialGradient(cvs.width*0.7, cvs.height*0.2, 40, cvs.width*0.5, cvs.height*0.4, Math.max(cvs.width,cvs.height));
  g.addColorStop(0, '#0f2236');
  g.addColorStop(0.6, '#0a1928');
  g.addColorStop(1, '#07121d');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,cvs.width,cvs.height);
}

function bubbleGradient(x,y,r, base){
  // base لون أساس من الـpalette
  const grad = ctx.createRadialGradient(x-r*0.3, y-r*0.3, r*0.1, x, y, r);
  // ظل داخلي وخارجي خفيف لمحاكاة 3D
  grad.addColorStop(0.0, shade(base, 1.2)); // highlight
  grad.addColorStop(0.5, base);
  grad.addColorStop(1.0, shade(base, 0.7)); // rim
  return grad;
}
function shade(hex, k){
  // hex -> scale
  const c = hex.replace('#','');
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  const s = (v)=>clamp(Math.round(v*k),0,255);
  return `rgb(${s(r)},${s(g)},${s(b)})`;
}

// Game objects
function spawnBubble(levelCfg){
  const r = levelCfg.radius_px|0;
  const x = Math.random()*(cvs.width - r*2) + r;
  const y = Math.random()*(cvs.height - r*2) + r;
  const id = Math.random().toString(36).slice(2);
  const color = pick(DATA.palette);
  const ttl = levelCfg.ttl_ms|0;
  return {id, x, y, r, color, born: now, die: now + ttl, popped:false};
}
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function scheduleNextSpawn(levelCfg){
  nextSpawnAt = now + (levelCfg.interval_ms|0);
}

function update(levelCfg){
  // remove expired
  bubbles = bubbles.filter(b => now < b.die && !b.popped);

  // spawn
  if(now >= nextSpawnAt){
    bubbles.push(spawnBubble(levelCfg));
    scheduleNextSpawn(levelCfg);
  }
}

function render(levelCfg){
  drawBG();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  bubbles.forEach(b=>{
    ctx.shadowColor = shade(b.color, 0.8);
    ctx.shadowBlur = 12;
    ctx.fillStyle = bubbleGradient(b.x, b.y, b.r, b.color);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();

    // لمعة صغيرة
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath();
    ctx.ellipse(b.x - b.r*0.35, b.y - b.r*0.35, b.r*0.25, b.r*0.18, 0, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.restore();

  // HUD
  const elapsed = now - t0;
  const left = Math.max(0, levelCfg.duration_ms - elapsed);
  hudTime.textContent = fmtTime(left);
  hudHits.textContent = String(hits);
  hudLevel.textContent = String(LVL+1);

  // progress & stars
  const ratio = clamp(hits / Math.max(1, levelCfg.win_hits), 0, 1);
  progressBar.style.width = (ratio*100).toFixed(1) + '%';

  const thresholds = DATA.star_thresholds || [0.33,0.66,1.0];
  const st = (ratio >= thresholds[2]) ? 3 : (ratio >= thresholds[1]) ? 2 : (ratio >= thresholds[0]) ? 1 : 0;
  setStars(st);

  // end?
  if(left <= 0){
    endLevel(st, ratio >= thresholds[0]);
  }
}

function setStars(n){
  stars = n;
  [s1, s2, s3].forEach((el,i)=>{
    el.classList.toggle('on', i < n);
  });
}

function pointHitBubble(px,py){
  // أسرع اختبار: أقرب مركز
  for(let i=bubbles.length-1; i>=0; --i){
    const b = bubbles[i];
    const dx = px - b.x, dy = py - b.y;
    if(dx*dx + dy*dy <= b.r*b.r){
      return i;
    }
  }
  return -1;
}

function tryPopAt(px,py){
  if(now < guardUntil) return; // Guard فعال
  const idx = pointHitBubble(px,py);
  if(idx >= 0){
    bubbles[idx].popped = true;
    hits++;
    // فتح Guard 800ms
    guardUntil = now + 800;
  }
}

// Inputs
cvs.addEventListener('pointerdown', (e)=>{
  const rect = cvs.getBoundingClientRect();
  const scaleX = cvs.width / rect.width;
  const scaleY = cvs.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top)  * scaleY;
  tryPopAt(x,y);
});

// Loop
function loop(levelCfg){
  if(!running) return;
  now = ms();
  update(levelCfg);
  render(levelCfg);
  requestAnimationFrame(()=>loop(levelCfg));
}

function startLevel(i){
  const levelCfg = DATA.levels[i];
  if(!levelCfg){ return; }

  // reset
  running = true;
  hits = 0; bubbles = [];
  setStars(0);
  nextSpawnAt = 0;
  guardUntil = 0;

  t0 = now = ms();
  scheduleNextSpawn(levelCfg);
  overlay.style.display = 'none';
  loop(levelCfg);
}

function endLevel(starsGot, passed){
  running = false;
  overlay.style.display = 'grid';
  ovTitle.textContent = passed ? 'Level Complete' : 'Time Up';
  ovMsg.textContent = passed
    ? `You earned ${starsGot} ${starsGot===1?'star':'stars'}!`
    : `Try again to reach the first star threshold.`;
}

btnRetry?.addEventListener('click', ()=>{
  overlay.style.display = 'none';
  startLevel(LVL);
});
btnNext?.addEventListener('click', ()=>{
  overlay.style.display = 'none';
  LVL = Math.min(LVL+1, (DATA.levels.length-1));
  startLevel(LVL);
});

// Boot
(async function boot(){
  try{
    DATA = await loadJSON(LEVELS_URL);
  }catch(e){
    console.error(e);
    // محاولة احتياطية إما ملف محلي بجوار السكربت
    try{ DATA = await loadJSON('bubble.json?v=' + BUILD); }
    catch(e2){ console.error(e2); alert('Failed to load levels JSON'); return; }
  }
  // sanity
  if(!Array.isArray(DATA.levels) || !DATA.levels.length){
    alert('Levels missing in JSON'); return;
  }
  if(!Array.isArray(DATA.palette) || !DATA.palette.length){
    DATA.palette = ['#47C3E7','#3BA9F5','#B14F75','#F54AC9'];
  }
  startLevel(LVL);
})();
