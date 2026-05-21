import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import CelebrationLayer from '@/components/CelebrationLayer'
import { ToastProvider } from '@/components/Toast'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'VITALS',
  description: 'Your personal health intelligence dashboard',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VITALS',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0d0d0d',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <ToastProvider>
          {/* Non-scrolling app shell. The document/body does NOT scroll — only <main>
              scrolls internally. This is the only reliable way to keep a bottom nav
              pinned on iOS Safari, where position:fixed elements detach during
              momentum/rubber-band scroll. The nav is a normal flex child at the bottom. */}
          <div className="flex flex-col h-[100dvh] overflow-hidden">
            <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain max-w-md mx-auto w-full pb-28">
              {children}
            </main>
            <BottomNav />
          </div>
          <CelebrationLayer />
        </ToastProvider>
      </body>
    </html>
  )
}
