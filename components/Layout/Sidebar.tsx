'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import { 
  LayoutDashboard, 
  Upload, 
  Network, 
  Package2, 
  Download, 
  Settings,
  FileText,
  Cog
} from 'lucide-react'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'import', label: 'Data Import', icon: Upload, path: '/import' },
  { id: 'questions', label: 'Questions', icon: FileText, path: '/questions' },
  { id: 'refinery', label: 'Label Refinery', icon: Network, path: '/refinery' },
  { id: 'models', label: 'Logic Models', icon: Package2, path: '/models' },
  { id: 'processing', label: 'Processing Hub', icon: Cog, path: '/processing' },
  { id: 'exports', label: 'Exports', icon: Download, path: '/exports' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { theme } = useTheme()

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-[280px] h-full flex flex-col glass-panel border-r border-glass-border-dark dark:border-glass-border-light shrink-0 z-50 relative bg-background-dark dark:bg-background-light"
    >
      {/* Logo */}
      <div className="p-6">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="flex gap-3 items-center mb-8"
        >
          {theme === 'dark' ? (
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

        {/* Navigation */}
        <nav className="flex flex-col gap-2">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            const isActive = pathname === item.path

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
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
        </nav>
      </div>

      {/* Settings at bottom */}
      <div className="mt-auto p-6 border-t border-glass-border-dark dark:border-glass-border-light">
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

