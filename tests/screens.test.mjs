import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installDom,text} from './helpers/fake-dom.mjs';
import {SCREENS} from '../src/screens/screen-table.js';
import {ROUTE_TABLE,routeFor} from '../src/shared/route-table.js';
import {parseRoute} from '../src/shared/routes.js';
import {SHELL} from '../src/shared/shell-copy.js';
import {StorageService,DRAFT_KEY} from '../src/services/storage-service.js';

const load=async name=>JSON.parse(await readFile(new URL('../data/'+name+'.json',import.meta.url),'utf8'));
const data={tutorial:await load('tutorial'),practice:await load('practice'),code:await load('code')};
const {tutorial,practice}=data;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
class MemoryStorage {
  data=new Map();
  getItem(key){return this.data.get(key)??null;}
  setItem(key,value){this.data.set(key,String(value));}
  removeItem(key){this.data.delete(key);}
}
const abortError=()=>new DOMException('aborted','AbortError');
function fakeContent({failures=0,gate=null}={}){
  const calls=[];
  return {calls,async load(name,{signal}={}){
    calls.push(name);if(signal?.aborted)throw abortError();
    if(gate)await gate;
    if(failures>0){failures--;const error=Error(SHELL.loadError);error.userMessage=SHELL.loadError;throw error;}
    if(signal?.aborted)throw abortError();
    return structuredClone(data[name]);
  }};
}

function setup(t){
  const dom=installDom();t.after(()=>dom.restore());
  return async function mount(hash,{content=fakeContent(),memory=new MemoryStorage(),storage=new StorageService({storage:memory}),version,router}={}){
    const titles=[],toasts=[];const route=parseRoute(hash);const entry=routeFor(route.path);
    const root=dom.document.createElement('main');
    const ctx={content,storage,toast:message=>toasts.push(message),setTitle:value=>titles.push(value)};
    if(version)ctx.version=version;if(router)ctx.router=router;
    const screen=new SCREENS[entry.screen](ctx,root,route,entry);
    await screen.mount();
    return {screen,root,titles,toasts,memory,storage,content,document:dom.document};
  };
}
const expectedHeading=entry=>{
  const screens=tutorial.screens;
  if(entry.screen==='step')return screens.steps.items[entry.step-1].title;
  return screens[entry.screen].title;
};

test('every screen key in the route table has a screen class',()=>{
  for(const entry of ROUTE_TABLE)assert.equal(typeof SCREENS[entry.screen],'function',entry.screen);
});

test('every route renders its screen from the shipped data without errors',async t=>{
  const mount=setup(t);
  for(const entry of ROUTE_TABLE){
    const {root,titles,screen}=await mount('#'+entry.path);
    assert.equal(root.querySelector('[data-state="error"]'),null,entry.path);
    assert.equal(text(root.querySelector('h1')),expectedHeading(entry),entry.path);
    assert.equal(titles.length,1,entry.path);
    assert.deepEqual(screen.readState(),{dirty:false,saving:false},entry.path);
    for(const link of root.querySelectorAll('a[data-route]'))assert.ok(link.getAttribute('href')==='#'+link.dataset.route,entry.path+' '+link.dataset.route);
    screen.dispose();
  }
});

test('unknown paths render the not-found screen',async t=>{
  const mount=setup(t);
  for(const hash of ['#/nope','#/steps/9','#/missing','#app']){
    const {root}=await mount(hash);assert.equal(text(root.querySelector('h1')),tutorial.screens.notFound.title,hash);
  }
});

test('a failed load shows the error with a retry that recovers',async t=>{
  const mount=setup(t);const content=fakeContent({failures:1});
  t.mock.method(console,'error',()=>{});
  const {root,screen,document}=await mount('#/story',{content});
  const panel=root.querySelector('[data-state="error"]');assert.ok(panel);assert.match(text(panel),new RegExp(SHELL.loadError));
  // The shell must not move focus away from Retry after an error.
  assert.equal(screen.focusTarget(),true);assert.equal(document.activeElement,root.querySelector('button'));
  root.querySelector('button').click();await flush();
  assert.equal(root.querySelector('[data-state="error"]'),null);assert.equal(text(root.querySelector('h1')),tutorial.screens.story.title);
  assert.equal(screen.focusTarget(),false);
});

test('a practice load error also keeps focus on Retry',async t=>{
  const mount=setup(t);t.mock.method(console,'error',()=>{});
  const {root,screen,document}=await mount('#/practice?item=memo',{content:fakeContent({failures:1})});
  assert.ok(root.querySelector('[data-state="error"]'));assert.equal(screen.focusTarget(),true);assert.equal(document.activeElement,root.querySelector('button'));
});

test('retry loads the screen as a new document when the server already runs another build',async t=>{
  const mount=setup(t);t.mock.method(console,'error',()=>{});
  const navigations=[];const router={async navigate(route,options){navigations.push([route,options]);}};
  const changed={refreshes:0,async refresh(){this.refreshes++;return {changed:true,buildId:'sv-newer',status:'available'};}};
  const content=fakeContent({failures:1});
  const {root}=await mount('#/code?view=after',{content,version:changed,router});
  const calls=content.calls.length;assert.ok(root.querySelector('[data-state="error"]'));
  root.querySelector('button').click();await flush();
  assert.equal(changed.refreshes,1);assert.deepEqual(navigations,[['/code?view=after',{replace:true}]]);assert.equal(content.calls.length,calls);
  assert.equal(root.querySelector('button').disabled,false);
  // A pending build seen earlier while the check now fails does not switch documents: Retry loads again.
  const offline={async refresh(){return {changed:true,buildId:'sv-newer',status:'unavailable'};}};
  const second=await mount('#/story',{content:fakeContent({failures:1}),version:offline,router});
  second.root.querySelector('button').click();await flush();
  assert.equal(navigations.length,1);assert.equal(text(second.root.querySelector('h1')),tutorial.screens.story.title);
  // Same build: Retry loads again in place.
  const same={async refresh(){return {changed:false,buildId:null,status:'available'};}};
  const third=await mount('#/story',{content:fakeContent({failures:1}),version:same,router});
  third.root.querySelector('button').click();await flush();
  assert.equal(navigations.length,1);assert.equal(text(third.root.querySelector('h1')),tutorial.screens.story.title);
});

test('a screen disposed while loading never renders the late data',async t=>{
  setup(t);const gate=deferred();const content=fakeContent({gate:gate.promise});
  const route=parseRoute('#/story');const entry=routeFor(route.path);const root=globalThis.document.createElement('main');
  const screen=new SCREENS.story({content,storage:new StorageService({storage:new MemoryStorage()}),toast(){},setTitle(){}},root,route,entry);
  const mounted=screen.mount();screen.dispose();gate.resolve();await mounted;
  assert.equal(root.querySelector('h1'),null);assert.ok(root.querySelector('[data-state="loading"]'));
});

test('the code view query picks a tab and unknown views fall back to before',async t=>{
  const mount=setup(t);
  const current=root=>text(root.querySelector('.view-tab[aria-current="page"]'));
  assert.equal(current((await mount('#/code?view=after')).root),'변경 후');
  assert.equal(current((await mount('#/code?view=parameter')).root),'받은 값 지키기');
  const fallback=(await mount('#/code?view=sideways')).root;assert.equal(current(fallback),'변경 전');
  assert.match(text(fallback),/let memo = order\.price \* order\.cups/);assert.match(text(fallback),/변경 전과 후의 출력이 같아요/);
  // The legend names only the mark kinds shown in that view.
  const legend=root=>root.querySelectorAll('.mark-legend li').map(item=>item.dataset.mark).sort();
  assert.deepEqual(legend(fallback),['keep','smell']);
  assert.deepEqual(legend((await mount('#/code?view=parameter')).root),['new','smell']);
});

test('the cafe-to-code table shows Korean terms as text and only code tokens in code font',async t=>{
  const mount=setup(t);const {root}=await mount('#/code');
  const rows=root.querySelectorAll('.mapping-table tbody tr');assert.equal(rows.length,tutorial.glossary.length);
  // The shipped rows cover both shapes: with a token and without one.
  assert.ok(tutorial.glossary.some(row=>row.token));assert.ok(tutorial.glossary.some(row=>!row.token));
  rows.forEach((row,index)=>{
    const entry=tutorial.glossary[index];const [cafe,term,note]=row.children;
    assert.equal(text(cafe),entry.cafe);assert.equal(text(note),entry.note);
    // The term is the cell's own text; the token, when there is one, is the only code element.
    assert.equal(term.childNodes[0].nodeType,3,entry.cafe);assert.equal(term.childNodes[0].textContent,entry.code);
    assert.deepEqual(term.querySelectorAll('code').map(node=>node.textContent),entry.token?[entry.token]:[],entry.cafe);
    assert.equal(text(term),entry.token?entry.code+' '+entry.token:entry.code);
  });
  for(const node of root.querySelectorAll('.mapping-table code'))assert.doesNotMatch(node.textContent,/[가-힣]/);
  // Data in the earlier shape (no token field) renders as plain text with no code font.
  const earlier=structuredClone(tutorial);
  earlier.glossary=[{cafe:'칸에 적기',code:'대입 (=)',note:'칸에 새 값을 넣는 일'},{cafe:'한 번만 적는 칸',code:'const 변수',note:'다시 대입하면 오류가 나요'}];
  const content={calls:[],async load(name){return structuredClone(name==='tutorial'?earlier:data[name]);}};
  const old=(await mount('#/code',{content})).root;
  assert.equal(old.querySelectorAll('.mapping-table code').length,0);
  assert.deepEqual(old.querySelectorAll('.mapping-table tbody tr').map(row=>text(row.children[1])),['대입 (=)','const 변수']);
});

test('a step screen marks its step and shows that step\'s code',async t=>{
  const mount=setup(t);
  const {root}=await mount('#/steps/3');
  assert.equal(text(root.querySelector('.step-dot[aria-current="step"]')).startsWith('3'),true);
  assert.match(text(root),/todaySales \+= orderAmount;/);
  // The midway memo line is the next one to rename, not a mixed-meaning line.
  const next=root.querySelector('.code-notes li[data-mark="next"]');assert.ok(next);
  assert.match(text(next),/다음에 바꿀 곳/);assert.match(text(next),/let memo = order\.cups \* 2/);
  assert.equal(root.querySelector('.code-notes li[data-mark="smell"]'),null);
  const four=(await mount('#/steps/4')).root;assert.match(text(four),new RegExp(tutorial.ui.sameOutputStep));assert.doesNotMatch(text(four),/변경 전과 후의 출력이 같아요/);
  assert.equal(four.querySelector('.eyebrow span[lang="en"]').textContent,tutorial.screens.steps.eyebrow);
});

test('English eyebrows are marked as English on a Korean page',async t=>{
  const mount=setup(t);
  for(const hash of ['#/','#/story','#/practice','#/code','#/summary','#/nope']){
    const eyebrow=(await mount(hash)).root.querySelector('.eyebrow');assert.equal(eyebrow.getAttribute('lang'),'en',hash);
  }
});

const radio=(root,name,value)=>root.querySelectorAll('input').find(input=>input.getAttribute('name')===name&&input.value===value);
function choose(root,name,value){const input=radio(root,name,value);assert.ok(input,name+'='+value);input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));}
const status=root=>root.querySelector('.save-status');

test('practice answers stay unsaved until the draft is written',async t=>{
  const mount=setup(t);const {screen,root,memory}=await mount('#/practice');
  assert.equal(text(status(root)),'');
  choose(root,'memo-option','split');
  assert.deepEqual(screen.readState(),{dirty:true,saving:false});assert.equal(text(status(root)),practice.copy.unsaved);
  const card=root.querySelector('[data-item="memo"]');assert.equal(card.dataset.status,'followup');assert.equal(card.querySelector('.followup').hidden,false);
  choose(root,'memo-first','amount');choose(root,'memo-second','wait');assert.equal(card.dataset.status,'correct');assert.equal(card.querySelector('.explain').hidden,false);
  const saving=screen.save();assert.equal(screen.readState().saving,true);await saving;
  assert.deepEqual(screen.readState(),{dirty:false,saving:false});assert.equal(status(root).dataset.state,'saved');
  const stored=JSON.parse(memory.getItem(DRAFT_KEY));assert.deepEqual(stored.answers.memo,{option:'split',names:{first:'amount',second:'wait'},reason:null});
  choose(root,'syrup-option','split');assert.equal(screen.readState().dirty,true);
  const syrup=root.querySelector('[data-item="syrup"]');assert.equal(syrup.dataset.status,'wrong');assert.equal(syrup.querySelector('.followup').hidden,true);assert.equal(syrup.querySelector('.explain').hidden,false);
});

test('a failed save keeps the answers unsaved, reports it and can be retried',async t=>{
  const mount=setup(t);const memory=new MemoryStorage();const write=memory.setItem.bind(memory);
  const {screen,root}=await mount('#/practice',{memory});
  choose(root,'today-sales-option','keep');
  memory.setItem=()=>{throw Error('quota');};
  await assert.rejects(screen.save(),/quota/);
  assert.deepEqual(screen.readState(),{dirty:true,saving:false});assert.equal(status(root).dataset.state,'error');assert.equal(text(status(root)),practice.copy.saveError);
  memory.setItem=write;await screen.save();assert.equal(screen.readState().dirty,false);assert.ok(memory.getItem(DRAFT_KEY));
});

test('a saved draft is restored, and a damaged one is kept and reported',async t=>{
  const mount=setup(t);const memory=new MemoryStorage();
  memory.setItem(DRAFT_KEY,JSON.stringify({schema:1,answers:{memo:{option:'split',names:{first:'amount'},reason:null}},note:'메모',savedAt:'2026-11-09T12:00:00.000Z'}));
  const restored=await mount('#/practice',{memory});
  assert.equal(text(restored.root.querySelector('.notice')),practice.copy.restored);assert.equal(radio(restored.root,'memo-option','split').checked,true);assert.equal(radio(restored.root,'memo-first','amount').checked,true);
  assert.equal(restored.root.querySelector('textarea').value,'메모');assert.equal(restored.screen.readState().dirty,false);assert.equal(status(restored.root).dataset.state,'saved');
  const damaged='{"schema":1,"answers":{"memo":{"option":"maybe","names":{},"reason":null}},"note":""}';memory.setItem(DRAFT_KEY,damaged);
  const fresh=await mount('#/practice',{memory});
  assert.equal(text(fresh.root.querySelector('.notice')),practice.copy.loadError);assert.equal(memory.getItem(DRAFT_KEY),damaged);assert.equal(radio(fresh.root,'memo-option','split').checked,false);
});

test('discard waits for a save in flight, then reports clean',async t=>{
  const mount=setup(t);const memory=new MemoryStorage();const gate=deferred();const write=memory.setItem.bind(memory);
  const {screen,root,storage}=await mount('#/practice',{memory});
  choose(root,'memo-option','keep');memory.setItem=(key,value)=>gate.promise.then(()=>write(key,value));
  const saving=screen.save();assert.equal(screen.readState().saving,true);assert.equal(storage.saving,true);
  choose(root,'memo-option','split');
  let discarded=false;const discard=screen.discard().then(()=>{discarded=true;});await flush();assert.equal(discarded,false);
  gate.resolve();await saving;await discard;
  assert.deepEqual(screen.readState(),{dirty:false,saving:false});assert.equal(JSON.parse(memory.getItem(DRAFT_KEY)).answers.memo.option,'keep');
});

test('the note is part of the draft and limited to the maximum length',async t=>{
  const mount=setup(t);const {screen,root}=await mount('#/practice');
  const note=root.querySelector('textarea');assert.equal(note.maxLength,practice.draft.noteMaxLength);
  note.value='오늘 배운 기준';note.dispatchEvent(new Event('input',{bubbles:true}));
  assert.equal(screen.readState().dirty,true);assert.equal(text(root.querySelector('.note-counter')),'8 / 300자');
  note.value='가'.repeat(400);note.dispatchEvent(new Event('input',{bubbles:true}));assert.equal(screen.session.note.length,300);
});

test('grading reports the score and the unanswered count',async t=>{
  const mount=setup(t);const {root,document}=await mount('#/practice');
  choose(root,'syrup-option','keep');choose(root,'syrup-reason','once');choose(root,'memo-option','keep');
  root.querySelectorAll('button').find(button=>text(button)===practice.copy.check).click();
  const result=root.querySelector('.result-panel');assert.equal(result.hidden,false);assert.equal(document.activeElement,result);
  assert.match(text(result),/7문제 중 1문제를 맞혔어요/);assert.match(text(result),/아직 끝내지 않은 문제가 5개 있어요/);
  assert.ok(text(result).includes(practice.copy.scoreRetry));
});

test('grading without wrong answers does not ask to retry wrong ones',async t=>{
  const mount=setup(t);const {root}=await mount('#/practice');
  // The right main answer with the follow-up still open counts as unfinished.
  choose(root,'memo-option','split');
  root.querySelectorAll('button').find(button=>text(button)===practice.copy.check).click();
  const result=text(root.querySelector('.result-panel'));
  assert.match(result,/7문제 중 0문제를 맞혔어요/);assert.match(result,/아직 끝내지 않은 문제가 7개 있어요/);
  assert.ok(result.includes(practice.copy.scoreContinue));assert.ok(!result.includes(practice.copy.scoreRetry));
});

test('#/practice?item= focuses that item, and reset clears answers and the saved draft',async t=>{
  const mount=setup(t);const memory=new MemoryStorage();
  memory.setItem(DRAFT_KEY,JSON.stringify({schema:1,answers:{syrup:{option:'keep',names:{},reason:'once'}},note:'',savedAt:'2026-11-09T12:00:00.000Z'}));
  const {screen,root,document}=await mount('#/practice?item=buzzer-table',{memory});
  assert.equal(screen.focusTarget(),true);assert.equal(text(document.activeElement),'번호 칸');assert.equal(screen.keepsScroll,true);
  await screen.reset();
  assert.equal(memory.getItem(DRAFT_KEY),null);assert.equal(radio(root,'syrup-option','keep').checked,false);assert.equal(screen.readState().dirty,false);
});

test('home shows the resume link only when a draft exists',async t=>{
  const mount=setup(t);const memory=new MemoryStorage();
  assert.equal((await mount('#/',{memory})).root.querySelector('.resume-link').hidden,true);
  memory.setItem(DRAFT_KEY,JSON.stringify({schema:1,answers:{syrup:{option:'keep',names:{},reason:null}},note:'',savedAt:'2026-11-09T12:00:00.000Z'}));
  assert.equal((await mount('#/',{memory})).root.querySelector('.resume-link').hidden,false);
});
