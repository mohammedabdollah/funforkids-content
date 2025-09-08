// Spin & Match — Fixed & Ready
// نسخة جاهزة للعمل على اللودر الجديد

window.startSpinMatch = async function({ stage, game, levelId = 'L1' }) {

  const S = Object.assign({ tts:true, confetti:true, progress:true, stars:true }, game.settings||{});
  const LV = game.levels || [];
  const levelIdx = Math.max(0, LV.findIndex(l => l.id === levelId));
  const level = LV[levelIdx] || LV[0];

  const lang = (localStorage.getItem('ffk_lang') || (document.dir==='rtl'?'ar':'en')).toLowerCase();
  const t = (ar,en)=> lang==='ar'? ar : en;

  const SYMBOLS = [
    { id:'red-circle',     em:'🔴', ar:'دائرة حمراء',     en:'Red circle' },
    { id:'blue-square',    em:'🟦', ar:'مربع أزرق',       en:'Blue square' },
    { id:'red-triangle',   em:'🔺', ar:'مثلث أحمر',       en:'Red triangle' },
    { id:'yellow-star',    em:'⭐', ar:'نجمة صفراء',       en:'Yellow star' },
    { id:'purple-heart',   em:'💜', ar:'قلب بنفسجي',       en:'Purple heart' }
  ];

  const CFG = {
    L1: { choices:3, time: 40, target: 7, decoyText:false, combo:false, chaos:false },
    L2: { choices:3, time: 35, target: 9, decoyText:true, combo:false, chaos:false },
    L3: { choices:4, time: 30, target: 11, decoyText:true, combo:false, chaos:false },
    L4: { choices:3, time: 30, target: 7, decoyText:false, combo:true, chaos:false },
    L5: { choices:4, time: 30, target: 12, decoyText:true, combo:false, chaos:true }
  }[level.id] || { choices:3, time:30, target:8, decoyText:false, combo:false, chaos:false };

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

  let time = CFG.time, score = 0, tries = 0, target = null, timer = null, spinning = false;
  let onFinish = ()=>{};
  let comboNeed = 3, comboProg = 0;

  function beep(freq=980, dur=0.075, type='square', vol=0.18){
    try{
      const actx = new (window.AudioContext||window.webkitAudioContext)();
      const o=actx.createOscillator(), g=actx.createGain();
      o.type=type; o.frequency.value=freq; g.gain.value=vol;
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime+dur);
    }catch{}
  }

  function speak(msg){
    if(!S.tts) return;
    try{
      const u = new SpeechSynthesisUtterance(msg);
      u.lang = (lang==='ar')?'ar':'en-US';
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    }catch{}
  }

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
      const decoy = CFG.decoyText && i===1;
      const klass = CFG.chaos ? 'opt chaos' : 'opt';
      return `<button class="${klass}" data-id="${o.id}">${label(o, decoy)}</button>`;
    }).join('');

    choices.querySelectorAll('.opt').forEach(b=>{
      b.onclick = ()=>{
        const correct = (b.dataset.id===target.id);
        if(CFG.combo){
          if(correct){ comboProg = Math.min(comboNeed, comboProg+1); renderCombo(); if(comboProg===comboNeed){score++; comboProg=0; renderCombo(); status.textContent = t('✔️ كومبو مكتمل!','✔️ Combo complete!'); speak(t('ممتاز، نقطة كاملة!','Excellent, full point!')); confetti(); updateHUD();}else{status.textContent = t('صحيح! تابع الكومبو…','Correct! keep the combo...'); speak(t('تابع!','Keep going!'));} }else{ comboProg=0; renderCombo(); status.textContent=t('❌ انقطع الكومبو!','❌ Combo broken!'); speak(t('حاول مجددًا','Try again')); }
        }else{
          if(correct){ score++; status.textContent = t('✔️ صحيح!','✔️ Correct!'); speak(t('أحسنت!','Great!')); confetti(); updateHUD(); if(score>=CFG.target) return endGame(true);}else{ status.textContent=t('❌ خطأ','❌ Wrong'); speak(t('حاول مجددًا','Try again')); }
        }
        nextRound();
      };
    });
  }

  btn.onclick = ()=>{
    if(spinning) return; spinning=true; btn.disabled=true;
    wheel.classList.add('spinning');
    setTimeout(()=>{
      wheel.classList.remove('spinning');
      const textOnly = (level.id==='L2');
      const txt = t(target.ar, target.en);
      wheel.innerHTML = textOnly
        ? `<span class="wheel-tx">${txt}</span>`
        : `<span class="wheel-em">${target.em}</span><span class="wheel-tx">${txt}</span>`;
      showChoices();
      spinning=false; btn.disabled=false;
    }, 900);
  };

  timer = setInterval(()=>{ time--; updateHUD(); if(time<=5) beep(); if(time<=0) endGame(false); }, 1000);

  function verdictText(pct){ if(pct >= 1) return { ar:'ممتاز!', en:'Excellent!' }; if(pct>=.75) return { ar:'قريب جدًا!', en:'Almost there!' }; if(pct>=.5) return { ar:'محاولة جيدة!', en:'Good try!' }; return { ar:'حاول مجددًا', en:'Try again' }; }

  function endGame(win){
    clearInterval(timer);
    const pct = Math.min(1, score/CFG.target);
    const titleObj = verdictText(pct);
    const title = t(titleObj.ar, titleObj.en);
    const msg   = t(`النقاط: ${score} من ${CFG.target}`, `Score: ${score} / ${CFG.target}`);
    speak(title);
    const stars = (pct>=1)?3:(pct>=.75)?2:(pct>=.5)?1:0;
    const overlay=document.createElement('div'); overlay.className='result-overlay';
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
    overlay.querySelector('#btn-retry')?.addEventListener('click', ()=>
