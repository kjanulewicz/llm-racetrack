import { msalInstance } from "../auth/msalInstance";
import { loginRequest } from "../auth/msal.config";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

/**
 * Fetch wrapper that silently acquires an MSAL token and attaches it
 * as an Authorization Bearer header on every request.
 *
 * Handles 401 responses by redirecting the user to the login page.
 *
 * @param {string} path  — API path (e.g. "/api/me/models")
 * @param {RequestInit} [options]  — standard fetch options
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, options = {}) {
  let token = "";

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    try {
      const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      token = response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        await msalInstance.acquireTokenRedirect(loginRequest);
        return new Response(null, { status: 401 });
      }
      throw error;
    }
  }

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    await msalInstance.acquireTokenRedirect(loginRequest);
  }

  return response;
}
