from ..core.schemas import ExtractResponse, StrategyConfig


async def parse_extracted_strategy(
    raw: dict, source_type: str = "text", raw_excerpt: str | None = None
) -> ExtractResponse:
    config = StrategyConfig(**raw)  # validates the LLM output
    return ExtractResponse(strategy=config, source_type=source_type, raw_excerpt=raw_excerpt)
