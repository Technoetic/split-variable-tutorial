import {el} from '../shared/dom.js';
import {Screen} from './screen.js';
import {choiceGroup,feedbackView,pager,screenHead,setFeedback,trailView} from './widgets.js';

export class ExceptionsScreen extends Screen {
  render({tutorial}){
    const copy=tutorial.screens.exceptions,ui=tutorial.ui;
    const source=tutorial.screens.summary.sources.find(entry=>entry.id===copy.sourceRef);
    const feedback=feedbackView();
    const quiz=choiceGroup({name:'exceptions',legend:copy.quiz.question,legendClass:'question',options:copy.quiz.options,
      onChange:id=>setFeedback(feedback,{correct:id===copy.quiz.answer,text:copy.quiz.feedback[id]},ui)});
    this.root.replaceChildren(el('section',{className:'screen exceptions-screen'},[
      screenHead(copy),
      el('ul',{className:'card-grid'},copy.cards.map(card=>el('li',{className:'card keep-card'},[
        el('p',{className:'keep-tag',textContent:card.tag}),
        el('h2',{textContent:card.title}),
        el('p',{textContent:card.body}),
        trailView(card.trail,card.title),
        el('p',{className:'inline-code'},[el('code',{textContent:card.code})])
      ]))),
      el('div',{className:'quiz-card'},[quiz,feedback]),
      el('section',{className:'card rule'},[el('h2',{textContent:copy.rule.title}),el('ol',{className:'rule-list'},copy.rule.items.map(text=>el('li',{textContent:text})))]),
      el('p',{className:'note'},[copy.sourceNote,' ',source?el('a',{href:source.url,target:'_blank',rel:'noopener',className:'text-link',textContent:source.label}):null]),
      pager(this,ui)
    ]));
  }
}
