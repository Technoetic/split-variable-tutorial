import {el,icon} from '../shared/dom.js';
import {fill} from '../shared/format.js';
import {findExample,findStage,sameOutput} from '../tutorial/code-model.js';
import {STEP_COUNT} from '../shared/route-table.js';
import {Screen} from './screen.js';
import {codeBlock,editsView,langOf,outputView,pager,routeLink,screenHead,slipView} from './widgets.js';

export class StepsScreen extends Screen {
  render({tutorial}){
    const copy=tutorial.screens.steps,ui=tutorial.ui;
    this.root.replaceChildren(el('section',{className:'screen steps-screen'},[
      screenHead(copy),
      el('ol',{className:'step-list'},copy.items.map(item=>el('li',{},[
        routeLink(item.path,'','step-link',[
          el('span',{className:'step-n','aria-hidden':'true',textContent:String(item.n)}),
          el('span',{className:'step-link-text'},[el('span',{className:'visually-hidden',textContent:fill(ui.stepProgress,{n:item.n,total:STEP_COUNT})+' '}),el('strong',{textContent:item.title}),el('span',{className:'step-link-body',textContent:item.body})]),
          icon('arrow')
        ])
      ]))),
      el('div',{className:'actions'},[routeLink(copy.cta.route,'','btn btn-primary',[copy.cta.label,' ',icon('arrow')])]),
      el('p',{className:'note',textContent:copy.note}),
      pager(this,ui)
    ]));
  }
}

// One mechanics step: the slip first, the code only on request.
export class StepScreen extends Screen {
  needs(){return ['tutorial','code'];}
  render({tutorial,code}){
    const steps=tutorial.screens.steps,ui=tutorial.ui;
    const item=steps.items.find(entry=>entry.n===this.entry.step);
    const ref=item.code;const example=findExample(code,ref.example);
    const stage=ref.stage?findStage(example,ref.stage):null;
    const compare=ref.compareWith?findStage(example,ref.compareWith):null;
    const codeParts=[
      item.codeNote?el('p',{className:'code-note'},[el('strong',{textContent:ui.codeNoteLabel+' '}),item.codeNote]):null,
      ref.edits.length?editsView(ref.edits,ui):null,
      stage?codeBlock(stage.source,{marks:ref.focus.length?[]:stage.marks,focus:ref.focus,markKinds:code.markKinds,ui,title:example.title+' · '+stage.label}):null,
      ref.showOutput&&stage?el('div',{className:'output-compare'},[
        compare?outputView(compare.expectedOutput,compare.label+' · '+tutorial.screens.code.outputLabel):null,
        outputView(stage.expectedOutput,stage.label+' · '+tutorial.screens.code.outputLabel),
        compare&&sameOutput(compare.expectedOutput,stage.expectedOutput)?el('p',{className:'same-output'},[icon('check'),' ',ui.sameOutputStep]):null
      ]):null
    ];
    this.root.replaceChildren(el('section',{className:'screen step-screen'},[
      el('header',{className:'screen-head'},[
        el('p',{className:'eyebrow'},[el('span',{lang:langOf(steps.eyebrow),textContent:steps.eyebrow}),' · '+fill(ui.stepProgress,{n:item.n,total:STEP_COUNT})]),
        el('h1',{textContent:item.title}),
        el('p',{className:'lead',textContent:item.body})
      ]),
      el('nav',{className:'step-dots','aria-label':ui.stepListLabel},steps.items.map(entry=>routeLink(entry.path,'','step-dot',[
        el('span',{'aria-hidden':'true',textContent:String(entry.n)}),
        el('span',{className:'visually-hidden',textContent:fill(ui.stepProgress,{n:entry.n,total:STEP_COUNT})+' '+entry.title})
      ]))),
      el('div',{className:'step-body'},[
        slipView(item.slots,ui,{reads:item.reads??null}),
        el('div',{className:'checkpoint'},[el('p',{className:'label',textContent:ui.checkLabel}),el('p',{textContent:item.check})])
      ]),
      el('details',{className:'code-peek'},[el('summary',{},[ui.codePeek]),el('div',{className:'code-peek-body'},codeParts)]),
      pager(this,ui)
    ]));
    this.root.querySelectorAll('.step-dot').forEach((link,index)=>{if(index+1===item.n)link.setAttribute('aria-current','step');});
  }
}
