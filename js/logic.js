export function validateScore(a,b){a=Number(a);b=Number(b);if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a===b)return{ok:false,message:'Scores must be different whole numbers.'};const w=Math.max(a,b),l=Math.min(a,b);if(w<11||w-l<2)return{ok:false,message:'Winner must reach 11 and win by 2.'};if(w>11&&w-l!==2)return{ok:false,message:'Games past 11 must end with a 2-point lead.'};return{ok:true,winner:a>b?'A':'B'}}
export function stats(players,matches){const s=Object.fromEntries(players.map(p=>[p,{name:p,wins:0,losses:0,pointsFor:0,pointsAgainst:0,games:0}]));for(const m of matches.filter(x=>x.status==='done')){for(const side of ['A','B'])for(const p of m['team'+side]){const o=s[p],mine=m['score'+side],other=m['score'+(side==='A'?'B':'A')];o.games++;o.pointsFor+=mine;o.pointsAgainst+=other;(m.winner===side?o.wins++:o.losses++)}}return Object.values(s).map(o=>({...o,diff:o.pointsFor-o.pointsAgainst}))}
export function rankLive(s){return [...s].sort((a,b)=>b.wins-a.wins||a.losses-b.losses||a.name.localeCompare(b.name))}export function rankFinal(s){return [...s].sort((a,b)=>b.wins-a.wins||b.diff-a.diff||b.pointsFor-a.pointsFor||a.name.localeCompare(b.name))}
function combinations(items,size){const result=[];const pick=(start,chosen)=>{if(chosen.length===size){result.push(chosen);return}for(let i=start;i<=items.length-(size-chosen.length);i++)pick(i+1,[...chosen,items[i]])};pick(0,[]);return result}
export function makeMatches(players, count=30, courts=1){
  const games=Object.fromEntries(players.map(p=>[p,0])), partners=new Map(), opponents=new Map(), out=[];
  const key=(a,b)=>[a,b].sort().join('\u0000'), seen=(map,a,b)=>map.get(key(a,b))||0, add=(map,a,b)=>map.set(key(a,b),seen(map,a,b)+1);
  for(let i=0;i<count;i++){
    const min=Math.min(...players.map(p=>games[p])), eligible=players.filter(p=>games[p]<=min+1); let best,bestScore=Infinity;
    for(const group of combinations(eligible,4)){const [a,b,c,d]=group;for(const [teamA,teamB] of [[[a,b],[c,d]],[[a,c],[b,d]],[[a,d],[b,c]]]){const score=group.reduce((n,p)=>n+(games[p]-min)*10,0)+seen(partners,...teamA)*4+seen(partners,...teamB)+teamA.reduce((n,x)=>n+teamB.reduce((m,y)=>m+seen(opponents,x,y),0),0)+Math.random();if(score<bestScore){bestScore=score;best={teamA,teamB}}}}
    const {teamA,teamB}=best;[...teamA,...teamB].forEach(p=>games[p]++);add(partners,...teamA);add(partners,...teamB);for(const a of teamA)for(const b of teamB)add(opponents,a,b);const live=i<courts;
    out.push({id:i+1,status:live?'live':'pending',court:live?i+1:null,teamA,teamB,scoreA:null,scoreB:null,winner:null});
  }return out;
}
export function code(){const chars='ABCDEFGHJKMNPQRSTUVWXYZ23456789';return Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}
