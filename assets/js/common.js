/* ===== NovaTrade - UI commune, formatage, auth demo, reglages ===== */
const BRAND='NovaTrade';

const DemoProfile=(()=>{
  const KEY='nt_demo_profile',DEFAULT={name:'Trader Demo',startingBalance:10000};
  function get(){
    try{
      const saved=JSON.parse(localStorage.getItem(KEY)||'{}');
      return{
        name:typeof saved.name==='string'&&saved.name.trim()?saved.name.trim().slice(0,32):DEFAULT.name,
        startingBalance:Number.isFinite(+saved.startingBalance)&&+saved.startingBalance>=1000&&+saved.startingBalance<=1000000?+saved.startingBalance:DEFAULT.startingBalance
      };
    }catch(_){return {...DEFAULT};}
  }
  function save({name,startingBalance}){
    const current=get(),nextName=String(name??current.name).trim().slice(0,32),capital=Number(startingBalance??current.startingBalance);
    if(!nextName)throw new Error('Saisis un nom pour le compte.');
    if(!Number.isFinite(capital)||capital<1000||capital>1000000)throw new Error('Le capital doit etre compris entre 1 000 et 1 000 000 USDT.');
    const profile={name:nextName,startingBalance:capital};
    localStorage.setItem(KEY,JSON.stringify(profile));
    return profile;
  }
  return {get,save};
})();

/* --- formatage chiffres --- */
const fmt={
  price(n){n=+n;if(!isFinite(n))return '--';
    if(n>=1000)return n.toLocaleString('en-US',{maximumFractionDigits:2});
    if(n>=1)return n.toFixed(2);
    if(n>=0.01)return n.toFixed(4);
    return n.toPrecision(4);},
  usd(n){return '$'+fmt.price(n);},
  num(n,d=2){n=+n;return isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'--';},
  pct(n){n=+n;const s=n>=0?'+':'';return s+n.toFixed(2)+'%';},
  compact(n){n=+n;if(n>=1e9)return (n/1e9).toFixed(2)+'B';if(n>=1e6)return (n/1e6).toFixed(2)+'M';if(n>=1e3)return (n/1e3).toFixed(2)+'K';return n.toFixed(0);},
  cls(n){return +n>=0?'up':'down';}
};

/* --- toasts --- */
function toast(title,msg,type=''){
  let box=document.getElementById('toasts');
  if(!box){box=document.createElement('div');box.id='toasts';document.body.appendChild(box);}
  const t=document.createElement('div');
  t.className='toast '+type;
  t.innerHTML=`<b>${title}</b><span class="muted">${msg||''}</span>`;
  box.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(40px)';setTimeout(()=>t.remove(),300);},4000);
}

/* --- fond anime : reseau de noeuds --- */
function initBg(){
  const c=document.getElementById('bg-canvas');if(!c)return;
  const ctx=c.getContext('2d');let w,h,pts=[];
  function resize(){w=c.width=innerWidth;h=c.height=innerHeight;
    const n=Math.min(70,Math.floor(w*h/22000));pts=[];
    for(let i=0;i<n;i++)pts.push({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25});}
  resize();addEventListener('resize',resize);
  function loop(){ctx.clearRect(0,0,w,h);
    for(const p of pts){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;}
    for(let i=0;i<pts.length;i++){
      for(let j=i+1;j<pts.length;j++){
        const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.hypot(dx,dy);
        if(d<120){ctx.strokeStyle='rgba(252,213,53,'+(0.08*(1-d/120))+')';ctx.lineWidth=1;
          ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.stroke();}
      }
      ctx.fillStyle='rgba(132,142,156,.5)';ctx.beginPath();ctx.arc(pts[i].x,pts[i].y,1.4,0,7);ctx.fill();
    }
    requestAnimationFrame(loop);}
  loop();
}

/* --- navigation --- */
function renderShell(active){
  const links=[['index.html','Accueil'],['markets.html','Marches'],['trading.html','Trading'],
    ['portfolio.html','Portefeuille'],['analytics.html','Analyse'],['academy.html','Academie'],['profile.html','Profil']];
  const nav=`
  <div class="sim-banner">⚠ Plateforme de SIMULATION — fonds 100% virtuels. Aucun depot, retrait ou ordre reel. Prix reels du marche.</div>
  <nav class="nav">
    <a href="index.html" class="brand"><span class="logo">N</span>Nova<b>Trade</b></a>
    <div class="nav-links" id="navlinks">${links.map(l=>`<a href="${l[0]}" class="${l[0]===active?'active':''}">${l[1]}</a>`).join('')}</div>
    <div class="nav-right">
      <button class="icon-btn" onclick="openSettings()" title="Reglages / Cle API">⚙</button>
      <span class="pill num" id="nav-balance">10 000 USDT</span>
      <button class="btn btn-ghost btn-sm" onclick="openSettings()">${DemoProfile.get().name}</button>
      <button class="menu-toggle icon-btn" onclick="document.getElementById('navlinks').classList.toggle('open')">☰</button>
    </div>
  </nav>`;
  const mount=document.getElementById('shell');
  if(mount) mount.innerHTML=nav; 
  updateNavBalance();
}
function updateNavBalance(){
  const el=document.getElementById('nav-balance');
  if(el){const w=Wallet.get();el.textContent=fmt.num(w.equity,2)+' USDT';}
}
function renderFooter(){
  const f=document.getElementById('footer');if(!f)return;
  f.innerHTML=`<footer><div class="foot-grid">
    <div><div class="brand" style="margin-bottom:12px"><span class="logo">N</span>Nova<b>Trade</b></div>
      <p class="muted" style="font-size:13px;max-width:300px">Simulateur de trading crypto avec donnees de marche reelles. Apprends sans risquer ton capital.</p></div>
    <div><h4>Produit</h4><a href="markets.html">Marches</a><a href="trading.html">Trading</a><a href="portfolio.html">Portefeuille</a></div>
    <div><h4>Apprendre</h4><a href="academy.html">Academie</a><a href="academy.html">Glossaire</a><a href="academy.html">Quiz</a></div>
    <div><h4>Donnees</h4><a href="#">Binance API</a><a href="#">CoinGecko</a><a href="#" onclick="openSettings();return false">Cle API / IA</a></div>
  </div>
  <div class="foot-warn"><b>⚠ Avertissement de risque :</b> NovaTrade est une plateforme de simulation a but educatif. Les fonds sont virtuels. Aucune transaction reelle n'est executee. Le trading comporte des risques eleves — les performances passees ne garantissent pas les resultats futurs. Les analyses techniques fournies ne constituent pas un conseil financier.<br>© 2026 NovaTrade Sim. Donnees de marche : Binance & CoinGecko.</div></footer>`;
}

/* --- animations au scroll --- */
function initScrollAnim(){
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.12});
  document.querySelectorAll('.fade-up').forEach(e=>io.observe(e));
}

/* --- compteurs animes --- */
function animateCount(el,to,dur=1400,suffix=''){
  const start=performance.now();
  function step(t){const p=Math.min(1,(t-start)/dur);const e=1-Math.pow(1-p,3);
    el.textContent=fmt.compact(Math.floor(to*e))+suffix;if(p<1)requestAnimationFrame(step);}
  requestAnimationFrame(step);
}

/* ===== Portefeuille demo (localStorage) ===== */
const Wallet=(()=>{
  const KEY='nt_wallet';
  const INIT={used:0,realized:0,positions:[],orders:[],history:[],equityCurve:[]};
  function get(){try{const w=JSON.parse(localStorage.getItem(KEY));return w&&w.balance!=null?w:seed();}catch(_){return seed();}}
  function save(w){localStorage.setItem(KEY,JSON.stringify(w));updateNavBalance&&updateNavBalance();}
  function seed(initialBalance=DemoProfile.get().startingBalance){
    const balance=Number(initialBalance),created=Date.now();
    const w={...INIT,balance,equity:balance,created,equityCurve:[{t:created,v:balance}]};
    save(w);return w;
  }
  function reset(initialBalance=DemoProfile.get().startingBalance){localStorage.removeItem(KEY);return seed(initialBalance);}
  return {get,save,reset};
})();

/* ===== Modale reglages : CLE API + IA + reinit ===== */
function ensureModalHost(){
  if(document.getElementById('nt-modal'))return;
  const d=document.createElement('div');
  d.id='nt-modal';d.className='modal-bg';
  d.addEventListener('click',e=>{if(e.target===d)closeModal();});
  document.body.appendChild(d);
}
function closeModal(){const m=document.getElementById('nt-modal');if(m)m.classList.remove('open');}
function openModal(html){ensureModalHost();const m=document.getElementById('nt-modal');m.innerHTML=`<div class="modal">${html}</div>`;m.classList.add('open');}

function openSettings(){
  const k=API.getKeys();const w=Wallet.get();
  const on=!!k.ai_key;
  openModal(`
   <div class="modal-h"><h3>⚙ Reglages du compte</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
   <div class="modal-b">
     <div style="margin-bottom:22px">
       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
         <b style="font-size:15px">🤖 Cle API — Assistant IA d'analyse</b>
         <span class="api-status ${on?'on':'off'}"><span class="dot"></span>${on?'Connectee':'Non configuree'}</span>
       </div>
       <div class="form-field"><label>Cle API (OpenAI compatible)</label>
         <input id="ai_key" type="password" placeholder="sk-..." value="${k.ai_key||''}"></div>
       <div class="form-field"><label>URL de base (optionnel)</label>
         <input id="ai_base" placeholder="https://api.openai.com/v1" value="${k.ai_base||''}"></div>
       <div class="form-field"><label>Modele (optionnel)</label>
         <input id="ai_model" placeholder="gpt-4o-mini" value="${k.ai_model||''}"></div>
       <p class="hint">🔒 Ta cle est stockee uniquement dans ton navigateur (localStorage) et n'est jamais envoyee a NovaTrade. Elle active l'analyse technique automatique par IA sur la page Trading. Compatible OpenAI, OpenRouter, Groq, etc.</p>
     </div>
     <div style="display:flex;gap:10px;margin-bottom:22px">
       <button class="btn btn-primary" style="flex:1" onclick="saveKeys()">Enregistrer la cle</button>
       <button class="btn btn-ghost" onclick="clearKeys()">Effacer</button>
     </div>
     <div style="border-top:1px solid var(--border);padding-top:18px">
      <b style="font-size:15px;display:block;margin-bottom:4px">💼 ${DemoProfile.get().name}</b>
      <div class="muted" style="font-size:13px;margin-bottom:12px">Solde: ${fmt.num(w.equity,2)} USDT • PnL realise: ${fmt.num(w.realized,2)} USDT</div>
      <button class="btn btn-ghost" onclick="resetDemo()">↺ Reinitialiser le compte demo (${fmt.num(DemoProfile.get().startingBalance,0)} USDT)</button>
     </div>
   </div>`);
}
function saveKeys(){
  const k=API.getKeys();
  k.ai_key=document.getElementById('ai_key').value.trim();
  k.ai_base=document.getElementById('ai_base').value.trim();
  k.ai_model=document.getElementById('ai_model').value.trim();
  API.setKeys(k);toast('Cle enregistree','L\'assistant IA est '+(k.ai_key?'actif':'desactive'),'ok');closeModal();
}
function clearKeys(){API.setKeys({});toast('Cle effacee','','');closeModal();}
function resetDemo(){
  const profile=DemoProfile.get();
  if(!confirm(`Reinitialiser le compte demo de ${profile.name} a ${fmt.num(profile.startingBalance,0)} USDT ? Les positions, ordres et historiques seront effaces.`))return;
  Wallet.reset(profile.startingBalance);toast('Compte reinitialise',`Solde: ${fmt.num(profile.startingBalance,0)} USDT`,'ok');closeModal();setTimeout(()=>location.reload(),400);
}

/* ===== boot commun a toutes les pages ===== */
function bootShell(active){renderShell(active);renderFooter();initBg();ensureModalHost();}
