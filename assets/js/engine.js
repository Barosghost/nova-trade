/* ===== NovaTrade - moteur de trading simule ===== */
const Engine=(()=>{
  const FEE=0.001;            // 0.1% maker/taker
  const MAINT=0.005;          // marge de maintenance 0.5%
  let lastPrices={};          // symbol -> prix courant
  let quotes={};

  function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
  function setPrice(sym,px){lastPrices[sym]=px;}
  function getPrice(sym){return lastPrices[sym];}
  function setQuote(sym,bid,ask){
    if(Number.isFinite(+bid)&&Number.isFinite(+ask)&&+bid>0&&+ask>0)quotes[sym]={bid:+bid,ask:+ask};
  }
  function getEntryPrice(sym,side){const q=quotes[sym];return q?(side==='long'?q.ask:q.bid):getPrice(sym);}
  function getExitPrice(sym,side){const q=quotes[sym];return q?(side==='long'?q.bid:q.ask):getPrice(sym);}

  function liqPrice(side,entry,lev){
    // approximation : prix ou la perte = marge initiale
    const f=(1/lev)-MAINT;
    return side==='long'? entry*(1-f) : entry*(1+f);
  }

  /* placer un ordre. type: market|limit|stop ; side: long|short */
  function placeOrder({symbol,base,type,side,price,qty,lev=1,tp=null,sl=null}){
    const w=Wallet.get();
    const mkt=getPrice(symbol);
    if(!mkt)throw new Error('Prix indisponible');
    if(!['market','limit','stop'].includes(type))throw new Error('Type d’ordre invalide');
    if(!['long','short'].includes(side))throw new Error('Sens d’ordre invalide');
    if(!Number.isFinite(+qty)||+qty<=0)throw new Error('Quantite invalide');
    if(!Number.isFinite(+lev)||+lev<=0)throw new Error('Levier invalide');
    const execPx=type==='market'?(Number.isFinite(+price)&&+price>0?Number(price):mkt):Number(price);
    if(type!=='market'&&(!Number.isFinite(execPx)||execPx<=0))throw new Error('Prix invalide');
    if(type==='stop'&&((side==='long'&&execPx<=mkt)||(side==='short'&&execPx>=mkt)))
      throw new Error(side==='long'?'Le seuil Stop Long doit etre au-dessus du prix actuel':'Le seuil Stop Short doit etre sous le prix actuel');
    const notional=execPx*qty;
    const margin=notional/lev;
    const fee=notional*FEE;
    if(type==='market'){
      if(margin+fee>w.balance)throw new Error('Solde demo insuffisant');
      openPosition(w,{symbol,base,side,entry:execPx,qty,lev,margin,tp,sl,fee});
      w.balance-=fee;
      w.history.unshift({id:uid(),t:Date.now(),symbol,side,type:'MARKET',price:execPx,qty,fee,status:'Execute'});
      Wallet.save(w);
      return {filled:true,price:execPx};
    }else{
      if(margin+fee>w.balance)throw new Error('Solde demo insuffisant');
      const orderType=type==='stop'?'STOP_MARKET':'LIMIT';
      w.orders.unshift({id:uid(),t:Date.now(),symbol,base,side,type:orderType,price:execPx,
        triggerPrice:type==='stop'?execPx:null,qty,lev,tp,sl,margin,status:'En attente'});
      Wallet.save(w);
      return {filled:false,price:execPx,type:orderType};
    }
  }

  function openPosition(w,p){
    w.balance-=p.margin;w.used+=p.margin;
    w.positions.unshift({id:uid(),t:Date.now(),symbol:p.symbol,base:p.base,side:p.side,
      entry:p.entry,qty:p.qty,lev:p.lev,margin:p.margin,tp:p.tp,sl:p.sl,
      liq:liqPrice(p.side,p.entry,p.lev),openFee:p.fee});
  }

  function uPnl(pos,px){
    const d=px-pos.entry;
    return (pos.side==='long'?d:-d)*pos.qty;
  }
  function uPnlNet(pos,px){return uPnl(pos,px)-(pos.openFee||0)-(px*pos.qty*FEE);}

  function closePosition(id,pxOverride,reason='Manuel'){
    const w=Wallet.get();const i=w.positions.findIndex(p=>p.id===id);if(i<0)return;
    const pos=w.positions[i],px=pxOverride??getExitPrice(pos.symbol,pos.side)??getPrice(pos.symbol)??pos.entry;
    const grossPnl=uPnl(pos,px),fee=px*pos.qty*FEE;
    const net=grossPnl-(pos.openFee||0)-fee;
    w.balance+=pos.margin+grossPnl-fee;w.used-=pos.margin;w.realized+=net;
    w.positions.splice(i,1);
    w.history.unshift({id:uid(),t:Date.now(),symbol:pos.symbol,side:pos.side,type:'CLOSE '+reason,
      price:px,qty:pos.qty,fee,openFee:pos.openFee||0,grossPnl,pnl:net,status:'Ferme'});
    const remainingUnrealized=w.positions.reduce((sum,position)=>{
      const markPrice=getExitPrice(position.symbol,position.side)||getPrice(position.symbol)||position.entry;
      return sum+uPnl(position,markPrice);
    },0);
    w.equity=w.balance+w.used+remainingUnrealized;
    recordEquity(w);Wallet.save(w);
    return net;
  }

  function recordEquity(w){
    w.equityCurve=w.equityCurve||[];
    w.equityCurve.push({t:Date.now(),v:w.equity});
    if(w.equityCurve.length>500)w.equityCurve.shift();
  }

  /* appele a chaque tick de prix : MaJ equity, exec limites, TP/SL, liquidation */
  function onTick(symbol,px){
    setPrice(symbol,px);
    let w=Wallet.get(),changed=false;
    for(let i=w.orders.length-1;i>=0;i--){
      const o=w.orders[i];if(o.symbol!==symbol)continue;
      const isStop=o.type==='STOP_MARKET';
      const triggerPrice=isStop?(o.triggerPrice||o.price):o.price;
      const hit=isStop
        ?(o.side==='long'?px>=triggerPrice:px<=triggerPrice)
        :(o.side==='long'?px<=o.price:px>=o.price);
      if(!hit)continue;
      const fillPrice=isStop?(getEntryPrice(o.symbol,o.side)||px):o.price;
      const margin=fillPrice*o.qty/o.lev,fee=fillPrice*o.qty*FEE;
      w.orders.splice(i,1);
      if(margin+fee>w.balance){
        toast&&toast('Ordre annule',o.base+' : solde demo insuffisant au declenchement','err');
        changed=true;continue;
      }
      w.balance-=fee;
      openPosition(w,{symbol:o.symbol,base:o.base,side:o.side,entry:fillPrice,qty:o.qty,lev:o.lev,margin,tp:o.tp,sl:o.sl,fee});
      const historyType=isStop?'STOP MARKET':'LIMIT';
      w.history.unshift({id:uid(),t:Date.now(),symbol:o.symbol,side:o.side,type:historyType,price:fillPrice,
        triggerPrice:isStop?triggerPrice:null,qty:o.qty,fee,status:'Execute'});
      toast&&toast(isStop?'Stop Market execute':'Ordre limite execute',o.base+' @ '+fmt.price(fillPrice),'ok');
      changed=true;
    }
    // positions : TP/SL/liquidation
    for(const pos of [...w.positions]){
      if(pos.symbol!==symbol)continue;
      const exitPrice=getExitPrice(symbol,pos.side)||px;
      const liqHit=pos.side==='long'? exitPrice<=pos.liq : exitPrice>=pos.liq;
      if(liqHit){closePosition(pos.id,pos.liq,'LIQUIDATION');w=Wallet.get();toast&&toast('⚠ Liquidation',pos.base+' '+pos.side.toUpperCase()+' @ '+fmt.price(pos.liq),'err');changed=true;continue;}
      if(pos.tp){const tpHit=pos.side==='long'?exitPrice>=pos.tp:exitPrice<=pos.tp;if(tpHit){closePosition(pos.id,exitPrice,'TP');w=Wallet.get();toast&&toast('✓ Take Profit atteint',pos.base+' @ '+fmt.price(exitPrice),'ok');changed=true;continue;}}
      if(pos.sl){const slHit=pos.side==='long'?exitPrice<=pos.sl:exitPrice>=pos.sl;if(slHit){closePosition(pos.id,exitPrice,'SL');w=Wallet.get();toast&&toast('Stop Loss atteint',pos.base+' @ '+fmt.price(exitPrice),'err');changed=true;continue;}}
    }
    // recompute equity (balance + marge immobilisee + pnl non realise)
    let upnl=0;for(const pos of w.positions){const p=getExitPrice(pos.symbol,pos.side)||getPrice(pos.symbol)||pos.entry;upnl+=uPnl(pos,p);}
    w.equity=w.balance+w.used+upnl;
    Wallet.save(w);
    return {changed,upnl};
  }

  function cancelOrder(id){const w=Wallet.get();const i=w.orders.findIndex(o=>o.id===id);if(i<0)return;w.balance+=0;w.orders.splice(i,1);Wallet.save(w);}

  return {FEE,placeOrder,closePosition,cancelOrder,onTick,setPrice,getPrice,setQuote,getEntryPrice,getExitPrice,uPnl,uPnlNet,liqPrice};
})();
