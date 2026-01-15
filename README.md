# IFM Syntax Pro - LogicSphere

A modern, 3D Spatial UI application for IFM Syntax Generation with Glassmorphism design and advanced animations.

## Features

- 🎨 **3D Spatial UI** - Immersive 3D perspective effects with tilt interactions
- 💎 **Glassmorphism** - Beautiful glass-morphic panels and cards
- ✨ **Particle System** - Dynamic particle background with purple and cyan colors
- 🎭 **Framer Motion** - Smooth animations throughout the application
- 🎯 **Variable Mapping** - Advanced variable mapping interface with AI insights
- 💻 **Syntax Forge** - Live syntax generation with JetBrains Mono styling

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Framer Motion
- tsparticles
- Lucide React Icons

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Layout/           # Layout components (Sidebar, MainLayout)
│   ├── pages/            # Page components (VariableMapping)
│   ├── ui/               # UI components (TiltCard, GlassCard)
│   └── BackgroundParticles.tsx  # Particle system
└── stitch_logicsphere_workspace_dashboard/  # Legacy HTML files
```

## Design Principles

- **3D Perspective**: Using CSS `transform-style: preserve-3d` and `perspective`
- **Glassmorphism**: Backdrop blur, transparent borders, and subtle shadows
- **Neon Aesthetics**: Purple and cyan color scheme with glow effects
- **Smooth Animations**: Framer Motion for all transitions and interactions







