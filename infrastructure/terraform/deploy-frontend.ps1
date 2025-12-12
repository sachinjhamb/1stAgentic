# Frontend Deployment Script for Terraform
# This script updates frontend configuration and deploys to S3

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment,
    
    [Parameter(Mandatory=$true)]
    [string]$GoogleClientId,
    
    [string]$AwsRegion = "us-east-1",
    [switch]$Help
)

# Color functions
function Write-Info { param([string]$Message); Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param([string]$Message); Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message); Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message); Write-Host "[ERROR] $Message" -ForegroundColor Red }

if ($Help) {
    Write-Host @"
Frontend Deployment Script for Terraform

Usage: .\deploy-frontend.ps1 -Environment <env> -GoogleClientId <client-id>

This script:
1. Gets deployment outputs from Terraform
2. Updates frontend configuration with API URL and Google Client ID
3. Deploys frontend files to S3
4. Invalidates CloudFront cache

Parameters:
  -Environment      Environment (dev, staging, prod) [Required]
  -GoogleClientId   Google OAuth Client ID [Required]
  -AwsRegion        AWS Region (default: us-east-1)
  -Help             Display this help message
"@
    exit 0
}

# Get script directory and paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$FrontendDir = Join-Path $ProjectRoot "frontend"
$ConfigFile = Join-Path $FrontendDir "config.js"

Write-Info "Frontend Deployment Configuration:"
Write-Host "  Environment: $Environment"
Write-Host "  Frontend Dir: $FrontendDir"
Write-Host ""

# Check if Terraform state exists
Push-Location $ScriptDir
try {
    # Get Terraform outputs
    Write-Info "Retrieving Terraform outputs..."
    $OutputsJson = terraform output -json
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to get Terraform outputs. Make sure infrastructure is deployed first."
        exit 1
    }
    
    $Outputs = $OutputsJson | ConvertFrom-Json
    $ApiUrl = $Outputs.api_gateway_url.value
    $S3Bucket = $Outputs.s3_bucket_name.value
    $DistributionId = $Outputs.cloudfront_distribution_id.value
    $CloudFrontUrl = $Outputs.cloudfront_url.value
    
    Write-Success "Retrieved deployment information:"
    Write-Host "  API URL: $ApiUrl"
    Write-Host "  S3 Bucket: $S3Bucket"
    Write-Host "  CloudFront URL: $CloudFrontUrl"
    Write-Host ""
    
} catch {
    Write-Error "Failed to retrieve Terraform outputs: $_"
    exit 1
} finally {
    Pop-Location
}

# Update frontend configuration
Write-Info "Updating frontend configuration..."
if (Test-Path $ConfigFile) {
    try {
        # Read the config file
        $ConfigContent = Get-Content $ConfigFile -Raw
        
        # Replace placeholders based on environment
        $ApiUrlPlaceholder = "YOUR_${Environment.ToUpper()}_API_URL"
        $ClientIdPlaceholder = "YOUR_${Environment.ToUpper()}_GOOGLE_CLIENT_ID"
        
        $ConfigContent = $ConfigContent -replace $ApiUrlPlaceholder, $ApiUrl
        $ConfigContent = $ConfigContent -replace $ClientIdPlaceholder, $GoogleClientId
        
        # Write back to file
        Set-Content -Path $ConfigFile -Value $ConfigContent -NoNewline
        Write-Success "Frontend configuration updated"
    } catch {
        Write-Error "Failed to update frontend configuration: $_"
        exit 1
    }
} else {
    Write-Error "Config file not found at $ConfigFile"
    exit 1
}

# Deploy frontend to S3
Write-Info "Deploying frontend to S3..."
try {
    aws s3 sync $FrontendDir "s3://$S3Bucket/" --exclude "*.test.js" --exclude "*.md" --exclude ".git/*" --exclude "node_modules/*" --exclude "package*.json" --region $AwsRegion --delete
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Frontend deployed to S3"
    } else {
        Write-Error "Frontend deployment to S3 failed"
        exit 1
    }
} catch {
    Write-Error "Frontend deployment failed: $_"
    exit 1
}

# Invalidate CloudFront cache
Write-Info "Invalidating CloudFront cache..."
try {
    $InvalidationId = aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" --region $AwsRegion --query 'Invalidation.Id' --output text 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "CloudFront cache invalidation created: $InvalidationId"
        Write-Info "Cache invalidation may take a few minutes to complete"
    } else {
        Write-Warning "Failed to create CloudFront cache invalidation"
    }
} catch {
    Write-Warning "CloudFront invalidation failed: $_"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Success "FRONTEND DEPLOYMENT COMPLETE"
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend URL: $CloudFrontUrl" -ForegroundColor Green
Write-Host ""
Write-Info "Next Steps:"
Write-Host "  1. Update Google OAuth redirect URIs to include: $CloudFrontUrl" -ForegroundColor Yellow
Write-Host "  2. Test the application at: $CloudFrontUrl" -ForegroundColor Yellow
Write-Host ""