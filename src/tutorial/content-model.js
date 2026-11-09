// Shape checks for the three data files. The build runs them (plus the cross-file
// checks in validateBundle) and the app runs them on every load, so a bad data-only
// update shows an error with retry instead of a broken screen.
import {ROUTE_TABLE,STEP_COUNT} from '../shared/route-table.js';
import {parseRoute} from '../shared/routes.js';
import {applyEdits,findExample,findStage,replaySteps,resolveFocus,sourceLines} from './code-model.js';

export class ContentError extends Error {
  constructor(path,detail=''){super('Invalid content at '+path+(detail?' ('+detail+')':''));this.name='ContentError';this.path=path;}
}
const fail=(path,detail)=>{throw new ContentError(path,detail);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

function check(value,schema,path){
  if(typeof schema==='function'){schema(value,path);return;}
  if(!plain(value))fail(path,'object expected');
  for(const [key,sub] of Object.entries(schema))check(value[key],sub,path+'.'+key);
}
const T=(max=600)=>(value,path)=>{if(typeof value!=='string'||!value.trim()||value.length>max)fail(path,'text expected');};
const TE=(max=600)=>(value,path)=>{if(typeof value!=='string'||value.length>max)fail(path,'text expected');};
const opt=schema=>(value,path)=>{if(value!==undefined)check(value,schema,path);};
const nul=schema=>(value,path)=>{if(value!==null)check(value,schema,path);};
const list=(schema,min=1,max=64)=>(value,path)=>{
  if(!Array.isArray(value)||value.length<min||value.length>max)fail(path,`list of ${min}-${max} expected`);
  value.forEach((item,index)=>check(item,schema,`${path}[${index}]`));
};
const oneOf=(...values)=>(value,path)=>{if(!values.includes(value))fail(path,'one of '+values.join('|'));};
const int=(min,max)=>(value,path)=>{if(!Number.isInteger(value)||value<min||value>max)fail(path,'integer expected');};
const bool=(value,path)=>{if(typeof value!=='boolean')fail(path,'boolean expected');};
const ID=(value,path)=>{if(typeof value!=='string'||!/^[a-z\d][a-z\d-]{0,40}$/.test(value))fail(path,'id expected');};
const HTTPS=(value,path)=>{T(300)(value,path);let url;try{url=new URL(value);}catch{fail(path,'url expected');}if(url.protocol!=='https:')fail(path,'https url expected');};
const SCREEN_PATHS=new Set(ROUTE_TABLE.map(entry=>entry.path));
const ROUTE=(value,path)=>{T(120)(value,path);const parsed=parseRoute(value);if(!SCREEN_PATHS.has(parsed.path)||(parsed.path==='/missing'&&value!=='/missing'))fail(path,'known route expected');};
const unique=(values,path)=>{if(new Set(values).size!==values.length)fail(path,'ids must be unique');};
const keysEqual=(object,ids,path)=>{if(!plain(object))fail(path,'object expected');const keys=Object.keys(object).sort();const wanted=[...ids].sort();if(keys.length!==wanted.length||keys.some((key,index)=>key!==wanted[index]))fail(path,'feedback for every option expected');Object.entries(object).forEach(([key,value])=>T()(value,path+'.'+key));};

const SLOT_STATES=['printed','empty','written','overwritten','unclear','mixed','new','kept'];
const SLOT=(value,path)=>{
  check(value,{id:ID,label:T(40),state:oneOf(...SLOT_STATES),meaning:opt(T(40)),previous:opt(T(40)),highlight:opt(bool)},path);
  if(value.state==='mixed')check(value.writes,list({mark:T(4),value:T(40),meaning:T(40)},1,6),path+'.writes');
  else check(value.value,value.state==='empty'?TE(40):T(40),path+'.value');
  if(value.state==='overwritten'&&value.previous===undefined)fail(path+'.previous','overwritten slots keep the previous value');
};
const LINK={label:T(80),route:ROUTE};
const BOARD={id:ID,label:T(40),value:T(40)};
const EDIT={from:T(300),to:T(300)};
const FRAME={id:ID,title:T(120),body:T(400),slots:list(SLOT,1,8),board:opt(list(BOARD,1,4)),link:opt(LINK)};
const HEAD={eyebrow:T(80),title:T(120)};
const QUIZ=(value,path)=>{
  check(value,{question:T(),options:list({id:ID,label:T(160)},2,6),answer:ID},path);
  const ids=value.options.map(option=>option.id);unique(ids,path+'.options');
  if(!ids.includes(value.answer))fail(path+'.answer','answer must be an option');
  keysEqual(value.feedback,ids,path+'.feedback');
};
const STEP={n:int(1,STEP_COUNT),path:ROUTE,title:T(120),body:T(),codeNote:opt(T()),check:T(),slots:list(SLOT,1,6),reads:opt(list({from:T(40),to:T(40)},1,4)),
  code:{example:ID,stage:nul(ID),edits:list(EDIT,0,8),focus:list({contains:T(160),note:T(160)},0,8),showOutput:opt(bool),compareWith:opt(ID)}};
const UI={skipLink:T(),navLabel:T(),stepNavLabel:T(),prev:T(),next:T(),stepProgress:T(),loading:T(),slowHint:T(),loadError:T(),loadTimeout:T(),retry:T(),startError:T(),navError:T(),noscript:T(),buildLabel:T(),updateBanner:T(),
  guard:{eyebrow:T(),title:T(),description:T(),descriptionUpdate:T(),save:T(),stay:T(),discard:T(),saveError:T()},
  correctTag:T(),wrongTag:T(),codePeek:T(),codeNoteLabel:T(),sameOutputStep:T(),checkLabel:T(),editsLabel:T(),removedLine:T(),addedLine:T(),focusLabel:T(),marksTitle:T(),lineLabel:T(),stepListLabel:T(),frameLabel:T(),pagerLabel:T(),
  mappingHeaders:{cafe:T(),code:T(),note:T()},
  visual:{slipTitle:T(),boardTitle:T(),empty:T(),meaning:T(),previous:T(),writes:T(),reads:T(),states:Object.fromEntries(['empty','written','overwritten','unclear','mixed','new','kept'].map(state=>[state,T(40)]))}};
const SCREENS={
  home:{...HEAD,lead:T(),primaryCta:LINK,secondaryCta:LINK,meta:T(),resumeLabel:T(),cards:list({label:T(80),title:T(120),body:T()},1,6),note:T(),
    hero:{caption:T(),before:{label:T(80),slots:list(SLOT,1,4)},after:{label:T(80),slots:list(SLOT,1,4)}}},
  story:{...HEAD,lead:T(),frames:list(FRAME,1,12),takeaway:T()},
  smell:(value,path)=>{
    check(value,{...HEAD,lead:T(),timeline:list({id:ID,action:oneOf('write','read'),text:T(200),meaning:opt(T(40))},2,10),actionLabels:{write:T(40),read:T(40)},question:T(),answer:ID,
      whatIf:{title:T(120),body:T()},signsTitle:T(120),signs:list(T(),1,10),notSmell:T()},path);
    const ids=value.timeline.map(entry=>entry.id);unique(ids,path+'.timeline');
    if(!ids.includes(value.answer))fail(path+'.answer','answer must be a timeline entry');
    keysEqual(value.feedback,ids,path+'.feedback');
  },
  steps:(value,path)=>{
    check(value,{...HEAD,lead:T(),cta:LINK,note:T(),items:list(STEP,STEP_COUNT,STEP_COUNT)},path);
    value.items.forEach((item,index)=>{if(item.n!==index+1||item.path!=='/steps/'+(index+1))fail(`${path}.items[${index}]`,'steps must be numbered in order');});
  },
  exceptions:{...HEAD,lead:T(),cards:list({id:ID,tag:T(20),title:T(80),body:T(),trail:list(T(40),1,8),code:T(160)},1,6),quiz:QUIZ,rule:{title:T(80),items:list(T(),1,8)},sourceNote:T(),sourceRef:ID},
  parameter:{...HEAD,lead:T(),frames:list(FRAME,1,8),analogy:T(),codeNote:{title:T(80),body:T()},code:{example:ID,edits:list(EDIT,1,8)},link:LINK},
  practice:{...HEAD,lead:T(),dataFile:opt(T(80))},
  code:(value,path)=>{
    check(value,{...HEAD,lead:T(),dataFile:opt(T(80)),views:list({id:ID,label:T(40),example:ID,stages:list(ID,1,4)},1,6),defaultView:ID,outputLabel:T(40),sameOutput:T(),runHint:T(),mappingTitle:T(80),constNote:T(),loopNote:T(),scopeNote:T()},path);
    const ids=value.views.map(view=>view.id);unique(ids,path+'.views');
    if(!ids.includes(value.defaultView))fail(path+'.defaultView','default view must exist');
  },
  summary:(value,path)=>{
    check(value,{...HEAD,checklist:list(T(),1,12),sourcesTitle:T(80),sources:list({id:ID,label:T(200),url:HTTPS,note:T()},1,8),aliasesLine:T(),originality:T(),independence:T(),ctas:list(LINK,1,4)},path);
    unique(value.sources.map(source=>source.id),path+'.sources');
  },
  notFound:{...HEAD,body:T(),ctas:list(LINK,1,4)}
};

export function validateTutorial(value){
  check(value,{schema:oneOf(1),
    meta:{lang:oneOf('ko'),appTitle:T(80),htmlTitle:T(160),description:T(300),brand:{left:T(20),right:T(20)},tagline:T(120),footerMotto:T(120),footerSource:T(200),repository:ID,publicUrl:HTTPS,sourceUrl:HTTPS,citedAuthor:T(80)},
    routes:list({path:ROUTE,screen:T(40),step:opt(int(1,STEP_COUNT)),title:T(80),navLabel:nul(T(40)),prev:nul(ROUTE),next:nul(ROUTE)},1,40),
    nav:list({path:ROUTE,label:T(40)},1,12),navPrimary:list(ROUTE,1,12),ui:UI,glossary:list({cafe:T(40),code:T(40),note:T(160)},1,20),screens:SCREENS},'tutorial');
  const routes=value.routes.map(route=>route.path);unique(routes,'tutorial.routes');
  for(const entry of ROUTE_TABLE){
    const route=value.routes.find(item=>item.path===entry.path);
    if(!route||route.screen!==entry.screen||(entry.step??null)!==(route.step??null))fail('tutorial.routes','every app screen needs a matching route ('+entry.path+')');
  }
  if(value.navPrimary.some(path=>!value.nav.some(item=>item.path===path)))fail('tutorial.navPrimary','primary links must be in nav');
  if(!value.screens.summary.sources.some(source=>source.id===value.screens.exceptions.sourceRef))fail('tutorial.screens.exceptions.sourceRef','unknown source');
  return value;
}

const FOLLOW_UP=(value,path)=>{
  if(!plain(value))fail(path,'object expected');
  if(value.type==='names'){
    check(value,{prompt:T(),slots:list({id:ID,forValue:T(40),options:list({id:ID,label:T(60)},2,6),answer:ID},1,4),feedback:{correct:T(),wrong:T()}},path);
    unique(value.slots.map(slot=>slot.id),path+'.slots');
    value.slots.forEach((slot,index)=>{const ids=slot.options.map(option=>option.id);unique(ids,`${path}.slots[${index}].options`);if(!ids.includes(slot.answer))fail(`${path}.slots[${index}].answer`,'answer must be an option');});
  }else if(value.type==='reason')check(value,{prompt:T(),accept:list(ID,1,4),feedback:{correct:T(),wrong:T()}},path);
  else fail(path+'.type','names or reason expected');
};
const PRACTICE_COPY=['noteLabel','notePlaceholder','noteCounter','check','save','reset','next','followUpNames','followUpReason','saving','saved','savedAt','unsaved','saveError','restored','loadError','storageUnavailable','resetConfirmTitle','resetConfirmBody','resetYes','resetNo','unanswered','score','scorePerfect','scoreRetry','scoreContinue','correctTag','wrongTag','itemLabel','trailLabel','slotLegend','resultTitle'];

export function validatePractice(value){
  check(value,{schema:oneOf(1),reasons:list({id:ID,label:T(80)},1,8),
    items:list({id:ID,title:T(80),story:T(),trail:list(T(60),1,8),question:T(),options:list({id:ID,label:T(120)},2,5),answer:ID,followUp:FOLLOW_UP,explain:T()},1,20),
    draft:{storageKey:T(80),schema:oneOf(1),noteMaxLength:int(1,2000)},copy:Object.fromEntries(PRACTICE_COPY.map(key=>[key,T(300)]))},'practice');
  const reasons=value.reasons.map(reason=>reason.id);unique(reasons,'practice.reasons');
  unique(value.items.map(item=>item.id),'practice.items');
  value.items.forEach((item,index)=>{
    const path=`practice.items[${index}]`;const ids=item.options.map(option=>option.id);unique(ids,path+'.options');
    if(!ids.includes(item.answer))fail(path+'.answer','answer must be an option');
    keysEqual(item.feedback,ids,path+'.feedback');
    if(item.followUp.type==='reason'&&item.followUp.accept.some(id=>!reasons.includes(id)))fail(path+'.followUp.accept','unknown reason');
  });
  return value;
}

const MARK_KINDS=['smell','new','keep','next'];
const STAGE={id:ID,label:T(40),source:T(6000),expectedOutput:list(T(300),1,12),showInCodeView:opt(bool),marks:list({line:int(1,400),contains:T(160),kind:oneOf(...MARK_KINDS),note:T(200)},0,16)};
export function validateCode(value){
  check(value,{schema:oneOf(1),examples:list({id:ID,title:T(80),summary:T(),stages:list(STAGE,1,6),checks:list({id:ID,note:opt(T(600)),baseStage:ID,applySteps:list(int(1,STEP_COUNT),1,STEP_COUNT),expectError:T(40)},0,6)},1,6),
    markKinds:Object.fromEntries(MARK_KINDS.map(kind=>[kind,{label:T(40)}]))},'code');
  unique(value.examples.map(example=>example.id),'code.examples');
  value.examples.forEach((example,index)=>{
    unique(example.stages.map(stage=>stage.id),`code.examples[${index}].stages`);
    example.stages.forEach((stage,stageIndex)=>{
      const lines=sourceLines(stage.source);
      stage.marks.forEach((mark,markIndex)=>{if(!(lines[mark.line-1]??'').includes(mark.contains))fail(`code.examples[${index}].stages[${stageIndex}].marks[${markIndex}]`,'mark must point at its line');});
    });
  });
  return value;
}

// Cross-file rules, run by the build and the tests (the app shows each file on its own).
export function validateBundle({tutorial,practice,code}){
  validateTutorial(tutorial);validatePractice(practice);validateCode(code);
  const steps=tutorial.screens.steps.items;
  for(const step of steps){
    const example=findExample(code,step.code.example);if(!example)fail(`tutorial.screens.steps.items[${step.n-1}].code.example`,'unknown example');
    for(const stageId of [step.code.stage,step.code.compareWith].filter(Boolean))if(!findStage(example,stageId))fail(`tutorial.screens.steps.items[${step.n-1}].code`,'unknown stage '+stageId);
  }
  let replayed;
  try{replayed=replaySteps(steps,code);}catch(error){fail('tutorial.screens.steps.items',error.message);}
  steps.forEach((step,index)=>{
    const base=index?replayed[index-1].source:findStage(findExample(code,step.code.example),'before').source;
    if(resolveFocus(base,step.code.focus).length!==step.code.focus.length)fail(`tutorial.screens.steps.items[${index}].code.focus`,'focus text not found');
  });
  const parameter=tutorial.screens.parameter.code;const parameterExample=findExample(code,parameter.example);
  if(!parameterExample)fail('tutorial.screens.parameter.code.example','unknown example');
  let parameterAfter;
  try{parameterAfter=applyEdits(findStage(parameterExample,'before').source,parameter.edits);}catch(error){fail('tutorial.screens.parameter.code.edits',error.message);}
  if(parameterAfter!==findStage(parameterExample,'after')?.source)fail('tutorial.screens.parameter.code.edits','edits must reproduce the after stage');
  for(const view of tutorial.screens.code.views){
    const example=findExample(code,view.example);if(!example)fail('tutorial.screens.code.views','unknown example '+view.example);
    if(view.stages.some(stage=>!findStage(example,stage)))fail('tutorial.screens.code.views','unknown stage in '+view.id);
  }
  for(const example of code.examples)for(const item of example.checks){
    if(!findStage(example,item.baseStage))fail('code.checks','unknown base stage '+item.baseStage);
    if(item.applySteps.some(n=>!steps[n-1]||steps[n-1].code.example!==example.id))fail('code.checks','check steps must belong to the example');
  }
  return {tutorial,practice,code};
}
