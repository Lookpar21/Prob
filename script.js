// Baccarat Probability Lab (8-Deck)
// Exact two-card totals via combinatorics + Monte Carlo for full-hand next round.

const RANKS = [1,2,3,4,5,6,7,8,9,10,11,12,13]; // Ace..King
const DISPLAY = {1:"A",2:"2",3:"3",4:"4",5:"5",6:"6",7:"7",8:"8",9:"9",10:"10",11:"J",12:"Q",13:"K"};
const VAL = r => (r>=1 && r<=9) ? r : 0;

function makeCounts8Deck() {
  const c = {};
  for (const r of RANKS) c[r] = 32; // 4 suits * 8 decks
  return c;
}

let baseCounts = makeCounts8Deck();
let removed = [];  // list of ranks removed in order

// ---------- UI ----------
const rankButtonsDiv = document.getElementById("rankButtons");
const removedListDiv = document.getElementById("removedList");
const countsTableDiv = document.getElementById("countsTable");
const btnUndo = document.getElementById("btnUndo");
const btnReset = document.getElementById("btnReset");
const btnPreset1 = document.getElementById("btnPreset1");
const btnComputeExact = document.getElementById("btnComputeExact");
const exactResultsDiv = document.getElementById("exactResults");
const simNInput = document.getElementById("simN");
const btnSim = document.getElementById("btnSim");
const simStatus = document.getElementById("simStatus");
const simResultsDiv = document.getElementById("simResults");

function renderRankButtons() {
  rankButtonsDiv.innerHTML = "";
  for (const r of RANKS) {
    const btn = document.createElement("button");
    btn.className = "rank-btn";
    btn.textContent = DISPLAY[r];
    btn.title = `ลบ ${DISPLAY[r]} 1 ใบ (เหลือ ${baseCounts[r]} ใบ)`;
    btn.disabled = baseCounts[r] <= 0;
    btn.onclick = () => {
      if (baseCounts[r] > 0) {
        baseCounts[r] -= 1;
        removed.push(r);
        renderAll();
      }
    };
    rankButtonsDiv.appendChild(btn);
  }
}

function renderRemoved() {
  removedListDiv.innerHTML = "";
  if (removed.length === 0) {
    const span = document.createElement("span");
    span.textContent = "— ไม่มี —";
    span.style.color = "#64748b";
    removedListDiv.appendChild(span);
    return;
  }
  for (const r of removed) {
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = DISPLAY[r];
    removedListDiv.appendChild(b);
  }
}

function renderCountsTable() {
  let rows = `<table><thead><tr><th>หน้าไพ่</th><th>เหลือ</th></tr></thead><tbody>`;
  for (const r of RANKS) {
    rows += `<tr><td style="text-align:left">${DISPLAY[r]}</td><td>${baseCounts[r]}</td></tr>`;
  }
  const total = Object.values(baseCounts).reduce((a,b)=>a+b,0);
  rows += `</tbody><tfoot><tr><td style="text-align:left">รวม</td><td>${total}</td></tr></tfoot></table>`;
  countsTableDiv.innerHTML = rows;
}

btnUndo.onclick = () => {
  const r = removed.pop();
  if (r) baseCounts[r] += 1;
  renderAll();
};
btnReset.onclick = () => {
  baseCounts = makeCounts8Deck();
  removed = [];
  renderAll();
};
btnPreset1.onclick = () => {
  // remove J,J,K,K,9 if available
  const preset = [11,11,13,13,9];
  for (const r of preset) {
    if (baseCounts[r] > 0) {
      baseCounts[r] -= 1;
      removed.push(r);
    }
  }
  renderAll();
};

function renderAll() {
  renderRankButtons();
  renderRemoved();
  renderCountsTable();
}
renderAll();

// ---------- Exact combinatorics for two-card totals ----------
function comb2(n){ return n<2 ? 0 : (n*(n-1))/2; }

function exactTwoCardTotals(counts) {
  const N = Object.values(counts).reduce((a,b)=>a+b,0);
  const totalPairs = comb2(N);
  const ways = Array(10).fill(0);
  const ranks = RANKS;

  for (let i=0;i<ranks.length;i++){
    const ri = ranks[i], ci = counts[ri]; if (ci<=0) continue;
    const vi = VAL(ri)%10;
    if (ci>=2){
      const t = (vi+vi)%10;
      ways[t] += comb2(ci);
    }
    for (let j=i+1;j<ranks.length;j++){
      const rj = ranks[j], cj = counts[rj]; if (cj<=0) continue;
      const vj = VAL(rj)%10;
      const t = (vi+vj)%10;
      ways[t] += ci*cj;
    }
  }
  const rows = ways.map((w,t)=>({ total:t, prob: 100*w/totalPairs }));
  const pNat = (ways[8]+ways[9]) / totalPairs * 100;
  return { rows, pNat, N, totalPairs };
}

btnComputeExact.onclick = () => {
  const {rows, pNat, N} = exactTwoCardTotals(baseCounts);
  let html = `<table><thead><tr><th>Two-card total</th><th>Exact Probability (%)</th></tr></thead><tbody>`;
  for (const r of rows){
    html += `<tr><td style="text-align:left">${r.total}</td><td>${r.prob.toFixed(6)}</td></tr>`;
  }
  html += `</tbody><tfoot><tr><td style="text-align:left">Natural (8/9) — มือ 2 ใบเดียว</td><td>${pNat.toFixed(6)}</td></tr>`;
  html += `<tr><td style="text-align:left">ไพ่เหลือในขอน</td><td>${N}</td></tr></tfoot></table>`;
  exactResultsDiv.innerHTML = html;
};

// ---------- Monte Carlo full-hand simulation ----------
function sampleWithoutReplacement(pool, k, rng){
  // pool is array of ranks with counts; we sample by index-weighted method
  // Build flat array indices only when needed; for speed, construct on the fly.
  // Simple method: create an array of rank repeated counts (ok up to 416).
  const bag = [];
  for (const r of RANKS){
    for (let i=0;i<pool[r];i++) bag.push(r);
  }
  // Fisher-Yates shuffle small subset: we'll just shuffle and take k
  for (let i=bag.length-1;i>0;i--){
    const j = Math.floor(rng()* (i+1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag.slice(0,k);
}

function playOneHand(counts, rng){
  // returns {natural, pDraw, bDraw, outcome}
  const bag = {};
  for (const r of RANKS) bag[r] = counts[r];
  const draw = (n)=>{
    const picks = sampleWithoutReplacement(bag, n, rng);
    // decrement
    for (const r of picks) bag[r]-=1;
    return picks;
  };
  // deal P1,B1,P2,B2 (ordered but we only need ranks)
  const first4 = sampleWithoutReplacement(bag, 4, rng);
  for (const r of first4) bag[r]-=1;
  const P = [first4[0], first4[2]];
  const B = [first4[1], first4[3]];
  const tot = arr => (arr.reduce((s,r)=>s+VAL(r),0)%10);
  let pt = tot(P), bt = tot(B);
  let natural = (pt>=8)||(bt>=8);
  let pDraw=false, bDraw=false;

  if (!natural){
    if (pt<=5){
      // player draws one
      const p3 = sampleWithoutReplacement(bag,1,rng)[0]; bag[p3]-=1;
      pDraw = true;
      P.push(p3); pt = tot(P);
      const p3v = VAL(p3);
      // banker rule if player drew
      if (bt<=2) bDraw=true;
      else if (bt===3 && p3v!==8) bDraw=true;
      else if (bt===4 && [2,3,4,5,6,7].includes(p3v)) bDraw=true;
      else if (bt===5 && [4,5,6,7].includes(p3v)) bDraw=true;
      else if (bt===6 && [6,7].includes(p3v)) bDraw=true;
      if (bDraw){
        const b3 = sampleWithoutReplacement(bag,1,rng)[0]; bag[b3]-=1;
        B.push(b3); bt = tot(B);
      }
    } else {
      // player stands on 6-7
      if (bt<=5){
        bDraw=true;
        const b3 = sampleWithoutReplacement(bag,1,rng)[0]; bag[b3]-=1;
        B.push(b3); bt = tot(B);
      }
    }
  }

  let outcome = "Tie";
  if (pt>bt) outcome = "Player";
  else if (bt>pt) outcome = "Banker";
  return {natural, pDraw, bDraw, outcome};
}

function runSim(iter, counts){
  const rng = Math.random; // default; sufficient for estimation
  let nat=0, pd=0, bd=0, b=0, p=0, t=0;
  for (let i=0;i<iter;i++){
    const r = playOneHand(counts, rng);
    if (r.natural) nat++;
    if (r.pDraw) pd++;
    if (r.bDraw) bd++;
    if (r.outcome==="Banker") b++;
    else if (r.outcome==="Player") p++;
    else t++;
  }
  const toPct = (x)=> (100*x/iter).toFixed(4);
  let html = `<table><thead><tr><th>Metric</th><th>Estimate (%)</th></tr></thead><tbody>`;
  html += `<tr><td style="text-align:left">Natural (either side)</td><td>${toPct(nat)}</td></tr>`;
  html += `<tr><td style="text-align:left">Player Draw</td><td>${toPct(pd)}</td></tr>`;
  html += `<tr><td style="text-align:left">Banker Draw</td><td>${toPct(bd)}</td></tr>`;
  html += `<tr><td style="text-align:left">Outcome — Banker</td><td>${toPct(b)}</td></tr>`;
  html += `<tr><td style="text-align:left">Outcome — Player</td><td>${toPct(p)}</td></tr>`;
  html += `<tr><td style="text-align:left">Outcome — Tie</td><td>${toPct(t)}</td></tr>`;
  html += `</tbody></table>`;
  return html;
}

btnSim.onclick = () => {
  const iter = Math.max(1000, Math.min(2000000, parseInt(simNInput.value||"200000",10)));
  simStatus.textContent = "กำลังจำลอง…";
  setTimeout(()=>{
    const html = runSim(iter, baseCounts);
    simResultsDiv.innerHTML = html;
    simStatus.textContent = "เสร็จแล้ว";
  }, 10);
};
