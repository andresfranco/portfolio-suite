from __future__ import annotations
from dataclasses import dataclass
from typing import Protocol, Dict, Any, List, Optional
import time


class ChatProvider(Protocol):
    def chat(self, *, model: str, system_prompt: str, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        ...

    def embed(self, *, model: str, texts: List[str]) -> List[List[float]]:
        ...


@dataclass
class ProviderConfig:
    name: str
    api_key: str
    base_url: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class OpenAIProvider:
    def __init__(self, cfg: ProviderConfig):
        from openai import OpenAI  # type: ignore
        import httpx  # type: ignore
        # Apply a reasonable default timeout for GPT-5-mini and other models
        # GPT-5-mini can take 7-15s for complex queries, so allow more time
        default_timeout = 45.0
        try:
            timeout_cfg = float((cfg.extra or {}).get("timeout_seconds", default_timeout))
        except Exception:
            timeout_cfg = default_timeout
        self._timeout_seconds = timeout_cfg
        # Enforce timeouts via a dedicated httpx client
        # Set connect/read/write timeouts explicitly; total ~ provider default
        http_timeout = httpx.Timeout(self._timeout_seconds, connect=self._timeout_seconds, read=self._timeout_seconds, write=self._timeout_seconds)
        http_client = httpx.Client(timeout=http_timeout)
        self.client = OpenAI(api_key=cfg.api_key, base_url=cfg.base_url, http_client=http_client)

    def chat(self, *, model: str, system_prompt: str, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        started = time.time()
        # System prompt as first message
        final_messages = [{"role": "system", "content": system_prompt}] + messages
        try:
            # Call OpenAI chat completions. Avoid passing max_tokens to support newer models that require
            # different parameter names (e.g., max_completion_tokens). Keep defaults conservative server-side.
            resp = self.client.chat.completions.create(model=model, messages=final_messages)
            content = resp.choices[0].message.content or ""
            usage = getattr(resp, "usage", None)
            latency_ms = int((time.time() - started) * 1000)
            return {
                "text": content,
                "usage": usage.model_dump() if hasattr(usage, "model_dump") else {},
                "latency_ms": latency_ms,
            }
        except Exception as e:
            latency_ms = int((time.time() - started) * 1000)
            # Surface as a simple structured error to the caller
            raise RuntimeError(f"LLM chat request failed after {latency_ms}ms: {e}")

    def embed(self, *, model: str, texts: List[str]) -> List[List[float]]:
        try:
            resp = self.client.embeddings.create(model=model, input=texts)
            return [d.embedding for d in resp.data]
        except Exception as e:
            raise RuntimeError(f"Embedding request failed: {e}")


class AnthropicProvider:
    def __init__(self, cfg: ProviderConfig):
        import anthropic  # type: ignore
        self.client = anthropic.Anthropic(api_key=cfg.api_key)

    def chat(self, *, model: str, system_prompt: str, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        started = time.time()
        # Flatten messages to a single prompt; simple non-streaming Claude Messages API
        text_parts: List[Dict[str, str]] = []
        if system_prompt:
            text_parts.append({"role": "system", "content": system_prompt})
        text_parts.extend(messages)
        resp = self.client.messages.create(model=model, max_tokens=1024, messages=text_parts)
        content = "".join([b.text for b in resp.content if getattr(b, "type", "") == "text"])  # type: ignore
        latency_ms = int((time.time() - started) * 1000)
        return {"text": content, "usage": {}, "latency_ms": latency_ms}

    def embed(self, *, model: str, texts: List[str]) -> List[List[float]]:
        # Anthropic does not provide embeddings currently; leave unimplemented
        raise NotImplementedError("Anthropic embeddings not supported.")


class GoogleProvider:
    def __init__(self, cfg: ProviderConfig):
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=cfg.api_key)
        self.genai = genai

    def chat(self, *, model: str, system_prompt: str, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        started = time.time()
        content = "\n".join([m.get("content", "") for m in messages])
        model_ref = self.genai.GenerativeModel(model)
        resp = model_ref.generate_content([system_prompt, content])
        text = getattr(resp, "text", "")
        latency_ms = int((time.time() - started) * 1000)
        return {"text": text, "usage": {}, "latency_ms": latency_ms}

    def embed(self, *, model: str, texts: List[str]) -> List[List[float]]:
        # Use embeddings if available; else fallback not implemented
        raise NotImplementedError("Google embeddings not wired; use OpenAI for embeddings.")


class MistralProvider:
    def __init__(self, cfg: ProviderConfig):
        from mistralai import Mistral  # type: ignore
        self.client = Mistral(api_key=cfg.api_key)

    def chat(self, *, model: str, system_prompt: str, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        started = time.time()
        # Simple non-streaming chat
        final_messages = [{"role": "system", "content": system_prompt}] + messages
        resp = self.client.chat.complete(model=model, messages=final_messages)
        text = resp.choices[0].message.content
        latency_ms = int((time.time() - started) * 1000)
        return {"text": text, "usage": {}, "latency_ms": latency_ms}

    def embed(self, *, model: str, texts: List[str]) -> List[List[float]]:
        raise NotImplementedError("Mistral embeddings not wired; use OpenAI for embeddings.")


def build_provider(provider: str, *, api_key: str, base_url: Optional[str] = None, extra: Optional[Dict[str, Any]] = None) -> ChatProvider:
    cfg = ProviderConfig(name=provider, api_key=api_key, base_url=base_url, extra=extra)
    p = provider.lower()
    if p == "openai":
        return OpenAIProvider(cfg)
    if p == "anthropic":
        return AnthropicProvider(cfg)
    if p == "google":
        return GoogleProvider(cfg)
    if p == "mistral":
        return MistralProvider(cfg)
    # custom provider placeholder: expects base_url and OpenAI-compatible API
    if p == "custom":
        return OpenAIProvider(cfg)
    raise ValueError(f"Unsupported provider: {provider}")


