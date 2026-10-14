import { expect } from '@open-wc/testing';

import { mustQuery, parseScl } from '../testing/scl.js';
import {
  parsePhaseAddress,
  sampledValueBindings,
  sampledValueRun
} from './sampled-values.js';

/** A value and quality FCDA of one phase of a merging unit. */
function phase(
  prefix: string,
  inst: string,
  { lnClass = 'TCTR', doName = 'AmpSv', fc = 'MX', quality = 'q' } = {}
): string {
  const data = `ldInst="MUSV" prefix="${prefix}" lnClass="${lnClass}" lnInst="${inst}" doName="${doName}" fc="${fc}"`;
  return `<FCDA ${data} daName="instMag.i"/><FCDA ${data} daName="${quality}"/>`;
}

/** An SEL relay with inputs in LLN0 and a merging unit publishing `fcdas`. */
function scl(fcdas: string, inputs = defaultInputs): XMLDocument {
  return parseScl(`
    <IED name="SEL" manufacturer="SEL"><AccessPoint name="AP"><Server>
      <LDevice inst="CFG"><LN0 lnClass="LLN0" inst="" lnType="T">
        <Inputs>${inputs}</Inputs>
      </LN0></LDevice>
    </Server></AccessPoint></IED>
    <IED name="MU" manufacturer="NRR"><AccessPoint name="AP"><Server>
      <LDevice inst="MUSV"><LN0 lnClass="LLN0" inst="" lnType="T">
        <DataSet name="PhsMeas1">${fcdas}</DataSet>
        <SampledValueControl name="PhsMeas1" datSet="PhsMeas1"/>
      </LN0></LDevice>
    </Server></AccessPoint></IED>`);
}

const input = (intAddr: string, serviceType = 'SMV'): string =>
  `<ExtRef intAddr="${intAddr}" serviceType="${serviceType}"/>`;

const defaultInputs = ['IAS', 'IAS_2', 'IBS', 'IBS_2', 'ICS', 'ICS_2', 'VAZ', 'VBZ', 'VCZ']
  .map(intAddr => input(intAddr))
  .join('');

const threePhases = phase('I1', '1') + phase('I2', '2') + phase('I3', '3');

const fcdaOf = (doc: XMLDocument, prefix: string): Element =>
  mustQuery(doc, `FCDA[prefix="${prefix}"][daName="instMag.i"]`);

const prefixes = (fcdas: Element[]): (string | null)[] =>
  fcdas.map(fcda => fcda.getAttribute('prefix'));

describe('sampled values', () => {
  describe('parsePhaseAddress', () => {
    it('reads the transducer, phase and terminal', () => {
      expect(parsePhaseAddress('IBU_2')).to.deep.equal({
        transducer: 'I',
        phase: 1,
        terminal: 'U_2'
      });
      expect(parsePhaseAddress('VCZ')).to.deep.equal({
        transducer: 'V',
        phase: 2,
        terminal: 'Z'
      });
    });

    it('is undefined for other inputs', () => {
      ['IY1', 'INS', 'XAS', 'VB001', 'IA', 'IAS_', 'IASX', ''].forEach(intAddr =>
        expect(parsePhaseAddress(intAddr), intAddr).to.equal(undefined)
      );
    });
  });

  describe('sampledValueRun', () => {
    it('finds the value of each phase, where the prefix may differ', () => {
      const doc = scl(threePhases);
      expect(prefixes(sampledValueRun(fcdaOf(doc, 'I1')))).to.deep.equal([
        'I1',
        'I2',
        'I3'
      ]);
    });

    it('has at most three phases, as there is no neutral for SEL', () => {
      const doc = scl(threePhases + phase('I4', '4'));
      expect(sampledValueRun(fcdaOf(doc, 'I1'))).to.have.length(3);
    });

    it('starts at the FCDA it is given', () => {
      const doc = scl(threePhases);
      expect(prefixes(sampledValueRun(fcdaOf(doc, 'I2')))).to.deep.equal([
        'I2',
        'I3'
      ]);
    });

    it('stops at another logical node class or data object', () => {
      const doc = scl(
        phase('I1', '1') +
          phase('U1', '1', { lnClass: 'TVTR', doName: 'VolSv' }) +
          phase('I2', '2')
      );
      expect(sampledValueRun(fcdaOf(doc, 'I1'))).to.have.length(1);
    });

    it('stops where a value is not followed by its quality', () => {
      const doc = scl(phase('I1', '1') + phase('I2', '2', { quality: 't' }));
      expect(sampledValueRun(fcdaOf(doc, 'I1'))).to.have.length(1);
    });

    it('stops where the instance decreases or is not a number', () => {
      expect(
        sampledValueRun(fcdaOf(scl(phase('I1', '2') + phase('I2', '1')), 'I1'))
      ).to.have.length(1);
      expect(
        sampledValueRun(fcdaOf(scl(phase('I1', '1') + phase('I2', 'x')), 'I1'))
      ).to.have.length(1);
    });

    it('allows the same instance again', () => {
      const doc = scl(phase('I1', '1') + phase('I2', '1'));
      expect(sampledValueRun(fcdaOf(doc, 'I1'))).to.have.length(2);
    });

    it('is empty for data which is not measured', () => {
      const doc = scl(phase('I1', '1', { fc: 'ST' }));
      expect(sampledValueRun(fcdaOf(doc, 'I1'))).to.deep.equal([]);
    });

    it('is empty for a value at the end of the data set', () => {
      const doc = scl('<FCDA ldInst="MUSV" prefix="I1" lnClass="TCTR" lnInst="1" doName="AmpSv" daName="instMag.i" fc="MX"/>');
      expect(sampledValueRun(fcdaOf(doc, 'I1'))).to.deep.equal([]);
    });
  });

  describe('sampledValueBindings', () => {
    const bindings = (doc: XMLDocument, intAddr: string, prefix = 'I1') =>
      sampledValueBindings({
        sink: mustQuery(doc, `ExtRef[intAddr="${intAddr}"]`),
        fcda: fcdaOf(doc, prefix),
        controlBlock: mustQuery(doc, 'SampledValueControl')
      }).map(({ sink, fcda, controlBlock }) => [
        sink.getAttribute('intAddr'),
        fcda.getAttribute('prefix'),
        controlBlock.getAttribute('name')
      ]);

    it('binds the other phases of the same terminal', () => {
      expect(bindings(scl(threePhases), 'IAS')).to.deep.equal([
        ['IBS', 'I2', 'PhsMeas1'],
        ['ICS', 'I3', 'PhsMeas1']
      ]);
    });

    it('binds the phases of another terminal', () => {
      expect(bindings(scl(threePhases), 'IAS_2')).to.deep.equal([
        ['IBS_2', 'I2', 'PhsMeas1'],
        ['ICS_2', 'I3', 'PhsMeas1']
      ]);
    });

    it('binds voltages to voltage transformers', () => {
      const doc = scl(
        ['U1', 'U2', 'U3']
          .map((prefix, i) =>
            phase(prefix, `${i + 1}`, { lnClass: 'TVTR', doName: 'VolSv' })
          )
          .join('')
      );
      expect(bindings(doc, 'VAZ', 'U1')).to.deep.equal([
        ['VBZ', 'U2', 'PhsMeas1'],
        ['VCZ', 'U3', 'PhsMeas1']
      ]);
    });

    it('binds by phase letter, not by the order of the inputs', () => {
      const inputs = ['ICS', 'IAS', 'IBS'].map(intAddr => input(intAddr)).join('');
      expect(bindings(scl(threePhases, inputs), 'IAS')).to.deep.equal([
        ['ICS', 'I3', 'PhsMeas1'],
        ['IBS', 'I2', 'PhsMeas1']
      ]);
    });

    it('binds only later phases when starting at phase B', () => {
      expect(bindings(scl(threePhases), 'IBS')).to.deep.equal([
        ['ICS', 'I2', 'PhsMeas1']
      ]);
    });

    it('binds only the phases the stream has', () => {
      const doc = scl(phase('I1', '1') + phase('I2', '2'));
      expect(bindings(doc, 'IAS')).to.deep.equal([['IBS', 'I2', 'PhsMeas1']]);
    });

    it('binds nothing for a single phase', () => {
      expect(bindings(scl(phase('I1', '1')), 'IAS')).to.deep.equal([]);
    });

    it('does not bind currents to voltage transformers', () => {
      const doc = scl(
        phase('U1', '1', { lnClass: 'TVTR', doName: 'VolSv' }) +
          phase('U2', '2', { lnClass: 'TVTR', doName: 'VolSv' })
      );
      expect(bindings(doc, 'IAS', 'U1')).to.deep.equal([]);
    });

    it('binds only inputs of the same service type', () => {
      const inputs = input('IAS') + input('IBS', 'GOOSE') + input('ICS');
      expect(bindings(scl(threePhases, inputs), 'IAS')).to.deep.equal([
        ['ICS', 'I3', 'PhsMeas1']
      ]);
    });

    it('binds nothing for an input which is not a phase', () => {
      const inputs = input('IY1') + input('IBS');
      expect(bindings(scl(threePhases, inputs), 'IY1')).to.deep.equal([]);
    });

    it('binds nothing for an input outside a logical node', () => {
      const doc = scl(threePhases);
      const loose = doc.createElementNS(doc.documentElement.namespaceURI, 'ExtRef');
      loose.setAttribute('intAddr', 'IAS');
      expect(
        sampledValueBindings({
          sink: loose,
          fcda: fcdaOf(doc, 'I1'),
          controlBlock: mustQuery(doc, 'SampledValueControl')
        })
      ).to.deep.equal([]);
    });
  });
});
