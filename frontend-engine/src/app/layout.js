import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import NextAuthSessionProvider from "@/providers/NextAuthSessionProvider";
import ReduxProvider from "@/providers/ReduxProvider";
import ThemeProvider from "@/components/ThemeProvider";
import Toaster from "@/components/Toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Funturf",
  description: "Your go-to app for managing turf",
};

export default function RootLayout({ children }) {
  return (
    // <html>/<body> are emitted by the server root layout directly. All
    // providers live INSIDE <body>; wrapping <body> in a client provider puts a
    // client boundary across the html→body edge and triggers hydration errors
    // on hard-loaded pages (the post-login redirect landings).
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <NextAuthSessionProvider>
          <ReduxProvider>
            <ThemeProvider>
              {children}
              {/* Toasts: action feedback + high-priority live notifications. */}
              <Toaster />
            </ThemeProvider>
          </ReduxProvider>
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
