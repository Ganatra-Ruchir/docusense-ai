const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(html.slice(html.indexOf('function qaCandidates('), html.indexOf('// Extractive QA models')), context);
test('answer extraction cannot switch to a lower-ranked unrelated document', () => {
  const sources=[{docName:'Storage', score:0.8}, {docName:'Revenue', score:0.1}];
  const chosen=context.qaCandidates(sources);
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0], sources[0]);
});
test('numeric punctuation spacing is normalized without dropping digits', () => {
  assert.equal(context.answerMatches('42. 3 crore rupees', ['42.3']), true);
  assert.equal(context.answerMatches('AES - 256', ['AES-256']), true);
  assert.equal(context.answerMatches('423 crore', ['42.3']), false);
});
