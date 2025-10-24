# AI Agent Documentation

Documentation for AI agent configuration, prompts, and implementation.

## 📄 Files in This Directory

### Agent Configuration & Prompts

- **OPTIMAL_AGENT_PROMPT.md**
  - Best practices for agent prompting
  - Prompt structure and guidelines
  - Examples and patterns
  - Audience: Developers, AI Engineers

- **OPTIMAL_AGENT_SYSTEM_PROMPT.txt**
  - System prompt template for agents
  - Core instructions and behavior
  - Base configuration
  - Audience: Developers

- **AGENT_CHAT_FIX_SUMMARY.md**
  - Agent chat functionality fixes
  - Bug fixes and improvements
  - Implementation details
  - Audience: Developers

## 🔗 Related Resources

### Test Scripts
Located in `/tests/`:
- `test_agents_conversational.py` - Agent conversation testing
- `test_gpt_mini_debug.py` - GPT Mini agent debugging
- `test_hello_performance.py` - Basic performance testing
- `test_phase_2_5_performance.py` - Phase 2.5 performance validation

### Utility Scripts
Located in `/scripts/`:
- `update_agent_prompts.py` - Update agent prompts in database
- `profile_agent_performance.py` - Profile agent performance

### Performance Documentation
See `/docs/performance/` for performance optimization guides and reports.

## 🎯 Quick Start

### Updating Agent Prompts

```bash
# Update agent prompts in database
cd /path/to/portfolio-backend
python scripts/update_agent_prompts.py
```

### Testing Agent Conversations

```bash
# Run agent conversation tests
pytest tests/test_agents_conversational.py -v
```

### Performance Testing

```bash
# Run performance validation
python tests/test_phase_2_5_performance.py
```

## 📚 Documentation Standards

When adding agent-related documentation:

1. **Prompt Documentation**: Include examples, use cases, and expected behavior
2. **Configuration**: Document all configurable parameters
3. **Testing**: Provide test cases and validation steps
4. **Performance**: Note performance implications and optimizations

## 🤝 Contributing

When modifying agent prompts or configuration:

1. Test changes with `test_agents_conversational.py`
2. Validate performance impact with performance tests
3. Update relevant documentation
4. Update prompt templates if structure changes

---

**Last Updated**: October 2025
