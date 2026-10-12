const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function setup(embed = async () => [1]) {
  const messages = [];
  const context = {window:{}, state:{docs:[], chunks:[]}, docSeq:0, chunkSeq:0,
    ensureModels:async () => {}, embed, renderDocs:() => {}, refreshSuggestions:() => {},
    escapeHtml:s => s, addMsg:(_, msg) => messages.push(msg)};
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('function chunkWords('), html.indexOf('function roleCanSee(')), context);
  vm.runInContext(html.slice(html.indexOf('const MAX_FILE_BYTES'), html.indexOf('/* ---------------- rendering')), context);
  context.window = {};
  return {context, messages};
}

test('empty documents fail without downloading models or creating chunks', async () => {
  const app = setup();
  app.context.ensureModels = () => {throw new Error('should not load');};
  await app.context.addDocFromText('blank.txt', '   ', 'public');
  assert.equal(app.context.state.docs[0].status, 'failed');
  assert.equal(app.context.state.chunks.length, 0);
  assert.match(app.messages[0], /No readable text/);
});
test('failed embedding never publishes partially indexed text', async () => {
  let count=0;
  const app = setup(async () => {if(++count === 2) throw new Error('failed'); return [1];});
  await app.context.addDocFromText('file.txt', Array(150).fill('word').join(' '), 'public');
  assert.equal(app.context.state.docs[0].status, 'failed');
  assert.equal(app.context.state.chunks.length, 0);
});
test('removing a document during embedding cannot resurrect its chunks', async () => {
  let resolve, started;
  const ready = new Promise(r => {started=r;});
  const app = setup(() => new Promise(r => {resolve=r; started();}));
  const running = app.context.addDocFromText('removed.txt', 'some text', 'public');
  await ready;
  app.context.removeDoc(app.context.state.docs[0].id);
  resolve([1]);
  await running;
  assert.equal(app.context.state.docs.length, 0);
  assert.equal(app.context.state.chunks.length, 0);
});
test('PDF commits page provenance and destroys parser resources', async () => {
  const app = setup();
  let destroyed=false;
  app.context.pdfjsLib = {getDocument:() => ({promise:Promise.resolve({numPages:2,
    getPage:async p => ({getTextContent:async () => ({items:[{str:`page ${p}`} ]})}),
    destroy:async () => {destroyed=true;}})})};
  await app.context.addDocFromPDF({name:'source.pdf', arrayBuffer:async () => new ArrayBuffer(0)});
  assert.equal(app.context.state.docs[0].status, 'ready');
  assert.deepEqual(Array.from(app.context.state.chunks, c => c.page), [1,2]);
  assert.equal(destroyed, true);
});
test('oversized chunk count fails before model loading', async () => {
  const app = setup();
  app.context.ensureModels=() => {throw new Error('should not load');};
  await app.context.ingestDocument('long.txt', 'public', null, false, async () => Array(501).fill({page:1,text:'word'}));
  assert.equal(app.context.state.chunks.length, 0);
  assert.match(app.messages[0], /too long/);
});
test('model loading can retry after rejected download', async () => {
  let fail=true;
  const app={state:{modelsReady:false}, modelStatus:{}, modelPct:{}, modelBar:{style:{}}, askInput:{}, askBtn:{},
    reportProgress:() => {}, pipeline:async () => {if(fail) throw new Error('offline'); return () => {};}};
  vm.createContext(app);
  vm.runInContext('let modelsLoadingPromise = null;\n' + html.slice(html.indexOf('async function ensureModels('), html.indexOf('function reportProgress(')), app);
  await assert.rejects(app.ensureModels(), /offline/);
  fail=false;
  await app.ensureModels();
  assert.equal(app.state.modelsReady, true);
});
