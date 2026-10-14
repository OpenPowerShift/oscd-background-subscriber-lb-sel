import { fcdaBaseTypes } from '@openscd/scl-lib';

import type { Binding } from '../companion/companion.js';

/**
 * The second input of a double position. SEL relays take a double position
 * (CDC `DPC`, basic type `Dbpos`) as a pair of adjacent inputs, one for the
 * open and one for the closed indication, both subscribed to the same data.
 * @param binding - the input which was subscribed, or unsubscribed, and its
 * FCDA and control block.
 * @returns the next input, if the FCDA is a double position and the next
 * element is a later binding input of the same service type.
 */
export function doublePointBindings({
  sink: extRef,
  fcda,
  controlBlock
}: Binding): Binding[] {
  const types = fcdaBaseTypes(fcda);
  if (types?.cdc !== 'DPC' || types.bType !== 'Dbpos') {
    return [];
  }

  const next = extRef.nextElementSibling;
  if (
    next === null ||
    next.tagName !== 'ExtRef' ||
    !next.hasAttribute('intAddr') ||
    next.getAttribute('serviceType') !== extRef.getAttribute('serviceType')
  ) {
    return [];
  }
  return [{ sink: next, fcda, controlBlock }];
}
