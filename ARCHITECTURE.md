# Clan Bot — Architecture

## Overview
Event-driven Discord bot for clan competitions. Core capabilities:
- Event lifecycle (create → start → active → pending EXP → finalised → archive)
- Pokémon submissions with staff verification
- Points engine (rarity, duplicates, set bonus)
- EXP snapshot + calculation system
- Leaderboards and logs

Built with:
- Node.js (CommonJS)
- discord.js v14
- SQLite (sqlite3)

---

## Runtime Flow
1. `index.cjs` boots client, initialises DB, loads handlers
2. Handlers route interactions:
   - commands → `interactions/commands`
   - buttons → `interactions/buttons`
   - modals → `interactions/modals`
3. Services (future) encapsulate business logic
4. DB is single source of truth

---

## Event Lifecycle
States:
- SCHEDULED
- ACTIVE
- PENDING_EXP
- FINALISED
- ARCHIVED

Transitions:
- SCHEDULED → ACTIVE (time reached)
- ACTIVE → PENDING_EXP (end time reached)
- PENDING_EXP → FINALISED (after EXP import + confirm)
- FINALISED → ARCHIVED (after 7 days)

---

## Data Model
### events
Core event configuration + channels + reward snapshot

### event_users
Per-event user record (IGN + points)

### submissions
Pokémon submissions
- unique `pokemon_id` per event
- status: PENDING / VERIFIED / REJECTED

### set_bonuses
Tracks awarded set bonuses (once per species)

### exp_snapshots
START / END EXP per IGN

### exp_results
Computed EXP gains + points

### point_logs
Audit trail of all point changes

---

## Points Engine
### Pokémon
- Normal: 1
- Dark/Mystic/Metallic: 5
- Shiny/Shadow: 10

Duplicates allowed (unique ID enforced)

### Set Bonus
- 6 variants of same species
- +20 points
- once per species per user per event

### EXP
- 200,000 EXP = 1 point
- +10 bonus per 5,000,000 EXP

---

## Rewards
Stored as JSON snapshot on event creation:
- placementRewards
- milestoneRewards (50 → 300)

Config source: `config/eventRewards.json`

---

## Command Layer
- `/eventcreate`
- `/eventleaderboard`
- (planned) `/submit`, `/eventexp`, `/eventfinalise`

Deploy script auto-loads all commands from folder

---

## Verification Flow
1. User submits
2. Bot posts to verification channel
3. Staff clicks:
   - ✅ Verify → award points
   - ❌ Reject → DM user

---

## Scheduler (planned)
- Tick loop checks:
  - events to start
  - events to end
  - events to archive

---

## Extensibility
- Vortex API integration (auto verify Pokémon)
- OCR import for EXP screenshots
- Rich render cards

---

## Design Principles
- Event-scoped data (no lifetime points)
- Deterministic scoring
- No silent automation without confirmation
- Minimal assumptions, explicit flows
