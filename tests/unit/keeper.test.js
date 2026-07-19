const test = require('node:test');
const assert = require('node:assert/strict');
const { specText, specHtml } = require('../../src/core/keeper');

const run = {
  creationId: 'creation_keeper',
  styleId: 'paper-certificate',
  concept: {
    appName: 'Bark Exchange',
    premise: 'A deadpan kiosk reads a dog and a rate as an omen.',
    playerAction: 'Press the kiosk button to receive the omen.',
    causalChain: [{ order: 1, apiId: 'dog-ceo', action: 'read dog' }, { order: 2, apiId: 'frankfurter', action: 'read rate' }],
    apiRoles: [{ apiId: 'dog-ceo', essentialRole: 'The dog supplies the omen.', operations: ['random'] }],
    dependency: { fromApiId: 'dog-ceo', to: 'rules', toApiId: 'frankfurter', explanation: 'The dog changes the rate reading.' },
    interaction: { controls: ['press'], outcome: 'The kiosk reveals an omen.' },
    visualDirection: { style: 'deadpan kiosk', palette: 'ink and saffron', typography: 'editorial serif', motion: 'stamps' },
    noveltyDelta: 'The APIs become causes, not a dashboard.'
  }
};

test('keeper spec sheet includes the accepted concept contract without raw artifact HTML', () => {
  const text = specText(run);
  assert.match(text, /Bark Exchange/);
  assert.match(text, /dog-ceo/);
  assert.match(text, /causal chain/i);
  assert.match(text, /paper-certificate/);
  assert.doesNotMatch(text, /<html/i);
  const html = specHtml(run);
  assert.match(html, /Bark Exchange/);
  assert.match(html, /href="\/creation\.css"/);
  assert.match(html, /class="rw-shell"/);
  assert.match(html, /rw-chrome rw-record rw-keeper/);
  assert.match(html, /class="rw-stamp"/);
  assert.match(html, /class="rw-dataflow"/);
  assert.match(html, /<table/);
  assert.match(html, /href="\/c\/creation_keeper"/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /<style/i);
});
