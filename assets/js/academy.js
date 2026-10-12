/* ===== Academie ===== */
bootShell('academy.html');

const COURSES=[
  ['🔰','Debutant','Les bougies japonaises','Comprendre OHLC, corps, meches, bougies haussieres et baissieres, et les figures de base (doji, marteau, englobante).'],
  ['🔰','Debutant','Supports & resistances','Identifier les zones ou le prix rebondit ou casse, et comment les tracer correctement.'],
  ['🔰','Debutant','Tendances & canaux','Haussiere, baissiere, laterale. Tracer des lignes de tendance et des canaux.'],
  ['📊','Intermediaire','RSI & momentum','Surachat/survente, divergences, et comment combiner le RSI avec la tendance.'],
  ['📊','Intermediaire','MACD','Ligne MACD, signal, histogramme et croisements pour reperer les retournements.'],
  ['📊','Intermediaire','Moyennes mobiles','SMA vs EMA, croisements dores/de la mort, et utilisation comme support dynamique.'],
  ['🚀','Avance','Gestion du risque','Taille de position, ratio risque/rendement, stop loss, et pourquoi le levier tue les comptes.'],
  ['🚀','Avance','Levier & liquidation','Comment marche la marge, calcul du prix de liquidation, et gestion du levier.'],
  ['🚀','Avance','Psychologie de trading','Gerer la peur, l\'avidite, le FOMO et construire un plan de trading discipline.'],
];
const LESSONS=[
  [
    {title:'Lire OHLC',body:'Chaque bougie résume quatre prix : ouverture, plus haut, plus bas et clôture. Le corps relie ouverture et clôture ; les mèches montrent les extrêmes atteints.',key:'La couleur indique le sens entre ouverture et clôture, pas la qualité du prochain mouvement.',practice:'Passe sur plusieurs unités de temps et compare la même période en 5 min puis en 1 h.'},
    {title:'Corps, mèches et pression',body:'Un grand corps traduit un déplacement marqué pendant la période. Une longue mèche signale qu’un prix a été rejeté avant la clôture.',key:'Lis toujours la clôture et la bougie précédente : une mèche seule ne confirme pas un retournement.',practice:'Repère une mèche haute et une mèche basse sur le graphique BTC, puis note où la bougie a clôturé.'},
    {title:'Figures avec contexte',body:'Doji, marteau et bougie englobante décrivent une hésitation ou un changement de pression. Leur intérêt dépend du niveau et de la tendance où elles apparaissent.',key:'Une figure est une observation, jamais une certitude ni un ordre automatique.',practice:'Choisis une figure et vérifie si elle est proche d’un support ou d’une résistance.'}
  ],
  [
    {title:'Tracer des zones',body:'Un support est une zone où les acheteurs ont déjà réagi ; une résistance est une zone où les vendeurs ont déjà freiné le prix.',key:'Utilise une bande de prix plutôt qu’une ligne au centime près : le marché ne respecte pas toujours un niveau exact.',practice:'Sur BTC, marque deux zones de réaction visibles sur le graphique en 1 h.'},
    {title:'Évaluer une réaction',body:'Une zone gagne en intérêt lorsque le prix y réagit plusieurs fois. Observe la vitesse du retour, les clôtures et le volume, pas seulement le nombre de contacts.',key:'Plus une zone est testée, plus elle peut finir par céder.',practice:'Compare une première réaction et un troisième test de la même zone.'},
    {title:'Cassure et retest',body:'Une cassure est plus crédible si une bougie clôture au-delà de la zone. Un retest permet d’observer si l’ancienne résistance agit ensuite comme support, ou l’inverse.',key:'Prévois aussi le scénario de fausse cassure et le niveau qui invalide ton idée.',practice:'Repère une ancienne cassure et observe comment le prix s’est comporté au retest.'}
  ],
  [
    {title:'Reconnaître la structure',body:'Une tendance haussière forme généralement des sommets et des creux ascendants. Une tendance baissière forme des sommets et des creux descendants.',key:'Si les points pivots ne progressent pas clairement, le marché peut être latéral.',practice:'Sur le graphique, relie trois creux ascendants ou trois sommets descendants.'},
    {title:'Construire un canal',body:'Un canal encadre les oscillations d’une tendance avec deux lignes parallèles. La ligne opposée projette une zone possible, elle ne garantit pas un retournement.',key:'Un canal est plus utile quand ses bords correspondent à plusieurs réactions visibles.',practice:'Trace un canal autour d’un mouvement récent, puis vérifie s’il contient la majorité des bougies.'},
    {title:'Cassure de tendance',body:'Une mèche qui traverse une ligne peut être un bruit. Une clôture et une structure qui changent donnent davantage d’éléments à analyser.',key:'Attends une confirmation ou définis à l’avance le niveau d’invalidation.',practice:'Compare une cassure par mèche et une cassure confirmée par clôture.'}
  ],
  [
    {title:'Lire l’échelle RSI',body:'Le RSI compare les mouvements récents à la hausse et à la baisse, généralement sur 14 périodes. Il oscille entre 0 et 100.',key:'Les seuils 70 et 30 signalent des conditions extrêmes possibles ; ils ne déclenchent pas à eux seuls un achat ou une vente.',practice:'Active le RSI et observe son niveau pendant une hausse soutenue.'},
    {title:'RSI en tendance',body:'Dans une tendance forte, le RSI peut rester longtemps au-dessus de 70 ou sous 30. Les zones d’équilibre varient selon le régime du marché.',key:'Évite de vendre automatiquement parce que le RSI est haut : vérifie la structure et les niveaux.',practice:'Compare les seuils RSI sur une période latérale puis sur une tendance nette.'},
    {title:'Divergences',body:'Une divergence apparaît quand le prix et le RSI ne confirment pas le même nouveau sommet ou creux. Elle avertit d’un possible affaiblissement.',key:'Une divergence peut durer et n’indique ni le moment ni l’ampleur d’un retournement.',practice:'Cherche une divergence passée et vérifie si une cassure de structure l’a ensuite confirmée.'}
  ],
  [
    {title:'Les composants du MACD',body:'Le MACD compare deux moyennes exponentielles. La ligne signal lisse le MACD et l’histogramme représente leur écart.',key:'Le réglage courant 12/26/9 est une convention, pas un paramètre universel.',practice:'Affiche le MACD et identifie ses deux lignes et son histogramme.'},
    {title:'Croisements et retard',body:'Un croisement peut signaler un changement de momentum, mais il arrive souvent après le début du mouvement, surtout sur une unité courte.',key:'Les croisements isolés produisent de faux signaux dans les marchés sans tendance.',practice:'Repère deux croisements et compare leur résultat dans un marché tendanciel et latéral.'},
    {title:'Ligne zéro et confirmation',body:'La position par rapport à zéro aide à distinguer le momentum positif et négatif. Les divergences peuvent signaler une perte de force.',key:'Combine le MACD à la structure et aux niveaux plutôt que de l’utiliser seul.',practice:'Écris un scénario qui exige à la fois une cassure de niveau et un croisement MACD.'}
  ],
  [
    {title:'SMA et EMA',body:'La SMA donne le même poids aux observations de sa fenêtre. L’EMA accorde davantage de poids aux prix récents et réagit donc plus vite.',key:'Une moyenne plus rapide réagit tôt, mais peut aussi produire davantage de faux croisements.',practice:'Compare EMA20 et EMA50 sur la même tendance.'},
    {title:'Croisements',body:'Un croisement de moyenne courte et longue aide à décrire le momentum moyen. Le Golden Cross est un croisement haussier de long terme, pas une promesse de hausse.',key:'Les moyennes sont retardées et fonctionnent mieux comme confirmation que comme prédiction.',practice:'Mesure le retard entre un croisement et le début du mouvement associé.'},
    {title:'Moyennes comme repères',body:'En tendance, une moyenne peut servir de repère dynamique. Les réactions ne sont pas garanties et changent avec l’unité de temps.',key:'Vérifie la réaction du prix et le risque avant d’en faire un niveau d’action.',practice:'Observe si les replis s’arrêtent près de l’EMA20 ou de l’EMA50.'}
  ],
  [
    {title:'Définir le risque avant l’entrée',body:'Choisis d’abord le niveau qui invalide ton scénario, puis estime la perte si le stop est atteint. Le stop doit correspondre à l’analyse, pas au montant désiré.',key:'Le risque total dépend de la distance au stop et de la quantité.',practice:'Choisis une entrée et un stop sur le graphique avant de saisir une quantité.'},
    {title:'Calculer une taille',body:'Exemple pédagogique : risque prévu divisé par la perte par unité entre l’entrée et le stop donne une quantité indicative. Les frais et le slippage peuvent augmenter la perte.',key:'Un levier élevé ne réduit pas le risque de marché : il réduit la marge requise et rapproche la liquidation.',practice:'Utilise les champs de simulation pour comparer une petite et une grande quantité au même stop.'},
    {title:'Risque/rendement',body:'Le ratio compare la perte potentielle au gain visé. Un ratio favorable n’assure pas un résultat : la probabilité de réussite compte aussi.',key:'Évalue plusieurs scénarios et n’élargis pas un stop uniquement pour éviter une perte.',practice:'Note entrée, stop, objectif et ratio avant de lancer un ordre démo.'}
  ],
  [
    {title:'Exposition et marge',body:'Le levier permet de contrôler une exposition plus grande que la marge déposée. Les variations de prix s’appliquent à l’exposition complète.',key:'Une petite variation défavorable peut représenter une grande part de la marge.',practice:'Compare le coût de marge d’une même quantité à 1x puis à 10x.'},
    {title:'Comprendre la liquidation',body:'Si les pertes réduisent trop la marge disponible, le moteur peut fermer la position près du seuil de liquidation estimé.',key:'Le seuil affiché dans NovaTrade est une approximation pédagogique, pas un calcul de broker.',practice:'Observe comment le seuil se rapproche lorsque tu augmentes le levier.'},
    {title:'Gaps et exécution',body:'Un marché peut franchir un seuil entre deux cotations. Un Stop Market se déclenche alors au prix disponible, qui peut être différent du seuil.',key:'Les frais, le spread et les mouvements rapides affectent le résultat d’une position.',practice:'Compare le seuil Stop et le prix d’exécution dans l’onglet En attente puis Fermé.'}
  ],
  [
    {title:'Écrire un plan',body:'Définis avant l’entrée le scénario, la condition d’invalidation, la taille et les conditions de sortie.',key:'Un plan écrit limite les décisions impulsives pendant les mouvements rapides.',practice:'Rédige une phrase d’entrée et une phrase d’invalidation avant un trade démo.'},
    {title:'Reconnaître le FOMO',body:'La peur de manquer un mouvement pousse à entrer tard ou à augmenter la taille sans raison. Une opportunité manquée ne crée pas une obligation d’agir.',key:'Attendre une configuration claire est une décision de trading à part entière.',practice:'Laisse passer un mouvement et note les critères qui auraient justifié une entrée.'},
    {title:'Tenir un journal',body:'Consigne le contexte, la raison d’entrée, le risque prévu et le résultat net après frais. Évalue ensuite le respect du plan, pas seulement le gain.',key:'Un échantillon de trades documentés aide à repérer les habitudes répétitives.',practice:'Après un trade démo, ajoute une note sur ce qui a été bien exécuté et ce qui est à améliorer.'}
  ]
];
const PROGRESS_KEY='nt_academy_progress';
function getProgress(){try{const value=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'{}');return value&&typeof value==='object'?value:{};}catch(_){return{};}}
function courseDoneCount(index){const value=getProgress()[index];return Array.isArray(value)?value.length:0;}
function toggleLesson(index,lessonIndex){
  const progress=getProgress(),done=Array.isArray(progress[index])?progress[index]:[];
  progress[index]=done.includes(lessonIndex)?done.filter(item=>item!==lessonIndex):[...done,lessonIndex];
  localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress));
  showCourse(index);
}
const QUIZ=[
  ['Que signifie un RSI superieur a 70 ?',['Signal de survente','Signal de surachat potentiel','Tendance baissiere confirmee','Rien de particulier'],1],
  ['Dans une bougie verte (haussiere), le prix de cloture est :',['Inferieur a l\'ouverture','Egal a l\'ouverture','Superieur a l\'ouverture','Toujours le plus haut'],2],
  ['Un levier 10x signifie qu\'une baisse de 10% du prix :',['Ne change rien','Double ton capital','Peut liquider ta position','Reduit les frais'],2],
  ['Un croisement dore (golden cross) se produit quand :',['EMA courte passe sous EMA longue','EMA courte passe au-dessus EMA longue','Le RSI atteint 50','Le volume chute'],1],
  ['Un bon ratio risque/rendement est generalement d\'au moins :',['1:0.5','1:1','1:2','Peu importe'],2],
];
const GLOSS=[
  ['Long','Parier sur la hausse d\'un actif : on achete bas pour revendre plus haut.'],
  ['Short','Parier sur la baisse : on vend haut pour racheter plus bas.'],
  ['Levier','Multiplicateur d\'exposition : amplifie gains ET pertes.'],
  ['Liquidation','Fermeture forcee d\'une position quand la marge est insuffisante.'],
  ['PnL','Profit and Loss : gain ou perte, realise (ferme) ou non realise (ouvert).'],
  ['Spread','Ecart entre le meilleur prix d\'achat (bid) et de vente (ask).'],
  ['Carnet d\'ordres','Liste des ordres d\'achat et de vente en attente sur le marche.'],
  ['Taker / Maker','Taker prend la liquidite (ordre market), Maker la fournit (ordre limit).'],
  ['Stop Loss','Ordre de securite qui ferme la position pour limiter la perte.'],
  ['Take Profit','Ordre qui ferme la position a un objectif de gain.'],
];

const V=document.getElementById('view');
function showCours(){
  V.innerHTML='<div class="aca-grid">'+COURSES.map((course,index)=>{
    const done=courseDoneCount(index),total=LESSONS[index].length,percent=Math.round(done/total*100);
    return `<div class="course card"><div class="top">${course[0]}<span class="pill lvl">${course[1]}</span></div><div class="body"><h3>${course[2]}</h3><p>${course[3]}</p><div class="course-progress"><div><span>${done}/${total} leçons</span><span>${percent}%</span></div><div class="course-progress-track"><span style="width:${percent}%"></span></div></div><button class="btn btn-ghost btn-sm" data-open-course="${index}">${done?'Reprendre':'Commencer'} →</button></div></div>`;
  }).join('')+'</div>';
}
function showCourse(index){
  const course=COURSES[index],lessons=LESSONS[index],progress=getProgress(),done=Array.isArray(progress[index])?progress[index]:[];
  if(!course||!lessons)return showCours();
  V.innerHTML=`<div class="course-reader"><button class="btn btn-ghost btn-sm" data-course-back>← Toutes les formations</button><header class="course-reader-head"><span class="pill">${course[1]}</span><h2>${course[2]}</h2><p class="section-sub">${course[3]}</p><div class="course-reader-progress">${done.length}/${lessons.length} leçons terminées</div></header><div class="lesson-list">${lessons.map((lesson,lessonIndex)=>`<article class="lesson-block"><div class="lesson-label">LEÇON ${String(lessonIndex+1).padStart(2,'0')} · ${done.includes(lessonIndex)?'TERMINÉE':'À ÉTUDIER'}</div><h3>${lesson.title}</h3><p>${lesson.body}</p><div class="lesson-note"><b>À retenir</b><p>${lesson.key}</p></div><div class="lesson-practice"><b>Exercice de simulation</b><p>${lesson.practice}</p></div><button class="btn ${done.includes(lessonIndex)?'btn-primary':'btn-ghost'} btn-sm" data-toggle-lesson="${lessonIndex}" data-course-index="${index}">${done.includes(lessonIndex)?'Leçon terminée ✓':'Marquer comme terminée'}</button></article>`).join('')}</div><p class="hint">Contenu pédagogique à but éducatif. Les exemples ne constituent pas des conseils financiers.</p></div>`;
}
function showQuiz(){V.innerHTML='<div class="card" style="padding:26px;max-width:720px"><h3 style="margin-bottom:16px">Quiz : teste tes connaissances</h3><div id="quiz"></div></div>';renderQuiz();}
function renderQuiz(){document.getElementById('quiz').innerHTML=QUIZ.map((q,qi)=>`<div style="margin-bottom:22px"><div style="font-weight:600;margin-bottom:10px">${qi+1}. ${q[0]}</div>${q[1].map((o,oi)=>`<div class="quiz-opt" data-q="${qi}" data-o="${oi}">${o}</div>`).join('')}</div>`).join('');
  document.querySelectorAll('.quiz-opt').forEach(el=>el.addEventListener('click',()=>{const qi=+el.dataset.q,oi=+el.dataset.o;const correct=QUIZ[qi][2];const sibs=document.querySelectorAll(`.quiz-opt[data-q="${qi}"]`);sibs.forEach(s=>s.classList.remove('correct','wrong'));if(oi===correct){el.classList.add('correct');toast('Bonne reponse ✓','','ok');}else{el.classList.add('wrong');sibs[correct].classList.add('correct');toast('Mauvaise reponse','La bonne est surlignee','err');}}));}
function showGloss(){V.innerHTML='<div class="card" style="padding:26px;max-width:760px"><h3 style="margin-bottom:10px">Glossaire du trader</h3><dl class="gloss">'+GLOSS.map(g=>`<dt>${g[0]}</dt><dd>${g[1]}</dd>`).join('')+'</dl></div>';}

V.addEventListener('click',event=>{
  const open=event.target.closest('[data-open-course]');if(open)return showCourse(+open.dataset.openCourse);
  if(event.target.closest('[data-course-back]'))return showCours();
  const toggle=event.target.closest('[data-toggle-lesson]');if(toggle)return toggleLesson(+toggle.dataset.courseIndex,+toggle.dataset.toggleLesson);
});
document.getElementById('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;[...e.currentTarget.children].forEach(x=>x.classList.remove('active'));b.classList.add('active');({cours:showCours,quiz:showQuiz,gloss:showGloss})[b.dataset.t]();});
showCours();
