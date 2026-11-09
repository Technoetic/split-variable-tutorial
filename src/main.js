import {VersionService} from './services/version-service.js';
import {StorageService} from './services/storage-service.js';
import {ContentService} from './services/content-service.js';
import {PreferenceService} from './services/preference-service.js';
import {Router} from './services/router.js';
import {routeFor} from './shared/route-table.js';
import {SHELL} from './shared/shell-copy.js';
import {SCREENS} from './screens/screen-table.js';

// Entry point: wires the services, the router and the screen table, and owns the
// shell (update notice, toast, unsaved-answers dialog, display settings).
class SplitVariableApp {
  constructor(){
    this.root=document.querySelector('#app');this.sequence=0;this.current=null;
    this.baseUrl=new URL('./',location.href);this.loadedBuild=document.querySelector('meta[name="app-build"]').content;
    this.storage=new StorageService();this.content=new ContentService({baseUrl:this.baseUrl});
    this.version=new VersionService({baseUrl:this.baseUrl,loadedBuild:this.loadedBuild});
    this.prefs=new PreferenceService();this.prefs.apply(document.documentElement);
    this.ctx={baseUrl:this.baseUrl,loadedBuild:this.loadedBuild,storage:this.storage,content:this.content,version:this.version,
      toast:message=>this.toast(message),setTitle:title=>{document.title=title;}};
    this.router=new Router({baseUrl:this.baseUrl,version:this.version,readState:()=>this.readState(),onNavigate:route=>this.show(route),onProtect:details=>this.protect(details),onUpdate:()=>this.update(),onError:error=>this.toast(error.message||SHELL.navError)});
    this.ctx.router=this.router;
    this.settings();
    document.querySelector('[data-skip]').addEventListener('click',()=>this.root.focus());
    addEventListener('beforeunload',event=>{const state=this.readState();if(state.dirty||state.saving){event.preventDefault();event.returnValue='';}});
  }
  settings(){
    const theme=document.querySelector('#theme-toggle'),motion=document.querySelector('#motion-toggle');
    const render=()=>{
      theme.querySelector('.theme-label').textContent=SHELL.theme.prefix+': '+SHELL.theme[this.prefs.theme];
      motion.setAttribute('aria-pressed',String(this.prefs.motion==='reduce'));
      this.prefs.apply(document.documentElement);
    };
    theme.addEventListener('click',()=>{this.prefs.set('theme',this.prefs.nextTheme());render();});
    motion.addEventListener('click',()=>{this.prefs.set('motion',this.prefs.motion==='reduce'?'auto':'reduce');render();});
    render();
  }
  readState(){const state=this.current?.readState()||{dirty:false,saving:false};return {...state,saving:state.saving||this.storage.saving};}
  async show(route){
    const sequence=++this.sequence;this.current?.dispose();
    const entry=routeFor(route.path);const Screen=SCREENS[entry.screen];
    const screen=new Screen(this.ctx,this.root,route,entry);this.current=screen;
    const section=entry.screen==='step'?'/steps':entry.path;
    document.querySelectorAll('.nav-links a[data-route]').forEach(link=>{if(link.dataset.route===section)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    await screen.mount();if(sequence!==this.sequence)return;
    if(!screen.focusTarget?.())this.root.focus({preventScroll:true});
    if(!screen.keepsScroll)window.scrollTo({top:0,behavior:'instant'});
  }
  update(){const banner=document.querySelector('#update-banner');banner.hidden=!this.version.pendingBuild;if(!banner.hidden)banner.textContent=SHELL.updateBanner;}
  toast(message){const node=document.querySelector('#toast');node.textContent=message;node.hidden=false;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>{node.hidden=true;},4500);}
  async protect({changed}){
    const dialog=document.querySelector('#guard-dialog'),error=document.querySelector('#guard-error');
    error.hidden=true;document.querySelector('#guard-description').textContent=changed?SHELL.guard.descriptionUpdate:SHELL.guard.description;
    const buttons=[...dialog.querySelectorAll('button')];buttons.forEach(button=>{button.disabled=false;});
    return new Promise(resolve=>{
      let busy=false;
      const finish=value=>{dialog.removeEventListener('click',click);dialog.removeEventListener('cancel',cancel);dialog.close();resolve(value);};
      const cancel=event=>{event.preventDefault();if(!busy)finish(false);};
      const click=async event=>{
        const action=event.target.closest('[data-guard]')?.dataset.guard;if(!action||busy)return;
        if(action==='stay'){finish(false);return;}
        busy=true;buttons.forEach(button=>{button.disabled=true;});
        try{if(action==='discard')await this.current?.discard?.();else await this.current?.save?.();finish(true);}
        catch{error.hidden=false;error.textContent=SHELL.guard.saveError;busy=false;buttons.forEach(button=>{button.disabled=false;});}
      };
      dialog.addEventListener('click',click);dialog.addEventListener('cancel',cancel);dialog.showModal();
    });
  }
  async start(){await this.router.start();}
}

const app=new SplitVariableApp();
app.start().catch(error=>{console.error(error);document.querySelector('#app').textContent=SHELL.startError;});
