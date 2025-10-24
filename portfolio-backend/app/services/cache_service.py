"""
Redis cache service for agent responses and RAG results.

Provides caching layer to reduce redundant LLM calls and improve response times.
"""
import hashlib
import json
import os
from typing import Optional, Dict, Any, List
from redis import Redis
from redis.connection import ConnectionPool
import logging

logger = logging.getLogger(__name__)


class CacheService:
    """Redis-based caching service with connection pooling."""
    
    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.pool = ConnectionPool.from_url(
            redis_url,
            max_connections=20,
            socket_connect_timeout=5,
            socket_timeout=5,
            decode_responses=True
        )
        self._enabled = os.getenv("CACHE_ENABLED", "true").lower() == "true"
        logger.info(f"Cache service initialized (enabled: {self._enabled})")
    
    def _get_client(self) -> Redis:
        """Get Redis client from pool."""
        return Redis(connection_pool=self.pool)
    
    def _generate_key(self, prefix: str, **kwargs) -> str:
        """Generate deterministic cache key from parameters."""
        # Sort kwargs for consistency
        sorted_items = sorted(kwargs.items())
        payload = f"{prefix}:" + ":".join(f"{k}={v}" for k, v in sorted_items)
        hash_digest = hashlib.sha256(payload.encode()).hexdigest()[:16]
        return f"{prefix}:{hash_digest}"
    
    def get_agent_response(
        self,
        agent_id: int,
        user_message: str,
        portfolio_id: Optional[int] = None,
        language_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """Get cached agent response."""
        if not self._enabled:
            return None
        
        try:
            key = self._generate_key(
                "agent_chat",
                agent_id=agent_id,
                message=user_message.lower().strip(),
                portfolio=portfolio_id or "",
                lang=language_id or ""
            )
            client = self._get_client()
            cached = client.get(key)
            
            if cached:
                logger.info(f"Cache HIT for agent {agent_id}")
                return json.loads(cached)
            
            logger.debug(f"Cache MISS for agent {agent_id}")
            return None
        except Exception as e:
            logger.warning(f"Cache get error: {e}")
            return None
    
    def set_agent_response(
        self,
        agent_id: int,
        user_message: str,
        response: Dict[str, Any],
        portfolio_id: Optional[int] = None,
        language_id: Optional[int] = None,
        ttl_seconds: int = 3600
    ) -> bool:
        """Cache agent response with TTL."""
        if not self._enabled:
            return False
        
        try:
            key = self._generate_key(
                "agent_chat",
                agent_id=agent_id,
                message=user_message.lower().strip(),
                portfolio=portfolio_id or "",
                lang=language_id or ""
            )
            client = self._get_client()
            client.setex(key, ttl_seconds, json.dumps(response))
            logger.debug(f"Cached response for agent {agent_id} (TTL: {ttl_seconds}s)")
            return True
        except Exception as e:
            logger.warning(f"Cache set error: {e}")
            return False
    
    def invalidate_portfolio(self, portfolio_id: int) -> int:
        """Invalidate all cached responses for a portfolio."""
        if not self._enabled:
            return 0
        
        try:
            client = self._get_client()
            pattern = f"agent_chat:*portfolio={portfolio_id}*"
            keys = client.keys(pattern)
            
            if keys:
                deleted = client.delete(*keys)
                logger.info(f"Invalidated {deleted} cached responses for portfolio {portfolio_id}")
                return deleted
            return 0
        except Exception as e:
            logger.warning(f"Cache invalidation error: {e}")
            return 0
    
    def invalidate_agent(self, agent_id: int) -> int:
        """Invalidate all cached responses for an agent."""
        if not self._enabled:
            return 0
        
        try:
            client = self._get_client()
            pattern = f"agent_chat:*agent_id={agent_id}*"
            keys = client.keys(pattern)
            
            if keys:
                deleted = client.delete(*keys)
                logger.info(f"Invalidated {deleted} cached responses for agent {agent_id}")
                return deleted
            return 0
        except Exception as e:
            logger.warning(f"Cache invalidation error: {e}")
            return 0
    
    def get_rag_chunks(
        self,
        query: str,
        portfolio_id: Optional[int] = None,
        top_k: int = 8
    ) -> Optional[List[Dict[str, Any]]]:
        """Get cached RAG chunk results."""
        if not self._enabled:
            return None
        
        try:
            key = self._generate_key(
                "rag_chunks",
                query=query.lower().strip(),
                portfolio=portfolio_id or "",
                k=top_k
            )
            client = self._get_client()
            cached = client.get(key)
            
            if cached:
                logger.debug(f"Cache HIT for RAG chunks")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.warning(f"RAG cache get error: {e}")
            return None
    
    def set_rag_chunks(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        portfolio_id: Optional[int] = None,
        top_k: int = 8,
        ttl_seconds: int = 7200
    ) -> bool:
        """Cache RAG chunk results with TTL (default 2 hours)."""
        if not self._enabled:
            return False
        
        try:
            key = self._generate_key(
                "rag_chunks",
                query=query.lower().strip(),
                portfolio=portfolio_id or "",
                k=top_k
            )
            client = self._get_client()
            client.setex(key, ttl_seconds, json.dumps(chunks))
            logger.debug(f"Cached RAG chunks (TTL: {ttl_seconds}s)")
            return True
        except Exception as e:
            logger.warning(f"RAG cache set error: {e}")
            return False
    
    def health_check(self) -> bool:
        """Check if Redis connection is healthy."""
        try:
            client = self._get_client()
            client.ping()
            return True
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return False


# Global cache instance
cache_service = CacheService()
