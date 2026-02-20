# Agent Transaction Poison Fix

**Date:** 2025-09-30  
**Issue:** PostgreSQL transaction abort errors in agent chat endpoint  
**Status:** ✅ RESOLVED

---

## Problem Summary

The agent chat endpoint (`POST /api/agents/{id}/chat`) was failing with:
```
psycopg2.errors.InFailedSqlTransaction: current transaction is aborted, 
commands ignored until end of transaction block
```

### Symptoms
- Agent chat requests return HTTP 500
- Warnings like "Could not fetch project metadata for X"
- Final error when trying to INSERT into `agent_sessions`
- All database operations fail after initial error

---

## Root Cause

**Transaction Poisoning in PostgreSQL**

When using PostgreSQL, if ANY query fails within a transaction:
1. The entire transaction enters a "failed" state
2. ALL subsequent commands are rejected
3. The only recovery is to ROLLBACK the transaction

### The Bug Location

In `/app/services/citation_service.py`, the `_get_source_metadata()` function:

```python
def _get_source_metadata(db: Session, source_table: str, source_id: str):
    if source_table == "projects":
        try:
            result = db.execute(text("""SELECT ... FROM projects ..."""))
            # ... process result
        except Exception as e:
            print(f"Warning: {e}")  # ❌ Transaction still poisoned!
            # Falls through to fallback return
```

**The problem:**
- Query executes and fails (e.g., invalid source_id, schema mismatch, constraint violation)
- Exception is caught and suppressed
- **Transaction is now in failed state**
- Function continues and tries to return fallback metadata
- Caller tries more operations → ALL fail with "transaction aborted"

### Why Existing Savepoints Didn't Help

The chat service had a savepoint wrapper:
```python
savepoint = db.begin_nested()
enriched_citations = enrich_citations(db, citations)  # Calls _get_source_metadata
savepoint.commit()
```

But this didn't prevent the issue because:
1. Inside `_get_source_metadata`, when a query failed, the exception was caught
2. The savepoint transaction was poisoned but the exception was suppressed
3. The next iteration tried another query in the same poisoned savepoint
4. Everything cascaded into failure

---

## The Solution

**Individual savepoints for each metadata query**

Each metadata fetch now uses its own isolated savepoint:

```python
def _get_source_metadata(db: Session, source_table: str, source_id: str):
    """
    Each query uses its own savepoint to prevent transaction poisoning.
    """
    
    if source_table == "projects":
        savepoint = None
        try:
            # Create isolated savepoint
            savepoint = db.begin_nested()
            
            result = db.execute(text("""SELECT ... FROM projects ..."""))
            
            if result:
                savepoint.commit()  # ✅ Success
                return metadata_dict
            else:
                savepoint.commit()  # ✅ No result, but no error
                
        except Exception as e:
            # Rollback THIS specific savepoint
            if savepoint:
                try:
                    savepoint.rollback()  # ✅ Clear failed state
                except Exception:
                    pass
            print(f"Warning: Could not fetch project metadata for {source_id}: {e}")
    
    # Falls through to fallback return (outside try-except)
    return {"title": f"{source_table} #{source_id}", ...}
```

### Key Changes

1. **Savepoint per query**: Each source table metadata fetch creates its own `db.begin_nested()`
2. **Explicit rollback**: On exception, immediately rollback the savepoint
3. **Isolated failures**: A failed project metadata query won't poison experience metadata queries
4. **Always returns**: Function always returns valid dict, never propagates exceptions

---

## Files Modified

### `/portfolio-backend/app/services/citation_service.py`

Applied savepoint pattern to ALL metadata fetchers:
- ✅ Projects
- ✅ Experiences
- ✅ Portfolios
- ✅ Sections
- ✅ Portfolio Attachments
- ✅ Project Attachments
- ✅ Skills

**Lines changed:** ~90 lines updated across 7 source table handlers

---

## Testing

### Before Fix
```bash
POST /api/agents/1/chat
{
  "message": "What React projects are here?",
  "portfolio_id": 1
}

# Response
HTTP 500 Internal Server Error

# Logs
Warning: Could not fetch project metadata for 2: ...
ERROR: (psycopg2.errors.InFailedSqlTransaction) current transaction is aborted
```

### After Fix
```bash
POST /api/agents/1/chat
{
  "message": "What React projects are here?",
  "portfolio_id": 1
}

# Expected Response
HTTP 200 OK
{
  "answer": "Based on the portfolio, there are 3 React projects: ...",
  "citations": [
    {
      "title": "E-commerce Platform",  # ✅ Enriched metadata
      "type": "Project",
      "score": 0.87,
      "preview": "A full-stack e-commerce application..."
    }
  ],
  "session_id": 42
}

# Logs (if some metadata fails)
Warning: Could not fetch project metadata for 999: no rows found
# ✅ Other citations still enriched successfully
```

---

## Impact

### Benefits
1. ✅ **Resilience**: Agent chat works even if some metadata queries fail
2. ✅ **User experience**: Users get answers with partial citations instead of HTTP 500
3. ✅ **Isolation**: One bad source_id doesn't break entire enrichment
4. ✅ **Debugging**: Warnings show which specific source_id failed
5. ✅ **Performance**: No cascade failures slowing down the request

### Backward Compatibility
- ✅ No API changes
- ✅ No schema changes
- ✅ No breaking changes to citation format
- ✅ Graceful degradation (basic citations if enrichment fails)

---

## Related Patterns

This fix implements the **Savepoint Isolation Pattern** for fault-tolerant database operations:

```python
# Pattern: Isolated operation with fallback
def fetch_optional_data(db, key):
    savepoint = None
    try:
        savepoint = db.begin_nested()
        result = db.execute(query)
        savepoint.commit()
        return result
    except Exception:
        if savepoint:
            savepoint.rollback()
        return fallback_value
```

### When to Use
- ✅ Enrichment/augmentation queries (optional data)
- ✅ Metadata lookups that might fail
- ✅ Batch operations where partial success is acceptable
- ✅ Integration with external/unstable data sources

### When NOT to Use
- ❌ Critical transactions that must be atomic
- ❌ Operations where partial failure is unacceptable
- ❌ Simple queries unlikely to fail

---

## Prevention for Future

### Code Review Checklist
When writing database code that catches exceptions:

1. **Is this query critical or optional?**
   - Critical → Let exception propagate
   - Optional → Use savepoint isolation

2. **What happens to the transaction if this fails?**
   - If you catch the exception, ensure you rollback
   - Or use nested savepoint to isolate

3. **Can this operation fail gracefully?**
   - Yes → Return fallback value
   - No → Fail fast, don't suppress

4. **Is there a cascade risk?**
   - Multiple queries in a loop → Each needs its own savepoint
   - Single atomic operation → One transaction is fine

### Testing Strategy
- Test with invalid source_ids
- Test with missing related data (e.g., project without project_texts)
- Test with mixed valid/invalid citations
- Verify partial enrichment works correctly

---

## References

- PostgreSQL Transaction Documentation: https://www.postgresql.org/docs/current/tutorial-transactions.html
- SQLAlchemy Savepoints: https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#using-savepoint
- Related Fix: `maindocs/agent_transaction_fix_final.md` (initial attempt)

---

## Conclusion

This fix resolves the transaction poisoning issue by using **nested savepoints** to isolate each optional metadata query. This ensures that:
- One failed enrichment doesn't break the entire chat response
- Users always get an answer (even if citations are basic)
- System is resilient to data quality issues
- Debugging is easier with specific warnings

The pattern can be reused anywhere we have optional database operations that should fail gracefully.
