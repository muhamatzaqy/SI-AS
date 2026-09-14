import type { Metadata, Viewport } from 'next'
import './globals.css'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { cn } from "@/lib/utils"
import { Analytics } from '@vercel/analytics/next'

// UBAH IMPORT INI: Ambil langsung dari 'sonner'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/next'

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
        
        {/* WADAH TOAST DIUBAH KE SONNER */}
        <Toaster position="top-center" richColors />
        <Analytics />
        
        {/* Vercel Web Analytics */}
        <Analytics />
        
      </body>
    </html>
  )
}
