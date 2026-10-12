/* ===== Portefeuille demo ===== */
bootShell('portfolio.html');
const LWC=window.LightweightCharts;

async function refreshPrices(){
  const w=Wallet.get();const syms=[...new Set(w.positions.map(p=>p.symbol))];
  for(const s of syms){try{const p=await API.price(s);Engine.setPrice(s,p);}catch(_){}}
}

function render(){
  const w=Wallet.get();
  let upnl=0,netUpnl=0;w.positions.forEach(p=>{const cur=Engine.getExitPrice(p.symbol,p.side)||Engine.getPrice(p.symbol)||p.entry;upnl+=Engine.uPnl(p,cur);netUpnl+=Engine.uPnlNet(p,cur);});
  const equity=w.balance+w.used+upnl;
  document.getElementById('sEquity').textContent=fmt.num(equity,2)+' USDT';
  document.getElementById('sAvail').textContent=fmt.num(w.balance,2)+' USDT';
  document.getElementById('sUsed').textContent=fmt.num(w.used,2)+' USDT';
  const totalPnl=w.realized+netUpnl;
  const pe=document.getElementById('sPnl');pe.textContent=(totalPnl>=0?'+':'')+fmt.num(totalPnl,2)+' USDT';pe.className='v num '+fmt.cls(totalPnl);

  // repartition : USDT dispo + marge par position
  const alloc=[['USDT disponible',w.balance]];
  w.positions.forEach(p=>alloc.push([p.base+' ('+p.side+' '+p.lev+'x)',p.margin]));
  const tot=alloc.reduce((a,x)=>a+x[1],0)||1;
  document.getElementById('alloc').innerHTML=alloc.map(a=>`<div class="alloc-row"><span style="min-width:140px">${a[0]}</span><div class="alloc-bar"><div style="width:${(a[1]/tot*100).toFixed(1)}%"></div></div><span class="num muted" style="min-width:90px;text-align:right">${(a[1]/tot*100).toFixed(1)}%</span></div>`).join('');

  // historique
  if(!w.history.length)document.getElementById('histWrap').innerHTML='<div class="empty">Aucune transaction pour le moment.</div>';
  else document.getElementById('histWrap').innerHTML=`<table class="pos"><thead><tr><th>Date</th><th>Paire</th><th>Type</th><th>Sens</th><th>Prix</th><th>Quantite</th><th>Frais</th><th>PnL</th></tr></thead><tbody>`+
    w.history.slice(0,80).map(h=>`<tr><td class="muted">${new Date(h.t).toLocaleString('fr-FR')}</td><td>${h.symbol.replace('USDT','/USDT')}</td><td>${h.type}</td><td><span class="tag ${h.side}">${h.side.toUpperCase()}</span></td><td>${fmt.price(h.price)}</td><td>${h.qty.toFixed(4)}</td><td class="muted">${fmt.num(h.fee,2)}</td><td class="${h.pnl!=null?fmt.cls(h.pnl):''}">${h.pnl!=null?(h.pnl>=0?'+':'')+fmt.num(h.pnl,2):'—'}</td></tr>`).join('')+'</tbody></table>';
}

/* courbe equity */
const pfEl=document.getElementById('pf-chart');
const pfChart=LWC.createChart(pfEl,{layout:{background:{color:'transparent'},textColor:'#848E9C',fontFamily:'Space Grotesk'},grid:{vertLines:{color:'rgba(43,49,57,.3)'},horzLines:{color:'rgba(43,49,57,.3)'}},rightPriceScale:{borderColor:'#2B3139'},timeScale:{borderColor:'#2B3139',timeVisible:true}});
const area=pfChart.addAreaSeries({lineColor:'#FCD535',topColor:'rgba(252,213,53,.25)',bottomColor:'rgba(252,213,53,0)',lineWidth:2});
new ResizeObserver(()=>pfChart.applyOptions({width:pfEl.clientWidth,height:300})).observe(pfEl);
function renderCurve(){
  const w=Wallet.get();let pts=(w.equityCurve||[]);
  if(pts.length<2)pts=[{t:w.created,v:10000},{t:Date.now(),v:w.equity}];
  const seen=new Set();const data=pts.map(p=>({time:Math.floor(p.t/1000),value:+p.v})).filter(d=>{if(seen.has(d.time))return false;seen.add(d.time);return true;}).sort((a,b)=>a.time-b.time);
  area.setData(data);pfChart.timeScale().fitContent();
}

(async()=>{await refreshPrices();render();renderCurve();})();
setInterval(async()=>{await refreshPrices();render();},5000);
