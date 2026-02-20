#!/usr/bin/env python
"""
Performance profiling script for GPT Mini vs Mistral agents.
Measures each step of the RAG pipeline to identify bottlenecks.
"""
import sys
import os
import time
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import get_db
from app.services.chat_service import _get_agent_bundle, embed_query, vector_search, assemble_context
from app.services.llm.providers import build_provider
from app.services.prompt_builder import build_rag_prompt
from app.models.agent import Agent


def profile_agent(agent_id: int, query: str, portfolio_id: int = 1, language_id: int = 1):
    """Profile an agent's performance step by step."""
    db = next(get_db())
    
    try:
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        print(f"\n{'='*80}")
        print(f"PROFILING: {agent.name} (ID {agent_id})")
        print(f"Query: '{query}'")
        print(f"Portfolio: {portfolio_id}, Language: {language_id}")
        print("="*80)
        
        total_start = time.time()
        
        # Step 1: Get agent configuration
        step_start = time.time()
        agent, cred, tpl = _get_agent_bundle(db, agent_id, None)
        config_time = (time.time() - step_start) * 1000
        print(f"\n1. Agent Configuration: {config_time:.2f}ms")
        print(f"   - Provider: {cred.provider}")
        print(f"   - Chat Model: {agent.chat_model}")
        print(f"   - Embedding Model: {agent.embedding_model}")
        print(f"   - Top K: {agent.top_k}")
        print(f"   - Max Context Tokens: {agent.max_context_tokens}")
        
        # Decrypt API key from database
        api_key = ""
        from sqlalchemy import text
        try:
            kms_key = os.getenv("AGENT_KMS_KEY")
            if kms_key and cred.api_key_encrypted:
                row = db.execute(text("SELECT pgp_sym_decrypt(decode(:b64, 'base64'), :k) AS api_key"), {
                    "b64": cred.api_key_encrypted,
                    "k": kms_key,
                }).first()
                if row and row[0]:
                    api_key = row[0]
                    print(f"   - ✓ API key decrypted from database")
        except Exception as e:
            print(f"   - ⚠️  Failed to decrypt API key: {str(e)[:100]}")
        
        if not api_key:
            print(f"   - ⚠️  No API key available, skipping this agent")
            return
        
        provider = build_provider(cred.provider, api_key=api_key, extra=cred.extra or {})
        
        # Step 2: Embedding
        step_start = time.time()
        qvec = embed_query(db, provider=provider, embedding_model=agent.embedding_model, query=query)
        embedding_time = (time.time() - step_start) * 1000
        print(f"\n2. Query Embedding: {embedding_time:.2f}ms")
        print(f"   - Vector dimension: {len(qvec)}")
        
        # Step 3: Vector Search
        step_start = time.time()
        chunks = vector_search(
            db, 
            qvec=qvec, 
            model=agent.embedding_model,
            k=agent.top_k, 
            score_threshold=agent.score_threshold,
            portfolio_id=portfolio_id,
            tables_filter=None,
            language_code=None
        )
        search_time = (time.time() - step_start) * 1000
        print(f"\n3. Vector Search: {search_time:.2f}ms")
        print(f"   - Chunks retrieved: {len(chunks)}")
        if chunks:
            print(f"   - Top score: {chunks[0]['score']:.4f}")
            print(f"   - Lowest score: {chunks[-1]['score']:.4f}")
        
        # Step 4: Context Assembly
        step_start = time.time()
        context, citations = assemble_context(chunks, max_tokens=agent.max_context_tokens)
        assembly_time = (time.time() - step_start) * 1000
        print(f"\n4. Context Assembly: {assembly_time:.2f}ms")
        print(f"   - Context length: {len(context)} chars")
        print(f"   - Citations: {len(citations)}")
        
        # Step 5: Prompt Building
        step_start = time.time()
        messages = build_rag_prompt(
            user_message=query,
            context=context,
            citations=citations,
            template_style='conversational',
            conversation_history=[],
            language_name="English",
            custom_system_prompt=tpl.system_prompt if hasattr(tpl, 'system_prompt') else None
        )
        prompt_time = (time.time() - step_start) * 1000
        print(f"\n5. Prompt Building: {prompt_time:.2f}ms")
        print(f"   - Messages: {len(messages)}")
        if messages:
            total_prompt_chars = sum(len(m['content']) for m in messages)
            print(f"   - Total prompt length: {total_prompt_chars} chars")
        
        # Step 6: LLM Call
        step_start = time.time()
        system_prompt = messages[0]['content'] if messages else ""
        chat_messages = messages[1:] if len(messages) > 1 else []
        
        try:
            result = provider.chat(
                model=agent.chat_model,
                system_prompt=system_prompt,
                messages=chat_messages
            )
            llm_time = (time.time() - step_start) * 1000
            print(f"\n6. LLM Call ({agent.chat_model}): {llm_time:.2f}ms")
            print(f"   - Response length: {len(result.get('text', ''))} chars")
            usage = result.get('usage', {})
            if usage:
                print(f"   - Prompt tokens: {usage.get('prompt_tokens', 0)}")
                print(f"   - Completion tokens: {usage.get('completion_tokens', 0)}")
                print(f"   - Total tokens: {usage.get('total_tokens', 0)}")
        except Exception as e:
            llm_time = (time.time() - step_start) * 1000
            print(f"\n6. LLM Call FAILED: {llm_time:.2f}ms")
            print(f"   - Error: {str(e)[:200]}")
        
        # Total time
        total_time = (time.time() - total_start) * 1000
        print(f"\n{'='*80}")
        print(f"TOTAL TIME: {total_time:.2f}ms")
        print(f"\nBreakdown:")
        print(f"  Config:     {config_time:8.2f}ms ({config_time/total_time*100:5.1f}%)")
        print(f"  Embedding:  {embedding_time:8.2f}ms ({embedding_time/total_time*100:5.1f}%)")
        print(f"  Search:     {search_time:8.2f}ms ({search_time/total_time*100:5.1f}%)")
        print(f"  Assembly:   {assembly_time:8.2f}ms ({assembly_time/total_time*100:5.1f}%)")
        print(f"  Prompt:     {prompt_time:8.2f}ms ({prompt_time/total_time*100:5.1f}%)")
        print(f"  LLM:        {llm_time:8.2f}ms ({llm_time/total_time*100:5.1f}%)")
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def main():
    """Profile both agents with the same query."""
    test_queries = [
        "Hello",
        "What React projects are in the portfolio?",
    ]
    
    for query in test_queries:
        print(f"\n\n{'#'*80}")
        print(f"# TEST QUERY: {query}")
        print(f"{'#'*80}")
        
        # Profile GPT Mini
        profile_agent(1, query)
        
        # Profile Mistral
        profile_agent(2, query)
        
        print("\n" + "="*80)
        print("Waiting 2 seconds before next test...")
        print("="*80)
        time.sleep(2)


if __name__ == "__main__":
    main()
