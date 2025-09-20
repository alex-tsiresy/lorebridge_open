"use client";
import { useEnsureUserInDB } from "../lib/useEnsureUserInDB";

export function EnsureUserInDBClient() {
  useEnsureUserInDB();
  return null;
} 