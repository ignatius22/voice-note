import {
  bucketDealAmount,
  createDeal,
  updateDeal,
  type Deal,
  type DealInput,
} from '@vault/core';
import { trackEvent } from '@vault/telemetry';
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthSession } from '../services/auth';
import { loadDeals, saveDeals, wipeDeals } from '../services/dealStorage';
import { clearSession, persistSession, restoreSession } from '../services/security';

interface AppContextValue {
  session: AuthSession | null;
  isRestoringSession: boolean;
  deals: Deal[];
  isLoadingDeals: boolean;
  notice: string | null;
  setNotice: (value: string | null) => void;
  completeSignIn: (session: AuthSession) => Promise<void>;
  logout: () => Promise<void>;
  saveDealRecord: (input: DealInput, dealId?: string) => Promise<void>;
  deleteDealRecord: (dealId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Something went wrong.';
  }

  switch (error.message) {
    case 'DEALS_RESET_DUE_TO_CORRUPTION':
      return 'Data reset due to corruption.';
    default:
      return 'Request failed. Please try again.';
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoadingDeals, setIsLoadingDeals] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function restoreStoredSession() {
      try {
        const storedSession = await restoreSession();
        if (!isMounted) {
          return;
        }

        setSession(storedSession);
        await trackEvent('auth_session_restored', {
          restored: Boolean(storedSession),
        });
      } catch {
        if (isMounted) {
          setNotice('Unable to restore a previous session.');
        }
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    }

    void restoreStoredSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function restoreStoredDeals() {
      if (!session) {
        setDeals([]);
        return;
      }

      setIsLoadingDeals(true);

      try {
        const storedDeals = await loadDeals();
        if (isMounted) {
          setDeals(storedDeals);
        }
      } catch (error) {
        if (isMounted) {
          setDeals([]);
          setNotice(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoadingDeals(false);
        }
      }
    }

    void restoreStoredDeals();

    return () => {
      isMounted = false;
    };
  }, [session]);

  async function completeSignIn(nextSession: AuthSession): Promise<void> {
    await persistSession(nextSession);
    setSession(nextSession);
    setNotice('Signed in successfully.');
  }

  async function logout(): Promise<void> {
    try {
      await clearSession();
      await wipeDeals();
      await trackEvent('auth_logged_out', {});
    } finally {
      setSession(null);
      setDeals([]);
      setNotice('Signed out and vault wiped.');
    }
  }

  async function saveDealRecord(input: DealInput, dealId?: string): Promise<void> {
    if (dealId) {
      const currentDeal = deals.find(deal => deal.id === dealId);
      if (!currentDeal) {
        throw new Error('REQUEST_FAILED');
      }

      const updatedDeal = updateDeal(currentDeal, input);
      const nextDeals = deals.map(deal => (deal.id === dealId ? updatedDeal : deal));
      await saveDeals(nextDeals);
      setDeals(nextDeals);

      if (currentDeal.status !== updatedDeal.status) {
        await trackEvent('deal_status_changed', {
          fromStatus: currentDeal.status,
          toStatus: updatedDeal.status,
        });
      }

      setNotice('Deal updated.');
      return;
    }

    const nextDeal = createDeal(input);
    const nextDeals = [nextDeal, ...deals];
    await saveDeals(nextDeals);
    setDeals(nextDeals);
    await trackEvent('deal_created', {
      status: nextDeal.status,
      amountBucket: bucketDealAmount(nextDeal.amount),
      currency: nextDeal.currency ?? null,
    });
    setNotice('Deal saved.');
  }

  async function deleteDealRecord(dealId: string): Promise<void> {
    const deletedDeal = deals.find(deal => deal.id === dealId);
    const nextDeals = deals.filter(deal => deal.id !== dealId);
    await saveDeals(nextDeals);
    setDeals(nextDeals);

    if (deletedDeal) {
      await trackEvent('deal_deleted', {
        status: deletedDeal.status,
      });
    }

    setNotice('Deal deleted.');
  }

  return (
    <AppContext.Provider
      value={{
        session,
        isRestoringSession,
        deals,
        isLoadingDeals,
        notice,
        setNotice,
        completeSignIn,
        logout,
        saveDealRecord,
        deleteDealRecord,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppState(): AppContextValue {
  const value = useContext(AppContext);

  if (!value) {
    throw new Error('useAppState must be used within AppProvider');
  }

  return value;
}
