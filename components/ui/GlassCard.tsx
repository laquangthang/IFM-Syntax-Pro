'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface GlassCardProps {
  children: ReactNode
  className?: string
  tilt?: boolean
  glowColor?: 'purple' | 'cyan' | 'primary'
}

export default function GlassCard({
  children,
  className = '',
  tilt = false,
  glowColor = 'primary'
}: GlassCardProps) {
  const content = (
    <div
      className={`
        flat-card
        bg-surface-light dark:bg-surface-dark
        border border-border-light dark:border-border-dark
        rounded-xl shadow-card dark:shadow-card-dark
        ${className}
      `}
    >
      {children}
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {content}
    </motion.div>
  )
}
