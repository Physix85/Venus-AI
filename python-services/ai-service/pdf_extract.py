from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
import io

try:
    from pdfminer.high_level import extract_text
    PDFMINER_AVAILABLE = True
except Exception:  # pragma: no cover
    PDFMINER_AVAILABLE = False

router = APIRouter()

class PdfExtractResponse(BaseModel):
    text: Optional[str] = None

@router.post("/extract/pdf", response_model=PdfExtractResponse)
async def extract_pdf_endpoint(file: UploadFile = File(...)):
    if not PDFMINER_AVAILABLE:
        raise HTTPException(status_code=503, detail="PDF extraction library not available")

    if file.content_type not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(status_code=400, detail=f"Unsupported content type: {file.content_type}")

    try:
        data = await file.read()
        text = extract_text(io.BytesIO(data))
        if text:
            # Normalize whitespace and trim
            text = " ".join(text.split())
        return PdfExtractResponse(text=text or None)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to extract PDF text: {str(e)}")

