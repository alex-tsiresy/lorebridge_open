"use client";
import { useUser, useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { logger } from '@/lib/logger';

export function useEnsureUserInDB() {
  const { user } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    if (!user) return;
    getToken().then(async token => {
      const { getApiBase } = await import('./apiBase');
      const apiBase = getApiBase({ allowLocalhost: true });
      fetch(`${(apiBase || '')}/api/v1/users/me/`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(err => {
        // Optionally log to a monitoring service
        logger.error("Failed to ensure user in DB:", err);
      });
    });
  }, [user, getToken]);
} 