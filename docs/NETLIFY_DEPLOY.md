# Deploy to Netlify

The Phase 0 application is configured for a Git-connected Netlify deployment.
Build settings live in `netlify.toml`, so no custom dashboard build command is
required.

## First deployment

1. Push this repository to a Git provider supported by Netlify.
2. In Netlify, choose **Add new project → Import an existing project**.
3. Select the repository. Netlify will read `netlify.toml` and use:
   - Build command: `pnpm build`
   - Publish directory: `.next`
   - Node.js: 22
   - pnpm: the version in `package.json`
4. Before deploying, add these environment variables in Netlify:

   ```text
   APP_MODE=local
   AUTH_MODE=demo
   DEMO_COMPANY_ID=demo-salon
   NEXT_PUBLIC_APP_NAME=My Little Company
   NEXT_PUBLIC_DEMO_MODE=true
   ```

5. Deploy the site. Later pushes to the selected production branch will build
   automatically.

No AWS or sponsor credentials are required for the Phase 0 local-mode build.
Do not add private values to `netlify.toml` or commit `.env.local`.

## Local verification

Run the same production build used by Netlify:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Netlify's current Next.js runtime is detected during the build. This project does
not install the legacy Netlify Next.js plugin directly.
