'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import TiltCard from './TiltCard'

interface GlassCardProps {
  children: ReactNode
  className?: string
  tilt?: boolean
  glowColor?: 'purple' | 'cyan' | 'primary'
}

export default function GlassCard({ 
  children, 
  className = '', 
  tilt = true,
  glowColor = 'primary'
}: GlassCardProps) {
  const glowClasses = {
    purple: 'shadow-glow-purple',
    cyan: 'shadow-glow-cyan',
    primary: 'shadow-glow-orange dark:shadow-glow-orange',
  }

  const content = (
    <div
      className={`
        glass-card rounded-xl
        ${glowClasses[glowColor]}
        ${className}
      `}
    >
      {children}
    </div>
  )

  if (tilt) {
    return <TiltCard intensity={8}>{content}</TiltCard>
  }

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


