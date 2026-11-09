import {el,icon} from '../shared/dom.js';
import {Screen} from './screen.js';
import {langOf,pager,routeLink,slipView} from './widgets.js';

export class HomeScreen extends Screen {
  async render({tutorial}){
    const copy=tutorial.screens.home,ui=tutorial.ui;
    const resume=routeLink('/practice',copy.resumeLabel,'text-link resume-link');resume.hidden=true;
    this.root.replaceChildren(el('section',{className:'screen home-screen'},[
      el('div',{className:'home-hero'},[
        el('div',{className:'home-copy'},[
          el('p',{className:'eyebrow',lang:langOf(copy.eyebrow),textContent:copy.eyebrow}),
          el('h1',{className:'home-title',textContent:copy.title}),
          el('p',{className:'lead',textContent:copy.lead}),
          el('div',{className:'actions'},[
            routeLink(copy.primaryCta.route,'','btn btn-primary',[copy.primaryCta.label,' ',icon('arrow')]),
            routeLink(copy.secondaryCta.route,copy.secondaryCta.label,'btn btn-secondary')
          ]),
          el('p',{className:'meta',textContent:copy.meta}),
          resume
        ]),
        el('figure',{className:'hero-visual'},[
          el('div',{className:'hero-pair'},[
            slipView(copy.hero.before.slots,ui,{title:copy.hero.before.label,className:'slip-compact hero-before'}),
            el('span',{className:'hero-arrow','aria-hidden':'true',textContent:'→'}),
            slipView(copy.hero.after.slots,ui,{title:copy.hero.after.label,className:'slip-compact hero-after'})
          ]),
          el('figcaption',{className:'hero-caption',textContent:copy.hero.caption})
        ])
      ]),
      el('ul',{className:'card-grid'},copy.cards.map(card=>el('li',{className:'card'},[
        el('p',{className:'label',textContent:card.label}),el('h2',{textContent:card.title}),el('p',{textContent:card.body})
      ]))),
      el('p',{className:'note',textContent:copy.note}),
      pager(this,ui)
    ]));
    // The resume link only needs to know that a readable draft exists.
    try{const draft=await this.ctx.storage.loadDraft();if(!this.closed&&draft&&Object.keys(draft.answers).length+draft.note.length>0)resume.hidden=false;}
    catch{}
  }
}
