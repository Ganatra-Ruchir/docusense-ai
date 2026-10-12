const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const source = html.slice(html.indexOf('async function askQuestion(){'), html.indexOf('window.__forceAsk ='));

function setup(retrieve, qa = async () => ({answer:'example', score:0.8})) {
  let pending;
  const button = {disabled:false};
  const context = {
    askBtn:button, askInput:{value:'What is the policy?'},
    state:{chunks:[{embedding:[1]}], docs:[], qa},
    looksLikeFragment:() => false, escapeHtml:s => s,
    addMsg:() => { pending = {textContent:'', isConnected:true, parentElement:{innerHTML:''}}; },
    performance:{now:() => 1}, roleSelect:{value:'public'},
    retrieve, renderSources:() => {},
    document:{getElementById:() => pending}, Date, Set,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {context, button, clear:() => {if(pending) pending.isConnected=false; pending=undefined;}, pending:() => pending};
}

test('retrieval failure restores Ask and replaces pending status', async () => {
  const app = setup(async () => {throw new Error('embedding failed');});
  await app.context.askQuestion();
  assert.equal(app.button.disabled, false);
  assert.match(app.pending().textContent, /could not finish/);
});
test('clearing chat during retrieval safely cancels rendering', async () => {
  let resolve;
  const app = setup(() => new Promise(r => {resolve=r;}));
  const running = app.context.askQuestion();
  app.clear(); resolve([]);
  await running;
  assert.equal(app.button.disabled, false);
});
test('clearing chat during QA safely cancels rendering', async () => {
  let resolve;
  let started;
  const ready = new Promise(r => {started=r;});
  const app = setup(async () => [{text:'example', docName:'sample'}], () => new Promise(r => {resolve=r; started();}));
  const running = app.context.askQuestion();
  await ready;
  app.clear(); resolve({answer:'example', score:0.8});
  await running;
  assert.equal(app.button.disabled, false);
});
test('Enter or suggestion cannot start a duplicate in-flight question', async () => {
  const app = setup(async () => {throw new Error('must not be called');});
  app.button.disabled=true;
  await app.context.askQuestion();
  assert.equal(app.context.askInput.value, 'What is the policy?');
  assert.equal(app.pending(), undefined);
});
