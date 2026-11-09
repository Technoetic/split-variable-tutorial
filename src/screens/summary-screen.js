import {el,icon} from '../shared/dom.js';
import {Screen} from './screen.js';
import {pager,routeLink,screenHead} from './widgets.js';

export class SummaryScreen extends Screen {
  render({tutorial}){
    const copy=tutorial.screens.summary,ui=tutorial.ui;
    this.root.replaceChildren(el('section',{className:'screen summary-screen'},[
      screenHead(copy),
      el('ol',{className:'checklist'},copy.checklist.map(text=>el('li',{},[icon('check'),el('span',{textContent:text})]))),
      el('section',{className:'sources'},[
        el('h2',{textContent:copy.sourcesTitle}),
        el('ul',{},copy.sources.map(source=>el('li',{className:'source'},[
          el('a',{href:source.url,target:'_blank',rel:'noopener',textContent:source.label}),
          el('p',{textContent:source.note})
        ]))),
        el('p',{className:'note',textContent:copy.aliasesLine})
      ]),
      el('section',{className:'card originality'},[el('p',{textContent:copy.originality}),el('p',{textContent:copy.independence})]),
      el('div',{className:'actions'},copy.ctas.map((cta,index)=>routeLink(cta.route,cta.label,index?'btn btn-secondary':'btn btn-primary'))),
      pager(this,ui)
    ]));
  }
}

export class NotFoundScreen extends Screen {
  setTitle(){this.ctx.setTitle(this.data.tutorial.screens.notFound.title+' · '+this.data.tutorial.meta.appTitle);}
  render({tutorial}){
    const copy=tutorial.screens.notFound;
    this.root.replaceChildren(el('section',{className:'screen notfound-screen'},[
      el('p',{className:'eyebrow',textContent:copy.eyebrow}),
      el('h1',{textContent:copy.title}),
      el('p',{className:'lead',textContent:copy.body}),
      el('div',{className:'actions'},copy.ctas.map((cta,index)=>routeLink(cta.route,cta.label,index?'btn btn-secondary':'btn btn-primary')))
    ]));
  }
}
