# Pulsar OEM Experience & Innovation Board

Action-oriented user-experience, product-improvement and innovation collaboration board built from public Pulsar Shop reviews. It serves product, R&D, quality, sales, supply-chain, manufacturing and packaging discussions while keeping observed feedback, hypotheses and validated conclusions separate.

The generated website is `dist/index.html`; supporting assets and an inspectable snapshot are written to `dist/`. GitHub Pages deployment is handled by `.github/workflows/pages.yml`.

Refresh the official Judge.me review data and rebuild the page:

```bash
node scripts/build-radar.mjs
```

The authoritative internal-to-customer mapping contains 12 families: D-026A / CORE 510 Battery, D-176 / 510 Daily, D-173 / Delta SMART BOX, G-069 / SYNDR, G-077 / DL wax box, G-103 / Chorus, G-132 / Dabtron 2.0, G-151 / Delta 3-in-1, D-148A / DL 6.0, D-153 / Hall Pass, D-170 / Relay, and G-158 / Voyager. Only unique, publicly verifiable Pulsar Shop matches are included in the live product filter; ambiguous or not-yet-listed models remain monitoring targets.

Data boundaries:

- Review volume is not treated as sales volume or defect rate.
- Issue counts are review-mention counts with visible denominators; one review can have several tags.
- Star ratings and content tags are independent, so high-star mixed reviews remain visible.
- Missing reviewer avatars remain missing; initials are displayed instead.
- The selected product's customer-site score is refreshed from Judge.me in the browser; the all-model value is weighted by each model's public review count and falls back to the generated snapshot if live access fails.
- User statements, analytical inference, and R&D verification recommendations are kept separate.
- Model aliases and colors are deduplicated into a single public product family.
- Source failures fall back to the last successful cache and are labeled; zero reviews, no matching results, fetch failures and pending model confirmation are distinct states.
- Collaboration fields are intentionally separate from source reviews and persist only in browser `localStorage` under `pulsar-oem-collaboration-v2`; they are not shared or uploaded.
- `data/snapshot-history.json` starts comparable-history accumulation. The first snapshot does not claim new, trend or period-over-period changes.
