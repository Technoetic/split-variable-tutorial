// Per-viewer display settings (theme, reduced motion). They are conveniences: when
// browser storage is blocked the settings still apply for this visit.
export const PREFS_KEY='split-variable-tutorial:prefs:v1';
const THEMES=['auto','light','dark'];

export class PreferenceService {
  constructor({storage}={}){
    try{this.storage=storage===undefined?globalThis.localStorage:storage;}catch{this.storage=null;}
    this.values=this.read();
  }
  read(){
    try{
      const raw=this.storage?.getItem(PREFS_KEY);const value=raw?JSON.parse(raw):{};
      return {theme:THEMES.includes(value?.theme)?value.theme:'auto',motion:value?.motion==='reduce'?'reduce':'auto'};
    }catch{return {theme:'auto',motion:'auto'};}
  }
  get theme(){return this.values.theme;}
  get motion(){return this.values.motion;}
  nextTheme(){return THEMES[(THEMES.indexOf(this.values.theme)+1)%THEMES.length];}
  set(name,value){
    if(name==='theme'&&!THEMES.includes(value))throw Error('Unknown theme');
    if(name==='motion'&&!['auto','reduce'].includes(value))throw Error('Unknown motion setting');
    this.values={...this.values,[name]:value};
    try{this.storage?.setItem(PREFS_KEY,JSON.stringify(this.values));}catch{}
    return this.values;
  }
  apply(element){
    if(this.values.theme==='auto')delete element.dataset.theme;else element.dataset.theme=this.values.theme;
    if(this.values.motion==='reduce')element.dataset.motion='reduce';else delete element.dataset.motion;
  }
}
