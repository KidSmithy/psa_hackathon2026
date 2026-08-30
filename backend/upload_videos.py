import os
import sys
from pathlib import Path
import mimetypes

# Set paths
backend_dir = Path(__file__).resolve().parent
video_dir = backend_dir / "video"

# Add backend to sys.path
sys.path.insert(0, str(backend_dir))

from mcp.supabase_client import get_supabase_client, SUPABASE_URL

def upload_videos():
    print(f"Connecting to Supabase at: {SUPABASE_URL}", flush=True)
    client = get_supabase_client()
    
    # 1. Clean existing storage objects in 'videos' bucket
    try:
        existing_objects = client.storage.from_("videos").list()
        print(f"Existing storage objects found: {existing_objects}", flush=True)
        if existing_objects:
            obj_names = [obj["name"] for obj in existing_objects if "name" in obj and obj["name"]]
            if obj_names:
                print(f"Removing old storage objects: {obj_names}", flush=True)
                client.storage.from_("videos").remove(obj_names)
    except Exception as e:
        print(f"Note on cleaning storage bucket: {e}", flush=True)

    # 2. Upload new renamed files
    files = list(video_dir.glob("*.mp4"))
    print(f"Found {len(files)} video files to process in {video_dir}", flush=True)
    
    for f in files:
        filename = f.name
        file_size = f.stat().st_size
        mime_type, _ = mimetypes.guess_type(str(f))
        if not mime_type:
            mime_type = "video/mp4"
            
        storage_path = f"{filename}"
        print(f"\nProcessing {filename} ({file_size} bytes)...", flush=True)
        
        with open(f, "rb") as video_file:
            content = video_file.read()
            
        # Upload / Upsert into storage bucket 'videos'
        try:
            res = client.storage.from_("videos").upload(
                path=storage_path,
                file=content,
                file_options={"content-type": mime_type, "upsert": "true"}
            )
            print(f"Uploaded to storage: {res}", flush=True)
        except Exception as e:
            print(f"Storage upload note/exception: {e}", flush=True)
            
        # Get public URL
        public_url_resp = client.storage.from_("videos").get_public_url(storage_path)
        if isinstance(public_url_resp, str):
            public_url = public_url_resp
        elif isinstance(public_url_resp, dict):
            public_url = public_url_resp.get("publicUrl") or public_url_resp.get("publicURL")
        else:
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/videos/{storage_path}"
            
        print(f"Public URL: {public_url}", flush=True)
        
        # Insert into table public.videos
        record_data = {
            "filename": filename,
            "storage_path": storage_path,
            "public_url": public_url,
            "size_bytes": file_size,
            "mime_type": mime_type,
            "metadata": {
                "original_filename": filename,
                "local_path": str(f)
            }
        }
        
        insert_res = client.table("videos").insert(record_data).execute()
        print(f"Inserted new record into 'videos' table: {insert_res.data}", flush=True)

    print("\nAll videos processed successfully!", flush=True)

if __name__ == "__main__":
    upload_videos()
