import { expect, fixture, html } from '@open-wc/testing';

import OscdMenuSubscriberLbSel from './oscd-menu-subscriber-lb-sel.js';
import {
  companionAnnounceEventName,
  companionWithdrawEventName
} from './companion/protocol.js';
import type {
  CompanionAnnounceEvent,
  CompanionWithdrawEvent
} from './companion/protocol.js';
import { selIdentity, selStorageKey } from './foundation/sel.js';
import { loadFixture } from './testing/fixtures.js';
import { LaterBindingStandIn } from './testing/later-binding.js';
import {
  fixtureName,
  phaseFcda,
  phaseStream,
  positionFcda,
  positionGoose,
  selInput,
  subscription
} from './testing/sel.js';

const tagName = 'oscd-menu-subscriber-lb-sel-spec';
if (customElements.get(tagName) === undefined) {
  customElements.define(tagName, OscdMenuSubscriberLbSel);
}

describe('Subscriber Later Binding - SEL', () => {
  let doc: XMLDocument;
  let plugin: OscdMenuSubscriberLbSel;
  let laterBinding: LaterBindingStandIn;

  const serialize = (): string => new XMLSerializer().serializeToString(doc);

  const prefixOf = (intAddr: string): string | undefined =>
    subscription(selInput(doc, intAddr)).prefix;

  async function mount(): Promise<void> {
    plugin = await fixture<OscdMenuSubscriberLbSel>(
      html`<oscd-menu-subscriber-lb-sel-spec
        .doc=${doc}
        docName="sel.scd"
      ></oscd-menu-subscriber-lb-sel-spec>`
    );
  }

  beforeEach(async () => {
    localStorage.removeItem(selStorageKey);
    doc = await loadFixture(fixtureName);
    laterBinding = new LaterBindingStandIn();
    await mount();
  });

  describe('sampled values', () => {
    it('subscribes the other phases with the first', () => {
      laterBinding.subscribe(selInput(doc, 'IAS'), phaseFcda(doc, 'I1'), phaseStream(doc));
      expect(['IAS', 'IBS', 'ICS'].map(prefixOf)).to.deep.equal(['I1', 'I2', 'I3']);
    });

    it('subscribes voltages to the voltage phases', () => {
      laterBinding.subscribe(selInput(doc, 'VAZ'), phaseFcda(doc, 'U1'), phaseStream(doc));
      expect(['VAZ', 'VBZ', 'VCZ'].map(prefixOf)).to.deep.equal(['U1', 'U2', 'U3']);
    });

    it('does not subscribe the neutral', () => {
      laterBinding.subscribe(selInput(doc, 'IAS'), phaseFcda(doc, 'I1'), phaseStream(doc));
      expect(
        Array.from(doc.querySelectorAll('ExtRef[prefix="I4"]'))
      ).to.deep.equal([]);
    });

    it('is one undoable edit with the subscription', () => {
      const before = serialize();
      laterBinding.subscribe(selInput(doc, 'IAS'), phaseFcda(doc, 'I1'), phaseStream(doc));
      expect(laterBinding.editor.past).to.have.length(1);
      expect(laterBinding.editor.past[0].title).to.equal('SEL subscribe');

      laterBinding.editor.undo();
      expect(serialize()).to.equal(before);

      laterBinding.editor.redo();
      expect(['IAS', 'IBS', 'ICS'].map(prefixOf)).to.deep.equal(['I1', 'I2', 'I3']);
    });

    it('unsubscribes the other phases with the first in one undoable edit', () => {
      laterBinding.subscribe(selInput(doc, 'IAS'), phaseFcda(doc, 'I1'), phaseStream(doc));
      const subscribed = serialize();

      laterBinding.unsubscribe(selInput(doc, 'IAS'), phaseFcda(doc, 'I1'));
      expect(['IAS', 'IBS', 'ICS'].map(prefixOf)).to.deep.equal([
        undefined,
        undefined,
        undefined
      ]);
      expect(laterBinding.editor.past).to.have.length(2);
      expect(laterBinding.editor.past[1].title).to.equal('SEL unsubscribe');

      laterBinding.editor.undo();
      expect(serialize()).to.equal(subscribed);
    });

    it('leaves a phase which is subscribed to something else', () => {
      laterBinding.subscribe(selInput(doc, 'ICS'), phaseFcda(doc, 'I1'), phaseStream(doc));
      laterBinding.subscribe(selInput(doc, 'IAS'), phaseFcda(doc, 'I1'), phaseStream(doc));
      expect(['IAS', 'IBS', 'ICS'].map(prefixOf)).to.deep.equal(['I1', 'I2', 'I1']);

      laterBinding.unsubscribe(selInput(doc, 'IAS'), phaseFcda(doc, 'I1'));
      expect(['IAS', 'IBS', 'ICS'].map(prefixOf)).to.deep.equal([
        undefined,
        undefined,
        'I1'
      ]);
    });
  });

  describe('double positions', () => {
    it('subscribes the next input to the same position', () => {
      laterBinding.subscribe(selInput(doc, 'VB001'), positionFcda(doc, 1), positionGoose(doc));
      expect(subscription(selInput(doc, 'VB002'))).to.deep.equal(
        subscription(selInput(doc, 'VB001'))
      );
      expect(laterBinding.editor.past).to.have.length(1);
    });

    it('unsubscribes the next input with the first', () => {
      laterBinding.subscribe(selInput(doc, 'VB001'), positionFcda(doc, 1), positionGoose(doc));
      laterBinding.unsubscribe(selInput(doc, 'VB001'), positionFcda(doc, 1));
      expect(subscription(selInput(doc, 'VB002'))).to.deep.equal({});
    });

    it('leaves the next input if it is subscribed to another position', () => {
      laterBinding.subscribe(selInput(doc, 'VB002'), positionFcda(doc, 2), positionGoose(doc));
      laterBinding.subscribe(selInput(doc, 'VB001'), positionFcda(doc, 1), positionGoose(doc));
      laterBinding.unsubscribe(selInput(doc, 'VB001'), positionFcda(doc, 1));
      expect(subscription(selInput(doc, 'VB002')).lnInst).to.equal('2');
    });
  });

  describe('when it does nothing', () => {
    it('does nothing when disabled', () => {
      plugin.enabled = false;
      laterBinding.subscribe(selInput(doc, 'IAS'), phaseFcda(doc, 'I1'), phaseStream(doc));
      expect(prefixOf('IBS')).to.equal(undefined);
      expect(laterBinding.appliedTitles).to.deep.equal([]);
    });

    it('does nothing when external plugins are not allowed', () => {
      laterBinding.allowExternalPlugins = false;
      laterBinding.subscribe(selInput(doc, 'IAS'), phaseFcda(doc, 'I1'), phaseStream(doc));
      expect(prefixOf('IBS')).to.equal(undefined);
    });

    it('does nothing for other manufacturers', () => {
      selInput(doc, 'IAS').closest('IED')!.setAttribute('manufacturer', 'SIEMENS');
      laterBinding.subscribe(selInput(doc, 'IAS'), phaseFcda(doc, 'I1'), phaseStream(doc));
      expect(prefixOf('IBS')).to.equal(undefined);
    });

    it('does nothing once removed from the page', () => {
      plugin.remove();
      laterBinding.subscribe(selInput(doc, 'IAS'), phaseFcda(doc, 'I1'), phaseStream(doc));
      expect(prefixOf('IBS')).to.equal(undefined);
    });
  });

  describe('dialog', () => {
    const switchOf = (): HTMLElement & { selected: boolean } =>
      plugin.shadowRoot!.querySelector('oscd-switch')!;

    const dialogOf = (): HTMLElement & { open: boolean } =>
      plugin.shadowRoot!.querySelector('oscd-dialog')!;

    it('reflects its identity', () => {
      expect(plugin.getAttribute('identity')).to.equal(selIdentity);
    });

    it('is enabled by default', () => {
      expect(plugin.enabled).to.equal(true);
      expect(switchOf().selected).to.equal(true);
    });

    it('opens when run', async () => {
      await plugin.run();
      expect(dialogOf().open).to.equal(true);
    });

    it('closes with its button', async () => {
      await plugin.run();
      (plugin.shadowRoot!.querySelector('oscd-text-button') as HTMLElement).click();
      await new Promise((resolve) => {
        dialogOf().addEventListener('closed', resolve, { once: true });
      });
      expect(dialogOf().open).to.equal(false);
    });

    it('is turned off with its switch, which is kept and announced', async () => {
      const announced: CompanionAnnounceEvent['detail'][] = [];
      const listener = (event: CompanionAnnounceEvent): void => {
        announced.push(event.detail);
      };
      window.addEventListener(companionAnnounceEventName, listener);
      await plugin.run();
      switchOf().click();
      await plugin.updateComplete;
      window.removeEventListener(companionAnnounceEventName, listener);

      expect(plugin.enabled).to.equal(false);
      expect(localStorage.getItem(selStorageKey)).to.equal('false');
      expect(announced).to.deep.equal([
        { version: 1, identity: selIdentity, name: 'SEL', enabled: false }
      ]);
    });

    it('starts as it was left', async () => {
      localStorage.setItem(selStorageKey, 'false');
      await mount();
      expect(plugin.enabled).to.equal(false);
    });

    it('announces itself to the Subscriber Later Binding plugin', async () => {
      const announced: CompanionAnnounceEvent['detail'][] = [];
      const listener = (event: CompanionAnnounceEvent): void => {
        announced.push(event.detail);
      };
      window.addEventListener(companionAnnounceEventName, listener);
      laterBinding.request();
      window.removeEventListener(companionAnnounceEventName, listener);
      expect(announced).to.deep.equal([
        { version: 1, identity: selIdentity, name: 'SEL', enabled: true }
      ]);
    });

    it('withdraws when removed from the page', () => {
      const withdrawn: CompanionWithdrawEvent['detail'][] = [];
      const listener = (event: CompanionWithdrawEvent): void => {
        withdrawn.push(event.detail);
      };
      window.addEventListener(companionWithdrawEventName, listener);
      plugin.remove();
      window.removeEventListener(companionWithdrawEventName, listener);
      expect(withdrawn).to.deep.equal([{ version: 1, identity: selIdentity }]);
    });
  });
});
