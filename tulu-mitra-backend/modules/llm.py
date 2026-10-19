"""
Optional connection to a language model for open-ended questions:
OpenAI (OPENAI_API_KEY) or Claude (ANTHROPIC_API_KEY) — see config.py.

Only used when one of those keys is set. Everything that can be answered
from the project's own data is answered by the rule-based modules first;
this is the fallback for everything else. Replies are marked as
AI-generated in the interface, because an LLM's Tulu can contain mistakes.
"""

import json
import logging
import re

import config

log = logging.getLogger(__name__)

SYSTEM = """You are Tulu Mitra (ತುಳು ಮಿತ್ರ), a friendly assistant for the Tulu language, built as a college AI/ML project.

Always answer as JSON with exactly these keys:
  "tulu":    a short reply in Tulu, written in Kannada script (one or two sentences)
  "roman":   the same Tulu in simple Latin letters
  "english": the English meaning of the Tulu reply
  "explanation": optional — a longer English explanation, only if the question needs one (else "")

Rules:
- Use simple, common, everyday Tulu. If you are not confident of the Tulu for something, keep the Tulu part very short and put the substance in "explanation" — never invent words.
- The user may write in English, Kannada or Tulu. Reply in Tulu either way.
- Keep "explanation" under 120 words. No markdown headings.
- Output only the JSON object, nothing else."""


class LLMError(RuntimeError):
    pass


_client = None


def available() -> bool:
    return config.LLM_ENABLED


def provider():
    return config.LLM_PROVIDER if available() else None


def _get_client():
    global _client
    if _client is None:
        if config.LLM_PROVIDER == "openai":
            try:
                import openai
            except ImportError as exc:
                raise LLMError("The 'openai' package is not installed: pip install openai") from exc
            _client = openai.OpenAI(api_key=config.OPENAI_API_KEY)
        else:
            try:
                import anthropic
            except ImportError as exc:
                raise LLMError("The 'anthropic' package is not installed") from exc
            _client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    return _client


def _messages(user_text, history):
    """The conversation as alternating user/assistant turns, newest last."""
    messages = []
    for turn in (history or [])[-10:]:
        role = "assistant" if turn.get("role") == "assistant" else "user"
        text = (turn.get("text") or "").strip()
        if text:
            if messages and messages[-1]["role"] == role:
                messages[-1]["content"] += "\n" + text
            else:
                messages.append({"role": role, "content": text})
    if messages and messages[0]["role"] == "assistant":
        messages.pop(0)
    if messages and messages[-1]["role"] == "user":
        messages[-1]["content"] += "\n" + user_text
    else:
        messages.append({"role": "user", "content": user_text})
    return messages


def _reasoning_model(model: str) -> bool:
    # These models spend part of the token budget thinking before they answer.
    name = (model or "").lower()
    return name.startswith(("gpt-6", "gpt-5", "o1", "o3", "o4"))


def _ask_openai(messages, system, max_tokens):
    model = config.LLM_MODEL
    reasoning = _reasoning_model(model)
    kwargs = {
        "model": model,
        "messages": [{"role": "system", "content": system}, *messages],
        "max_completion_tokens": max_tokens * 4 if reasoning else max_tokens,
    }
    if reasoning:
        kwargs["reasoning_effort"] = "low"  # quicker, cheaper; plenty for short replies
    resp = _get_client().chat.completions.create(**kwargs)
    return (resp.choices[0].message.content or "").strip()


def _ask_anthropic(messages, system, max_tokens):
    resp = _get_client().messages.create(
        model=config.LLM_MODEL, max_tokens=max_tokens, system=system, messages=messages
    )
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()


def ask(user_text: str, history=None, system: str = SYSTEM, max_tokens: int = 700) -> str:
    if not available():
        raise LLMError("LLM not configured")
    messages = _messages(user_text, history)
    try:
        if config.LLM_PROVIDER == "openai":
            return _ask_openai(messages, system, max_tokens)
        return _ask_anthropic(messages, system, max_tokens)
    except LLMError:
        raise
    except Exception as exc:  # network, auth, rate limit, no credit …
        log.warning("LLM call failed (%s): %s", config.LLM_PROVIDER, exc)
        raise LLMError(str(exc)) from exc


def ask_json(user_text: str, history=None, system: str = SYSTEM) -> dict:
    raw = ask(user_text, history, system)
    match = re.search(r"\{.*\}", raw, re.S)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return {"tulu": "", "roman": "", "english": "", "explanation": raw}
