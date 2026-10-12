/* ===== NovaTrade - indicateurs techniques ===== */
const TA=(()=>{
  function sma(src,p){const o=[];for(let i=0;i<src.length;i++){if(i<p-1){o.push(null);continue;}let s=0;for(let j=0;j<p;j++)s+=src[i-j];o.push(s/p);}return o;}
  function ema(src,p){const o=[];const k=2/(p+1);let prev;for(let i=0;i<src.length;i++){if(i===0){prev=src[0];o.push(prev);continue;}prev=src[i]*k+prev*(1-k);o.push(prev);}return o;}
  function rsi(src,p=14){const o=[];let g=0,l=0;for(let i=1;i<=p;i++){const d=src[i]-src[i-1];if(d>=0)g+=d;else l-=d;}g/=p;l/=p;o[p]=100-100/(1+g/(l||1e-9));for(let i=0;i<p;i++)o[i]=null;for(let i=p+1;i<src.length;i++){const d=src[i]-src[i-1];g=(g*(p-1)+(d>0?d:0))/p;l=(l*(p-1)+(d<0?-d:0))/p;o[i]=100-100/(1+g/(l||1e-9));}return o;}
  function macd(src,f=12,s=26,sig=9){const ef=ema(src,f),es=ema(src,s);const line=src.map((_,i)=>ef[i]-es[i]);const sl=ema(line,sig);const hist=line.map((v,i)=>v-sl[i]);return {line,signal:sl,hist};}
  function bollinger(src,p=20,m=2){const mid=sma(src,p);const up=[],lo=[];for(let i=0;i<src.length;i++){if(i<p-1){up.push(null);lo.push(null);continue;}let s=0;for(let j=0;j<p;j++)s+=Math.pow(src[i-j]-mid[i],2);const sd=Math.sqrt(s/p);up.push(mid[i]+m*sd);lo.push(mid[i]-m*sd);}return {mid,up,lo};}
  function atr(h,l,c,p=14){const tr=[];for(let i=0;i<c.length;i++){if(i===0){tr.push(h[0]-l[0]);continue;}tr.push(Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])));}return ema(tr,p);}
  function stochRsi(src,p=14){const r=rsi(src,p);const o=[];for(let i=0;i<r.length;i++){if(i<p*2||r[i]==null){o.push(null);continue;}let mn=Infinity,mx=-Infinity;for(let j=0;j<p;j++){const v=r[i-j];if(v==null)continue;mn=Math.min(mn,v);mx=Math.max(mx,v);}o.push((r[i]-mn)/((mx-mn)||1e-9)*100);}return o;}

  /* Analyse automatique : score multi-indicateurs -> Haussier/Baissier/Neutre */
  function autoSignal(candles){
    const c=candles.map(x=>x.close),h=candles.map(x=>x.high),l=candles.map(x=>x.low);
    const n=c.length;if(n<60)return {verdict:'Neutre',score:0,signals:[]};
    const last=c[n-1];
    const e20=ema(c,20),e50=ema(c,50);const r=rsi(c,14);const m=macd(c);const bb=bollinger(c);
    const sig=[];let sc=0;
    // EMA cross
    if(e20[n-1]>e50[n-1]){sig.push(['EMA 20/50','Haussier','buy']);sc++;}else{sig.push(['EMA 20/50','Baissier','sell']);sc--;}
    // RSI
    const rv=r[n-1];
    if(rv>70)sig.push(['RSI '+rv.toFixed(0),'Surachat','sell']),sc--;
    else if(rv<30)sig.push(['RSI '+rv.toFixed(0),'Survente','buy']),sc++;
    else sig.push(['RSI '+rv.toFixed(0),'Neutre','neutral']);
    // MACD
    if(m.hist[n-1]>0&&m.hist[n-2]<=0){sig.push(['MACD','Croisement haussier','buy']);sc++;}
    else if(m.hist[n-1]<0&&m.hist[n-2]>=0){sig.push(['MACD','Croisement baissier','sell']);sc--;}
    else sig.push(['MACD',m.hist[n-1]>0?'Positif':'Negatif',m.hist[n-1]>0?'buy':'sell']),sc+=m.hist[n-1]>0?1:-1;
    // Bollinger
    if(last>bb.up[n-1])sig.push(['Bollinger','Au-dessus bande sup','sell']),sc--;
    else if(last<bb.lo[n-1])sig.push(['Bollinger','Sous bande inf','buy']),sc++;
    else sig.push(['Bollinger','Dans les bandes','neutral']);
    // Prix vs EMA50
    if(last>e50[n-1]){sig.push(['Prix vs EMA50','Au-dessus','buy']);sc++;}else{sig.push(['Prix vs EMA50','En-dessous','sell']);sc--;}
    const verdict=sc>=2?'Haussier':sc<=-2?'Baissier':'Neutre';
    const conf=Math.min(100,Math.round(Math.abs(sc)/6*100));
    // support / resistance simples
    const win=c.slice(-60);
    const sup=Math.min(...l.slice(-60)),res=Math.max(...h.slice(-60));
    return {verdict,score:sc,confidence:conf,signals:sig,support:sup,resistance:res,rsi:rv};
  }
  return {sma,ema,rsi,macd,bollinger,atr,stochRsi,autoSignal};
})();
