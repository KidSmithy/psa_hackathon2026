import os
import time
from google import genai

# Initialize the client (automatically uses GEMINI_API_KEY environment variable)
client = genai.Client()

# 1. Upload video using the Files API
video_file = client.files.upload(file="C:/Users/Rald999/Documents/GitHub/psa_hackathon2026/backend/video/elec.mp4")

# 2. Wait for processing to complete if large
while video_file.state.name == "PROCESSING":
    time.sleep(5)
    video_file = client.files.get(name=video_file.name)

detection_prompt = """
Analyze this video footage carefully for any accidents, anomalies, safety hazards, or unusual behaviors.

Provide a structured breakdown:
1. Incident/Anomaly Detection:
   - Identify any collisions, near-misses, slips, falls, equipment malfunctions, structural issues, or irregular/suspicious behavior.
   - If something simply looks 'off' or out of place, describe what seems abnormal and why.

2. Timeline & Details:
   - Timestamp (MM:SS - MM:SS): What happens.
   - Severity Level: (Low / Medium / High / Critical).
   - Entities Involved: (Vehicles, pedestrians, machinery, environment, etc.).
   - Specific Observation: Detailed description of the event or anomalous pattern.

3. Overall Assessment:
   - Provide a final summary determining whether the video contains a confirmed incident, a potential hazard, or entirely normal activity.
"""


# 3. Analyze the video with a prompt
response = client.models.generate_content(
    model="gemini-3.7-flash",
    contents=[
        video_file,
        detection_prompt
    ]
)

print(response.text)