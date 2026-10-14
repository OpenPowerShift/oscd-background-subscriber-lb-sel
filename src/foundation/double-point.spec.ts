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
import { doublePointBindings } from './double-point.js';

describe('doublePointBindings', () => {
  let doc: XMLDocument;

  beforeEach(async () => {
    doc = await loadFixture(fixtureName);
  });

  const bindings = (intAddr: string, fcda = positionFcda(doc, 1)) =>
    doublePointBindings({
      sink: selInput(doc, intAddr),
      fcda,
      controlBlock: positionGoose(doc)
    });

  it('binds the next input to the same double position', () => {
    const [binding, ...others] = bindings('VB001');
    expect(others).to.deep.equal([]);
    expect(binding.sink).to.equal(selInput(doc, 'VB002'));
    expect(binding.fcda).to.equal(positionFcda(doc, 1));
    expect(binding.controlBlock).to.equal(positionGoose(doc));
  });

  it('binds nothing for data which is not a double position', () => {
    expect(
      doublePointBindings({
        sink: selInput(doc, 'IAS'),
        fcda: phaseFcda(doc, 'I1'),
        controlBlock: phaseStream(doc)
      })
    ).to.deep.equal([]);
  });

  it('binds nothing if the next input is of another service type', () => {
    selInput(doc, 'VB002').setAttribute('serviceType', 'SMV');
    expect(bindings('VB001')).to.deep.equal([]);
  });

  it('binds nothing if the next input has no internal address', () => {
    selInput(doc, 'VB002').removeAttribute('intAddr');
    expect(bindings('VB001')).to.deep.equal([]);
  });

  it('binds nothing if there is no next input', () => {
    const last = selInput(doc, 'VB001');
    last.parentElement!.append(last);
    expect(bindings('VB001')).to.deep.equal([]);
  });

  it('binds nothing if the next element is not an input', () => {
    const extRef = selInput(doc, 'VB001');
    extRef.after(doc.createElementNS(extRef.namespaceURI, 'Private'));
    expect(bindings('VB001')).to.deep.equal([]);
  });
});
