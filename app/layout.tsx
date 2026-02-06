import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Kasa Reputation Dashboard",
  description: "Hotel reputation aggregator across Google, TripAdvisor, Expedia, and Booking.com",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#061332",
              color: "#fff",
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: "#2eab6e",
                secondary: "#fff",
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: "#e23c00",
                secondary: "#fff",
              },
            },
          }}
        />
      </body>
    </html>
  );
}
