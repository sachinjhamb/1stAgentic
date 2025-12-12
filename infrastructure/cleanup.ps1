# Todo App AWS Resource Cleanup Script (PowerShell)
# This script safely deletes all AWS resources created by the deployment

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment,
    
    [string]$AwsRegion = "us-east-1",
    [string]$StackName = "",
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
AWS Resource Cleanup Script

Usage: .\cleanup.ps1 -Environment <env> [-AwsRegion <region>] [-StackName <name>] [-Force] [-DryRun]

Parameters:
  -Environment      Environment to clean up (dev, staging, prod) [Required]
  -AwsRegion        AWS Region (default: us-east-1)
  -StackName        CloudFormation Stack Name (default: todo-app-<environment>)
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

# Set default stack name
if ([string]::IsNullOrEmpty($StackName)) {
    $StackName = "todo-app-$Environment"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Red
Write-Host "AWS RESOURCE CLEANUP" -ForegroundColor Red
Write-Host "==========================================" -ForegroundColor Red
Write-Host ""
Write-Warning "This will DELETE all AWS resources for:"
Write-Host "  Environment: $Environment" -ForegroundColor Yellow
Write-Host "  Stack Name: $StackName" -ForegroundColor Yellow
Write-Host "  AWS Region: $AwsRegion" -ForegroundColor Yellow
if ($DryRun) {
    Write-Host "  Mode: DRY RUN (no actual deletion)" -ForegroundColor Cyan
}
Write-Host ""

# Check AWS CLI
Write-Info "Checking AWS CLI..."
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

# Function to check if stack exists
function Test-StackExists {
    param([string]$StackName, [string]$Region)
    
    try {
        $StackInfo = aws cloudformation describe-stacks --stack-name $StackName --region $Region 2>$null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

# Function to get stack outputs
function Get-StackOutputs {
    param([string]$StackName, [string]$Region)
    
    Write-Info "Retrieving stack information..."
    
    function Get-OutputValue {
        param([string]$OutputKey)
        try {
            $Result = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[?OutputKey=='$OutputKey'].OutputValue" --output text 2>$null
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($Result)) {
                return $Result.Trim()
            }
        } catch { }
        return $null
    }
    
    return @{
        S3Bucket = Get-OutputValue "S3BucketName"
        DistributionId = Get-OutputValue "CloudFrontDistributionId"
        TableName = Get-OutputValue "DynamoDBTableName"
        ApiId = Get-OutputValue "ApiGatewayUrl"
    }
}

# Function to empty S3 bucket
function Clear-S3Bucket {
    param([string]$BucketName, [string]$Region, [bool]$DryRun)
    
    if ([string]::IsNullOrEmpty($BucketName)) {
        Write-Warning "S3 bucket name not found, skipping S3 cleanup"
        return
    }
    
    Write-Info "Checking S3 bucket: $BucketName"
    
    # Check if bucket exists
    try {
        $BucketExists = aws s3api head-bucket --bucket $BucketName --region $Region 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "S3 bucket $BucketName does not exist or is not accessible"
            return
        }
    } catch {
        Write-Warning "Cannot access S3 bucket $BucketName"
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

# Function to disable CloudFront distribution
function Disable-CloudFrontDistribution {
    param([string]$DistributionId, [string]$Region, [bool]$DryRun)
    
    if ([string]::IsNullOrEmpty($DistributionId)) {
        Write-Warning "CloudFront distribution ID not found, skipping CloudFront cleanup"
        return
    }
    
    Write-Info "Checking CloudFront distribution: $DistributionId"
    
    try {
        # Get distribution config
        $DistConfig = aws cloudfront get-distribution --id $DistributionId --region $Region 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "CloudFront distribution $DistributionId not found"
            return
        }
        
        $Config = $DistConfig | ConvertFrom-Json
        $IsEnabled = $Config.Distribution.DistributionConfig.Enabled
        
        if ($IsEnabled) {
            Write-Warning "CloudFront distribution is enabled and will be disabled by CloudFormation"
            if ($DryRun) {
                Write-DryRun "Would disable CloudFront distribution: $DistributionId"
            } else {
                Write-Info "CloudFront distribution will be disabled during stack deletion"
            }
        } else {
            Write-Info "CloudFront distribution is already disabled"
        }
    } catch {
        Write-Warning "Failed to check CloudFront distribution status"
    }
}

# Function to check DynamoDB table
function Check-DynamoDBTable {
    param([string]$TableName, [string]$Region, [bool]$DryRun)
    
    if ([string]::IsNullOrEmpty($TableName)) {
        Write-Warning "DynamoDB table name not found, skipping DynamoDB check"
        return
    }
    
    Write-Info "Checking DynamoDB table: $TableName"
    
    try {
        $TableInfo = aws dynamodb describe-table --table-name $TableName --region $Region 2>$null
        if ($LASTEXITCODE -eq 0) {
            $Table = $TableInfo | ConvertFrom-Json
            $ItemCount = $Table.Table.ItemCount
            Write-Info "DynamoDB table exists with approximately $ItemCount items"
            
            if ($DryRun) {
                Write-DryRun "Would delete DynamoDB table: $TableName (with ~$ItemCount items)"
            } else {
                Write-Warning "DynamoDB table will be deleted by CloudFormation (with ~$ItemCount items)"
            }
        } else {
            Write-Info "DynamoDB table does not exist"
        }
    } catch {
        Write-Warning "Failed to check DynamoDB table"
    }
}

# Function to delete CloudFormation stack
function Remove-CloudFormationStack {
    param([string]$StackName, [string]$Region, [bool]$DryRun)
    
    Write-Info "Preparing to delete CloudFormation stack: $StackName"
    
    if ($DryRun) {
        Write-DryRun "Would delete CloudFormation stack: $StackName"
        Write-DryRun "This would delete all resources managed by the stack:"
        Write-DryRun "  - Lambda functions (getTasks, createTask, updateTask, deleteTask, syncTasks)"
        Write-DryRun "  - API Gateway REST API"
        Write-DryRun "  - CloudWatch Log Groups"
        Write-DryRun "  - IAM Role for Lambda execution"
        Write-DryRun "  - S3 bucket (after emptying)"
        Write-DryRun "  - CloudFront distribution"
        Write-DryRun "  - DynamoDB table"
        return
    }
    
    try {
        Write-Warning "Deleting CloudFormation stack..."
        aws cloudformation delete-stack --stack-name $StackName --region $Region
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "CloudFormation stack deletion initiated"
            Write-Info "Waiting for stack deletion to complete..."
            Write-Warning "This may take several minutes..."
            
            # Wait for stack deletion
            aws cloudformation wait stack-delete-complete --stack-name $StackName --region $Region
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "CloudFormation stack deleted successfully"
            } else {
                Write-Warning "Stack deletion may still be in progress. Check AWS Console for status."
            }
        } else {
            Write-Error "Failed to initiate stack deletion"
        }
    } catch {
        Write-Error "Failed to delete CloudFormation stack: $_"
    }
}

# Main execution
try {
    # Check if stack exists
    if (-not (Test-StackExists -StackName $StackName -Region $AwsRegion)) {
        Write-Warning "CloudFormation stack '$StackName' does not exist in region '$AwsRegion'"
        Write-Info "Nothing to clean up."
        exit 0
    }
    
    Write-Success "Found CloudFormation stack: $StackName"
    
    # Get stack outputs
    $Outputs = Get-StackOutputs -StackName $StackName -Region $AwsRegion
    
    Write-Info "Stack resources found:"
    if ($Outputs.S3Bucket) { Write-Host "  S3 Bucket: $($Outputs.S3Bucket)" }
    if ($Outputs.DistributionId) { Write-Host "  CloudFront Distribution: $($Outputs.DistributionId)" }
    if ($Outputs.TableName) { Write-Host "  DynamoDB Table: $($Outputs.TableName)" }
    Write-Host ""
    
    # Confirmation prompt (unless Force or DryRun)
    if (-not $Force -and -not $DryRun) {
        Write-Host ""
        Write-Warning "This will PERMANENTLY DELETE all resources listed above!"
        Write-Host "Type 'DELETE' to confirm, or anything else to cancel: " -NoNewline -ForegroundColor Red
        $Confirmation = Read-Host
        
        if ($Confirmation -ne "DELETE") {
            Write-Info "Cleanup cancelled by user"
            exit 0
        }
        Write-Host ""
    }
    
    # Step 1: Empty S3 bucket (required before stack deletion)
    if ($Outputs.S3Bucket) {
        Clear-S3Bucket -BucketName $Outputs.S3Bucket -Region $AwsRegion -DryRun $DryRun
    }
    
    # Step 2: Check CloudFront distribution
    if ($Outputs.DistributionId) {
        Disable-CloudFrontDistribution -DistributionId $Outputs.DistributionId -Region $AwsRegion -DryRun $DryRun
    }
    
    # Step 3: Check DynamoDB table
    if ($Outputs.TableName) {
        Check-DynamoDBTable -TableName $Outputs.TableName -Region $AwsRegion -DryRun $DryRun
    }
    
    # Step 4: Delete CloudFormation stack
    Remove-CloudFormationStack -StackName $StackName -Region $AwsRegion -DryRun $DryRun
    
    # Summary
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    if ($DryRun) {
        Write-Success "DRY RUN COMPLETE"
        Write-Host "No resources were actually deleted." -ForegroundColor Cyan
        Write-Host "Run without -DryRun to perform actual cleanup." -ForegroundColor Yellow
    } else {
        Write-Success "CLEANUP COMPLETE"
        Write-Host "All AWS resources for environment '$Environment' have been deleted." -ForegroundColor Green
    }
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Error "Cleanup failed: $_"
    Write-Host ""
    Write-Host "Partial cleanup may have occurred. Check AWS Console for remaining resources." -ForegroundColor Yellow
    Write-Host "You may need to manually delete some resources or re-run this script." -ForegroundColor Yellow
    exit 1
}