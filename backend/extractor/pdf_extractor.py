import fitz  # PyMuPDF


def extract_text_from_pdf(content: bytes) -> str:
    doc = fitz.open(stream=content, filetype="pdf")
    text = ""
    for page in doc:
        page_text = page.get_text("text")
        if isinstance(page_text, str):
            text += page_text
    doc.close()
    return text.strip()
