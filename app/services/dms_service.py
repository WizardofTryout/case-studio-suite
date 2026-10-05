import os
import io
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from pypdf import PdfReader
from app.config import settings
from app.db import repositories

logger = logging.getLogger("case_studio.dms_service")


async def process_document_upload(
    project_id: str,
    filename: str,
    content_bytes: bytes
) -> Dict[str, Any]:
    """
    Saves document physically under /app/data/projects/{project_id}/documents/{filename},
    extracts raw text (PDF, MD, TXT), and creates entry in project_documents SQLite table.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
    if ext not in ["pdf", "md", "txt", "markdown"]:
        raise ValueError(f"Unsupported file format: {ext}. Only PDF, MD, and TXT are supported.")

    file_type = "pdf" if ext == "pdf" else ("md" if ext in ["md", "markdown"] else "txt")
    
    # Store physically in project documents directory
    proj_doc_dir = settings.resolved_data_dir / "projects" / project_id / "documents"
    proj_doc_dir.mkdir(parents=True, exist_ok=True)
    
    target_path = proj_doc_dir / filename
    with open(target_path, "wb") as f:
        f.write(content_bytes)
        
    extracted_text = ""
    try:
        if file_type == "pdf":
            reader = PdfReader(io.BytesIO(content_bytes))
            pages_text = []
            for i, page in enumerate(reader.pages):
                txt = page.extract_text() or ""
                if txt.strip():
                    pages_text.append(f"--- Page {i+1} ---\n{txt.strip()}")
            extracted_text = "\n\n".join(pages_text)
            logger.info(f"Extracted {len(reader.pages)} pages from PDF {filename}.")
        else:
            extracted_text = content_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        logger.error(f"Error extracting text from {filename}: {e}")
        extracted_text = f"[Text extraction error: {e}]"

    # Persist in SQLite
    doc_record = await repositories.create_document(
        project_id=project_id,
        filename=filename,
        file_type=file_type,
        extracted_text=extracted_text
    )
    logger.info(f"Document {filename} stored and indexed for project {project_id}.")
    return doc_record


async def get_project_documents_context(project_id: str) -> str:
    """Combines extracted texts from all project documents into a unified RAG context block."""
    docs = await repositories.list_documents(project_id)
    if not docs:
        return ""
    
    parts = []
    for d in docs:
        txt = d.get("extracted_text") or ""
        if txt.strip():
            parts.append(f"=== DOKUMENT: {d['filename']} ===\n{txt.strip()[:6000]}")
            
    return "\n\n".join(parts)
