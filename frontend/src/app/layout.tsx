import type { Metadata } from "next";
import { Providers } from "./providers";
import "./t3pay.css";

export const metadata: Metadata = {
  title: "T3Pay",
  description: "Private agent wallets and personal AI spending governance."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
