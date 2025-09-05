// /games/engines/spinmatch.js
export async function start({ stage, game, levelId = 'L1' }) {
  // ========== الإعدادات العامة ==========
  const S = game.settings || {};
  const LV = game.levels;
  const levelIdx = Math.max(0, LV.findIndex(l => l.id === levelId));
  const level = LV[levelIdx] || LV[0];

  // تحديد اللغة (محلية: ffk_lang أو اتجاه الصفحة)
  const lang = (localStorage.getItem('ffk_lang') || (document.dir === 'rtl' ? 'ar' : 'en')).toLowerCase();

  // رموز اللعبة
  const baseSymbols = [
    { id: 'red-circle',    emoji:'🔴', ar:'دائرة حمراء',    en:'Red circle' },
    { id: 'blue-square',   emoji:'🟦', ar:'مربع أزرق',      en:'Blue square' },
    { id: 'green-triangle',emoji:'🔺', ar:'مثلث أخضر',      en:'Green triangle' }, // 🔺 لأن 🟢 مثلث غير متاح
    { id: 'yellow-star',   emoji:'⭐', ar:'نجمة صفراء',      en:'Yellow star' },
    { id: 'purple-heart',  emoji:'💜', ar:'قلب بنفسجي',     en:'Purple heart' }
  ];

  // خصائص كل مستوى
  const levelConfig = {
    L1: { choices: 3, time: level.time || 35, target: level.target || 8, decoyText: false },
    L2: { choices: 3, time: level.time || 35, target: level.target || 10, decoyText: true  },
    L3: { choices: 4, time: level.time || 30, target: level.target || 12, decoyText: true  }
  }[level.id] || { choices: 3, time: 35, target: 8, decoyText: false };

  // HUD + منطقة اللعب
  stage.innerHTML = `
    <div id="hud">
      <span id="hud-time">⏱️ --</span>
      <span>·</span>
      <span id="hud-score">⭐ 0</span>
      <span style="margin-inline-start:auto" id="hud-level">${level.id}</span>
    </div>

    <div id="progress">
      <div id="bar"></div>
      <div id="stars">
        <span class="st">☆</span><span class="st">☆</span><span class="st">☆</span>
      </div>
    </div>

    <div id="wheel-zone">
      <div id="wheel" aria-live="polite"></div>
      <button id="btn-spin" class="spin-btn">
        <span class="die">🎲</span> <span>${lang==='ar'?'ابدأ الدوران':'Spin'}</span>
      </button>
    </div>

    <div id="choices"></div>
    <div id="status"></div>
  `;

  // --- مراجع DOM
  const hudTime  = document.getElementById('hud-time');
  const hudScore = document.getElementById('hud-score');
  const hudLevel = document.getElementById('hud-level');
  const bar      = document.getElementById('bar');
  const starsEl  = Array.from(document.querySelectorAll('#stars .st'));
  const wheel    = document.getElementById('wheel');
  const btn      = document.getElementById('btn-spin');
  const choices  = document.getElementById('choices');
  const status   = document.getElementById('status');

  // --- حالات
  let time   = levelConfig.time;
  let score  = 0;
  let tries  = 0;
  let target = null;
  let timer  = null;
  let spinning = false;
  let onFinish = ()=>{};

  // --- أدوات مساعدة
  const t = (ar,en)=> lang==='ar'? ar : en;
  function speak(msg){
    if(!S.tts) return;
    try{
      const u = new SpeechSynthesisUtterance(msg);
      u.lang = lang==='ar' ? 'ar' : 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }catch{}
  }
  function updateHUD(){
    hudTime.textContent  = `⏱️ ${time}`;
    hudScore.textContent = `⭐ ${score}`;
    const pct = Math.max(0, Math.min(100, (score/levelConfig.target)*100));
    bar.style.width = pct + '%';
    // نجوم: 1 لنسبة ≥50%، 2 ≥75%، 3 ≥100%
    const s1 = score >= Math.ceil(levelConfig.target*0.5);
    const s2 = score >= Math.ceil(levelConfig.target*0.75);
    const s3 = score >= levelConfig.target;
    starsEl[0].textContent = s1 ? '★' : '☆';
    starsEl[1].textContent = s2 ? '★' : '☆';
    starsEl[2].textContent = s3 ? '★' : '☆';
  }
  function randItem(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function shuffle(arr){ return arr.sort(()=>Math.random()-0.5); }

  // --- كونفتّي خفيف بدون مكتبات
  function confettiBurst(){
    if(!S.confetti) return;
    const layer = document.createElement('div');
    layer.style.position='fixed'; layer.style.inset='0'; layer.style.pointerEvents='none'; layer.style.zIndex='9998';
    document.body.appendChild(layer);
    for(let i=0;i<24;i++){
      const p = document.createElement('div');
      p.style.position='absolute';
      p.style.left = (Math.random()*100)+'%';
      p.style.top  = '-10px';
      p.style.width='8px'; p.style.height='12px';
      p.style.background = ['#f59e0b','#10b981','#3b82f6','#ef4444','#a855f7'][i%5];
      p.style.transform = `rotate(${Math.random()*360}deg)`;
      p.style.borderRadius='2px';
      p.style.animation = `drop${i} 900ms linear forwards`;
      layer.appendChild(p);
      const key = document.createElement('style');
      key.textContent = `@keyframes drop${i}{to{transform:translateY(${window.innerHeight+40}px) rotate(${360+Math.random()*360}deg)}}`;
      document.head.appendChild(key);
      setTimeout(()=>key.remove(),1200);
    }
    setTimeout(()=>layer.remove(),1000);
  }

  // --- جولة جديدة
  function nextRound(){
    target = randItem(baseSymbols);
    wheel.textContent = ''; // لا نعرض علامة استفهام
    status.textContent = t('اضغط زر الدوران','Press Spin');
    choices.innerHTML = '';
  }

  // --- بناء الخيارات حسب المستوى
  function showChoices(){
    const opts = [target];
    while(opts.length < levelConfig.choices){
      const r = randItem(baseSymbols);
      if(!opts.includes(r)) opts.push(r);
    }
    shuffle(opts);

    // في L2/L3 نضيف تشتيت نصّي: خيار أو أكثر نص بدون إيموجي
    const makeLabel = (s, asText=false)=>{
      const txt = lang==='ar'? s.ar : s.en;
      return asText ? `<span class="txt-only">${txt}</span>` : `<span class="em">${s.emoji}</span><span class="tx">${txt}</span>`;
    };

    choices.innerHTML = opts.map((o,idx)=>{
      const textDecoy = levelConfig.decoyText && idx === 1; // تشتيت بسيط
      return `<button class="opt" data-id="${o.id}">${makeLabel(o, textDecoy)}</button>`;
    }).join('');

    choices.querySelectorAll('.opt').forEach(b=>{
      b.onclick = ()=>{
        tries++;
        if(b.dataset.id === target.id){
          score++;
          status.textContent = t('✔️ صحيح!','✔️ Correct!');
          speak(t('أحسنت!','Great!'));
          confettiBurst();
        }else{
          status.textContent = t('❌ خطأ','❌ Wrong');
          speak(t('حاول مرة أخرى','Try again'));
        }
        updateHUD();
        // إذا وصل الهدف نُنهي الجولة مبكرًا
        if(score >= levelConfig.target) endGame();
        else nextRound();
      };
    });
  }

  // --- دوران
  btn.onclick = () => {
    if (spinning) return;
    spinning = true; btn.disabled = true;

    wheel.classList.add('spinning');
    setTimeout(()=>{
      wheel.classList.remove('spinning');
      // نعرض الهدف (إيموجي + كلمة) بوضوح
      wheel.innerHTML = `<span class="wheel-emoji">${target.emoji}</span><span class="wheel-text">${t(target.ar, target.en)}</span>`;
      showChoices();
      spinning = false; btn.disabled = false;
    }, 1000);
  };

  // --- مؤقت
  timer = setInterval(()=>{
    time--; updateHUD();
    if(time<=0) endGame();
  }, 1000);

  function endGame(){
    clearInterval(timer);
    // حساب النجوم النهائية
    const stars = (score >= levelConfig.target) ? 3 :
                  (score >= Math.ceil(levelConfig.target*0.75)) ? 2 :
                  (score >= Math.ceil(levelConfig.target*0.5)) ? 1 : 0;
    // رسالة ختامية
    const title = t('انتهى الوقت!','Time is up!');
    const msg   = t(`النقاط: ${score} من ${levelConfig.target}` , `Score: ${score} / ${levelConfig.target}`);
    speak(title);

    // طبقة نتيجة في منتصف الشاشة
    const overlay = document.createElement('div');
    overlay.className = 'result-overlay';
    overlay.innerHTML = `
      <div class="result-card">
        <h2>${title}</h2>
        <p style="margin:8px 0">${msg}</p>
        <p>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
          <button id="btn-retry">🔁 ${t('إعادة','Retry')}</button>
          ${ levelIdx < LV.length-1
              ? `<button id="btn-next">➡️ ${t('المستوى التالي','Next level')}</button>` : '' }
          <a class="back" href="/p/games.html">🏠 ${t('القائمة','Catalog')}</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#btn-retry')?.addEventListener('click',()=>location.reload());
    overlay.querySelector('#btn-next')?.addEventListener('click',()=>{
      const nextId = LV[levelIdx+1]?.id || 'L1';
      const url = new URL(location.href);
      url.searchParams.set('lvl', nextId);
      location.href = url.toString();
    });

    onFinish({ level: level.id, score, ms: (levelConfig.time - time)*1000, stars });
  }

  // --- CSS داخلي للعنصر (مخصّص للّعبة)
  const css = document.createElement('style');
  css.textContent = `
    #hud{
      display:flex; gap:10px; align-items:center; justify-content:center;
      background:rgba(255,255,255,.14); color:#fff; font-weight:700; padding:6px 10px; border-radius:12px; margin:6px auto 8px; width:max-content
    }
    #progress{position:relative;height:10px;background:#ffffff33;border-radius:999px;margin:6px 10px}
    #bar{height:100%;width:0%;background:#22c55e;border-radius:999px;transition:width .25s}
    #stars{position:absolute;inset:0;display:flex;gap:2px;align-items:center;justify-content:center;color:#fff;text-shadow:0 1px 2px #0008;font-weight:900}
    #wheel-zone{display:grid;place-items:center;margin:10px}
    #wheel{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:120px;color:#fff;text-shadow:0 1px 2px #0007}
    .wheel-emoji{font-size:64px;line-height:1}
    .wheel-text{font-size:16px;font-weight:800}
    .spin-btn{
      margin-top:8px; border:0; border-radius:999px; padding:10px 18px; font-weight:800; cursor:pointer;
      background:#fff; color:#1e3a8a; display:inline-flex; align-items:center; gap:8px; box-shadow:0 6px 18px #0003
    }
    .spin-btn:disabled{opacity:.6;cursor:not-allowed}
    .die{font-size:20px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25))}
    #choices{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:8px}
    #choices .opt{
      background:#fff; color:#111; border:1px solid #e5e7eb; border-radius:12px; padding:10px 14px;
      display:flex; align-items:center; gap:8px; font-size:18px; cursor:pointer; box-shadow:0 4px 12px #0001
    }
    #choices .opt:hover{transform:translateY(-1px); box-shadow:0 8px 18px #0002}
    #choices .opt .em{font-size:24px}
    #choices .opt .txt-only{font-weight:700;opacity:.9}
    #status{text-align:center;font-weight:800;color:#fff;text-shadow:0 1px 2px #0008;margin:6px}
    .spinning{animation:spin 1s ease-in-out}
    @keyframes spin{from{transform:rotate(0)}to{transform:rotate(720deg)}}
    .result-card button,.result-card .back{
      background:#1d4ed8;color:#fff;border:0;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer;text-decoration:none
    }
    .result-card button:hover,.result-card .back:hover{filter:brightness(1.08)}
  `;
  document.head.appendChild(css);

  // --- بدء اللعب
  updateHUD();
  nextRound();
}
