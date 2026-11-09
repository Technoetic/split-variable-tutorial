import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile),project=fileURLToPath(new URL('../',import.meta.url));

// Data stays out of the build ID: a data-only update must not force open tabs to
// switch documents. App code changes must still produce a new ID.
test('data-only changes keep the build ID; app changes replace it',async t=>{
  const parent=path.resolve(tmpdir()),fixture=await mkdtemp(path.join(parent,'split-variable-build-'));
  t.after(async()=>{assert.equal(path.dirname(fixture),parent);assert.ok(path.basename(fixture).startsWith('split-variable-build-'));await rm(fixture,{recursive:true,force:true});});
  for(const entry of ['scripts','src','assets','data','index.html','package.json'])await cp(path.join(project,entry),path.join(fixture,entry),{recursive:true});
  async function build(){await exec(process.execPath,[path.join(fixture,'scripts/build.mjs')],{cwd:fixture});return JSON.parse(await readFile(path.join(fixture,'dist/version.json'),'utf8')).buildId;}
  const first=await build();
  const file=path.join(fixture,'data/tutorial.json');const data=JSON.parse(await readFile(file,'utf8'));
  data.screens.home.title+=' (수정)';await writeFile(file,JSON.stringify(data,null,2)+'\n');
  const second=await build();
  assert.equal(second,first);
  assert.equal(JSON.parse(await readFile(path.join(fixture,'dist/data/tutorial.json'),'utf8')).screens.home.title,data.screens.home.title);
  const css=path.join(fixture,'src/styles/effects.css');await writeFile(css,(await readFile(css,'utf8'))+'\n/* app change */\n');
  const third=await build();
  assert.notEqual(third,first);
  const html=await readFile(path.join(fixture,'dist/index.html'),'utf8');assert.ok(html.includes(third));assert.ok(!html.includes('__BUILD_ID__'));
});

test('a data file that breaks the step edit chain stops the build',async t=>{
  const parent=path.resolve(tmpdir()),fixture=await mkdtemp(path.join(parent,'split-variable-build-'));
  t.after(async()=>{await rm(fixture,{recursive:true,force:true});});
  for(const entry of ['scripts','src','assets','data','index.html','package.json'])await cp(path.join(project,entry),path.join(fixture,entry),{recursive:true});
  const file=path.join(fixture,'data/code.json');const data=JSON.parse(await readFile(file,'utf8'));
  const main=data.examples.find(example=>example.id==='main');main.stages.find(stage=>stage.id==='after').source=main.stages.find(stage=>stage.id==='after').source.replace('waitMinutes + ','waitMinutes+');
  await writeFile(file,JSON.stringify(data,null,2)+'\n');
  await assert.rejects(exec(process.execPath,[path.join(fixture,'scripts/build.mjs')],{cwd:fixture}),/Invalid content/);
});
