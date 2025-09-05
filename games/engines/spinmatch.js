// Spin & Match — Final v1.0
// L1: emoji+text, L2: text-only wheel + one text decoy, L3: 4 choices (speed)
// L4: Combo 3-in-a-row = 1 point, L5: Chaos (moving choices)
// Includes: HUD, Timer w/ tick, TTS (AR/EN), Confetti, Progress + Stars, Smart result screen.

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

  // Level config (per ID)
  const CFG = {
    L1: { choices:3, time: level.time||35, target: level.target||8,  decoyText:false, combo:false, chaos:false },
    L2: { choices:3, time: level.time||35, target: level.target||10, decoyText:true,  combo:false, chaos:false }, // text decoy
    L3: { choices:4, time: level.time||30, target: level.target||12, decoyText:true,  combo:false, chaos:false }, // 4 choices
    L4: { choices:3, time: level.time||30, target: level.target||8,  decoyText:false, combo:true,  chaos:false }, // combo 3-in-a-row
    L5: { choices:4, time: level.time||25, target: level.target||12, decoyText:true,  combo:false, chaos:true }   // moving options
  }[level.id] || { choices:3, time:35, target:8, decoyText:false, combo:false, chaos:false };

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

      <div id="combo" style="display:none">
        <span class="cb">${t('الكومبو','Combo')}</span>
        <span id="combo-dots">○○○</span>
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
  const comboBox= document.getElementById('combo');
  const comboDots=document.getElementById('combo-dots');

  // -------- State --------
  let time = CFG.time, score = 0, tries = 0, target = null, timer = null, spinning = false;
  let onFinish = ()=>{};
  let comboNeed = 3, comboProg = 0; // for L4

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
      const pct = Math.max(0, Math.min(100, (score/CFG.target)*100));
      bar.style.width = pct + '%';
    }
    if(S.stars){
      const s1 = score >= Math.ceil(CFG.target*0.5);
      const s2 = score >= Math.ceil(CFG.target*0.75);
      const s3 = score >= CFG.target;
      starsEl[0].textContent = s1?'★':'☆';
      starsEl[1].textContent = s2?'★':'☆';
      starsEl[2].textContent = s3?'★':'☆';
    }
  }

  // Confetti (simple)
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
    wheel.innerHTML = '';
    status.textContent = t('اضغط Spin!','Press Spin!');
    choices.innerHTML = '';
    if(CFG.combo){ comboBox.style.display='grid'; renderCombo(); }
  }

  function renderCombo(){
    if(!CFG.combo) return;
    const full = '●'.repeat(comboProg), empty = '○'.repeat(comboNeed - comboProg);
    comboDots.textContent = full + empty;
  }

  function showChoices(){
    const opts = [target];
    while(opts.length < CFG.choices){
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
      const decoy = CFG.decoyText && i===1; // L2/L3 نص فقط كتشتيت
      const klass = CFG.chaos ? 'opt chaos' : 'opt';
      return `<button class="${klass}" data-id="${o.id}">${label(o, decoy)}</button>`;
    }).join('');

    if(CFG.chaos){
      // اهتزاز/انزلاق بسيط يزيد الإِثارة (L5)
      choices.querySelectorAll('.opt.chaos').forEach((b, idx)=>{
        b.style.setProperty('--delay', `${idx*80}ms`);
        b.style.setProperty('--shift', `${(Math.random()>0.5?1:-1)*(4+Math.random()*8)}px`);
      });
    }

    choices.querySelectorAll('.opt').forEach(b=>{
      b.onclick = ()=>{
        tries++;
        const correct = (b.dataset.id===target.id);
        if(CFG.combo){
          if(correct){
            comboProg = Math.min(comboNeed, comboProg+1);
            renderCombo();
            if(comboProg===comboNeed){
              score++; comboProg=0; renderCombo();
              status.textContent = t('✔️ كومبو مكتمل!','✔️ Combo complete!');
              speak(t('ممتاز، نقطة كاملة!','Excellent, full point!'));
              confetti(); updateHUD();
            }else{
              status.textContent = t('صحيح! تابع الكومبو…','Correct! keep the combo...');
              speak(t('تابع!','Keep going!'));
            }
          }else{
            comboProg = 0; renderCombo();
            status.textContent = t('❌ انقطع الكومبو!','❌ Combo broken!');
            speak(t('حاول مجددًا','Try again'));
          }
        }else{
          if(correct){
            score++; status.textContent = t('✔️ صحيح!','✔️ Correct!');
            speak(t('أحسنت!','Great!')); confetti(); updateHUD();
            if(score>=CFG.target) return endGame(true);
          }else{
            status.textContent = t('❌ خطأ','❌ Wrong');
            speak(t('حاول مجددًا','Try again'));
          }
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

      // Wheel content per level
      const textOnly = (level.id==='L2'); // L2 نص فقط
      const txt = t(target.ar, target.en);
      wheel.innerHTML = textOnly
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

  function verdictText(pct){
    if(pct >= 1)   return { ar:'ممتاز!',            en:'Excellent!' };
    if(pct >= .75) return { ar:'قريب جدًا!',        en:'Almost there!' };
    if(pct >= .5)  return { ar:'محاولة جيدة!',      en:'Good try!' };
    return           { ar:'حاول مجددًا',            en:'Try again' };
  }

  function endGame(win){
    clearInterval(timer);
    const pct = Math.min(1, score/CFG.target);
    const titleObj = verdictText(pct);
    const title = t(titleObj.ar, titleObj.en);
    const msg   = t(`النقاط: ${score} من ${CFG.target}`, `Score: ${score} / ${CFG.target}`);
    speak(title);

    const stars = (pct>=1)?3 : (pct>=.75)?2 : (pct>=.5)?1 : 0;

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

    onFinish({ level: level.id, score, ms: (CFG.time-time)*1000, stars });
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
    #combo{
      margin:6px auto 2px; display:grid; place-items:center; color:#fff; font-weight:900;
      text-shadow:0 1px 2px #0009; background:rgba(255,255,255,.12); padding:6px 10px; border-radius:12px; width:max-content
    }
    #choices{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:12px}
    #choices .opt{
      background:#fff;color:#111;border:1px solid #e5e7eb;border-radius:12px;padding:10px 14px;
      display:flex;align-items:center;gap:8px;font-size:18px;cursor:pointer;box-shadow:0 4px 12px #0001; position:relative
    }
    #choices .opt:hover{transform:translateY(-1px);box-shadow:0 10px 18px #0002}
    #choices .opt .em{font-size:24px}
    #choices .opt .tx-only{font-weight:800;opacity:.92}
    /* Chaos animations (L5) */
    #choices .opt.chaos{ animation: sway 1.4s var(--delay) infinite ease-in-out alternate; }
    @keyframes sway{ from{ transform: translateX(0) } to{ transform: translateX(var(--shift,8px)) } }

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
