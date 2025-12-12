# Cleanup Verification Script
# This script verifies that all AWS resources have been properly deleted

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment,
    
    [string]$AwsRegion = "us-east-1",
    [string]$StackName = ""
)

# Color functions
function Write-Info { param([string]$Message); Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param([string]$Message); Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message); Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message); Write-Host "[ERROR] $Message" -ForegroundColor Red }

# Set default stack name
if ([string]::IsNullOrEmpty($StackName)) {
    $StackName = "todo-app-$Environment"
}

Write-Host "Verifying cleanup for environment: $Environment" -ForegroundColor Cyan
Write-Host "Stack Name: $StackName" -ForegroundColor White
Write-Host "Region: $AwsRegion" -ForegroundColor White
Write-Host ""

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

# Check CloudFormation stack
Write-Info "Checking CloudFormation stack..."
try {
    $StackInfo = aws cloudformation describe-stacks --stack-name $StackName --region $AwsRegion 2>$null
    if ($LASTEXITCODE -eq 0) {
        $Stack = $StackInfo | ConvertFrom-Json
        $StackStatus = $Stack.Stacks[0].StackStatus
        Write-Warning "CloudFormation stack still exists with status: $StackStatus"
        $ResourcesFound += "CloudFormation Stack: $StackName ($StackStatus)"
        $AllClean = $false
    } else {
        Write-Success "CloudFormation stack not found (deleted)"
    }
} catch {
    Write-Success "CloudFormation stack not found (deleted)"
}

# Check for Lambda functions
Write-Info "Checking Lambda functions..."
$LambdaFunctions = @("getTasks-$Environment", "createTask-$Environment", "updateTask-$Environment", "deleteTask-$Environment", "syncTasks-$Environment")
foreach ($FunctionName in $LambdaFunctions) {
    try {
        $FunctionInfo = aws lambda get-function --function-name $FunctionName --region $AwsRegion 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Warning "Lambda function still exists: $FunctionName"
            $ResourcesFound += "Lambda Function: $FunctionName"
            $AllClean = $false
        }
    } catch {
        # Function doesn't exist, which is good
    }
}

if ($ResourcesFound.Count -eq 0) {
    Write-Success "No Lambda functions found (all deleted)"
}

# Check for S3 buckets with the naming pattern
Write-Info "Checking S3 buckets..."
try {
    $AccountId = (aws sts get-caller-identity --query Account --output text 2>$null)
    $BucketPattern = "todo-app-frontend-$Environment-$AccountId"
    
    $BucketExists = aws s3api head-bucket --bucket $BucketPattern --region $AwsRegion 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "S3 bucket still exists: $BucketPattern"
        $ResourcesFound += "S3 Bucket: $BucketPattern"
        $AllClean = $false
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

# Check for CloudWatch Log Groups
Write-Info "Checking CloudWatch Log Groups..."
$LogGroups = @("/aws/lambda/getTasks-$Environment", "/aws/lambda/createTask-$Environment", "/aws/lambda/updateTask-$Environment", "/aws/lambda/deleteTask-$Environment", "/aws/lambda/syncTasks-$Environment")
foreach ($LogGroup in $LogGroups) {
    try {
        $LogGroupInfo = aws logs describe-log-groups --log-group-name-prefix $LogGroup --region $AwsRegion --query "logGroups[?logGroupName=='$LogGroup']" --output text 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($LogGroupInfo)) {
            Write-Warning "CloudWatch Log Group still exists: $LogGroup"
            $ResourcesFound += "CloudWatch Log Group: $LogGroup"
            $AllClean = $false
        }
    } catch {
        # Log group doesn't exist, which is good
    }
}

if ($ResourcesFound.Count -eq 0) {
    Write-Success "No CloudWatch Log Groups found (all deleted)"
}

# Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "CLEANUP VERIFICATION RESULTS" -ForegroundColor Cyan
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
    Write-Host "  3. Manually delete remaining resources if needed" -ForegroundColor Yellow
}

Write-Host ""