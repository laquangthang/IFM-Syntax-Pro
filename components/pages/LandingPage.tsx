'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import BackgroundParticles from '../BackgroundParticles'
import GlassCard from '../ui/GlassCard'
import TiltCard from '../ui/TiltCard'
import { Rocket, PlayCircle, Code2, FileText, Network, Terminal, ChevronDown, Lock } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background-dark text-white">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-background-dark" />
        {/* Gradient Mesh */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full" />
        {/* Grid Pattern */}
        <div className="absolute inset-0 top-[20%] bg-grid-pattern opacity-50 h-[150%] cyber-grid-bg" />
        {/* Particles */}
        <BackgroundParticles />
      </div>

      {/* Navbar */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center py-4 px-4"
      >
        <nav className="glass-panel rounded-full px-6 py-3 flex items-center justify-between w-full max-w-6xl transition-all duration-300">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-full bg-primary/20 border border-primary/40 text-primary">
              <Code2 className="size-5" />
            </div>
            <span className="text-white font-display font-bold text-lg tracking-wide uppercase">LogicSphere</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/refinery" className="text-gray-300 hover:text-primary transition-colors text-sm font-medium uppercase tracking-wider">
              Forge
            </Link>
            <a href="#" className="text-gray-300 hover:text-primary transition-colors text-sm font-medium uppercase tracking-wider">
              Documentation
            </a>
            <a href="#" className="text-gray-300 hover:text-primary transition-colors text-sm font-medium uppercase tracking-wider">
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/refinery" className="hidden sm:block text-gray-300 hover:text-white text-sm font-medium">
              Log In
            </Link>
            <Link
              href="/refinery"
              className="flex items-center justify-center rounded-full bg-primary/10 border border-primary/30 hover:bg-primary/20 text-white px-5 py-2 text-sm font-bold transition-all uppercase tracking-wide"
            >
              <span className="truncate">Access Console</span>
            </Link>
          </div>
        </nav>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 flex-grow flex flex-col">
        {/* Hero Section */}
        <section className="relative flex flex-col items-center justify-center min-h-screen pt-20 px-4">
          <div className="flex flex-col max-w-[1200px] w-full gap-12 lg:gap-20 relative">
            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center text-center gap-6 z-10 pt-10"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary-glow text-xs font-bold uppercase tracking-widest mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                System Operational
              </div>
              <h1 className="text-white text-5xl md:text-7xl font-display font-black leading-tight tracking-tight max-w-4xl text-glow">
                Transform Static PDFs into{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                  Dynamic Logic
                </span>
              </h1>
              <p className="text-gray-400 text-lg md:text-xl font-light max-w-2xl leading-relaxed">
                Stop writing manual SPSS syntax. Upload your questionnaire and watch the AI forge the logic system in 3D
                space.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full justify-center">
                <Link href="/refinery">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="btn-primary-glow flex items-center justify-center rounded-lg h-14 px-8 bg-primary text-white text-base font-bold tracking-wide uppercase hover:bg-violet-600"
                  >
                    <Rocket className="mr-2 size-5" />
                    Initialize Sequence
                  </motion.button>
                </Link>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center rounded-lg h-14 px-8 bg-transparent border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 hover:bg-white/5 text-base font-medium tracking-wide uppercase transition-all"
                >
                  <PlayCircle className="mr-2 size-5" />
                  Watch Demo
                </motion.button>
              </div>
            </motion.div>

            {/* 3D Visualization Placeholder */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="relative w-full flex justify-center items-center mt-8 perspective-container"
            >
              <TiltCard intensity={10} className="w-full max-w-3xl">
                {/* Abstract glowing rings */}
                <div className="absolute w-[500px] h-[500px] rounded-full border border-primary/20 animate-spin-slow" />
                <div
                  className="absolute w-[350px] h-[350px] rounded-full border border-blue-500/20 animate-spin-slow"
                  style={{ animationDirection: 'reverse' }}
                />
                {/* Main visual card */}
                <div className="relative z-10 w-full aspect-[16/9] glass-card rounded-2xl overflow-hidden animate-float">
                  {/* Placeholder for 3D interface */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-900/20 to-blue-900/20 opacity-80 mix-blend-screen" />
                  {/* Overlay UI elements */}
                  <div className="absolute top-4 left-4 flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>
                  {/* Center HUD element */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-32 h-32 border border-primary/50 rounded-full flex items-center justify-center bg-primary/5 backdrop-blur-sm">
                      <Network className="size-12 text-primary animate-pulse" />
                    </div>
                  </div>
                  {/* Bottom Status Bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-10 bg-black/50 border-t border-white/10 flex items-center px-4 justify-between text-[10px] text-primary uppercase font-mono tracking-widest">
                    <span>Status: Processing</span>
                    <span>Nodes: 1,402</span>
                    <span>Syntax: Ready</span>
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          </div>

          {/* Scroll Indicator */}
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute bottom-10 text-gray-500 flex flex-col items-center gap-2"
          >
            <span className="text-[10px] uppercase tracking-[0.2em]">Scroll to Explore</span>
            <ChevronDown className="size-5" />
          </motion.div>
        </section>

        {/* Feature Section: The Logic Forge */}
        <section className="relative py-24 px-4 overflow-hidden">
          <div className="max-w-6xl mx-auto flex flex-col gap-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col gap-4 text-center items-center"
            >
              <h2 className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 text-3xl md:text-5xl font-display font-bold tracking-tight">
                The Logic Forge
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
                Experience the future of market research data processing with our automated 3-step pipeline.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {[
                {
                  icon: FileText,
                  title: 'PDF Ingestion',
                  description:
                    'Upload raw questionnaire PDFs directly into the system. Our parser identifies questions, variables, and routing instructions instantly.',
                },
                {
                  icon: Network,
                  title: '3D Logic Visualization',
                  description:
                    'Visualize skip logic and routing in an immersive 3D node space. Manipulate paths and verify logic visually before coding.',
                  featured: true,
                },
                {
                  icon: Terminal,
                  title: 'SPSS Auto-Generation',
                  description:
                    'Instantly generate error-free SPSS syntax files ready for processing. Export definition files with perfect formatting.',
                },
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 }}
                >
                  <TiltCard>
                    <GlassCard
                      className={`p-8 flex flex-col gap-6 group hover:-translate-y-2 transition-transform duration-300 h-full ${
                        feature.featured ? 'relative overflow-hidden' : ''
                      }`}
                      glowColor={feature.featured ? 'purple' : 'primary'}
                    >
                      {feature.featured && (
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 blur-[60px] rounded-full" />
                      )}
                      <div
                        className={`size-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary group-hover:text-white text-primary transition-colors duration-300 relative z-10 ${
                          feature.featured ? '' : ''
                        }`}
                      >
                        <feature.icon className="size-7" />
                      </div>
                      <div className="flex flex-col gap-2 relative z-10">
                        <h3 className="text-white text-xl font-bold tracking-wide">{feature.title}</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                      </div>
                    </GlassCard>
                  </TiltCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-20 px-4">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-primary/10 blur-[100px] rounded-full" />
          </div>
          <div className="max-w-4xl mx-auto">
            <GlassCard className="p-10 md:p-16 flex flex-col items-center text-center gap-8 relative overflow-hidden border border-primary/30">
              {/* Decorative grid */}
              <div className="absolute inset-0 bg-grid-pattern opacity-30" />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative z-10 flex flex-col gap-4 items-center"
              >
                <h2 className="text-4xl md:text-5xl font-display font-black text-white tracking-tight">
                  Ready to Enter the Forge?
                </h2>
                <p className="text-gray-300 text-lg max-w-xl">
                  Join the waiting list to get early access to the LogicSphere engine. Transform your workflow today.
                </p>
              </motion.div>
              <div className="relative z-10 w-full max-w-md flex flex-col sm:flex-row gap-3">
                <input
                  className="flex-grow h-12 bg-black/40 border border-primary/30 rounded-lg px-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary text-sm tracking-wider font-mono"
                  placeholder="ENTER YOUR EMAIL"
                  type="email"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="h-12 px-6 bg-primary hover:bg-violet-600 text-white font-bold rounded-lg uppercase tracking-wide btn-primary-glow whitespace-nowrap"
                >
                  Request Access
                </motion.button>
              </div>
              <p className="relative z-10 text-xs text-gray-500 uppercase tracking-widest mt-4">
                Limited Spots Available for Beta
              </p>
            </GlassCard>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-black/40 backdrop-blur-sm pt-16 pb-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col gap-10">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10">
            <div className="flex flex-col gap-4 max-w-xs">
              <div className="flex items-center gap-2 text-white font-display font-bold text-lg tracking-wide uppercase">
                <Code2 className="text-primary size-5" />
                LogicSphere
              </div>
              <p className="text-gray-500 text-sm">
                Advanced AI syntax generation for modern market research professionals.
              </p>
            </div>
            <div className="flex flex-wrap gap-12 md:gap-20">
              {[
                { title: 'Product', links: ['Features', 'Integration', 'Pricing'] },
                { title: 'Resources', links: ['Documentation', 'API Reference', 'Status'] },
                { title: 'Company', links: ['About', 'Legal', 'Contact'] },
              ].map((section) => (
                <div key={section.title} className="flex flex-col gap-4">
                  <h4 className="text-white text-xs font-bold uppercase tracking-widest">{section.title}</h4>
                  {section.links.map((link) => (
                    <a key={link} href="#" className="text-gray-500 hover:text-primary text-sm">
                      {link}
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-gray-600 text-xs">© 2024 LogicSphere AI. All systems nominal.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}







