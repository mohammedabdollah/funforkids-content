// Bubble Pop — Final v1.2 (waves + target guard + next level + pro colors + enhanced bubbles)
export async function start({ stage, game, levelId='L1' }) {
  // ====== إعدادات عامة ======
  const S = Object.assign({ tts:true, confetti:true, progress:true, stars:true }, game?.settings||{});
  const level = (game.levels||[]).find(l=>l.id===levelId) || game.levels?.[0] || { time:35, target:10, wave:14 };

  // 🎨 لوحة الألوان (منك)
  const COLORS = [
    { id:'green',  hex:'#47C83E', ar:'أخضر',   en:'Green'  },
    { id:'blue',   hex:'#3BA9F5', ar:'أزرق',    en:'Blue'   },
    { id:'purple', hex:'#B147F5', ar:'بنفسجي', en:'Purple' },
    { id:'pink',   hex:'#F54AC9', ar:'وردي',   en:'Pink'   },
  ];

  const CFG = {
    time:   level.time   || 35,
    target: level.target || 10,
    wave:   level.wave   || 14,   // 👈 حجم الموجة
    minTargetPerWave: 3,          // 👈 على الأقل 3 من لون الهدف كل موجة
    waveGapMs: 4200               // 👈 المدة بين الموجات
  };

  const lang = (localStorage.getItem('ffk_lang') || (document.dir==='rtl'?'ar':'en')).toLowerCase();
  const t = (ar,en)=> lang==='ar'? ar : en;

  // ====== واجهة ======
  stage.innerHTML = `
    <div id="bp-wrap">
      <div id="hud">
        <span id="hud-time">⏱️ --</span>
        <span>·</span>
        <span id="hud-score">⭐ 0</span>
        <span id="hud-level" style="margin-inline-start:auto">${levelId}</span>
      </div>

      <div id="progress"><div id="bar"></div>
        <div id="stars"><span class="st">☆</span><span class="st">☆</span><span class="st">☆</span></div>
      </div>

      <div id="target"></div>
      <div id="playfield"></div>
    </div>
  `;

  const pf      = document.getElementById('playfield');
  const targetEl= document.getElementById('target');
  const hudTime = document.getElementById('hud-time');
  const hudScore= document.getElementById('hud-score');
  const bar     = document.getElementById('bar');
  const starsEl = Array.from(document.querySelectorAll('#stars .st'));

  // ====== state ======
  let time = CFG.time, score = 0;
  let targetColor = COLORS[0];       // كائن اللون الحالي
  let waveTimer=null, guardTimer=null, tickTimer=null;

  const NAME = Object.fromEntries(COLORS.map(c=>[c.id, (lang==='ar')?c.ar:c.en]));

  // ====== helpers ======
  function speak(msg){ try{ if(!S.tts) return; const u=new SpeechSynthesisUtterance(msg); u.lang=(lang==='ar')?'ar':'en-US'; speechSynthesis.cancel(); speechSynthesis.speak(u);}catch{} }
  function confetti(){ if(!S.confetti) return; const layer=document.createElement('div'); layer.className='confetti'; document.body.appendChild(layer); for(let i=0;i<24;i++){ const p=document.createElement('i'); p.style.left=(Math.random()*100)+'%'; p.style.setProperty('--h',(window.innerHeight+80)+'px'); p.style.background=['#f59e0b','#10b981','#3b82f6','#ef4444','#a855f7'][i%5]; layer.appendChild(p);} setTimeout(()=>layer.remove(),900); }
  function updateHUD(){ hudTime.textContent=`⏱️ ${time}`; hudScore.textContent=`⭐ ${score}`; if(S.progress){ const pct=Math.min(100,(score/CFG.target)*100); bar.style.width=pct+'%'; } if(S.stars){ const s1=score>=Math.ceil(CFG.target*.5), s2=score>=Math.ceil(CFG.target*.75), s3=score>=CFG.target; starsEl[0].textContent=s1?'★':'☆'; starsEl[1].textContent=s2?'★':'☆'; starsEl[2].textContent=s3?'★':'☆'; } }

  // ====== الهدف (Target) ======
  function setTarget(){
    targetColor = COLORS[Math.floor(Math.random()*COLORS.length)];
    targetEl.innerHTML = `
      <div class="tg" style="--c:${targetColor.hex}">
        <span class="dot"></span>
        ${t('اضغط الفُقاعات','Tap the bubbles')}: <b>${NAME[targetColor.id]}</b>
      </div>`;
  }

  function countTargetOnStage(){ return pf.querySelectorAll(`.bub[data-c="${targetColor.id}"]`).length; }
  function randColor(){ return COLORS[Math.floor(Math.random()*COLORS.length)]; }

  function addBubble(colorObj){
    const col = colorObj || randColor();
    const b = document.createElement('button');
    b.className='bub'; b.dataset.c = col.id; b.style.setProperty('--c', col.hex);

    const left  = Math.random()*80 + 10;
    const size  = 40 + Math.random()*26;
    const dur   = 4.6 + Math.random()*0.8; // مدة الطفو

    b.style.left = left+'%';
    b.style.width = b.style.height = size+'px';
    b.style.setProperty('--dur', dur+'s');
    b.innerHTML = `
      <span class="core"></span>
      <span class="glow"></span>
      <span class="shadow"></span>
    `;

    b.addEventListener('animationend', ()=> b.remove());

    b.onclick = ()=>{
      const clicked = b.dataset.c;
      const isCorrect = (clicked === targetColor.id);
      if(isCorrect){
        score++; confetti(); speak(t('أحسنت!','Great!')); updateHUD();
        b.classList.add('pop'); setTimeout(()=>b.remove(),180);
        if(score>=CFG.target) return end(true);
        if(score%3===0){ setTimeout(()=> setTarget(), 300); }
      }else{
        speak(t('حاول مجددًا','Try again'));
        b.classList.add('shake'); setTimeout(()=>b.classList.remove('shake'),250);
      }
    };

    pf.appendChild(b);
  }

  // ====== موجات (waves) تضمن الهدف ======
  function spawnWave(n=CFG.wave){
    const all = pf.querySelectorAll('.bub'); if(all.length>80) all.forEach(el=>el.remove());

    const list = [];
    for(let i=0;i<CFG.minTargetPerWave;i++) list.push(targetColor);
    while(list.length<n){ list.push(randColor()); }
    list.sort(()=>Math.random()-0.5);

    list.forEach(col => addBubble(col));
  }

  // حارس الهدف: يضمن وجود الهدف على الشاشة
  function ensureTargetPresent(){
    if(countTargetOnStage()===0) addBubble(targetColor);
  }

  // ====== التايمر ======
  tickTimer = setInterval(()=>{ time--; updateHUD(); if(time<=0) end(false); }, 1000);

  // ====== نهاية الجولة + Next + حفظ تقدم ======
  function end(win){
    try{ clearInterval(tickTimer); clearInterval(waveTimer); clearInterval(guardTimer);}catch{}
    const pct = Math.min(1, score/CFG.target);
    const title = win? t('ممتاز!','Excellent!') : (pct>=.5? t('محاولة جيدة!','Good try!'): t('حاول مجددًا','Try again'));
    const stars = win?3:(pct>=.75?2:(pct>=.5?1:0));
    speak(title);

    if(win){
      const key = `ffk_progress_${game.id}`;
      const idx = (game.levels||[]).findIndex(l=>l.id===levelId);
      const next= game.levels?.[idx+1]?.id;
      localStorage.setItem(key, next || levelId);
    }

    const hasNext = win && ((game.levels||[]).findIndex(l=>l.id===levelId) < (game.levels||[]).length-1);

    const ov=document.createElement('div'); ov.className='result-overlay'; ov.innerHTML=`
      <div class="result-card">
        <h2>${title}</h2>
        <p>${t('النقاط','Score')}: ${score} / ${CFG.target}</p>
        <p style="font-size:22px;margin:8px 0">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</p>
        <div class="row">
          <button id="bp-retry">🔁 ${t('إعادة','Retry')}</button>
          ${hasNext? `<button id="bp-next">➡️ ${t('المستوى التالي','Next')}</button>`:''}
          <a class="home" href="/p/games.html">🏠 ${t('القائمة','Catalog')}</a>
        </div>
      </div>`;
    document.body.appendChild(ov);

    ov.querySelector('#bp-retry').onclick=()=>location.reload();
    ov.querySelector('#bp-next')?.addEventListener('click', ()=>{
      const idx = (game.levels||[]).findIndex(l=>l.id===levelId);
      const next= game.levels?.[idx+1]?.id || 'L1';
      const u = new URL(location.href); u.searchParams.set('lvl', next); location.href = u.toString();
    });
  }

  // ====== CSS ======
  const css = document.createElement('style'); css.textContent = `
    #bp-wrap{ width:min(920px,96%); margin:auto; }
    #hud{display:flex;gap:10px;align-items:center;justify-content:center;background:rgba(255,255,255,.15);color:#fff;
      padding:8px 12px;border-radius:14px;font-weight:800;text-shadow:0 1px 2px #0007;backdrop-filter:blur(2px)}
    #progress{position:relative;height:10px;background:#ffffff33;border-radius:999px;margin:8px 4px}
    #bar{height:100%;width:0;background:#22c55e;border-radius:999px;transition:width .25s}
    #stars{position:absolute;inset:0;display:flex;gap:4px;align-items:center;justify-content:center;color:#fff;text-shadow:0 1px 2px #0008;font-weight:900}
    #target{display:grid;place-items:center;margin:6px}
    .tg{background:#ffffff18;color:#fff;border-radius:12px;padding:6px 10px;font-weight:900;text-shadow:0 1px 2px #0009}
    .tg .dot{display:inline-block;width:14px;height:14px;border-radius:50%;margin-inline:6px;vertical-align:middle;background:var(--c);
      box-shadow:0 0 0 2px #ffffff80 inset, 0 0 8px #0003}
    #playfield{position:relative;height:360px;border-radius:16px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.05))}
    .bub{position:absolute;bottom:-60px;transform:translateX(-50%);border:0;background:transparent;cursor:pointer;transition:transform .15s}
    .bub .core{
      display:block;width:100%;height:100%;border-radius:50%;opacity:.95;
      background:
        radial-gradient(circle at 30% 30%, #ffffff88 0 20%, #ffffff00 40%),
        radial-gradient(circle at 70% 70%, #00000033 0 60%, #00000000 70%),
        var(--c);
      box-shadow:inset 0 0 15px #fff8, 0 5px 15px #0003;
      position:relative;
      z-index:2;
    }
    .bub .glow{
      position:absolute;
      width:100%;
      height:100%;
      border-radius:50%;
      background:radial-gradient(circle at 50% 50%, #ffffff44 0%, #ffffff00 70%);
      opacity:0.7;
      z-index:1;
    }
    .bub .shadow{
      position:absolute;
      width:100%;
      height:100%;
      border-radius:50%;
      background:radial-gradient(circle at 50% 100%, #00000044 0%, #00000000 70%);
      opacity:0.5;
      z-index:0;
    }
    .bub{animation:floatUp var(--dur,4.6s) linear forwards}
    .bub.shake{animation:none;transform:translateX(-50%) scale(.95)}
    .bub.pop{animation:none;transform:translateX(-50%) scale(0);opacity:0;transition:.18s}
    @keyframes floatUp{ from{bottom:-60px} to{bottom:110%} }
    .result-overlay{position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.35);z-index:9999}
    .result-card{background:#fff;border-radius:18px;padding:18px 22px;width:min(440px,92vw);box-shadow:0 12px 30px #0003;text-align:center}
    .result-card .row{display:flex;gap:8px;justify-content:center;margin-top:8px}
    .result-card button,.result-card .home{background:#1d4ed8;color:#fff;border:0;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer;text-decoration:none}
    .confetti{position:fixed;inset:0;pointer-events:none;z-index:9998}
    .confetti i{position:absolute;width:8px;height:12px;top:-12px;animation:drop .9s linear forwards}
    @keyframes drop{to{transform:translateY(var(--h)) rotate(360deg)}}
  `; document.head.appendChild(css);

  // ====== تشغيل ======
  setTarget();
  spawnWave(CFG.wave);
  
  // حارس الهدف المحسن (800ms)
  guardTimer = setInterval(() => {
    if (countTargetOnStage() === 0) {
      addBubble(targetColor);
    }
  }, 800);

  updateHUD();
}
