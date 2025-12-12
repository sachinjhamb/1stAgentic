# Quick Fix for Authentication Issues
# This script manually updates the configuration and redeploys the frontend

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment,
    
    [Parameter(Mandatory=$true)]
    [string]$GoogleClientId,
    
    [string]$AwsRegion = "us-east-1",
    [string]$ApiUrl = "",
    [string]$S3Bucket = "",
    [string]$DistributionId = ""
)

# Color functions
function Write-Info { param([string]$Message); Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param([string]$Message); Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message); Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message); Write-Host "[ERROR] $Message" -ForegroundColor Red }

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "AUTHENTICATION QUICK FIX" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory and paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$ConfigFile = Join-Path $ProjectRoot "frontend\config.js"

Write-Info "Environment: $Environment"
Write-Info "Google Client ID: $($GoogleClientId.Substring(0, [Math]::Min(20, $GoogleClientId.Length)))..."
Write-Host ""

# Step 1: Auto-detect deployment outputs if not provided
if ([string]::IsNullOrEmpty($ApiUrl) -or [string]::IsNullOrEmpty($S3Bucket) -or [string]::IsNullOrEmpty($DistributionId)) {
    Write-Info "Auto-detecting deployment outputs..."
    
    # Try CloudFormation first
    $StackName = "todo-app-$Environment"
    try {
        if ([string]::IsNullOrEmpty($ApiUrl)) {
            $ApiUrl = aws cloudformation describe-stacks --stack-name $StackName --region $AwsRegion --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" --output text 2>$null
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($ApiUrl)) {
                Write-Success "Found API URL from CloudFormation: $ApiUrl"
            }
        }
        
        if ([string]::IsNullOrEmpty($S3Bucket)) {
            $S3Bucket = aws cloudformation describe-stacks --stack-name $StackName --region $AwsRegion --query "Stacks[0].Outputs[?OutputKey=='S3BucketName'].OutputValue" --output text 2>$null
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($S3Bucket)) {
                Write-Success "Found S3 bucket from CloudFormation: $S3Bucket"
            }
        }
        
        if ([string]::IsNullOrEmpty($DistributionId)) {
            $DistributionId = aws cloudformation describe-stacks --stack-name $StackName --region $AwsRegion --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text 2>$null
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($DistributionId)) {
                Write-Success "Found Distribution ID from CloudFormation: $DistributionId"
            }
        }
    } catch {
        Write-Info "CloudFormation stack not found, trying Terraform..."
    }
    
    # Try Terraform if CloudFormation didn't work
    $TerraformDir = Join-Path $ScriptDir "terraform"
    if (Test-Path $TerraformDir) {
        Push-Location $TerraformDir
        try {
            $TerraformOutputs = terraform output -json 2>$null
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($TerraformOutputs)) {
                $Outputs = $TerraformOutputs | ConvertFrom-Json
                
                if ([string]::IsNullOrEmpty($ApiUrl) -and $Outputs.api_gateway_url -and $Outputs.api_gateway_url.value) {
                    $ApiUrl = $Outputs.api_gateway_url.value
                    Write-Success "Found API URL from Terraform: $ApiUrl"
                }
                
                if ([string]::IsNullOrEmpty($S3Bucket) -and $Outputs.s3_bucket_name -and $Outputs.s3_bucket_name.value) {
                    $S3Bucket = $Outputs.s3_bucket_name.value
                    Write-Success "Found S3 bucket from Terraform: $S3Bucket"
                }
                
                if ([string]::IsNullOrEmpty($DistributionId) -and $Outputs.cloudfront_distribution_id -and $Outputs.cloudfront_distribution_id.value) {
                    $DistributionId = $Outputs.cloudfront_distribution_id.value
                    Write-Success "Found Distribution ID from Terraform: $DistributionId"
                }
            }
        } catch {
            Write-Warning "Could not retrieve Terraform outputs"
        } finally {
            Pop-Location
        }
    }
}

# Validate we have what we need
if ([string]::IsNullOrEmpty($ApiUrl)) {
    Write-Error "Could not determine API Gateway URL. Please provide it manually with -ApiUrl parameter"
    exit 1
}

if ([string]::IsNullOrEmpty($S3Bucket)) {
    Write-Error "Could not determine S3 bucket name. Please provide it manually with -S3Bucket parameter"
    exit 1
}

Write-Host ""

# Step 2: Update configuration file
Write-Info "Updating frontend configuration..."

if (-not (Test-Path $ConfigFile)) {
    Write-Error "Config file not found: $ConfigFile"
    exit 1
}

try {
    # Read the config file
    $ConfigContent = Get-Content $ConfigFile -Raw
    
    # Create backup
    $BackupFile = "$ConfigFile.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $ConfigFile $BackupFile
    Write-Info "Created backup: $BackupFile"
    
    # Replace placeholders for ALL environments (since CloudFront URLs are detected as production)
    $Environments = @("DEV", "STAGING", "PROD")
    
    foreach ($Env in $Environments) {
        $ApiUrlPlaceholder = "YOUR_${Env}_API_URL"
        $ClientIdPlaceholder = "YOUR_${Env}_GOOGLE_CLIENT_ID"
        
        $ConfigContent = $ConfigContent -replace $ApiUrlPlaceholder, $ApiUrl
        $ConfigContent = $ConfigContent -replace $ClientIdPlaceholder, $GoogleClientId
    }
    
    # Also update the specific environment
    $EnvUpper = $Environment.ToUpper()
    $ApiUrlPlaceholder = "YOUR_${EnvUpper}_API_URL"
    $ClientIdPlaceholder = "YOUR_${EnvUpper}_GOOGLE_CLIENT_ID"
    
    $ConfigContent = $ConfigContent -replace $ApiUrlPlaceholder, $ApiUrl
    $ConfigContent = $ConfigContent -replace $ClientIdPlaceholder, $GoogleClientId
    
    # Write back to file
    Set-Content -Path $ConfigFile -Value $ConfigContent -NoNewline
    Write-Success "Configuration updated successfully"
    
    # Show what was updated
    Write-Host "Updated values:" -ForegroundColor Green
    Write-Host "  API URL: $ApiUrl" -ForegroundColor Green
    Write-Host "  Google Client ID: $($GoogleClientId.Substring(0, [Math]::Min(20, $GoogleClientId.Length)))..." -ForegroundColor Green
    
} catch {
    Write-Error "Failed to update configuration: $_"
    exit 1
}

Write-Host ""

# Step 3: Deploy to S3
Write-Info "Deploying updated frontend to S3..."
try {
    $FrontendDir = Join-Path $ProjectRoot "frontend"
    aws s3 sync $FrontendDir "s3://$S3Bucket/" --exclude "*.test.js" --exclude "*.md" --exclude ".git/*" --exclude "node_modules/*" --exclude "package*.json" --region $AwsRegion --delete
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Frontend deployed to S3 successfully"
    } else {
        Write-Error "Frontend deployment to S3 failed"
        exit 1
    }
} catch {
    Write-Error "Frontend deployment failed: $_"
    exit 1
}

# Step 4: Invalidate CloudFront cache (if we have distribution ID)
if (-not [string]::IsNullOrEmpty($DistributionId)) {
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
} else {
    Write-Warning "No CloudFront distribution ID provided - cache not invalidated"
    Write-Info "You may need to wait for cache to expire or manually invalidate"
}

Write-Host ""

# Step 5: Test configuration syntax locally (optional)
Write-Info "Testing configuration syntax..."
$TestFile = Join-Path $ScriptDir "test-config-syntax.html"
if (Test-Path $TestFile) {
    Write-Host "You can test the configuration locally by opening:" -ForegroundColor Cyan
    Write-Host "  $TestFile" -ForegroundColor Cyan
    Write-Host "in your browser to verify there are no syntax errors." -ForegroundColor Cyan
    Write-Host ""
}

# Step 6: Provide testing instructions
Write-Host "==========================================" -ForegroundColor Green
Write-Success "AUTHENTICATION FIX COMPLETE"
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

Write-Info "Next steps:"
Write-Host "1. Wait 2-3 minutes for CloudFront cache invalidation" -ForegroundColor Yellow
Write-Host "2. Visit your CloudFront URL in a new browser tab/incognito window" -ForegroundColor Yellow
Write-Host "3. Open Developer Tools (F12) and check the Console tab for errors" -ForegroundColor Yellow
Write-Host "4. Type: window.APP_CONFIG" -ForegroundColor Yellow
Write-Host "5. Verify it shows your Google Client ID and API URL (not placeholders)" -ForegroundColor Yellow
Write-Host ""

Write-Warning "IMPORTANT: Make sure your Google OAuth settings include:"
Write-Host "- Authorized JavaScript origins: https://your-cloudfront-domain" -ForegroundColor Yellow
Write-Host "- Authorized redirect URIs: https://your-cloudfront-domain/" -ForegroundColor Yellow
Write-Host ""

Write-Info "If authentication still doesn't work, run:"
Write-Host ".\debug-config.ps1 -Environment $Environment" -ForegroundColor Cyan