import { expect } from '@open-wc/testing';
import { restore, stub } from 'sinon';

import { loadEnabled, storeEnabled } from './settings.js';

const key = 'oscd-companion-settings-spec';

describe('companion settings', () => {
  afterEach(() => {
    restore();
    localStorage.removeItem(key);
  });

  it('are enabled by default', () => {
    expect(loadEnabled(key)).to.equal(true);
  });

  it('keep whether the companion is enabled', () => {
    storeEnabled(key, false);
    expect(loadEnabled(key)).to.equal(false);
    storeEnabled(key, true);
    expect(loadEnabled(key)).to.equal(true);
  });

  it('are enabled when storage cannot be read', () => {
    stub(Storage.prototype, 'getItem').throws(new Error('denied'));
    expect(loadEnabled(key)).to.equal(true);
  });

  it('ignore storage which cannot be written', () => {
    stub(Storage.prototype, 'setItem').throws(new Error('denied'));
    expect(() => storeEnabled(key, false)).not.to.throw();
  });
});
