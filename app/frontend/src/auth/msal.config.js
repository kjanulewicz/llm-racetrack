import { LogLevel } from "@azure/msal-browser";

/**
 * MSAL configuration for Azure Entra ID single-tenant authentication.
 * Uses Vite environment variables defined in .env.
 */
export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
    },
  },
};

/**
 * Scopes requested when acquiring tokens for the backend API.
 */
export const loginRequest = {
  scopes: [`api://${import.meta.env.VITE_ENTRA_CLIENT_ID}/Race.Access`],
};
