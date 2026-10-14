/**
 * Whether a companion is enabled, as kept in local storage. Companions are
 * enabled unless the user has turned them off.
 * @param storageKey - where the setting is kept.
 */
export function loadEnabled(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) !== 'false';
  } catch {
    return true;
  }
}

/**
 * Keeps whether a companion is enabled in local storage.
 * @param storageKey - where the setting is kept.
 * @param enabled - whether it is enabled.
 */
export function storeEnabled(storageKey: string, enabled: boolean): void {
  try {
    localStorage.setItem(storageKey, `${enabled}`);
  } catch {
    // storage may be unavailable, e.g. in a private window
  }
}
