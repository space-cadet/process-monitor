# DB Cleanup Implementation

## Overview

The `TimeSeriesDB.cleanupOldSamples()` method handles both time-based and size-based cleanup of the SQLite database. This prevents unbounded DB growth while preserving recent data.

## Algorithm

### Time-Based Cleanup (always runs)
1. Calculate cutoff timestamp: `Date.now() - retentionDays * 86400000`
2. Delete child rows in FK order:
   ```sql
   DELETE FROM process_samples WHERE snapshot_id IN (
     SELECT id FROM snapshots WHERE timestamp < ?
   )
   ```
   ```sql
   DELETE FROM process_spikes WHERE snapshot_id IN (
     SELECT id FROM snapshots WHERE timestamp < ?
   )
   ```
3. Delete old snapshots:
   ```sql
   DELETE FROM snapshots WHERE timestamp < ?
   ```

### Size-Based Cleanup (runs if `maxSizeMB` provided and DB > limit)
1. Calculate target bytes: `maxSizeMB * 1024 * 1024`
2. While `dbSizeBytes > targetBytes` and `iterations < 100`:
   3. Select oldest 500 snapshots:
      ```sql
      SELECT id FROM snapshots ORDER BY timestamp ASC LIMIT 500
      ```
   4. If no rows found, break
   5. Build parameterized DELETEs with `IN (...)` clause
   6. Delete in FK order: `process_samples` → `process_spikes` → `snapshots`
   7. Increment iteration counter
8. Run `VACUUM` to reclaim freed pages

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Batch size 500 | Avoids long-running transactions; still makes fast progress |
| Max 100 iterations | Safety limit — prevents infinite loops |
| Delete child tables first | SQLite FK constraint enforcement (`ON DELETE CASCADE` not used) |
| `VACUUM` after size cleanup | Reclaims disk space; not needed after time-only cleanup |
| Optional `maxSizeMB` | Backward compatible — existing callers without size param still work |

## Foreign Key Constraints

The `process_spikes` table was added after the original cleanup implementation. The initial cleanup only deleted from `process_samples` before `snapshots`, missing `process_spikes`. This caused:

```
SQLITE_CONSTRAINT_FOREIGNKEY: FOREIGN KEY constraint failed
```

**Fix**: Both time-based and size-based paths now delete from `process_spikes` before `snapshots`.

## API Integration

### Monitor (auto-cleanup)
```typescript
// Monitor.ts — every 100 ticks (~50 min)
if (this.ticks % this.config.cleanupIntervalTicks === 0) {
  this.db.cleanupOldSamples(
    this.config.retentionDays,
    this.config.retentionSizeMB  // now passed!
  );
}
```

### Dashboard (manual cleanup)
```typescript
// POST /api/cleanup
const { retentionDays = 30, maxSizeMB = 400 } = JSON.parse(body);
db.cleanupOldSamples(retentionDays, maxSizeMB);
```

## Related
- Task: [T21: DB Size-Based Cleanup Fix](../tasks/T21.md)
- File: `src/storage/TimeSeriesDB.ts`
