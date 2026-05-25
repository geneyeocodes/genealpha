from ..core.schemas import ExtractResponse


def parse_extracted_strategy(raw: dict) -> ExtractResponse:
    return ExtractResponse(
        strategy_name=raw.get("strategy_name", "custom"),
        entry_conditions=raw.get("entry_conditions", ""),
        exit_conditions=raw.get("exit_conditions", ""),
        position_sizing=raw.get("position_sizing", ""),
        stop_loss=raw.get("stop_loss", ""),
        parameters=raw.get("parameters", {}),
    )
