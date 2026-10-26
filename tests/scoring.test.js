import assert from 'node:assert/strict';import {validateScore} from '../js/logic.js';
for(const [a,b,ok] of [[11,0,1],[12,10,1],[13,11,1],[15,13,1],[11,10,0],[12,9,0],[10,8,0],[11,11,0]])assert.equal(validateScore(a,b).ok,Boolean(ok));console.log('scoring tests passed');
