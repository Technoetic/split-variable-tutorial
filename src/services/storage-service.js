import {validateDraftShape} from '../tutorial/practice-model.js';

// The only saved learner state: the practice draft, kept in this browser.
export const DRAFT_KEY='split-variable-tutorial:practice-draft:v1';

const clone=value=>JSON.parse(JSON.stringify(value));

export class StorageService {
  constructor(options={}){
    this.pending=0;this.lastError=null;this.queue=Promise.resolve();this.storage=null;this.unavailable=null;
    try{this.storage=Object.hasOwn(options,'storage')?options.storage:globalThis.localStorage;}
    catch(error){this.unavailable=error;}
  }
  get saving(){return this.pending>0;}
  get available(){try{this._storage();return true;}catch{return false;}}
  _storage(){if(this.unavailable)throw this.unavailable;if(!this.storage)throw Error('이 브라우저에서 저장소에 접근할 수 없어요.');return this.storage;}
  // Reads validate and hand out private copies; a damaged value is reported and left in place.
  async _read(key,validate){
    try{
      const source=await this._storage().getItem(key);
      const value=source===null||source===undefined?null:validate(JSON.parse(source));
      this.lastError=null;return value===null?null:clone(value);
    }catch(error){this.lastError=error;throw error;}
  }
  // Writes run one at a time; a failed write is never reported as saved.
  async _write(action){
    this.pending++;
    const operation=this.queue.then(action);
    this.queue=operation.catch(()=>{});
    try{const value=await operation;this.lastError=null;return value;}
    catch(error){this.lastError=error;throw error;}
    finally{this.pending--;}
  }
  async loadDraft(validate=validateDraftShape){return this._read(DRAFT_KEY,validate);}
  async saveDraft(draft,validate=validateDraftShape){
    let serialized;
    try{serialized=JSON.stringify(validate(clone(draft)));}
    catch(error){this.lastError=error;throw error;}
    return this._write(async()=>{await this._storage().setItem(DRAFT_KEY,serialized);});
  }
  async clearDraft(){return this._write(async()=>{await this._storage().removeItem(DRAFT_KEY);});}
}
