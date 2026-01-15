'use client'

import MainLayout from '@/components/Layout/MainLayout'
import ProcessingHub from '@/components/pages/ProcessingHub'
import ThemeToggle from '@/components/ThemeToggle'

export default function ProcessingPage() {
  return (
    <MainLayout>
      <div className="flex flex-col h-full w-full relative">
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <ProcessingHub />
      </div>
    </MainLayout>
  )
}
