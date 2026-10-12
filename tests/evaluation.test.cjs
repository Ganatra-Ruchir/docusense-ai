const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
test('evaluation failure restores Run and hides stale metrics', async () => {
  const elements = Object.fromEntries(['runEvalBtn','evalHint','evalMetrics','evalTable'].map(id => [id,{style:{display:'visible'}}]));
  const context = {$:id => elements[id], state:{docs:[{name:'test', status:'ready'}]},
    GOLDEN_EVAL:[{doc:'test', q:'question'}], performance:{now:() => 1},
    retrieve:async () => {throw new Error('offline');}};
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('async function runEvaluation('), html.indexOf('/* ---------------- event wiring')), context);
  await context.runEvaluation();
  assert.equal(elements.runEvalBtn.disabled, false);
  assert.match(elements.evalHint.textContent, /failed/);
  assert.equal(elements.evalMetrics.style.display, 'none');
  assert.equal(elements.evalTable.style.display, 'none');
});
