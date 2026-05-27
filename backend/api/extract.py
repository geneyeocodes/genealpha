from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..core.schemas import ExtractResponse
from ..strategies.config_schema import StrategyConfig
import json

router = APIRouter()

PROMPT_TEMPLATE = """You are a trading strategy extraction engine. Parse the following trading idea into a structured JSON configuration.

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
- Respond ONLY with the JSON object, no other text."""


class ParseJsonRequest(BaseModel):
    json_str: str


@router.get("/prompt-template")
async def get_prompt_template():
    """Return the prebuilt ChatGPT prompt template."""
    return {"template": PROMPT_TEMPLATE}


@router.post("/parse-strategy-json", response_model=ExtractResponse)
async def parse_strategy_json(request: ParseJsonRequest):
    """
    Accept a raw JSON string (output from ChatGPT), validate it against
    StrategyConfig, and return the parsed ExtractResponse.
    """
    try:
        raw = json.loads(request.json_str)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

    try:
        config = StrategyConfig(**raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid strategy config: {e}")

    return ExtractResponse(strategy=config, source_type="manual", raw_excerpt=None)
