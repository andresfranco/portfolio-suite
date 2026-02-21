import os
import shutil
import uuid
from fastapi import UploadFile
from pathlib import Path
from typing import Optional
from app.core.logging import setup_logger
from app.core.config import settings

# Set up logger using centralized logging
logger = setup_logger("app.utils.file_utils")

# Get upload directories from settings
UPLOAD_DIR = settings.UPLOADS_DIR
LANGUAGE_IMAGES_DIR = UPLOAD_DIR / "language_images"
PROJECT_IMAGES_DIR = UPLOAD_DIR / "projects"

# Ensure directories exist
def ensure_upload_dirs():
    """Create upload directories if they don't exist"""
    # Make sure base directories exist
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(LANGUAGE_IMAGES_DIR, exist_ok=True)
    os.makedirs(PROJECT_IMAGES_DIR, exist_ok=True)
    
    # Create subdirectories for different types of content
    os.makedirs(UPLOAD_DIR / "portfolios", exist_ok=True)
    os.makedirs(PROJECT_IMAGES_DIR / "attachments", exist_ok=True)
    
    logger.debug(f"Ensured upload directories exist: {UPLOAD_DIR}, {LANGUAGE_IMAGES_DIR}, {PROJECT_IMAGES_DIR}")


def sanitize_filename(filename: Optional[str], default: str = "upload") -> str:
    """
    Return a safe filename with directory components removed.
    """
    candidate = Path(filename).name if filename else default
    if candidate in {"", ".", ".."}:
        return default
    return candidate


def resolve_safe_path(base_dir: Path, *path_parts: object) -> Path:
    """
    Resolve a path under a trusted base directory and reject path traversal.
    """
    base_path = Path(base_dir).resolve(strict=False)
    candidate = base_path
    for part in path_parts:
        if part is None:
            continue
        normalized = str(part).replace("\\", "/").lstrip("/")
        if not normalized:
            continue
        candidate = candidate / normalized

    resolved_path = candidate.resolve(strict=False)
    if os.path.commonpath([str(base_path), str(resolved_path)]) != str(base_path):
        raise ValueError(f"Unsafe path detected outside base directory: {resolved_path}")
    return resolved_path

# Save an uploaded file
async def save_upload_file(
    upload_file: UploadFile, 
    directory: Path = UPLOAD_DIR, 
    filename: str = None,
    keep_original_filename: bool = False,
    project_id: int = None
) -> str:
    """
    Save an uploaded file to the specified directory
    
    Args:
        upload_file: The uploaded file to save
        directory: The directory to save the file in
        filename: Optional custom filename to use (instead of generating a UUID)
        keep_original_filename: If True, use the original filename (with conflict resolution)
        project_id: If provided, organize files into project-specific subdirectories
        
    Returns:
        The path to the saved file relative to the upload directory
    """
    try:
        # Ensure directories exist first
        ensure_upload_dirs()
        
        if not upload_file or not hasattr(upload_file, 'file'):
            logger.error("Invalid upload file object")
            raise ValueError("Invalid upload file object")
            
        upload_root = Path(UPLOAD_DIR).resolve(strict=False)
        directory_path = Path(directory)

        if directory_path.is_absolute():
            directory_path = directory_path.resolve(strict=False)
            if os.path.commonpath([str(upload_root), str(directory_path)]) != str(upload_root):
                raise ValueError(f"Upload directory must be under {upload_root}")
            relative_directory = directory_path.relative_to(upload_root)
        else:
            relative_directory = directory_path

        # If project_id is provided, create project-specific subdirectory
        if project_id is not None:
            relative_directory = relative_directory / f"project_{project_id}"

        directory = resolve_safe_path(upload_root, relative_directory)
        directory.mkdir(exist_ok=True, parents=True)
        logger.debug(f"Ensured directory exists: {directory}")
        
        # Get original filename if available, stripping any directory components
        # to prevent path traversal attacks (e.g. filename="../../etc/passwd")
        raw_filename = upload_file.filename
        original_filename = sanitize_filename(raw_filename, default="upload") if raw_filename else None
        logger.debug(f"Original filename: {original_filename}")

        # Generate a filename
        if filename:
            # Strip directory components from caller-supplied custom filename
            unique_filename = sanitize_filename(filename, default=f"{uuid.uuid4()}")
            logger.debug(f"Using custom filename: {unique_filename}")
        elif keep_original_filename and original_filename:
            # Use the sanitized original filename, but ensure uniqueness
            unique_filename = original_filename
            logger.debug(f"Using original filename: {unique_filename}")
            
            # Check if file exists
            if resolve_safe_path(directory, unique_filename).exists():
                # Create a unique version with a UUID
                base_name, extension = os.path.splitext(original_filename)
                unique_filename = f"{base_name}_{uuid.uuid4().hex[:8]}{extension}"
                logger.debug(f"File exists, using modified filename: {unique_filename}")
        else:
            # Generate a unique filename to avoid collisions
            file_extension = os.path.splitext(original_filename)[1] if original_filename else ""
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            logger.debug(f"Generated UUID filename: {unique_filename}")
        
        # Create the full path
        file_path = resolve_safe_path(directory, unique_filename)
        logger.debug(f"Full file path: {file_path}")
        
        # Save the file
        try:
            with open(file_path, "wb") as buffer:
                contents = await upload_file.read()
                buffer.write(contents)
            logger.debug(f"Saved uploaded file to {file_path}")
        except Exception as e:
            logger.error(f"Error writing file to {file_path}: {str(e)}")
            raise IOError(f"Failed to write file: {str(e)}")
            
        # Return the full path
        return str(file_path)
    
    except Exception as e:
        logger.error(f"Error in save_upload_file: {str(e)}")
        raise

# Delete a file
def delete_file(file_path: str) -> bool:
    """
    Delete a file at the given path
    Returns True if successful, False otherwise
    """
    try:
        # Convert to absolute path if it's relative
        if not os.path.isabs(file_path):
            file_path = os.path.join(os.getcwd(), file_path)
        
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.debug(f"Deleted file: {file_path}")
            return True
        else:
            logger.warning(f"File not found for deletion: {file_path}")
            return False
    except Exception as e:
        logger.error(f"Error deleting file {file_path}: {str(e)}")
        return False

# Get file URL
def get_file_url(file_path: str) -> str:
    """
    Convert a file path to a URL for client access
    """
    if not file_path:
        logger.warning("Empty file path passed to get_file_url")
        return ""
    
    logger.debug(f"Converting file path to URL: {file_path}")
    
    # Replace backslashes with forward slashes for URL
    file_path = str(file_path).replace("\\", "/")
    
    # If it's already a relative URL starting with /uploads, return it as is
    if file_path.startswith("/uploads/"):
        logger.debug(f"Path is already a relative URL: {file_path}")
        return file_path
    
    # If it's already a complete URL, return it as is
    if file_path.startswith(("http://", "https://")):
        logger.debug(f"Path is already a complete URL: {file_path}")
        return file_path
    
    # Handle absolute paths from our organized file saving
    if os.path.isabs(file_path):
        try:
            # Convert absolute path to relative from uploads directory
            uploads_path_str = str(UPLOAD_DIR.absolute())
            logger.debug(f"Uploads directory absolute path: {uploads_path_str}")
            
            if uploads_path_str in file_path:
                # Extract the part after uploads directory
                relative_part = file_path.split(uploads_path_str, 1)[1]
                # Remove leading slash if present
                if relative_part.startswith("/"):
                    relative_part = relative_part[1:]
                    
                final_url = f"/uploads/{relative_part}"
                logger.debug(f"Converted absolute path to URL: {final_url}")
                return final_url
            else:
                logger.warning(f"Absolute path doesn't contain uploads directory: {file_path}")
                # Fallback: just use filename
                filename = os.path.basename(file_path)
                fallback_url = f"/uploads/{filename}"
                logger.debug(f"Using filename fallback: {fallback_url}")
                return fallback_url
                
        except Exception as e:
            logger.error(f"Error processing absolute path: {e}")
            # Fallback to filename
            filename = os.path.basename(file_path)
            return f"/uploads/{filename}"
    
    # Handle relative paths or paths that contain "uploads/"
    if "uploads/" in file_path:
        try:
            # Extract everything after "uploads/"
            relative_part = file_path.split("uploads/", 1)[1]
            final_url = f"/uploads/{relative_part}"
            logger.debug(f"Extracted from relative path: {final_url}")
            return final_url
        except Exception as e:
            logger.warning(f"Error extracting relative path: {e}")
    
    # If none of the above work, treat as relative path and prepend /uploads/
    if file_path.startswith("/"):
        file_path = file_path[1:]
    
    final_url = f"/uploads/{file_path}"
    logger.debug(f"Final URL (default case): {final_url}")
    return final_url

def get_relative_path(file_path: str) -> str:
    """
    Convert an absolute file path to a relative path from the uploads directory.
    This is used for storing paths in the database.
    
    Args:
        file_path: Absolute or relative file path
        
    Returns:
        Relative path from uploads directory (e.g., "projects/project_1/PROI-LOGO/image.png")
    """
    if not file_path:
        logger.warning("Empty file path passed to get_relative_path")
        return ""
    
    logger.debug(f"Converting to relative path: {file_path}")
    
    # Replace backslashes with forward slashes
    file_path = str(file_path).replace("\\", "/")
    
    # If it's already relative and starts with uploads/, remove that prefix
    if file_path.startswith("uploads/"):
        relative_path = file_path[8:]  # Remove "uploads/" prefix
        logger.debug(f"Removed uploads/ prefix: {relative_path}")
        return relative_path
    
    # If it starts with /uploads/, remove that prefix
    if file_path.startswith("/uploads/"):
        relative_path = file_path[9:]  # Remove "/uploads/" prefix
        logger.debug(f"Removed /uploads/ prefix: {relative_path}")
        return relative_path
    
    # If it's an absolute path, extract the part after uploads directory
    if os.path.isabs(file_path):
        try:
            uploads_path_str = str(UPLOAD_DIR.absolute())
            logger.debug(f"Uploads directory: {uploads_path_str}")
            
            if uploads_path_str in file_path:
                # Extract the part after uploads directory
                relative_part = file_path.split(uploads_path_str, 1)[1]
                # Remove leading slash if present
                if relative_part.startswith("/"):
                    relative_part = relative_part[1:]
                    
                logger.debug(f"Extracted relative path: {relative_part}")
                return relative_part
            else:
                logger.warning(f"Absolute path doesn't contain uploads directory: {file_path}")
                # Fallback: just use filename
                return os.path.basename(file_path)
                
        except Exception as e:
            logger.error(f"Error processing absolute path: {e}")
            return os.path.basename(file_path)
    
    # If it contains "uploads/", extract everything after it
    if "uploads/" in file_path:
        relative_part = file_path.split("uploads/", 1)[1]
        logger.debug(f"Extracted from path containing uploads/: {relative_part}")
        return relative_part
    
    # Otherwise, treat it as already relative
    logger.debug(f"Treating as already relative: {file_path}")
    return file_path

# Specific function for project images
async def save_project_image(
    upload_file: UploadFile, 
    project_id: int,
    category: str = "gallery",
    keep_original_filename: bool = True
) -> str:
    """
    Save a project image file in an organized directory structure
    
    Args:
        upload_file: The uploaded image file to save
        project_id: ID of the project this image belongs to
        category: Category of the image (e.g., "gallery", "diagram", "main")
        keep_original_filename: If True, preserve the original filename
        
    Returns:
        The path to the saved file
    """
    try:
        # Create project-specific directory with category subdirectory
        project_dir = PROJECT_IMAGES_DIR / f"project_{project_id}" / category
        project_dir.mkdir(exist_ok=True, parents=True)
        logger.debug(f"Created project image directory: {project_dir}")
        
        # Save the file using the existing function
        file_path = await save_upload_file(
            upload_file=upload_file,
            directory=project_dir,
            keep_original_filename=keep_original_filename
        )
        
        logger.info(f"Saved project image: {file_path}")
        return file_path
        
    except Exception as e:
        logger.error(f"Error saving project image: {str(e)}")
        raise
