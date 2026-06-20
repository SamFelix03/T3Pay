import type { Metadata } from "next";
import "./t3pay.css";

export const metadata: Metadata = {
  title: "T3Pay",
  description: "Private agent wallets and personal AI spending governance."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
