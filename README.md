# Pulsar Multi-Model Review Radar

Static archive and product-feedback analysis for public reviews across the customer model list mapped to Pulsar Shop products.

The generated website is `dist/index.html`. GitHub Pages deployment is handled by `.github/workflows/pages.yml`.

Refresh the official Judge.me review data and rebuild the page:

```bash
node scripts/build-radar.mjs
```

The current mapped families are SYNDR THERMO, Hall Pass, DL Wax Box, DL 6.0, 3 in 1 / DELTA BOX, and Cigar 510. Unmatched model families remain visible as monitoring targets and must not be force-mapped without evidence.

Data boundaries:

- Review volume is not treated as sales volume or defect rate.
- Missing reviewer avatars remain missing; initials are displayed instead.
- User statements, analytical inference, and R&D verification recommendations are kept separate.
- Model aliases and colors are deduplicated into a single public product family.
