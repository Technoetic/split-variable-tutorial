import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {APP,build} from './build.mjs';

export const PREFIX='/split-variable-tutorial/';
export const DEFAULT_PORT=8812;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};

export function createStaticServer({root=path.join(APP,'dist'),prefix=PREFIX,rootProvider=null,before=null}={}){
  return http.createServer(async(request,response)=>{
    try{
      if(before&&await before(request,response))return;
      const url=new URL(request.url,'http://127.0.0.1');
      if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{Allow:'GET, HEAD','Content-Type':'text/plain; charset=utf-8'});response.end('Method not allowed');return;}
      if(url.pathname==='/'||url.pathname===prefix.slice(0,-1)){response.writeHead(302,{Location:prefix,'Cache-Control':'no-store'});response.end();return;}
      if(!url.pathname.startsWith(prefix)){response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});response.end('Not found');return;}
      const currentRoot=path.resolve(rootProvider?await rootProvider(request):root);
      const relative=decodeURIComponent(url.pathname.slice(prefix.length))||'index.html';
      const file=path.resolve(currentRoot,relative);
      if(!file.startsWith(currentRoot+path.sep)){response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});response.end('Not found');return;}
      const info=await stat(file).catch(()=>null);
      if(!info?.isFile()){response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});response.end('Not found');return;}
      const body=await readFile(file);const extension=path.extname(file);const etag='"'+createHash('sha256').update(body).digest('hex')+'"';
      // Build-named assets never change; the page, version.json and data are always re-fetched.
      const immutable=relative.startsWith('assets/');
      const headers={'Content-Type':types[extension]||'application/octet-stream','Content-Length':body.length,'Cache-Control':immutable?'public, max-age=31536000, immutable':'no-store',ETag:etag,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
      if(extension==='.html')headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
      if(immutable&&request.headers['if-none-match']===etag){response.writeHead(304,headers);response.end();return;}
      response.writeHead(200,headers);response.end(request.method==='HEAD'?undefined:body);
    }catch(error){response.writeHead(error instanceof URIError?400:500,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});response.end(error instanceof URIError?'Invalid path':'Unable to serve this file');}
  });
}

// Probe before binding: anything that accepts a connection on the port counts as in
// use. A refused connection means free (Windows answers a closed loopback port only
// after about two seconds, so the timeout leaves room for that).
export function portInUse(port,host='127.0.0.1',timeoutMs=4000){
  return new Promise(resolve=>{
    const socket=net.connect({port,host});let settled=false;
    const done=value=>{if(settled)return;settled=true;socket.destroy();resolve(value);};
    socket.once('connect',()=>done(true));
    socket.once('error',error=>done(error.code!=='ECONNREFUSED'));
    socket.setTimeout(timeoutMs,()=>done(true));
  });
}
const busy=(port,host)=>Error(`Port ${port} on ${host} is already in use. Choose another with --port.`);

export function bind(server,port,host='127.0.0.1'){
  return new Promise((resolve,reject)=>{
    const failed=error=>{server.off('listening',ready);reject(error.code==='EADDRINUSE'?busy(port,host):error);};
    const ready=()=>{server.off('error',failed);resolve(server);};
    server.once('error',failed);server.once('listening',ready);server.listen({port,host});
  });
}

export async function listen(server,port,host='127.0.0.1'){
  if(await portInUse(port,host))throw busy(port,host);
  return bind(server,port,host);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const i=process.argv.indexOf('--port');const port=i>=0?Number(process.argv[i+1]):DEFAULT_PORT;
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
  if(await portInUse(port))throw busy(port,'127.0.0.1');
  await build();
  await bind(createStaticServer(),port);
  console.log(`SPLIT / VARIABLE Local: http://127.0.0.1:${port}${PREFIX}`);
}
