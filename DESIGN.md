# Design System: postman-web

## 1. Visual Theme & Atmosphere

postman-web is a focused gateway request workbench: quiet, technical, and trustworthy. The interface should feel like a well-lit protocol console rather than a marketing surface. Density is Daily App Balanced (6/10), variance is Offset Asymmetric (6/10), and motion is Fluid CSS (5/10). Layouts favor clear work zones, compact controls, and readable debug output.

## 2. Color Palette & Roles

- **Fog Canvas** (#F6F7F4) - Primary page background, slightly warm-neutral without becoming beige.
- **Porcelain Surface** (#FFFFFF) - Form panels, menus, and raised tool surfaces.
- **Zinc Ink** (#18181B) - Primary text, code headings, and high-emphasis labels.
- **Graphite Line** (#3F3F46) - Strong structural text, badges, and code shell details.
- **Muted Slate** (#71717A) - Secondary descriptions, helper text, inactive icon color.
- **Whisper Border** (rgba(212, 212, 216, 0.72)) - 1px dividers, input borders, panel rails.
- **Code Charcoal** (#202124) - Code preview background; never use pure black.
- **Moss Circuit** (#4F6F52) - The only accent color; CTAs, active states, focus rings, live status.

## 3. Typography Rules

- **Display:** Geist or Satoshi style sans-serif - controlled `clamp()` scale, tight tracking, weight-driven hierarchy.
- **Body:** Geist or Satoshi style sans-serif - relaxed leading, max 65ch for prose, no generic marketing tone.
- **Mono:** Geist Mono or JetBrains Mono style stack - all code, method labels, status codes, timestamps, and generated protocol data.
- **Banned:** Inter, generic serif fonts, pure system-font-only styling for premium surfaces. Serif fonts are not used in this software UI.

## 4. Component Stylings

- **Buttons:** Minimum 44px tap target. Primary buttons use Moss Circuit fill, no glow. Hover lifts with a slight background shift; active state uses a tactile `translateY(1px)` or `scale(0.99)`.
- **Panels:** Use cards only for functional grouping. Panels have 8px radius, subtle tinted shadows, and clear top rails or header dividers. Do not nest decorative cards inside panels.
- **Inputs:** Label above input, error below. Focus ring uses Moss Circuit at low opacity. Inputs stay light, rectangular, and dense enough for repeated tool use.
- **Segmented Controls:** Flat shell with a moving active surface feel through background contrast, never neon.
- **Code Panels:** Dark charcoal shell, monospace text, stable height constraints, empty-state text matching the panel rhythm.
- **Alerts:** Inline, direct, and specific. Error states use muted red surfaces with no exclamation marks.

## 5. Layout Principles

Use CSS Grid for the workbench. The desktop composition is asymmetric: request input, encryption settings, and generated output use different column weights according to task importance. Below 768px, every multi-column layout collapses to one column with no horizontal scroll. The page container is max-width constrained around 1500px and centered. Full-height surfaces use `min-h-[100dvh]`, never `h-screen`.

## 6. Motion & Interaction

Use CSS transitions with `cubic-bezier(0.16, 1, 0.3, 1)` around 180-260ms. Animate only `transform`, `opacity`, `color`, `background-color`, and `box-shadow`. Active components can have restrained perpetual motion such as a breathing status dot or shimmer in code shells. No custom cursors and no animations that depend on layout properties.

## 7. Anti-Patterns (Banned)

No emojis. No Inter. No pure black (`#000000`). No neon or outer glow shadows. No oversaturated accents. No purple-blue AI gradients. No excessive gradient text. No custom mouse cursors. No overlapping text or controls. No generic 3-column marketing card rows. No fake round metrics such as `99.99%`. No placeholder names such as John Doe, Acme, or Nexus. No AI copywriting cliches such as "Elevate", "Seamless", "Unleash", or "Next-Gen". No filler UI text such as "Scroll to explore" or bouncing scroll arrows.
