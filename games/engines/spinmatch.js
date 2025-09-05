export async function start({stage, game}) {
  stage.innerHTML = `
    <div id="wheel-zone">
      <div id="wheel">🎨</div>
      <button id="btn-spin">Spin 🎲</button>
    </div>
    <div id="choices"></div>
    <div id="status"></div>
  `;

  const wheel = document.getElementById('wheel');
  const btn = document.getElementById('btn-spin');
  const choices = document.getElementById('choices');
  const status = document.getElementById('status');

  const symbols = [
    {id:'red-circle', label:'🔴 دائرة'},
    {id:'blue-square', label:'🟦 مربع'},
    {id:'green-triangle', label:'🟢 مثلث'},
    {id:'yellow-star', label:'⭐ نجمة'},
    {id:'purple-heart', label:'💜 قلب'},
  ];

  let target = null;
  let score = 0;
  let tries = 0;
  let time = game.levels[0].time || 60;
  let timer = null;
  let onFinish = ()=>{};

  function nextRound() {
    // اختيار هدف عشوائي
    target = symbols[Math.floor(Math.random()*symbols.length)];
    wheel.textContent = "❓";
    status.textContent = "اضغط Spin!";
    choices.innerHTML = "";
  }

  btn.onclick = () => {
    // دوران شكلي
    wheel.classList.add("spinning");
    setTimeout(()=>{
      wheel.classList.remove("spinning");
      wheel.textContent = target.label;
      showChoices();
    }, 1200);
  };

  function showChoices(){
    const opts = [target];
    while(opts.length<3){
      const r = symbols[Math.floor(Math.random()*symbols.length)];
      if(!opts.includes(r)) opts.push(r);
    }
    opts.sort(()=>Math.random()-0.5);
    choices.innerHTML = opts.map(o=>`<button data-id="${o.id}">${o.label}</button>`).join('');
    choices.querySelectorAll("button").forEach(b=>{
      b.onclick = ()=>{
        tries++;
        if(b.dataset.id===target.id){
          score++;
          status.textContent = "✔️ صحيح!";
        } else {
          status.textContent = "❌ خطأ";
        }
        nextRound();
      };
    });
  }

  function endGame(){
    clearInterval(timer);
    stage.innerHTML = `
      <h2>انتهى الوقت ⏰</h2>
      <p>النقاط: ${score}</p>
      <p>المحاولات: ${tries}</p>
      <button onclick="location.reload()">🔄 إعادة</button>
    `;
    onFinish({level:"L1", score, ms: time*1000, stars: score>=5?3: (score>=3?2:1)});
  }

  // بدء المؤقّت
  timer = setInterval(()=>{
    time--;
    if(time<=0) endGame();
  },1000);

  nextRound();

  return { onFinish:(cb)=>onFinish=cb };
}
