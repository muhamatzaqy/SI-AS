import type { Metadata, Viewport } from 'next'
import './globals.css'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { cn } from "@/lib/utils";

// GANTI IMPORT INI: Ambil Toaster langsung dari library sonner
import { Toaster } from 'sonner'; 

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: 'SANGAR',
  description: "Sistem Absensi Ngaji dan Sorogan Ma'had Aly & LKIM",
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#16a34a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={cn("font-sans scroll-smooth", geistSans.variable)}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        
        {/* WADAH SONNER DI SINI (tambahkan richColors agar warnanya cantik) */}
        <Toaster position="top-center" richColors />
        
      </body>
    </html>
  )
}
