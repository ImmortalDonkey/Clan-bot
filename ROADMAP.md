# Clan Bot — Roadmap

## Phase 1 — Foundation (DONE)
- Reset database to event model
- `/eventcreate`
- `/eventleaderboard`
- Reward config system
- Dynamic command loader

---

## Phase 2 — Submissions System
- `/submit` command (modal)
- Pokémon validation (ID format + duplicate check)
- Verification channel posts
- Buttons:
  - Verify
  - Reject
- Public log messages
- DM on rejection

---

## Phase 3 — Points Engine
- Rarity parsing (type detection)
- Point assignment
- Event user creation/upsert
- Leaderboard updates

---

## Phase 4 — Set Bonus System
- Track per-species types
- Detect full set completion
- Award +20 points
- Prevent duplicate bonus
- Public announcement on completion

---

## Phase 5 — EXP System
- `/eventexp import_start`
- `/eventexp import_end`
- Snapshot storage
- EXP gain calculation
- Point conversion (200k rule + 5m bonus)
- Review/confirm flow

---

## Phase 6 — Event Finalisation
- Lock submissions
- Apply EXP points
- `/eventfinalise`
- Final leaderboard post (top 35)

---

## Phase 7 — Scheduler
- Auto start events
- Auto end events
- Move to PENDING_EXP
- Auto archive after 7 days

---

## Phase 8 — Rewards UX
- Display milestone unlocks
- Show rewards in announcements
- Final reward summary output

---

## Phase 9 — QoL Improvements
- Edit EXP rows before confirm
- Add rejection reasons
- Manual point adjustments (admin)
- `/eventstatus`

---

## Phase 10 — Advanced Automation
- Vortex API integration (auto Pokémon validation)
- OCR EXP parsing
- Image/card rendering for submissions

---

## Future Ideas
- Multi-event presets
- Cross-guild support
- Web dashboard

---

## Development Strategy
- Build in isolated phases
- No breaking changes mid-phase
- Always verify via Discord before proceeding
- Keep DB as single source of truth
