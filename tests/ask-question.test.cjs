const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const source = html.slice(html.indexOf('async function askQuestion(){'), html.indexOf('window.__forceAsk ='));

function setup(retrieve, qa = async () => ({answer:'example', score:0.8})) {
  let pending;
  let cleared;
  let sourceRenders = 0;
  const button = {disabled:false};
  const context = {
    askBtn:button, askInput:{value:'What is the policy?'},
    state:{chunks:[{embedding:[1]}], docs:[], qa},
    looksLikeFragment:() => false, escapeHtml:s => s,
    qaCandidates:results => results.slice(0,1),
    addMsg:() => { pending = {textContent:'', isConnected:true, parentElement:{innerHTML:''}}; },
    performance:{now:() => 1}, roleSelect:{value:'public'},
    retrieve, renderSources:() => {sourceRenders++;}, sourcesPanel:{textContent:'old sources'}, window:{},
    document:{getElementById:() => pending}, Date, Set,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  vm.runInContext(html.match(/window\.__askChip = [^\r\n]+/)[0], context);
  vm.runInContext(html.slice(html.indexOf('window.__forceAsk ='), html.indexOf('window.__copyAnswer =')), context);
  return {context, button, clear:() => {if(pending) pending.isConnected=false; cleared=pending; pending=undefined;}, pending:() => pending, cleared:() => cleared, sourceRenders:() => sourceRenders};
}

test('retrieval failure restores Ask and replaces pending status', async () => {
  const app = setup(async () => {throw new Error('embedding failed');});
  await app.context.askQuestion();
  assert.equal(app.button.disabled, false);
  assert.match(app.pending().textContent, /could not finish/);
  assert.match(app.context.sourcesPanel.textContent, /No sources available/);
});
test('clearing chat during retrieval safely cancels rendering', async () => {
  let resolve;
  const app = setup(() => new Promise(r => {resolve=r;}));
  const running = app.context.askQuestion();
  app.clear(); resolve([]);
  await running;
  assert.equal(app.button.disabled, false);
  assert.equal(app.sourceRenders(), 0);
  assert.equal(app.cleared().parentElement.innerHTML, '');
  assert.equal(app.context.sourcesPanel.textContent, 'old sources');
});
test('clearing chat during QA safely cancels rendering', async () => {
  let resolve;
  let started;
  const ready = new Promise(r => {started=r;});
  let qaCalls = 0;
  const app = setup(async () => [{text:'example', docName:'sample'}, {text:'other', docName:'sample'}], () => new Promise(r => {qaCalls++; resolve=r; started();}));
  const running = app.context.askQuestion();
  await ready;
  app.clear(); resolve({answer:'example', score:0.8});
  await running;
  assert.equal(app.button.disabled, false);
  assert.equal(qaCalls, 1);
  assert.equal(app.cleared().parentElement.innerHTML, '');
  assert.equal(app.cleared().textContent, 'Extracting grounded answer…');
});
test('suggestion and forced question preserve drafts while Ask is busy', () => {
  const app = setup(async () => []);
  app.button.disabled=true;
  app.context.window.__askChip({textContent:'another question'});
  app.context.window.__forceAsk('fragment');
  assert.equal(app.context.askInput.value, 'What is the policy?');
  assert.equal(app.context.state.forcedQueries, undefined);
});
test('Enter or suggestion cannot start a duplicate in-flight question', async () => {
  const app = setup(async () => {throw new Error('must not be called');});
  app.button.disabled=true;
  await app.context.askQuestion();
  assert.equal(app.context.askInput.value, 'What is the policy?');
  assert.equal(app.pending(), undefined);
});
