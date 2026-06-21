"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      theme="dark"
      toastOptions={{
        classNames: {
          toast: "sonner-toast",
          title: "sonner-title",
          description: "sonner-description",
          success: "sonner-success",
          error: "sonner-error",
          warning: "sonner-warning",
          info: "sonner-info",
          loader: "sonner-loader",
          closeButton: "sonner-close",
        },
      }}
      closeButton
    />
  );
}
