import type { PlannedBindings, ResolvedChange } from '../companion/companion.js';
import { doublePointBindings } from './double-point.js';
import { sampledValueBindings } from './sampled-values.js';

export const selIdentity = 'openpowershift.oscd-menu-subscriber-lb-sel';

/** Where the setting which enables the plugin is kept. */
export const selStorageKey = 'oscd-menu-subscriber-lb-sel';

/** Whether an IED is from SEL. */
export function isSelIed(ied: Element): boolean {
  return ied.getAttribute('manufacturer') === 'SEL';
}

/**
 * What else to subscribe or unsubscribe for SEL relays: the other phases of a
 * sampled value stream and the second input of a double position.
 * @param change - what the Subscriber Later Binding plugin did.
 */
export function planSel(change: ResolvedChange): PlannedBindings {
  const binding = {
    sink: change.extRef,
    fcda: change.fcda,
    controlBlock: change.controlBlock
  };
  const bindings = [
    ...sampledValueBindings(binding),
    ...doublePointBindings(binding)
  ];
  return change.action === 'subscribe'
    ? { subscribe: bindings, unsubscribe: [] }
    : { subscribe: [], unsubscribe: bindings };
}
