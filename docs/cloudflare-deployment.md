# Cloudflare deployment

The `ideogram-45` Worker is connected to `zyrliuwei-sys/ideogram-45` through
Cloudflare Workers Builds. Every commit pushed to `main` triggers a production
build and deploy to https://ideogram-45.com. Saving local files alone does not
trigger a deployment.

## Build settings

- Production branch: `main`
- Root directory: `/`
- Build command: `pnpm cf:ci:build`
- Deploy command: `pnpm exec wrangler deploy`
- Build watch include paths: `*` (all changes)
- Preview builds: disabled

`cf:ci:build` recreates the ignored `wrangler.jsonc` and `.env.production` from
the tracked `wrangler.production.json`, then builds the Cloudflare Worker.
Change `wrangler.production.json` when updating production bindings or public
variables; changes to the ignored local working copy are not included in Git
deployments. Keep secrets out of the production JSON and Git repository.

Runtime secrets and provider credentials remain in Cloudflare and the app's
admin settings. Deploying code does not apply production database migrations;
review and apply those separately using the production migration workflow.

## Check a deployment

Open the Worker's Deployments tab in Cloudflare to inspect the build for the
commit. A successful deployment replaces the live version; a failed build
leaves the previous version serving traffic. Check the build log before
retrying a failure.

For an authorized manual deployment, use `pnpm run cf:deploy` with the local
production environment and Wrangler login configured.
