# VITALS PWA

**Personal health intelligence dashboard** — macro tracking, food recognition, physique analysis.

## Stack
- Next.js 14 App Router + TypeScript + Tailwind CSS
- shadcn/ui components
- Supabase (auth + database + storage)
- Claude API (vision + text parsing)
- PWA manifest for iOS/Android install

## Pages
| Route | Description |
|-------|-------------|
| `/` | Today's macros dashboard |
| `/food` | Snap plate → Claude Vision → log macros |
| `/label` | Scan nutrition label → OCR → log |
| `/voice` | Record/type meal → Claude parses → log |
| `/workout` | Log session + sets via text/voice |
| `/progress` | Physique photos → Claude analysis → **NOT stored** |
| `/history` | 7-day calorie heatmap + workout log |

## API Routes
- `POST /api/analyze-food` — Claude Vision food analysis
- `POST /api/analyze-label` — Claude Vision OCR for nutrition labels
- `POST /api/analyze-physique` — Physique analysis (image NOT persisted)
- `POST /api/parse-text` — Claude text-to-macros parser
- `POST /api/parse-workout` — Claude workout set parser

## Privacy
Photos uploaded to `/progress` are:
1. Sent directly to Claude API over HTTPS
2. **Immediately discarded** after analysis
3. **Never stored** in Supabase or any file system
4. Only the text analysis JSON is saved to `physique_snapshots`

## Supabase Schema
Run `/supabase/schema.sql` in your Supabase SQL editor.

## Setup
1. Create Supabase project at supabase.com
2. Run `supabase/schema.sql`
3. Add env vars to Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
4. Enable Supabase Auth → Email (magic link)
5. Add `vricco6@gmail.com` as the only allowed user (or use RLS)

## Install as PWA
On iOS: Safari → Share → Add to Home Screen
On Android: Chrome → Menu → Add to Home Screen
