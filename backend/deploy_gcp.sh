#!/usr/bin/env bash
set -e

# Bash Script to Deploy PSA Backend to Google Cloud Run
PROJECT_ID=${1:-$(gcloud config get-value project 2>/dev/null)}
REGION=${2:-"asia-southeast1"}
SERVICE_NAME=${3:-"psa-backend"}

if [ -z "$PROJECT_ID" ]; then
    echo "Error: No GCP Project configured. Run: gcloud config set project <PROJECT_ID> or pass it as the 1st argument."
    exit 1
fi

echo "=========================================="
echo "Deploying PSA Backend to Google Cloud Run"
echo "Project ID: $PROJECT_ID"
echo "Region:     $REGION"
echo "Service:    $SERVICE_NAME"
echo "=========================================="

# 1. Enable required GCP services
echo -e "\n1. Enabling required Google Cloud APIs..."
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    --project "$PROJECT_ID"

# 2. Ensure Artifact Registry repository exists
echo -e "\n2. Ensuring Artifact Registry repo 'psa-repo' exists..."
if ! gcloud artifacts repositories describe psa-repo --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud artifacts repositories create psa-repo \
        --repository-format=docker \
        --location="$REGION" \
        --description="PSA Hackathon Backend Docker Repo" \
        --project="$PROJECT_ID"
fi

IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/psa-repo/${SERVICE_NAME}:latest"

# 3. Build container using Google Cloud Build (no local Docker required)
echo -e "\n3. Submitting build to Google Cloud Build: ${IMAGE_TAG}..."
gcloud builds submit --tag "$IMAGE_TAG" --project="$PROJECT_ID" .

# 4. Deploy to Cloud Run
echo -e "\n4. Deploying service to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_TAG" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300s \
    --set-env-vars "ALLOWED_ORIGINS=*" \
    --project "$PROJECT_ID"

echo -e "\nDeployment Complete!"
echo "To attach environment variables (Supabase & OpenAI keys), run:"
echo "  gcloud run services update $SERVICE_NAME --region $REGION --set-env-vars SUPABASE_URL=...,SUPABASE_KEY=...,OPENAI_API_KEY=..."
