import type { Metadata } from "next";
import { Mulish } from "next/font/google";
import * as Toast from "@radix-ui/react-toast";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { EnsureUserInDBClient } from "../components/EnsureUserInDBClient";
import { NotificationProvider } from "../components/NotificationProvider";

const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "LoreBridge",
  description: "AI-powered lore and story generation platform",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head></head>
        <body
          className={`${mulish.variable} antialiased`}
        >
          <EnsureUserInDBClient />
          <Toast.Provider swipeDirection="right">
            <NotificationProvider />
            {children}
            <Toast.Viewport className="fixed top-0 right-0 flex flex-col p-6 gap-2 w-96 max-w-full m-0 list-none z-50 outline-none" />
          </Toast.Provider>
        </body>
      </html>
    </ClerkProvider>
  );
}
