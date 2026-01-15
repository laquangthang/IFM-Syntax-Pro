'use client'

import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import BackgroundParticles from '../BackgroundParticles'
import ThemeToggle from '../ThemeToggle'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background-dark dark:bg-background-light transition-colors duration-300">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-background-dark dark:bg-background-light transition-colors duration-300" />
        {/* Gradient Mesh - Orange for dark, subtle for light */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 dark:bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 dark:bg-primary/5 blur-[120px] rounded-full" />
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-50 dark:opacity-20" />
        {/* Particles */}
        <BackgroundParticles />
      </div>

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {children}
      </div>
    </div>
  )
}


