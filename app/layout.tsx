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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vitals-pwa.vercel.app'
const TAGLINE = 'One AI that reads your food, training, bloodwork & recovery — together.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'VITALS — your body, read as one system',
  description: TAGLINE,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VITALS',
  },
  openGraph: {
    type: 'website',
    title: 'VITALS — your body, read as one system',
    description: TAGLINE,
    siteName: 'VITALS',
    url: SITE_URL,
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'VITALS' }],
  },
  twitter: {
    card: 'summary',
    title: 'VITALS — your body, read as one system',
    description: TAGLINE,
    images: ['/icons/icon-512.png'],
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
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
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
