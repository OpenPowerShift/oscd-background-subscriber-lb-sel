import type { Binding } from '../companion/companion.js';

/** SEL relays have three phases and no neutral in a sampled value stream. */
const maxPhases = 3;

const phaseLetters = ['A', 'B', 'C'];

/** The logical node class of the instrument transformer for an input. */
const transducerClasses: Record<string, string> = {
  I: 'TCTR',
  V: 'TVTR'
};

/** The parts of a phase input's `intAddr`, e.g. `IBS_2`. */
export interface PhaseAddress {
  /** `I` for current or `V` for voltage. */
  transducer: string;
  /** 0 for phase A, 1 for B and 2 for C. */
  phase: number;
  /** What follows the phase, e.g. `S_2`, naming the terminal or side. */
  terminal: string;
}

/**
 * Reads the transducer, phase and terminal from an SEL `intAddr`.
 * @param intAddr - e.g. `IAS`, `IBU_2` or `VCZ`.
 * @returns the parts, or undefined if it is not a phase input.
 */
export function parsePhaseAddress(intAddr: string): PhaseAddress | undefined {
  // the terminal is a letter, e.g. S, and may be numbered, e.g. S_2, which
  // excludes GOOSE virtual bits such as VB001
  const match = /^([IV])([ABC])([A-Z](?:_\d+)?)$/.exec(intAddr);
  if (match === null) {
    return undefined;
  }
  const [, transducer, letter, terminal] = match;
  return { transducer, phase: phaseLetters.indexOf(letter), terminal };
}

function sameData(a: Element, b: Element): boolean {
  return ['ldInst', 'prefix', 'lnClass', 'lnInst', 'doName', 'fc'].every(
    name => (a.getAttribute(name) ?? '') === (b.getAttribute(name) ?? '')
  );
}

/**
 * The value FCDAs of the phases of a sampled value stream which starts at an
 * FCDA. Each phase is a measured value followed by its quality `q`. The phases
 * are in the same logical device, of the same logical node class and data
 * object, with the instance not decreasing, e.g. `TCTR1.AmpSv.instMag.i`,
 * `TCTR1.AmpSv.q`, `TCTR2.AmpSv.instMag.i`, `TCTR2.AmpSv.q`, and so on.
 * @param firstFcda - the FCDA of the first phase.
 * @returns the value FCDAs, at most three.
 */
export function sampledValueRun(firstFcda: Element): Element[] {
  const values: Element[] = [];
  let previousInst = -Infinity;
  let value: Element | null = firstFcda;

  while (value !== null && values.length < maxPhases) {
    const quality: Element | null = value.nextElementSibling;
    const inst = parseInt(value.getAttribute('lnInst') ?? '', 10);
    const isPhase =
      value.tagName === 'FCDA' &&
      value.getAttribute('fc') === 'MX' &&
      ['ldInst', 'lnClass', 'doName'].every(
        name => value!.getAttribute(name) === firstFcda.getAttribute(name)
      ) &&
      !Number.isNaN(inst) &&
      inst >= previousInst &&
      quality !== null &&
      quality.tagName === 'FCDA' &&
      quality.getAttribute('daName') === 'q' &&
      sameData(quality, value);
    if (!isPhase) {
      break;
    }
    values.push(value);
    previousInst = inst;
    value = quality.nextElementSibling;
  }
  return values;
}

/**
 * The other phases of a sampled value input. In SEL relays (e.g. SEL-4xx,
 * SEL-751, SEL-2440, SEL-2414) the phases of a terminal are inputs of the same
 * logical node whose `intAddr` differs only in the phase letter. Each is bound
 * to the phase of the stream at the same distance from the chosen one, and
 * only if it is the right kind of instrument transformer.
 * @param binding - the input which was subscribed, or unsubscribed, and the
 * FCDA and control block of the first phase.
 * @returns the other phase inputs and their FCDAs.
 */
export function sampledValueBindings({
  sink: extRef,
  fcda,
  controlBlock
}: Binding): Binding[] {
  const address = parsePhaseAddress(extRef.getAttribute('intAddr') ?? '');
  const ln = extRef.closest('LN0, LN');
  if (address === undefined || ln === null) {
    return [];
  }
  const run = sampledValueRun(fcda);
  if (run.length < 2) {
    return [];
  }

  const serviceType = extRef.getAttribute('serviceType');
  return Array.from(ln.querySelectorAll(':scope > Inputs > ExtRef')).flatMap(
    (candidate) => {
      const other = parsePhaseAddress(candidate.getAttribute('intAddr') ?? '');
      if (
        candidate === extRef ||
        other === undefined ||
        candidate.getAttribute('serviceType') !== serviceType ||
        other.transducer !== address.transducer ||
        other.terminal !== address.terminal
      ) {
        return [];
      }
      const phaseFcda = run[other.phase - address.phase];
      if (
        phaseFcda === undefined ||
        phaseFcda.getAttribute('lnClass') !== transducerClasses[other.transducer]
      ) {
        return [];
      }
      return [{ sink: candidate, fcda: phaseFcda, controlBlock }];
    }
  );
}
