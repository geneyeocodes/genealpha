from anthropic.types import TextBlock
from ..core.config import get_settings
import json


async def extract_strategy_from_text(text: str) -> dict:
    """
    Uses Claude (Anthropic) or OpenAI to parse a natural language trading idea
    into a structured strategy configuration.
    """
    settings = get_settings()
    prompt = f"""
You are a trading strategy extraction engine. Parse the following trading idea into a structured JSON configuration.

Trading idea:
{text}

Return a JSON object with this exact structure:
{{
  "name": "strategy name from the idea",
  "entry_conditions": [
    {{
      "type": "crossover" or "crossunder" or "comparison" or "range" or "and" or "or",
      "indicator": {{"name": "sma|ema|rsi|macd|bollinger|atr|stochastic|obv|volume|vwap|price", "params": {{"period": 14, "source": "close", "stddev": 2.0}}}},
      // For crossover:
      "crosses_above": {{"name": "...", "params": {{...}}}},
      // For crossunder:
      "crosses_below": {{"name": "...", "params": {{...}}}},
      // For comparison:
      "source": "price" or "indicator",
      "operator": ">" or "<" or ">=" or "<=" or "==" or "!=",
      "value": 50.0,  // numeric threshold
      // For range:
      "min": 30.0,
      "max": 70.0,
      // For and/or:
      "conditions": [ ... ]  // nested conditions
    }}
  ],
  "exit_conditions": [ ... ],  // same structure as entry_conditions
  "position_sizing": {{
    "method": "risk_percent" or "fixed_quantity" or "percent_equity",
    "value": 2.0
  }},
  "stop_loss": {{
    "method": "atr_multiple" or "fixed_percent" or "price_level",
    "params": {{"multiplier": 1.5}}  // or {{"percent": 2.0}} or {{"price": 95.0}}
  }},
  "take_profit": {{
    "method": "risk_reward_ratio" or "fixed_percent" or "price_level",
    "params": {{"ratio": 2.0}}
  }},
  "timeframe": "1d"
}}

Rules:
- Use ONLY the indicators and condition types listed above.
- For RSI-based conditions, use "comparison" type with indicator name "rsi".
- For crossover conditions, use "crossover" type (not "comparison").
- Keep the structure minimal but accurate. Do NOT include fields that aren't needed.
- If you can't determine all values, use sensible defaults (period=14 for RSI, period=20/50 for EMA crossovers).
- Respond ONLY with the JSON object, no other text.
"""

    if settings.anthropic_api_key:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model="claude-3-5-haiku-latest",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        content = "".join(block.text for block in response.content if isinstance(block, TextBlock))

    elif settings.openai_api_key:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.choices[0].message.content

    else:
        raise ValueError("No AI provider configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY)")

    if content is None:
        content = ""

    # Strip code fences if present
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()

    return json.loads(content)
