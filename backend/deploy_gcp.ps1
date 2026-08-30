# PowerShell Script to Deploy PSA Backend to Google Cloud Run
Param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "",
    [Parameter(Mandatory=$false)]
    [string]$Region = "asia-southeast1",
    [Parameter(Mandatory=$false)]
    [string]$ServiceName = "psa-backend"
)

# If ProjectId is not provided, fetch current gcloud project
if (-not $ProjectId) {
    $ProjectId = (gcloud config get-value project 2>$null)
}

if (-not $ProjectId) {
    Write-Error "No GCP project configured. Set it using: gcloud config set project <PROJECT_ID> or pass -ProjectId <PROJECT_ID>"
    exit 1
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Deploying PSA Backend to Google Cloud Run" -ForegroundColor Cyan
Write-Host "Project ID: $ProjectId" -ForegroundColor Yellow
Write-Host "Region:     $Region" -ForegroundColor Yellow
Write-Host "Service:    $ServiceName" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Enable required GCP services
Write-Host "`n1. Enabling required Google Cloud APIs..." -ForegroundColor Green
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $ProjectId

# 2. Ensure Artifact Registry repository exists
Write-Host "`n2. Ensuring Artifact Registry repo 'psa-repo' exists..." -ForegroundColor Green
gcloud artifacts repositories describe psa-repo --location=$Region --project=$ProjectId 2>$null
if ($LASTEXITCODE -ne 0) {
    gcloud artifacts repositories create psa-repo `
        --repository-format=docker `
        --location=$Region `
        --description="PSA Hackathon Backend Docker Repo" `
        --project=$ProjectId
}

$IMAGE_TAG = "$Region-docker.pkg.dev/$ProjectId/psa-repo/${ServiceName}:latest"

# 3. Build container using Google Cloud Build (no local Docker required)
Write-Host "`n3. Submitting build to Google Cloud Build: $IMAGE_TAG..." -ForegroundColor Green
gcloud builds submit --tag $IMAGE_TAG --project=$ProjectId .

if ($LASTEXITCODE -ne 0) {
    Write-Error "Cloud Build failed."
    exit 1
}

# 4. Deploy to Cloud Run
Write-Host "`n4. Deploying service to Cloud Run..." -ForegroundColor Green
gcloud run deploy $ServiceName `
    --image $IMAGE_TAG `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --memory 2Gi `
    --cpu 2 `
    --timeout 300s `
    --set-env-vars "ALLOWED_ORIGINS=*" `
    --project $ProjectId

Write-Host "`nDeployment Complete!" -ForegroundColor Green
Write-Host "Remember to set your secrets/env vars in Cloud Run console or via CLI:" -ForegroundColor Yellow
Write-Host "  gcloud run services update $ServiceName --region $Region --set-env-vars SUPABASE_URL=...,SUPABASE_KEY=...,OPENAI_API_KEY=..." -ForegroundColor Gray
