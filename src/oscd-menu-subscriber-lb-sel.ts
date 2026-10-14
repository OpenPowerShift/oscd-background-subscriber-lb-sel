import { css, html, LitElement } from 'lit';
import type { TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

import { OscdDialog } from '@omicronenergy/oscd-ui/dialog/OscdDialog.js';
import { OscdSwitch } from '@omicronenergy/oscd-ui/switch/OscdSwitch.js';
import { OscdTextButton } from '@omicronenergy/oscd-ui/button/OscdTextButton.js';

import { CompanionController } from './companion/companion.js';
import { loadEnabled, storeEnabled } from './companion/settings.js';
import { isSelIed, planSel, selIdentity, selStorageKey } from './foundation/sel.js';
import { oscdPaletteMd3 } from './theme.js';

const laterBindingUrl =
  'https://github.com/OpenPowerShift/oscd-editor-subscriber-later-binding';

/**
 * A menu plugin which works with the Subscriber Later Binding plugin. When an
 * input of an SEL relay is subscribed or unsubscribed there, it subscribes or
 * unsubscribes the inputs which belong with it: the other phases of a sampled
 * value stream and the second input of a double position. Its menu item opens
 * a dialog to turn it on or off.
 */
export default class OscdMenuSubscriberLbSel extends ScopedElementsMixin(
  LitElement
) {
  static scopedElements = {
    'oscd-dialog': OscdDialog,
    'oscd-switch': OscdSwitch,
    'oscd-text-button': OscdTextButton
  };

  @property({ attribute: false })
  doc?: XMLDocument;

  @property()
  docName?: string;

  @property({ attribute: false })
  docVersion?: unknown;

  /** Identifies this plugin to other plugins. */
  @property({ type: String, reflect: true })
  identity = selIdentity;

  @state()
  enabled = loadEnabled(selStorageKey);

  @query('oscd-dialog')
  private dialog?: OscdDialog;

  private companion = new CompanionController(this, {
    identity: selIdentity,
    name: 'SEL',
    isVendorIed: isSelIed,
    plan: planSel,
    title: action =>
      action === 'subscribe' ? msg('SEL subscribe') : msg('SEL unsubscribe'),
    isEnabled: () => this.enabled
  });

  /** Opens the dialog, as the host does when the menu item is chosen. */
  async run(): Promise<void> {
    await this.updateComplete;
    await this.dialog?.show();
  }

  private handleEnabledChange(event: Event): void {
    this.enabled = (event.target as OscdSwitch).selected;
    storeEnabled(selStorageKey, this.enabled);
    this.companion.announce();
  }

  private renderDescription(): TemplateResult {
    return html`<p>
        ${msg('This plugin works with the')}
        <a href=${laterBindingUrl} target="_blank" rel="noopener"
          >${msg('Subscriber Later Binding plugin')}</a
        >
        ${msg('to subscribe and unsubscribe further inputs of SEL relays:')}
      </p>
      <ul>
        <li>${msg('Double position values (DPC, Dbpos): the next input of the pair')}</li>
        <li>${msg('Sampled values: the other phases')}</li>
      </ul>
      <p class="hint">
        ${msg('"Allow External Plugins" must be on in its settings.')}
      </p>`;
  }

  render(): TemplateResult {
    return html`<oscd-dialog>
      <div slot="headline">${msg('Subscriber Later Binding - SEL')}</div>
      <div slot="content">
        ${this.renderDescription()}
        <label class="enabled">
          <oscd-switch
            ?selected=${this.enabled}
            @change=${(event: Event) => this.handleEnabledChange(event)}
          ></oscd-switch>
          ${msg('Enabled')}
        </label>
      </div>
      <div slot="actions">
        <oscd-text-button @click=${() => this.dialog?.close()}
          >${msg('Close')}</oscd-text-button
        >
      </div>
    </oscd-dialog>`;
  }

  static styles = [
    oscdPaletteMd3,
    css`
      /*
       * Theming follows the OpenSCD theming guide: the internal palette comes
       * from the distro's --oscd-theme-* variables with defaults, and the
       * oscd-ui components are pointed at it.
       */
      :host {
        --oscd-primary: var(--oscd-theme-primary, #2aa198);
        --oscd-secondary: var(--oscd-theme-secondary, #6c71c4);
        --oscd-error: var(--oscd-theme-error, #dc322f);

        --oscd-base03: var(--oscd-theme-base03, #002b36);
        --oscd-base02: var(--oscd-theme-base02, #073642);
        --oscd-base01: var(--oscd-theme-base01, #586e75);
        --oscd-base00: var(--oscd-theme-base00, #657b83);
        --oscd-base0: var(--oscd-theme-base0, #839496);
        --oscd-base1: var(--oscd-theme-base1, #93a1a1);
        --oscd-base2: var(--oscd-theme-base2, #eee8d5);
        --oscd-base3: var(--oscd-theme-base3, #fdf6e3);

        --oscd-shape: var(--oscd-theme-shape, 8px);

        --oscd-text-font: var(--oscd-theme-text-font, 'Roboto');
        --oscd-icon-font: var(--oscd-theme-icon-font, 'Material Symbols Outlined');
      }

      :host {
        font-family: var(--oscd-text-font), sans-serif;
      }

      oscd-dialog {
        max-inline-size: 32rem;
      }

      a {
        color: var(--md-sys-color-primary);
      }

      ul {
        margin-block: 8px;
        padding-inline-start: 24px;
      }

      .hint {
        color: var(--md-sys-color-on-surface-variant);
      }

      .enabled {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        margin-block-start: 16px;
      }
    `
  ];
}
