import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./msalInstance";

/**
 * Wraps children in the MSAL authentication provider.
 */
export default function AuthProvider({ children }) {
  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
