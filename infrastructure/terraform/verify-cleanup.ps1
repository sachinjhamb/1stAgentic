# Terraform Cleanup Verification Script
# This script verifies that all AWS resources have been properly deleted

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment,
    
    [string]$AwsRegion = "us-east-1"
)

# Color functions
function Write-Info { param([string]$Message); Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param([string]$Message); Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message); Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message); Write-Host "[ERROR] $Message" -ForegroundColor Red }

Write-Host "Verifying Terraform cleanup for environment: $Environment" -ForegroundColor Cyan
Write-Host "Region: $AwsRegion" -ForegroundColor White
Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AccountId = (aws sts get-caller-identity --query Account --output text 2>$null)

# Check AWS CLI
try {
    $null = aws --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI not found" }
} catch {
    Write-Error "AWS CLI is not installed or not in PATH"
    exit 1
}

$ResourcesFound = @()
$AllClean = $true

# Check Terraform state
Write-Info "Checking Terraform state..."
Push-Location $ScriptDir
try {
    if (Test-Path ".terraform") {
        $StateList = terraform state list 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($StateList)) {
            Write-Warning "Terraform state still contains resources:"
            $StateList -split "`n" | ForEach-Object {
                if ($_.Trim()) {
                    Write-Host "  - $_" -ForegroundColor Yellow
                    $ResourcesFound += "Terraform State: $_"
                }
            }
            $AllClean = $false
        } else {
            Write-Success "Terraform state is empty or not found"
        }
    } else {
        Write-Success "No Terraform directory found (clean)"
    }
} catch {
    Write-Success "No Terraform state found (clean)"
} finally {
    Pop-Location
}

# Check for Lambda functions
Write-Info "Checking Lambda functions..."
$LambdaFunctions = @("getTasks-$Environment", "createTask-$Environment", "updateTask-$Environment", "deleteTask-$Environment", "syncTasks-$Environment")
$FoundFunctions = 0

foreach ($FunctionName in $LambdaFunctions) {
    try {
        $FunctionInfo = aws lambda get-function --function-name $FunctionName --region $AwsRegion 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Warning "Lambda function still exists: $FunctionName"
            $ResourcesFound += "Lambda Function: $FunctionName"
            $AllClean = $false
            $FoundFunctions++
        }
    } catch {
        # Function doesn't exist, which is good
    }
}

if ($FoundFunctions -eq 0) {
    Write-Success "No Lambda functions found (all deleted)"
}

# Check for S3 bucket
Write-Info "Checking S3 bucket..."
$BucketName = "todo-app-frontend-$Environment-$AccountId"
try {
    $BucketExists = aws s3api head-bucket --bucket $BucketName --region $AwsRegion 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "S3 bucket still exists: $BucketName"
        $ResourcesFound += "S3 Bucket: $BucketName"
        $AllClean = $false
        
        # Check if bucket has objects
        $ObjectCount = aws s3api list-objects-v2 --bucket $BucketName --region $AwsRegion --query 'length(Contents)' --output text 2>$null
        if ($ObjectCount -and $ObjectCount -ne "0" -and $ObjectCount -ne "None") {
            Write-Warning "  Bucket contains $ObjectCount objects"
        }
    } else {
        Write-Success "S3 bucket not found (deleted)"
    }
} catch {
    Write-Success "S3 bucket not found (deleted)"
}

# Check for DynamoDB table
Write-Info "Checking DynamoDB table..."
$TableName = "TodoTasks-$Environment"
try {
    $TableInfo = aws dynamodb describe-table --table-name $TableName --region $AwsRegion 2>$null
    if ($LASTEXITCODE -eq 0) {
        $Table = $TableInfo | ConvertFrom-Json
        $TableStatus = $Table.Table.TableStatus
        Write-Warning "DynamoDB table still exists: $TableName ($TableStatus)"
        $ResourcesFound += "DynamoDB Table: $TableName ($TableStatus)"
        $AllClean = $false
    } else {
        Write-Success "DynamoDB table not found (deleted)"
    }
} catch {
    Write-Success "DynamoDB table not found (deleted)"
}

# Check for API Gateway
Write-Info "Checking API Gateway..."
try {
    $ApiName = "todo-api-$Environment"
    $Apis = aws apigateway get-rest-apis --region $AwsRegion --query "items[?name=='$ApiName'].id" --output text 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($Apis)) {
        Write-Warning "API Gateway still exists: $ApiName"
        $ResourcesFound += "API Gateway: $ApiName"
        $AllClean = $false
    } else {
        Write-Success "API Gateway not found (deleted)"
    }
} catch {
    Write-Success "API Gateway not found (deleted)"
}

# Check for CloudFront distribution
Write-Info "Checking CloudFront distributions..."
try {
    $Distributions = aws cloudfront list-distributions --region $AwsRegion --query "DistributionList.Items[?Comment=='Todo App CDN - $Environment'].Id" --output text 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($Distributions)) {
        $DistributionIds = $Distributions -split "`t"
        foreach ($DistId in $DistributionIds) {
            if ($DistId.Trim()) {
                Write-Warning "CloudFront distribution still exists: $($DistId.Trim())"
                $ResourcesFound += "CloudFront Distribution: $($DistId.Trim())"
                $AllClean = $false
            }
        }
    } else {
        Write-Success "No CloudFront distributions found (deleted)"
    }
} catch {
    Write-Success "No CloudFront distributions found (deleted)"
}

# Check for CloudWatch Log Groups
Write-Info "Checking CloudWatch Log Groups..."
$LogGroups = @("/aws/lambda/getTasks-$Environment", "/aws/lambda/createTask-$Environment", "/aws/lambda/updateTask-$Environment", "/aws/lambda/deleteTask-$Environment", "/aws/lambda/syncTasks-$Environment")
$FoundLogGroups = 0

foreach ($LogGroup in $LogGroups) {
    try {
        $LogGroupInfo = aws logs describe-log-groups --log-group-name-prefix $LogGroup --region $AwsRegion --query "logGroups[?logGroupName=='$LogGroup']" --output text 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($LogGroupInfo)) {
            Write-Warning "CloudWatch Log Group still exists: $LogGroup"
            $ResourcesFound += "CloudWatch Log Group: $LogGroup"
            $AllClean = $false
            $FoundLogGroups++
        }
    } catch {
        # Log group doesn't exist, which is good
    }
}

if ($FoundLogGroups -eq 0) {
    Write-Success "No CloudWatch Log Groups found (all deleted)"
}

# Check for IAM role
Write-Info "Checking IAM role..."
$RoleName = "todo-app-lambda-role-$Environment"
try {
    $RoleInfo = aws iam get-role --role-name $RoleName --region $AwsRegion 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "IAM role still exists: $RoleName"
        $ResourcesFound += "IAM Role: $RoleName"
        $AllClean = $false
    } else {
        Write-Success "IAM role not found (deleted)"
    }
} catch {
    Write-Success "IAM role not found (deleted)"
}

# Check local Terraform files
Write-Info "Checking local Terraform files..."
Push-Location $ScriptDir
try {
    $LocalFiles = @("terraform.tfvars", "lambda-functions.zip", "lambda-placeholder.zip", "destroy.tfvars")
    $FoundLocalFiles = 0
    
    foreach ($file in $LocalFiles) {
        if (Test-Path $file) {
            Write-Warning "Local file still exists: $file"
            $FoundLocalFiles++
        }
    }
    
    if ($FoundLocalFiles -eq 0) {
        Write-Success "No temporary local files found (clean)"
    }
} finally {
    Pop-Location
}

# Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "TERRAFORM CLEANUP VERIFICATION RESULTS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if ($AllClean) {
    Write-Success "✓ ALL RESOURCES SUCCESSFULLY DELETED"
    Write-Host "Environment '$Environment' has been completely cleaned up." -ForegroundColor Green
} else {
    Write-Warning "⚠ SOME RESOURCES STILL EXIST"
    Write-Host "The following resources were found:" -ForegroundColor Yellow
    foreach ($Resource in $ResourcesFound) {
        Write-Host "  - $Resource" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "These resources may still be in the process of being deleted," -ForegroundColor Yellow
    Write-Host "or there may have been an error during cleanup." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You can:" -ForegroundColor Yellow
    Write-Host "  1. Wait a few minutes and run this verification again" -ForegroundColor Yellow
    Write-Host "  2. Check the AWS Console for more details" -ForegroundColor Yellow
    Write-Host "  3. Run 'terraform destroy' manually if needed" -ForegroundColor Yellow
    Write-Host "  4. Manually delete remaining resources if necessary" -ForegroundColor Yellow
}

Write-Host ""