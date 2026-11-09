import {el,icon,uniqueId} from '../shared/dom.js';
import {fill} from '../shared/format.js';
import {resolveFocus,resolveMarks,sourceLines} from '../tutorial/code-model.js';

// The page is Korean; short labels without Hangul (the English eyebrows) are marked
// English so screen readers switch voice.
export const langOf=text=>/[가-힣]/.test(String(text))?null:'en';

export function screenHead({eyebrow,title,lead},extra=[]){
  return el('header',{className:'screen-head'},[
    el('p',{className:'eyebrow',lang:langOf(eyebrow),textContent:eyebrow}),
    el('h1',{textContent:title}),
    lead?el('p',{className:'lead',textContent:lead}):null,
    extra
  ]);
}

export function routeLink(route,label,className='btn btn-secondary',children=null){
  return el('a',{className,href:'#'+route,'data-route':route},children??[label]);
}

// One slot of the order slip. State drives the styling; the badge and the hidden
// text make the same state readable without colour.
export function slotView(slot,ui){
  const visual=ui.visual;const badge=visual.states[slot.state];
  const children=[el('span',{className:'slot-label',textContent:slot.label})];
  if(slot.state==='mixed'){
    children.push(el('ol',{className:'slot-writes','aria-label':visual.writes},slot.writes.map(write=>el('li',{},[
      el('span',{className:'write-mark','aria-hidden':'true',textContent:write.mark}),
      el('span',{className:'write-value',textContent:write.value}),
      el('span',{className:'meaning-tag',textContent:write.meaning})
    ]))));
  }else{
    const value=el('span',{className:'slot-value'});
    if(slot.state==='overwritten'&&slot.previous){
      value.append(el('s',{className:'slot-previous'},[el('span',{className:'visually-hidden',textContent:visual.previous+' '}),slot.previous]),el('span',{className:'slot-arrow','aria-hidden':'true',textContent:'→'}));
    }
    value.append(slot.value===''?el('span',{className:'slot-empty',textContent:visual.empty}):el('strong',{textContent:slot.value}));
    children.push(value);
    if(slot.meaning)children.push(el('span',{className:'meaning-tag'},[el('span',{className:'visually-hidden',textContent:visual.meaning+': '}),slot.meaning]));
  }
  if(badge)children.push(el('span',{className:'slot-badge',textContent:badge}));
  return el('li',{className:'slot','data-state':slot.state,'data-highlight':slot.highlight?'true':null},children);
}

export function slipView(slots,ui,{title=ui.visual.slipTitle,board=null,reads=null,className=''}={}){
  const titleId=uniqueId('slip');
  return el('figure',{className:('slip '+className).trim(),'aria-labelledby':titleId},[
    el('figcaption',{className:'slip-title',id:titleId,textContent:title}),
    el('ul',{className:'slip-slots'},slots.map(slot=>slotView(slot,ui))),
    reads?el('p',{className:'slip-reads'},[el('span',{className:'label',textContent:ui.visual.reads}),reads.map(read=>el('span',{className:'read-flow'},[el('span',{textContent:read.from}),icon('arrow'),el('span',{textContent:read.to})]))]):null,
    board?boardView(board,ui):null
  ]);
}

export function boardView(board,ui){
  return el('div',{className:'board'},[
    el('p',{className:'label board-title',textContent:ui.visual.boardTitle}),
    el('dl',{},board.map(item=>el('div',{className:'board-item'},[el('dt',{textContent:item.label}),el('dd',{textContent:item.value})])))
  ]);
}

export function trailView(values,label){
  return el('ol',{className:'trail','aria-label':label},values.map((value,index)=>el('li',{},[index?el('span',{className:'trail-arrow','aria-hidden':'true',textContent:'→'}):null,el('span',{className:'chip',textContent:value})])));
}

export function tag(result,ui){
  return el('span',{className:'result-tag','data-result':result?'correct':'wrong'},[icon(result?'check':'retry'),result?ui.correctTag:ui.wrongTag]);
}

// A native radio group: arrow keys move between options, the legend names the question.
export function choiceGroup({name,legend,options,selected=null,onChange,className='choices',legendClass='',describe=null}){
  const fieldset=el('fieldset',{className},[el('legend',{className:legendClass,textContent:legend})]);
  const list=el('div',{className:'choice-list'});
  for(const option of options){
    const id=uniqueId(name);
    const input=el('input',{type:'radio',name,id,value:option.id,checked:option.id===selected,onchange:()=>{if(input.checked)onChange(option.id);}});
    list.append(el('label',{className:'choice',for:id},[input,el('span',{className:'choice-text'},describe?describe(option):[option.label])]));
  }
  fieldset.append(list);
  return fieldset;
}

export function feedbackView(){return el('div',{className:'feedback','aria-live':'polite',hidden:true});}
export function setFeedback(node,{correct,text},ui){
  if(text===null||text===undefined){node.hidden=true;node.replaceChildren();node.removeAttribute('data-result');return;}
  node.hidden=false;node.dataset.result=correct?'correct':'wrong';
  node.replaceChildren(tag(correct,ui),el('p',{textContent:text}));
}

// Source as text with line numbers; marked lines get a kind and a note listed below.
export function codeBlock(source,{marks=[],focus=[],markKinds=null,ui,title=null}){
  const lines=sourceLines(source);
  const resolved=resolveMarks(source,marks);const focused=resolveFocus(source,focus);
  const byLine=new Map();
  for(const mark of resolved)byLine.set(mark.line,{kind:mark.kind,note:mark.note,label:markKinds?.[mark.kind]?.label??''});
  for(const entry of focused)byLine.set(entry.line,{kind:'focus',note:entry.note,label:ui.focusLabel});
  const code=el('code',{},lines.map((line,index)=>{
    const mark=byLine.get(index+1);
    return el('span',{className:'code-line','data-mark':mark?.kind??null},[el('span',{className:'ln','aria-hidden':'true',textContent:String(index+1)}),el('span',{className:'lc',textContent:line||' '})]);
  }));
  const notes=[...byLine.entries()].sort((a,b)=>a[0]-b[0]);
  return el('figure',{className:'code-figure'},[
    title?el('figcaption',{className:'code-title',textContent:title}):null,
    el('pre',{className:'code-block'},[code]),
    notes.length?el('div',{className:'code-notes'},[el('p',{className:'label',textContent:ui.marksTitle}),el('ul',{},notes.map(([line,mark])=>el('li',{'data-mark':mark.kind},[
      el('span',{className:'note-line',textContent:fill(ui.lineLabel,{n:line})}),
      // Line numbers in the block are hidden from screen readers, so the note carries the line's code.
      el('code',{className:'visually-hidden',textContent:(lines[line-1]??'').trim()}),
      mark.label?el('span',{className:'note-kind',textContent:mark.label}):null,
      el('span',{className:'note-text',textContent:mark.note})
    ])))]):null
  ]);
}

export function editsView(edits,ui){
  return el('div',{className:'edits'},[
    el('p',{className:'label',textContent:ui.editsLabel}),
    el('ol',{},edits.map(edit=>el('li',{className:'edit'},[
      el('pre',{className:'edit-line','data-change':'removed'},[el('span',{className:'visually-hidden',textContent:ui.removedLine+': '}),el('span',{'aria-hidden':'true',className:'edit-sign',textContent:'−'}),el('code',{textContent:edit.from.trim()})]),
      el('pre',{className:'edit-line','data-change':'added'},[el('span',{className:'visually-hidden',textContent:ui.addedLine+': '}),el('span',{'aria-hidden':'true',className:'edit-sign',textContent:'+'}),el('code',{textContent:edit.to.trim()})])
    ])))
  ]);
}

export function outputView(lines,label){
  return el('div',{className:'output'},[el('p',{className:'label',textContent:label}),el('pre',{className:'output-block'},[el('code',{textContent:lines.join('\n')})])]);
}

export function pager(screen,ui){
  const route=screen.routeInfo();if(!route)return null;
  const prev=route.prev?screen.routeInfo(route.prev):null,next=route.next?screen.routeInfo(route.next):null;
  if(!prev&&!next)return null;
  return el('nav',{className:'pager','aria-label':ui.pagerLabel},[
    prev?routeLink(prev.path,'','pager-link pager-prev',[el('span',{className:'pager-dir'},[icon('back'),' ',ui.prev]),el('span',{className:'pager-title',textContent:prev.title})]):el('span'),
    next?routeLink(next.path,'','pager-link pager-next',[el('span',{className:'pager-dir'},[ui.next,' ',icon('arrow')]),el('span',{className:'pager-title',textContent:next.title})]):null
  ]);
}

export function section(className,heading,children,level='h2'){
  return el('section',{className},[heading?el(level,{textContent:heading}):null,children]);
}
