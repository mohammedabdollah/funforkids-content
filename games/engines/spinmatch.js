// Spin & Match — L1/L2/L3 (Text Decoy in L2)
// (c) Fun For Kids — lightweight, no libs

export async function start({ stage, game, levelId = 'L1' }) {
  // -------- Settings & Level --------
  const S = Object.assign({ tts:true, confetti:true, progress:true, stars:true }, game.settings||{});
  const LV = game.levels || [];
  const levelIdx = Math.max(0, LV.findIndex(l => l.id === levelId));
  const level = LV[levelIdx] || LV[0];

  // UI language (AR/EN)
  const lang = (localStorage.getItem('ffk_lang') || (document.dir==='rtl'?'ar':'en')).toLowerCase();
  const t = (ar,en)=> lang==='ar'? ar : en;

  // Symbols (emoji + labels)
  const SYMBOLS = [
    { id:'red-circle',     em:'🔴', ar:'دائرة حمراء',     en:'Red circle' },
    { id:'blue-square',    em:'🟦', ar:'مربع أزرق',        en:'Blue square' },
    { id:'green-triangle', em:'🔺', ar:'مثلث أخضر',        en:'Green triangle' },
    { id:'yellow-star',    em:'⭐',  ar:'نجمة صفراء',       en:'Yellow star' },
    { id:'purple-heart',   em:'💜', ar:'قلب بنفسجي',       en:'Purple heart' }
  ];

  // Level config (L2 uses text-only decoy)
  const LCFG = {
    L1: { choices:3, time: level.time||35, target: level.target||8,  decoyText:false },
    L2: { choices:3, time: level.time||35, target: level.target||10, decoyText:true  }, // TEXT DECOY ✅
    L3: { choices:4, time: level.time||30, target: level.target||12, decoyText:true  }
  }[level.id] || { choices:3, time:35, target:8, decoyText:false };

  // -------- Layout --------
  stage.innerHTML = `
    <div id="gm-wrap">
      <div id="hud">
        <span id="hud-time">⏱️ --</span>
        <span>·</span>
        <span id="hud-score">⭐ 0</span>
        <span id="hud-level" style="margin-inline-start:auto">${level.id}</span>
      </div>

      <div id="progress"><div id="bar"></div>
        <div id="stars"><span class="st">☆</span><span class="st">☆</span><span class="st">☆</span></div>
      </div>

      <div id="wheel-zone">
        <div id="wheel" aria-live="polite"></div>
        <button id="btn-spin" class="spin-btn"><span class="die">🎲</span> ${t('ابدأ الدوران','Spin')}</button>
      </div>

      <div id="choices"></div>
      <div id="status"></div>
    </div>
  `;

  const wheel   = document.getElementById('wheel');
  const btn     = document.getElementById('btn-spin');
  const choices = document.getElementById('choices');
  const status  = document.getElementById('status');
  const hudTime = document.getElementById('hud-time');
  const hudScore= document.getElementById('hud-score');
  const bar     = document.getElementById('bar');
  const starsEl = Array.from(document.querySelectorAll('#stars .st'));

  // -------- State --------
  let time = LCFG.time, score = 0, tries = 0, target = null, timer = null, spinning = false;
  let onFinish = ()=>{};

  // -------- Audio (tick) --------
  let actx;
  function beep(freq=980, dur=0.075, type='square', vol=0.18){
    try{
      actx ||= new (window.AudioContext||window.webkitAudioContext)();
      const o=actx.createOscillator(), g=actx.createGain();
      o.type=type; o.frequency.value=freq; g.gain.value=vol;
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime+dur);
    }catch{}
  }

  // -------- TTS --------
  function speak(msg){
    if(!S.tts) return;
    try{
      const u = new SpeechSynthesisUtterance(msg);
      u.lang = (lang==='ar')?'ar':'en-US';
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    }catch{}
  }

  // -------- Helpers --------
  const rand = a => a[Math.floor(Math.random()*a.length)];
  const shuffle = a => a.sort(()=>Math.random()-0.5);
  function updateHUD(){
    hudTime.textContent  = `⏱️ ${time}`;
    hudScore.textContent = `⭐ ${score}`;
    if(S.progress){
      const pct = Math.max(0, Math.min(100, (score/LCFG.target)*100));
      bar.style.width = pct + '%';
    }
    if(S.stars){
      const s1 = score >= Math.ceil(LCFG.target*0.5);
      const s2 = score >= Math.ceil(LCFG.target*0.75);
      const s3 = score >= LCFG.target;
      starsEl[0].textContent = s1?'★':'☆';
      starsEl[1].textContent = s2?'★':'☆';
      starsEl[2].textContent = s3?'★':'☆';
    }
  }

  // Confetti (simple, no libs)
  function confetti(){
    if(!S.confetti) return;
    const layer=document.createElement('div'); layer.className='confetti';
    document.body.appendChild(layer);
    for(let i=0;i<28;i++){
      const p=document.createElement('i');
      p.style.left=(Math.random()*100)+'%';
      p.style.setProperty('--h', (window.innerHeight+90)+'px');
      p.style.background=['#f59e0b','#10b981','#3b82f6','#ef4444','#a855f7'][i%5];
      layer.appendChild(p);
    }
    setTimeout(()=>layer.remove(),1000);
  }

  // -------- Rounds --------
  function nextRound(){
    target = rand(SYMBOLS);
    wheel.innerHTML = ''; // لا نعرض ؟
    status.textContent = t('اضغط Spin!','Press Spin!');
    choices.innerHTML = '';
  }

  function showChoices(){
    const opts = [target];
    while(opts.length < LCFG.choices){
      const r = rand(SYMBOLS); if(!opts.includes(r)) opts.push(r);
    }
    shuffle(opts);

    const label = (s, textOnly=false)=>{
      const txt = (lang==='ar')? s.ar : s.en;
      return textOnly
        ? `<span class="tx-only">${txt}</span>`
        : `<span class="em">${s.em}</span><span class="tx">${txt}</span>`;
    };

    choices.innerHTML = opts.map((o,i)=>{
      const decoy = LCFG.decoyText && i===1; // L2/L3 نص فقط كتشتيت
      return `<button class="opt" data-id="${o.id}">${label(o, decoy)}</button>`;
    }).join('');

    choices.querySelectorAll('.opt').forEach(b=>{
      b.onclick = ()=>{
        tries++;
        if(b.dataset.id===target.id){
          score++; status.textContent = t('✔️ صحيح!','✔️ Correct!');
          speak(t('أحسنت!','Great!')); confetti(); updateHUD();
          if(score>=LCFG.target) return endGame(true);
        }else{
          status.textContent = t('❌ خطأ','❌ Wrong');
          speak(t('حاول مجددًا','Try again'));
        }
        nextRound();
      };
    });
  }

  // Spin
  btn.onclick = ()=>{
    if(spinning) return; spinning = true; btn.disabled = true;
    wheel.classList.add('spinning');
    setTimeout(()=>{
      wheel.classList.remove('spinning');

      // L1: emoji + text   |  L2: text only   |  L3: emoji + text + 4 خيارات
      const showTextOnly = (level.id==='L2');
      const txt = t(target.ar, target.en);
      wheel.innerHTML = showTextOnly
        ? `<span class="wheel-tx">${txt}</span>`
        : `<span class="wheel-em">${target.em}</span><span class="wheel-tx">${txt}</span>`;

      showChoices();
      spinning = false; btn.disabled = false;
    }, 900);
  };

  // Timer (with last-5s ticks)
  timer = setInterval(()=>{
    time--; updateHUD();
    if(time<=5) beep();
    if(time<=0) endGame(false);
  }, 1000);

  function endGame(win){
    clearInterval(timer);
    const title = win ? t('ممتاز!','Great!') : t('انتهى الوقت!','Time is up!');
    const msg   = t(`النقاط: ${score} من ${LCFG.target}`, `Score: ${score} / ${LCFG.target}`);
    speak(win ? t('أحسنت، نتيجة رائعة!','Well done!') : t('حاول مجددًا','Try again'));

    const stars = win ? 3 :
      (score >= Math.ceil(LCFG.target*0.75)) ? 2 :
      (score >= Math.ceil(LCFG.target*0.5))  ? 1 : 0;

    const overlay = document.createElement('div');
    overlay.className = 'result-overlay';
    overlay.innerHTML = `
      <div class="result-card">
        <h2>${title}</h2>
        <p>${msg}</p>
        <p style="font-size:22px;margin:8px 0">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</p>
        <div class="row">
          <button id="btn-retry">🔁 ${t('إعادة','Retry')}</button>
          ${ (levelIdx < LV.length-1) ? `<button id="btn-next">➡️ ${t('المستوى التالي','Next')}</button>` : '' }
          <a class="home" href="/p/games.html">🏠 ${t('القائمة','Catalog')}</a>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#btn-retry')?.addEventListener('click', ()=>location.reload());
    overlay.querySelector('#btn-next')?.addEventListener('click', ()=>{
      const next = LV[levelIdx+1]?.id || 'L1';
      const u = new URL(location.href); u.searchParams.set('lvl', next); location.href = u.toString();
    });

    onFinish({ level: level.id, score, ms: (LCFG.time-time)*1000, stars });
  }

  // Component CSS (scoped)
  const css = document.createElement('style'); css.textContent = `
    #gm-wrap{ width:min(920px,96%); margin:auto; }
    #hud{
      display:flex; gap:10px; align-items:center; justify-content:center;
      background:rgba(255,255,255,.15); color:#fff; padding:8px 12px; border-radius:14px;
      font-weight:800; text-shadow:0 1px 2px #0007; backdrop-filter:blur(2px)
    }
    #progress{position:relative;height:10px;background:#ffffff33;border-radius:999px;margin:8px 4px}
    #bar{height:100%;width:0%;background:#22c55e;border-radius:999px;transition:width .25s}
    #stars{position:absolute;inset:0;display:flex;gap:4px;align-items:center;justify-content:center;color:#fff;text-shadow:0 1px 2px #0008;font-weight:900}
    #wheel-zone{display:grid;place-items:center;margin:8px}
    #wheel{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:120px;color:#fff;text-shadow:0 1px 2px #0009}
    .wheel-em{font-size:68px;line-height:1; filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))}
    .wheel-tx{font-size:18px;font-weight:900; letter-spacing:.2px}
    .spin-btn{
      margin-top:8px;border:0;border-radius:999px;padding:10px 18px;font-weight:900;cursor:pointer;
      background:#fff;color:#1e3a8a;display:inline-flex;align-items:center;gap:8px;
      box-shadow:0 8px 22px rgba(0,0,0,.18)
    }
    .spin-btn:disabled{opacity:.65;cursor:not-allowed}
    .die{font-size:20px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25))}
    #choices{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:12px}
    #choices .opt{
      background:#fff;color:#111;border:1px solid #e5e7eb;border-radius:12px;padding:10px 14px;
      display:flex;align-items:center;gap:8px;font-size:18px;cursor:pointer;box-shadow:0 4px 12px #0001
    }
    #choices .opt:hover{transform:translateY(-1px);box-shadow:0 10px 18px #0002}
    #choices .opt .em{font-size:24px}
    #choices .opt .tx-only{font-weight:800;opacity:.92}
    #status{text-align:center;font-weight:900;color:#fff;text-shadow:0 1px 2px #0009;margin:4px}
    .spinning{animation:spin .9s ease-in-out}
    @keyframes spin{from{transform:rotate(0)}to{transform:rotate(720deg)}}
    .result-overlay{position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.35);z-index:9999}
    .result-card{background:#fff;border-radius:18px;padding:18px 22px;width:min(440px,92vw);box-shadow:0 12px 30px #0003;text-align:center}
    .result-card .row{display:flex;gap:8px;justify-content:center;margin-top:8px}
    .result-card button,.result-card .home{background:#1d4ed8;color:#fff;border:0;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer;text-decoration:none}
    .result-card button:hover,.result-card .home:hover{filter:brightness(1.08)}
    /* Confetti */
    .confetti{position:fixed;inset:0;pointer-events:none;z-index:9998}
    .confetti i{position:absolute;width:8px;height:12px;top:-12px;animation:drop .9s linear forwards}
    @keyframes drop{to{transform:translateY(var(--h)) rotate(360deg)}}
  `;
  document.head.appendChild(css);

  // Boot
  updateHUD(); nextRound();
}
