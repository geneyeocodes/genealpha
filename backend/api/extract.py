from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from ..core.schemas import ExtractResponse
from ..extractor.llm_client import extract_strategy_from_text, extract_strategy_from_code
from ..extractor.youtube_extractor import get_transcript
from ..extractor.pdf_extractor import extract_text_from_pdf
from ..extractor.parser import parse_extracted_strategy

router = APIRouter()


@router.post("/", response_model=ExtractResponse)
async def extract_strategy(
    source_type: str = Form("text"),
    text: str = Form(""),
    url: str = Form(""),
    file: UploadFile | None = None,
):
    """
    Extract a trading strategy from various input sources.

    Source types:
    - text       : natural language description (via `text` field)
    - youtube    : YouTube URL (via `url` field) — fetches transcript
    - pdf        : PDF file upload (via `file` field) — extracts text
    - code       : PineScript code (via `text` field)
    """
    raw_text = ""
    raw_excerpt = ""

    try:
        if source_type == "text":
            if not text.strip():
                raise HTTPException(status_code=400, detail="Text input is empty")
            raw_text = text
            raw_excerpt = text[:200]

        elif source_type == "youtube":
            if not url.strip():
                raise HTTPException(status_code=400, detail="YouTube URL is required")
            raw_text = get_transcript(url)
            raw_excerpt = raw_text[:200]

        elif source_type == "pdf":
            if not file:
                raise HTTPException(status_code=400, detail="PDF file is required")
            content = await file.read()
            raw_text = extract_text_from_pdf(content)
            raw_excerpt = raw_text[:200]

        elif source_type == "code":
            if not text.strip():
                raise HTTPException(status_code=400, detail="Code input is empty")
            raw_dict = await extract_strategy_from_code(text)
            return await parse_extracted_strategy(raw_dict, source_type="code", raw_excerpt=text[:200])

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported source_type: {source_type}")

        # For text / youtube / pdf: pass extracted text to LLM
        raw_dict = await extract_strategy_from_text(raw_text)
        return await parse_extracted_strategy(raw_dict, source_type=source_type, raw_excerpt=raw_excerpt)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
