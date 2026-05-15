# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-05-13

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->
- Summary screen participant names should be left-aligned.
- Summary progress bars should use the full available row width.

## Key Learnings

- **Project:** standup-rotation
- Summary screen alignment depends on a shared 440px content rail for both `.summary-stats` and `.summary-list`.
- Summary progress bars are most readable on this dark theme when the track is subtly accent-tinted and the fill blends accent→current.
- **Running phase layout:** `.main--stage` removes max-width/padding; `stage-od` fills it with `position: relative; width/height: 100%`. All person-cards are `position: absolute` with computed left/top inside `.cards-field`.
- **FLIP pattern:** capture positions in a ref BEFORE calling `setRotation` (via `capturePositions()`), then `useLayoutEffect` after rotation change animates the delta with `element.animate()`. All cards must be in ONE flat parent container — React won't move DOM nodes between parent elements.
- **Perf emoji stamps:** ⚡ (<60s), ✅ (60-120s), ⏰ (120-180s), 🗣️ (180s+), 🏃 (skipped). Applied via CSS `emoji-stamp` keyframe animation when card enters done state.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

## Decision Log

- **[2026-05-13]** Built standup rotation app with React + Vite (no external UI lib). Tech: CSS custom properties with OKLCH colors, localStorage persistence, in-app state via useState. Fonts: Bricolage Grotesque + Epilogue from Google Fonts. Dark theme.
