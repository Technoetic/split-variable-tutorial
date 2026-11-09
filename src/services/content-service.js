import {validateTutorial,validatePractice,validateCode} from '../tutorial/content-model.js';
import {SHELL} from '../shared/shell-copy.js';

export const CONTENT_FILES=Object.freeze({tutorial:'data/tutorial.json',practice:'data/practice.json',code:'data/code.json'});
const VALIDATORS={tutorial:validateTutorial,practice:validatePractice,code:validateCode};

function abortError(){return new DOMException('A newer screen replaced this request','AbortError');}
function loadError(message,kind,cause){const error=new Error(message,{cause});error.kind=kind;error.userMessage=message;return error;}

// Loads tutorial data fresh from the app's own base URL. Each file has its own
// generation: a newer request for the same file cancels the older one, and a
// late answer from an older request is never returned.
export class ContentService {
  constructor({baseUrl,fetcher=globalThis.fetch.bind(globalThis),timeoutMs=7000,validators=VALIDATORS}){
    this.baseUrl=new URL(baseUrl);this.fetcher=fetcher;this.timeoutMs=timeoutMs;this.validators=validators;this.slots=new Map();
  }
  _slot(name){let slot=this.slots.get(name);if(!slot){slot={generation:0,controller:null};this.slots.set(name,slot);}return slot;}
  async load(name,{signal}={}){
    const file=CONTENT_FILES[name];if(!file)throw Error('Unknown content file '+name);
    const slot=this._slot(name);
    slot.controller?.abort();const controller=new AbortController();slot.controller=controller;
    const generation=++slot.generation;let timer,rejectAbort;
    if(signal?.aborted){slot.controller=null;throw abortError();}
    const abort=()=>controller.abort();
    const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(abortError());});
    controller.signal.addEventListener('abort',rejectAbort,{once:true});
    signal?.addEventListener('abort',abort,{once:true});
    try{
      const request=(async()=>{
        const response=await this.fetcher(new URL(file,this.baseUrl),{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw loadError(SHELL.loadError,'http');
        let body;
        try{body=await response.json();}catch(error){if(controller.signal.aborted)throw abortError();throw loadError(SHELL.loadError,'format',error);}
        if(controller.signal.aborted||generation!==slot.generation)throw abortError();
        try{return this.validators[name](body);}catch(error){throw loadError(SHELL.loadError,'format',error);}
      })();
      const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(loadError(SHELL.loadTimeout,'timeout'));controller.abort();},this.timeoutMs);});
      return await Promise.race([request,timeout,aborted]);
    }finally{
      clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',rejectAbort);
      if(slot.controller===controller)slot.controller=null;
    }
  }
  cancel(name){const slot=this.slots.get(name);if(!slot)return;slot.generation++;slot.controller?.abort();}
}
