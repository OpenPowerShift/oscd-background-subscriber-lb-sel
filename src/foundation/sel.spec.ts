import { expect } from '@open-wc/testing';

import { loadFixture } from '../testing/fixtures.js';
import {
  fixtureName,
  phaseFcda,
  phaseStream,
  positionFcda,
  positionGoose,
  selInput
} from '../testing/sel.js';
import { isSelIed, planSel } from './sel.js';

describe('SEL', () => {
  let doc: XMLDocument;

  beforeEach(async () => {
    doc = await loadFixture(fixtureName);
  });

  const change = (
    action: 'subscribe' | 'unsubscribe',
    extRef: Element,
    fcda: Element,
    controlBlock: Element
  ) => ({
    version: 1,
    action,
    extRef,
    fcda,
    controlBlock,
    settings: { ignoreSupervision: false, checkOnlyPreferredBasicType: false },
    apply: () => undefined
  });

  const sinks = (bindings: { sink: Element }[]): (string | null)[] =>
    bindings.map(({ sink }) => sink.getAttribute('intAddr'));

  describe('isSelIed', () => {
    it('is true only for the manufacturer "SEL"', () => {
      const ied = doc.createElementNS(doc.documentElement.namespaceURI, 'IED');
      expect(isSelIed(ied)).to.equal(false);
      ['sel', 'SEL Inc', 'NRR'].forEach((manufacturer) => {
        ied.setAttribute('manufacturer', manufacturer);
        expect(isSelIed(ied), manufacturer).to.equal(false);
      });
      ied.setAttribute('manufacturer', 'SEL');
      expect(isSelIed(ied)).to.equal(true);
    });
  });

  describe('planSel', () => {
    it('subscribes the other phases of a sampled value input', () => {
      const planned = planSel(
        change('subscribe', selInput(doc, 'IAS'), phaseFcda(doc, 'I1'), phaseStream(doc))
      );
      expect(sinks(planned.subscribe)).to.deep.equal(['IBS', 'ICS']);
      expect(planned.unsubscribe).to.deep.equal([]);
    });

    it('unsubscribes the other phases of a sampled value input', () => {
      const planned = planSel(
        change('unsubscribe', selInput(doc, 'IAS'), phaseFcda(doc, 'I1'), phaseStream(doc))
      );
      expect(planned.subscribe).to.deep.equal([]);
      expect(sinks(planned.unsubscribe)).to.deep.equal(['IBS', 'ICS']);
    });

    it('subscribes the next input of a double position', () => {
      const planned = planSel(
        change('subscribe', selInput(doc, 'VB001'), positionFcda(doc, 1), positionGoose(doc))
      );
      expect(sinks(planned.subscribe)).to.deep.equal(['VB002']);
    });
  });
});
