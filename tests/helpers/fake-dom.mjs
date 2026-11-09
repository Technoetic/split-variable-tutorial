// A minimal document for mounting screens in Node. It models only what the screens
// use: elements, text, attributes, dataset, events with bubbling, focus and simple
// selectors (tag, .class, [attr], [attr="value"], descendant and comma lists).
const camelToData=name=>'data-'+name.replace(/[A-Z]/g,char=>'-'+char.toLowerCase());
const dataToCamel=name=>name.slice(5).replace(/-([a-z])/g,(whole,char)=>char.toUpperCase());

class FakeText {
  constructor(text,doc){this.nodeType=3;this.data=String(text);this.parentNode=null;this.ownerDocument=doc;}
  get textContent(){return this.data;}
  set textContent(value){this.data=String(value);}
  remove(){this.parentNode?._detach(this);}
}

class FakeElement {
  constructor(tag,doc){
    this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.parentNode=null;this.ownerDocument=doc;this.attributes=new Map();this.listeners=new Map();
    this.hidden=false;this.disabled=false;this.checked=false;this.value='';this.type='';this.tabIndex=-1;this.open=false;this.maxLength=-1;
    const element=this;
    this.dataset=new Proxy({},{
      get:(target,key)=>typeof key==='string'?element.attributes.get(camelToData(key)):undefined,
      set:(target,key,value)=>{element.attributes.set(camelToData(key),String(value));return true;},
      deleteProperty:(target,key)=>{element.attributes.delete(camelToData(key));return true;},
      has:(target,key)=>element.attributes.has(camelToData(key)),
      ownKeys:()=>[...element.attributes.keys()].filter(name=>name.startsWith('data-')).map(dataToCamel),
      getOwnPropertyDescriptor:(target,key)=>element.attributes.has(camelToData(key))?{enumerable:true,configurable:true,value:element.attributes.get(camelToData(key))}:undefined
    });
  }
  get className(){return this.attributes.get('class')??'';}
  set className(value){this.attributes.set('class',String(value));}
  get classList(){const element=this;return {contains:name=>element.className.split(/\s+/).includes(name)};}
  get id(){return this.attributes.get('id')??'';}
  get children(){return this.childNodes.filter(node=>node.nodeType===1);}
  get textContent(){return this.childNodes.map(node=>node.textContent).join('');}
  set textContent(value){this.replaceChildren(new FakeText(value,this.ownerDocument));}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.has(name)?this.attributes.get(name):null;}
  hasAttribute(name){return this.attributes.has(name);}
  removeAttribute(name){this.attributes.delete(name);}
  _attach(node){if(node.parentNode)node.parentNode._detach(node);node.parentNode=this;this.childNodes.push(node);}
  _detach(node){const index=this.childNodes.indexOf(node);if(index>=0)this.childNodes.splice(index,1);node.parentNode=null;}
  append(...nodes){for(const node of nodes)this._attach(typeof node==='object'?node:new FakeText(node,this.ownerDocument));}
  replaceChildren(...nodes){for(const node of [...this.childNodes])this._detach(node);this.append(...nodes);}
  remove(){this.parentNode?._detach(this);}
  addEventListener(type,handler){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(handler);}
  removeEventListener(type,handler){this.listeners.get(type)?.delete(handler);}
  dispatchEvent(event){
    if(!event.target)Object.defineProperty(event,'target',{value:this,configurable:true});
    for(let node=this;node;node=node.parentNode){for(const handler of [...(node.listeners?.get(event.type)??[])])handler.call(node,event);if(event.bubbles===false)break;}
    return !event.defaultPrevented;
  }
  click(){if(!this.disabled)this.dispatchEvent(new Event('click',{bubbles:true,cancelable:true}));}
  focus(){this.ownerDocument.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  *descendants(){for(const child of this.children){yield child;yield* child.descendants();}}
  matches(selector){return selector.split(',').some(part=>matchesComplex(this,part.trim()));}
  closest(selector){for(let node=this;node&&node.nodeType===1;node=node.parentNode)if(node.matches(selector))return node;return null;}
  querySelectorAll(selector){return [...this.descendants()].filter(node=>node.matches(selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
}

function matchesCompound(element,compound){
  const pattern=/([a-z][a-z\d-]*)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/gi;let match,consumed='';
  while((match=pattern.exec(compound))){
    consumed+=match[0];
    if(match[1]&&element.tagName!==match[1].toUpperCase())return false;
    if(match[2]&&!element.className.split(/\s+/).includes(match[2]))return false;
    if(match[3]){const value=element.getAttribute(match[3]);if(value===null)return false;if(match[4]!==undefined&&value!==match[4])return false;}
  }
  if(consumed!==compound)throw Error('Unsupported selector '+compound);
  return true;
}
function matchesComplex(element,selector){
  const parts=selector.split(/\s+/);if(!matchesCompound(element,parts.at(-1)))return false;
  let node=element.parentNode;
  for(let index=parts.length-2;index>=0;index--){
    while(node&&node.nodeType===1&&!matchesCompound(node,parts[index]))node=node.parentNode;
    if(!node||node.nodeType!==1)return false;node=node.parentNode;
  }
  return true;
}

export function installDom(){
  const doc={activeElement:null,title:'',createElement:tag=>new FakeElement(tag,doc),createTextNode:text=>new FakeText(text,doc)};
  const original=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,writable:true,value:doc});
  return {document:doc,restore(){if(original)Object.defineProperty(globalThis,'document',original);else delete globalThis.document;}};
}

export const text=node=>node.textContent.replace(/\s+/g,' ').trim();
