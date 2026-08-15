import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notebook",
  description: "A local-first engineering notebook — diagrams, blueprints, math, and more.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
