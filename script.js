// ====== Constants & State ======
const RANKS=[1,2,3,4,5,6,7,8,9,10,11,12,13];
const DISPLAY={1:"A",2:"2",3:"3",4:"4",5:"5",6:"6",7:"7",8:"8",9:"9",10:"10",11:"J",12:"Q",13:"K"};
const VAL=r=>(r>=1&&r<=9)?r:0;

function makeCounts(){ const c={}; for(const r of RANKS) c[r]=32; return c; }
let baseCounts=makeCounts();

// history keeps {rank, side:'P'|'B'}
let history=[];
let removedP=[], removedB=[];
let currentSide='P';

// UI refs
const sideP=document.getElementById("sideP");
const sideB=document.getElementById("sideB");
const rankButtonsDiv=document.getElementById("rankButtons");
const removedListP=document.getElementById("removedListP");
const removedListB=document.getElementById("removedListB");
const cntP=document.getElementById("cntP");
const cntB=document.getElementById("cntB");
const countsTableDiv=document.getElementById("countsTable");
const btnUndo=document.getElementById("btnUndo");
const btnReset=document.getElementById("btnReset");
const btnPreset1=document.getElementById("btnPreset1");
const btnComputeExact=document.getElementById("btnComputeExact");
const exactResultsDiv=document.getElementById("exactResults");
const simNInput=document.getElementById("simN");
const btnSim=document.getElementById("btnSim");
const simStatus=document.getElementById("simStatus");
const simResultsDiv=document.getElementById("simResults");
const tiePayoutSel=document.getElementById("tiePayout");
const recBox=document.getElementById("recBox");
const evTable=document.getElementById("evTable");

// ====== UI Handlers ======
sideP.onclick=()=>{ currentSide='P'; sideP.classList.add('active','p'); sideB.classList.remove('active'); };
sideB.onclick=()=>{ currentSide='B'; sideB.classList.add('active','b'); sideP.classList.remove('active'); };

function renderRankButtons(){
  rankButtonsDiv.innerHTML="";
  for(const r of RANKS){
    const b=document.createElement("button");
    b.className="rank-btn"; b.textContent=DISPLAY[r];
    b.title=`ลบ ${DISPLAY[r]} 1 ใบ (เหลือ ${baseCounts[r]} ใบ) — ฝั่ง: ${currentSide==='P'?'Player':'Banker'}`;
    b.disabled=baseCounts[r]<=0;
    b.onclick=()=>{
      if(baseCounts[r]<=0) return;
      baseCounts[r]-=1;
      history.push({rank:r, side:currentSide});
      if(currentSide==='P') removedP.push(r); else removedB.push(r);
      renderAll();
    };
    rankButtonsDiv.appendChild(b);
  }
}
function renderRemoved(){
  removedListP.innerHTML="";
  removedListB.innerHTML="";
  for(const r of removedP){ const tag=document.createElement("span"); tag.className="badge p"; tag.textContent=DISPLAY[r]; removedListP.appendChild(tag); }
  for(const r of removedB){ const tag=document.createElement("span"); tag.className="badge b"; tag.textContent=DISPLAY[r]; removedListB.appendChild(tag); }
  cntP.textContent=removedP.length.toString();
  cntB.textContent=removedB.length.toString();
}
function renderCounts(){
  let html=`<table><thead><tr><th>หน้าไพ่</th><th>เหลือ</th></tr></thead><tbody>`;
  for(const r of RANKS){ html+=`<tr><td style="text-align:left">${DISPLAY[r]}</td><td>${baseCounts[r]}</td></tr>`; }
  const total=Object.values(baseCounts).reduce((a,b)=>a+b,0);
  html+=`</tbody><tfoot><tr><td style="text-align:left">รวม</td><td>${total}</td></tr></tfoot></table>`;
  countsTableDiv.innerHTML=html;
}
btnUndo.onclick=()=>{
  const last=history.pop();
  if(!last) return;
  baseCounts[last.rank]+=1;
  if(last.side==='P'){ removedP.pop(); } else { removedB.pop(); }
  renderAll();
};
btnReset.onclick=()=>{
  baseCounts=makeCounts();
  history=[]; removedP=[]; removedB=[];
  renderAll();
};
btnPreset1.onclick=()=>{
  for(const r of [11,11,13,13,9]){
    if(baseCounts[r]>0){
      baseCounts[r]-=1;
      history.push({rank:r, side:'P'}); // default to Player
      removedP.push(r);
    }
  }
  renderAll();
};
function renderAll(){ renderRankButtons(); renderRemoved(); renderCounts(); }
renderAll();

// ====== Exact two-card combinatorics ======
function comb2(n){ return n<2?0:(n*(n-1))/2; }
function exactTwoTotals(counts){
  const N=Object.values(counts).reduce((a,b)=>a+b,0);
  const totalPairs=comb2(N);
  const ways=Array(10).fill(0);
  for(let i=0;i<RANKS.length;i++){
    const ri=RANKS[i], ci=counts[ri]; if(ci<=0) continue;
    const vi=VAL(ri)%10;
    if(ci>=2){ ways[(vi+vi)%10]+=comb2(ci); }
    for(let j=i+1;j<RANKS.length;j++){
      const rj=RANKS[j], cj=counts[rj]; if(cj<=0) continue;
      const vj=VAL(rj)%10; ways[(vi+vj)%10]+=ci*cj;
    }
  }
  const rows=ways.map((w,t)=>({t, p:100*w/totalPairs}));
  const pNat=(ways[8]+ways[9])/totalPairs*100;
  return {rows,pNat,N};
}
btnComputeExact.onclick=()=>{
  const {rows,pNat,N}=exactTwoTotals(baseCounts);
  let html=`<table><thead><tr><th>Two-card total</th><th>Exact Probability (%)</th></tr></thead><tbody>`;
  for(const r of rows){ html+=`<tr><td style="text-align:left">${r.t}</td><td>${r.p.toFixed(6)}</td></tr>`; }
  html+=`</tbody><tfoot><tr><td style="text-align:left">Natural (8/9) — มือ 2 ใบเดียว</td><td>${pNat.toFixed(6)}</td></tr>`;
  html+=`<tr><td style="text-align:left">ไพ่เหลือในขอน</td><td>${N}</td></tr></tfoot></table>`;
  exactResultsDiv.innerHTML=html;
};

// ====== Monte Carlo simulation (full rules) ======
function sample(pool,k,rng){
  const bag=[]; for(const r of RANKS){ for(let i=0;i<pool[r];i++) bag.push(r); }
  for(let i=bag.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]]; }
  return bag.slice(0,k);
}
function playOne(counts,rng){
  const bag={}; for(const r of RANKS) bag[r]=counts[r];
  const draw=(n)=>{ const picks=sample(bag,n,rng); for(const r of picks) bag[r]-=1; return picks; };
  const first4=draw(4);
  const P=[first4[0],first4[2]], B=[first4[1],first4[3]];
  const tot=a=>(a.reduce((s,r)=>s+VAL(r),0)%10);
  let pt=tot(P), bt=tot(B);
  let natural=(pt>=8)||(bt>=8), pDraw=false, bDraw=false;
  if(!natural){
    if(pt<=5){
      const p3=draw(1)[0]; pDraw=true; P.push(p3); pt=tot(P); const p3v=VAL(p3);
      if(bt<=2) bDraw=true;
      else if(bt===3 && p3v!==8) bDraw=true;
      else if(bt===4 && [2,3,4,5,6,7].includes(p3v)) bDraw=true;
      else if(bt===5 && [4,5,6,7].includes(p3v)) bDraw=true;
      else if(bt===6 && [6,7].includes(p3v)) bDraw=true;
      if(bDraw){ const b3=draw(1)[0]; B.push(b3); bt=tot(B); }
    } else {
      if(bt<=5){ bDraw=true; const b3=draw(1)[0]; B.push(b3); bt=tot(B); }
    }
  }
  let outcome="Tie"; if(pt>bt) outcome="Player"; else if(bt>pt) outcome="Banker";
  return {natural, pDraw, bDraw, outcome};
}
let lastSim=null;
function runSim(iter,counts){
  const rng=Math.random;
  let nat=0,pd=0,bd=0,b=0,p=0,t=0;
  for(let i=0;i<iter;i++){
    const r=playOne(counts,rng);
    if(r.natural) nat++; if(r.pDraw) pd++; if(r.bDraw) bd++;
    if(r.outcome==="Banker") b++; else if(r.outcome==="Player") p++; else t++;
  }
  lastSim={pB:100*b/iter, pP:100*p/iter, pT:100*t/iter, nat:100*nat/iter, pDraw:100*pd/iter, bDraw:100*bd/iter};
  let html=`<table><thead><tr><th>Metric</th><th>Estimate (%)</th></tr></thead><tbody>`;
  html+=`<tr><td style="text-align:left">Natural (either side)</td><td>${lastSim.nat.toFixed(4)}</td></tr>`;
  html+=`<tr><td style="text-align:left">Player Draw</td><td>${lastSim.pDraw.toFixed(4)}</td></tr>`;
  html+=`<tr><td style="text-align:left">Banker Draw</td><td>${lastSim.bDraw.toFixed(4)}</td></tr>`;
  html+=`<tr><td style="text-align:left">Outcome — Banker</td><td>${lastSim.pB.toFixed(4)}</td></tr>`;
  html+=`<tr><td style="text-align:left">Outcome — Player</td><td>${lastSim.pP.toFixed(4)}</td></tr>`;
  html+=`<tr><td style="text-align:left">Outcome — Tie</td><td>${lastSim.pT.toFixed(4)}</td></tr>`;
  html+=`</tbody></table>`;
  simResultsDiv.innerHTML=html;
  renderRecommendation();
}
btnSim.onclick=()=>{
  const iter=Math.max(1000,Math.min(2000000,parseInt(simNInput.value||"200000",10)));
  simStatus.textContent="กำลังจำลอง…";
  setTimeout(()=>{ runSim(iter,baseCounts); simStatus.textContent="เสร็จแล้ว"; },20);
};

// ====== EV + Recommendation ======
function renderRecommendation(){
  if(!lastSim){
    recBox.className="recommend neutral";
    recBox.innerHTML='<p class="rec-title">ยังไม่มีผลจำลอง</p><p class="rec-sub">กด “เริ่มจำลอง” ก่อน แล้วระบบจะแนะนำให้อัตโนมัติ</p>';
    evTable.innerHTML="";
    return;
  }
  const pB=lastSim.pB/100, pP=lastSim.pP/100, pT=lastSim.pT/100;
  const tiePay=parseFloat(tiePayoutSel.value||"8");
  const EV_B=0.95*pB - pP;
  const EV_P=pP - pB;
  const EV_T=tiePay*pT - (1-pT);
  function f(x){ return (100*x).toFixed(3)+"%"; }
  let html=`<table><thead><tr><th>ตัวเลือก</th><th>EV ต่อ 1 หน่วย</th><th>เงื่อนไขกำไร</th></tr></thead><tbody>`;
  html+=`<tr><td style="text-align:left">Banker (จ่าย 0.95:1)</td><td>${f(EV_B)}</td><td>ต้องมี 0.95·pB > pP</td></tr>`;
  html+=`<tr><td style="text-align:left">Player (จ่าย 1:1)</td><td>${f(EV_P)}</td><td>ต้องมี pP > pB</td></tr>`;
  html+=`<tr><td style="text-align:left">Tie (จ่าย ${tiePay}:1)</td><td>${f(EV_T)}</td><td>${tiePay===8?'pT > 11.11%':'pT > 10%'}</td></tr>`;
  html+=`</tbody></table>`;
  evTable.innerHTML=html;
  let rec="รอ/ข้ามตานี้", sub="ยังไม่มีทางเลือกที่ EV เป็นบวก", cls="neutral";
  const best=Math.max(EV_B,EV_P,EV_T);
  if(best>0){
    if(best===EV_B){ rec="แนะนำลง Banker"; sub=`EV_B = ${f(EV_B)} (pB=${(pB*100).toFixed(2)}%, pP=${(pP*100).toFixed(2)}%)`; cls="good"; }
    else if(best===EV_P){ rec="แนะนำลง Player"; sub=`EV_P = ${f(EV_P)} (pP=${(pP*100).toFixed(2)}%, pB=${(pB*100).toFixed(2)}%)`; cls="good"; }
    else { rec="พิจารณา Tie"; sub=`EV_T = ${f(EV_T)} (pT=${(pT*100).toFixed(2)}%, จ่าย ${tiePay}:1)`; cls="good"; }
  } else {
    if(best===EV_B){ sub=`Banker เสียเปรียบน้อยสุด: ${f(EV_B)}`; cls="warn"; }
    else if(best===EV_P){ sub=`Player เสียเปรียบน้อยสุด: ${f(EV_P)}`; cls="warn"; }
    else { sub=`Tie เสียเปรียบน้อยสุด: ${f(EV_T)}`; cls="warn"; }
  }
  recBox.className="recommend "+cls;
  recBox.innerHTML=`<p class="rec-title">${rec}</p><p class="rec-sub">${sub}</p>`;
}
tiePayoutSel.onchange=()=>renderRecommendation();