'use client'

import { motion } from 'framer-motion'

interface LaserScanProps {
  isActive: boolean
  className?: string
}

export default function LaserScan({ isActive, className = '' }: LaserScanProps) {
  if (!isActive) return null

  return (
    <motion.div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Laser scan line */}
      <motion.div
        className="absolute inset-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent"
        style={{
          boxShadow: '0 0 20px #EF5B21, 0 0 40px #EF5B21',
        }}
        animate={{
          y: [0, '100%', 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-primary/20 via-transparent to-primary/20"
        animate={{
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  )
}






