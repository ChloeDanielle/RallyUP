import assert from 'node:assert/strict';import {validateScore,rebalanceMatches,updateFutureMatches,addCourt} from '../js/logic.js';
for(const [a,b,ok] of [[11,0,1],[12,10,1],[13,11,1],[15,13,1],[11,10,0],[12,9,0],[10,8,0],[11,11,0]])assert.equal(validateScore(a,b).ok,Boolean(ok));console.log('scoring tests passed');

const players=['Chloe','Miguel','Danna','Mary','Thyron','Alex','Bea','Luis'];
const matches=[
  {id:1,status:'live',teamA:['Chloe','Miguel'],teamB:['Danna','Mary']},
  {id:2,status:'pending',teamA:['Thyron','Alex'],teamB:['Bea','Luis']}
];
const changed=rebalanceMatches(matches,players,1,['Miguel'],()=>0);
assert.ok(changed);
assert.deepEqual(changed[0].teamA,['Chloe','Thyron']);
assert.deepEqual(changed[1].teamA,['Miguel','Alex']);
assert.equal(new Set(changed.flatMap(m=>[...m.teamA,...m.teamB])).size,8);
assert.equal(changed.some(m=>new Set([...m.teamA,...m.teamB]).size!==4),false);
console.log('matchup rebalance tests passed');

const fixed=[
  {id:1,status:'done',court:1,teamA:['Chloe','Miguel'],teamB:['Danna','Mary'],scoreA:11,scoreB:9,winner:'A'},
  {id:2,status:'live',court:1,teamA:['Thyron','Alex'],teamB:['Bea','Luis']},
  {id:3,status:'pending',court:null,teamA:['Chloe','Miguel'],teamB:['Danna','Nina']}
];
const updated=updateFutureMatches(fixed,[...players,'Nina'],1);
assert.deepEqual(updated.find(m=>m.id===1),fixed[0]);
assert.deepEqual(updated.find(m=>m.id===2),fixed[1]);
assert.equal(updated.filter(m=>m.status==='pending').length,1);
assert.equal(updated.find(m=>m.status==='pending').id,3);
const renumbered=updateFutureMatches([{id:1,status:'live',teamA:['Chloe','Miguel'],teamB:['Danna','Mary']},{id:59,status:'pending',teamA:['Thyron','Alex'],teamB:['Bea','Luis']}],players,10);
assert.deepEqual(renumbered.filter(m=>m.status==='pending').map(m=>m.id),[2,3,4,5,6,7,8,9,10,11]);
const thirtyToForty=updateFutureMatches([{id:1,status:'live',teamA:['Chloe','Miguel'],teamB:['Danna','Mary']},...Array.from({length:29},(_,i)=>({id:i+2,status:'pending',teamA:['Chloe','Miguel'],teamB:['Danna','Mary']}))],players,39);
assert.equal(thirtyToForty.at(-1).id,40);
const noImmediateRepeat=updateFutureMatches([
  {id:1,status:'done',teamA:['Carl','Carlos'],teamB:['Chloe','Christian']},
  {id:2,status:'pending',teamA:['Carl','Carlos'],teamB:['Chloe','Christian']}
],['Carl','Carlos','Chloe','Christian','Danna','Mary','Miguel','Thyron'],1);
assert.notDeepEqual([...noImmediateRepeat.find(m=>m.status==='pending').teamA,...noImmediateRepeat.find(m=>m.status==='pending').teamB].sort(),['Carl','Carlos','Chloe','Christian']);
const courtAdded=addCourt(fixed,1);
assert.equal(courtAdded.courts,2);
assert.equal(courtAdded.matches.find(m=>m.id===3).status,'live');
assert.equal(courtAdded.matches.find(m=>m.id===3).court,2);
console.log('lobby settings tests passed');
