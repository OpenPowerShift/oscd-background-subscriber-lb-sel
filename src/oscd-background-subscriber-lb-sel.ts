import { LitElement, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { msg } from '@lit/localize';

import { CompanionController } from './companion/companion.js';
import { isSelIed, planSel, selIdentity } from './foundation/sel.js';

/**
 * A background plugin which works with the Subscriber Later Binding plugin.
 * When an input of an SEL relay is subscribed or unsubscribed there, it
 * subscribes or unsubscribes the inputs which belong with it: the other phases
 * of a sampled value stream and the second input of a double position.
 *
 * It has no user interface of its own. It tells Subscriber Later Binding what
 * it does, which lists it in its settings, where it is turned on and off.
 */
export default class OscdBackgroundSubscriberLbSel extends LitElement {
  @property({ attribute: false })
  doc?: XMLDocument;

  @property()
  docName?: string;

  @property({ attribute: false })
  docVersion?: unknown;

  /** Identifies this plugin to other plugins. */
  @property({ type: String, reflect: true })
  identity = selIdentity;

  /** Kept so that the companion is connected while the element is. */
  protected companion = new CompanionController(this, {
    identity: selIdentity,
    name: 'SEL',
    description: () =>
      msg('Subscribes and unsubscribes further inputs of SEL relays'),
    features: () => [
      msg('Double position values (DPC, Dbpos): the next input of the pair'),
      msg('Sampled values: the other phases')
    ],
    isVendorIed: isSelIed,
    plan: planSel,
    title: action =>
      action === 'subscribe' ? msg('SEL subscribe') : msg('SEL unsubscribe')
  });

  render(): typeof nothing {
    return nothing;
  }
}
