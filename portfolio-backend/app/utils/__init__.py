from app.utils.file_utils import (
    save_upload_file,
    save_project_image,
    delete_file,
    get_file_url,
    ensure_upload_dirs,
    LANGUAGE_IMAGES_DIR,
    PROJECT_IMAGES_DIR
)

# Remove direct import to avoid circular dependencies
# The auth_utils functions will be imported directly where needed
