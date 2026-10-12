/* ===== Page Marches ===== */
bootShell('markets.html');
let COINS=[],TAB='all',SORT={k:'cap',dir:1},Q='';
const favs=()=>{try{return JSON.parse(localStorage.getItem('nt_favs')||'[]')}catch(_){return[]}};
const toggleFav=s=>{let f=favs();f=f.includes(s)?f.filter(x=>x!==s):[...f,s];localStorage.setItem('nt_favs',JSON.stringify(f));render();};

function skeleton(){document.getElementById('rows').innerHTML=Array.from({length:12}).map(()=>`<tr><td colspan="10" style="padding:14px"><div class="skel" style="height:26px"></div></td></tr>`).join('');}

async function load(){
  skeleton();
  try{
    // CoinGecko : cap, logos, variations multi-periodes, puis mapping vers paires USDT Binance
    const cg=await API.cgMarkets(120);
    COINS=cg.filter(c=>c.symbol).map(c=>({
      id:c.id,sym:c.symbol.toUpperCase(),name:c.name,img:c.image,
      pair:c.symbol.toUpperCase()+'/USDT',bsym:c.symbol.toUpperCase()+'USDT',
      price:c.current_price,ch1:c.price_change_percentage_1h_in_currency,
      ch24:c.price_change_percentage_24h_in_currency,ch7:c.price_change_percentage_7d_in_currency,
      vol:c.total_volume,cap:c.market_cap
    }));
    render();
  }catch(e){
    // fallback Binance seul
    try{
      const all=await API.ticker24h();
      COINS=all.filter(t=>t.symbol.endsWith('USDT')&&+t.quoteVolume>5e6).map(t=>({
        sym:t.symbol.replace('USDT',''),name:t.symbol.replace('USDT',''),img:null,
        pair:t.symbol.replace('USDT','/USDT'),bsym:t.symbol,
        price:+t.lastPrice,ch1:null,ch24:+t.priceChangePercent,ch7:null,
        vol:+t.quoteVolume,cap:null}));
      render();
    }catch(e2){document.getElementById('rows').innerHTML='<tr><td colspan=10 class="empty">Donnees indisponibles. Verifie ta connexion internet.</td></tr>';}
  }
}

function filtered(){
  let r=[...COINS];
  if(TAB==='fav'){const f=favs();r=r.filter(c=>f.includes(c.bsym));}
  else if(TAB==='gainers')r=r.filter(c=>c.ch24>0).sort((a,b)=>b.ch24-a.ch24).slice(0,40);
  else if(TAB==='losers')r=r.filter(c=>c.ch24<0).sort((a,b)=>a.ch24-b.ch24).slice(0,40);
  else if(TAB==='vol')r=r.sort((a,b)=>b.vol-a.vol);
  if(Q){const q=Q.toLowerCase();r=r.filter(c=>c.sym.toLowerCase().includes(q)||c.name.toLowerCase().includes(q));}
  if(['all','fav'].includes(TAB)){const k={price:'price',ch1:'ch1',ch24:'ch24',ch7:'ch7',vol:'vol',cap:'cap'}[SORT.k]||'cap';
    r.sort((a,b)=>((b[k]||-1e18)-(a[k]||-1e18))*SORT.dir);}
  return r;
}

function render(){
  const f=favs();const rows=filtered();
  if(!rows.length){document.getElementById('rows').innerHTML='<tr><td colspan=10 class="empty">Aucun resultat.</td></tr>';return;}
  document.getElementById('rows').innerHTML=rows.map(c=>{
    const ic=c.img?`<img src="${c.img}">`:c.sym.slice(0,2);
    const cc=(v)=>v==null?'<span class="muted">--</span>':`<span class="num ${fmt.cls(v)}">${fmt.pct(v)}</span>`;
    return `<tr>
     <td><span class="star ${f.includes(c.bsym)?'on':''}" onclick="toggleFav('${c.bsym}')">★</span></td>
     <td><div class="coin-cell"><div class="coin-ico">${ic}</div><div><div class="nm">${c.sym}</div><div class="fn">${c.name}</div></div></div></td>
     <td class="num">$${fmt.price(c.price)}</td>
     <td>${cc(c.ch1)}</td><td>${cc(c.ch24)}</td><td>${cc(c.ch7)}</td>
     <td class="num muted">$${fmt.compact(c.vol)}</td>
     <td class="num muted">${c.cap?'$'+fmt.compact(c.cap):'--'}</td>
     <td><canvas class="spark" data-sym="${c.bsym}" data-up="${(c.ch7??c.ch24??0)>=0}"></canvas></td>
     <td><a class="btn btn-primary btn-sm" href="trading.html?symbol=${c.bsym}">Trader</a></td>
   </tr>`;}).join('');
  loadSparks();
}

async function loadSparks(){
  const cvs=[...document.querySelectorAll('.spark')].slice(0,20);
  for(const cv of cvs){
    try{const k=await API.klines(cv.dataset.sym,'1h',48);drawSpark(cv,k.map(x=>+x[4]),cv.dataset.up==='true');}catch(_){}
  }
}
function drawSpark(cv,data,up){
  const ctx=cv.getContext('2d');const W=cv.width=90,H=cv.height=34;
  if(!data.length)return;const mn=Math.min(...data),mx=Math.max(...data),r=(mx-mn)||1;
  ctx.beginPath();data.forEach((v,i)=>{const x=i/(data.length-1)*W,y=H-((v-mn)/r)*(H-4)-2;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
  ctx.strokeStyle=up?'#0ECB81':'#F6465D';ctx.lineWidth=1.4;ctx.stroke();
}

document.getElementById('q').addEventListener('input',e=>{Q=e.target.value;render();});
document.getElementById('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;TAB=b.dataset.t;[...e.currentTarget.children].forEach(x=>x.classList.remove('active'));b.classList.add('active');render();});
document.querySelectorAll('table.mk th[data-s]').forEach(th=>th.addEventListener('click',()=>{const k=th.dataset.s;if(['price','ch1','ch24','ch7','vol','cap'].includes(k)){SORT.dir=(SORT.k===k)?-SORT.dir:1;SORT.k=k;render();}}));
load();
setInterval(load,30000);
