import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {StorageService,DRAFT_KEY} from '../src/services/storage-service.js';
import {validateDraft} from '../src/tutorial/practice-model.js';

const practice=JSON.parse(await readFile(new URL('../data/practice.json',import.meta.url),'utf8'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const draft=(extra={})=>({schema:1,answers:{memo:{option:'split',names:{first:'amount',second:'wait'},reason:null},'today-sales':{option:'keep',names:{},reason:'accumulate'}},note:'한 칸, 한 뜻',savedAt:'2026-11-09T12:00:00.000Z',...extra});
const strict=value=>validateDraft(value,practice);
class MemoryStorage {
  data=new Map();
  getItem(key){return this.data.get(key)??null;}
  setItem(key,value){this.data.set(key,String(value));}
  removeItem(key){this.data.delete(key);}
}

test('the draft key matches the practice data file',()=>{
  assert.equal(DRAFT_KEY,practice.draft.storageKey);assert.equal(DRAFT_KEY,'split-variable-tutorial:practice-draft:v1');
});

test('a draft round-trips exactly and every load returns a private copy',async()=>{
  const memory=new MemoryStorage();const service=new StorageService({storage:memory});const original=draft();
  assert.equal(await service.loadDraft(strict),null);
  await service.saveDraft(original,strict);original.answers.memo.option='keep';
  assert.ok(memory.data.has(DRAFT_KEY));const restored=await service.loadDraft(strict);assert.deepEqual(restored,draft());
  restored.answers.memo.names.first='number';assert.deepEqual(await service.loadDraft(strict),draft());
  await service.clearDraft();assert.equal(await service.loadDraft(strict),null);
});

test('damaged or foreign drafts are reported and left untouched',async()=>{
  const memory=new MemoryStorage();const service=new StorageService({storage:memory});
  const bad=[draft({schema:2}),draft({note:'x'.repeat(301)}),draft({savedAt:'yesterday'}),draft({extra:true}),
    {...draft(),answers:{unknown:{option:'split',names:{},reason:null}}},
    {...draft(),answers:{memo:{option:'maybe',names:{},reason:null}}},
    {...draft(),answers:{memo:{option:'split',names:{first:'number-9'},reason:null}}},
    {...draft(),answers:{memo:{option:'split',names:{},reason:'accumulate'}}},
    {...draft(),answers:{'today-sales':{option:'keep',names:{},reason:'because'}}}].map(value=>JSON.stringify(value));
  bad.push('{"schema":1,"answers":{"__proto__":{"option":"split","names":{},"reason":null}},"note":""}');
  for(const json of bad){
    memory.setItem(DRAFT_KEY,json);
    await assert.rejects(service.loadDraft(strict));assert.equal(memory.getItem(DRAFT_KEY),json);assert.ok(service.lastError);
  }
  memory.setItem(DRAFT_KEY,'{broken');await assert.rejects(service.loadDraft(strict));assert.equal(memory.getItem(DRAFT_KEY),'{broken');
  await assert.rejects(service.saveDraft(draft({schema:3}),strict));assert.equal(service.saving,false);
});

test('saving stays visible until the write finishes and resets after a failure and retry',async()=>{
  const memory=new MemoryStorage();const gate=deferred();const write=memory.setItem.bind(memory);memory.setItem=()=>gate.promise;
  const service=new StorageService({storage:memory});const saved=service.saveDraft(draft(),strict);assert.equal(service.saving,true);
  gate.reject(Error('disk blocked'));await assert.rejects(saved,/disk blocked/);assert.equal(service.saving,false);assert.match(service.lastError.message,/disk blocked/);
  memory.setItem=write;await service.saveDraft(draft(),strict);assert.equal(service.saving,false);assert.equal(service.lastError,null);assert.deepEqual(await service.loadDraft(strict),draft());
});

test('writes run one at a time in call order',async()=>{
  const memory=new MemoryStorage();const gate=deferred();const order=[];const write=memory.setItem.bind(memory);
  memory.setItem=(key,value)=>{order.push(JSON.parse(value).note);if(order.length===1)return gate.promise.then(()=>write(key,value));write(key,value);};
  const service=new StorageService({storage:memory});
  const first=service.saveDraft(draft({note:'first'}),strict);const second=service.saveDraft(draft({note:'second'}),strict);
  await Promise.resolve();assert.deepEqual(order,['first']);assert.equal(service.pending,2);
  gate.resolve();await Promise.all([first,second]);assert.deepEqual(order,['first','second']);assert.equal((await service.loadDraft(strict)).note,'second');assert.equal(service.saving,false);
});

test('read and deletion failures are visible and never silently clear the saved draft',async()=>{
  const memory=new MemoryStorage();const service=new StorageService({storage:memory});await service.saveDraft(draft(),strict);
  memory.removeItem=()=>{throw Error('deletion blocked');};await assert.rejects(service.clearDraft(),/deletion blocked/);assert.equal(service.saving,false);assert.deepEqual(await service.loadDraft(strict),draft());
  memory.getItem=()=>{throw Error('read blocked');};await assert.rejects(service.loadDraft(strict),/read blocked/);assert.match(service.lastError.message,/read blocked/);
});

test('missing or throwing browser storage is reported as unavailable',async()=>{
  const missing=new StorageService({storage:null});assert.equal(missing.available,false);await assert.rejects(missing.loadDraft(strict));await assert.rejects(missing.saveDraft(draft(),strict));assert.equal(missing.saving,false);
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('SecurityError');}});
  try{const blocked=new StorageService();assert.equal(blocked.available,false);await assert.rejects(blocked.loadDraft(strict),/SecurityError/);}
  finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;}
});
