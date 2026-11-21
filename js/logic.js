export function validateScore(a,b,winByTwo=(typeof localStorage==='undefined'||localStorage.getItem('rally-win-by-two')!=='false')){a=Number(a);b=Number(b);if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a===b)return{ok:false,message:'Scores must be different whole numbers.'};const w=Math.max(a,b),l=Math.min(a,b);if(w<11)return{ok:false,message:'Winner must reach 11.'};if(winByTwo&&(w-l<2||w>11&&w-l!==2))return{ok:false,message:w>11?'Games past 11 must end with a 2-point lead.':'Winner must reach 11 and win by 2.'};return{ok:true,winner:a>b?'A':'B'}}
export function stats(players,matches){const s=Object.fromEntries(players.map(p=>[p,{name:p,wins:0,losses:0,pointsFor:0,pointsAgainst:0,games:0}]));for(const m of matches.filter(x=>x.status==='done')){for(const side of ['A','B'])for(const p of m['team'+side]){const o=s[p],mine=m['score'+side],other=m['score'+(side==='A'?'B':'A')];if(!o)continue;o.games++;o.pointsFor+=mine;o.pointsAgainst+=other;(m.winner===side?o.wins++:o.losses++)}}return Object.values(s).map(o=>({...o,diff:o.pointsFor-o.pointsAgainst,winRate:o.games?o.wins/o.games:0,diffPerGame:o.games?(o.pointsFor-o.pointsAgainst)/o.games:0}))}
export function rankLive(s){return [...s].sort((a,b)=>(b.games?b.wins/b.games:0)-(a.games?a.wins/a.games:0)||b.diffPerGame-a.diffPerGame||b.games-a.games||a.name.localeCompare(b.name))}export function rankFinal(s){return [...s].sort((a,b)=>(b.games?b.wins/b.games:0)-(a.games?a.wins/a.games:0)||b.diffPerGame-a.diffPerGame||b.wins-a.wins||a.name.localeCompare(b.name))}
function combinations(items,size){const result=[];const pick=(start,chosen)=>{if(chosen.length===size){result.push(chosen);return}for(let i=start;i<=items.length-(size-chosen.length);i++)pick(i+1,[...chosen,items[i]])};pick(0,[]);return result}
export function makeMatches(players, count=30, courts=1, history=[]){
  players=[...new Map(players.map(p=>[p.trim().toLocaleLowerCase(),p.trim()])).values()];
  if(players.length<4)return [];
  const games=Object.fromEntries(players.map(p=>[p,0])), partners=new Map(), opponents=new Map(), out=[];
  const key=(a,b)=>[a,b].sort().join('\u0000'), seen=(map,a,b)=>map.get(key(a,b))||0, add=(map,a,b)=>map.set(key(a,b),seen(map,a,b)+1);
  const previousGroups=new Set();
  for(const m of history){
    const group=[...(m.teamA||[]),...(m.teamB||[])];
    if(group.length!==4)continue;
    previousGroups.add([...group].sort().join('\u0000'));
    group.forEach(p=>{if(games[p]!==undefined)games[p]++});
    add(partners,...(m.teamA||[]));add(partners,...(m.teamB||[]));
    for(const a of m.teamA||[])for(const b of m.teamB||[])add(opponents,a,b);
  }
  for(let i=0;i<count;i++){
    const eligible=[...players].sort((a,b)=>games[a]-games[b]||a.localeCompare(b)).slice(0,Math.min(players.length,8)); let best,bestScore=Infinity;
    for(const group of combinations(eligible,4)){const [a,b,c,d]=group,groupKey=group.join('\u0000');for(const [teamA,teamB] of [[[a,b],[c,d]],[[a,c],[b,d]],[[a,d],[b,c]]]){const score=seen(partners,...teamA)*4+seen(partners,...teamB)+teamA.reduce((n,x)=>n+teamB.reduce((m,y)=>m+seen(opponents,x,y),0),0)+(previousGroups.has(groupKey)?1000:0);if(score<bestScore){bestScore=score;best={teamA,teamB}}}}
    const {teamA,teamB}=best;[...teamA,...teamB].forEach(p=>games[p]++);add(partners,...teamA);add(partners,...teamB);for(const a of teamA)for(const b of teamB)add(opponents,a,b);const live=i<courts;
    previousGroups.add([...teamA,...teamB].sort().join('\u0000'));out.push({id:i+1,status:live?'live':'pending',court:live?i+1:null,teamA,teamB,scoreA:null,scoreB:null,winner:null});
  }return out;
}
// Replace unavailable players without ever leaving a player in two matches or
// putting the same player into both slots of one match.
export function rebalanceMatches(matches, players, id, unavailable, random=Math.random){
  const next=matches.map(m=>({...m,teamA:[...m.teamA],teamB:[...m.teamB]}));
  const current=next.find(m=>m.id===id);
  const unavailableList=[...new Set(unavailable)];
  if(!current||current.status!=='live'||!unavailableList.length)return null;
  const currentPlayers=[...current.teamA,...current.teamB];
  if(unavailableList.some(p=>!currentPlayers.includes(p)))return null;
  const activeElsewhere=new Set(next.filter(m=>m.status==='live'&&m.id!==id).flatMap(m=>[...m.teamA,...m.teamB]));
  const games=Object.fromEntries(players.map(p=>[p,0]));
  next.forEach(m=>[...m.teamA,...m.teamB].forEach(p=>games[p]=(games[p]||0)+1));
  const replacements=[];
  for(const unavailablePlayer of unavailableList){
    const eligible=players.filter(p=>!activeElsewhere.has(p)&&!currentPlayers.includes(p)&&!unavailableList.includes(p)&&!replacements.includes(p));
    const carriers=next.filter(m=>m.status==='pending'&&!m.teamA.concat(m.teamB).some(p=>activeElsewhere.has(p))&&!unavailableList.some(p=>m.teamA.concat(m.teamB).includes(p)));
    const viable=eligible.filter(p=>carriers.some(m=>m.teamA.includes(p)||m.teamB.includes(p)));
    if(!viable.length)return null;
    const least=Math.min(...viable.map(p=>games[p]||0));
    const tied=viable.filter(p=>(games[p]||0)===least);
    const replacement=tied[Math.floor(random()*tied.length)];
    const carrier=carriers.find(m=>m.teamA.includes(replacement)||m.teamB.includes(replacement));
    const swap=team=>team.map(p=>p===replacement?unavailablePlayer:p);
    carrier.teamA=swap(carrier.teamA); carrier.teamB=swap(carrier.teamB);
    replacements.push(replacement); games[replacement]++;
  }
  unavailableList.forEach((p,i)=>{
    const replacement=replacements[i];
    current.teamA=current.teamA.map(x=>x===p?replacement:x);
    current.teamB=current.teamB.map(x=>x===p?replacement:x);
  });
  const allActive=next.filter(m=>m.status==='live').flatMap(m=>[...m.teamA,...m.teamB]);
  if(new Set(allActive).size!==allActive.length)return null;
  if(next.some(m=>new Set([...m.teamA,...m.teamB]).size!==4))return null;
  return next;
}
// Rebuild only pending matches. Completed and live matches are copied unchanged.
export function updateFutureMatches(matches, players, pendingCount){
  const fixed=matches.filter(m=>m.status!=='pending');
  const pending=matches.filter(m=>m.status==='pending');
  const firstPendingId=Math.max(0,...fixed.map(m=>m.id||0))+1;
  const generated=makeMatches(players,Math.max(0,pendingCount),1,fixed).map((m,i)=>({...m,id:firstPendingId+i,status:'pending',court:null,scoreA:null,scoreB:null,winner:null}));
  return [...fixed,...generated].sort((a,b)=>a.id-b.id);
}
export function addCourt(matches, courts){
  const next=matches.map(m=>({...m,teamA:[...m.teamA],teamB:[...m.teamB]}));
  const live=next.filter(m=>m.status==='live');
  const nextCourt=Math.max(courts, ...live.map(m=>m.court||0))+1;
  const active=new Set(live.flatMap(m=>[...m.teamA,...m.teamB]));
  const pending=next.find(m=>m.status==='pending'&&!m.teamA.concat(m.teamB).some(p=>active.has(p)));
  if(!pending)return {matches:next,courts};
  pending.status='live'; pending.court=nextCourt;
  return {matches:next,courts:Math.max(courts,nextCourt)};
}
export function code(){const chars='ABCDEFGHJKMNPQRSTUVWXYZ23456789';return Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}
