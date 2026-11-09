import {el} from '../shared/dom.js';
import {SHELL} from '../shared/shell-copy.js';

// Lifecycle shared by every screen: fetch the data files it needs (fresh, through
// the content service), render, and show loading or an error with retry. A newer
// load or a disposed screen never applies an older result.
export class Screen {
  constructor(ctx,root,route,entry){
    this.ctx=ctx;this.root=root;this.route=route;this.entry=entry;
    this.abort=new AbortController();this.closed=false;this.loadSequence=0;this.data=null;
  }
  get signal(){return this.abort.signal;}
  needs(){return ['tutorial'];}
  readState(){return {dirty:false,saving:false};}
  async save(){}
  async discard(){}
  async mount(){await this.load();}
  async load(){
    const sequence=++this.loadSequence;
    this.showLoading();
    try{
      const names=this.needs();
      const values=await Promise.all(names.map(name=>this.ctx.content.load(name,{signal:this.signal})));
      if(this.closed||sequence!==this.loadSequence)return false;
      this.data=Object.fromEntries(names.map((name,index)=>[name,values[index]]));
      this.setTitle();
      await this.render(this.data);
      return !this.closed;
    }catch(error){
      if(this.closed||sequence!==this.loadSequence||error?.name==='AbortError')return false;
      console.error(error);
      this.showError(error);
      return false;
    }
  }
  routeInfo(path=this.entry.path){return this.data?.tutorial.routes.find(route=>route.path===path)||null;}
  setTitle(){
    const meta=this.data.tutorial.meta;const route=this.routeInfo();
    this.ctx.setTitle(this.entry.path==='/'||!route?meta.htmlTitle:route.title+' · '+meta.appTitle);
  }
  showLoading(){
    this.root.replaceChildren(el('section',{className:'state-panel','data-state':'loading',role:'status'},[el('span',{className:'spinner','aria-hidden':'true'}),el('p',{textContent:SHELL.loading})]));
  }
  showError(error){
    const retry=el('button',{type:'button',className:'btn btn-primary',textContent:SHELL.retry,onclick:async()=>{retry.disabled=true;if(await this.load())this.root.focus({preventScroll:true});}});
    this.root.replaceChildren(el('section',{className:'state-panel','data-state':'error',role:'alert'},[el('p',{textContent:error?.userMessage||SHELL.loadError}),retry]));
    retry.focus();
  }
  render(){}
  dispose(){this.closed=true;this.abort.abort();}
}
