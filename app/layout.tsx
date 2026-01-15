import type { Metadata } from 'next'
import './globals.css'
import ThemeProvider from '@/components/providers/ThemeProvider'

export const metadata: Metadata = {
  title: 'IFM Syntax Pro - LogicSphere',
  description: 'Advanced IFM Syntax Generator with 3D Spatial UI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-display antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}


