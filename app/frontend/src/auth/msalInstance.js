import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "./msal.config";

/**
 * Singleton MSAL PublicClientApplication instance shared between
 * the AuthProvider component and the api.js fetch wrapper.
 */
export const msalInstance = new PublicClientApplication(msalConfig);
