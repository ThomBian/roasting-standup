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

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

## Decision Log

- **[2026-05-13]** Built standup rotation app with React + Vite (no external UI lib). Tech: CSS custom properties with OKLCH colors, localStorage persistence, in-app state via useState. Fonts: Bricolage Grotesque + Epilogue from Google Fonts. Dark theme.
