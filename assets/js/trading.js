/* ===== Page Trading ===== */
bootShell('trading.html');
const LWC=window.LightweightCharts;
const params=new URLSearchParams(location.search);
let SYMBOL=params.get('symbol')||'BTCUSDT';
let BASE=SYMBOL.replace('USDT','');
let TF='15m',SIDE='long',OTYPE='market',LEV=5;
let candles=[],lastPrice=0,unsubK=null,unsubT=null;
const INDS={ema20:false,ema50:false,bb:false,vol:true};
const TFS=['1m','5m','15m','30m','1h','4h','1d','1w'];

/* ---- chart ---- */
const chartEl=document.getElementById('chart');
const chart=LWC.createChart(chartEl,{
  layout:{background:{color:'transparent'},textColor:'#848E9C',fontFamily:'Space Grotesk'},
  grid:{vertLines:{color:'rgba(43,49,57,.4)'},horzLines:{color:'rgba(43,49,57,.4)'}},
  crosshair:{mode:LWC.CrosshairMode.Normal},
  rightPriceScale:{borderColor:'#2B3139'},
  timeScale:{borderColor:'#2B3139',timeVisible:true,secondsVisible:false},
});
const candleSeries=chart.addCandlestickSeries({upColor:'#0ECB81',downColor:'#F6465D',borderVisible:false,wickUpColor:'#0ECB81',wickDownColor:'#F6465D'});
const volSeries=chart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'',color:'#2B3139'});
volSeries.priceScale().applyOptions({scaleMargins:{top:.82,bottom:0}});
let ema20S=null,ema50S=null,bbU=null,bbL=null,bbM=null;
const drawingSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
drawingSvg.id='drawing-layer';
drawingSvg.setAttribute('aria-hidden','true');
chartEl.appendChild(drawingSvg);
const DRAWING_TITLES={trend:'Tendance',polyline:'Polyligne',brush:'Pinceau',horizontal:'Horizontale',vertical:'Verticale',ray:'Rayon',rectangle:'Rectangle',ellipse:'Ellipse',fibonacci:'Fibonacci',channel:'Canal',arrow:'Flèche','marker-up':'Marqueur hausse','marker-down':'Marqueur baisse',measure:'Mesure',text:'Note'};
const DRAWING_POINTS={horizontal:1,vertical:1,ray:1,text:1,'marker-up':1,'marker-down':1,trend:2,polyline:2,brush:2,rectangle:2,ellipse:2,fibonacci:2,arrow:2,measure:2,channel:3};
let drawMode='cursor',drawings=[],selectedDrawingId=null,draftPoints=[],draftCursor=null,dragState=null,isBrushing=false;

function setPaletteCollapsed(collapsed){
  const palette=document.getElementById('drawTools'),button=palette.querySelector('[data-action="togglePalette"]');
  palette.classList.toggle('collapsed',collapsed);
  button.setAttribute('aria-expanded',String(!collapsed));
  button.setAttribute('aria-label',collapsed?'Afficher les outils':'Replier les outils');
  button.title=collapsed?'Afficher les outils':'Replier les outils';
  button.textContent=collapsed?'+':'−';
  try{localStorage.setItem('nt_draw_palette_collapsed',String(collapsed));}catch(_){}
}
try{setPaletteCollapsed(localStorage.getItem('nt_draw_palette_collapsed')==='true');}catch(_){setPaletteCollapsed(false);}

function drawingKey(){return `nt_drawings_${SYMBOL}_${TF}`;}
function makeDrawingId(){return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;}
function safeDrawingColor(color){return /^#[\da-f]{6}$/i.test(color||'')?color:'#FCD535';}
function safeDrawingText(text){return String(text??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function saveDrawings(){try{localStorage.setItem(drawingKey(),JSON.stringify(drawings));}catch(_){}}
function validDrawing(item){
  if(!item||!DRAWING_POINTS[item.type])return false;
  if(item.type==='horizontal')return Number.isFinite(Number(item.price));
  if(item.type==='vertical')return Number.isFinite(Number(item.time));
  return Array.isArray(item.points)&&item.points.length>=DRAWING_POINTS[item.type]&&item.points.every(p=>Number.isFinite(Number(p.time))&&Number.isFinite(Number(p.price)));
}
function loadDrawings(){
  try{
    const saved=JSON.parse(localStorage.getItem(drawingKey())||'[]');
    drawings=Array.isArray(saved)?saved.filter(validDrawing).map((item,index)=>({
      ...item,id:/^[\w-]{1,80}$/.test(item.id||'')?item.id:makeDrawingId(),
      name:typeof item.name==='string'?item.name:`${DRAWING_TITLES[item.type]} ${index+1}`,
      color:safeDrawingColor(item.color),lineWidth:[1,2,3,4].includes(Number(item.lineWidth))?Number(item.lineWidth):2,
      lineStyle:['solid','dashed','dotted'].includes(item.lineStyle)?item.lineStyle:'solid',
      visible:item.visible!==false,locked:item.locked===true,text:typeof item.text==='string'?item.text:'Note'
    })):[];
  }catch(_){drawings=[];}
  selectedDrawingId=null;draftPoints=[];draftCursor=null;renderDrawings();renderDrawingPanel();
}
function mapDrawPoint(point){
  const x=chart.timeScale().timeToCoordinate(point.time),y=candleSeries.priceToCoordinate(point.price);
  return x==null||y==null?null:{x,y};
}
function drawingPoints(item){
  if(item.type==='horizontal')return[{time:item.time||0,price:item.price}];
  if(item.type==='vertical')return[{time:item.time,price:item.price||candles[candles.length-1]?.close||0}];
  return item.points||[];
}
function drawingHandles(item,plotWidth,plotHeight){
  if(item.type==='horizontal'){
    const y=candleSeries.priceToCoordinate(item.price);return y==null?[]:[{x:plotWidth-12,y,index:0}];
  }
  if(item.type==='vertical'){
    const x=chart.timeScale().timeToCoordinate(item.time);return x==null?[]:[{x,y:plotHeight/2,index:0}];
  }
  if(item.type==='brush'){
    const points=item.points||[],indices=[...new Set([0,points.length-1])];
    return indices.map(index=>{const mapped=mapDrawPoint(points[index]);return mapped?{...mapped,index}:null;}).filter(Boolean);
  }
  return drawingPoints(item).map((point,index)=>{const mapped=mapDrawPoint(point);return mapped?{...mapped,index}:null;}).filter(Boolean);
}
function renderDrawing(item,preview=false){
  if(!preview&&!item.visible)return'';
  const plotWidth=chart.timeScale().width(),plotHeight=Math.max(0,chartEl.clientHeight-24);
  const color=safeDrawingColor(item.color),width=[1,2,3,4].includes(Number(item.lineWidth))?Number(item.lineWidth):2;
  const dash={solid:'none',dashed:'6 4',dotted:'1.5 4'}[item.lineStyle]||'none';
  const selected=!preview&&item.id===selectedDrawingId;
  const open=`<g class="drawing-object${selected?' selected':''}" data-drawing-id="${safeDrawingText(item.id||'')}" data-drawing-type="${item.type}" style="--drawing-color:${color};--drawing-width:${width}px;--drawing-dash:${dash}">`;
  let body='';
  if(item.type==='horizontal'){
    const y=candleSeries.priceToCoordinate(item.price);if(y==null)return'';
    body=`<line class="draw-line" x1="0" y1="${y}" x2="${plotWidth}" y2="${y}"/><line class="draw-hit" x1="0" y1="${y}" x2="${plotWidth}" y2="${y}"/><text class="draw-label" x="${plotWidth-5}" y="${y-5}" text-anchor="end">${fmt.price(item.price)}</text>`;
  }else if(item.type==='vertical'){
    const x=chart.timeScale().timeToCoordinate(item.time);if(x==null)return'';
    body=`<line class="draw-line" x1="${x}" y1="0" x2="${x}" y2="${plotHeight}"/><line class="draw-hit" x1="${x}" y1="0" x2="${x}" y2="${plotHeight}"/>`;
  }else if(item.type==='ray'){
    const a=mapDrawPoint(item.points[0]);if(!a)return'';
    body=`<line class="draw-line" x1="${a.x}" y1="${a.y}" x2="${plotWidth}" y2="${a.y}"/><line class="draw-hit" x1="${a.x}" y1="${a.y}" x2="${plotWidth}" y2="${a.y}"/>`;
  }else if(item.type==='text'){
    const a=mapDrawPoint(item.points[0]);if(!a)return'';
    const label=safeDrawingText(item.text||'Note'),labelWidth=Math.max(45,label.length*7.5+12);
    body=`<rect class="draw-hit-area" x="${a.x-5}" y="${a.y-19}" width="${labelWidth}" height="25"/><text class="draw-label" x="${a.x}" y="${a.y}" style="fill:${color};font-size:13px;cursor:move">${label}</text>`;
  }else if(item.type==='marker-up'||item.type==='marker-down'){
    const a=mapDrawPoint(item.points[0]);if(!a)return'';
    const direction=item.type==='marker-up'?1:-1,half=9,stem=7;
    const points=direction===1
      ?`${a.x},${a.y-12} ${a.x+half},${a.y-2} ${a.x+4},${a.y-2} ${a.x+4},${a.y+stem} ${a.x-4},${a.y+stem} ${a.x-4},${a.y-2} ${a.x-half},${a.y-2}`
      :`${a.x},${a.y+12} ${a.x+half},${a.y+2} ${a.x+4},${a.y+2} ${a.x+4},${a.y-stem} ${a.x-4},${a.y-stem} ${a.x-4},${a.y+2} ${a.x-half},${a.y+2}`;
    body=`<polygon class="draw-marker" points="${points}" style="fill:${color}"/><circle class="draw-hit-area" cx="${a.x}" cy="${a.y}" r="13"/>`;
  }else if(item.type==='rectangle'){
    const a=mapDrawPoint(item.points[0]),b=mapDrawPoint(item.points[1]);if(!a||!b)return'';
    const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);
    body=`<rect class="draw-fill" x="${x}" y="${y}" width="${w}" height="${h}"/><rect class="draw-hit-area" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  }else if(item.type==='ellipse'){
    const a=mapDrawPoint(item.points[0]),b=mapDrawPoint(item.points[1]);if(!a||!b)return'';
    const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,rx=Math.abs(a.x-b.x)/2,ry=Math.abs(a.y-b.y)/2;
    body=`<ellipse class="draw-fill" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/><ellipse class="draw-hit-area" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
  }else if(item.type==='fibonacci'){
    const a=mapDrawPoint(item.points[0]),b=mapDrawPoint(item.points[1]);if(!a||!b)return'';
    body=[0,.236,.382,.5,.618,.786,1].map(level=>{
      const price=item.points[0].price+(item.points[1].price-item.points[0].price)*level,y=candleSeries.priceToCoordinate(price);
      return y==null?'':`<line class="draw-line" x1="${Math.min(a.x,b.x)}" y1="${y}" x2="${Math.max(a.x,b.x)}" y2="${y}" style="--drawing-dash:4 3"/><line class="draw-hit" x1="${Math.min(a.x,b.x)}" y1="${y}" x2="${Math.max(a.x,b.x)}" y2="${y}"/><text class="draw-label" x="${Math.min(Math.max(a.x,b.x)+4,plotWidth-4)}" y="${y-3}">${(level*100).toFixed(1)}% ${fmt.price(price)}</text>`;
    }).join('');
  }else{
    const points=drawingPoints(item),mapped=points.map(mapDrawPoint);if(mapped.length<2||!mapped[0]||!mapped[1])return'';
    const [a,b]=mapped;
    if(item.type==='polyline'||item.type==='brush'){
      const coordinates=mapped.filter(Boolean).map(p=>`${p.x},${p.y}`).join(' ');
      body=`<polyline class="draw-line" points="${coordinates}"/><polyline class="draw-hit" points="${coordinates}"/>`;
    }else if(item.type==='channel'&&mapped.length>=3&&mapped[2]){
      const c=mapped[2],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
      const offset=((c.x-a.x)*(-dy)+(c.y-a.y)*dx)/length,nx=-dy/length*offset,ny=dx/length*offset;
      const c1={x:a.x+nx,y:a.y+ny},c2={x:b.x+nx,y:b.y+ny};
      body=`<polygon class="draw-fill" points="${a.x},${a.y} ${b.x},${b.y} ${c2.x},${c2.y} ${c1.x},${c1.y}"/><line class="draw-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><line class="draw-line" x1="${c1.x}" y1="${c1.y}" x2="${c2.x}" y2="${c2.y}"/><line class="draw-hit" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><line class="draw-hit" x1="${c1.x}" y1="${c1.y}" x2="${c2.x}" y2="${c2.y}"/>`;
    }else if(item.type==='channel'){
      body=`<line class="draw-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><line class="draw-hit" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    }else if(item.type==='measure'){
      const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);
      const delta=item.points[1].price-item.points[0].price,pct=item.points[0].price?delta/item.points[0].price*100:0;
      const label=`Δ ${delta>=0?'+':''}${fmt.price(delta)} (${fmt.pct(pct)})`;
      body=`<rect class="draw-measure" x="${x}" y="${y}" width="${w}" height="${h}"/><line class="draw-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><line class="draw-hit" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><text class="draw-label" x="${(a.x+b.x)/2+6}" y="${(a.y+b.y)/2-7}">${safeDrawingText(label)}</text>`;
    }else if(item.type==='arrow'){
      const angle=Math.atan2(b.y-a.y,b.x-a.x),baseX=b.x-10*Math.cos(angle),baseY=b.y-10*Math.sin(angle),sideX=4*Math.sin(angle),sideY=4*Math.cos(angle);
      body=`<line class="draw-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><path d="M ${b.x} ${b.y} L ${baseX+sideX} ${baseY-sideY} L ${baseX-sideX} ${baseY+sideY} Z" fill="${color}"/><line class="draw-hit" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    }else{
      body=`<line class="draw-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><line class="draw-hit" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    }
  }
  let handles='';
  if(selected&&!item.locked){
    handles=drawingHandles(item,plotWidth,plotHeight).map(p=>`<circle class="draw-handle" data-handle-index="${p.index}" cx="${p.x}" cy="${p.y}" r="5"/>`).join('');
  }
  return `${open}${body}${handles}</g>`;
}
function renderDrawings(){
  const items=drawings.map(item=>renderDrawing(item));
  if(draftPoints.length&&draftCursor){
    const preview={id:'draft',type:drawMode,points:[...draftPoints,draftCursor],price:draftCursor.price,time:draftCursor.time,color:'#FCD535',lineWidth:2,lineStyle:'dashed',visible:true};
    items.push(renderDrawing(preview,true));
  }
  drawingSvg.innerHTML=items.join('');
}
function escapeDrawingText(text){return safeDrawingText(text);}
function renderDrawingList(){
  const list=document.getElementById('drawingList');
  document.getElementById('drawingCount').textContent=String(drawings.length);
  const ordered=[...drawings].reverse();
  list.innerHTML=ordered.length?ordered.map(item=>`<div class="drawing-row${item.id===selectedDrawingId?' selected':''}">
    <button class="drawing-select" data-select-drawing="${item.id}" title="Sélectionner ${escapeDrawingText(item.name)}"><span class="drawing-swatch" style="--drawing-swatch:${safeDrawingColor(item.color)}"></span><span class="drawing-name" data-drawing-name="${item.id}">${escapeDrawingText(item.name)}</span></button>
    <div class="drawing-row-actions"><button class="draw-btn" data-item-action="visibility" data-id="${item.id}" title="${item.visible?'Masquer':'Afficher'}" aria-label="${item.visible?'Masquer':'Afficher'}">${item.visible?'◉':'○'}</button><button class="draw-btn" data-item-action="lock" data-id="${item.id}" title="${item.locked?'Déverrouiller':'Verrouiller'}" aria-label="${item.locked?'Déverrouiller':'Verrouiller'}">${item.locked?'▣':'□'}</button><button class="draw-btn" data-item-action="delete" data-id="${item.id}" title="Supprimer ${escapeDrawingText(item.name)}" aria-label="Supprimer ${escapeDrawingText(item.name)}">×</button></div>
  </div>`).join(''):'<div class="drawing-empty">Aucun objet sur ce graphique.</div>';
}
function renderDrawingPanel(){
  renderDrawingList();
  const item=drawings.find(d=>d.id===selectedDrawingId),properties=document.getElementById('drawingProperties');
  properties.hidden=!item;
  if(!item)return;
  document.getElementById('drawingName').value=item.name;
  document.getElementById('drawingColor').value=safeDrawingColor(item.color);
  document.getElementById('drawingWidth').value=String(item.lineWidth);
  document.getElementById('drawingStyle').value=item.lineStyle;
  document.getElementById('drawingTextField').hidden=item.type!=='text';
  document.getElementById('drawingText').value=item.text||'Note';
}
function selectDrawing(id){selectedDrawingId=id;renderDrawings();renderDrawingPanel();}
function pointFromPointer(event){
  const rect=drawingSvg.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  if(x<0||x>chartEl.clientWidth||y<0||y>chartEl.clientHeight)return null;
  const plotX=Math.min(x,Math.max(0,chart.timeScale().width()-1));
  const plotY=Math.min(y,Math.max(0,chartEl.clientHeight-25));
  const time=chart.timeScale().coordinateToTime(plotX),price=candleSeries.coordinateToPrice(plotY);
  return time==null||price==null?null:{time,price:Number(price)};
}
function createDrawing(type,points){
  const item={id:makeDrawingId(),type,name:`${DRAWING_TITLES[type]} ${drawings.filter(d=>d.type===type).length+1}`,color:'#FCD535',lineWidth:2,lineStyle:'solid',visible:true,locked:false};
  if(type==='horizontal')Object.assign(item,{time:points[0].time,price:points[0].price});
  else if(type==='vertical')Object.assign(item,{time:points[0].time,price:points[0].price});
  else item.points=points;
  if(type==='text')item.text='Note';
  if(type==='marker-up')item.color='#0ECB81';
  if(type==='marker-down')item.color='#F6465D';
  if(type==='brush')item.lineWidth=3;
  drawings.push(item);selectedDrawingId=item.id;
  if(type==='text'){
    document.getElementById('drawingPanel').hidden=false;
    document.querySelector('[data-action="objects"]').setAttribute('aria-expanded','true');
  }
  saveDrawings();renderDrawings();renderDrawingPanel();
}
function finishDrawing(point){
  if(drawMode==='polyline'){
    const last=draftPoints[draftPoints.length-1];
    if(!last||last.time!==point.time||last.price!==point.price)draftPoints.push(point);
    draftCursor=null;renderDrawings();return;
  }
  const needed=DRAWING_POINTS[drawMode];
  if(needed===1)createDrawing(drawMode,[point]);
  else if(draftPoints.length+1<needed){draftPoints.push(point);draftCursor=null;renderDrawings();}
  else{createDrawing(drawMode,[...draftPoints,point]);draftPoints=[];draftCursor=null;}
}
function deleteDrawing(id){
  drawings=drawings.filter(item=>item.id!==id);
  if(selectedDrawingId===id)selectedDrawingId=null;
  saveDrawings();renderDrawings();renderDrawingPanel();
}
function movePoint(item,index,point){
  if(item.type==='horizontal'){item.time=point.time;item.price=point.price;}
  else if(item.type==='vertical'){item.time=point.time;item.price=point.price;}
  else if(item.points[index])item.points[index]=point;
}
function shiftPoint(point,dx,dy){
  const mapped=mapDrawPoint(point);if(!mapped)return point;
  const time=chart.timeScale().coordinateToTime(mapped.x+dx),price=candleSeries.coordinateToPrice(mapped.y+dy);
  return time==null||price==null?point:{time,price:Number(price)};
}
function moveDrawing(item,dx,dy){
  if(item.type==='horizontal'){
    const y=candleSeries.priceToCoordinate(item.price),price=y==null?null:candleSeries.coordinateToPrice(y+dy);
    if(price!=null)item.price=Number(price);return;
  }
  if(item.type==='vertical'){
    const x=chart.timeScale().timeToCoordinate(item.time),time=x==null?null:chart.timeScale().coordinateToTime(x+dx);
    if(time!=null)item.time=time;return;
  }
  item.points=item.points.map(point=>shiftPoint(point,dx,dy));
}
function setDrawingProperty(id,key,value){
  const item=drawings.find(d=>d.id===id);if(!item)return;
  if(key==='color')item.color=safeDrawingColor(value);
  else if(key==='lineWidth')item.lineWidth=[1,2,3,4].includes(Number(value))?Number(value):2;
  else if(key==='lineStyle'&&['solid','dashed','dotted'].includes(value))item.lineStyle=value;
  saveDrawings();renderDrawings();
}
document.getElementById('drawTools').addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.action==='togglePalette'){
    setPaletteCollapsed(!document.getElementById('drawTools').classList.contains('collapsed'));
  }else if(button.dataset.draw){
    drawMode=button.dataset.draw;draftPoints=[];draftCursor=null;
    document.querySelectorAll('.draw-btn[data-draw]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    drawingSvg.classList.toggle('is-drawing',drawMode!=='cursor');renderDrawings();
  }else if(button.dataset.action==='undo'){
    const removed=drawings.pop();if(removed?.id===selectedDrawingId)selectedDrawingId=null;saveDrawings();renderDrawings();renderDrawingPanel();
  }else if(button.dataset.action==='clear'){
    drawings=[];selectedDrawingId=null;draftPoints=[];saveDrawings();renderDrawings();renderDrawingPanel();
  }else if(button.dataset.action==='deleteSelected'&&selectedDrawingId)deleteDrawing(selectedDrawingId);
  else if(button.dataset.action==='objects'){
    const panel=document.getElementById('drawingPanel');panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));
    if(!panel.hidden)renderDrawingPanel();
  }
});
document.getElementById('drawingPanel').addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.action==='closeObjects'){
    document.getElementById('drawingPanel').hidden=true;document.querySelector('[data-action="objects"]').setAttribute('aria-expanded','false');return;
  }
  const id=button.dataset.id;
  if(button.dataset.itemAction==='visibility'){
    const item=drawings.find(d=>d.id===id);if(item){item.visible=!item.visible;saveDrawings();renderDrawings();renderDrawingPanel();}
  }else if(button.dataset.itemAction==='lock'){
    const item=drawings.find(d=>d.id===id);if(item){item.locked=!item.locked;saveDrawings();renderDrawings();renderDrawingPanel();}
  }else if(button.dataset.itemAction==='delete')deleteDrawing(id);
  else if(button.dataset.selectDrawing)selectDrawing(button.dataset.selectDrawing);
  else if(button.id==='deleteDrawing'&&selectedDrawingId)deleteDrawing(selectedDrawingId);
});
document.getElementById('drawingPanel').addEventListener('input',event=>{
  const item=drawings.find(d=>d.id===selectedDrawingId);if(!item)return;
  if(event.target.id==='drawingName'){
    item.name=event.target.value.slice(0,40);const label=document.querySelector(`[data-drawing-name="${item.id}"]`);if(label)label.textContent=item.name;saveDrawings();
  }else if(event.target.id==='drawingText'){
    item.text=event.target.value.slice(0,100);saveDrawings();renderDrawings();
  }else if(event.target.id==='drawingColor')setDrawingProperty(item.id,'color',event.target.value);
});
document.getElementById('drawingPanel').addEventListener('change',event=>{
  const item=drawings.find(d=>d.id===selectedDrawingId);if(!item)return;
  if(event.target.id==='drawingWidth')setDrawingProperty(item.id,'lineWidth',event.target.value);
  else if(event.target.id==='drawingStyle')setDrawingProperty(item.id,'lineStyle',event.target.value);
});
drawingSvg.addEventListener('pointerdown',event=>{
  if(drawMode==='brush'){
    const point=pointFromPointer(event);if(!point)return;
    draftPoints=[point];draftCursor=point;isBrushing=true;
    try{drawingSvg.setPointerCapture(event.pointerId);}catch(_){}
    event.preventDefault();renderDrawings();return;
  }
  if(drawMode!=='cursor')return;
  const group=event.target.closest('[data-drawing-id]');if(!group)return;
  const id=group.getAttribute('data-drawing-id'),item=drawings.find(d=>d.id===id);if(!item)return;
  const handle=event.target.closest('[data-handle-index]'),handleIndex=handle?Number(handle.getAttribute('data-handle-index')):null;
  selectDrawing(id);
  if(item.locked)return;
  dragState={id,handleIndex,x:event.clientX,y:event.clientY};
  try{drawingSvg.setPointerCapture(event.pointerId);}catch(_){}
  event.preventDefault();
});
drawingSvg.addEventListener('pointermove',event=>{
  if(isBrushing){
    const point=pointFromPointer(event);if(!point)return;
    const previous=mapDrawPoint(draftPoints[draftPoints.length-1]),current=mapDrawPoint(point);
    if(!previous||!current||Math.hypot(current.x-previous.x,current.y-previous.y)>=2)draftPoints.push(point);
    draftCursor=point;renderDrawings();return;
  }
  if(dragState){
    const item=drawings.find(d=>d.id===dragState.id);if(!item)return;
    const dx=event.clientX-dragState.x,dy=event.clientY-dragState.y;
    if(dragState.handleIndex!=null){const point=pointFromPointer(event);if(point)movePoint(item,dragState.handleIndex,point);}
    else moveDrawing(item,dx,dy);
    dragState.x=event.clientX;dragState.y=event.clientY;renderDrawings();return;
  }
  if(draftPoints.length){draftCursor=pointFromPointer(event);renderDrawings();}
});
function finishDrag(){
  if(isBrushing){
    isBrushing=false;const points=draftPoints.slice();draftPoints=[];draftCursor=null;
    if(points.length>=2)createDrawing('brush',points);else renderDrawings();
    return;
  }
  if(dragState){dragState=null;saveDrawings();renderDrawings();renderDrawingPanel();}
}
drawingSvg.addEventListener('pointerup',finishDrag);
drawingSvg.addEventListener('pointercancel',finishDrag);
drawingSvg.addEventListener('contextmenu',event=>{
  if(drawMode!=='polyline')return;
  event.preventDefault();
  const point=pointFromPointer(event),points=draftPoints.slice(),last=points[points.length-1];
  if(point&&(!last||last.time!==point.time||last.price!==point.price))points.push(point);
  draftPoints=[];draftCursor=null;
  if(points.length>=2)createDrawing('polyline',points);else renderDrawings();
});
drawingSvg.addEventListener('click',event=>{
  if(drawMode==='cursor'||drawMode==='brush')return;
  const point=pointFromPointer(event);if(point)finishDrawing(point);
});
chartEl.addEventListener('click',event=>{
  if(drawMode==='cursor'&&!event.target.closest('#drawing-layer [data-drawing-id]')&&selectedDrawingId){selectedDrawingId=null;renderDrawings();renderDrawingPanel();}
});
document.addEventListener('keydown',event=>{
  if(event.target.matches('input,select,textarea'))return;
  if(event.key==='Escape'&&(draftPoints.length||selectedDrawingId)){draftPoints=[];draftCursor=null;selectedDrawingId=null;renderDrawings();renderDrawingPanel();}
  else if((event.key==='Delete'||event.key==='Backspace')&&selectedDrawingId){event.preventDefault();deleteDrawing(selectedDrawingId);}
});
chart.timeScale().subscribeVisibleLogicalRangeChange(renderDrawings);
new ResizeObserver(()=>{chart.applyOptions({width:chartEl.clientWidth,height:chartEl.clientHeight});renderDrawings();}).observe(chartEl);

function renderTFs(){document.getElementById('tfs').innerHTML=TFS.map(t=>`<button class="tf-btn ${t===TF?'active':''}" data-tf="${t}">${t}</button>`).join('');}
function renderInds(){document.getElementById('inds').innerHTML=
  [['ema20','EMA20'],['ema50','EMA50'],['bb','BOLL'],['vol','VOL']].map(i=>`<button class="ind-btn ${INDS[i[0]]?'on':''}" data-ind="${i[0]}">${i[1]}</button>`).join('');}
renderTFs();renderInds();

document.getElementById('tfs').addEventListener('click',e=>{const b=e.target.closest('[data-tf]');if(!b)return;TF=b.dataset.tf;renderTFs();loadChart();});
document.getElementById('inds').addEventListener('click',e=>{const b=e.target.closest('[data-ind]');if(!b)return;INDS[b.dataset.ind]=!INDS[b.dataset.ind];renderInds();applyInds();});

function applyInds(){
  const close=candles.map(c=>c.close);
  [[ema20S],[ema50S],[bbU],[bbL],[bbM]].forEach(()=>{});
  if(ema20S){chart.removeSeries(ema20S);ema20S=null;}
  if(ema50S){chart.removeSeries(ema50S);ema50S=null;}
  if(bbU){chart.removeSeries(bbU);chart.removeSeries(bbL);chart.removeSeries(bbM);bbU=bbL=bbM=null;}
  if(INDS.ema20){ema20S=chart.addLineSeries({color:'#FCD535',lineWidth:1});ema20S.setData(TA.ema(close,20).map((v,i)=>({time:candles[i].time,value:v})));}
  if(INDS.ema50){ema50S=chart.addLineSeries({color:'#5b8def',lineWidth:1});ema50S.setData(TA.ema(close,50).map((v,i)=>({time:candles[i].time,value:v})));}
  if(INDS.bb){const bb=TA.bollinger(close,20,2);
    bbU=chart.addLineSeries({color:'rgba(132,142,156,.6)',lineWidth:1});
    bbL=chart.addLineSeries({color:'rgba(132,142,156,.6)',lineWidth:1});
    bbM=chart.addLineSeries({color:'rgba(252,213,53,.5)',lineWidth:1,lineStyle:2});
    bbU.setData(bb.up.map((v,i)=>v==null?null:{time:candles[i].time,value:v}).filter(Boolean));
    bbL.setData(bb.lo.map((v,i)=>v==null?null:{time:candles[i].time,value:v}).filter(Boolean));
    bbM.setData(bb.mid.map((v,i)=>v==null?null:{time:candles[i].time,value:v}).filter(Boolean));}
  volSeries.applyOptions({visible:INDS.vol});
}

async function loadChart(){
  try{
    const raw=await API.klines(SYMBOL,TF,500);
    candles=raw.map(k=>({time:k[0]/1000,open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5]}));
    candleSeries.setData(candles);
    loadDrawings();
    volSeries.setData(candles.map(c=>({time:c.time,value:c.volume,color:c.close>=c.open?'rgba(14,203,129,.4)':'rgba(246,70,93,.4)'})));
    applyInds();updateTA();drawPositionLines();
    subscribeKline();
  }catch(e){toast('Erreur graphique','Impossible de charger les bougies','err');}
}

function subscribeKline(){
  if(unsubK)unsubK();
  unsubK=API.wsKline(SYMBOL,TF,k=>{
    const c={time:k.t/1000,open:+k.o,high:+k.h,low:+k.l,close:+k.c,volume:+k.v};
    const last=candles[candles.length-1];
    if(last&&last.time===c.time)candles[candles.length-1]=c;else candles.push(c);
    candleSeries.update(c);
    volSeries.update({time:c.time,value:c.volume,color:c.close>=c.open?'rgba(14,203,129,.4)':'rgba(246,70,93,.4)'});
    lastPrice=c.close;
    renderDrawings();
    onPrice(c.close);
  });
}

function toggleFull(){const el=document.querySelector('.chart-card');if(!document.fullscreenElement)el.requestFullscreen&&el.requestFullscreen();else document.exitFullscreen();}

/* ---- stats paire + ticker WS ---- */
async function loadPairStats(){
  try{const t=await API.ticker24h(SYMBOL);
    document.getElementById('pLast').textContent=fmt.price(t.lastPrice);
    const ch=+t.priceChangePercent;const ce=document.getElementById('pChg');ce.textContent=fmt.pct(ch);ce.className='v num '+fmt.cls(ch);
    document.getElementById('pHigh').textContent=fmt.price(t.highPrice);
    document.getElementById('pLow').textContent=fmt.price(t.lowPrice);
    document.getElementById('pVol').textContent='$'+fmt.compact(+t.quoteVolume);
    lastPrice=+t.lastPrice;onPrice(lastPrice);
  }catch(_){}
}
function subscribeTicker(){if(unsubT)unsubT();unsubT=API.wsTicker(SYMBOL,t=>{
  document.getElementById('pLast').textContent=fmt.price(t.c);
  const ch=+t.P;const ce=document.getElementById('pChg');ce.textContent=fmt.pct(ch);ce.className='v num '+fmt.cls(ch);
  document.title=fmt.price(t.c)+' '+BASE+'/USDT — NovaTrade';
});}

/* ---- selecteur de paire ---- */
const POP_PAIRS=['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT','LINKUSDT','DOTUSDT','MATICUSDT','LTCUSDT','ATOMUSDT','NEARUSDT','APTUSDT','ARBUSDT'];
async function loadPairDd(){
  try{const all=await API.ticker24h();const map={};all.forEach(t=>map[t.symbol]=t);
    const rows=POP_PAIRS.map(s=>{const t=map[s];if(!t)return'';const ch=+t.priceChangePercent;
      return `<button class="row" type="button" role="option" aria-selected="${s===SYMBOL}" onclick="switchPair('${s}')"><span>${s.replace('USDT','/USDT')}</span><span class="num">${fmt.price(t.lastPrice)} <span class="${fmt.cls(ch)}">${fmt.pct(ch)}</span></span></button>`;}).join('');
    document.getElementById('pairDd').innerHTML=rows||'<div class="empty">Aucune paire disponible.</div>';
  }catch(_){document.getElementById('pairDd').innerHTML='<div class="empty">Paires indisponibles. Vérifie ta connexion.</div>';}
}
async function loadTrades(){
  const symbol=SYMBOL,container=document.getElementById('trades');
  try{
    const trades=await API.trades(symbol,24);
    if(symbol!==SYMBOL)return;
    container.innerHTML=trades.map(trade=>`<div class="trade-row"><span class="tm">${new Date(trade.time).toLocaleTimeString('fr-FR')}</span><span class="num ${trade.isBuyerMaker?'down':'up'}">${fmt.price(trade.price)}</span><span class="num">${(+trade.qty).toFixed(4)}</span></div>`).join('');
  }catch(_){if(symbol===SYMBOL)container.innerHTML='<div class="empty" style="padding:14px">Trades indisponibles.</div>';}
}
const pairSelect=document.querySelector('.pair-select'),pairButton=document.getElementById('pairSel'),pairDropdown=document.getElementById('pairDd');
function closePairDropdown(){pairDropdown.classList.remove('open');pairButton.setAttribute('aria-expanded','false');}
pairButton.addEventListener('click',()=>{
  const open=!pairDropdown.classList.contains('open');
  pairDropdown.classList.toggle('open',open);pairButton.setAttribute('aria-expanded',String(open));
  if(open)loadPairDd();
});
document.addEventListener('click',event=>{if(!pairSelect.contains(event.target))closePairDropdown();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closePairDropdown();});
function switchPair(s){SYMBOL=s;BASE=s.replace('USDT','');
  document.getElementById('pairName').textContent=BASE+'/USDT';
  document.getElementById('qtyUnit').textContent=BASE;
  closePairDropdown();
  history.replaceState(null,'','?symbol='+s);
  loadChart();loadPairStats();subscribeTicker();loadBook();loadTrades();updateSubmitLabel();
}

/* ---- carnet d'ordres ---- */
let bookTimer=null;
async function loadBook(){
  const symbol=SYMBOL;
  try{const d=await API.depth(symbol,16);
    if(symbol!==SYMBOL||!d.bids?.length||!d.asks?.length)return;
    Engine.setQuote(symbol,d.bids[0][0],d.asks[0][0]);
    document.getElementById('quickBid').textContent=fmt.price(d.bids[0][0]);
    document.getElementById('quickAsk').textContent=fmt.price(d.asks[0][0]);
    const asks=d.asks.slice(0,12).reverse(),bids=d.bids.slice(0,12);
    const maxQ=Math.max(...[...asks,...bids].map(x=>+x[1]));
    const rowH=(a,cls)=>`<div class="book-row ${cls}" onclick="fillPrice(${a[0]})"><span class="px ${cls==='ask'?'down':'up'}">${fmt.price(a[0])}</span><span class="qty">${(+a[1]).toFixed(4)}</span><div class="bar" style="width:${(+a[1]/maxQ*100).toFixed(0)}%"></div></div>`;
    document.getElementById('asks').innerHTML=asks.map(a=>rowH(a,'ask')).join('');
    document.getElementById('bids').innerHTML=bids.map(a=>rowH(a,'bid')).join('');
    const mid=(+asks[asks.length-1][0]+ +bids[0][0])/2;
    const spr=(+asks[asks.length-1][0]-+bids[0][0]);
    document.getElementById('bookMid').textContent=fmt.price(mid);
    document.getElementById('bookMid').className='num '+(lastPrice>=mid?'up':'down');
    document.getElementById('spread').textContent=fmt.price(spr);
  }catch(_){}
}
function fillPrice(p){const f=document.getElementById('fPrice');if(f){f.value=(+p).toString();recalc();}}

/* ---- formulaire d'ordre ---- */
document.querySelector('.form-tabs').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  OTYPE=b.dataset.ot;[...e.currentTarget.children].forEach(x=>x.classList.remove('active'));b.classList.add('active');
  document.getElementById('priceField').style.display=OTYPE==='market'?'none':'flex';
  document.getElementById('priceLabel').textContent=OTYPE==='stop'?'Prix déclencheur (USDT)':'Prix limite (USDT)';
  document.getElementById('fPrice').placeholder=OTYPE==='stop'?'Seuil du Stop':'Prix limite';
  updateSubmitLabel();recalc();
});
document.querySelector('.side-tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;SIDE=b.dataset.side;[...e.currentTarget.children].forEach(x=>x.classList.remove('active'));b.classList.add('active');updateSubmitLabel();recalc();});
function updateSubmitLabel(){
  const btn=document.getElementById('submitBtn');btn.className='submit-btn '+(SIDE==='long'?'buy':'sell');
  btn.textContent=OTYPE==='market'?(SIDE==='long'?'Acheter / Long ':'Vendre / Short ')+BASE:
    `Placer ${OTYPE==='stop'?'Stop Market':'Limit'} ${SIDE==='long'?'Long':'Short'} ${BASE}`;
}

document.getElementById('levRow').innerHTML=[1,2,5,10,20,50].map(l=>`<button class="${l===LEV?'active':''}" data-l="${l}">${l}x</button>`).join('');
document.getElementById('levRow').addEventListener('click',e=>{const b=e.target.closest('[data-l]');if(!b)return;LEV=+b.dataset.l;[...e.currentTarget.children].forEach(x=>x.classList.remove('active'));b.classList.add('active');recalc();});
document.getElementById('pctRow').innerHTML=[25,50,75,100].map(p=>`<button data-p="${p}">${p}%</button>`).join('');
document.getElementById('pctRow').addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(!b)return;const w=Wallet.get();const px=OTYPE==='market'?lastPrice:(+document.getElementById('fPrice').value||lastPrice);const notional=w.balance*(+b.dataset.p/100)*LEV;document.getElementById('fQty').value=(notional/px).toFixed(5);recalc();});
['fQty','fPrice'].forEach(id=>document.getElementById(id).addEventListener('input',recalc));

function recalc(){
  const w=Wallet.get();
  const px=OTYPE==='market'?lastPrice:(+document.getElementById('fPrice').value||lastPrice);
  const qty=+document.getElementById('fQty').value||0;
  const notional=px*qty;const margin=notional/LEV;const fee=notional*Engine.FEE;
  document.getElementById('iCost').textContent=fmt.num(margin,2)+' USDT';
  document.getElementById('iFee').textContent=fmt.num(fee,2)+' USDT';
  document.getElementById('iLiq').textContent=px?fmt.price(Engine.liqPrice(SIDE,px,LEV)):'--';
  document.getElementById('iAvail').textContent=fmt.num(w.balance,2)+' USDT';
}

document.getElementById('submitBtn').addEventListener('click',()=>{
  const qty=+document.getElementById('fQty').value||0;
  if(qty<=0){toast('Quantite invalide','Entre une quantite > 0','err');return;}
  const price=OTYPE==='market'?(Engine.getEntryPrice(SYMBOL,SIDE)||lastPrice):Number(document.getElementById('fPrice').value);
  if(OTYPE!=='market'&&(!Number.isFinite(price)||price<=0)){toast('Prix invalide','Saisis un prix valide pour cet ordre','err');return;}
  const tp=+document.getElementById('fTp').value||null;
  const sl=+document.getElementById('fSl').value||null;
  const type=OTYPE;
  try{
    Engine.setPrice(SYMBOL,lastPrice);
    const r=Engine.placeOrder({symbol:SYMBOL,base:BASE,type,side:SIDE,price,qty,lev:LEV,tp,sl});
    if(r.filled)toast('Ordre execute',`${SIDE==='long'?'Long':'Short'} ${qty} ${BASE} @ ${fmt.price(r.price)}`,'ok');
    else{
      const relation=SIDE==='long'?(type==='stop'?'≥':'≤'):(type==='stop'?'≤':'≥');
      toast(type==='stop'?'Stop Market en attente':'Ordre limite place',
        `${qty} ${BASE} ${relation} ${fmt.price(r.price)} USDT`,'ok');
    }
    document.getElementById('fQty').value='';
    renderBottom();drawPositionLines();recalc();updateNavBalance();
  }catch(e){toast('Ordre refuse',e.message,'err');}
});

function quickTrade(side){
  if(OTYPE!=='market')document.querySelector('.form-tabs [data-ot="market"]').click();
  document.querySelector(`.side-tabs [data-side="${side}"]`).click();
  const quantity=document.getElementById('fQty');
  if(!Number.isFinite(+quantity.value)||+quantity.value<=0){
    toast('Quantite requise','Saisis la quantite avant de placer l’ordre rapide');
    quantity.focus();quantity.scrollIntoView({behavior:'smooth',block:'center'});return;
  }
  document.getElementById('submitBtn').click();
}
document.getElementById('quickSell').addEventListener('click',()=>quickTrade('short'));
document.getElementById('quickBuy').addEventListener('click',()=>quickTrade('long'));

/* ---- tick de prix : moteur + MaJ UI ---- */
let bpTab='pos';
function onPrice(px){
  if(!px)return;lastPrice=px;
  const res=Engine.onTick(SYMBOL,px);
  renderBottom();updateNavBalance();
  if(res&&res.changed)drawPositionLines();
}
document.querySelector('.bp-tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;bpTab=b.dataset.bp;[...e.currentTarget.children].forEach(x=>x.classList.remove('active'));b.classList.add('active');renderBottom();});

function renderBottom(){
  const w=Wallet.get();
  document.getElementById('cPos').textContent=w.positions.length;
  document.getElementById('cOrd').textContent=w.orders.length;
  const closed=w.history.filter(h=>h.status==='Ferme');
  document.getElementById('cClosed').textContent=closed.length;
  const b=document.getElementById('bpBody');
  if(bpTab==='pos'){
    const grossOpen=w.positions.reduce((sum,p)=>sum+Engine.uPnl(p,Engine.getExitPrice(p.symbol,p.side)||Engine.getPrice(p.symbol)||p.entry),0);
    const netOpen=w.positions.reduce((sum,p)=>sum+Engine.uPnlNet(p,Engine.getExitPrice(p.symbol,p.side)||Engine.getPrice(p.symbol)||p.entry),0);
    const equity=w.balance+w.used+grossOpen;
    const summary=`<div class="position-summary"><div><span>Positions ouvertes</span><b>${w.positions.length}</b></div><div><span>P&amp;L net estimé</span><b class="${fmt.cls(netOpen)}">${netOpen>=0?'+':''}${fmt.num(netOpen,2)} USDT</b></div><div><span>Équité markée</span><b>${fmt.num(equity,2)} USDT</b></div></div>`;
    if(!w.positions.length){b.innerHTML=summary+'<div class="empty">Aucune position ouverte. Passe un ordre pour commencer.</div>';return;}
    b.innerHTML=summary+`<table class="pos"><thead><tr><th>Paire</th><th>Sens</th><th>Taille</th><th>Entree</th><th>Prix de clôture</th><th>Liq.</th><th>Marge</th><th>P&amp;L net estimé</th><th>TP/SL</th><th></th></tr></thead><tbody>`+
     w.positions.map(p=>{const cur=Engine.getExitPrice(p.symbol,p.side)||Engine.getPrice(p.symbol)||p.entry;const pnl=Engine.uPnlNet(p,cur),gross=Engine.uPnl(p,cur),roe=pnl/p.margin*100;
       return `<tr><td>${p.base}/USDT</td><td><span class="tag ${p.side}">${p.side==='long'?'LONG':'SHORT'} ${p.lev}x</span></td><td>${p.qty.toFixed(4)}</td><td>${fmt.price(p.entry)}</td><td>${fmt.price(cur)}</td><td class="down">${fmt.price(p.liq)}</td><td>${fmt.num(p.margin,2)}</td><td class="${fmt.cls(pnl)}"><strong>${pnl>=0?'+':''}${fmt.num(pnl,2)} (${fmt.pct(roe)})</strong><small class="pnl-breakdown">Brut ${gross>=0?'+':''}${fmt.num(gross,2)} • frais inclus</small></td><td class="muted">${p.tp?fmt.price(p.tp):'—'}/${p.sl?fmt.price(p.sl):'—'}</td><td><button class="x-btn" onclick="closePos('${p.id}')">Fermer</button></td></tr>`;}).join('')+'</tbody></table>';
  }else if(bpTab==='ord'){
    if(!w.orders.length){b.innerHTML='<div class="empty">Aucun ordre en attente.</div>';return;}
    b.innerHTML=`<table class="pos"><thead><tr><th>Paire</th><th>Type</th><th>Sens</th><th>Prix / seuil</th><th>Quantite</th><th>Statut</th><th></th></tr></thead><tbody>`+
     w.orders.map(o=>{const isStop=o.type==='STOP_MARKET';const shownPrice=isStop?(o.triggerPrice||o.price):o.price;
       return `<tr><td>${o.base}/USDT</td><td>${isStop?'STOP MARKET':'LIMIT'}</td><td><span class="tag ${o.side}">${o.side.toUpperCase()}</span></td><td>${isStop?(o.side==='long'?'≥ ':'≤ '):''}${fmt.price(shownPrice)}</td><td>${o.qty.toFixed(4)}</td><td class="muted">${o.status}</td><td><button class="x-btn" onclick="cancelOrd('${o.id}')">Annuler</button></td></tr>`;}).join('')+'</tbody></table>';
  }else{
    if(!closed.length){b.innerHTML='<div class="empty">Aucune position fermee pour le moment.</div>';return;}
    b.innerHTML=`<table class="pos"><thead><tr><th>Date</th><th>Paire</th><th>Type</th><th>Sens</th><th>Prix</th><th>Quantite</th><th>Frais</th><th>PnL</th></tr></thead><tbody>`+
    closed.slice(0,60).map(h=>`<tr><td class="muted">${new Date(h.t).toLocaleString('fr-FR')}</td><td>${h.symbol.replace('USDT','/USDT')}</td><td>${h.type}</td><td><span class="tag ${h.side}">${h.side.toUpperCase()}</span></td><td>${fmt.price(h.price)}</td><td>${h.qty.toFixed(4)}</td><td class="muted">${fmt.num((h.openFee||0)+h.fee,2)}</td><td class="${h.pnl!=null?fmt.cls(h.pnl):''}">${h.pnl!=null?(h.pnl>=0?'+':'')+fmt.num(h.pnl,2):'—'}</td></tr>`).join('')+'</tbody></table>';
  }
}
function closePos(id){const net=Engine.closePosition(id);toast('Position fermee',(net>=0?'Gain ':'Perte ')+fmt.num(net,2)+' USDT',net>=0?'ok':'err');renderBottom();drawPositionLines();updateNavBalance();}
function cancelOrd(id){Engine.cancelOrder(id);toast('Ordre annule','','');renderBottom();drawPositionLines();}

/* ---- lignes des positions / TP / SL / liquidation sur le graphique ---- */
let priceLines=[];
function drawPositionLines(){
  priceLines.forEach(l=>{try{candleSeries.removePriceLine(l)}catch(_){}});priceLines=[];
  const w=Wallet.get();
  w.positions.filter(p=>p.symbol===SYMBOL).forEach(p=>{
    priceLines.push(candleSeries.createPriceLine({price:p.entry,color:p.side==='long'?'#0ECB81':'#F6465D',lineWidth:1,lineStyle:0,title:(p.side==='long'?'LONG':'SHORT')+' '+p.qty.toFixed(3)}));
    priceLines.push(candleSeries.createPriceLine({price:p.liq,color:'#F6465D',lineWidth:1,lineStyle:2,title:'LIQ'}));
    if(p.tp)priceLines.push(candleSeries.createPriceLine({price:p.tp,color:'#0ECB81',lineWidth:1,lineStyle:1,title:'TP'}));
    if(p.sl)priceLines.push(candleSeries.createPriceLine({price:p.sl,color:'#FCD535',lineWidth:1,lineStyle:1,title:'SL'}));
  });
  w.orders.filter(o=>o.symbol===SYMBOL).forEach(o=>{
    const isStop=o.type==='STOP_MARKET';
    priceLines.push(candleSeries.createPriceLine({price:isStop?(o.triggerPrice||o.price):o.price,color:isStop?'#FCD535':'#848E9C',lineWidth:1,lineStyle:2,title:(isStop?'STOP ':'LIMIT ')+o.side.toUpperCase()}));
  });
}

/* ---- analyse technique auto ---- */
function updateTA(){
  if(candles.length<60)return;
  const r=TA.autoSignal(candles);
  const b=document.getElementById('taVerdict');
  b.textContent=r.verdict;
  b.className='ta-badge '+(r.verdict==='Haussier'?'buy':r.verdict==='Baissier'?'sell':'neutral');
  document.getElementById('taConf').textContent='Confiance '+r.confidence+'%';
  document.getElementById('taSR').textContent='Support '+fmt.price(r.support)+' • Resistance '+fmt.price(r.resistance);
}

function openTA(){
  const r=TA.autoSignal(candles);
  const rows=r.signals.map(s=>`<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)"><span>${s[0]}</span><span class="${s[2]==='buy'?'up':s[2]==='sell'?'down':'muted'}" style="font-weight:600">${s[1]}</span></div>`).join('');
  openModal(`<div class="modal-h"><h3>🧠 Analyse technique — ${BASE}/USDT</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
   <div class="modal-b">
     <div style="text-align:center;margin-bottom:18px">
       <div class="ta-badge ${r.verdict==='Haussier'?'buy':r.verdict==='Baissier'?'sell':'neutral'}" style="font-size:18px;padding:8px 20px">${r.verdict}</div>
       <div class="muted" style="margin-top:8px">Score ${r.score} • Confiance ${r.confidence}% • ${TF}</div>
     </div>
     ${rows}
     <div style="display:flex;justify-content:space-between;padding:10px 0"><span class="muted">Support</span><b class="num">${fmt.price(r.support)}</b></div>
     <div style="display:flex;justify-content:space-between;padding:0 0 14px"><span class="muted">Resistance</span><b class="num">${fmt.price(r.resistance)}</b></div>
     <button class="btn btn-primary" style="width:100%;margin-bottom:12px" onclick="runAI()">🤖 Analyse commentee par IA</button>
     <div class="ai-box" id="aiBox"><span class="muted">Clique sur le bouton pour une analyse redigee par l'IA. Necessite ta cle API (Reglages ⚙).</span></div>
     <p class="hint">⚠ Ces analyses sont generees automatiquement et ne constituent pas un conseil financier.</p>
   </div>`);
}

async function runAI(){
  const box=document.getElementById('aiBox');
  const r=TA.autoSignal(candles);
  if(!API.hasAI()){box.innerHTML='<span class="down">Aucune cle API configuree.</span> Ouvre les <a href="#" onclick="closeModal();openSettings();return false" style="color:var(--primary)">Reglages ⚙</a> pour coller ta cle et activer l\'assistant IA.';return;}
  box.innerHTML='<span class="muted">Analyse en cours'+'...</span>';
  const prompt=`Analyse technique de ${BASE}/USDT en ${TF}. Prix actuel ${fmt.price(lastPrice)}. `+
    `Verdict heuristique: ${r.verdict} (score ${r.score}, confiance ${r.confidence}%). RSI ${r.rsi?.toFixed(1)}. `+
    `Support ${fmt.price(r.support)}, resistance ${fmt.price(r.resistance)}. `+
    `Signaux: ${r.signals.map(s=>s[0]+'='+s[1]).join(', ')}. `+
    `Donne une analyse concise (5-7 lignes) avec scenario haussier et baissier et niveaux cles.`;
  try{const txt=await API.aiAnalyze(prompt);box.textContent=txt;}
  catch(e){box.innerHTML='<span class="down">Erreur IA : '+(e.message==='NO_KEY'?'cle manquante':e.message)+'</span>. Verifie ta cle dans les Reglages.';}
}

/* ---- init ---- */
document.getElementById('pairName').textContent=BASE+'/USDT';
document.getElementById('qtyUnit').textContent=BASE;
updateSubmitLabel();
loadChart();loadPairStats();subscribeTicker();loadBook();loadTrades();loadPairDd();renderBottom();recalc();
setInterval(loadBook,2500);
setInterval(loadTrades,4000);
setInterval(()=>{updateTA();},5000);
setInterval(loadPairStats,15000);
addEventListener('beforeunload',()=>{unsubK&&unsubK();unsubT&&unsubT();});
