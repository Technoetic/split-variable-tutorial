import {el} from '../shared/dom.js';
import {fill} from '../shared/format.js';
import {Screen} from './screen.js';
import {pager,routeLink,screenHead,slipView} from './widgets.js';

export class StoryScreen extends Screen {
  render({tutorial}){
    const copy=tutorial.screens.story,ui=tutorial.ui;
    this.root.replaceChildren(el('section',{className:'screen story-screen'},[
      screenHead(copy),
      el('ol',{className:'frames'},copy.frames.map((frame,index)=>el('li',{className:'frame'},[
        el('div',{className:'frame-text'},[
          el('p',{className:'frame-num',textContent:fill(ui.frameLabel,{n:index+1})}),
          el('h2',{textContent:frame.title}),
          el('p',{textContent:frame.body}),
          frame.link?routeLink(frame.link.route,frame.link.label,'text-link'):null
        ]),
        slipView(frame.slots,ui,{board:frame.board})
      ]))),
      el('p',{className:'callout',textContent:copy.takeaway}),
      pager(this,ui)
    ]));
  }
}
