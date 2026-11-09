// The app owns which screen answers which hash path. data/tutorial.json supplies the
// titles and the reading order for the same paths; tests keep the two lists equal.
export const STEP_COUNT=5;

export const ROUTE_TABLE=Object.freeze([
  {path:'/',screen:'home'},
  {path:'/story',screen:'story'},
  {path:'/smell',screen:'smell'},
  {path:'/steps',screen:'steps'},
  ...Array.from({length:STEP_COUNT},(_,index)=>({path:'/steps/'+(index+1),screen:'step',step:index+1})),
  {path:'/exceptions',screen:'exceptions'},
  {path:'/parameter',screen:'parameter'},
  {path:'/practice',screen:'practice'},
  {path:'/code',screen:'code'},
  {path:'/summary',screen:'summary'},
  {path:'/missing',screen:'notFound'}
].map(entry=>Object.freeze(entry)));

const byPath=new Map(ROUTE_TABLE.map(entry=>[entry.path,entry]));

export function routeFor(path){return byPath.get(path)||byPath.get('/missing');}
export function isScreenPath(path){return byPath.has(path);}
