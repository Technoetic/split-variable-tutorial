import {el} from '../shared/dom.js';
import {Screen} from './screen.js';
import {choiceGroup,feedbackView,pager,routeLink,screenHead,setFeedback} from './widgets.js';

// A one-question check with immediate feedback. Nothing here is saved, so the
// screen never reports unsaved work.
export class SmellScreen extends Screen {
  render({tutorial}){
    const copy=tutorial.screens.smell,ui=tutorial.ui;
    const feedback=feedbackView();
    const quiz=choiceGroup({name:'smell',legend:copy.question,className:'choices timeline',legendClass:'question',options:copy.timeline,
      describe:entry=>[
        el('span',{className:'action-tag','data-action':entry.action,textContent:copy.actionLabels[entry.action]}),
        el('span',{className:'choice-main',textContent:entry.text}),
        entry.meaning?el('span',{className:'meaning-tag',textContent:entry.meaning}):null
      ],
      onChange:id=>setFeedback(feedback,{correct:id===copy.answer,text:copy.feedback[id]},ui)});
    const exceptions=this.routeInfo('/exceptions');
    this.root.replaceChildren(el('section',{className:'screen smell-screen'},[
      screenHead(copy),
      el('div',{className:'quiz-card'},[quiz,feedback]),
      el('section',{className:'card what-if'},[el('h2',{textContent:copy.whatIf.title}),el('p',{textContent:copy.whatIf.body})]),
      el('section',{className:'signs'},[el('h2',{textContent:copy.signsTitle}),el('ul',{className:'check-list'},copy.signs.map(sign=>el('li',{textContent:sign})))]),
      el('p',{className:'callout'},[copy.notSmell,' ',exceptions?routeLink('/exceptions',exceptions.title,'text-link'):null]),
      pager(this,ui)
    ]));
  }
}
