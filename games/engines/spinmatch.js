// Spin & Match — Final v1.0 (معدل للتشغيل من الـ Game Loader)

// L1: emoji+text, L2: text-only wheel + one text decoy, L3: 4 choices (speed)
// L4: Combo 3-in-a-row = 1 point, L5: Chaos (moving choices)
// Includes: HUD, Timer w/ tick, TTS (AR/EN), Confetti, Progress + Stars, Smart result screen.

window.startSpinMatch = async function({ stage, game, levelId = 'L1' }) {
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
    { id:'red-triangle',   em:'🔺', ar:'مثلث أحمر',       en:'Red triangle' }, // ✅ تم تعديل اللون
    { id:'yellow-star',    em:'⭐',  ar:'نجمة صفراء',       en:'Yellow star' },
    { id:'purple-heart',   em:'💜', ar:'قلب بنفسجي',       en:'Purple heart' }
  ];

  // Level config (per ID)
  const CFG = {
   L1: { choices:3, time: 40, target: 7,  decoyText:false, combo:false, chaos:false },
   L2: { choices:3, time: 35, target: 9,  decoyText:true,  combo:false, chaos:false }, 
   L3: { choices:4, time: 30, target: 11, decoyText:true,  combo:false, chaos:false },
   L4: { choices:3, time: 30, target: 7,  decoyText:false, combo:true,  chaos:false }, 
   L5: { choices:4, time: 30, target: 12, decoyText:true,  combo:false, chaos:true }
  }[level.id] || { choices:3, time:30, target:8, decoyText:false, combo:false, chaos:false };

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

  // باقي الكود (Rounds, Spinner, Timer, EndGame) يبقى كما هو بدون أي تغيير
  // ...
  
  updateHUD(); 
  nextRound();
};
