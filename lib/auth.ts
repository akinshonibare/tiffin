"use client";

import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { isClerkConfigured } from "./convex";

export interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
}

const SIGNED_OUT: AuthState = {
  isLoaded: true,
  isSignedIn: false,
  userId: null,
};

export function useAuthState(): AuthState {
  if (!isClerkConfigured()) {
    return SIGNED_OUT;
  }
  // Only called when Clerk is configured (the ClerkProvider is mounted).
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const auth = useClerkAuth();
  return {
    isLoaded: auth.isLoaded,
    isSignedIn: !!auth.isSignedIn,
    userId: auth.userId ?? null,
  };
}
