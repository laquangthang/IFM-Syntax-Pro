'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import MainLayout from '../Layout/MainLayout'
import GlassCard from '../ui/GlassCard'
import { Sparkles, Search, Copy, CheckCircle2, Link2, Save } from 'lucide-react'
import ThemeToggle from '../ThemeToggle'
import LaserScan from '../ui/LaserScan'

interface Variable {
  id: string
  oldName: string
  qid?: string
  label?: string
  confidence?: number
  status: 'matched' | 'partial' | 'pending'
}

export default function VariableMapping() {
  const [variables, setVariables] = useState<Variable[]>([
    {
      id: '1',
      oldName: 'Q4_brands_r1',
      qid: '10425',
      label: 'Brand Pref',
      confidence: 98,
      status: 'matched',
    },
    {
      id: '2',
      oldName: 'dem_gender',
      qid: '10426',
      label: 'Gender',
      confidence: 95,
      status: 'matched',
    },
    {
      id: '3',
      oldName: 'grid_r1_c1',
      qid: '10427_1',
      label: 'Grid: Taste',
      confidence: 60,
      status: 'partial',
    },
    {
      id: '4',
      oldName: '',
      status: 'pending',
    },
  ])

  const [selectedVariable, setSelectedVariable] = useState<Variable | null>(variables[0])
  const [newVarName, setNewVarName] = useState('Var_Brand_Preference')
  const [cleanLabel, setCleanLabel] = useState('Brand Preference: Weekly Consumption')
  const [isAICleaning, setIsAICleaning] = useState(false)

  const aiInsights = [
    { qid: '10425', type: 'MA', text: 'Which of the following brands do you consume on a weekly basis?' },
    { qid: '10426', type: 'SA', text: 'Please confirm your gender.' },
    { qid: '10427', type: 'Grid', text: 'Rate the following attributes on a scale of 1-10.' },
    { qid: '10428', type: 'OE', text: 'Why did you choose that brand? (Open End)' },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'matched':
        return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
      case 'partial':
        return 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]'
      default:
        return 'bg-[#2b2839]'
    }
  }

  const handleCleanLabel = () => {
    // Trigger laser scan effect
    setIsAICleaning(true)
    
    // Simulate AI cleaning process
    setTimeout(() => {
      setIsAICleaning(false)
      // Here you would call the actual AI cleaning API
    }, 2000)
  }

  return (
    <MainLayout>
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-glass-border-light dark:border-glass-border-dark glass-panel z-40 relative bg-background-light dark:bg-background-dark">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <a href="#" className="hover:text-foreground">Projects</a>
            <span className="text-[16px]">›</span>
            <a href="#" className="hover:text-foreground">Project Alpha</a>
            <span className="text-[16px]">›</span>
            <span className="text-foreground bg-primary/10 dark:bg-primary/10 px-2 py-0.5 rounded text-xs border border-primary/30">
              Label Refinery
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-glass-bg-light dark:bg-glass-bg-dark rounded-lg h-9 px-3 border border-glass-border-light dark:border-glass-border-dark">
            <Search className="size-4 text-muted-foreground mr-2" />
            <input
              className="bg-transparent border-none text-sm text-foreground focus:ring-0 placeholder-muted-foreground w-48"
              placeholder="Search QID or Var..."
              type="text"
            />
          </div>
          <div className="h-8 w-[1px] bg-glass-border-light dark:bg-glass-border-dark" />
          <button className="flex items-center justify-center size-9 rounded-full bg-glass-bg-light dark:bg-glass-bg-dark text-foreground hover:bg-primary/10 transition-colors relative">
            <div className="absolute top-0 right-0 size-2.5 bg-red-500 border-2 border-background-light dark:border-background-dark rounded-full" />
            <span className="text-[20px]">🔔</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 relative flex flex-col overflow-hidden">
        <div className="flex-1 flex gap-6 min-h-0 mb-6">
          {/* AI Insights Panel */}
          <GlassCard className="w-[280px] flex flex-col shrink-0" tilt={false}>
            <div className="p-4 border-b border-glass-border-light dark:border-glass-border-dark flex justify-between items-center bg-glass-bg-light dark:bg-glass-bg-dark rounded-t-xl">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">AI Insights</h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto glass-scroll p-2 space-y-2">
              <AnimatePresence>
                {aiInsights.map((insight, index) => (
                  <motion.div
                    key={insight.qid}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 rounded-lg bg-glass-bg-light dark:bg-glass-bg-dark border border-primary/20 dark:border-primary/10 hover:border-primary/50 transition-colors group cursor-pointer relative overflow-hidden"
                  >
                    {isAICleaning && <LaserScan isActive={true} />}
                    <div className="flex justify-between items-start mb-1 relative z-10">
                      <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        QID: {insight.qid}
                      </span>
                      <span className="text-[10px] text-primary border border-primary/30 px-1 rounded">
                        {insight.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 group-hover:text-foreground transition-colors relative z-10">
                      {insight.text}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </GlassCard>

          {/* Mapping Station */}
          <GlassCard className="flex-1 flex flex-col" glowColor="primary">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />
            <div className="px-5 py-4 border-b border-glass-border-light dark:border-glass-border-dark flex justify-between items-center bg-glass-bg-light dark:bg-glass-bg-dark rounded-t-xl">
              <div>
                <h2 className="text-base font-bold text-foreground tracking-tight">Mapping Station</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Paste Excel columns to auto-match</p>
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-glass-bg-light dark:bg-glass-bg-dark hover:bg-primary/10 text-foreground text-xs font-medium border border-glass-border-light dark:border-glass-border-dark transition-colors">
                  📋 Paste
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-glass-bg-light dark:bg-glass-bg-dark hover:bg-primary/10 text-foreground text-xs font-medium border border-glass-border-light dark:border-glass-border-dark transition-colors">
                  📊 Import XLS
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto glass-scroll">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#1a1726] z-10 shadow-lg">
                  <tr className="text-xs text-[#a19cba] border-b border-white/10">
                    <th className="px-4 py-3 font-medium w-16 text-center">Match</th>
                    <th className="px-4 py-3 font-medium w-1/3">
                      OLD Variable Name <span className="text-[10px] opacity-60">(Source)</span>
                    </th>
                    <th className="px-4 py-3 font-medium text-center w-10">→</th>
                    <th className="px-4 py-3 font-medium w-1/3">
                      Matched QID <span className="text-[10px] opacity-60">(AI)</span>
                    </th>
                    <th className="px-4 py-3 font-medium text-right w-20">Conf.</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-mono">
                  <AnimatePresence>
                    {variables.map((variable, index) => (
                      <motion.tr
                        key={variable.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05, ease: 'easeOut' }}
                        className="group border-b border-white/5 hover:bg-white/5 transition-colors"
                        onClick={() => setSelectedVariable(variable)}
                      >
                        <td className="px-4 py-3 text-center">
                          <div className={`size-2 rounded-full mx-auto ${getStatusColor(variable.status)}`} />
                        </td>
                        <td className="px-4 py-3 text-white">
                          <input
                            className="w-full bg-transparent border-none focus:ring-0 text-white p-0 text-sm font-mono placeholder-white/20"
                            type="text"
                            value={variable.oldName}
                            onChange={(e) => {
                              const newVars = [...variables]
                              newVars[index].oldName = e.target.value
                              setVariables(newVars)
                            }}
                            placeholder="Paste variable..."
                          />
                        </td>
                        <td className="px-4 py-3 text-center text-[#a19cba]">
                          <Link2 className="size-4 mx-auto group-hover:text-primary transition-colors" />
                        </td>
                        <td className="px-4 py-3">
                          {variable.qid ? (
                            <div className="flex items-center gap-2 px-2 py-1 rounded border border-primary/30 bg-primary/10 w-fit">
                              <span className="text-primary font-bold">{variable.qid}</span>
                              {variable.label && (
                                <span className="text-[10px] text-[#a19cba]">{variable.label}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#a19cba] opacity-40 italic text-xs">Waiting for input...</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-green-400 text-xs">
                          {variable.confidence ? `${variable.confidence}%` : '-'}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Clean Workspace Panel */}
          <GlassCard className="w-[320px] flex flex-col shrink-0" glowColor="primary">
            <div className="p-4 border-b border-glass-border-light dark:border-glass-border-dark flex justify-between items-center bg-glass-bg-light dark:bg-glass-bg-dark rounded-t-xl">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-400 dark:text-green-500" />
                <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Clean Workspace</h3>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-5 overflow-y-auto glass-scroll flex-1">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Target Variable (New)
                  </label>
                  <span className="text-[10px] text-primary">Linked to 10425</span>
                </div>
                <input
                  className="w-full bg-glass-bg-light dark:bg-glass-bg-dark border border-primary/30 dark:border-primary/20 rounded px-3 py-2 text-foreground text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-[0_0_10px_rgba(239,91,33,0.1)] dark:shadow-[0_0_10px_rgba(239,91,33,0.05)]"
                  type="text"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1 relative">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Clean Label</label>
                <div className="relative">
                  <textarea
                    className="w-full bg-glass-bg-light dark:bg-glass-bg-dark border border-glass-border-light dark:border-glass-border-dark rounded px-3 py-2 text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all h-20 resize-none leading-relaxed"
                    spellCheck={false}
                    value={cleanLabel}
                    onChange={(e) => setCleanLabel(e.target.value)}
                  />
                  {isAICleaning && <LaserScan isActive={true} />}
                </div>
              </div>
              <div className="p-3 bg-glass-bg-light dark:bg-glass-bg-dark rounded border border-glass-border-light dark:border-glass-border-dark">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Attribute Settings</span>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded bg-glass-bg-light dark:bg-glass-bg-dark border-glass-border-light dark:border-glass-border-dark text-primary focus:ring-0 w-3 h-3"
                    />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground">Measurement: Nominal</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="rounded bg-glass-bg-light dark:bg-glass-bg-dark border-glass-border-light dark:border-glass-border-dark text-primary focus:ring-0 w-3 h-3"
                    />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground">Role: Input</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-glass-border-light dark:border-glass-border-dark bg-glass-bg-light dark:bg-glass-bg-dark">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCleanLabel}
                className="w-full py-2 rounded-lg bg-primary text-white dark:text-white text-xs font-bold hover:bg-primary-dark dark:hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 animate-glow-pulse relative overflow-hidden"
              >
                {isAICleaning && <LaserScan isActive={true} />}
                <Save className="size-4 relative z-10" />
                <span className="relative z-10">{isAICleaning ? 'AI Cleaning...' : 'Confirm Mapping'}</span>
              </motion.button>
            </div>
          </GlassCard>
        </div>

        {/* Syntax Forge Panel - Monokai IFM Theme */}
        <GlassCard className="h-[140px] shrink-0" glowColor="primary" tilt={false}>
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-primary to-primary-light rounded-l-xl" />
          <div className="px-4 py-2 border-b border-glass-border-light dark:border-glass-border-dark flex justify-between items-center bg-glass-bg-light dark:bg-glass-bg-dark rounded-t-xl rounded-tl-none ml-1">
            <div className="flex items-center gap-2">
              <span className="text-primary text-lg">⚡</span>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">
                Live Syntax Generation (SPSS)
              </h3>
            </div>
            <button className="text-[10px] text-primary hover:text-foreground transition-colors flex items-center gap-1">
              <Copy className="size-3" />
              Copy to Clipboard
            </button>
          </div>
          <div className="p-4 overflow-y-auto glass-scroll flex-1 font-mono text-xs leading-relaxed ml-1 bg-code-bg monokai-ifm">
            <div className="text-gray-400 dark:text-gray-500">
              <span className="syntax-keyword font-bold">RENAME VARIABLES</span> (Q4_brands_r1 ={' '}
              <span className="syntax-variable">{newVarName}</span>).<br />
              <span className="syntax-keyword font-bold">VARIABLE LABELS</span> <span className="syntax-variable">{newVarName}</span>{' '}
              <span className="syntax-string">'{cleanLabel}'</span>.<br />
              <span className="syntax-comment">* Auto-generated mapping based on QID 10425 context.</span>
            </div>
          </div>
        </GlassCard>
      </main>

      {/* Footer */}
      <div className="h-8 bg-glass-bg-light dark:bg-glass-bg-dark border-t border-glass-border-light dark:border-glass-border-dark flex items-center justify-between px-4 text-[10px] text-muted-foreground z-50 shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
            AI Engine Active
          </span>
          <span>Latency: 24ms</span>
        </div>
        <div>Auto-save: Enabled</div>
      </div>
    </MainLayout>
  )
}

