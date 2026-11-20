export function validateScore(a,b,winByTwo=(typeof localStorage==='undefined'||localStorage.getItem('rally-win-by-two')!=='false')){a=Number(a);b=Number(b);if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a===b)return{ok:false,message:'Scores must be different whole numbers.'};const w=Math.max(a,b),l=Math.min(a,b);if(w<11)return{ok:false,message:'Winner must reach 11.'};if(winByTwo&&(w-l<2||w>11&&w-l!==2))return{ok:false,message:w>11?'Games past 11 must end with a 2-point lead.':'Winner must reach 11 and win by 2.'};return{ok:true,winner:a>b?'A':'B'}}
export function stats(players,matches){const s=Object.fromEntries(players.map(p=>[p,{name:p,wins:0,losses:0,pointsFor:0,pointsAgainst:0,games:0}]));for(const m of matches.filter(x=>x.status==='done')){for(const side of ['A','B'])for(const p of m['team'+side]){const o=s[p],mine=m['score'+side],other=m['score'+(side==='A'?'B':'A')];if(!o)continue;o.games++;o.pointsFor+=mine;o.pointsAgainst+=other;(m.winner===side?o.wins++:o.losses++)}}return Object.values(s).map(o=>({...o,diff:o.pointsFor-o.pointsAgainst,winRate:o.games?o.wins/o.games:0,diffPerGame:o.games?(o.pointsFor-o.pointsAgainst)/o.games:0}))}
export function rankLive(s){return [...s].sort((a,b)=>(b.games?b.wins/b.games:0)-(a.games?a.wins/a.games:0)||b.diffPerGame-a.diffPerGame||b.games-a.games||a.name.localeCompare(b.name))}export function rankFinal(s){return [...s].sort((a,b)=>(b.games?b.wins/b.games:0)-(a.games?a.wins/a.games:0)||b.diffPerGame-a.diffPerGame||b.wins-a.wins||a.name.localeCompare(b.name))}
function combinations(items,size){const result=[];const pick=(start,chosen)=>{if(chosen.length===size){result.push(chosen);return}for(let i=start;i<=items.length-(size-chosen.length);i++)pick(i+1,[...chosen,items[i]])};pick(0,[]);return result}
export function makeMatches(players, count=30, courts=1){
  players=[...new Map(players.map(p=>[p.trim().toLocaleLowerCase(),p.trim()])).values()];
  if(players.length<4)return [];
  const games=Object.fromEntries(players.map(p=>[p,0])), partners=new Map(), opponents=new Map(), out=[];
  const key=(a,b)=>[a,b].sort().join('\u0000'), seen=(map,a,b)=>map.get(key(a,b))||0, add=(map,a,b)=>map.set(key(a,b),seen(map,a,b)+1);
  for(let i=0;i<count;i++){
    const eligible=[...players].sort((a,b)=>games[a]-games[b]||a.localeCompare(b)).slice(0,4); let best,bestScore=Infinity;
    for(const group of combinations(eligible,4)){const [a,b,c,d]=group;for(const [teamA,teamB] of [[[a,b],[c,d]],[[a,c],[b,d]],[[a,d],[b,c]]]){const score=seen(partners,...teamA)*4+seen(partners,...teamB)+teamA.reduce((n,x)=>n+teamB.reduce((m,y)=>m+seen(opponents,x,y),0),0);if(score<bestScore){bestScore=score;best={teamA,teamB}}}}
    const {teamA,teamB}=best;[...teamA,...teamB].forEach(p=>games[p]++);add(partners,...teamA);add(partners,...teamB);for(const a of teamA)for(const b of teamB)add(opponents,a,b);const live=i<courts;
    out.push({id:i+1,status:live?'live':'pending',court:live?i+1:null,teamA,teamB,scoreA:null,scoreB:null,winner:null});
  }return out;
}
export function code(){const chars='ABCDEFGHJKMNPQRSTUVWXYZ23456789';return Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}
