# Training App Architecture & Delivery Plan

## 1. Stack Selection with Supabase Real-Time Support
- **Chosen stack:** React Native (Expo-managed workflow).
- **Rationale:**
  - Mature Supabase JavaScript client with first-class real-time subscriptions and Auth helpers.
  - Expo accelerates delivery with OTA updates, push notification tooling, and deep-link helpers.
  - Shared codebase for iOS/Android while keeping a responsive web surface through Expo Router + `expo-dev-client` and optional web build.
  - Rich ecosystem of gamification-friendly libraries (Reanimated, Victory Charts, react-native-svg).
- **Key dependencies:**
  - `@supabase/supabase-js` for real-time data sync, Auth, storage.
  - `expo-router` for navigation, enabling deep links.
  - `expo-notifications`, `expo-linking`, `expo-secure-store` for device capabilities.
  - `victory-native`, `react-native-gesture-handler`, `react-native-reanimated` for animated dashboards.

## 2. Supabase Data Flow & Real-Time Layer
- **Schema highlights:**
  - `profiles`: user metadata, Telegram chat IDs, XP totals.
  - `training_programs`, `training_blocks`, `training_sessions` for periodized plans.
  - `session_logs`: per-set records including RPE, streak flags.
  - `social_clubs`, `club_members`, `club_events`, `club_messages` to power social features.
- **Real-time strategy:**
  - Subscribe to `session_logs` and `profiles` channels with `supabase.channel('*')` to stream XP changes, streaks, leaderboards.
  - Use Row Level Security with policies to scope access to own data and shared clubs.
  - Implement optimistic UI updates using Zustand or Redux Toolkit Query cache, reconciling with real-time events.

## 3. Gamified Screen Implementations
1. **Progress Dashboards**
   - Daily/weekly XP chart, streak tracker, and achievements shelf fed from `session_logs` aggregates.
   - Animated radial progress for current level; color scales derived from theme tokens.
   - Badge progression timeline showing prerequisites and completion percent.
2. **Training Plans**
   - Periodized calendar view (Agenda + Workout card) generated from `training_sessions` with filters by focus area.
   - Session detail screen: exercise list, prescribed reps/sets, real-time compliance indicator (green when Supabase reports completion).
   - Plan personalization wizard using Supabase Edge Function to compute load progression.
3. **Social Features**
   - Club lobby with live leaderboard, chat stream via `club_messages` subscription, and collaborative challenges.
   - Duels mechanic: pair athletes, track best-of-3 challenges with push notifications for turns.
   - Support shareable highlights: export session summary to Telegram via Bot API.

## 4. Push Notifications & Telegram Deep Linking
- **Infrastructure:**
  - Use Expo push service: register device tokens, persist in `device_tokens` table keyed by user/installation.
  - Cloud Scheduler (Supabase Edge Function + Cron) triggers daily plan reminders, duel nudges, streak warnings.
- **Telegram integration:**
  - Create Telegram bot; store `telegram_chat_id` after user completes OAuth hand-off via deep link `tg://resolve?domain=<bot>&start=<token>`.
  - Deep links from Telegram messages map to Expo Router routes using `Linking.createURL('workout/[sessionId]')` pattern.
  - Inbound bot webhooks (hosted on Supabase Edge Functions) update Supabase tables, which push updates to the app via real-time.
- **In-app deep linking:**
  - Configure `app.json` with custom scheme `trainingapp://` and universal links for `https://app.training.fit/*`.
  - Use `expo-linking` to parse incoming URLs, route to dashboards, session detail, or social challenges.

## 5. Usability Testing & Analytics Rollout
- **Analytics stack:**
  - Expo + Segment (or PostHog) bridge for event tracking; Supabase Logflare for server-side tracing.
  - Define core events: `session_completed`, `plan_generated`, `duel_invite_sent`, `streak_broken`, `telegram_link_opened`.
  - Configure funnel dashboards (activation, retention cohorts) and screen heatmaps.
- **Usability testing plan:**
  1. Build clickable prototype in Figma reflecting key flows; run 5 moderated tests focusing on onboarding, completing a workout, joining a challenge.
  2. Integrate `expo-screen-capture` to record sessions (with consent) for remote testing builds.
  3. Deploy instrumented beta via Expo EAS; collect analytics in Segment/PostHog and qualitative feedback via in-app surveys (Typeform deep link).
  4. Run A/B experiments with Supabase feature flags toggling gamified elements (e.g., streak alerts) and analyze retention impacts.

## 6. Delivery Roadmap
| Sprint | Goals | Key Deliverables |
|--------|-------|------------------|
| 0 (Setup) | Project bootstrap, Supabase schema, auth flows | Expo app scaffold, Supabase migrations, CI/CD via EAS | 
| 1 | Core training plans + real-time logging | Plan calendar, session log capture, Supabase subscriptions |
| 2 | Gamification layer | Progress dashboards, XP/streak engine, achievements |
| 3 | Social & Telegram integration | Club chats, duels, Telegram deep links, push notifications |
| 4 | Usability & analytics | Instrumentation, beta tests, iteration backlog |

## 7. Risks & Mitigations
- **Real-time load spikes:** use broadcast channels + debounce client updates; archive old `session_logs` to cold storage.
- **Push notification deliverability:** fallback SMS/email for high-priority reminders; monitor Expo push receipts.
- **Telegram policies:** ensure compliance with bot rate limits, implement exponential backoff.
- **UX complexity:** maintain design system tokens, leverage design reviews each sprint, schedule recurring usability tests.

## 8. Next Steps
1. Finalize Supabase schema migrations and enable RLS policies.
2. Stand up Expo project with environment configuration via `app.config.js` referencing Supabase keys.
3. Implement MVP flows (auth, plan view, session logging) before layering gamification.
4. Begin recruitment for usability testing cohort concurrent with Sprint 2 build.

