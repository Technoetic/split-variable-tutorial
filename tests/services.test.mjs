import test from 'node:test';
import assert from 'node:assert/strict';
import {VersionService} from '../src/services/version-service.js';
import {Router} from '../src/services/router.js';
import {PreferenceService,PREFS_KEY} from '../src/services/preference-service.js';
import {parseRoute,routeUrl} from '../src/shared/routes.js';
import {ROUTE_TABLE,routeFor} from '../src/shared/route-table.js';
import {fill} from '../src/shared/format.js';
import {el} from '../src/shared/dom.js';

const response=(value,ok=true)=>({ok,status:ok?200:503,json:async()=>value});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};

test('loaded identity is required and cannot be initialized by a fresh server response',async()=>{
  assert.throws(()=>new VersionService({baseUrl:'https://example.test/app/'}));
  const service=new VersionService({baseUrl:'https://example.test/app/',loadedBuild:'A01',fetcher:async()=>response({buildId:'B01'})});
  assert.equal((await service.navigation('#/story',()=>({dirty:false,saving:false}))).kind,'reload');
  assert.equal(service.loadedBuild,'A01');assert.equal(service.pendingBuild,'B01');
});

test('rollback counts as a change and a network failure keeps the observed update',async()=>{
  let offline=false;
  const service=new VersionService({baseUrl:'https://example.test/app/',loadedBuild:'B01',fetcher:async()=>{if(offline)throw Error('offline');return response({buildId:'A01'});}});
  assert.equal((await service.navigation('#/',()=>({dirty:false,saving:false}))).kind,'reload');
  offline=true;await service.refresh();assert.equal(service.pendingBuild,'A01');assert.equal(service.status,'unavailable');
});

test('an edit or save started during a version check protects the destination',async()=>{
  for(const field of ['dirty','saving']){
    const gate=deferred();const state={dirty:false,saving:false};
    const service=new VersionService({baseUrl:'https://example.test/app/',loadedBuild:'A01',fetcher:()=>gate.promise});
    const decision=service.navigation('#/code',()=>state);state[field]=true;gate.resolve(response({buildId:'B01'}));
    assert.equal((await decision).kind,'protect');
  }
});

test('failed, malformed and timed-out version checks keep clean navigation usable',async()=>{
  for(const fetcher of [async()=>response({},false),async()=>response({buildId:''}),async()=>response({buildId:'../evil'}),async()=>{throw Error('offline');},()=>new Promise(()=>{})]){
    const service=new VersionService({baseUrl:'https://example.test/app/',loadedBuild:'A01',fetcher,timeoutMs:8});
    assert.equal((await service.navigation('#/story',()=>({dirty:false,saving:false}))).kind,'spa');
    assert.equal(service.loadedBuild,'A01');assert.equal(service.status,'unavailable');assert.ok(service.lastError);
  }
});

test('version requests use the absolute app subpath, bypass the cache and retry after failure',async()=>{
  let calls=0;
  const service=new VersionService({baseUrl:'https://example.test/split-variable-tutorial/',loadedBuild:'A01',fetcher:async(url,options)=>{
    assert.equal(String(url),'https://example.test/split-variable-tutorial/version.json');assert.equal(options.cache,'no-store');assert.ok(options.signal);
    return response({buildId:++calls===1?'':'A01'});
  }});
  await service.refresh();assert.equal(service.status,'unavailable');await service.refresh();assert.equal(service.status,'available');assert.equal(service.lastError,null);
});

test('overlapping version checks share one request',async()=>{
  const gate=deferred();let calls=0;
  const service=new VersionService({baseUrl:'https://example.test/app/',loadedBuild:'A01',fetcher:()=>{calls++;return gate.promise;}});
  const first=service.refresh(),second=service.refresh();gate.resolve(response({buildId:'B01'}));
  await Promise.all([first,second]);assert.equal(calls,1);assert.equal(service.pendingBuild,'B01');
});

test('hash routes keep queries, cannot escape the document and map to screens',()=>{
  assert.equal(parseRoute('#/code?view=after').path,'/code');assert.equal(parseRoute('#/code?view=after').params.get('view'),'after');
  assert.equal(parseRoute('#/steps/3').path,'/steps/3');assert.equal(parseRoute('').path,'/');
  for(const route of ['https://evil.test/','//evil.test/','/\\evil','app'])assert.equal(parseRoute(route).path,'/missing');
  const target=routeUrl('/practice?item=memo','https://example.test/split-variable-tutorial/');assert.equal(target.href,'https://example.test/split-variable-tutorial/#/practice?item=memo');
  assert.equal(routeUrl('/unknown','https://example.test/app/').hash,'#/unknown');
  assert.equal(routeFor('/steps/5').screen,'step');assert.equal(routeFor('/steps/5').step,5);
  for(const unknown of ['/steps/6','/steps/','/nope','/missing'])assert.equal(routeFor(unknown).screen,'notFound');
  assert.equal(new Set(ROUTE_TABLE.map(entry=>entry.path)).size,ROUTE_TABLE.length);
});

// These doubles model only browser-owned history/events; routing and version logic remain real.
function browser(t,{hashes=['#/story','#/practice'],position=hashes.length-1,build='A01',fetcher,dirty=false,onProtect=async()=>false,onUpdate=()=>{}}={}){
  const events=new EventTarget();const document=new EventTarget();document.hidden=false;
  const entries=hashes.map((hash,index)=>({url:'https://example.test/app/'+hash,state:{splitVariable:{key:'session-one',index}}}));
  let cursor=position,current=new URL(entries[cursor].url),isDirty=dirty,isSaving=false;
  const documents=[],rendered=[],errors=[],traversals=[];
  const location={get href(){return current.href;},get hash(){return current.hash;},assign:url=>documents.push({kind:'assign',url:new URL(url)}),replace:url=>documents.push({kind:'replace',url:new URL(url)})};
  const history={get state(){return entries[cursor].state;},replaceState:(state,unused,url)=>{current=new URL(url);entries[cursor]={url:current.href,state};},pushState:(state,unused,url)=>{current=new URL(url);entries.splice(cursor+1);entries.push({url:current.href,state});cursor++;},go:delta=>traversals.push(delta)};
  const globals={addEventListener:events.addEventListener.bind(events),document,location,history};
  const originals=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const version=new VersionService({baseUrl:'https://example.test/app/',loadedBuild:'A01',fetcher:fetcher||(async()=>response({buildId:build}))});
  const router=new Router({baseUrl:'https://example.test/app/',version,readState:()=>({dirty:isDirty,saving:isSaving}),onNavigate:async route=>rendered.push(route.path),onProtect:args=>onProtect(args,()=>{isDirty=false;isSaving=false;}),onUpdate:()=>onUpdate({setDirty:value=>{isDirty=value;},setSaving:value=>{isSaving=value;}}),onError:error=>errors.push(error)});
  const traverse=(index,{emitHash=true,emitPop=true}={})=>{assert.ok(index>=0&&index<entries.length);cursor=index;current=new URL(entries[cursor].url);if(emitPop)events.dispatchEvent(new Event('popstate'));if(emitHash)events.dispatchEvent(new Event('hashchange'));};
  const flushOneHistory=async()=>{const delta=traversals.shift();assert.notEqual(delta,undefined);traverse(cursor+delta);await flush();};
  const flushHistory=async()=>{for(let count=0;traversals.length&&count<12;count++)await flushOneHistory();};
  t.after(()=>{router.dispose();for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  return {router,version,location,history,documents,rendered,errors,events,document,traversals,traverse,flushHistory,flushOneHistory,setDirty:value=>{isDirty=value;},setSaving:value=>{isSaving=value;},get cursor(){return cursor;}};
}

test('clean navigation with an unchanged build stays in the document and pushes history',async t=>{
  const app=browser(t);await app.router.navigate('/steps/2');
  assert.deepEqual(app.documents,[]);assert.deepEqual(app.rendered,['/steps/2']);assert.equal(app.location.hash,'#/steps/2');assert.equal(app.history.state.splitVariable.index,2);
});

test('changed clean links force a new document URL with a random query and the intended fragment',async t=>{
  const app=browser(t,{build:'B01'});await app.router.navigate('/steps/3');assert.equal(app.documents.length,1);
  const first=app.documents[0];assert.equal(first.kind,'assign');assert.equal(first.url.pathname,'/app/');assert.equal(first.url.hash,'#/steps/3');assert.ok(first.url.searchParams.get('_sv')?.startsWith('B01-'));
  await app.router.navigate('/code');assert.notEqual(app.documents[1].url.search,first.url.search);assert.equal(app.history.state.splitVariable.key,'session-one');
});

test('changed Back replaces the traversed entry as a document and keeps the intended route',async t=>{
  const app=browser(t,{build:'B01'});app.traverse(0);await flush();assert.equal(app.documents.length,1);assert.equal(app.documents[0].kind,'replace');assert.equal(app.documents[0].url.hash,'#/story');assert.ok(app.documents[0].url.searchParams.has('_sv'));
});

test('cancel after Back and a new link during lookup restores the displayed route and history index',async t=>{
  const lookup=deferred();let protects=0;const app=browser(t,{dirty:true,fetcher:()=>lookup.promise,onProtect:async()=>{protects++;return false;}});
  app.traverse(0);const clicked=app.router.navigate('/code');await flush();await app.flushHistory();lookup.resolve(response({buildId:'A01'}));await clicked;await flush();
  assert.equal(protects,1);assert.equal(app.location.hash,'#/practice');assert.equal(app.router.index,1);assert.equal(app.history.state.splitVariable.index,1);assert.deepEqual(app.rendered,[]);assert.deepEqual(app.errors,[]);
});

test('discard after a superseded Back keeps the original entry before the new route',async t=>{
  const lookup=deferred();const app=browser(t,{dirty:true,fetcher:()=>lookup.promise,onProtect:async(args,discard)=>{discard();return true;}});
  app.traverse(0);const clicked=app.router.navigate('/code');await flush();await app.flushHistory();lookup.resolve(response({buildId:'A01'}));await clicked;await flush();
  assert.equal(app.location.hash,'#/code');assert.equal(app.router.index,2);assert.equal(app.cursor,2);assert.deepEqual(app.rendered,['/code']);
  app.traverse(1);await flush();assert.equal(app.location.hash,'#/practice');assert.deepEqual(app.rendered,['/code','/practice']);assert.deepEqual(app.errors,[]);
});

test('a delayed duplicate history event does not render the same traversal twice',async t=>{
  const app=browser(t);app.traverse(0,{emitHash:false});await flush();app.events.dispatchEvent(new Event('hashchange'));await flush();assert.deepEqual(app.rendered,['/story']);assert.deepEqual(app.errors,[]);
});

test('a new edit after the update notice still protects the final transition',async t=>{
  let protects=0;const app=browser(t,{build:'B01',onUpdate:controls=>controls.setDirty(true),onProtect:async()=>{protects++;return false;}});
  await app.router.navigate('/code');assert.equal(protects,1);assert.deepEqual(app.documents,[]);assert.deepEqual(app.rendered,[]);
});

test('a save in flight blocks the transition even when the answers are clean',async t=>{
  let protects=0;const app=browser(t,{build:'B01',onProtect:async()=>{protects++;return false;}});app.setSaving(true);
  await app.router.navigate('/code');assert.equal(protects,1);assert.deepEqual(app.documents,[]);
});

test('saving from the dialog lets the next transition load the new build',async t=>{
  let protects=0;const app=browser(t,{build:'B01',dirty:true,onProtect:async(args,clear)=>{protects++;assert.equal(args.changed,true);clear();return true;}});
  await app.router.navigate('/summary');assert.equal(protects,1);assert.equal(app.documents.length,1);assert.equal(app.documents[0].url.hash,'#/summary');
});

test('focus, pageshow and visibility return check updates without a background reload',async t=>{
  const app=browser(t,{build:'B01'});app.events.dispatchEvent(new Event('focus'));await flush();assert.equal(app.version.pendingBuild,'B01');assert.deepEqual(app.documents,[]);
  app.events.dispatchEvent(new Event('pageshow'));await flush();app.document.dispatchEvent(new Event('visibilitychange'));await flush();assert.deepEqual(app.documents,[]);assert.deepEqual(app.rendered,[]);
});

test('a version check failure keeps navigation in the current document without a reload loop',async t=>{
  const app=browser(t,{fetcher:async()=>{throw Error('offline');}});
  await app.router.navigate('/code');await app.router.navigate('/summary');
  assert.deepEqual(app.documents,[]);assert.deepEqual(app.rendered,['/code','/summary']);assert.equal(app.version.status,'unavailable');
});

test('a late edit on approved Back still restores history when a newer link is cancelled',async t=>{
  const lookup=deferred();let requests=0,protects=0;const app=browser(t,{dirty:true,fetcher:()=>++requests>=3?lookup.promise:Promise.resolve(response({buildId:'A01'})),onProtect:async(args,discard)=>{protects++;if(protects===1){discard();return true;}return false;}});
  app.traverse(0);await flush();await app.flushOneHistory();app.setDirty(true);await app.flushOneHistory();
  const clicked=app.router.navigate('/code');await flush();await app.flushHistory();lookup.resolve(response({buildId:'A01'}));await clicked;await flush();
  assert.equal(protects,2);assert.equal(app.location.hash,'#/practice');assert.equal(app.router.index,1);assert.equal(app.history.state.splitVariable.index,1);assert.deepEqual(app.rendered,[]);assert.deepEqual(app.errors,[]);
});

test('display preferences survive blocked storage and reject unknown values',()=>{
  const memory=new Map();const storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
  const prefs=new PreferenceService({storage});assert.equal(prefs.theme,'auto');assert.equal(prefs.nextTheme(),'light');
  prefs.set('theme','dark');prefs.set('motion','reduce');assert.deepEqual(JSON.parse(memory.get(PREFS_KEY)),{theme:'dark',motion:'reduce'});
  assert.equal(new PreferenceService({storage}).theme,'dark');assert.throws(()=>prefs.set('theme','neon'));
  const blocked=new PreferenceService({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}});
  assert.equal(blocked.theme,'auto');assert.doesNotThrow(()=>blocked.set('theme','light'));assert.equal(blocked.theme,'light');
  memory.set(PREFS_KEY,'{broken');assert.equal(new PreferenceService({storage}).theme,'auto');
  const element={dataset:{}};prefs.apply(element);assert.equal(element.dataset.theme,'dark');assert.equal(element.dataset.motion,'reduce');
});

test('text tokens fill known names and leave unknown ones visible',()=>{
  assert.equal(fill('{n} / {total}단계',{n:2,total:5}),'2 / 5단계');assert.equal(fill('{n}행 {x}',{n:3}),'3행 {x}');
});

test('DOM helper treats hostile dynamic text as text and binds explicit events',t=>{
  class Node {
    constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.textContent='';this.events={};this.dataset={};}
    setAttribute(name,value){this.attrs[name]=String(value);}
    addEventListener(name,fn){this.events[name]=fn;}
    append(...children){this.children.push(...children);}
  }
  const original=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:tag=>new Node(tag),createTextNode:value=>({textContent:String(value)})}});
  t.after(()=>{if(original)Object.defineProperty(globalThis,'document',original);else delete globalThis.document;});
  let clicked=false;const node=el('button',{className:'btn',textContent:'<img onerror=alert(1)>',onclick:()=>{clicked=true;},disabled:true,'aria-label':'move','data-route':'/story'});
  assert.equal(node.textContent,'<img onerror=alert(1)>');assert.equal(node.innerHTML,undefined);assert.equal(node.className,'btn');assert.equal(node.disabled,true);assert.equal(node.attrs['aria-label'],'move');assert.equal(node.attrs['data-route'],'/story');node.events.click();assert.equal(clicked,true);
  const parent=el('div',{},['hello',el('span',{textContent:'world'}),null,false]);assert.equal(parent.children.length,2);assert.equal(parent.children[0].textContent,'hello');
});
