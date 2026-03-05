import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { loginRequest } from "./msal.config";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";

const DEV_USER = {
  name: "Local Developer",
  username: "dev@localhost",
};

/**
 * DEV_MODE auth hook — returns a hardcoded mock user with no MSAL interaction.
 */
function useDevAuth() {
  return {
    user: DEV_USER,
    getToken: async () => "",
    logout: async () => {},
    isAuthenticated: true,
  };
}

/**
 * Production auth hook — delegates to MSAL for real Entra ID authentication.
 */
function useMsalAuth() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const user = isAuthenticated && accounts.length > 0 ? accounts[0] : null;

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

/**
 * Custom hook that exposes the current user, token acquisition, and logout.
 * In DEV_MODE, MSAL is bypassed entirely and a mock user is returned.
 *
 * @returns {{ user: object|null, getToken: () => Promise<string>, logout: () => Promise<void>, isAuthenticated: boolean }}
 */
const useAuth = DEV_MODE ? useDevAuth : useMsalAuth;
export default useAuth;
