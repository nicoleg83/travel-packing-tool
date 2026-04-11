# Claude Project Configuration

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools directly.

Available gstack skills:
- `/office-hours` - Office hours session
- `/plan-ceo-review` - CEO review planning
- `/plan-eng-review` - Engineering review planning
- `/plan-design-review` - Design review planning
- `/design-consultation` - Design consultation
- `/review` - Code review
- `/ship` - Ship a feature
- `/land-and-deploy` - Land and deploy
- `/canary` - Canary deployment
- `/benchmark` - Benchmarking
- `/browse` - Web browsing (use this for ALL web browsing)
- `/qa` - QA testing
- `/qa-only` - QA only
- `/design-review` - Design review
- `/setup-browser-cookies` - Set up browser cookies
- `/setup-deploy` - Set up deployment
- `/retro` - Retrospective
- `/investigate` - Investigation
- `/document-release` - Document a release
- `/codex` - Codex
- `/cso` - CSO
- `/careful` - Careful mode
- `/freeze` - Freeze
- `/guard` - Guard
- `/unfreeze` - Unfreeze
- `/gstack-upgrade` - Upgrade gstack

If gstack skills aren't working, run the following to build the binary and register skills:
```
cd .claude/skills/gstack && ./setup
```

## Deploy Configuration (configured by /setup-deploy)
- Platform: Render (backend) + Vercel (frontend)
- Backend URL: https://travel-packing-tool.onrender.com
- Frontend URL: https://travel-packing-tool-ivory.vercel.app
- Deploy workflow: auto-deploy on push to main
- Backend health check: https://travel-packing-tool.onrender.com/
- Project type: full-stack web app (Express API + React/Vite frontend)

### Required environment variables
**Render (backend):**
- `ANTHROPIC_API_KEY` — your Anthropic API key
- `ALLOWED_ORIGIN` — https://travel-packing-tool-ivory.vercel.app
- `NODE_ENV` — set to `production`

**Vercel (frontend):**
- `VITE_API_URL` — https://travel-packing-tool.onrender.com

### Custom deploy hooks
- Pre-merge: none
- Deploy trigger: automatic on push to main (both platforms)
- Deploy status: poll health check URL
- Health check: https://travel-packing-tool.onrender.com/

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.
