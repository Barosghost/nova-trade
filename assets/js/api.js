/* ===== NovaTrade - couche d'acces aux donnees reelles ===== */
const API = (()=>{
  const BINANCE='https://api.binance.com';
  const COINGECKO='https://api.coingecko.com/api/v3';

  // --- cache memoire simple pour menager les limites API ---
  const cache=new Map();
  async function cached(key,ttl,fn){
    const hit=cache.get(key);
    if(hit&&Date.now()-hit.t<ttl) return hit.v;
    const v=await fn();
    cache.set(key,{t:Date.now(),v});
    return v;
  }
  async function jget(url){
    const r=await fetch(url);
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }

  // --- Binance REST ---
  async function ticker24h(symbol){
    return cached('t24_'+(symbol||'all'),8000,()=>jget(
      BINANCE+'/api/v3/ticker/24hr'+(symbol?('?symbol='+symbol):'')));
  }
  async function klines(symbol,interval,limit=500){
    return jget(`${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  }
  async function depth(symbol,limit=20){
    return jget(`${BINANCE}/api/v3/depth?symbol=${symbol}&limit=${limit}`);
  }
  async function trades(symbol,limit=30){
    return jget(`${BINANCE}/api/v3/trades?symbol=${symbol}&limit=${limit}`);
  }
  async function exchangeInfo(){
    return cached('exinfo',600000,()=>jget(BINANCE+'/api/v3/exchangeInfo'));
  }
  async function price(symbol){
    const d=await jget(`${BINANCE}/api/v3/ticker/price?symbol=${symbol}`);
    return parseFloat(d.price);
  }

  // --- CoinGecko (metadonnees, logos, market cap) ---
  async function cgMarkets(perPage=100){
    return cached('cg_mk',60000,()=>jget(
      `${COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=false&price_change_percentage=1h,24h,7d`));
  }

  // --- WebSocket temps reel ---
  function wsKline(symbol,interval,onMsg){
    const url=`wss://data-stream.binance.vision:443/ws/${symbol.toLowerCase()}@kline_${interval}`;
    let ws,alive=true;
    function conn(){
      ws=new WebSocket(url);
      ws.onmessage=e=>{try{onMsg(JSON.parse(e.data).k)}catch(_){}}; 
      ws.onclose=()=>{if(alive)setTimeout(conn,2000)};
      ws.onerror=()=>ws.close();
    }
    conn();
    return ()=>{alive=false;ws&&ws.close()};
  }
  function wsTicker(symbol,onMsg){
    const url=`wss://data-stream.binance.vision:443/ws/${symbol.toLowerCase()}@ticker`;
    let ws,alive=true;
    function conn(){
      ws=new WebSocket(url);
      ws.onmessage=e=>{try{onMsg(JSON.parse(e.data))}catch(_){}};
      ws.onclose=()=>{if(alive)setTimeout(conn,2000)};
      ws.onerror=()=>ws.close();
    }
    conn();
    return ()=>{alive=false;ws&&ws.close()};
  }

  // ===== Emplacement cle API (IA d'analyse / fournisseur de donnees) =====
  // L'utilisateur colle sa cle dans l'interface (Reglages). Stockee localement.
  function getKeys(){
    try{return JSON.parse(localStorage.getItem('nt_apikeys')||'{}')}catch(_){return{}}
  }
  function setKeys(obj){
    localStorage.setItem('nt_apikeys',JSON.stringify(obj||{}));
  }
  function hasAI(){return !!(getKeys().ai_key);}

  // Analyse IA : utilise la cle fournie par l'utilisateur (OpenAI-compatible).
  // Si aucune cle n'est configuree -> fallback heuristique local.
  async function aiAnalyze(prompt){
    const k=getKeys();
    if(!k.ai_key) throw new Error('NO_KEY');
    const base=k.ai_base||'https://api.openai.com/v1';
    const model=k.ai_model||'gpt-4o-mini';
    const r=await fetch(base.replace(/\/$/,'')+'/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+k.ai_key},
      body:JSON.stringify({model,messages:[
        {role:'system',content:'Tu es un analyste technique crypto. Reponds en francais, concis, et termine toujours par: Ceci n est pas un conseil financier.'},
        {role:'user',content:prompt}
      ],temperature:0.5})
    });
    if(!r.ok) throw new Error('AI_HTTP_'+r.status);
    const d=await r.json();
    return d.choices?.[0]?.message?.content||'(reponse vide)';
  }

  return {ticker24h,klines,depth,trades,exchangeInfo,price,cgMarkets,
          wsKline,wsTicker,getKeys,setKeys,hasAI,aiAnalyze};
})();
