# Current validation

- `npm ci` and `npm run check`: passed on Node 24.19.0.
- HTTP health and root response: passed, including content security policy headers.
- Chromium browser checks: passed coach/client navigation, habit persistence across reload, per-client demo state separation, submitted check-in snapshot visibility in coach records, separate journal save/review, habit editing, Roman Hindi client selection, CSV file download and 390px mobile viewport overflow check.
- No browser runtime errors during those interactions.
- Desktop and mobile screenshots were inspected/generated in this run.

These checks do not validate production authentication, server-side access isolation, automated report scheduling, backups, signing, billing or deployment. Those capabilities are not implemented.

## Mobile navigation correction

Verified in Chromium at 375, 390 and 430 CSS pixels: sidebar height below 110px, page heading above the fold, persistent four-button bottom navigation, expanded More menu access, menu close after navigation, all 15 assigned habits present, both coach and client navigation, and no horizontal page overflow. Desktop sidebar remains visible and bottom navigation is hidden at 1440px. No runtime errors in the tested interactions. Updated mobile screenshots are included. Physical iPhone/Safari testing remains unverified.

## Enrollment and calendar update

Chromium workflow checks passed: no language selector, fictional lead registration and persistence, original 30-question submission and read-only submitted entries, payment/plan activation prerequisites, ten generated calls, hold removal and resume restoration, coach practice assignment, per-window tick controls, sequential daily material gating including scheduled-day restriction, and mobile horizontal overflow. No runtime errors in the exercised flows. No real email, payment, secure account or external calendar integration was tested or claimed.
