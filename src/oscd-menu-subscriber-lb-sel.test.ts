import { fixture, html } from '@open-wc/testing';
import { setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';

import OscdMenuSubscriberLbSel from './oscd-menu-subscriber-lb-sel.js';
import { selStorageKey } from './foundation/sel.js';

/**
 * Screenshot tests for how the dialog looks. What the plugin does is checked
 * by the `*.spec.ts` files.
 *
 * Baselines are owned by CI and must not be created or updated locally, see
 * `.github/workflows/update-visual-baselines.yml`.
 */

const tagName = 'oscd-menu-subscriber-lb-sel-test';
if (customElements.get(tagName) === undefined) {
  customElements.define(tagName, OscdMenuSubscriberLbSel);
}

describe('oscd-menu-subscriber-lb-sel screenshots', () => {
  before(async () => {
    await setViewport({ width: 800, height: 600 });
  });

  async function openDialog(): Promise<void> {
    await Promise.all([
      document.fonts.load('400 16px Roboto'),
      document.fonts.load('24px "Material Symbols Outlined"')
    ]);
    const plugin = await fixture<OscdMenuSubscriberLbSel>(
      html`<oscd-menu-subscriber-lb-sel-test></oscd-menu-subscriber-lb-sel-test>`
    );
    await plugin.run();
    await document.fonts.ready;
  }

  it('shows the dialog enabled', async () => {
    localStorage.removeItem(selStorageKey);
    await openDialog();
    await visualDiff(document.body, 'dialog enabled');
  });

  it('shows the dialog disabled', async () => {
    localStorage.setItem(selStorageKey, 'false');
    await openDialog();
    await visualDiff(document.body, 'dialog disabled');
    localStorage.removeItem(selStorageKey);
  });
});
