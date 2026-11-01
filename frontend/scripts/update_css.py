#!/usr/bin/env python3
"""Update CSS file with all veris-* classes and improvements."""

old = open(r'c:\Projects\Veris\frontend\src\styles\index.css', 'r').read()

# Fix extra variables (line 6-9 area)
old = old.replace(
  '  --text-secondary: #d8d4e5; --ink-950:#06080b; --ink-900:#080a12; --ink-800:#0f121c;\n',
  '  --text-secondary: #d8d4e5; --ink-950:#06080b; --ink-900:#080a12; --ink-800:#0f121c; --ink-700:#1a1e2e;\n  --ink-600:#2a2e3e;\n'
)
old = old.replace(
  '  --radius: 0.6rem;\n}',
  '  --radius:.6rem; --radius-lg:.75rem;\n  --shadow-soft: 0 2px 12px rgba(5,2,30,.28), inset 0 1px 0 rgba(255,255,255,.04);\n  --shadow-neon:  0 0 28px rgba(139,92,246,.30), inset 0 1px 0 rgba(255,255,255,.05);\n}'
)

open(r'c:\Projects\Veris\frontend\src\styles\index.css', 'w').write(old)
print('Variables updated')