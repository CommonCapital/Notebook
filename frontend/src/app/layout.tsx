import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drawing Desk",
  description: "A local-first drawing and file management desk.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
