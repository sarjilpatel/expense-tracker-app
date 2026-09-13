/**
 * Whether there is an account to sync with. Set by AuthContext alongside `dataService.setMode`;
 * kept out of `dataService` so the engine and the scheduler can ask without importing the module
 * that imports them.
 */
let signedIn = false;

export function setSignedIn(value: boolean): void { signedIn = value; }
export function isSignedIn(): boolean { return signedIn; }
