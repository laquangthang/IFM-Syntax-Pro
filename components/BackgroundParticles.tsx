'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'

interface ParticleConfig {
  delay: number
  duration: number
  x: number
  y: number
  size: number
  color: string
}

// Simple particle system using CSS and Framer Motion with theme support
export default function BackgroundParticles() {
  const { theme } = useTheme()
  const [particles, setParticles] = useState<ParticleConfig[]>([])
  const [mounted, setMounted] = useState(false)

  // Theme-based colors: Orange for dark, Gray for light
  const darkColors = ['#EF5B21', '#ff6b38', '#ff8c5a'] // IFM Orange variants
  const lightColors = ['#9ca3af', '#d1d5db', '#e5e7eb'] // Silver/Gray variants

  // Generate particles only on client-side to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
    const colors = theme === 'dark' ? darkColors : lightColors
    const newParticles = Array.from({ length: 50 }).map(() => ({
      delay: Math.random() * 5,
      duration: 10 + Math.random() * 10,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))
    setParticles(newParticles)
  }, [theme])

  if (!mounted) {
    return <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" />
  }

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      {particles.map((particle, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full opacity-30"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            boxShadow: `0 0 ${particle.size * 4}px ${particle.color}`,
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, Math.random() * 100 - 50, 0],
            opacity: [0.3, 0.7, 0.3],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

