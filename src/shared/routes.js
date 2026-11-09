export function parseRoute(value=''){
  const raw=String(value).replace(/^#/,'')||'/';
  if(!raw.startsWith('/')||raw.startsWith('//')||raw.includes('\\'))return {path:'/missing',params:new URLSearchParams()};
  try{const url=new URL(raw,'https://route.invalid');return {path:url.pathname,params:url.searchParams};}
  catch{return {path:'/missing',params:new URLSearchParams()};}
}
export function routeUrl(value,baseUrl){
  const raw=String(value).replace(/^#/,'')||'/';
  const parsed=parseRoute(raw);const url=new URL(baseUrl);
  // toString() rather than URLSearchParams.size, which older browsers do not have.
  const query=parsed.params.toString();
  url.hash=parsed.path==='/missing'?'/missing':parsed.path+(query?'?'+query:'');
  return url;
}
