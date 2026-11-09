import {el,icon} from '../shared/dom.js';
import {findExample,findStage,sameOutput} from '../tutorial/code-model.js';
import {Screen} from './screen.js';
import {codeBlock,outputView,pager,routeLink,screenHead} from './widgets.js';

// One row of the cafe-to-code table. The code-side term is Korean text; only the
// optional token (=, const, +=, for…of) is set in code font.
const glossaryRow=row=>el('tr',{},[
  el('th',{scope:'row',textContent:row.cafe}),
  el('td',{},[row.code,row.token?[' ',el('code',{textContent:row.token})]:null]),
  el('td',{textContent:row.note})
]);

// #/code?view=before|after|parameter. Each view is its own address, so a tab
// switch is an ordinary navigation (and gets the same version check).
export class CodeScreen extends Screen {
  needs(){return ['tutorial','code'];}
  render({tutorial,code}){
    const copy=tutorial.screens.code,ui=tutorial.ui;
    const requested=this.route.params.get('view');
    const view=copy.views.find(entry=>entry.id===requested)||copy.views.find(entry=>entry.id===copy.defaultView);
    const example=findExample(code,view.example);
    const stages=view.stages.map(id=>findStage(example,id)).filter(Boolean);
    // Before and after views compare against the other end of the same example.
    const other=findStage(example,view.stages.includes('before')?'after':'before');
    const outputs=stages.length>1?[stages[0],stages.at(-1)]:other?[stages[0],other]:null;
    // The legend lists only the mark kinds that appear in the stages on screen.
    const used=new Set(stages.flatMap(stage=>stage.marks.map(mark=>mark.kind)));
    const legend=Object.entries(code.markKinds).filter(([kind])=>used.has(kind));
    this.root.replaceChildren(el('section',{className:'screen code-screen'},[
      screenHead(copy),
      el('nav',{className:'view-tabs','aria-label':copy.title},copy.views.map(entry=>{
        const link=routeLink('/code?view='+entry.id,entry.label,'view-tab');
        if(entry.id===view.id)link.setAttribute('aria-current','page');
        return link;
      })),
      el('section',{className:'code-example'},[
        el('h2',{textContent:example.title}),
        el('p',{className:'muted',textContent:example.summary}),
        legend.length?el('ul',{className:'mark-legend'},legend.map(([kind,entry])=>el('li',{'data-mark':kind,textContent:entry.label}))):null,
        stages.map(stage=>el('div',{className:'stage'},[
          codeBlock(stage.source,{marks:stage.marks,markKinds:code.markKinds,ui,title:stage.label}),
          outputView(stage.expectedOutput,stage.label+' · '+copy.outputLabel)
        ])),
        outputs&&sameOutput(outputs[0].expectedOutput,outputs[1].expectedOutput)?el('p',{className:'same-output'},[icon('check'),' ',copy.sameOutput]):null,
        el('p',{className:'note',textContent:copy.runHint})
      ]),
      el('section',{className:'mapping'},[
        el('h2',{textContent:copy.mappingTitle}),
        el('table',{className:'mapping-table'},[
          el('thead',{},[el('tr',{},[ui.mappingHeaders.cafe,ui.mappingHeaders.code,ui.mappingHeaders.note].map(text=>el('th',{scope:'col',textContent:text})))]),
          el('tbody',{},tutorial.glossary.map(glossaryRow))
        ])
      ]),
      el('ul',{className:'notes-list'},[copy.constNote,copy.loopNote,copy.scopeNote].map(text=>el('li',{textContent:text}))),
      pager(this,ui)
    ]));
  }
}
