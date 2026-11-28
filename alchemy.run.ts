// Deploys the built game to Cloudflare as Worker static assets: no server code, no storage.
// `pnpm run deploy` shows the plan and asks before applying (plain `pnpm deploy` is a pnpm built-in); `pnpm run destroy` removes it.
// Auth: `pnpm exec alchemy profile edit --add Cloudflare` locally; CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in CI.
// Alchemy (and Effect, which it is built on) are dev dependencies only: nothing here reaches the game bundle.
import * as Cloudflare from '@alchemy.run/cloudflare'
import * as Alchemy from 'alchemy'
import * as Effect from 'effect/Effect'

export default Alchemy.Stack(
  'Powder',
  {
    providers: Cloudflare.providers(),
    // state lives in a small Worker on your Cloudflare account, so local and CI deploys share it
    state: Cloudflare.state(),
  },
  Effect.gen(function* website() {
    // runs `vite build` with vite.config.ts and uploads dist/; models keep loading from BASE_URL/models/
    const site = yield* Cloudflare.Website.Vite('Website', {
      assets: { notFoundHandling: 'single-page-application' },
    })
    return { url: site.url }
  }),
)
