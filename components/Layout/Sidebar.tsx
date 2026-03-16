'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import {
  Upload,
  Network,
  Settings,
  FileText,
  Cog,
  FolderOpen,
  BookOpen
} from 'lucide-react'

const workspaceItems = [
  { id: 'projects', label: 'Projects', icon: FolderOpen, path: '/projects' },
]

const pipelineItems = [
  { id: 'import', label: 'Data Import', icon: Upload, path: '/import' },
  { id: 'questions', label: 'Questions', icon: FileText, path: '/questions' },
  { id: 'dictionary', label: 'Data Dictionary', icon: BookOpen, path: '/dictionary' },
  { id: 'qc-logic', label: 'QC Logic', icon: Network, path: '/qc-logic' },
]

const outputItems = [
  { id: 'processing', label: 'Processing Hub', icon: Cog, path: '/processing' },
]

function NavSection({ title, items, pathname, isFirst }: { title: string; items: typeof workspaceItems; pathname: string; isFirst?: boolean }) {
  return (
    <>
      <p className={`text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wider ${isFirst ? 'mt-2' : 'mt-6'}`}>
        {title}
      </p>
      {items.map((item, index) => {
        const Icon = item.icon
        const isActive = pathname === item.path

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ x: 4 }}
            className="relative"
          >
            <Link
              href={item.path}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all relative overflow-hidden
                ${isActive
                  ? 'bg-primary/10 border border-primary/30 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5 dark:hover:bg-white/5'
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute inset-0 bg-primary/5"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Icon className="size-5 relative z-10" />
              <p className="text-sm font-medium relative z-10">{item.label}</p>
              {isActive && (
                <motion.div
                  className="absolute right-2 size-1.5 rounded-full bg-primary"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                />
              )}
            </Link>
          </motion.div>
        )
      })}
    </>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? (resolvedTheme === 'dark') : false

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-[280px] h-full flex flex-col flat-panel border-r border-border-light dark:border-border-dark shrink-0 z-50 relative bg-background-light dark:bg-background-dark"
    >
      {/* Logo */}
      <div className="p-6">
        <Link href="/">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex gap-3 items-center mb-8"
          >
            {!mounted ? (
              <div className="h-8 w-[120px] bg-transparent" />
            ) : isDark ? (
              <Image
                src="/logo-ifm-dark.svg"
                alt="IFM Research Logo"
                width={120}
                height={40}
                className="h-8 w-auto"
                priority
              />
            ) : (
              <Image
                src="/logo-ifm-light.svg"
                alt="IFM Research Logo"
                width={120}
                height={40}
                className="h-8 w-auto"
                priority
              />
            )}
          </motion.div>
        </Link>

        {/* Navigation */}
        <nav className="flex flex-col gap-2">
          <NavSection title="Workspace" items={workspaceItems} pathname={pathname} isFirst />
          <NavSection title="Pipeline" items={pipelineItems} pathname={pathname} />
          <NavSection title="Output" items={outputItems} pathname={pathname} />
        </nav>
      </div>

      {/* Settings at bottom */}
      <div className="mt-auto p-6 border-t border-border-light dark:border-border-dark">
        <motion.div
          whileHover={{ x: 4 }}
          className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          <Settings className="size-5" />
          <p className="text-sm font-medium">Global Settings</p>
        </motion.div>
      </div>
    </motion.aside>
  )
}
