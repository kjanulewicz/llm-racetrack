import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./msalInstance";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";

/**
 * Wraps children in the MSAL authentication provider.
 * In DEV_MODE the MSAL provider is skipped entirely.
 */
export default function AuthProvider({ children }) {
  if (DEV_MODE) {
    return <>{children}</>;
  }
  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
