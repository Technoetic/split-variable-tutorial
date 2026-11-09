import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {ContentService,CONTENT_FILES} from '../src/services/content-service.js';
import {validateBundle,validateTutorial,validatePractice,validateCode} from '../src/tutorial/content-model.js';
import {ROUTE_TABLE} from '../src/shared/route-table.js';
import {SHELL} from '../src/shared/shell-copy.js';

const root=new URL('../',import.meta.url);
const read=async name=>readFile(new URL(name,root),'utf8');
const tutorial=JSON.parse(await read('data/tutorial.json'));
const practice=JSON.parse(await read('data/practice.json'));
const code=JSON.parse(await read('data/code.json'));
const response=(value,ok=true)=>({ok,status:ok?200:503,json:async()=>value});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
const titled=title=>({...tutorial,screens:{...tutorial.screens,home:{...tutorial.screens.home,title}}});

test('each data file loads through an absolute, uncached app-base URL',async()=>{
  const seen=[];
  const content=new ContentService({baseUrl:'https://example.test/split-variable-tutorial/',fetcher:async(url,options)=>{
    seen.push(String(url));assert.equal(options.cache,'no-store');assert.ok(options.signal);
    const file=String(url).split('/split-variable-tutorial/')[1];return response({'data/tutorial.json':tutorial,'data/practice.json':practice,'data/code.json':code}[file]);
  }});
  assert.equal((await content.load('tutorial')).meta.appTitle,'SPLIT / VARIABLE');
  assert.equal((await content.load('practice')).items.length,7);
  assert.equal((await content.load('code')).examples.length,2);
  assert.deepEqual(seen,Object.values(CONTENT_FILES).map(file=>'https://example.test/split-variable-tutorial/'+file));
  await assert.rejects(content.load('secrets'),/Unknown content/);
});

test('HTTP, malformed JSON, invalid shape and timeout failures show a message and allow a retry',async()=>{
  const broken=structuredClone(tutorial);broken.screens.smell.answer='t9';
  const failures=[async()=>response(tutorial,false),async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('Unexpected token');}}),async()=>response(broken),async()=>response({schema:2}),()=>new Promise(()=>{})];
  for(const fetcher of failures){
    const content=new ContentService({baseUrl:'https://example.test/app/',fetcher,timeoutMs:8});
    const error=await content.load('tutorial').then(()=>null,value=>value);
    assert.ok(error);assert.ok([SHELL.loadError,SHELL.loadTimeout].includes(error.userMessage));assert.ok(['http','format','timeout'].includes(error.kind));
    content.fetcher=async()=>response(titled('retry'));assert.equal((await content.load('tutorial')).screens.home.title,'retry');
  }
});

test('a superseded request for the same file is cancelled promptly even when fetch ignores abort',async()=>{
  const gates=[deferred(),deferred()];let requests=0;let firstError;
  const content=new ContentService({baseUrl:'https://example.test/app/',fetcher:()=>gates[requests++].promise});
  const first=content.load('tutorial').catch(error=>{firstError=error;});const second=content.load('tutorial');gates[1].resolve(response(titled('new')));
  try{assert.equal((await second).screens.home.title,'new');await flush();assert.equal(firstError?.name,'AbortError');}
  finally{gates[0].resolve(response(titled('old')));await first;}
});

test('an old delayed JSON body cannot return after a newer load finished',async()=>{
  const body=deferred();let requests=0;
  const content=new ContentService({baseUrl:'https://example.test/app/',fetcher:async()=>++requests===1?{ok:true,status:200,json:()=>body.promise}:response(titled('new'))});
  const first=content.load('tutorial');const rejected=assert.rejects(first,{name:'AbortError'});await flush();
  assert.equal((await content.load('tutorial')).screens.home.title,'new');body.resolve(titled('old'));await rejected;
});

test('screen cancellation rejects active data and a pre-aborted signal starts no fetch',async()=>{
  const controller=new AbortController();const gate=deferred();let requests=0;
  const content=new ContentService({baseUrl:'https://example.test/app/',fetcher:()=>{requests++;return gate.promise;}});
  const active=content.load('tutorial',{signal:controller.signal});const rejected=assert.rejects(active,{name:'AbortError'});controller.abort();await rejected;
  await assert.rejects(content.load('tutorial',{signal:controller.signal}),{name:'AbortError'});assert.equal(requests,1);gate.resolve(response(tutorial));
});

test('different files load side by side without cancelling each other',async()=>{
  const gates={tutorial:deferred(),code:deferred()};
  const content=new ContentService({baseUrl:'https://example.test/app/',fetcher:url=>String(url).endsWith('code.json')?gates.code.promise:gates.tutorial.promise});
  const both=Promise.all([content.load('tutorial'),content.load('code')]);
  gates.code.resolve(response(code));gates.tutorial.resolve(response(tutorial));
  const [first,second]=await both;assert.equal(first.meta.repository,'split-variable-tutorial');assert.equal(second.examples[0].id,'main');
});

test('shipped data passes the cross-file checks (routes, step edit chain, marks, sources)',()=>{
  assert.doesNotThrow(()=>validateBundle({tutorial,practice,code}));
  for(const [validate,value,mutate] of [
    [validateTutorial,tutorial,value=>{value.routes=value.routes.filter(route=>route.path!=='/steps/4');}],
    [validateTutorial,tutorial,value=>{value.screens.steps.items[1].n=3;}],
    [validateTutorial,tutorial,value=>{value.screens.home.primaryCta.route='/nowhere';}],
    [validateTutorial,tutorial,value=>{value.meta.sourceUrl='http://refactoring.com/catalog/splitVariable.html';}],
    [validatePractice,practice,value=>{value.items[0].answer='merge';}],
    [validatePractice,practice,value=>{delete value.items[1].feedback.keep;}],
    [validatePractice,practice,value=>{value.items[1].followUp.accept=['unknown'];}],
    [validateCode,code,value=>{value.examples[0].stages[0].marks[0].line=1;}]
  ]){const copy=structuredClone(value);mutate(copy);assert.throws(()=>validate(copy),/Invalid content/);}
});

test('glossary rows keep a Korean term and take an optional code token without Korean',()=>{
  assert.deepEqual(tutorial.glossary.filter(row=>row.token).map(row=>[row.code,row.token]),[['대입','='],['한 번만 대입하는 변수','const'],['누적 변수','+='],['반복 변수','for…of']]);
  // The earlier row shape (no token; the term carried the code) still validates.
  const earlier=structuredClone(tutorial);earlier.glossary=earlier.glossary.map(({token,...row})=>row);earlier.glossary[1].code='대입 (=)';
  assert.doesNotThrow(()=>validateTutorial(earlier));
  for(const token of ['변수','const 변수','',' ','x'.repeat(21),null,3]){
    const copy=structuredClone(tutorial);copy.glossary[1].token=token;
    assert.throws(()=>validateTutorial(copy),/Invalid content at tutorial\.glossary\[1\]\.token/,JSON.stringify(token));
  }
  const missing=structuredClone(tutorial);delete missing.glossary[0].code;
  assert.throws(()=>validateTutorial(missing),/Invalid content at tutorial\.glossary\[0\]\.code/);
});

test('data routes match the app screen table and chain prev/next both ways',()=>{
  assert.deepEqual(tutorial.routes.map(route=>[route.path,route.screen,route.step??null]),ROUTE_TABLE.map(entry=>[entry.path,entry.screen,entry.step??null]));
  const byPath=new Map(tutorial.routes.map(route=>[route.path,route]));
  for(const route of tutorial.routes){
    if(route.next&&route.next!=='/'&&route.path!=='/missing')assert.equal(byPath.get(route.next).prev,route.path,route.path+' -> '+route.next);
  }
  assert.deepEqual(tutorial.screens.steps.items.map(item=>item.path),['/steps/1','/steps/2','/steps/3','/steps/4','/steps/5']);
});

test('shell copy, index.html and data ui strings agree',async()=>{
  const html=await read('index.html');const ui=tutorial.ui;
  for(const key of ['loading','loadError','loadTimeout','retry','startError','navError','updateBanner'])assert.equal(SHELL[key],ui[key],key);
  for(const key of ['description','descriptionUpdate','saveError'])assert.equal(SHELL.guard[key],ui.guard[key],key);
  for(const text of [ui.skipLink,ui.navLabel,ui.noscript,ui.buildLabel,ui.loading,ui.slowHint,ui.guard.eyebrow,ui.guard.title,ui.guard.description,ui.guard.save,ui.guard.stay,ui.guard.discard,tutorial.meta.htmlTitle,tutorial.meta.description,tutorial.meta.footerMotto,tutorial.meta.footerSource,tutorial.meta.sourceUrl])assert.ok(html.includes(text),text);
  const links=[...html.matchAll(/<a(?: class="(nav-extra)")? href="#([^"]+)" data-route="([^"]+)">([^<]+)<\/a>/g)].map(match=>({extra:!!match[1],path:match[3],label:match[4]}));
  assert.deepEqual(links.map(link=>({path:link.path,label:link.label})),tutorial.nav);
  assert.deepEqual(links.filter(link=>!link.extra).map(link=>link.path),tutorial.navPrimary);
});

test('Korean text survives in every data file and nothing uses CRLF',async()=>{
  const files=['data/tutorial.json','data/practice.json','data/code.json','index.html','README.md'];
  for(const file of files){
    const text=await read(file);
    assert.ok(/[가-힣]/.test(text),file+' has Hangul');assert.ok(!text.includes(String.fromCharCode(0xfffd)),file+' has no replacement characters');assert.ok(!text.includes('\r'),file+' uses LF');
  }
  const strings=[];const walk=value=>{if(typeof value==='string')strings.push(value);else if(value&&typeof value==='object')Object.values(value).forEach(walk);};
  walk(tutorial);walk(practice);
  assert.ok(strings.filter(text=>/[가-힣]/.test(text)).length>300);
});

test('the catalog page is the cited source and no data file claims endorsement',()=>{
  assert.equal(tutorial.meta.sourceUrl,'https://refactoring.com/catalog/splitVariable.html');assert.equal(tutorial.meta.citedAuthor,'Martin Fowler');
  assert.ok(tutorial.screens.summary.sources.some(source=>source.url===tutorial.meta.sourceUrl));
  assert.match(tutorial.screens.summary.independence,/관계없는/);
});

test('source files keep LF line endings',async()=>{
  const roots=['src','scripts','tests','src/screens','src/services','src/shared','src/tutorial','src/styles'];
  for(const folder of roots){
    for(const name of await readdir(new URL(folder+'/',root))){
      if(!/\.(m?js|css)$/.test(name))continue;
      assert.ok(!(await read(folder+'/'+name)).includes('\r'),folder+'/'+name);
    }
  }
});
