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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable}`}>
      <NextAuthSessionProvider>
        <body className="font-sans antialiased">
          <ReduxProvider>
            <ThemeProvider>
              {children}
              {/* Toasts: action feedback + high-priority live notifications. */}
              <Toaster />
            </ThemeProvider>
          </ReduxProvider>
        </body>
      </NextAuthSessionProvider>
    </html>
  );
}
