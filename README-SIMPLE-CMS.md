# AI Globally — Simple CMS build (no Eleventy)

This version preserves the original V2 HTML/CSS design and uses Pages CMS + one small Node build script.

## Normal publishing workflow
1. Open Pages CMS.
2. Add/edit an article and upload the featured image there.
3. Save. Pages CMS commits the Markdown + image to GitHub.
4. Cloudflare automatically runs `npm install && npm run build`.
5. Cloudflare serves the generated `dist/` folder.

You do **not** edit HTML for new articles.

## Homepage rules
- Popular News: articles where `Show in Popular News` is enabled, max 2.
- Latest News: newest News articles, max 5.
- Insights: newest Insight articles, max 3.
- Explainers: newest Explainer articles, max 2.

## Cloudflare settings
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: leave blank

## Local test
```powershell
npm.cmd install
npm.cmd run build
npx serve dist
```
Then open the localhost URL shown by `serve`.
