import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnalyticsInitializer from "@/components/AnalyticsInitializer";
import SessionInitializer from "@/components/SessionInitializer";
import VisitorInitializer from "@/components/VisitorInitializer";
import ScrollToTop from "@/components/ScrollToTop";
import "./globals.css";
import "./loading.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ILA Homes",
  description: "Building futures and unlocking possibilities",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} h-full antialiased`}
    >
      <body className={`${montserrat.className} flex min-h-full flex-col bg-black text-white`}>
        <VisitorInitializer />
        <SessionInitializer />
        <AnalyticsInitializer />
        {/* Keeps the window at the top of the document across route changes.
            Mounted here, above `<main>`, because the root layout is the only
            element that survives every navigation — see the component for why
            Next.js's own scroll handling is not enough on this site. */}
        <ScrollToTop />
        <Navbar />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
