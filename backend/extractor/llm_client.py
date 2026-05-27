from anthropic.types import TextBlock
from ..core.config import get_settings
import json

_TEXT_PROMPT_TEMPLATE = """
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
      "value": 50.0,
      // For range:
      "min": 30.0,
      "max": 70.0,
      // For and/or:
      "conditions": [ ... ]
    }}
  ],
  "exit_conditions": [ ... ],
  "position_sizing": {{
    "method": "risk_percent" or "fixed_quantity" or "percent_equity",
    "value": 2.0
  }},
  "stop_loss": {{
    "method": "atr_multiple" or "fixed_percent" or "price_level",
    "params": {{"multiplier": 1.5}}
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

_CODE_PROMPT_TEMPLATE = """
You are a trading strategy extraction engine. Parse the following PineScript strategy code into a structured JSON configuration.

PineScript code:
{text}

Return a JSON object with this exact structure:
{{
  "name": "strategy name from the PineScript (or 'PineScript Strategy' if unnamed)",
  "entry_conditions": [
    {{
      "type": "crossover" or "crossunder" or "comparison" or "range" or "and" or "or",
      "indicator": {{"name": "sma|ema|rsi|macd|bollinger|atr|stochastic|obv|volume|vwap|price", "params": {{"period": 14, "source": "close", "stddev": 2.0}}}},
      "crosses_above": {{"name": "...", "params": {{...}}}},
      "crosses_below": {{"name": "...", "params": {{...}}}},
      "source": "price" or "indicator",
      "operator": ">" or "<" or ">=" or "<=" or "==" or "!=",
      "value": 50.0,
      "min": 30.0,
      "max": 70.0,
      "conditions": [ ... ]
    }}
  ],
  "exit_conditions": [ ... ],
  "position_sizing": {{
    "method": "risk_percent" or "fixed_quantity" or "percent_equity",
    "value": 2.0
  }},
  "stop_loss": {{
    "method": "atr_multiple" or "fixed_percent" or "price_level",
    "params": {{"multiplier": 1.5}}
  }},
  "take_profit": {{
    "method": "risk_reward_ratio" or "fixed_percent" or "price_level",
    "params": {{"ratio": 2.0}}
  }},
  "timeframe": "1d"
}}

Rules:
- Analyse the PineScript to extract entry conditions (conditions before strategy.entry), exit conditions (strategy.exit / strategy.close), and risk management parameters.
- Map PineScript indicators to our supported set: sma(), ema(), rsi(), macd(), bb(), atr(), stoch(), obv(), vwap(), volume.
- For crossover() in PineScript, use type "crossover". For crossunder() use "crossunder".
- For simple comparisons (e.g. rsi > 50), use type "comparison".
- Extract stop-loss, take-profit, and position sizing from strategy.exit() calls if present.
- Use sensible defaults for any missing parameters.
- Respond ONLY with the JSON object, no other text.
"""


async def _call_llm(prompt: str) -> str:
    """Internal helper to call whichever LLM provider is configured."""
    settings = get_settings()

    if settings.anthropic_api_key:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model="claude-3-5-haiku-latest",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(block.text for block in response.content if isinstance(block, TextBlock))

    elif settings.openai_api_key:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""

    else:
        raise ValueError("No AI provider configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY)")


def _strip_code_fences(content: str) -> str:
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()
    return content


async def extract_strategy_from_text(text: str) -> dict:
    """Parse natural language trading idea into a structured strategy config."""
    prompt = _TEXT_PROMPT_TEMPLATE.format(text=text)
    content = await _call_llm(prompt)
    return json.loads(_strip_code_fences(content))


async def extract_strategy_from_code(code: str) -> dict:
    """Parse PineScript strategy code into a structured strategy config."""
    prompt = _CODE_PROMPT_TEMPLATE.format(text=code)
    content = await _call_llm(prompt)
    return json.loads(_strip_code_fences(content))
