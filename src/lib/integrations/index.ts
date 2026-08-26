export { ADAPTERS, getAdapter } from "./registry";
export {
  deriveStatus,
  isConfigured,
  isRunnable,
  missingCredentials,
  runAll,
  runOne,
  type RunOutcome,
} from "./run";
export type { Adapter, AdapterResult, CredentialSpec } from "./types";
