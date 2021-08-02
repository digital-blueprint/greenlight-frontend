import {assert} from 'chai';

import '../src/dbp-activate-green-pass.js';
import '../src/dbp-greenlight.js';
import {parseQRCode} from '../src/utils.js';

suite('dbp-activate-green-pass basics', () => {
  let node;

  suiteSetup(async () => {
    node = document.createElement('dbp-activate-green-pass');
    document.body.appendChild(node);
    await node.updateComplete;
  });

  suiteTeardown(() => {
    node.remove();
  });

  test('should render', () => {
    assert(node.shadowRoot !== undefined);
  });
});

suite('dbp-greenlight-app basics', () => {
  let node;

  suiteSetup(async () => {
    node = document.createElement('dbp-app');
    document.body.appendChild(node);
    await node.updateComplete;
  });

  suiteTeardown(() => {
    node.remove();
  });

  test('should render', () => {
    assert(node.shadowRoot !== undefined);
  });
});

suite('parseQRCode', () => {
    test('ok', () => {
        assert.deepEqual(parseQRCode('foo: -loc-1', 'foo'), ['loc', 1]);
        assert.deepEqual(parseQRCode("bla foo \n foo: -loc-1", 'foo'), ['loc', 1]);
        assert.deepEqual(parseQRCode("bla foo \n foo: -loc-0", 'foo'), ['loc', 0]);
        assert.deepEqual(parseQRCode("bla foo \n foo: -loc-42 ", 'foo'), ['loc', 42]);
        assert.deepEqual(parseQRCode("bla foo \n foo: -loc-", 'foo'), ['loc', null]);
        assert.deepEqual(parseQRCode("bla foo \n foo: -loc", 'foo'), ['loc', null]);
    });

    test('not ok', () => {
        assert.throws(() => parseQRCode('asdad', 'foo'));
        assert.throws(() => parseQRCode('foo:', 'foo'));
        assert.throws(() => parseQRCode('foo: -', 'foo'));
        assert.throws(() => parseQRCode('foo: -loc-bla', 'foo'));
        assert.throws(() => parseQRCode('foo: --', 'foo'));
        assert.throws(() => parseQRCode('foo: -loc-1-', 'foo'));
        assert.throws(() => parseQRCode('foo: -loc-1-3', 'foo'));
    });
});