from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
from app.db import repositories
from app.services.dms_service import process_document_upload

router = APIRouter(prefix="/api", tags=["documents"])


@router.get("/projects/{project_id}/documents")
async def list_project_documents(project_id: str):
    """List all documents associated with a project."""
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return await repositories.list_documents(project_id)


@router.post("/projects/{project_id}/documents", status_code=201)
async def upload_document(
    project_id: str,
    file: UploadFile = File(...)
):
    """
    Upload a document (PDF, MD, TXT), extract its contents, and save physically
    in /app/data/projects/{project_id}/documents/{filename}.
    """
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        doc = await process_document_upload(
            project_id=project_id,
            filename=file.filename or "uploaded_file.txt",
            content_bytes=content
        )
        return doc
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")


@router.delete("/documents/{document_id}")
async def delete_document_by_id(document_id: str):
    """Delete a document record and its associated data."""
    success = await repositories.delete_document(document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted successfully", "id": document_id}
