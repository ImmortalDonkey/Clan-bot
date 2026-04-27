# Clan Bot — Architecture

## Overview
Event-driven Discord bot for clan competitions.

### Implemented Systems
- Event lifecycle automation (scheduler)
- Pokémon submission + verification
- Points engine (rarity + duplicates)
- Full set bonus system
- Leaderboard with correct event selection
- Human-readable time parsing

Built with:
- Node.js (CommonJS)
- discord.js v14
- SQLite

---

## Event Lifecycle
States:
- SCHEDULED
- ACTIVE
- PENDING_EXP
- FINALISED
- ARCHIVED

Scheduler (LIVE):
- Runs every 30s
- Transitions:
  - SCHEDULED → ACTIVE
  - ACTIVE → PENDING_EXP

---

## Data Model

### events
- lifecycle state
- channels
- timing
- reward config snapshot

### event_users
- one row per user per event
- IGN + points

### submissions
- unique pokemon_id per event
- status: PENDING / VERIFIED / REJECTED

### set_bonuses
- prevents duplicate bonuses
- UNIQUE(event_id, discord_id, species)

### exp_snapshots / exp_results
- reserved for EXP system

---

## Submission Flow

1. User runs `/submit`
2. Modal captures IGN, name, ID
3. Stored as PENDING
4. Sent to verification channel

On verify:
- status → VERIFIED
- base points applied
- set bonus check executed

---

## Points System

### Pokémon
- Normal: 1
- Dark/Mystic/Metallic: 5
- Shiny/Shadow: 10

Duplicates allowed (ID-based uniqueness)

---

### Set Bonus
Trigger:
- user owns all 6 types for a species

Types:
- normal
- metallic
- mystic
- dark
- shadow
- shiny

Reward:
- +20 points
- once per species per event

---

## Leaderboard Logic

Event priority:
1. ACTIVE
2. SCHEDULED
3. latest PENDING_EXP

Ensures correct event is always displayed.

---

## Event Creation

Supports:
- ISO format
- timestamps
- natural input:
  - now+5m
  - now+1h
  - today 20:00
  - tomorrow 18:30
  - 27/04/2026 20:00

---

## Logging

Console:
- scheduler actions
- set bonus triggers

Discord:
- submission logs
- set bonus announcements

---

## Current Gaps

- EXP system
- event finalisation
- reward output

---

## Design Principles

- event-scoped data only
- deterministic scoring
- idempotent operations
- explicit flows over hidden logic
