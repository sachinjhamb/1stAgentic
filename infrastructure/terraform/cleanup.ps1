# Terraform Todo App Cleanup Script (PowerShell)
# This script safely deletes all AWS resources created by Terraform deployment

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment,
    
    [string]$AwsRegion = "us-east-1",
    [switch]$Force,
    [switch]$DryRun,
    [switch]$Help
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Color functions
function Write-Info { param([string]$Message); Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param([string]$Message); Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message); Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message); Write-Host "[ERROR] $Message" -ForegroundColor Red }
function Write-DryRun { param([string]$Message); Write-Host "[DRY-RUN] $Message" -ForegroundColor Cyan }

# Show help if requested
if ($Help) {
    Write-Host @"
Terraform AWS Resource Cleanup Script

Usage: .\cleanup.ps1 -Environment <env> [-AwsRegion <region>] [-Force] [-DryRun]

Parameters:
  -Environment      Environment to clean up (dev, staging, prod) [Required]
  -AwsRegion        AWS Region (default: us-east-1)
  -Force            Skip confirmation prompts
  -DryRun           Show what would be deleted without actually deleting
  -Help             Display this help message

Examples:
  .\cleanup.ps1 -Environment dev -DryRun
  .\cleanup.ps1 -Environment dev -Force
  .\cleanup.ps1 -Environment staging -AwsRegion us-west-2

WARNING: This will permanently delete all resources for the specified environment!
"@
    exit 0
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Red
Write-Host "TERRAFORM RESOURCE CLEANUP" -ForegroundColor Red
Write-Host "==========================================" -ForegroundColor Red
Write-Host ""
Write-Warning "This will DELETE all AWS resources for:"
Write-Host "  Environment: $Environment" -ForegroundColor Yellow
Write-Host "  AWS Region: $AwsRegion" -ForegroundColor Yellow
if ($DryRun) {
    Write-Host "  Mode: DRY RUN (no actual deletion)" -ForegroundColor Cyan
}
Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check prerequisites
Write-Info "Checking prerequisites..."

# Check Terraform
try {
    $null = terraform version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Terraform not found" }
    Write-Success "Terraform is available"
} catch {
    Write-Error "Terraform is not installed or not in PATH"
    exit 1
}

# Check AWS CLI
try {
    $null = aws --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI not found" }
} catch {
    Write-Error "AWS CLI is not installed or not in PATH"
    exit 1
}

# Check AWS credentials
Write-Info "Checking AWS credentials..."
try {
    $CallerIdentity = aws sts get-caller-identity 2>$null | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "AWS credentials not configured" }
    Write-Success "Connected to AWS Account: $($CallerIdentity.Account)"
} catch {
    Write-Error "AWS credentials are not configured. Run 'aws configure' first."
    exit 1
}

# Check if Terraform state exists
Push-Location $ScriptDir
try {
    Write-Info "Checking Terraform state..."
    
    # Initialize Terraform if needed
    if (-not (Test-Path ".terraform")) {
        Write-Info "Initializing Terraform..."
        terraform init -input=false
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Terraform initialization failed"
            exit 1
        }
    }
    
    # Check if state file exists and has resources
    $StateList = terraform state list 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($StateList)) {
        Write-Warning "No Terraform state found or state is empty"
        Write-Info "Nothing to clean up."
        exit 0
    }
    
    Write-Success "Found Terraform state with resources"
    
    # Get current outputs if available
    Write-Info "Retrieving current resource information..."
    try {
        $OutputsJson = terraform output -json 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($OutputsJson)) {
            $Outputs = $OutputsJson | ConvertFrom-Json
            
            Write-Info "Current resources:"
            if ($Outputs.s3_bucket_name -and $Outputs.s3_bucket_name.value) {
                Write-Host "  S3 Bucket: $($Outputs.s3_bucket_name.value)"
            }
            if ($Outputs.cloudfront_distribution_id -and $Outputs.cloudfront_distribution_id.value) {
                Write-Host "  CloudFront Distribution: $($Outputs.cloudfront_distribution_id.value)"
            }
            if ($Outputs.dynamodb_table_name -and $Outputs.dynamodb_table_name.value) {
                Write-Host "  DynamoDB Table: $($Outputs.dynamodb_table_name.value)"
            }
            if ($Outputs.lambda_function_names -and $Outputs.lambda_function_names.value) {
                $LambdaFunctions = $Outputs.lambda_function_names.value
                foreach ($func in $LambdaFunctions.PSObject.Properties) {
                    Write-Host "  Lambda Function: $($func.Value)"
                }
            }
            Write-Host ""
        }
    } catch {
        Write-Warning "Could not retrieve resource information, but state exists"
    }
    
} catch {
    Write-Error "Failed to check Terraform state: $_"
    exit 1
} finally {
    Pop-Location
}

# Function to empty S3 bucket before destruction
function Clear-S3BucketIfExists {
    param([string]$BucketName, [string]$Region, [bool]$DryRun)
    
    if ([string]::IsNullOrEmpty($BucketName)) {
        return
    }
    
    Write-Info "Checking S3 bucket: $BucketName"
    
    # Check if bucket exists
    try {
        $BucketExists = aws s3api head-bucket --bucket $BucketName --region $Region 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Info "S3 bucket $BucketName does not exist or is not accessible"
            return
        }
    } catch {
        Write-Info "Cannot access S3 bucket $BucketName"
        return
    }
    
    # List objects in bucket
    try {
        $Objects = aws s3api list-objects-v2 --bucket $BucketName --region $Region --query 'Contents[].Key' --output text 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($Objects)) {
            $ObjectCount = ($Objects -split "`t").Count
            Write-Warning "Found $ObjectCount objects in S3 bucket"
            
            if ($DryRun) {
                Write-DryRun "Would empty S3 bucket: $BucketName"
            } else {
                Write-Info "Emptying S3 bucket: $BucketName"
                aws s3 rm "s3://$BucketName" --recursive --region $Region
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "S3 bucket emptied"
                } else {
                    Write-Warning "Failed to empty S3 bucket"
                }
            }
        } else {
            Write-Info "S3 bucket is already empty"
        }
    } catch {
        Write-Warning "Failed to list S3 bucket contents"
    }
}

# Pre-cleanup: Empty S3 bucket if it exists
Push-Location $ScriptDir
try {
    # Try to get S3 bucket name from outputs
    $OutputsJson = terraform output -json 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($OutputsJson)) {
        $Outputs = $OutputsJson | ConvertFrom-Json
        if ($Outputs.s3_bucket_name -and $Outputs.s3_bucket_name.value) {
            Clear-S3BucketIfExists -BucketName $Outputs.s3_bucket_name.value -Region $AwsRegion -DryRun $DryRun
        }
    }
} catch {
    Write-Warning "Could not check S3 bucket status"
} finally {
    Pop-Location
}

# Confirmation prompt (unless Force or DryRun)
if (-not $Force -and -not $DryRun) {
    Write-Host ""
    Write-Warning "This will PERMANENTLY DELETE all Terraform-managed resources!"
    Write-Host "Resources to be destroyed:" -ForegroundColor Red
    
    Push-Location $ScriptDir
    try {
        # Show what would be destroyed
        terraform plan -destroy -input=false -var="environment=$Environment" -var="google_client_id=placeholder" -var="aws_region=$AwsRegion" 2>$null
    } catch {
        Write-Warning "Could not generate destroy plan preview"
    } finally {
        Pop-Location
    }
    
    Write-Host ""
    Write-Host "Type 'DESTROY' to confirm, or anything else to cancel: " -NoNewline -ForegroundColor Red
    $Confirmation = Read-Host
    
    if ($Confirmation -ne "DESTROY") {
        Write-Info "Cleanup cancelled by user"
        exit 0
    }
    Write-Host ""
}

# Execute Terraform destroy
Push-Location $ScriptDir
try {
    if ($DryRun) {
        Write-DryRun "Would run: terraform destroy"
        Write-DryRun "This would delete all Terraform-managed resources:"
        Write-DryRun "  - Lambda functions (getTasks, createTask, updateTask, deleteTask, syncTasks)"
        Write-DryRun "  - API Gateway REST API"
        Write-DryRun "  - CloudWatch Log Groups"
        Write-DryRun "  - IAM Role for Lambda execution"
        Write-DryRun "  - S3 bucket (after emptying)"
        Write-DryRun "  - CloudFront distribution"
        Write-DryRun "  - DynamoDB table"
    } else {
        Write-Info "Destroying Terraform-managed infrastructure..."
        Write-Warning "This may take several minutes..."
        
        # Create a minimal tfvars for destroy operation
        $TempTfVars = @"
environment      = "$Environment"
google_client_id = "placeholder-for-destroy"
aws_region       = "$AwsRegion"
"@
        $TempTfVarsFile = "destroy.tfvars"
        Set-Content -Path $TempTfVarsFile -Value $TempTfVars
        
        try {
            terraform destroy -auto-approve -var-file="$TempTfVarsFile"
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Terraform destroy completed successfully"
            } else {
                Write-Error "Terraform destroy failed"
                exit 1
            }
        } finally {
            # Clean up temp file
            if (Test-Path $TempTfVarsFile) {
                Remove-Item $TempTfVarsFile -Force
            }
        }
    }
} catch {
    Write-Error "Terraform destroy failed: $_"
    exit 1
} finally {
    Pop-Location
}

# Clean up local files
Write-Info "Cleaning up local files..."
Push-Location $ScriptDir
try {
    $FilesToClean = @(
        "lambda-functions.zip",
        "lambda-placeholder.zip",
        "terraform.tfvars"
    )
    
    foreach ($file in $FilesToClean) {
        if (Test-Path $file) {
            if ($DryRun) {
                Write-DryRun "Would remove local file: $file"
            } else {
                Remove-Item $file -Force
                Write-Info "Removed local file: $file"
            }
        }
    }
} catch {
    Write-Warning "Failed to clean up some local files"
} finally {
    Pop-Location
}

# Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
if ($DryRun) {
    Write-Success "DRY RUN COMPLETE"
    Write-Host "No resources were actually deleted." -ForegroundColor Cyan
    Write-Host "Run without -DryRun to perform actual cleanup." -ForegroundColor Yellow
} else {
    Write-Success "CLEANUP COMPLETE"
    Write-Host "All Terraform-managed resources for environment '$Environment' have been deleted." -ForegroundColor Green
}
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""