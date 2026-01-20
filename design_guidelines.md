# Design Guidelines: Programming Learning Documentation App

## Design Approach
**Selected Approach:** Custom Brand-Driven Design with Utility Focus

This application combines the information architecture of documentation tools (like MDN, DevDocs) with a vibrant, encouraging visual language that makes learning approachable. Think Duolingo meets VS Code - serious functionality with playful presentation.

---

## Core Design Elements

### A. Color System
**Primary Palette:**
- Orange: `#FF8C42` (primary), `#FFA566` (light variant)
- Pink: `#FF6B9D` (secondary), `#FFB3C6` (light variant)
- Blue: `#4A90E2` (accent), `#7CB9E8` (light variant)

**Application:**
- Chapter cards: Gradient backgrounds rotating through primary colors
- Primary CTAs: Orange gradient (`#FF8C42` to `#FFA566`)
- Secondary actions: Pink gradient
- Info/Help elements: Blue gradient
- Neutral backgrounds: `#FFFFFF`, `#F8F9FA`, `#E9ECEF`
- Text: `#1A1A1A` (primary), `#666666` (secondary)

### B. Typography
**Font Stack:**
- Primary: 'Inter' from Google Fonts (clean, modern, excellent readability)
- Code: 'Fira Code' or 'JetBrains Mono' (monospace with ligatures)

**Hierarchy:**
- H1 (Page titles): 2.5rem, font-weight 700
- H2 (Section headers): 2rem, font-weight 600
- H3 (Card titles): 1.5rem, font-weight 600
- Body: 1rem, font-weight 400, line-height 1.6
- Code: 0.875rem, line-height 1.5

### C. Layout System
**Spacing Scale:** Tailwind units of 2, 4, 6, 8, 12, 16
- Card padding: `p-6` or `p-8`
- Section spacing: `mb-12` between major sections
- Grid gaps: `gap-6` for chapter cards, `gap-4` for smaller elements
- Container max-width: `max-w-7xl` with `px-6`

---

## Page-Specific Layouts

### 1. Dashboard (Home Page)
**Layout:** No hero section needed - immediate content focus

**Structure:**
- Header bar: Logo/title on left, "Edit Mode" toggle on right (h-16, sticky)
- Chapter grid: 2-4 columns responsive (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`)
- Each card: Aspect ratio ~4:3, gradient background, white text overlay

**Chapter Cards:**
- Rounded corners: `rounded-2xl` (16px)
- Shadow: Subtle elevation (`shadow-lg` on hover, `shadow-md` default)
- Content: Icon/emoji at top, chapter title (h3), problem count below
- Delete icon: Top-right corner in edit mode, red with backdrop blur
- Hover: Lift effect (transform translateY -4px), increased shadow

### 2. Chapter Page (Problem List)
**Layout:**
- Breadcrumb: Top left, text-sm with chevron separators
- "Add New Problem" button: Top right, prominent orange gradient
- Problem list: Single column, full-width cards with `space-y-4`

**Problem Cards:**
- Two states: Collapsed (title + metadata) / Expanded (+ action buttons)
- Left border accent: 4px colored stripe (rotating through palette)
- Metadata: Small gray text showing date, status indicator (dot or badge)
- Action row: Delete (red), Rename (blue), Reorder handles (gray icons)

### 3. Problem Detail Page
**Layout:**
- Breadcrumb navigation at top
- Empty state: Centered message with large "Edit" button (orange gradient, large size)
- Edit mode: "Add Block" dropdown button at top (pink gradient)
- Blocks: Vertical stack with `space-y-6`, drag handles on left in edit mode

---

## Component Library

### A. Cards
- All cards: `rounded-2xl`, `shadow-md` default
- Hover states: `shadow-lg`, slight transform
- Gradient overlays on chapter cards (diagonal 45deg)

### B. Buttons
**Primary (Orange):**
- Gradient background, white text, `rounded-lg`
- Sizes: Small (px-4 py-2), Medium (px-6 py-3), Large (px-8 py-4)
- Hover: Slightly darker gradient, no transform

**Secondary (Pink/Blue):**
- Outlined variant with colored border and text
- Filled variant with gradient (contextual use)

**Icon Buttons:**
- Circular or square with padding, icon-only
- Backdrop blur when over images: `backdrop-blur-md bg-white/20`

### C. Block Components

**Problem Block:**
- White background, `rounded-xl`, `p-6`
- Rich text area with toolbar above
- Image upload zone: Dashed border, drag-drop area
- Uploaded images: Grid preview with remove icons
- Video embed: Input field with preview card below

**Code Block:**
- Dark background (`#1E1E1E` or `#282C34`)
- Language selector: Top-right dropdown, small
- Line numbers: Left gutter, gray text
- Copy button: Top-right, icon-only with tooltip
- Syntax highlighting via Prism.js (Dracula or Night Owl theme)

**Text Block:**
- White background, `rounded-xl`, `p-6`
- Rich text editor (same as Problem Block)
- "AI Explain" button: Bottom-right, blue gradient, icon + text
- Loading state: Spinner overlay with semi-transparent backdrop

### D. Editing Controls
- Drag handles: Six dots icon, gray, left margin
- Delete buttons: Red text/icon, subtle hover background
- Reorder arrows: Up/down chevrons in gray
- Save/Cancel: Fixed bottom bar with blur backdrop, green save button

### E. Navigation
- Breadcrumbs: Horizontal list with chevron separators, text-sm
- Edit mode toggle: Switch/toggle component, orange when active

---

## Animations & Interactions
**Use Sparingly:**
- Card hover: 150ms ease transform and shadow
- Button hover: 100ms ease background change
- Page transitions: 200ms fade between views
- Block reorder: Smooth position animation (300ms)
- Loading states: Spinner rotation, skeleton screens for content

**No animations on:**
- Text appearing
- Scroll-triggered effects
- Excessive micro-interactions

---

## Images
**No hero images required** - This is a utility-focused documentation tool.

**Where images appear:**
- Problem blocks: User-uploaded screenshots/diagrams
- Empty states: Small illustrative icon or emoji
- Tutorial content: Inline within text/problem blocks

---

## Responsive Behavior
- Mobile (<768px): Single column, stacked layouts
- Tablet (768-1024px): 2-column grids, condensed spacing
- Desktop (>1024px): Full multi-column grids, expanded spacing
- Navigation: Breadcrumbs collapse to icons on mobile

---

## Key Design Principles
1. **Cheerful Utility:** Bright colors make learning feel approachable
2. **Content First:** No hero sections, immediate access to functionality
3. **Clear Hierarchy:** Typography and spacing create obvious information structure
4. **Smooth Interactions:** Polish in transitions without distraction
5. **Visual Feedback:** Color-coded status, hover states, loading indicators