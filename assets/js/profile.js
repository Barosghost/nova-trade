/* ===== Profil & statistiques de performance ===== */
bootShell('profile.html');
const w=Wallet.get();
const demoProfile=DemoProfile.get();
const nameField=document.getElementById('demoName'),capitalField=document.getElementById('demoCapital');
nameField.value=demoProfile.name;
capitalField.value=demoProfile.startingBalance;
function renderDemoName(name){
  document.getElementById('demoProfileName').textContent=name;
  document.getElementById('demoAvatar').textContent=name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();
  const navDemo=document.querySelector('.nav-right .btn.btn-ghost.btn-sm');if(navDemo)navDemo.textContent=name;
}
renderDemoName(demoProfile.name);
document.getElementById('since').textContent=new Date(w.created).toLocaleDateString('fr-FR');

document.getElementById('demoAccountForm').addEventListener('submit',event=>{
  event.preventDefault();
  try{
    const saved=DemoProfile.save({name:nameField.value,startingBalance:capitalField.value});
    renderDemoName(saved.name);toast('Profil enregistré','Le nom et le capital du prochain compte sont sauvegardés.','ok');
  }catch(error){toast('Profil invalide',error.message,'err');}
});
document.getElementById('createDemoAccount').addEventListener('click',()=>{
  let nextProfile;
  try{nextProfile=DemoProfile.save({name:nameField.value,startingBalance:capitalField.value});}
  catch(error){toast('Compte invalide',error.message,'err');return;}
  if(!confirm(`Créer un nouveau compte démo « ${nextProfile.name} » avec ${fmt.num(nextProfile.startingBalance,0)} USDT ? Le portefeuille actuel sera effacé.`))return;
  Wallet.reset(nextProfile.startingBalance);
  toast('Compte démo créé',`${nextProfile.name} • ${fmt.num(nextProfile.startingBalance,0)} USDT`,'ok');
  setTimeout(()=>location.reload(),400);
});

const closed=w.history.filter(h=>h.pnl!=null);
const wins=closed.filter(h=>h.pnl>0);
const losses=closed.filter(h=>h.pnl<=0);
const winRate=closed.length?wins.length/closed.length*100:0;
const avgWin=wins.length?wins.reduce((a,h)=>a+h.pnl,0)/wins.length:0;
const avgLoss=losses.length?losses.reduce((a,h)=>a+h.pnl,0)/losses.length:0;
const best=closed.length?Math.max(...closed.map(h=>h.pnl)):0;
const worst=closed.length?Math.min(...closed.map(h=>h.pnl)):0;
const totalPnl=w.realized;

const STATS=[
  ['Trades fermes',closed.length,''],
  ['PnL realise',(totalPnl>=0?'+':'')+fmt.num(totalPnl,2)+' USDT',fmt.cls(totalPnl)],
  ['Meilleur trade','+'+fmt.num(best,2)+' USDT','up'],
  ['Pire trade',fmt.num(worst,2)+' USDT','down'],
  ['Gain moyen','+'+fmt.num(avgWin,2),'up'],
  ['Perte moyenne',fmt.num(avgLoss,2),'down'],
  ['Positions ouvertes',w.positions.length,''],
  ['Equity actuel',fmt.num(w.equity,2)+' USDT',''],
];
document.getElementById('stats').innerHTML=STATS.map(s=>`<div class="pf-stat card"><div class="l">${s[0]}</div><div class="v num ${s[2]}">${s[1]}</div></div>`).join('');

document.getElementById('wrPct').textContent=winRate.toFixed(1)+'%';
document.getElementById('wrBar').style.width=winRate+'%';
document.getElementById('wins').textContent=wins.length+' gagnants';
document.getElementById('losses').textContent=losses.length+' perdants';

if(!closed.length)document.getElementById('histWrap').innerHTML='<div class="empty">Aucun trade ferme. Rends-toi sur la page Trading pour commencer.</div>';
else document.getElementById('histWrap').innerHTML=`<table class="pos"><thead><tr><th>Date</th><th>Paire</th><th>Type</th><th>Sens</th><th>Prix</th><th>Quantite</th><th>PnL</th></tr></thead><tbody>`+
  closed.map(h=>`<tr><td class="muted">${new Date(h.t).toLocaleString('fr-FR')}</td><td>${h.symbol.replace('USDT','/USDT')}</td><td>${h.type}</td><td><span class="tag ${h.side}">${h.side.toUpperCase()}</span></td><td>${fmt.price(h.price)}</td><td>${h.qty.toFixed(4)}</td><td class="${fmt.cls(h.pnl)}">${(h.pnl>=0?'+':'')+fmt.num(h.pnl,2)}</td></tr>`).join('')+'</tbody></table>';
