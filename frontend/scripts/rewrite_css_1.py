#!/usr/bin/env python3
"""Rewrite CSS file with complete styles."""

css = r"""/* ===== Root & Tokens ===== */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
:root { color-scheme: dark; }
:root {
  --bg-deep: #04060a; --bg-panel: rgba(14,12,30,0.72);
  --border-subtle: rgba(139,92,246,0.14); --border-accent: rgba(139,92,246,0.30);
  --text-primary: #f3f0ff; --text-secondary: #d8d4e5; --text-muted: #a9a3c4;
  --accent: #a78bfa; --violet:#8b5cf6; --cyan:#22d3ee; --magenta:#f472b6;
  --emerald:#34d399; --amber:#fbbf24;
  --ink-950:#06080b; --ink-900:#080a12; --ink-800:#0f121c; --ink-700:#1a1e2e;
  --radius:.6rem; --radius-lg:.75rem;
  --shadow-soft: 0 2px 12px rgba(5,2,30,.28), inset 0 1px 0 rgba(255,255,255,.04);
  --shadow-neon:  0 0 28px rgba(139,92,246,.30), inset 0 1px 0 rgba(255,255,255,.05);
}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-padding-top: env(safe-area-inset-top, 0); min-height: 100%; }
body {
  margin:0; min-height:100vh;
  background: radial-gradient(50% 45% at 78% 15%,#1a0f32 0%,transparent 65%),
              radial-gradient(40% 40% at 5% 100%,#0f1a3d 0%,transparent 65%),
              var(--bg-deep);
  color:var(--text-primary);
  font-family:'Inter',ui-sans-serif,system-ui,sans-serif;
  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
  font-feature-settings:"liga" 1,"kern" 1; text-rendering:optimizeLegibility;
  overflow-x:hidden;
  padding-top:env(safe-area-inset-top,0); padding-bottom:env(safe-area-inset-bottom,0);
}
/* Apple-sharp text helpers */
h1,h2,h3,h4,h5,h6 { -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; text-rendering:optimizeLegibility; font-weight:600; letter-spacing:-0.01em; }
p,label,span,button,input,textarea,td,th { -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; text-rendering:optimizeLegibility; }
.text-sharp { -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
