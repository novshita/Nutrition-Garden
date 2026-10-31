import type { Metadata } from "next";
import { Caveat, Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nutrition Garden",
  description: "A little food diary that wants to see you thrive.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} ${caveat.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
