// Spin & Match — Final v1.0
// تصحيح الألوان والاختيارات + جاهز للعمل مباشرة

(async function startGame() {

  // -------- Settings & Level --------
  const SYMBOLS = [
    { id:'red-circle', em:'🔴', ar:'دائرة حمراء', en:'Red circle' },
    { id:'blue-square', em:'🟦', ar:'مربع أزرق', en:'Blue square' },
    { id:'red-triangle', em:'🔺', ar:'مثلث أحمر', en:'Red triangle' }, // لون ثابت
    { id:'yellow-star', em:'⭐', ar:'نجمة صفراء', en:'Yellow star' },
    { id:'purple-heart', em:'💜', ar:'قلب بنفسجي', en:'Purple heart' }
  ];

  // -------- Layout --------
  const stage = document.getElementById('root');
  stage.innerHTML = `
    <div id="gm-wrap">
      <div id="hud">
        <span id="hud-time">⏱️ --</span>
        <span>·</span>
        <span id="hud-score">⭐ 0</span>
      </div>

      <div id="wheel-zone">
        <div id="wheel"></div>
        <button id="btn-spin">🎲 ابدأ الدوران</button>
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

  // -------- State --------
  let score = 0, time = 40, target = null, spinning = false;

  // -------- Helpers --------
  const rand = a => a[Math.floor(Math.random()*a.length)];
  const shuffle = a => a.sort(()=>Math.random()-0.5);

  function updateHUD() {
    hudTime.textContent = `⏱️ ${time}`;
    hudScore.textContent = `⭐ ${score}`;
  }

  function nextRound() {
    target = rand(SYMBOLS);
    wheel.innerHTML = '';
    status.textContent = 'اضغط Spin!';
    choices.innerHTML = '';

    // إنشاء اختيارات
    const opts = [target];
    while(opts.length < 3) { // 3 اختيارات
      const r = rand(SYMBOLS);
      if(!opts.includes(r)) opts.push(r);
    }
    shuffle(opts);

    choices.innerHTML = opts.map(o=>`<button data-id="${o.id}">${o.em} ${o.ar}</button>`).join('');

    choices.querySelectorAll('button').forEach(b=>{
      b.onclick = ()=>{
        if(b.dataset.id === target.id){
          score++; status.textContent='✔️ صحيح!'; updateHUD();
        } else {
          status.textContent='❌ خطأ'; 
        }
        nextRound();
      }
    });
  }

  // -------- Spin --------
  btn.onclick = ()=>{
    if(spinning) return;
    spinning = true;
    wheel.classList.add('spinning');
    setTimeout(()=>{
      wheel.classList.remove('spinning');
      wheel.textContent = target.em;
      spinning=false;
      nextRound();
    }, 800);
  };

  // -------- Timer --------
  setInterval(()=>{
    time--;
    updateHUD();
    if(time<=0) alert(`انتهت اللعبة! النقاط: ${score}`);
  }, 1000);

  // -------- Boot --------
  updateHUD();
  nextRound();

})();
