// Bubble Pop — L1 Minimal Launch
export async function start({ stage, game, levelId='L1' }) {
  const S = Object.assign({ tts:true, confetti:true, progress:true, stars:true }, game.settings||{});
  const level = (game.levels||[]).find(l=>l.id===levelId) || game.levels?.[0] || {time:35,target:10};
  const CFG = { time: level.time||35, target: level.target||10, colors:['red','blue','green','purple','orange'] };

  const lang = (localStorage.getItem('ffk_lang') || (document.dir==='rtl'?'ar':'en')).toLowerCase();
  const t = (ar,en)=> lang==='ar'? ar : en;

  stage.innerHTML = `
    <div id="bp-wrap">
      <div id="hud">
        <span id="hud-time">⏱️ --</span>
        <span>·</span>
        <span id="hud-score">⭐ 0</span>
        <span id="hud-level" style="margin-inline-start:auto">${level.id}</span>
      </div>

      <div id="progress"><div id="bar"></div>
        <div id="stars"><span class="st">☆</span><span class="st">☆</span><span class="st">☆</span></div>
      </div>

      <div id="target"></div>
      <div id="playfield"></div>
    </div>
  `;

  // refs
  const pf = document.getElementById('playfield');
  const targetEl = document.getElementById('target');
  const hudTime = document.getElementById('hud-time');
  const hudScore= document.getElementById('hud-score');
  const bar     = document.getElementById('bar');
  const starsEl = Array.from(document.querySelectorAll('#stars .st'));

  // state
  let time = CFG.time, score = 0, timer=null, targetColor='red';
  const NAME = {
    red:t('أحمر','Red'), blue:t('أزرق','Blue'), green:t('أخضر','Green'),
    purple:t('بنفسجي','Purple'), orange:t('برتقالي','Orange')
  };

  // helpers
  const speak = (msg)=>{ try{ if(!S.tts) return; const u=new SpeechSynthesisUtterance(msg); u.lang=(lang==='ar')?'ar':'en-US'; speechSynthesis.cancel(); speechSynthesis.speak(u);}catch{} };
  const confetti=()=>{ if(!S.confetti) return; const layer=document.createElement('div'); layer.className='confetti'; document.body.appendChild(layer); for(let i=0;i<24;i++){ const p=document.createElement('i'); p.style.left=(Math.random()*100)+'%'; p.style.setProperty('--h',(window.innerHeight+80)+'px'); p.style.background=['#f59e0b','#10b981','#3b82f6','#ef4444','#a855f7'][i%5]; layer.appendChild(p);} setTimeout(()=>layer.remove(),900); };
  function updateHUD(){
    hudTime.textContent=`⏱️ ${time}`;
    hudScore.textContent=`⭐ ${score}`;
    if(S.progress){ const pct=Math.min(100,(score/CFG.target)*100); bar.style.width=pct+'%'; }
    if(S.stars){
      const s1=score>=Math.ceil(CFG.target*0.5), s2=score>=Math.ceil(CFG.target*0.75), s3=score>=CFG.target;
      starsEl[0].textContent=s1?'★':'☆'; starsEl[1].textContent=s2?'★':'☆'; starsEl[2].textContent=s3?'★':'☆';
    }
  }

  // target
  function setTarget(){
    targetColor = CFG.colors[Math.floor(Math.random()*CFG.colors.length)];
    targetEl.innerHTML = `<div class="tg"><span class="dot" style="background:${targetColor}"></span>${t('اضغط الفُقاعات','Tap the bubbles')}: <b>${NAME[targetColor]}</b></div>`;
  }

  // spawn bubbles
  function spawn(n=10){
    pf.innerHTML='';
    for(let i=0;i<n;i++){
      const c = CFG.colors[Math.floor(Math.random()*CFG.colors.length)];
      const b = document.createElement('button');
      b.className='bub'; b.dataset.c=c;
      const left = Math.random()*80+10; // %
      const size = 40 + Math.random()*26; // px
      const delay= Math.random()*1000;
      b.style.left=left+'%'; b.style.width=b.style.height=size+'px';
      b.style.animationDelay = (-delay)+'ms';
      b.innerHTML = `<span class="core" style="background:${c}"></span>`;
      b.onclick = ()=>{
        if(c===targetColor){
          score++; confetti(); speak(t('أحسنت!','Great!')); updateHUD();
          b.classList.add('pop'); setTimeout(()=>b.remove(),180);
          if(score>=CFG.target) end(true);
        }else{
          speak(t('حاول مجددًا','Try again'));
          b.classList.add('shake'); setTimeout(()=>b.classList.remove('shake'),250);
        }
        // بدّل الهدف كل 3 نقاط لزيادة الحركة
        if(score%3===0) setTarget();
      };
      pf.appendChild(b);
    }
  }

  // timer
  timer = setInterval(()=>{ time--; updateHUD(); if(time<=5){ /* tick لو حبيت */ } if(time<=0) end(false); },1000);

  function end(win){
    clearInterval(timer);
    const pct = Math.min(1, score/CFG.target);
    const title = win ? t('ممتاز!','Excellent!') : (pct>=.5?t('محاولة جيدة!','Good try!'):t('حاول مجددًا','Try again'));
    const stars = win?3:(pct>=.75?2:(pct>=.5?1:0));
    const ov=document.createElement('div'); ov.className='result-overlay'; ov.innerHTML=`
      <div class="result-card">
        <h2>${title}</h2>
        <p>${t('النقاط','Score')}: ${score} / ${CFG.target}</p>
        <p style="font-size:22px;margin:8px 0">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</p>
        <div class="row">
          <button id="bp-retry">🔁 ${t('إعادة','Retry')}</button>
          <a class="home" href="/p/games.html">🏠 ${t('القائمة','Catalog')}</a>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#bp-retry').onclick=()=>location.reload();
  }

  // css
  const css=document.createElement('style'); css.textContent=`
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
    .bub .core{display:block;width:100%;height:100%;border-radius:999px;opacity:.85;box-shadow:inset 0 0 10px #fff8, 0 8px 18px #0002}
    .bub{animation:float 4.5s linear infinite}
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
  `; document.head.appendChild(css);

  // boot
  setTarget(); spawn(14); updateHUD();
}
