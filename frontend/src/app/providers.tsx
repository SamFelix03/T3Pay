"use client";

import { AppToaster } from "@/components/ui/AppToaster";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AppToaster />
    </>
  );
}
