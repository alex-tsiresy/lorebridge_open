"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { apiClient } from "./api";

export function useApiClient() {
  const { getToken } = useAuth();

  useEffect(() => {
    // Configure the API client with the Clerk token getter
    const template = process.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE;
    apiClient.setTokenGetter(() => (template ? getToken({ template }) : getToken()));
  }, [getToken]);

  return apiClient;
} 