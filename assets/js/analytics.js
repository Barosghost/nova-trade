/* ===== Module Analyse & Simulation ===== */
bootShell('analytics.html');
const LWC=window.LightweightCharts;
const V=document.getElementById('anView');
let _charts=[];
function clearCharts(){_charts.forEach(c=>{try{c.remove()}catch(_){}});_charts=[];}

/* ---------- metriques de performance a partir de l'historique ---------- */
function computeStats(){
  const w=Wallet.get();
  const closed=w.history.filter(h=>h.pnl!=null).slice().reverse(); // chrono
  const pnls=closed.map(h=>h.pnl);
  const wins=pnls.filter(p=>p>0),losses=pnls.filter(p=>p<=0);
  const grossWin=wins.reduce((a,b)=>a+b,0),grossLoss=Math.abs(losses.reduce((a,b)=>a+b,0));
  const realized=w.realized;
  // courbe d'equity reconstruite depuis 10000
  let eq=10000;const curve=[{i:0,v:10000}];
  closed.forEach((h,i)=>{eq+=h.pnl;curve.push({i:i+1,v:eq});});
  // drawdown
  let peak=-Infinity,maxDD=0,curDD=0;
  curve.forEach(p=>{peak=Math.max(peak,p.v);const dd=(peak-p.v)/peak*100;curDD=dd;maxDD=Math.max(maxDD,dd);});
  // R multiples (approx : perte moyenne comme 1R)
  const avgLossAbs=losses.length?Math.abs(losses.reduce((a,b)=>a+b,0)/losses.length):0;
  const rMultiples=avgLossAbs?pnls.map(p=>p/avgLossAbs):[];
  const expectancy=pnls.length?pnls.reduce((a,b)=>a+b,0)/pnls.length:0;
  return {
    nTrades:closed.length,nWins:wins.length,nLosses:losses.length,
    winRate:closed.length?wins.length/closed.length*100:0,
    profitFactor:grossLoss?grossWin/grossLoss:(grossWin>0?Infinity:0),
    expectancy,expectancyR:avgLossAbs?expectancy/avgLossAbs:0,
    realized,roi:realized/10000*100,
    avgWin:wins.length?grossWin/wins.length:0,
    avgLoss:losses.length?-grossLoss/losses.length:0,
    best:pnls.length?Math.max(...pnls):0,worst:pnls.length?Math.min(...pnls):0,
    maxDD,curDD,curve,pnls,rMultiples,
    unrealized:(()=>{let u=0;w.positions.forEach(p=>{const c=Engine.getPrice(p.symbol)||p.entry;u+=Engine.uPnl(p,c);});return u;})()
  };
}

/* ================= 1. CALCULATEUR DE TRADE ================= */
function viewCalc(){
  clearCharts();
  V.innerHTML=`<div class="an-grid2">
   <div class="card" style="padding:22px">
     <h3 style="margin-bottom:14px">🧮 Parametres du trade</h3>
     <div class="calc-grid">
       <div class="field"><label>Capital (USDT)</label><div class="input"><input id="cCap" type="number" value="10000"></div></div>
       <div class="field"><label>Risque par trade (%)</label><div class="input"><input id="cRisk" type="number" value="1"></div></div>
       <div class="field"><label>Sens</label><div class="seg" id="cSide"><button class="active" data-s="long">Long</button><button data-s="short">Short</button></div></div>
       <div class="field"><label>Levier</label><div class="input"><input id="cLev" type="number" value="10"></div></div>
       <div class="field"><label>Prix d'entree</label><div class="input"><input id="cEntry" type="number" value="60000"></div></div>
       <div class="field"><label>Stop Loss</label><div class="input"><input id="cSl" type="number" value="58800"></div></div>
       <div class="field"><label>Take Profit</label><div class="input"><input id="cTp" type="number" value="63000"></div></div>
       <div class="field"><label>Frais (% par cote)</label><div class="input"><input id="cFee" type="number" value="0.1"></div></div>
     </div>
   </div>
   <div class="card" style="padding:22px">
     <h3 style="margin-bottom:14px">📈 Resultats</h3>
     <div class="calc-out" id="cOut"></div>
   </div>
  </div>`;
  const side={v:'long'};
  document.getElementById('cSide').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(!b)return;side.v=b.dataset.s;[...e.currentTarget.children].forEach(x=>x.classList.remove('active'));b.classList.add('active');calc();});
  function calc(){
    const cap=+val('cCap'),risk=+val('cRisk'),lev=+val('cLev'),entry=+val('cEntry'),sl=+val('cSl'),tp=+val('cTp'),feeR=+val('cFee')/100;
    const riskAmt=cap*risk/100;
    const slDist=Math.abs(entry-sl);
    const qty=slDist?riskAmt/slDist:0;              // quantite pour risquer riskAmt
    const notional=qty*entry;
    const margin=notional/lev;
    const fees=notional*feeR*2;                     // entree+sortie
    const dirTp=side.v==='long'?(tp-entry):(entry-tp);
    const dirSl=side.v==='long'?(entry-sl):(sl-entry);
    const potLoss=qty*dirSl+notional*feeR*2;
    const potGain=qty*dirTp-notional*feeR*2;
    const rr=dirSl>0?dirTp/dirSl:0;
    const maint=0.005;const f=(1/lev)-maint;
    const liq=side.v==='long'?entry*(1-f):entry*(1+f);
    const cells=[
      ['Taille de position',fmt.num(notional,2)+' USDT'],['Quantite',qty.toFixed(6)],
      ['Marge requise',fmt.num(margin,2)+' USDT'],['Frais totaux',fmt.num(fees,2)+' USDT'],
      ['Perte potentielle','-'+fmt.num(Math.abs(potLoss),2),'down'],['Gain potentiel','+'+fmt.num(Math.abs(potGain),2),'up'],
      ['Ratio risque/rendement','1 : '+rr.toFixed(2),rr>=2?'up':rr>=1?'':'down'],['Prix liquidation est.',fmt.price(liq),'down'],
      ['Risque sur capital',fmt.pct(risk)+' ('+fmt.num(riskAmt,2)+')'],['Exposition',fmt.pct(notional/cap*100)]
    ];
    document.getElementById('cOut').innerHTML=cells.map(c=>`<div class="out-cell"><div class="l">${c[0]}</div><div class="v ${c[2]||''}">${c[1]}</div></div>`).join('');
  }
  ['cCap','cRisk','cLev','cEntry','cSl','cTp','cFee'].forEach(id=>document.getElementById(id).addEventListener('input',calc));
  calc();
}
function val(id){return document.getElementById(id).value;}

/* ================= 2. METRIQUES DE PERFORMANCE ================= */
function viewPerf(){
  clearCharts();
  const s=computeStats();
  const pf=s.profitFactor===Infinity?'∞':s.profitFactor.toFixed(2);
  const metrics=[
    ['PnL realise',(s.realized>=0?'+':'')+fmt.num(s.realized,2),fmt.cls(s.realized)],
    ['PnL non realise',(s.unrealized>=0?'+':'')+fmt.num(s.unrealized,2),fmt.cls(s.unrealized)],
    ['ROI',fmt.pct(s.roi),fmt.cls(s.roi)],
    ['Win rate',s.winRate.toFixed(1)+'%',s.winRate>=50?'up':'down'],
    ['Profit factor',pf,s.profitFactor>=1.5?'up':s.profitFactor>=1?'':'down'],
    ['Expectancy',(s.expectancy>=0?'+':'')+fmt.num(s.expectancy,2),fmt.cls(s.expectancy)],
    ['Expectancy (R)',s.expectancyR.toFixed(2)+'R',fmt.cls(s.expectancyR)],
    ['Drawdown actuel',s.curDD.toFixed(2)+'%','down'],
    ['Drawdown max',s.maxDD.toFixed(2)+'%','down'],
    ['Trades',s.nTrades+'',''],
    ['Gain moyen','+'+fmt.num(s.avgWin,2),'up'],
    ['Perte moyenne',fmt.num(s.avgLoss,2),'down'],
  ];
  V.innerHTML=`<div class="an-grid3" style="margin-bottom:16px">${metrics.map(m=>`<div class="metric"><div class="l">${m[0]}</div><div class="v ${m[2]}">${m[1]}</div></div>`).join('')}</div>
   <div class="an-grid2">
     <div class="card" style="padding:20px"><h3 style="margin-bottom:4px">Courbe de capital (equity)</h3><p class="muted" style="font-size:12.5px;margin-bottom:12px">Reconstruite depuis 10 000 USDT sur ${s.nTrades} trades fermes</p><div class="an-chart" id="eqChart"></div></div>
     <div class="card" style="padding:20px"><h3 style="margin-bottom:4px">Drawdown</h3><p class="muted" style="font-size:12.5px;margin-bottom:12px">Baisse depuis le dernier sommet (%)</p><div class="an-chart" id="ddChart"></div></div>
   </div>
   <div class="card" style="padding:20px;margin-top:16px"><h3 style="margin-bottom:12px">Distribution des R-multiples</h3><div class="dist-bars" id="rDist"></div><div class="muted" style="font-size:12px;margin-top:8px">Chaque trade exprime en multiple du risque (R). Vert = gain, rouge = perte.</div></div>`;
  if(s.nTrades<1){V.insertAdjacentHTML('afterbegin','<div class="warn-box" style="background:var(--surface2);border-color:var(--border);color:var(--muted)">Aucun trade ferme pour l\'instant — les metriques se rempliront au fur et a mesure. Va sur la page Trading pour generer de l\'historique.</div>');}
  drawEquity(s);
}
function drawEquity(s){
  const el=document.getElementById('eqChart');if(!el)return;
  const c=LWC.createChart(el,baseChartOpts());_charts.push(c);
  const area=c.addAreaSeries({lineColor:'#FCD535',topColor:'rgba(252,213,53,.22)',bottomColor:'rgba(252,213,53,0)',lineWidth:2});
  area.setData(s.curve.map(p=>({time:p.i+1700000000,value:+p.v.toFixed(2)})));
  c.timeScale().fitContent();new ResizeObserver(()=>c.applyOptions({width:el.clientWidth,height:300})).observe(el);
  const el2=document.getElementById('ddChart');
  const c2=LWC.createChart(el2,baseChartOpts());_charts.push(c2);
  const ddS=c2.addAreaSeries({lineColor:'#F6465D',topColor:'rgba(246,70,93,.25)',bottomColor:'rgba(246,70,93,0)',lineWidth:1});
  let peak=-Infinity;const dd=s.curve.map(p=>{peak=Math.max(peak,p.v);return {time:p.i+1700000000,value:-((peak-p.v)/peak*100)};});
  ddS.setData(dd);c2.timeScale().fitContent();new ResizeObserver(()=>c2.applyOptions({width:el2.clientWidth,height:300})).observe(el2);
  // R distribution
  const rd=document.getElementById('rDist');
  if(s.rMultiples.length){const mx=Math.max(1,...s.rMultiples.map(Math.abs));
    rd.innerHTML=s.rMultiples.map(r=>`<div title="${r.toFixed(2)}R" style="height:${Math.abs(r)/mx*100}%;background:${r>=0?'linear-gradient(180deg,#0ECB81,rgba(14,203,129,.3))':'linear-gradient(180deg,#F6465D,rgba(246,70,93,.3))'}"></div>`).join('');}
  else rd.innerHTML='<div class="muted" style="align-self:center;width:100%;text-align:center">Pas encore de donnees</div>';
}
function baseChartOpts(){return {height:300,layout:{background:{color:'transparent'},textColor:'#848E9C',fontFamily:'Space Grotesk'},grid:{vertLines:{color:'rgba(43,49,57,.3)'},horzLines:{color:'rgba(43,49,57,.3)'}},rightPriceScale:{borderColor:'#2B3139'},timeScale:{borderColor:'#2B3139',visible:false}};}

/* ================= 3. MONTE CARLO ================= */
function viewMC(){
  clearCharts();
  const s=computeStats();
  const wr=s.nTrades>=5?s.winRate:55, aw=s.avgWin||100, al=s.avgLoss||-80;
  V.innerHTML=`<div class="an-grid2" style="align-items:start">
   <div class="card" style="padding:22px">
     <h3 style="margin-bottom:14px">🎲 Parametres de simulation</h3>
     <div class="calc-grid">
       <div class="field"><label>Capital initial</label><div class="input"><input id="mCap" type="number" value="10000"></div></div>
       <div class="field"><label>Nb de trades / scenario</label><div class="input"><input id="mN" type="number" value="100"></div></div>
       <div class="field"><label>Win rate (%)</label><div class="input"><input id="mWr" type="number" value="${wr.toFixed(0)}"></div></div>
       <div class="field"><label>Gain moyen (USDT)</label><div class="input"><input id="mAw" type="number" value="${Math.abs(aw).toFixed(0)}"></div></div>
       <div class="field"><label>Perte moyenne (USDT)</label><div class="input"><input id="mAl" type="number" value="${Math.abs(al).toFixed(0)}"></div></div>
       <div class="field"><label>Seuil de ruine (%)</label><div class="input"><input id="mRuin" type="number" value="50"></div></div>
     </div>
     <div class="field" style="margin-top:12px"><label>Nombre de scenarios</label>
       <div class="seg" id="mScen"><button data-v="1000">1 000</button><button class="active" data-v="5000">5 000</button><button data-v="10000">10 000</button></div></div>
     <button class="btn btn-primary" style="width:100%;margin-top:16px" id="mRun">Lancer la simulation</button>
     <p class="hint">Modele : chaque trade est tire aleatoirement selon le win rate ; gains/pertes bruites de ±30%. ${s.nTrades>=5?'Valeurs pre-remplies depuis ton historique.':'Valeurs par defaut (pas assez d\'historique).'}</p>
   </div>
   <div class="card" style="padding:22px"><h3 style="margin-bottom:14px">Resultats</h3><div id="mOut"><div class="muted">Lance la simulation pour voir les resultats.</div></div></div>
  </div>
  <div class="card" style="padding:20px;margin-top:16px"><h3 style="margin-bottom:12px">Distribution des capitaux finaux</h3><div class="dist-bars" id="mDist"><div class="muted" style="align-self:center;width:100%;text-align:center">—</div></div><div class="muted" style="font-size:12px;margin-top:8px" id="mDistLbl"></div></div>
  <div class="card" style="padding:20px;margin-top:16px"><h3 style="margin-bottom:12px">Trajectoires d'equity (20 scenarios)</h3><div class="an-chart sm" id="mPaths"></div></div>`;
  let scen=5000;
  document.getElementById('mScen').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;scen=+b.dataset.v;[...e.currentTarget.children].forEach(x=>x.classList.remove('active'));b.classList.add('active');});
  document.getElementById('mRun').addEventListener('click',()=>runMC(scen));
}
function runMC(scen){
  const cap0=+val('mCap'),n=+val('mN'),wr=+val('mWr')/100,aw=Math.abs(+val('mAw')),al=Math.abs(+val('mAl')),ruinPct=+val('mRuin')/100;
  const ruinLevel=cap0*(1-ruinPct);
  const finals=[];let ruined=0,profitable=0;const dds=[];const samplePaths=[];
  for(let i=0;i<scen;i++){
    let eq=cap0,peak=cap0,maxdd=0,isRuined=false;const path=i<20?[eq]:null;
    for(let t=0;t<n;t++){
      const win=Math.random()<wr;
      const noise=1+(Math.random()-.5)*0.6;
      eq+=win?aw*noise:-al*noise;
      peak=Math.max(peak,eq);maxdd=Math.max(maxdd,(peak-eq)/peak*100);
      if(path)path.push(eq);
      if(eq<=ruinLevel&&!isRuined){isRuined=true;}
    }
    finals.push(eq);dds.push(maxdd);if(isRuined)ruined++;if(eq>cap0)profitable++;
    if(path)samplePaths.push(path);
  }
  finals.sort((a,b)=>a-b);dds.sort((a,b)=>a-b);
  const pct=(arr,p)=>arr[Math.floor(arr.length*p)];
  const out=[
    ['Probabilite de profit',(profitable/scen*100).toFixed(1)+'%',profitable/scen>=.5?'up':'down'],
    ['Risque de ruine',(ruined/scen*100).toFixed(2)+'%',ruined/scen>0.1?'down':'up'],
    ['Capital final median',fmt.num(pct(finals,.5),0),''],
    ['Meilleur cas (95e pct)',fmt.num(pct(finals,.95),0),'up'],
    ['Pire cas (5e pct)',fmt.num(pct(finals,.05),0),'down'],
    ['Drawdown median',pct(dds,.5).toFixed(1)+'%','down'],
    ['Pire drawdown',dds[dds.length-1].toFixed(1)+'%','down'],
    ['Capital moyen',fmt.num(finals.reduce((a,b)=>a+b,0)/scen,0),'']
  ];
  document.getElementById('mOut').innerHTML='<div class="calc-out">'+out.map(o=>`<div class="out-cell"><div class="l">${o[0]}</div><div class="v ${o[2]}">${o[1]}</div></div>`).join('')+'</div>';
  // histogramme distribution
  const nb=30,mn=finals[0],mx=finals[finals.length-1],w=(mx-mn)/nb||1;const bins=Array(nb).fill(0);
  finals.forEach(f=>{let k=Math.min(nb-1,Math.floor((f-mn)/w));bins[k]++;});const bmx=Math.max(...bins);
  document.getElementById('mDist').innerHTML=bins.map((b,i)=>{const mid=mn+(i+.5)*w;const col=mid>=cap0?'linear-gradient(180deg,#0ECB81,rgba(14,203,129,.3))':'linear-gradient(180deg,#F6465D,rgba(246,70,93,.3))';return `<div title="${fmt.num(mid,0)} USDT : ${b}" style="height:${b/bmx*100}%;background:${col}"></div>`;}).join('');
  document.getElementById('mDistLbl').textContent=`De ${fmt.num(mn,0)} a ${fmt.num(mx,0)} USDT • ${scen} scenarios • ${n} trades chacun. Barres vertes = fin au-dessus du capital initial.`;
  // trajectoires
  const el=document.getElementById('mPaths');el.innerHTML='';
  const c=LWC.createChart(el,{...baseChartOpts(),height:220});_charts.push(c);
  samplePaths.forEach((p,idx)=>{const ls=c.addLineSeries({color:p[p.length-1]>=cap0?'rgba(14,203,129,.5)':'rgba(246,70,93,.5)',lineWidth:1});ls.setData(p.map((v,i)=>({time:1700000000+i*60,value:+v.toFixed(2)})));});
  c.timeScale().fitContent();new ResizeObserver(()=>c.applyOptions({width:el.clientWidth,height:220})).observe(el);
  toast('Monte Carlo termine',scen+' scenarios simules','ok');
}

/* ================= 4. BACKTESTING (donnees reelles) ================= */
function viewBT(){
  clearCharts();
  V.innerHTML=`<div class="card" style="padding:22px;margin-bottom:16px">
     <div class="calc-grid">
       <div class="field"><label>Paire</label><div class="input"><input id="bSym" value="BTCUSDT"></div></div>
       <div class="field"><label>Periode</label><div class="seg" id="bTf">${['15m','1h','4h','1d'].map((t,i)=>`<button class="${i===1?'active':''}" data-v="${t}">${t}</button>`).join('')}</div></div>
       <div class="field"><label>Strategie</label><div class="seg" id="bStrat"><button class="active" data-v="ema">Croisement EMA</button><button data-v="rsi">RSI 30/70</button><button data-v="macd">MACD</button></div></div>
       <div class="field"><label>Capital initial</label><div class="input"><input id="bCap" type="number" value="10000"></div></div>
     </div>
     <button class="btn btn-primary" style="margin-top:14px" id="bRun">⏪ Lancer le backtest</button>
     <p class="hint">Backtest sur 500 bougies reelles (Binance). Position 100% du capital, frais 0.1% par trade. Resultats educatifs — ne reflete pas le slippage ni la liquidite reelle.</p>
   </div>
   <div class="an-grid3" id="bMetrics"></div>
   <div class="card" style="padding:20px;margin-top:16px"><h3 style="margin-bottom:12px">Prix & signaux</h3><div class="an-chart" id="bPrice"></div></div>
   <div class="card" style="padding:20px;margin-top:16px"><h3 style="margin-bottom:12px">Courbe de capital de la strategie</h3><div class="an-chart sm" id="bEquity"></div></div>`;
  let tf='1h',strat='ema';
  document.getElementById('bTf').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;tf=b.dataset.v;seg(e,b);});
  document.getElementById('bStrat').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;strat=b.dataset.v;seg(e,b);});
  document.getElementById('bRun').addEventListener('click',()=>runBT(val('bSym').toUpperCase().trim(),tf,strat));
  runBT('BTCUSDT','1h','ema');
}
function seg(e,b){[...e.currentTarget.children].forEach(x=>x.classList.remove('active'));b.classList.add('active');}

async function runBT(sym,tf,strat){
  document.getElementById('bRun').textContent='Chargement...';
  let raw;try{raw=await API.klines(sym,tf,500);}catch(e){toast('Erreur','Paire introuvable : '+sym,'err');document.getElementById('bRun').textContent='⏪ Lancer le backtest';return;}
  document.getElementById('bRun').textContent='⏪ Lancer le backtest';
  const candles=raw.map(k=>({time:k[0]/1000,open:+k[1],high:+k[2],low:+k[3],close:+k[4]}));
  const close=candles.map(c=>c.close);
  const sig=signals(strat,close);        // +1 long / -1 flat par index
  const cap0=+val('bCap');const FEE=0.001;
  let cash=cap0,pos=0,entry=0;const equity=[],markers=[];
  for(let i=0;i<candles.length;i++){
    const px=close[i];
    if(sig[i]===1&&pos===0){pos=cash*(1-FEE)/px;entry=px;cash=0;markers.push({time:candles[i].time,position:'belowBar',color:'#0ECB81',shape:'arrowUp',text:'BUY'});}
    else if(sig[i]===-1&&pos>0){cash=pos*px*(1-FEE);pos=0;markers.push({time:candles[i].time,position:'aboveBar',color:'#F6465D',shape:'arrowDown',text:'SELL'});}
    equity.push({time:candles[i].time,value:+(pos>0?pos*px:cash).toFixed(2)});
  }
  const finalEq=pos>0?pos*close[close.length-1]:cash;
  // recompute trades pnl proprement
  const tr=[];let c2=cap0,p2=0,e2=0;
  for(let i=0;i<candles.length;i++){const px=close[i];
    if(sig[i]===1&&p2===0){p2=c2*(1-FEE)/px;e2=px;c2=0;}
    else if(sig[i]===-1&&p2>0){const v=p2*px*(1-FEE);tr.push(v-(e2*p2));c2=v;p2=0;}}
  const wins=tr.filter(x=>x>0),losses=tr.filter(x=>x<=0);
  const gw=wins.reduce((a,b)=>a+b,0),gl=Math.abs(losses.reduce((a,b)=>a+b,0));
  let peak=-Infinity,mdd=0;equity.forEach(p=>{peak=Math.max(peak,p.value);mdd=Math.max(mdd,(peak-p.value)/peak*100);});
  const bh=(close[close.length-1]/close[0]-1)*100;
  const roi=(finalEq/cap0-1)*100;
  const met=[
    ['Rendement strategie',fmt.pct(roi),fmt.cls(roi)],
    ['Buy & Hold',fmt.pct(bh),fmt.cls(bh)],
    ['Surperformance',fmt.pct(roi-bh),fmt.cls(roi-bh)],
    ['Trades',tr.length+'',''],
    ['Win rate',tr.length?(wins.length/tr.length*100).toFixed(1)+'%':'--',wins.length>=losses.length?'up':'down'],
    ['Profit factor',gl?(gw/gl).toFixed(2):'∞',gw>=gl?'up':'down'],
    ['Drawdown max',mdd.toFixed(1)+'%','down'],
    ['Capital final',fmt.num(finalEq,0),fmt.cls(roi)],
    ['Meilleur trade',tr.length?'+'+fmt.num(Math.max(...tr),0):'--','up']
  ];
  document.getElementById('bMetrics').innerHTML=met.map(m=>`<div class="metric"><div class="l">${m[0]}</div><div class="v ${m[2]}">${m[1]}</div></div>`).join('');
  // chart prix + markers
  const pe=document.getElementById('bPrice');pe.innerHTML='';
  const pc=LWC.createChart(pe,{...baseChartOpts(),timeScale:{borderColor:'#2B3139',timeVisible:true}});_charts.push(pc);
  const cs=pc.addCandlestickSeries({upColor:'#0ECB81',downColor:'#F6465D',borderVisible:false,wickUpColor:'#0ECB81',wickDownColor:'#F6465D'});
  cs.setData(candles);cs.setMarkers(markers);pc.timeScale().fitContent();
  new ResizeObserver(()=>pc.applyOptions({width:pe.clientWidth,height:300})).observe(pe);
  // equity chart
  const ee=document.getElementById('bEquity');ee.innerHTML='';
  const ec=LWC.createChart(ee,{...baseChartOpts(),height:220});_charts.push(ec);
  const ea=ec.addAreaSeries({lineColor:'#FCD535',topColor:'rgba(252,213,53,.22)',bottomColor:'rgba(252,213,53,0)',lineWidth:2});
  ea.setData(equity);ec.timeScale().fitContent();new ResizeObserver(()=>ec.applyOptions({width:ee.clientWidth,height:220})).observe(ee);
}
function signals(strat,close){
  const n=close.length;const sig=Array(n).fill(0);
  if(strat==='ema'){const e9=TA.ema(close,9),e21=TA.ema(close,21);for(let i=1;i<n;i++){if(e9[i]>e21[i]&&e9[i-1]<=e21[i-1])sig[i]=1;else if(e9[i]<e21[i]&&e9[i-1]>=e21[i-1])sig[i]=-1;}}
  else if(strat==='rsi'){const r=TA.rsi(close,14);for(let i=1;i<n;i++){if(r[i]!=null){if(r[i-1]<30&&r[i]>=30)sig[i]=1;else if(r[i-1]>70&&r[i]<=70)sig[i]=-1;}}}
  else{const m=TA.macd(close);for(let i=1;i<n;i++){if(m.hist[i]>0&&m.hist[i-1]<=0)sig[i]=1;else if(m.hist[i]<0&&m.hist[i-1]>=0)sig[i]=-1;}}
  return sig;
}

/* ================= 5. PREDICTEUR IA ================= */
let _lastPred=null;
function viewAI(){
  clearCharts();
  V.innerHTML=`<div class="card" style="padding:22px;margin-bottom:16px;display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap">
     <div class="field"><label>Paire</label><div class="input" style="width:160px"><input id="aiSym" value="BTCUSDT"></div></div>
     <div class="field"><label>Periode</label><div class="seg" id="aiTf">${['1h','4h','1d'].map((t,i)=>`<button class="${i===1?'active':''}" data-v="${t}">${t}</button>`).join('')}</div></div>
     <button class="btn btn-primary" id="aiRun">🔮 Generer la prediction</button>
   </div>
   <div id="aiOut"><div class="muted" style="padding:20px">Choisis une paire et genere une prediction probabiliste.</div></div>`;
  let tf='4h';
  document.getElementById('aiTf').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;tf=b.dataset.v;seg(e,b);});
  document.getElementById('aiRun').addEventListener('click',()=>runAIpred(val('aiSym').toUpperCase().trim(),tf));
  runAIpred('BTCUSDT','4h');
}
async function runAIpred(sym,tf){
  let raw;try{raw=await API.klines(sym,tf,300);}catch(e){toast('Erreur','Paire introuvable','err');return;}
  const candles=raw.map(k=>({time:k[0]/1000,open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5]}));
  const r=TA.autoSignal(candles);const px=candles[candles.length-1].close;
  // probabilites derivees du score (-6..+6) via logistique
  const p=1/(1+Math.exp(-r.score*0.45));
  let bull=Math.round(p*100),bear=Math.round((1-p)*100);
  const neu=Math.round(Math.max(8,30-Math.abs(r.score)*4));
  const tot=bull+bear+neu;bull=Math.round(bull/tot*100);bear=Math.round(bear/tot*100);const neutral=100-bull-bear;
  _lastPred={sym,tf,px,r,bull,bear,neutral};
  const sc=(cls,title,emo,prob,desc)=>`<div class="scenario ${cls}"><h4>${emo} ${title}</h4><div class="prob">${prob}%</div><div class="bar-track"><div style="width:${prob}%;background:${cls==='bull'?'#0ECB81':cls==='bear'?'#F6465D':'#FCD535'}"></div></div><div class="muted" style="font-size:12.5px">${desc}</div></div>`;
  const inds=r.signals.map(s=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><span>${s[0]}</span><span class="${s[2]==='buy'?'up':s[2]==='sell'?'down':'muted'}" style="font-weight:600">${s[1]}</span></div>`).join('');
  document.getElementById('aiOut').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div><b style="font-size:17px">${sym.replace('USDT','/USDT')}</b> <span class="muted">${tf} • prix ${fmt.price(px)}</span></div>
      <div class="ta-badge ${r.verdict==='Haussier'?'buy':r.verdict==='Baissier'?'sell':'neutral'}" style="padding:6px 16px">${r.verdict} • confiance ${r.confidence}%</div>
    </div>
    <div class="an-grid3" style="margin-bottom:16px">
      ${sc('bull','Haussier','📈',bull,'Cassure de la resistance '+fmt.price(r.resistance)+' comme objectif.')}
      ${sc('bear','Baissier','📉',bear,'Perte du support '+fmt.price(r.support)+' comme risque.')}
      ${sc('neu','Neutre','↔️',neutral,'Consolidation entre support et resistance.')}
    </div>
    <div class="an-grid2">
      <div class="card" style="padding:18px"><h4 style="margin-bottom:10px">📍 Niveaux cles</h4>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><span class="muted">Resistance</span><b class="num down">${fmt.price(r.resistance)}</b></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><span class="muted">Prix actuel</span><b class="num">${fmt.price(px)}</b></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0"><span class="muted">Support</span><b class="num up">${fmt.price(r.support)}</b></div>
      </div>
      <div class="card" style="padding:18px"><h4 style="margin-bottom:10px">🧩 Explication des indicateurs</h4>${inds}</div>
    </div>
    <button class="btn btn-primary" style="margin-top:16px" onclick="askAgnesPred()">🤖 Demander a Agnes d'expliquer cette prediction</button>
    <div class="warn-box" style="margin-top:14px">⚠ Les predictions sont probabilistes et educatives. Elles ne garantissent aucun resultat. Le trading comporte des risques.</div>`;
}
function askAgnesPred(){
  if(!_lastPred)return;const p=_lastPred;
  switchTab('agnes');
  setTimeout(()=>agnesSend(`Explique cette prediction pour ${p.sym} en ${p.tf} : verdict ${p.r.verdict}, probabilites haussier ${p.bull}% / baissier ${p.bear}% / neutre ${p.neutral}%, support ${fmt.price(p.r.support)}, resistance ${fmt.price(p.r.resistance)}, RSI ${p.r.rsi?.toFixed(1)}. Que dois-je surveiller ?`),200);
}

/* ================= 6. ASSISTANT AGNES ================= */
let _agnesHist=[];
function viewAgnes(){
  clearCharts();
  const on=API.hasAI();
  V.innerHTML=`<div class="card agnes" style="padding:22px">
     <div class="agnes-head">
       <div class="agnes-badge">🤖</div>
       <div><div style="font-weight:700;font-size:17px">Agnes <span class="api-status ${on?'on':'off'}" style="margin-left:6px"><span class="dot"></span>${on?'IA connectee':'Mode local'}</span></div>
         <div class="muted" style="font-size:12.5px">Assistante d'analyse : explique tes resultats, analyse tes erreurs, propose des ameliorations.</div></div>
       ${on?'':'<button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="openSettings()">⚙ Connecter ma cle</button>'}
     </div>
     <div class="agnes-chat" id="agChat"></div>
     <div class="quick-q">
       <button onclick="agnesSend('Analyse mes performances et mes erreurs recentes')">Analyser mes erreurs</button>
       <button onclick="agnesSend('Comment ameliorer mon win rate et mon profit factor ?')">Ameliorer ma strategie</button>
       <button onclick="agnesSend('Explique-moi mon drawdown maximal et comment le reduire')">Expliquer mon drawdown</button>
       <button onclick="agnesSend('Ma gestion du risque est-elle correcte ?')">Gestion du risque</button>
     </div>
     <div class="agnes-in"><input id="agIn" placeholder="Pose ta question a Agnes..." onkeydown="if(event.key==='Enter')agnesSend(this.value)"><button class="btn btn-primary" onclick="agnesSend(document.getElementById('agIn').value)">Envoyer</button></div>
     <div class="warn-box" style="margin-top:12px">⚠ Agnes fournit des explications educatives et probabilistes. Elles ne garantissent aucun resultat et ne constituent pas un conseil financier.</div>
   </div>`;
  renderAgnes();
  if(!_agnesHist.length){pushAgnes('ai','Bonjour 👋 Je suis Agnes, ton assistante d\'analyse. Je peux expliquer tes metriques, reperer tes erreurs et proposer des pistes d\'amelioration. '+(on?'':'(Astuce : connecte ta cle API dans les Reglages pour des reponses detaillees par IA.) ')+'Que veux-tu analyser ?');}
}
function pushAgnes(role,text){_agnesHist.push({role,text});renderAgnes();}
function renderAgnes(){const el=document.getElementById('agChat');if(!el)return;el.innerHTML=_agnesHist.map(m=>`<div class="msg ${m.role==='ai'?'ai':'me'}">${m.text.replace(/</g,'&lt;')}</div>`).join('');el.scrollTop=el.scrollHeight;}

async function agnesSend(q){
  q=(q||'').trim();if(!q)return;
  const inp=document.getElementById('agIn');if(inp)inp.value='';
  pushAgnes('me',q);
  const s=computeStats();
  if(API.hasAI()){
    pushAgnes('ai','...');
    const ctx=`Contexte du compte demo du trader : ${s.nTrades} trades, win rate ${s.winRate.toFixed(1)}%, profit factor ${s.profitFactor===Infinity?'inf':s.profitFactor.toFixed(2)}, expectancy ${s.expectancy.toFixed(2)} USDT (${s.expectancyR.toFixed(2)}R), PnL realise ${s.realized.toFixed(2)}, ROI ${s.roi.toFixed(1)}%, drawdown max ${s.maxDD.toFixed(1)}%, gain moyen ${s.avgWin.toFixed(2)}, perte moyenne ${s.avgLoss.toFixed(2)}.`;
    try{const txt=await API.aiAnalyze(ctx+'\n\nQuestion: '+q);_agnesHist.pop();pushAgnes('ai',txt);}
    catch(e){_agnesHist.pop();pushAgnes('ai',localAgnes(q,s)+'\n\n(IA indisponible : '+(e.message==='NO_KEY'?'cle manquante':e.message)+' — reponse locale.)');}
  }else{
    pushAgnes('ai',localAgnes(q,s));
  }
}
/* reponse heuristique locale (sans cle) */
function localAgnes(q,s){
  if(s.nTrades<1)return 'Tu n\'as pas encore de trades fermes. Va sur la page Trading, passe quelques ordres et ferme-les : je pourrai alors analyser ton win rate, ton profit factor et ton drawdown.';
  const parts=[];
  parts.push(`📊 Sur ${s.nTrades} trades fermes : win rate ${s.winRate.toFixed(1)}%, profit factor ${s.profitFactor===Infinity?'∞':s.profitFactor.toFixed(2)}, expectancy ${s.expectancy.toFixed(2)} USDT (${s.expectancyR.toFixed(2)}R).`);
  if(s.winRate<40)parts.push('• Ton win rate est bas : privilegie des setups de meilleure qualite et attends la confirmation de tendance.');
  if(s.profitFactor<1)parts.push('• Profit factor < 1 : tes pertes depassent tes gains. Reduis la perte moyenne (stop plus serre) ou laisse courir les gains.');
  if(Math.abs(s.avgLoss)>s.avgWin&&s.avgWin>0)parts.push('• Ta perte moyenne depasse ton gain moyen : vise un ratio risque/rendement d\'au moins 1:2.');
  if(s.maxDD>25)parts.push(`• Drawdown max eleve (${s.maxDD.toFixed(1)}%) : baisse ta taille de position et/ou ton levier pour lisser la courbe.`);
  if(s.expectancyR>0.2)parts.push('• Ton expectancy est positive : ton edge est bon, concentre-toi sur la constance et la discipline.');
  if(parts.length===1)parts.push('• Tes stats sont equilibrees. Continue a journaliser tes trades et surveille ton drawdown.');
  parts.push('⚠ Analyse educative, pas un conseil financier.');
  return parts.join('\n');
}

/* ================= ROUTER ================= */
const VIEWS={calc:viewCalc,perf:viewPerf,mc:viewMC,bt:viewBT,ai:viewAI,agnes:viewAgnes};
function switchTab(t){const tabs=document.getElementById('anTabs');[...tabs.children].forEach(x=>x.classList.toggle('active',x.dataset.t===t));(VIEWS[t]||viewCalc)();}
document.getElementById('anTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;switchTab(b.dataset.t);});
viewCalc();
