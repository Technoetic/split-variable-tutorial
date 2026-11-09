import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {decideSlot,gradeItem,summarize,PracticeSession,validateDraft,emptyAnswer} from '../src/tutorial/practice-model.js';
import {applyEdits,findExample,findStage,replaySteps,resolveMarks,sameOutput,sourceLines} from '../src/tutorial/code-model.js';

const load=async name=>JSON.parse(await readFile(new URL('../data/'+name+'.json',import.meta.url),'utf8'));
const tutorial=await load('tutorial'),practice=await load('practice'),code=await load('code');
const item=id=>practice.items.find(entry=>entry.id===id);

// Each slot described by what is written into it, independent of the authored answers.
const PROFILES={
  memo:{writes:['주문 금액','대기 시간(분)']},
  'today-sales':{writes:['지금까지의 매출','지금까지의 매출','지금까지의 매출'],role:'accumulate'},
  'ordered-cups':{writes:['받은 잔 수','결제 잔 수'],received:true},
  'buzzer-table':{writes:['진동벨 번호','테이블 번호']},
  'cups-made':{writes:['지금까지 만든 잔 수','지금까지 만든 잔 수','지금까지 만든 잔 수'],role:'count'},
  syrup:{writes:['시럽 주문']},
  'current-order':{writes:['이번 차례의 주문','이번 차례의 주문','이번 차례의 주문'],role:'loop'}
};

test('authored practice answers match the independent slot judgement',()=>{
  assert.deepEqual(Object.keys(PROFILES).sort(),practice.items.map(entry=>entry.id).sort());
  for(const entry of practice.items){
    const decision=decideSlot(PROFILES[entry.id]);
    assert.equal(entry.answer,decision.action,entry.id);
    if(decision.action==='keep'){assert.equal(entry.followUp.type,'reason',entry.id);assert.ok(entry.followUp.accept.includes(decision.reason),entry.id);}
    else{assert.equal(entry.followUp.type,'names',entry.id);assert.equal(entry.followUp.slots.length,decision.slots,entry.id);}
  }
  assert.deepEqual(decideSlot({writes:['같은 뜻','같은 뜻']}),{action:'keep',reason:null});
  assert.throws(()=>decideSlot({writes:[]}));
});

test('an item is correct only with the right option and a right follow-up',()=>{
  const memo=item('memo'),sales=item('today-sales'),cups=item('cups-made');
  assert.equal(gradeItem(memo,emptyAnswer()).status,'unanswered');
  assert.equal(gradeItem(memo,{option:'keep',names:{},reason:null}).status,'wrong');
  assert.equal(gradeItem(memo,{option:'split',names:{first:'amount'},reason:null}).status,'followup');
  assert.equal(gradeItem(memo,{option:'split',names:{first:'amount',second:'memo-2'},reason:null}).status,'followup-wrong');
  const right=gradeItem(memo,{option:'split',names:{first:'amount',second:'wait'},reason:null});assert.equal(right.status,'correct');assert.deepEqual(right.slots,{first:true,second:true});
  assert.equal(gradeItem(sales,{option:'keep',names:{},reason:null}).status,'followup');
  assert.equal(gradeItem(sales,{option:'keep',names:{},reason:'count'}).status,'followup-wrong');
  assert.equal(gradeItem(sales,{option:'keep',names:{},reason:'accumulate'}).status,'correct');
  for(const reason of ['count','accumulate'])assert.equal(gradeItem(cups,{option:'keep',names:{},reason}).status,'correct');
  const answers=new Map([['memo',{option:'split',names:{first:'amount',second:'wait'},reason:null}],['syrup',{option:'keep',names:{},reason:null}],['buzzer-table',{option:'keep',names:{},reason:null}]]);
  assert.deepEqual(summarize(practice,id=>answers.get(id)),{total:7,correct:1,unanswered:5});
});

test('the practice session tracks unsaved changes against the last saved snapshot',()=>{
  const session=new PracticeSession(practice);assert.equal(session.dirty,false);
  session.select('memo','keep');assert.equal(session.dirty,true);
  session.select('memo','split');session.pickName('memo','first','amount');session.pickName('memo','second','wait');session.setNote('한 칸, 한 뜻');
  const snapshot=session.snapshot();session.markSaved(snapshot,'2026-11-09T12:00:00.000Z');assert.equal(session.dirty,false);
  assert.doesNotThrow(()=>validateDraft({...snapshot,savedAt:'2026-11-09T12:00:00.000Z'},practice));
  session.setNote('한 칸, 한 뜻!');assert.equal(session.dirty,true);session.setNote('한 칸, 한 뜻');assert.equal(session.dirty,false);
  session.pickReason('today-sales','accumulate');assert.equal(session.dirty,true);session.discardChanges();assert.equal(session.dirty,false);
  assert.throws(()=>session.select('memo','maybe'));assert.throws(()=>session.pickReason('memo','accumulate'));assert.throws(()=>session.pickName('syrup','first','amount'));
  session.setNote('x'.repeat(900));assert.equal(session.note.length,practice.draft.noteMaxLength);
  session.reset();assert.equal(session.dirty,false);assert.deepEqual(session.snapshot(),{schema:1,answers:{},note:''});assert.equal(session.savedAt,null);
});

test('a restored draft starts clean and in canonical order',()=>{
  const draft={schema:1,answers:{syrup:{option:'keep',names:{},reason:'once'},memo:{option:'split',names:{second:'wait',first:'amount'},reason:null}},note:'메모',savedAt:'2026-11-09T12:00:00.000Z'};
  const session=new PracticeSession(practice,validateDraft(structuredClone(draft),practice));
  assert.equal(session.dirty,false);assert.equal(session.savedAt,draft.savedAt);
  assert.deepEqual(Object.keys(session.snapshot().answers),['memo','syrup']);assert.deepEqual(Object.keys(session.snapshot().answers.memo.names),['first','second']);
  assert.equal(session.grade('memo').status,'correct');assert.equal(session.summary().correct,2);
  session.answer('memo').names.first='number';assert.equal(session.grade('memo').status,'correct');
});

function run(source){
  const lines=[];
  vm.runInNewContext(source,{console:{log:(...values)=>lines.push(values.join(' '))}},{timeout:1000});
  return lines;
}

test('every code stage prints its expected output when run',()=>{
  for(const example of code.examples)for(const stage of example.stages)assert.deepEqual(run(stage.source),stage.expectedOutput,example.id+'/'+stage.id);
  const main=findExample(code,'main');
  assert.ok(sameOutput(findStage(main,'before').expectedOutput,findStage(main,'after').expectedOutput));
  assert.deepEqual(findStage(main,'before').expectedOutput,['매출 27500원 · 6잔 · 대기 4분, 2분, 6분']);
});

test('replaying the step edits reproduces each named stage exactly',()=>{
  const steps=tutorial.screens.steps.items;const main=findExample(code,'main');
  const replayed=replaySteps(steps,code);
  assert.equal(replayed[2].source,findStage(main,'midway').source);assert.equal(replayed[4].source,findStage(main,'after').source);
  const viaEdits=applyEdits(applyEdits(findStage(main,'before').source,steps[1].code.edits),steps[2].code.edits);
  assert.equal(viaEdits,findStage(main,'midway').source);
  const parameter=findExample(code,'parameter');
  assert.equal(applyEdits(findStage(parameter,'before').source,tutorial.screens.parameter.code.edits),findStage(parameter,'after').source);
});

test('applying only step 2 fails, which is why the check waits until step 3',()=>{
  const main=findExample(code,'main');const [check]=main.checks;
  let source=findStage(main,check.baseStage).source;
  for(const n of check.applySteps)source=applyEdits(source,tutorial.screens.steps.items[n-1].code.edits);
  assert.throws(()=>run(source),error=>error.name===check.expectError&&/before initialization/.test(error.message));
});

test('edits must name exactly one existing line',()=>{
  assert.throws(()=>applyEdits('a\nb\n',[{from:'c',to:'d'}]),/exactly one/);
  assert.throws(()=>applyEdits('a\na\n',[{from:'a',to:'d'}]),/exactly one/);
  assert.equal(applyEdits('a\nb\n',[{from:'b',to:'c'}]),'a\nc\n');
});

test('line marks point at their lines and fall back to the text when a line moves',()=>{
  for(const example of code.examples)for(const stage of example.stages){
    const lines=sourceLines(stage.source);
    for(const mark of stage.marks)assert.ok(lines[mark.line-1].includes(mark.contains),`${example.id}/${stage.id}:${mark.line}`);
  }
  assert.deepEqual(resolveMarks('x\ny\n',[{line:1,contains:'y',kind:'new',note:'n'},{line:1,contains:'zz',kind:'new',note:'n'}]),[{line:2,contains:'y',kind:'new',note:'n'}]);
});

test('JavaScript facts the tutorial relies on',()=>{
  assert.deepEqual(run('function f(cups){cups=cups-1;return cups;}let ordered=5;const paid=f(ordered);console.log(ordered,paid);'),['5 4']);
  assert.throws(()=>run('const total=1;total=2;'),error=>error.name==='TypeError');
  assert.deepEqual(run('const waits=[];waits.push(1);waits.push(2);console.log(waits.length);'),['2']);
});
