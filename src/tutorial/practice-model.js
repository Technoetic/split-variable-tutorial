// Pure practice logic: no page and no storage access.

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const isoDate=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value));
const draftError=()=>Error('저장된 답의 형식이 올바르지 않아요.');

export const emptyAnswer=()=>({option:null,names:{},reason:null});

// Structure only; used where the practice catalog is not loaded (the home resume link).
export function validateDraftShape(value){
  if(!plain(value)||value.schema!==1||!plain(value.answers)||typeof value.note!=='string')throw draftError();
  if(value.savedAt!==undefined&&!isoDate(value.savedAt))throw draftError();
  const keys=Object.keys(value);
  if(keys.some(key=>!['schema','answers','note','savedAt'].includes(key)))throw draftError();
  for(const answer of Object.values(value.answers)){
    if(!plain(answer)||!plain(answer.names)||Object.keys(answer).some(key=>!['option','names','reason'].includes(key)))throw draftError();
    if(answer.option!==null&&typeof answer.option!=='string')throw draftError();
    if(answer.reason!==null&&typeof answer.reason!=='string')throw draftError();
    if(Object.values(answer.names).some(name=>typeof name!=='string'))throw draftError();
  }
  return value;
}

// Full check against the loaded catalog: every id must exist where it is used.
export function validateDraft(value,practice){
  validateDraftShape(value);
  if(value.note.length>practice.draft.noteMaxLength)throw draftError();
  const items=new Map(practice.items.map(item=>[item.id,item]));
  const reasons=new Set(practice.reasons.map(reason=>reason.id));
  for(const [id,answer] of Object.entries(value.answers)){
    const item=items.get(id);if(!item)throw draftError();
    if(answer.option!==null&&!item.options.some(option=>option.id===answer.option))throw draftError();
    const followUp=item.followUp;
    for(const [slotId,pick] of Object.entries(answer.names)){
      const slot=followUp.type==='names'?followUp.slots.find(entry=>entry.id===slotId):null;
      if(!slot||!slot.options.some(option=>option.id===pick))throw draftError();
    }
    if(answer.reason!==null&&(followUp.type!=='reason'||!reasons.has(answer.reason)))throw draftError();
  }
  return value;
}

// An item is correct when its option is the answer and its follow-up is right:
// every name slot picked correctly, or a reason from the accepted list.
export function gradeItem(item,answer=emptyAnswer()){
  if(!answer||answer.option===null||answer.option===undefined)return {status:'unanswered',optionCorrect:null};
  if(answer.option!==item.answer)return {status:'wrong',optionCorrect:false};
  const followUp=item.followUp;
  if(followUp.type==='names'){
    const picks=followUp.slots.map(slot=>answer.names?.[slot.id]??null);
    if(picks.some(pick=>pick===null))return {status:'followup',optionCorrect:true,followUpComplete:false};
    const slots=Object.fromEntries(followUp.slots.map(slot=>[slot.id,answer.names[slot.id]===slot.answer]));
    const correct=Object.values(slots).every(Boolean);
    return {status:correct?'correct':'followup-wrong',optionCorrect:true,followUpComplete:true,followUpCorrect:correct,slots};
  }
  if(answer.reason===null||answer.reason===undefined)return {status:'followup',optionCorrect:true,followUpComplete:false};
  const correct=followUp.accept.includes(answer.reason);
  return {status:correct?'correct':'followup-wrong',optionCorrect:true,followUpComplete:true,followUpCorrect:correct};
}

export function summarize(practice,answerFor){
  let correct=0,unanswered=0;
  for(const item of practice.items){
    const {status}=gradeItem(item,answerFor(item.id));
    if(status==='correct')correct++;
    else if(status==='unanswered'||status==='followup')unanswered++;
  }
  return {total:practice.items.length,correct,unanswered};
}

// Independent judgement used to cross-check the authored answers.
// profile: {writes: [meaning per write], role: 'accumulate'|'count'|'loop'|null, received: boolean}
export function decideSlot({writes,role=null,received=false}){
  if(!Array.isArray(writes)||!writes.length)throw Error('A slot needs at least one write');
  if(role==='accumulate'||role==='count'||role==='loop')return {action:'keep',reason:role};
  const meanings=[...new Set(writes)];
  if(received&&writes.length>1)return {action:'new-slot',slots:meanings.length-1};
  if(meanings.length>1)return {action:'split',slots:meanings.length};
  return {action:'keep',reason:writes.length===1?'once':null};
}

// Holds the learner's current answers and note, and the last saved snapshot.
export class PracticeSession {
  constructor(practice,draft=null){
    this.practice=practice;this.items=new Map(practice.items.map(item=>[item.id,item]));this.noteMax=practice.draft.noteMaxLength;
    this.answers=new Map();this.note='';this.savedAt=null;
    if(draft){
      for(const [id,answer] of Object.entries(draft.answers))if(this.items.has(id))this.answers.set(id,{option:answer.option??null,names:{...answer.names},reason:answer.reason??null});
      this.note=draft.note.slice(0,this.noteMax);this.savedAt=draft.savedAt||null;
    }
    this.baseline=this.serialize();
  }
  _item(id){const item=this.items.get(id);if(!item)throw Error('Unknown practice item '+id);return item;}
  answer(id){const answer=this.answers.get(id);return answer?{...answer,names:{...answer.names}}:emptyAnswer();}
  select(id,option){
    const item=this._item(id);if(!item.options.some(entry=>entry.id===option))throw Error('Unknown option '+option);
    this.answers.set(id,{...this.answer(id),option});
  }
  pickName(id,slotId,option){
    const slot=this._item(id).followUp.slots?.find(entry=>entry.id===slotId);
    if(!slot||!slot.options.some(entry=>entry.id===option))throw Error('Unknown name option '+option);
    const answer=this.answer(id);answer.names[slotId]=option;this.answers.set(id,answer);
  }
  pickReason(id,reason){
    const item=this._item(id);
    if(item.followUp.type!=='reason'||!this.practice.reasons.some(entry=>entry.id===reason))throw Error('Unknown reason '+reason);
    this.answers.set(id,{...this.answer(id),reason});
  }
  setNote(text){this.note=String(text).slice(0,this.noteMax);}
  // Canonical form: catalog order, sorted name keys, empty answers left out.
  snapshot(){
    const answers={};
    for(const item of this.practice.items){
      const answer=this.answers.get(item.id);if(!answer)continue;
      const names={};for(const key of Object.keys(answer.names).sort())names[key]=answer.names[key];
      if(answer.option===null&&!Object.keys(names).length&&answer.reason===null)continue;
      answers[item.id]={option:answer.option,names,reason:answer.reason};
    }
    return {schema:1,answers,note:this.note};
  }
  serialize(){return JSON.stringify(this.snapshot());}
  get dirty(){return this.serialize()!==this.baseline;}
  markSaved(snapshot,savedAt){this.baseline=JSON.stringify(snapshot);this.savedAt=savedAt;}
  discardChanges(){this.baseline=this.serialize();}
  reset(){this.answers.clear();this.note='';this.savedAt=null;this.baseline=this.serialize();}
  grade(id){return gradeItem(this._item(id),this.answers.get(id));}
  summary(){return summarize(this.practice,id=>this.answers.get(id));}
}
