import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { loginRequest } from "./msal.config";

/**
 * Custom hook that exposes the current user, token acquisition, and logout.
 *
 * @returns {{ user: object|null, getToken: () => Promise<string>, logout: () => Promise<void> }}
 */
export default function useAuth() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const user = isAuthenticated && accounts.length > 0 ? accounts[0] : null;

  /**
   * Silently acquire an access token for the backend API.
   * Falls back to interactive login when silent acquisition fails.
   */
  async function getToken() {
    const account = accounts[0];
    if (!account) {
      await instance.loginRedirect(loginRequest);
      return "";
    }

    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account,
      });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        await instance.acquireTokenRedirect(loginRequest);
      }
      throw error;
    }
  }

  async function logout() {
    await instance.logoutRedirect();
  }

  return { user, getToken, logout, isAuthenticated };
}
