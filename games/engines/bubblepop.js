// Bubble Pop — Final Lite v1.0
// ميزات: HUD, Timer, Progress, Stars, Confetti, TTS, Next Level, Local Progress
// إصلاحات: سحب مستمر للفقاعات + ضمان تواجد لون الهدف + منع لخبطة تغيّر الهدف

export async function start({ stage, game, levelId='L1' }) {
  // ------ إعدادات عامة ------
  const S = Object.assign(
    { tts:true, confetti:true, progress:true, stars:true },
    game?.settings || {}
  );
  const level = (game.levels||[]).find(l=>l.id===levelId) || game.levels?.[0] || { time: 35, target: 10 };

  // ألوان اللعبة (يمكن تقلل/تزود من JSON لاحقًا)
  const CFG = {
    time:   level.time || 35,
    target: level.target || 10,
    colors: ['red','blue','green','purple','orange']
  };

  // معايير التدفق (قابلة للتوسيع بالليفلات لاحقًا)
  const MAX_ON_STAGE = 16;       // أقصى عدد فقاعات على الشاشة
  const TRICKLE_MS   = 900;      // كل كم ملي ثانية نضيف فقاعة
  const MIN_TARGET_ON_STAGE = 2; // أقل عدد لازم يكون من لون الهدف على الشاشة دائمًا

  // لغة الواجهة
  const lang = (localStorage.getItem('ffk_lang') || (document.dir==='rtl' ? 'ar' : 'en')).toLowerCase();
  const t = (ar,en)=> lang==='ar' ? ar : en;

  // ------ واجهة اللعب ------
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

  // ------ الحالة ------
  let time = CFG.time, score = 0, timer=null, targetColor='red';
  let trickle=null, targetGuard=null;

  const NAME = {
    red:t('أحمر','Red'), blue:t('أزرق','Blue'), green:t('أخضر','Green'),
    purple:t('بنفسجي','Purple'), orange:t('برتقالي','Orange')
  };

  // ------ أدوات ------
  function speak(msg){ try{
    if(!S.tts) return; const u=new SpeechSynthesisUtterance(msg);
    u.lang = (lang==='ar') ? 'ar' : 'en-US';
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }catch{} }

  function confetti(){
    if(!S.confetti) return;
    const layer=document.createElement('div'); layer.className='confetti'; document.body.appendChild(layer);
    for(let i=0;i<24;i++){
      const p=document.createElement('i');
      p.style.left=(Math.random()*100)+'%';
      p.style.setProperty('--h',(window.innerHeight+80)+'px');
      p.style.background=['#f59e0b','#10b981','#3b82f6','#ef4444','#a855f7'][i%5];
      layer.appendChild(p);
    }
    setTimeout(()=>layer.remove(),900);
  }

  function updateHUD(){
    hudTime.textContent  = ⏱️ ${time};
    hudScore.textContent = ⭐ ${score};
    if(S.progress){ const pct = Math.min(100, (score/CFG.target)*100); bar.style.width = pct + '%'; }
    if(S.stars){
      const s1 = score >= Math.ceil(CFG.target*0.5);
      const s2 = score >= Math.ceil(CFG.target*0.75);
      const s3 = score >= CFG.target;
      starsEl[0].textContent = s1 ? '★' : '☆';
      starsEl[1].textContent = s2 ? '★' : '☆';
      starsEl[2].textContent = s3 ? '★' : '☆';
    }
  }

  // ------ الهدف ------
  function setTarget(){
    targetColor = CFG.colors[Math.floor(Math.random()*CFG.colors.length)];
    targetEl.innerHTML = `
      <div class="tg">
        <span class="dot" style="background:${targetColor}"></span>
        ${t('اضغط الفُقاعات','Tap the bubbles')}: <b>${NAME[targetColor]}</b>
      </div>`;
  }

  // ------ عدّادات الشاشة ------
  function countTargetOnStage(){
    return pf.querySelectorAll(.bub[data-c="${targetColor}"]).length;
  }
  function randColor(){ return CFG.colors[Math.floor(Math.random()*CFG.colors.length)]; }

  // ------ إنشاء فقاعة ------
  function addBubble(color){
    const c = color || randColor();
    const b = document.createElement('button');
    b.className='bub'; b.dataset.c=c;

    const left  = Math.random()*80 + 10;     // %
    const size  = 40 + Math.random()*26;     // px
    const delay = Math.random()*1000;

    b.style.left = left+'%'; b.style.width = b.style.height = size+'px';
    b.style.animationDelay = (-delay)+'ms';
    b.innerHTML = <span class="core" style="background:${c}"></span>;

    b.onclick = ()=>{
      const clickedColor = b.dataset.c;         // لقطة لون الفقاعة وقت الضغط
      const isCorrect    = (clickedColor === targetColor);
      if(isCorrect){
        score++; confetti(); speak(t('أحسنت!','Great!')); updateHUD();
        b.classList.add('pop'); setTimeout(()=>b.remove(),180);
        if(score >= CFG.target) return end(true);

        // لتجنّب لخبطة تغيّر الهدف فورًا: بدّل بعد 300ms كل 3 نقاط
        if(score % 3 === 0){
          setTimeout(()=> setTarget(), 300);
        }
      }else{
        speak(t('حاول مجددًا','Try again'));
        b.classList.add('shake'); setTimeout(()=>b.classList.remove('shake'),250);
      }
    };

    pf.appendChild(b);
  }

  // ------ دفعة أولى + تدفق مستمر + حارس هدف ------
  function spawnInitial(n=16){
    pf.innerHTML='';
    // ضمن هدفين على الأقل
    for(let i=0;i<MIN_TARGET_ON_STAGE;i++) addBubble(targetColor);
    while (pf.querySelectorAll('.bub').length < n) addBubble();
  }

  function startTrickle(){
    trickle = setInterval(()=>{
      const total = pf.querySelectorAll('.bub').length;
      if (total < MAX_ON_STAGE) {
        const needTarget = countTargetOnStage() < MIN_TARGET_ON_STAGE;
        addBubble(needTarget ? targetColor : undefined);
      }
    }, TRICKLE_MS);

    targetGuard = setInterval(()=>{
      if (countTargetOnStage() === 0) addBubble(targetColor);
    }, 1200);
  }

  // ------ التايمر ------
  timer = setInterval(()=>{
    time--; updateHUD();
    if(time <= 0) end(false);
  }, 1000);

  // ------ نهاية الجولة + Next + تقدم ------
  function end(win){
    try{
      clearInterval(timer);
      clearInterval(trickle);
      clearInterval(targetGuard);
    }catch{}

    const pct   = Math.min(1, score/CFG.target);
    const title = win ? t('ممتاز!','Excellent!') : (pct>=.5 ? t('محاولة جيدة!','Good try!') : t('حاول مجددًا','Try again'));
    const stars = win?3 : (pct>=.75?2 : (pct>=.5?1:0));
    speak(title);

    // حفظ التقدم محليًا عند الفوز
    try{
      if(win){
        const key = ffk_progress_${game.id}; // مثال: ffk_progress_bubble-pop
        const idx = (game.levels||[]).findIndex(l=>l.id===levelId);
        const next= game.levels?.[idx+1]?.id;
        localStorage.setItem(key, next || levelId);
      }
    }catch{}

    const hasNext = win && ( (game.levels||[]).findIndex(l=>l.id===levelId) < (game.levels||[]).length-1 );

    const ov = document.createElement('div'); ov.className='result-overlay'; ov.innerHTML = `
      <div class="result-card">
        <h2>${title}</h2>
        <p>${t('النقاط','Score')}: ${score} / ${CFG.target}</p>
        <p style="font-size:22px;margin:8px 0">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</p>
        <div class="row">
          <button id="bp-retry">🔁 ${t('إعادة','Retry')}</button>
          ${hasNext ? <button id="bp-next">➡️ ${t('المستوى التالي','Next')}</button> : ''}
          <a class="home" href="/p/games.html">🏠 ${t('القائمة','Catalog')}</a>
        </div>
      </div>`;
    document.body.appendChild(ov);

    ov.querySelector('#bp-retry').onclick = ()=> location.reload();
    ov.querySelector('#bp-next')?.addEventListener('click', ()=>{
      const idx = (game.levels||[]).findIndex(l=>l.id===levelId);
      const next= game.levels?.[idx+1]?.id || 'L1';
      const u = new URL(location.href); u.searchParams.set('lvl', next); location.href = u.toString();
    });
  }

  // ------ CSS مدمج ------
  const css = document.createElement('style'); css.textContent = `
    #bp-wrap{ width:min(920px,96%); margin:auto; }
    #hud{display:flex;gap:10px;align-items:center;justify-content:center;background:rgba(255,255,255,.15);color:#fff;
      padding:8px 12px;border-radius:14px;font-weight:800;text-shadow:0 1px 2px #0007;backdrop-filter:blur(2px)}
    #progress{position:relative;height:10px;background:#ffffff33;border-radius:999px;margin:8px 4px}
    #bar{height:100%;width:0;background:#22c55e;border-radius:999px;transition:width .25s}
    #stars{position:absolute;inset:0;display:flex;gap:4px;align-items:center;justify-content:center;color:#fff;text-shadow:0 1px 2px #0008;font-weight:900}
    #target{display:grid;place-items:center;margin:6px}
    .tg{background:#ffffff18;color:#fff;border-radius:12px;padding:6px 10px;font-weight:900;text-shadow:0 1px 2px #0009}
    .tg .dot{display:inline-block;width:14px;height:14px;border-radius:50%;margin-inline:6px;vertical-align:middle}
    #playfield{position:relative;height:360px;border-radius:16px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.05))}
    .bub{position:absolute;bottom:-60px;transform:translateX(-50%);border:0;background:transparent;cursor:pointer;transition:transform .15s}
    .bub .core{display:block;width:100%;height:100%;border-radius:999px;opacity:.88;box-shadow:inset 0 0 10px #fff8, 0 8px 18px #0002}
    .bub{animation:float 4.6s linear infinite}
    .bub.shake{animation:none;transform:translateX(-50%) scale(.95)}
    .bub.pop{animation:none;transform:translateX(-50%) scale(0);opacity:0;transition:.18s}
    @keyframes float{ from{bottom:-60px} to{bottom:110%} }
    .result-overlay{position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.35);z-index:9999}
    .result-card{background:#fff;border-radius:18px;padding:18px 22px;width:min(440px,92vw);box-shadow:0 12px 30px #0003;text-align:center}
    .result-card .row{display:flex;gap:8px;justify-content:center;margin-top:8px}
    .result-card button,.result-card .home{background:#1d4ed8;color:#fff;border:0;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer;text-decoration:none}
    .confetti{position:fixed;inset:0;pointer-events:none;z-index:9998}
    .confetti i{position:absolute;width:8px;height:12px;top:-12px;animation:drop .9s linear forwards}
    @keyframes drop{to{transform:translateY(var(--h)) rotate(360deg)}}
  `;
  document.head.appendChild(css);

  // ------ تشغيل ------
  setTarget();
  spawnInitial(16);
  startTrickle();
  updateHUD();
}
