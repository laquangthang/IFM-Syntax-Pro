'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import GlassCard from '../ui/GlassCard'
import { ArrowRight, Code2, FileText, Network, Terminal } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background-dark text-white">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-background-dark" />
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full" />
        <div className="absolute inset-0 top-[20%] bg-grid-pattern opacity-50 h-[150%]" />
      </div>

      {/* Navbar */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center py-4 px-4"
      >
        <nav className="flat-panel rounded-full px-6 py-3 flex items-center justify-between w-full max-w-6xl transition-all duration-300">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-full bg-primary/20 border border-primary/40 text-primary">
              <Code2 className="size-5" />
            </div>
            <span className="text-white font-display font-bold text-lg tracking-wide uppercase">IFM Syntax Pro</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/questions" className="text-gray-300 hover:text-primary transition-colors text-sm font-medium">
              Questions
            </Link>
            <Link href="/processing" className="text-gray-300 hover:text-primary transition-colors text-sm font-medium">
              Processing
            </Link>
            <a href="#" className="text-gray-300 hover:text-primary transition-colors text-sm font-medium">
              Documentation
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/projects"
              className="flex items-center justify-center rounded-full bg-primary hover:bg-primary-hover text-white px-5 py-2 text-sm font-bold transition-colors"
            >
              <span className="truncate">Go to Workspace</span>
            </Link>
          </div>
        </nav>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 flex-grow flex flex-col">
        {/* Hero Section */}
        <section className="relative flex flex-col items-center justify-center min-h-screen pt-20 px-4">
          <div className="flex flex-col max-w-[1200px] w-full gap-12 lg:gap-20 relative">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center text-center gap-6 z-10 pt-10"
            >
              <h1 className="text-white text-5xl md:text-7xl font-display font-black leading-tight tracking-tight max-w-4xl">
                Transform Raw Survey Data into{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-light">
                  SPSS Syntax in Seconds
                </span>
              </h1>
              <p className="text-gray-400 text-lg md:text-xl font-light max-w-2xl leading-relaxed">
                The ultimate data processing engine for Market Research. Automate your labeling, QC logic, and syntax generation.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full justify-center">
                <Link href="/projects">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center gap-2 rounded-lg h-14 px-8 bg-primary hover:bg-primary-hover text-white text-base font-bold shadow-card transition-colors"
                  >
                    Go to Workspace
                    <ArrowRight className="size-5" />
                  </motion.button>
                </Link>
                <Link href="/questions">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center rounded-lg h-14 px-8 bg-transparent border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 hover:bg-white/5 text-base font-medium transition-all"
                  >
                    Import Data
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            {/* App Screenshot Placeholder */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="relative w-full flex justify-center items-center mt-8"
            >
              <div className="w-full max-w-4xl aspect-[16/9] flat-card rounded-xl flex items-center justify-center border border-border-dark bg-surface-dark">
                <p className="text-muted-foreground text-sm font-medium">
                  App Screenshot / Mockup Here
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Feature Section */}
        <section className="relative py-24 px-4 overflow-hidden">
          <div className="max-w-6xl mx-auto flex flex-col gap-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col gap-4 text-center items-center"
            >
              <h2 className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 text-3xl md:text-5xl font-display font-bold tracking-tight">
                Built for Market Research
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
                A streamlined pipeline from raw data to production-ready SPSS syntax.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {[
                {
                  icon: FileText,
                  title: 'Excel Import',
                  description:
                    'Import SPSS-Excel format directly. Parse questions, variables, and value labels with one click.',
                },
                {
                  icon: Network,
                  title: 'QC Logic Visualization',
                  description:
                    'Visualize skip logic and routing in a clear node graph. Verify and edit logic before generating syntax.',
                  featured: true,
                },
                {
                  icon: Terminal,
                  title: 'SPSS Auto-Generation',
                  description:
                    'Generate error-free SPSS syntax files. Export definition files and QC logic with perfect formatting.',
                },
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 }}
                >
                  <GlassCard
                    className={`p-8 flex flex-col gap-6 group hover:-translate-y-1 transition-transform duration-300 h-full ${
                      feature.featured ? 'relative overflow-hidden' : ''
                    }`}
                  >
                    {feature.featured && (
                      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 blur-[60px] rounded-full" />
                    )}
                    <div
                      className={`size-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary group-hover:text-white text-primary transition-colors duration-300 relative z-10`}
                    >
                      <feature.icon className="size-7" />
                    </div>
                    <div className="flex flex-col gap-2 relative z-10">
                      <h3 className="text-white text-xl font-bold tracking-wide">{feature.title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                    </div>
                  </GlassCard>
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
              <div className="absolute inset-0 bg-grid-pattern opacity-30" />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative z-10 flex flex-col gap-4 items-center"
              >
                <h2 className="text-4xl md:text-5xl font-display font-black text-white tracking-tight">
                  Ready to streamline your workflow?
                </h2>
                <p className="text-gray-300 text-lg max-w-xl">
                  Start a new project or import your data to begin generating SPSS syntax in minutes.
                </p>
              </motion.div>
              <div className="relative z-10 flex flex-col sm:flex-row gap-3">
                <Link href="/projects">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="h-12 px-8 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-colors"
                  >
                    Go to Workspace
                  </motion.button>
                </Link>
                <Link href="/questions">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="h-12 px-8 bg-transparent border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-lg font-medium transition-all"
                  >
                    Import Data
                  </motion.button>
                </Link>
              </div>
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
                IFM Syntax Pro
              </div>
              <p className="text-gray-500 text-sm">
                Data processing and SPSS syntax generation for market research.
              </p>
            </div>
            <div className="flex flex-wrap gap-12 md:gap-20">
              {[
                { title: 'Product', links: ['Features', 'Documentation', 'Pricing'] },
                { title: 'Resources', links: ['API Reference', 'Support', 'Status'] },
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
            <p className="text-gray-600 text-xs">© 2024 IFM Syntax Pro.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
