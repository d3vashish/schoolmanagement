# Implementation Plan: Update Color Schema to Vibrant Purple

The goal is to update the entire website's color scheme to match the provided screenshot, transitioning from the current warm amber/cream palette to a vibrant purple/indigo theme with a colored sidebar.

## 1. Update CSS Variables (`index.css`)
We will redefine the core CSS variables in `src/index.css` to match the new design:
- `--color-primary`: `#7367F0` (Vibrant Purple)
- `--color-sidebar`: `#7367F0` (Sidebar background is now purple instead of cream)
- `--color-background`: `#F8F9FA` (Very light gray/blue background for main content)
- Update button styles (`.btn-primary`, `.btn-secondary`) to use the new primary color.
- Update `.sidebar-link` styles. Since the sidebar background will now be dark purple, the text needs to be white/light gray, and the active state should be a white pill with purple text.

## 2. Revert/Update Hardcoded Colors in Components
The previous assistant performed a bulk replacement that hardcoded amber hex codes (e.g., `bg-[#D98C00]`) directly into many React components. This is not ideal for maintainability.
- I will run a script to find all instances of these hardcoded amber hex codes (`#D98C00`, `#FFF1E6`, etc.) across all `.jsx` files.
- I will replace them with semantic Tailwind classes like `bg-indigo-600`, `bg-indigo-50`, `text-indigo-600`, etc., or directly with the new CSS variables where appropriate.
- This will ensure the components correctly adopt the new purple/indigo theme and remain clean.

## 3. Verify Layout and Contrast
- Check the sidebar to ensure the logo and text are legible against the new purple background.
- Ensure the main content area has the correct light background and cards remain white with soft shadows.

Does this plan sound good? If so, I will proceed with updating the CSS and cleaning up the component files!
