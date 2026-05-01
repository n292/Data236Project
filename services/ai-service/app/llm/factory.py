"""LLM provider factory.

Default provider: Google Gemini (via LangChain).
Swap by setting LLM_PROVIDER env var.
"""
from __future__ import annotations

import logging
import os
from typing import Any

log = logging.getLogger(__name__)


def get_llm(
    provider: str | None = None,
    model_name: str | None = None,
    temperature: float | None = None,
) -> Any:
    """Return a LangChain chat model for the configured provider.

    Environment variables:
        LLM_PROVIDER    google | openai | anthropic   (default: google)
        LLM_MODEL_NAME  model id                      (default: gemini-1.5-flash)
        LLM_TEMPERATURE float                         (default: 0.2)
        GOOGLE_API_KEY  required when provider=google
    """
    provider = provider or os.getenv("LLM_PROVIDER", "google")
    model_name = model_name or os.getenv("LLM_MODEL_NAME", "gemini-1.5-flash")
    temperature = temperature if temperature is not None else float(os.getenv("LLM_TEMPERATURE", "0.2"))

    if provider == "google":
        api_key = os.getenv("GOOGLE_API_KEY", "")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY is not set. Cannot initialise Gemini LLM.")
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=model_name,
            temperature=temperature,
            google_api_key=api_key,
            max_retries=1,
        )

    if provider == "openai":
        from langchain_openai import ChatOpenAI  # type: ignore
        return ChatOpenAI(model=model_name, temperature=temperature)

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic  # type: ignore
        return ChatAnthropic(model=model_name, temperature=temperature)

    raise ValueError(f"Unknown LLM_PROVIDER: {provider!r}. Choose google | openai | anthropic.")


def llm_available() -> bool:
    """Return True only if the LLM can be instantiated (key present, etc.)."""
    try:
        get_llm()
        return True
    except Exception:
        return False
