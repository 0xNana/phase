import type { Metadata } from "next";
import Providers from "./providers";
import "./styles/globals.css";

export const metadata: Metadata = {
  title: "Phase | Confidential Token Allocation",
  description: "Confidential infrastructure for private token allocations with public campaign evidence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
