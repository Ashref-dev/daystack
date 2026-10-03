# Folio design system
## 0. Research Log
User PRD is the visual authority: tactile stacked weekday sheets, Archivo display, Inter body, orange completion. Minimalist reference supplies restraint; explicit brief overrides its conflicting font and accent bans. Svelte/PWA official patterns verified by librarian. Image-generation tooling unavailable; original icon is authored vector geometry rasterized locally.
## 1. Direction
Operate mode. A personal paper folio, not a dashboard. Oversized day names are the navigation. The active sheet lifts from a seven-sheet stack; orange indicates today and completion only.
## 2. Color
Light: canvas #eae9e4, active #faf9f6, sheets #e2e1dc, ink #292924, secondary #62625b, tertiary #696962, orange #e94d20, soft orange #fce6dc, divider #d5d4ce. Dark: canvas #171816, active #282a26, sheets #222420, ink #f3f3ed, secondary #b2b5aa, orange #ff7950, divider #383b34. White check on orange; orange buttons use dark ink where required for contrast. Secondary text was darkened after measured AA contrast checks on collapsed sheets.
## 3. Typography
Self-hosted Archivo Black weekday display (36 mobile, 48 desktop), Inter body (17 tasks, 14 controls, 12 metadata). Tabular times. Tracking -0.035em display. No decorative serif or mono.
## 4. Geometry
4px base. Content max 780px. 24px outer desktop / 16px mobile. Day sections 80px collapsed, expanded natural height. Sheet radius 16px. Controls at least 44px. Task checkbox 24px within 44px hit target. Safe area insets on page and sheets.
## 5. Primitives
Icon button: hover tonal fill, visible focus, 44px target. Primary button: ink fill, paper text, 12px radius. Checkbox: square orange fill and drawn check, completed text strikethrough. Day header: one expanded, date and restrained count. Sheet: native dialog, focus trapped, escape/backdrop dismiss, 560px max desktop, bottom aligned mobile. Weekday pills: labelled, selected ink fill. Form fields: tonal fill, clear labels and focus ring. Error copy: calm inline recovery.
## 6. Motion
The checkbox check draws in 180ms, while its fill and text strike reverse cleanly. Modal opening focuses the title field and dismissal restores the trigger, including Safari touch activation. These are the bounded final micro-interaction refinements; no new motion dependency or PWA architecture is introduced.
180–240ms ease-out opacity/transform for sheets, checkbox and active feedback. Reduced motion disables animation. No confetti, entrance cascade or decorative loops.
## 7. Responsive
Same vertical week at all sizes. Header compresses on mobile. Sheet scrolls independently and leaves save controls reachable with keyboard. Bulk rows stack on phones, weekday controls stay full touch size.
## 8. Accessibility and debt
Checkbox boundaries use #888880 in light and #82877a in dark (minimum 3:1 on the active paper). Dark completed checks use #21231f on orange; light checks stay white. Save controls stick at zero within sheet scrollports with bottom clearance. Paired Date/Time labels are single-row, and weekday pills retain 44px targets.
Phone sheet height and bottom offset track the visual viewport so the soft keyboard does not cover actions. Native dialogs are explicitly labelled and restore focus to the opening control. Active-day counts move to the date row on phones, leaving long weekday names unobstructed.
Semantic headings/buttons, labelled checkbox state, native modal focus management, live status, readable muted text. Real-device install and background remote push QA remain deployment gates. No fake sync or notification promises.
