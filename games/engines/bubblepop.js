// bubblepop.js — STUB for diagnosis
export async function start({ stage, game, levelId='L1' }) {
  stage.innerHTML = `
    <div style="width:min(920px,96%);margin:auto;text-align:center;color:#fff">
      <h2>🫧 BubblePop Engine Loaded</h2>
      <p>Game: <b>${game?.id}</b> — Level: <b>${levelId}</b></p>
      <a href="/p/games.html" style="color:#fff;text-decoration:underline">← Back</a>
    </div>`;
  console.log('BubblePop OK');
}
