import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";

import { Providers } from "@/components/layout/Providers";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HyperLocal - Services Near You",
  description:
    "Find local services near you instantly - plumber, electrician, AC repair and more",
  keywords: [
    "local services",
    "nearby",
    "plumber",
    "electrician",
    "hyperlocal",
    "India",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hi" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: "#1e293b",
                color: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #334155",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
