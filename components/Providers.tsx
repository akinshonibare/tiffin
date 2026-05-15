"use client";

import { ReactNode } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { getConvexClient, isClerkConfigured, isConvexConfigured } from "@/lib/convex";
import { SyncEngine } from "./SyncEngine";
import { MigrationSheet } from "./MigrationSheet";

export function Providers({ children }: { children: ReactNode }) {
  if (!isClerkConfigured() || !isConvexConfigured()) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={getConvexClient()} useAuth={useAuth}>
        <SyncEngine />
        <MigrationSheet />
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
