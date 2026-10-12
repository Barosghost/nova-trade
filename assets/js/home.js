/* ===== Page accueil ===== */
bootShell('index.html');

const FEATS=[
  ['📈','Graphiques pro','TradingView Lightweight Charts : bougies OHLCV, volume, crosshair, plein ecran et theme sombre.'],
  ['⚡','Donnees temps reel','Prix, carnet d\'ordres et trades diffuses en direct via WebSocket Binance.'],
  ['🧠','Analyse technique','+25 indicateurs (RSI, MACD, Bollinger, Ichimoku...) et analyse automatique haussier/baissier.'],
  ['🎯','Ordres avances','Market, Limit, Stop. Long/Short, levier jusqu\'a 50x, TP/SL et liquidation realistes.'],
  ['💼','Portefeuille demo','10 000 USDT virtuels, PnL realise/non realise, courbe de performance et historique complet.'],
  ['🤖','Assistant IA','Branche ta propre cle API pour une analyse technique commentee par IA (optionnel).']
];
const TESTI=[
  ['J\'ai enfin compris le levier et la liquidation sans cramer mon capital. Interface identique a un vrai exchange.','Lucas M.','Debutant'],
  ['Les donnees sont reelles, les bougies collent au marche. Parfait pour tester mes strategies RSI/MACD.','Amina K.','Intermediaire'],
  ['Le mode paper trading est hyper fluide. Je m\'entraine sur BTC et SOL tous les matins.','Thomas R.','Avance']
];
const FAQ=[
  ['Est-ce un vrai exchange ?','Non. NovaTrade est 100% un simulateur. Aucun depot, retrait ou ordre reel. Les fonds sont virtuels mais les prix sont ceux du marche reel.'],
  ['D\'ou viennent les prix ?','Des API publiques Binance (bougies, carnet d\'ordres, trades) et CoinGecko (capitalisation, metadonnees), en temps reel.'],
  ['Dois-je donner mes informations bancaires ?','Jamais. Aucune donnee bancaire n\'est demandee. Le compte demo est credite automatiquement de 10 000 USDT virtuels.'],
  ['Puis-je reinitialiser mon compte ?','Oui, a tout moment depuis les reglages. Ton solde revient a 10 000 USDT.'],
  ['Comment activer l\'assistant IA ?','Dans Reglages (icone engrenage), colle ta propre cle API compatible OpenAI. Elle reste dans ton navigateur.']
];

document.getElementById('feats').innerHTML=FEATS.map(f=>`<div class="feat card fade-up"><div class="ico">${f[0]}</div><h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('');
document.getElementById('testi').innerHTML=TESTI.map(t=>`<div class="testi card fade-up"><div class="q">“${t[0]}”</div><div class="who"><div class="avatar">${t[1][0]}</div><div><div style="font-weight:600">${t[1]}</div><div class="muted" style="font-size:12px">${t[2]}</div></div></div></div>`).join('');
document.getElementById('faq').innerHTML=FAQ.map(f=>`<div class="faq-item" onclick="this.classList.toggle('open')"><div class="q">${f[0]}<span class="chev">▾</span></div><div class="a">${f[1]}</div></div>`).join('');

initScrollAnim();

/* compteurs animes au scroll */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const el=e.target.querySelector('[data-count]');if(el&&!el.dataset.done){el.dataset.done=1;animateCount(el,+el.dataset.count);}io.unobserve(e.target);}}),{threshold:.4});
document.querySelectorAll('.stat').forEach(s=>io.observe(s));

/* ticker prix reel + volume stat */
const TICK=['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT','LINKUSDT','DOTUSDT'];
(async()=>{
  try{
    const all=await API.ticker24h();
    const map={};all.forEach(t=>map[t.symbol]=t);
    const rows=TICK.map(s=>map[s]).filter(Boolean);
    const html=rows.map(t=>{const ch=+t.priceChangePercent;return `<span class="tk"><span class="sym">${t.symbol.replace('USDT','/USDT')}</span><span class="num">${fmt.price(t.lastPrice)}</span><span class="num ${fmt.cls(ch)}">${fmt.pct(ch)}</span></span>`;}).join('');
    document.getElementById('ticker').innerHTML=html+html;
    const totVol=rows.reduce((a,t)=>a+ +t.quoteVolume,0);
    const vs=document.getElementById('vol-stat');vs.textContent='$'+fmt.compact(totVol);
  }catch(e){document.getElementById('ticker').innerHTML='<span class="tk muted">Donnees marche indisponibles (verifie ta connexion)</span>';}
})();
