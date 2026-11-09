import {el,icon,uniqueId} from '../shared/dom.js';
import {fill,formatTime} from '../shared/format.js';
import {PracticeSession,validateDraft} from '../tutorial/practice-model.js';
import {Screen} from './screen.js';
import {choiceGroup,feedbackView,pager,routeLink,screenHead,setFeedback,trailView} from './widgets.js';

// The only screen with unsaved work: answers and the note are dirty until they
// match the last saved draft. Saving is asynchronous and a failed save stays dirty.
export class PracticeScreen extends Screen {
  constructor(...args){
    super(...args);
    this.session=null;this.saving=false;this.savePromise=null;this.saveError=null;this.notice=null;this.views=new Map();this.keepsScroll=false;
  }
  needs(){return ['tutorial','practice'];}
  readState(){return {dirty:!!this.session?.dirty,saving:this.saving};}
  async render({practice}){
    const copy=practice.copy;let draft=null;this.notice=null;
    if(!this.ctx.storage.available)this.notice={kind:'warning',text:copy.storageUnavailable};
    else{
      try{draft=await this.ctx.storage.loadDraft(value=>validateDraft(value,practice));if(draft)this.notice={kind:'info',text:copy.restored};}
      catch{this.notice={kind:'warning',text:copy.loadError};}
    }
    if(this.closed)return;
    this.session=new PracticeSession(practice,draft);
    this.paint();
  }
  copy(){return this.data.practice.copy;}
  tags(){const copy=this.copy();return {correctTag:copy.correctTag,wrongTag:copy.wrongTag};}
  paint(){
    const {tutorial,practice}=this.data;const copy=practice.copy;const screen=tutorial.screens.practice;
    this.views.clear();
    const noteId=uniqueId('note'),counterId=uniqueId('note-count');
    this.noteInput=el('textarea',{id:noteId,className:'note-input',rows:3,maxLength:practice.draft.noteMaxLength,placeholder:copy.notePlaceholder,'aria-describedby':counterId,value:this.session.note,
      oninput:()=>{this.session.setNote(this.noteInput.value);this.refreshCounter();this.refreshStatus();}});
    this.counter=el('p',{className:'note-counter',id:counterId});
    this.status=el('p',{className:'save-status',role:'status'});
    this.saveButton=el('button',{type:'button',className:'btn btn-secondary',textContent:copy.save,onclick:()=>{this.save().catch(()=>{});}});
    this.result=el('section',{className:'result-panel',tabIndex:-1,hidden:true,'aria-labelledby':'practice-result-title'});
    this.root.replaceChildren(el('section',{className:'screen practice-screen'},[
      screenHead(screen),
      this.notice?el('p',{className:'notice','data-kind':this.notice.kind,role:'status',textContent:this.notice.text}):null,
      el('ol',{className:'practice-items'},practice.items.map((item,index)=>this.itemView(item,index))),
      el('section',{className:'note-field'},[el('label',{for:noteId,textContent:copy.noteLabel}),this.noteInput,this.counter]),
      el('div',{className:'practice-bar'},[
        el('div',{className:'actions'},[
          el('button',{type:'button',className:'btn btn-primary',textContent:copy.check,onclick:()=>this.check()}),
          this.saveButton,
          el('button',{type:'button',className:'btn btn-ghost',textContent:copy.reset,onclick:()=>this.confirmReset()})
        ]),
        this.status
      ]),
      this.result,
      el('div',{className:'actions'},[routeLink('/code','','btn btn-secondary',[copy.next,' ',icon('arrow')])]),
      pager(this,tutorial.ui)
    ]));
    for(const item of practice.items)this.refreshItem(item.id);
    this.refreshCounter();this.refreshStatus();
  }
  itemView(item,index){
    const copy=this.copy();const answer=this.session.answer(item.id);const headingId=uniqueId('item');
    const heading=el('h2',{id:headingId,tabIndex:-1,textContent:item.title});
    const feedback=feedbackView(),followFeedback=feedbackView();
    const explain=el('p',{className:'explain',hidden:true,textContent:item.explain});
    const followUp=item.followUp;
    const followParts=followUp.type==='names'
      ?followUp.slots.map(slot=>choiceGroup({name:`${item.id}-${slot.id}`,legend:fill(copy.slotLegend,{value:slot.forValue}),options:slot.options,selected:answer.names[slot.id]??null,className:'choices compact',
        onChange:id=>{this.session.pickName(item.id,slot.id,id);this.changed(item.id);}}))
      :[choiceGroup({name:`${item.id}-reason`,legend:followUp.prompt,options:this.data.practice.reasons,selected:answer.reason,className:'choices compact',
        onChange:id=>{this.session.pickReason(item.id,id);this.changed(item.id);}})];
    const followSection=el('div',{className:'followup',hidden:true},[
      el('p',{className:'label',textContent:followUp.type==='names'?copy.followUpNames:copy.followUpReason}),
      followUp.type==='names'?el('p',{className:'followup-prompt',textContent:followUp.prompt}):null,
      followParts,followFeedback
    ]);
    const card=el('li',{className:'item-card','data-item':item.id,'aria-labelledby':headingId},[
      el('header',{className:'item-head'},[el('p',{className:'label',textContent:fill(copy.itemLabel,{n:index+1})}),heading]),
      el('p',{className:'item-story',textContent:item.story}),
      el('div',{className:'item-trail'},[el('p',{className:'label',textContent:copy.trailLabel}),trailView(item.trail,copy.trailLabel)]),
      choiceGroup({name:`${item.id}-option`,legend:item.question,legendClass:'question',options:item.options,selected:answer.option,onChange:id=>{this.session.select(item.id,id);this.changed(item.id);}}),
      feedback,followSection,explain
    ]);
    this.views.set(item.id,{card,heading,feedback,followSection,followFeedback,explain});
    return card;
  }
  changed(id){this.refreshItem(id);this.refreshStatus();}
  refreshItem(id){
    const item=this.data.practice.items.find(entry=>entry.id===id);const view=this.views.get(id);
    const answer=this.session.answer(id);const grade=this.session.grade(id);
    view.card.dataset.status=grade.status;
    setFeedback(view.feedback,answer.option===null?{text:null}:{correct:grade.optionCorrect,text:item.feedback[answer.option]},this.tags());
    view.followSection.hidden=!grade.optionCorrect;
    setFeedback(view.followFeedback,grade.followUpComplete?{correct:grade.followUpCorrect,text:grade.followUpCorrect?item.followUp.feedback.correct:item.followUp.feedback.wrong}:{text:null},this.tags());
    view.explain.hidden=!['wrong','correct','followup-wrong'].includes(grade.status);
  }
  refreshCounter(){this.counter.textContent=fill(this.copy().noteCounter,{n:this.session.note.length,max:this.data.practice.draft.noteMaxLength});}
  refreshStatus(){
    if(!this.status)return;
    const copy=this.copy();let state='idle',text='';
    if(this.saving){state='saving';text=copy.saving;}
    else if(this.saveError){state='error';text=copy.saveError;}
    else if(this.session.dirty){state='dirty';text=copy.unsaved;}
    else if(this.session.savedAt){state='saved';text=copy.saved+' · '+fill(copy.savedAt,{time:formatTime(this.session.savedAt)});}
    this.status.dataset.state=state;this.status.textContent=text;
    this.saveButton.disabled=this.saving||!this.ctx.storage.available;
  }
  check(){
    const copy=this.copy();const summary=this.session.summary();const perfect=summary.correct===summary.total;
    this.result.replaceChildren(
      el('h2',{id:'practice-result-title',textContent:copy.resultTitle}),
      el('p',{className:'score',textContent:fill(copy.score,{total:summary.total,correct:summary.correct})}),
      summary.unanswered?el('p',{textContent:fill(copy.unanswered,{n:summary.unanswered})}):null,
      // The retry hint only appears when something is actually wrong.
      el('p',{textContent:perfect?copy.scorePerfect:summary.wrong?copy.scoreRetry:copy.scoreContinue})
    );
    this.result.dataset.perfect=String(perfect);
    this.result.hidden=false;this.result.focus();
  }
  async save(){
    if(!this.session)return;
    if(this.savePromise)await this.savePromise.catch(()=>{});
    if(this.closed)return;
    const snapshot=this.session.snapshot();const savedAt=new Date().toISOString();
    this.saving=true;this.saveError=null;this.refreshStatus();
    const run=(async()=>{
      try{
        await this.ctx.storage.saveDraft({...snapshot,savedAt},value=>validateDraft(value,this.data.practice));
        this.session.markSaved(snapshot,savedAt);
      }catch(error){this.saveError=error;throw error;}
      finally{this.saving=false;if(this.savePromise===run)this.savePromise=null;if(!this.closed)this.refreshStatus();}
    })();
    this.savePromise=run;
    return run;
  }
  async discard(){
    if(this.savePromise)await this.savePromise.catch(()=>{});
    this.session?.discardChanges();
  }
  confirmReset(){
    const copy=this.copy();const titleId=uniqueId('reset');
    const dialog=el('dialog',{className:'modal','aria-labelledby':titleId},[el('div',{className:'modal-card'},[
      el('h2',{id:titleId,textContent:copy.resetConfirmTitle}),
      el('p',{textContent:copy.resetConfirmBody}),
      el('div',{className:'actions'},[
        el('button',{type:'button',className:'btn btn-primary',value:'yes',textContent:copy.resetYes}),
        el('button',{type:'button',className:'btn btn-secondary',value:'no',textContent:copy.resetNo})
      ])
    ])]);
    const close=()=>{dialog.close();dialog.remove();};
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',async event=>{
      const button=event.target.closest('button');if(!button)return;
      close();
      if(button.value==='yes')await this.reset();
    });
    this.root.append(dialog);dialog.showModal();
  }
  async reset(){
    if(this.savePromise)await this.savePromise.catch(()=>{});
    try{await this.ctx.storage.clearDraft();}
    catch(error){this.saveError=error;this.refreshStatus();return;}
    if(this.closed)return;
    this.session.reset();this.saveError=null;this.notice=null;this.paint();
    this.views.values().next().value?.heading.focus();
  }
  focusTarget(){
    if(super.focusTarget())return true;
    const id=this.route.params.get('item');const view=id?this.views.get(id):null;
    if(!view)return false;
    view.heading.focus();this.keepsScroll=true;return true;
  }
}
