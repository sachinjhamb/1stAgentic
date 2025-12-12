# Terraform Deployment Script for Todo App
# This script deploys the Todo application using Terraform

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment,
    
    [Parameter(Mandatory=$true)]
    [string]$GoogleClientId,
    
    [string]$AwsRegion = "us-east-1",
    [switch]$AutoApprove,
    [switch]$Destroy,
    [switch]$Plan,
    [switch]$Help
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Color functions
function Write-Info { param([string]$Message); Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param([string]$Message); Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message); Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message); Write-Host "[ERROR] $Message" -ForegroundColor Red }

# Show help if requested
if ($Help) {
    Write-Host @"
Terraform Deployment Script for Todo App

Usage: .\deploy.ps1 -Environment <env> -GoogleClientId <client-id> [options]

Parameters:
  -Environment      Environment to deploy (dev, staging, prod) [Required]
  -GoogleClientId   Google OAuth Client ID [Required]
  -AwsRegion        AWS Region (default: us-east-1)
  -AutoApprove      Skip interactive approval of Terraform plan
  -Destroy          Destroy infrastructure instead of creating it (use cleanup.ps1 for safer cleanup)
  -Plan             Only show Terraform plan, don't apply
  -Help             Display this help message

Examples:
  .\deploy.ps1 -Environment dev -GoogleClientId "123456789-abc.apps.googleusercontent.com"
  .\deploy.ps1 -Environment dev -GoogleClientId "123456789-abc.apps.googleusercontent.com" -AutoApprove
  .\deploy.ps1 -Environment dev -GoogleClientId "123456789-abc.apps.googleusercontent.com" -Plan
  .\deploy.ps1 -Environment dev -GoogleClientId "123456789-abc.apps.googleusercontent.com" -Destroy

Prerequisites:
  - Terraform installed and in PATH
  - AWS CLI configured with appropriate credentials
  - Node.js installed (for Lambda packaging)
"@
    exit 0
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "TERRAFORM TODO APP DEPLOYMENT" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory and paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$LambdaDir = Join-Path $BackendDir "lambda"
$LambdaZip = Join-Path $ScriptDir "lambda-functions.zip"

Write-Info "Deployment Configuration:"
Write-Host "  Environment: $Environment"
Write-Host "  AWS Region: $AwsRegion"
Write-Host "  Google Client ID: $($GoogleClientId.Substring(0, [Math]::Min(20, $GoogleClientId.Length)))..."
Write-Host "  Project Root: $ProjectRoot"
Write-Host ""

# Check prerequisites
Write-Info "Checking prerequisites..."

# Check Terraform
try {
    $TerraformVersion = terraform version
    if ($LASTEXITCODE -ne 0) { throw "Terraform not found" }
    Write-Success "Terraform is available"
} catch {
    Write-Error "Terraform is not installed or not in PATH. Please install Terraform first."
    exit 1
}

# Check AWS CLI
try {
    $null = aws --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI not found" }
    Write-Success "AWS CLI is available"
} catch {
    Write-Error "AWS CLI is not installed or not in PATH"
    exit 1
}

# Check AWS credentials
try {
    $null = aws sts get-caller-identity 2>$null
    if ($LASTEXITCODE -ne 0) { throw "AWS credentials not configured" }
    Write-Success "AWS credentials are configured"
} catch {
    Write-Error "AWS credentials are not configured. Run 'aws configure' first."
    exit 1
}

# Package Lambda functions if not destroying
if (-not $Destroy) {
    Write-Info "Packaging Lambda functions..."
    
    # Create temp directory
    $TempDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
    
    try {
        # Copy Lambda files
        if (Test-Path $LambdaDir) {
            Copy-Item -Path "$LambdaDir\*" -Destination $TempDir -Recurse -Force
            Write-Success "Lambda files copied"
        } else {
            Write-Error "Lambda directory not found: $LambdaDir"
            exit 1
        }
        
        # Install dependencies if package.json exists
        $PackageJson = Join-Path $BackendDir "package.json"
        if (Test-Path $PackageJson) {
            Write-Info "Installing Lambda dependencies..."
            Copy-Item -Path $PackageJson -Destination $TempDir -Force
            
            $PackageLock = Join-Path $BackendDir "package-lock.json"
            if (Test-Path $PackageLock) {
                Copy-Item -Path $PackageLock -Destination $TempDir -Force
            }
            
            Push-Location $TempDir
            try {
                npm install --production --silent 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Dependencies installed"
                } else {
                    Write-Warning "npm install failed, continuing without dependencies"
                }
            } finally {
                Pop-Location
            }
        }
        
        # Create zip file
        if (Test-Path $LambdaZip) {
            Remove-Item $LambdaZip -Force
        }
        
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::CreateFromDirectory($TempDir, $LambdaZip)
        
        $ZipSize = [math]::Round((Get-Item $LambdaZip).Length / 1MB, 2)
        Write-Success "Lambda package created ($ZipSize MB)"
        
    } catch {
        Write-Error "Failed to create Lambda package: $_"
        exit 1
    } finally {
        if (Test-Path $TempDir) {
            Remove-Item $TempDir -Recurse -Force
        }
    }
}

# Initialize Terraform
Write-Info "Initializing Terraform..."
Push-Location $ScriptDir
try {
    terraform init
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Terraform initialization failed"
        exit 1
    }
    Write-Success "Terraform initialized"
} finally {
    Pop-Location
}

# Create terraform.tfvars file
$TfVarsFile = Join-Path $ScriptDir "terraform.tfvars"
$TfVarsContent = @"
environment      = "$Environment"
google_client_id = "$GoogleClientId"
aws_region       = "$AwsRegion"
lambda_zip_path  = "lambda-functions.zip"
frontend_path    = "$FrontendDir"
"@

Set-Content -Path $TfVarsFile -Value $TfVarsContent
Write-Success "Terraform variables file created"

# Run Terraform
Push-Location $ScriptDir
try {
    if ($Destroy) {
        Write-Warning "DESTROYING INFRASTRUCTURE..."
        Write-Host "This will permanently delete all resources!" -ForegroundColor Red
        
        if (-not $AutoApprove) {
            $Confirmation = Read-Host "Type 'DESTROY' to confirm"
            if ($Confirmation -ne "DESTROY") {
                Write-Info "Destruction cancelled"
                exit 0
            }
        }
        
        if ($AutoApprove) {
            terraform destroy -auto-approve
        } else {
            terraform destroy
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Infrastructure destroyed successfully"
        } else {
            Write-Error "Terraform destroy failed"
            exit 1
        }
    } elseif ($Plan) {
        Write-Info "Generating Terraform plan..."
        terraform plan
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Terraform plan generated successfully"
        } else {
            Write-Error "Terraform plan failed"
            exit 1
        }
    } else {
        Write-Info "Applying Terraform configuration..."
        Write-Warning "This may take several minutes..."
        
        if ($AutoApprove) {
            terraform apply -auto-approve
        } else {
            terraform apply
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Terraform apply completed successfully"
            
            # Get outputs
            Write-Info "Retrieving deployment outputs..."
            $Outputs = terraform output -json | ConvertFrom-Json
            
            Write-Host ""
            Write-Host "==========================================" -ForegroundColor Green
            Write-Success "DEPLOYMENT COMPLETE"
            Write-Host "==========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Frontend URL:      $($Outputs.cloudfront_url.value)" -ForegroundColor Green
            Write-Host "API URL:           $($Outputs.api_gateway_url.value)" -ForegroundColor Green
            Write-Host "S3 Bucket:         $($Outputs.s3_bucket_name.value)"
            Write-Host "DynamoDB Table:    $($Outputs.dynamodb_table_name.value)"
            Write-Host "Distribution ID:   $($Outputs.cloudfront_distribution_id.value)"
            Write-Host ""
            Write-Info "Next Steps:"
            Write-Host "  1. Update Google OAuth redirect URIs to include: $($Outputs.cloudfront_url.value)" -ForegroundColor Yellow
            Write-Host "  2. Deploy frontend files to S3 bucket" -ForegroundColor Yellow
            Write-Host "  3. Test the application at: $($Outputs.cloudfront_url.value)" -ForegroundColor Yellow
            Write-Host ""
        } else {
            Write-Error "Terraform apply failed"
            exit 1
        }
    }
} finally {
    Pop-Location
}

# Clean up
if (Test-Path $LambdaZip) {
    Remove-Item $LambdaZip -Force
}

Write-Success "Deployment script completed"