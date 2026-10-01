/**
 * @file Shared admin-session state for every `/admin/*` page. The token is the
 * real `ADMIN_API_TOKEN` from the server's `.env` (see `AdminTokenGate.tsx`),
 * kept in `sessionStorage` under one shared key so logging in on one admin
 * page (e.g. Материалы) also authenticates the others (e.g. Заказы).
 */
import { useState } from 'react';

const AUTH_KEY = 'balkon-admin-token';

export interface AdminAuth {
  readonly token: string | null;
  readonly login: (token: string) => void;
  readonly logout: () => void;
}

export function useAdminAuth(): AdminAuth {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(AUTH_KEY));

  return {
    token,
    login: (t) => {
      sessionStorage.setItem(AUTH_KEY, t);
      setToken(t);
    },
    logout: () => {
      sessionStorage.removeItem(AUTH_KEY);
      setToken(null);
    },
  };
}
