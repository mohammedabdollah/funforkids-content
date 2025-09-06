/* =========================================
   Bubble Pop (Polished) - Blogger Edition
   =========================================
   - Manual Start (no auto-run)
   - No-empty-screen: maintain min_active bubbles
   - Guard 800ms after each successful pop
   - HUD (Level/Hits/Time) + Progress + Stars
   - Cache-busting via BUILD and ?v=
   - Loads levels from window.BP_CFG.json or local fallback
*/

const BUILD = 16; // زد الرقم عند كل نشر
const LEVELS_URL = (window.BP_CFG && window.BP_CFG.json) || ('bubble.json?v=' + BUILD);
const START_LEVEL = (window.BP_CFG && +window.BP_CFG.start) || 0;

const Q = (id) => document.getElementById(id);

// DOM refs (تأكد IDs موجودة في القالب)
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

// ====== State ======
let DATA = null;
let LVL = START_LEVEL;
let running = false;
let paused = false;

let t0 = 0;          // level start time (ms)
let now = 0;         // current time (ms)
let hits = 0;
let stars = 0;
let guardUntil = 0;  // ms timestamp until which input is guarded

let bubbles = [];    // active bubbles
let nextSpawnAt = 0; // when to spawn next bubble

// ====== Helpers ======
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const ms = () => performance.now();

function fmtTime(msLeft){
  const s = Math.max(0, Math.ceil(msLeft/1000));
  const mm = String(Math.floor(s/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return ${mm}:${ss};
}

async function loadJSON(url){
  const r = await fetch(url, {cache: 'no-store'});
  if(!r.ok) throw new Error('JSON fetch failed: ' + r.status);
  return r.json();
}

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function shade(hex, k){
  const c = hex.replace('#','');
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  const s = (v)=>clamp(Math.round(v*k),0,255);
  return rgb(${s(r)},${s(g)},${s(b)});
}

function bubbleGradient(x,y,r, base){
  const grad = ctx.createRadialGradient(x-r*0.35, y-r*0.35, r*0.1, x, y, r);
  grad.addColorStop(0.00, shade(base, 1.22)); // highlight
  grad.addColorStop(0.45, base);
  grad.addColorStop(1.00, shade(base, 0.72)); // rim
  return grad;
}

// ====== Visuals ======
function drawBG(){
  const g = ctx.createRadialGradient(
    cvs.width*0.7, cvs.height*0.2, 40,
    cvs.width*0.5, cvs.height*0.4, Math.max(cvs.width, cvs.height)
  );
  g.addColorStop(0, '#0f2236');
  g.addColorStop(0.6, '#0a1928');
  g.addColorStop(1, '#07121d');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,cvs.width,cvs.height);
}

// ====== Game objects ======
function spawnBubble(levelCfg){
  const r = levelCfg.radius_px|0;
  const x = Math.random()*(cvs.width - r*2) + r;
  const y = Math.random()*(cvs.height - r*2) + r;
  const id = Math.random().toString(36).slice(2);
  const color = pick(DATA.palette);
  const ttl = levelCfg.ttl_ms|0;
  // optional slight drift:
  const vx = (Math.random()*2-1) * 0.15; // pixels per frame approx
  const vy = (Math.random()*2-1) * 0.15;
  return {id, x, y, r, color, born: now, die: now + ttl, popped:false, vx, vy};
}

function scheduleNextSpawn(levelCfg){
  nextSpawnAt = now + (levelCfg.interval_ms|0);
}

// ====== HUD / Stars ======
function setStars(n){
  stars = n;
  [s1, s2, s3].forEach((el,i)=> el.classList.toggle('on', i < n));
}

// ====== Input ======
function canvasToLocal(e){
  const rect = cvs.getBoundingClientRect();
  const scaleX = cvs.width / rect.width;
  const scaleY = cvs.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top)  * scaleY;
  return {x,y};
}

function pointHitBubble(px,py){
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
  if(!running || paused) return;
  if(now < guardUntil) return; // Guard
  const idx = pointHitBubble(px,py);
  if(idx >= 0){
    bubbles[idx].popped = true;
    hits++;
    guardUntil = now + 800; // 800ms حماية بعد كل ضربة ناجحة
  }
}

cvs.addEventListener('pointerdown', (e)=>{
  const p = canvasToLocal(e);
  tryPopAt(p.x, p.y);
});

// ====== Update / Render Loop ======
function update(levelCfg){
  // إزالة المفجّر/المنتهي
  bubbles = bubbles.filter(b => now < b.die && !b.popped);

  // حد أدنى من الفقاعات لمنع الفراغ
  const want = Math.max( (levelCfg.min_active|0) || 2, 1 );

  // لو الشاشة فاضية وعندنا انتظار طويل للسباون القادم → عجّل
  if(bubbles.length === 0 && now + 80 < nextSpawnAt){
    nextSpawnAt = now; // فورًا
  }

  // حافظ على الحد الأدنى
  while(bubbles.length < want){
    bubbles.push(spawnBubble(levelCfg));
  }

  // سباون دوري طبيعي
  if(now >= nextSpawnAt){
    bubbles.push(spawnBubble(levelCfg));
    scheduleNextSpawn(levelCfg);
  }

  // حركة انجراف خفيفة (اختياري/جمالي)
  for(const b of bubbles){
    b.x += b.vx || 0;
    b.y += b.vy || 0;
    // ارتداد لطيف عن الحواف
    if(b.x - b.r < 0){ b.x = b.r; b.vx = Math.abs(b.vx||0.12); }
    if(b.x + b.r > cvs.width){ b.x = cvs.width - b.r; b.vx = -Math.abs(b.vx||0.12); }
    if(b.y - b.r < 0){ b.y = b.r; b.vy = Math.abs(b.vy||0.12); }
    if(b.y + b.r > cvs.height){ b.y = cvs.height - b.r; b.vy = -Math.abs(b.vy||0.12); }
  }
}

function render(levelCfg){
  drawBG();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(const b of bubbles){
    ctx.shadowColor = shade(b.color, 0.85);
    ctx.shadowBlur = 12;
    ctx.fillStyle = bubbleGradient(b.x, b.y, b.r, b.color);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();

    // لمعة
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath();
    ctx.ellipse(b.x - b.r*0.35, b.y - b.r*0.35, b.r*0.25, b.r*0.18, 0, 0, Math.PI*2);
    ctx.fill();
  }
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

  // نهاية المستوى؟
  if(left <= 0){
    endLevel(st, ratio >= thresholds[0]);
  }
}

function loop(levelCfg){
  if(!running || paused) return;
  now = ms();
  update(levelCfg);
  render(levelCfg);
  requestAnimationFrame(()=>loop(levelCfg));
}

// ====== Level Control ======
function startLevel(i){
  const levelCfg = DATA.levels[i];
  if(!levelCfg){ return; }

  running = true;
  paused  = false;
  hits = 0;
  bubbles = [];
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

  const last = (LVL >= DATA.levels.length - 1);

  if(passed){
    ovTitle.textContent = 'Level Complete';
    ovMsg.textContent = You earned ${starsGot} ${starsGot===1?'star':'stars'}!;
    btnRetry.style.display = '';
    btnNext.style.display = '';
    btnNext.textContent = last ? 'Finish' : '→ Next';
    btnNext.onclick = ()=>{
      overlay.style.display = 'none';
      if(last){
        // آخر لفل — ارجع لشاشة البدء
        showStart();
      }else{
        LVL = Math.min(LVL+1, DATA.levels.length-1);
        startLevel(LVL);
      }
    };
  }else{
    ovTitle.textContent = 'Time Up';
    ovMsg.textContent = 'Try again to reach the first star threshold.';
    btnRetry.style.display = '';
    btnNext.style.display = last ? 'none' : '';
    btnNext.textContent = '→ Next';
    btnNext.onclick = ()=>{
      overlay.style.display = 'none';
      LVL = Math.min(LVL+1, DATA.levels.length-1);
      startLevel(LVL);
    };
  }
}

btnRetry?.addEventListener('click', ()=>{
  overlay.style.display = 'none';
  startLevel(LVL);
});

// ====== Start Screen (Manual Start) ======
function showStart(){
  running = false;
  paused = false;
  overlay.style.display = 'grid';
  ovTitle.textContent = 'Ready?';
  ovMsg.textContent = 'Tap Start to play';
  btnRetry.style.display = 'none';
  btnNext.style.display = '';
  btnNext.textContent = 'Start';
  btnNext.onclick = () => {
    btnRetry.style.display = '';
    btnNext.textContent = '→ Next';
    LVL = START_LEVEL || 0;
    overlay.style.display = 'none';
    startLevel(LVL);
  };
}

// ====== Boot ======
(async function boot(){
  try{
    DATA = await loadJSON(LEVELS_URL);
  }catch(e){
    console.error('[BubblePop] Primary JSON failed:', e);
    try{
      DATA = await loadJSON('bubble.json?v=' + BUILD);
    }catch(e2){
      console.error('[BubblePop] Fallback JSON failed:', e2);
      alert('Failed to load levels JSON');
      return;
    }
  }

  if(!DATA || !Array.isArray(DATA.levels) || !DATA.levels.length){
    alert('Levels missing in JSON'); return;
  }
  if(!Array.isArray(DATA.palette) || !DATA.palette.length){
    DATA.palette = ['#47C3E7','#3BA9F5','#B14F75','#F54AC9','#7DE38A'];
  }

  // لا تبدأ تلقائيًا — انتظر المستخدم
  showStart();
})();
