# Pulsar Multi-Model Review Radar

Static archive and product-feedback analysis for public reviews across the customer model list mapped to Pulsar Shop products.

The generated website is `dist/index.html`. GitHub Pages deployment is handled by `.github/workflows/pages.yml`.

Refresh the official Judge.me review data and rebuild the page:

```bash
node scripts/build-radar.mjs
```

The authoritative internal-to-customer mapping contains 12 families: D-026A / CORE 510 Battery, D-176 / 510 Daily, D-173 / Delta SMART BOX, G-069 / SYNDR, G-077 / DL wax box, G-103 / Chorus, G-132 / Dabtron 2.0, G-151 / Delta 3-in-1, D-148A / DL 6.0, D-153 / Hall Pass, D-170 / Relay, and G-158 / Voyager. Only unique, publicly verifiable Pulsar Shop matches are included in the live product filter; ambiguous or not-yet-listed models remain monitoring targets.

Data boundaries:

- Review volume is not treated as sales volume or defect rate.
- Missing reviewer avatars remain missing; initials are displayed instead.
- User statements, analytical inference, and R&D verification recommendations are kept separate.
- Model aliases and colors are deduplicated into a single public product family.
