# Performance Documentation

Documentation for performance optimization, profiling, and testing.

## 📄 Files in This Directory

Performance optimization guides and reports will be stored here. This directory is reserved for:

- Performance optimization strategies
- Profiling results and analysis
- Cache implementation reports
- Query optimization documentation
- Agent performance improvements

## 🔗 Related Resources

### Test Scripts
Located in `/tests/`:
- `test_hello_performance.py` - Basic greeting performance test
- `test_phase_2_5_performance.py` - Phase 2.5 performance validation
- `test_gpt_mini_debug.py` - GPT Mini agent performance debugging

### Utility Scripts
Located in `/scripts/`:
- `profile_agent_performance.py` - Agent performance profiling tool

### Database Scripts
Located in `/scripts/database/`:
- `fix_corrupted_excel_chunks.sql` - Fix corrupted Excel file chunks

### Shell Scripts
Located in `/scripts/`:
- `fix_agent_chat.sh` - Agent chat repair script

## 🎯 Quick Start

### Running Performance Tests

```bash
# Phase 2.5 performance validation (comprehensive)
cd /path/to/portfolio-backend
source venv/bin/activate
python tests/test_phase_2_5_performance.py
```

### Profiling Agent Performance

```bash
# Profile specific agent interactions
python scripts/profile_agent_performance.py
```

### Performance Testing Best Practices

1. **Baseline Testing**: Always establish baseline metrics before optimization
2. **Cache Testing**: Test both cold (uncached) and warm (cached) scenarios
3. **Realistic Queries**: Use production-like queries for accurate results
4. **Multiple Iterations**: Run tests multiple times to account for variance

## 📊 Performance Metrics

Key performance indicators to track:

### Response Times
- **Greeting Queries** (TRIVIAL): Target <500ms (first), <50ms (cached)
- **Simple Queries**: Target <2s (first), <50ms (cached)
- **Medium Queries**: Target 2-5s (first), <50ms (cached)
- **Complex Queries**: Target 5-8s (first), <50ms (cached)
- **Comprehensive Queries**: Target 8-12s (first), <50ms (cached)

### Cache Performance
- **Cache Hit Rate**: Target >80% for repeated queries
- **Cache Retrieval**: Target <50ms
- **Redis Connection**: Monitor connection pool usage

### Agent-Specific Metrics
- **GPT-4o-mini**: Optimized for RAG, 3-5x faster than GPT-5-mini
- **Mistral-small**: Fast baseline, consistent 2-3s for complex queries
- **Token Usage**: Monitor to control API costs

## 🔍 Performance Optimization History

### Phase 2 & 3 (Completed)
- Redis caching implementation (99%+ improvement on cache hits)
- Query complexity analyzer (5 levels: TRIVIAL, SIMPLE, MEDIUM, COMPLEX, COMPREHENSIVE)
- Streaming support (SSE endpoint for progressive responses)
- Async architecture foundation

### Phase 2.5 (Completed)
- Model optimization: GPT-5-mini → GPT-4o-mini (3-5x faster)
- Context reduction: 37-53% fewer chunks
  - MEDIUM: 8→5 chunks
  - COMPLEX: 10→6 chunks
  - COMPREHENSIVE: 15→7 chunks
- Agent configuration updates (top_k reduced from 8 to 5)
- **Result**: 98.6% improvement (17.9s → 0.2s with cache)

## 🚀 Future Optimizations

Potential areas for improvement:

1. **Frontend Streaming Integration**: Use SSE endpoint for <1s time-to-first-token
2. **Query Complexity Tuning**: Data-driven adjustment based on quality metrics
3. **Embedding Cache**: Cache common query embeddings
4. **Connection Pooling**: Optimize Redis and PostgreSQL connection pools
5. **Chunk Pre-warming**: Pre-load frequently accessed chunks

## 📚 Documentation Standards

When adding performance documentation:

1. **Baseline Metrics**: Always include before/after measurements
2. **Test Environment**: Document hardware, network, and configuration
3. **Reproducibility**: Provide commands to reproduce results
4. **Impact Analysis**: Document performance vs quality trade-offs
5. **Rollback Plan**: Include instructions to revert optimizations

## 🤝 Contributing

When implementing performance optimizations:

1. Establish baseline metrics with existing tests
2. Implement changes incrementally
3. Validate with performance test suite
4. Document results and trade-offs
5. Update this README with optimization details

---

**Last Updated**: October 2025
