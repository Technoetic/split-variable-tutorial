import {el,icon} from '../shared/dom.js';
import {fill} from '../shared/format.js';
import {Screen} from './screen.js';
import {editsView,pager,routeLink,screenHead,slipView} from './widgets.js';

export class ParameterScreen extends Screen {
  render({tutorial}){
    const copy=tutorial.screens.parameter,ui=tutorial.ui;
    this.root.replaceChildren(el('section',{className:'screen parameter-screen'},[
      screenHead(copy),
      el('ol',{className:'frames'},copy.frames.map((frame,index)=>el('li',{className:'frame'},[
        el('div',{className:'frame-text'},[
          el('p',{className:'frame-num',textContent:fill(ui.frameLabel,{n:index+1})}),
          el('h2',{textContent:frame.title}),
          el('p',{textContent:frame.body})
        ]),
        slipView(frame.slots,ui)
      ]))),
      el('p',{className:'callout',textContent:copy.analogy}),
      el('section',{className:'card code-note-card'},[
        el('h2',{textContent:copy.codeNote.title}),
        el('p',{textContent:copy.codeNote.body}),
        el('details',{className:'code-peek'},[el('summary',{},[ui.codePeek]),el('div',{className:'code-peek-body'},[editsView(copy.code.edits,ui)])])
      ]),
      el('div',{className:'actions'},[routeLink(copy.link.route,'','btn btn-secondary',[copy.link.label,' ',icon('arrow')])]),
      pager(this,ui)
    ]));
  }
}
