import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {build,APP} from '../scripts/build.mjs';
import {createStaticServer,listen,portInUse,PREFIX} from '../scripts/server.mjs';

test('build embeds identity, rewrites the whole module graph and keeps older assets',async()=>{
  const a=await build({outDir:'.test-build',tag:'a'});
  const b=await build({outDir:'.test-build',tag:'b'});
  assert.match(a.buildId,/^sv-[a-f\d]{12}-a$/);assert.notEqual(a.buildId,b.buildId);
  const html=await readFile(path.join(APP,'.test-build/index.html'),'utf8');
  assert.ok(html.includes(`<meta name="app-build" content="${b.buildId}">`));assert.ok(!/__[A-Z_]+__/.test(html));
  assert.ok(html.includes(`src="./assets/main.${b.buildId}.js"`));assert.ok(html.includes(`href="./assets/app.${b.buildId}.css"`));
  const entry=await readFile(path.join(APP,'.test-build/assets/main.'+b.buildId+'.js'),'utf8');
  assert.ok(entry.includes(`./screens/screen-table.${b.buildId}.js`));assert.ok(!entry.includes("from './screens/screen-table.js'"));
  const nested=await readFile(path.join(APP,'.test-build/assets/screens/practice-screen.'+b.buildId+'.js'),'utf8');
  assert.ok(nested.includes(`../tutorial/practice-model.${b.buildId}.js`));
  const files=await readdir(path.join(APP,'.test-build/assets'));
  assert.ok(files.includes('main.'+a.buildId+'.js'));assert.ok(files.includes('sv-mark.'+b.buildId+'.svg'));
  assert.equal(JSON.parse(await readFile(path.join(APP,'.test-build/version.json'))).buildId,b.buildId);
  for(const name of ['tutorial','practice','code']){
    const written=JSON.parse(await readFile(path.join(APP,'.test-build/data',name+'.json'),'utf8'));
    assert.deepEqual(written,JSON.parse(await readFile(path.join(APP,'data',name+'.json'),'utf8')));
  }
});

test('build refuses output outside the app and unsafe tags',async()=>{
  await assert.rejects(build({outDir:'../outside'}),/app directory/);
  await assert.rejects(build({outDir:'src'}),/app directory/);
  await assert.rejects(build({outDir:'.test-build',tag:'../x'}),/tag/);
});

test('HTTP server serves real 404s and the document/asset cache boundary',async()=>{
  await build({outDir:'.test-build-http'});
  const server=createStaticServer({root:path.join(APP,'.test-build-http')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;const base=origin+PREFIX;
  try{
    const html=await fetch(base);assert.equal(html.status,200);assert.equal(html.headers.get('cache-control'),'no-store');
    assert.match(html.headers.get('content-security-policy'),/script-src 'self'/);
    const body=await html.text();const url=/src="([^"]+main[^"]+)"/.exec(body)[1];
    const asset=await fetch(new URL(url,base));assert.equal(asset.status,200);assert.match(asset.headers.get('cache-control'),/immutable/);
    for(const fresh of ['version.json','data/tutorial.json']){const response=await fetch(base+fresh);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');}
    for(const missing of ['assets/missing.js','assets/app.sv-000000000000.css','data/missing.json','api/nope','unrecognized-path','%E0%A4%A'])assert.ok([404,400].includes((await fetch(base+missing)).status),missing);
    assert.equal((await fetch(base+'assets/missing.js')).status,404);
    assert.equal((await fetch(origin+'/elsewhere/')).status,404);
    assert.equal((await fetch(base,{method:'POST'})).status,405);
    const redirect=await fetch(origin+'/split-variable-tutorial',{redirect:'manual'});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),PREFIX);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('the local server checks the port before binding and refuses a busy one',async()=>{
  const blocker=net.createServer();await new Promise(resolve=>blocker.listen(0,'127.0.0.1',resolve));
  const port=blocker.address().port;
  try{
    assert.equal(await portInUse(port),true);
    await assert.rejects(listen(createStaticServer({root:path.join(APP,'.test-build-http')}),port),/already in use/);
  }finally{await new Promise(resolve=>blocker.close(resolve));}
  assert.equal(await portInUse(port),false);
});
