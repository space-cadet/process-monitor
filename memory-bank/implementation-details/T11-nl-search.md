# T11: Natural Language Search — Implementation Notes

*Status*: Decomposed into 4 beads subtasks (T11a-d)  
*Last Updated*: 2026-06-24

## Overview

A search box in the dashboard that accepts natural language queries and translates them to SQL against the existing SQLite database.

## Decomposition

| Subtask | Beads ID | Description | Dependencies |
|---------|----------|-------------|--------------|
| T11a | `workspace-94r` | Time Expression Parser | None |
| T11b | `workspace-st0` | Query Tokenizer | None |
| T11c | `workspace-ev0` | SQL Generator | T11a, T11b |
| T11d | `workspace-um0` | Search API + Dashboard UI | T11c |

## Database Schema (Existing)

All queries run against the existing `TimeSeriesDB` tables:

| Table | Key Columns |
|-------|-------------|
| `process_samples` | `name`, `cpu_percent`, `rss_kb`, `timestamp`, `energy_mj` |
| `snapshots` | `battery_percent`, `timestamp`, `cpu_user`, `memory_used_mb`, ... |
| `drain_events` | `drop_percent`, `duration_min`, `timestamp` |
| `process_spikes` | `name`, `cpu_percent`, `timestamp` |

## Query Examples

| User Input | SQL Equivalent |
|-----------|----------------|
| "Chrome CPU > 30% yesterday" | `SELECT * FROM process_samples WHERE name LIKE '%Chrome%' AND cpu_percent > 30 AND timestamp > now - 86400000` |
| "battery dropped 10% in 30 min" | Drain events with drop >= 10 and duration <= 30 |
| "top 5 memory hogs this week" | Aggregate RSS by process over 7 days |
| "when did Docker spike" | `SELECT * FROM process_spikes WHERE name LIKE '%Docker%'` |

## Architecture

```
User Input → Tokenizer (T11b) → Time Parser (T11a) → SQL Generator (T11c) → SQLite → Results
```

## Files

- `src/core/QueryParser.ts` — Main parser combining all sub-modules (T11c)
- `src/core/TimeParser.ts` — Time expression parsing (T11a)
- `src/core/QueryTokenizer.ts` — Tokenization (T11b)
- `src/web/server.ts` — `POST /api/query` endpoint (T11d)
- `web/public/index.html` — Search bar markup (T11d)
- `web/public/app.js` — Query input + result rendering (T11d)

## Future Enhancement

Replace rule-based parser with a small local LLM (e.g., Ollama) for more flexible natural language queries. Not required for initial implementation.
