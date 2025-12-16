import os
import json
import uuid
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .schemas import RecordingCreate, RecordingSummary

app = FastAPI()

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local dev, allow all. In prod, lock this down.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "recordings")
os.makedirs(DATA_DIR, exist_ok=True)

@app.get("/health")
def read_health():
    return {"status": "ok"}

@app.post("/recordings", response_model=dict)
def create_recording(recording: RecordingCreate):
    rec_id = recording.id if recording.id else str(uuid.uuid4())
    # Ensure ID is in the data
    data = recording.model_dump()
    data["id"] = rec_id
    
    file_path = os.path.join(DATA_DIR, f"{rec_id}.json")
    
    # Calculate duration
    duration = 0.0
    if recording.frames:
        # Assuming sorted by time, or just take max
        duration = max(f.t_ms for f in recording.frames) / 1000.0
    
    # We don't store duration in the JSON strictly if it's not in the schema, 
    # but the Summary endpoint needs it. We can compute it on load or store it in a separate index.
    # For simplicity in this small app, we'll just write the full JSON to disk.
    
    with open(file_path, "w") as f:
        json.dump(data, f)
    
    return {"id": rec_id}

@app.get("/recordings", response_model=List[RecordingSummary])
def list_recordings():
    results = []
    # Scan directory
    if not os.path.exists(DATA_DIR):
        return []
        
    for filename in os.listdir(DATA_DIR):
        if not filename.endswith(".json"):
            continue
            
        file_path = os.path.join(DATA_DIR, filename)
        try:
            # For listing, we might not want to read the WHOLE file if it's huge (many frames).
            # But standard JSON parsers read the whole thing. 
            # Optimization: If performance is bad, we should store summaries in a separate DB or file.
            # For MVP, reading file is acceptable as long as recordings aren't massive.
            # 5 seconds at 24fps = 120 frames. Not big. 
            # Even 1 hour = 86400 frames. That might be slow.
            # OPTIMIZATION: Just read enough to get metadata? 
            # Or assume we can read it. Let's read it for now.
            with open(file_path, "r") as f:
                data = json.load(f)
                
            frames = data.get("frames", [])
            duration_s = 0.0
            if frames:
                duration_s = frames[-1].get("t_ms", 0) / 1000.0
            
            results.append(RecordingSummary(
                id=data.get("id"),
                created_at_iso=data.get("created_at_iso"),
                mode=data.get("mode"),
                duration_s=duration_s
            ))
        except Exception as e:
            print(f"Error reading {filename}: {e}")
            continue
    
    # Sort by created_at desc
    results.sort(key=lambda x: x.created_at_iso, reverse=True)
    return results

@app.get("/recordings/{rec_id}")
def get_recording(rec_id: str):
    file_path = os.path.join(DATA_DIR, f"{rec_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Recording not found")
        
    with open(file_path, "r") as f:
        data = json.load(f)
    return data
