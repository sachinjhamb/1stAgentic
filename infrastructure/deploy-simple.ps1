# Simple Todo App AWS Deployment Script (PowerShell)
# This is a simplified version that's more robust across different PowerShell contexts

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment,
    
    [Parameter(Mandatory=$true)]
    [string]$GoogleClientId,
    
    [string]$AwsRegion = "us-east-1",
    [string]$StackName = ""
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Color functions
function Write-Info { param([string]$Message); Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param([string]$Message); Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message); Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message); Write-Host "[ERROR] $Message" -ForegroundColor Red }

# Set default stack name
if ([string]::IsNullOrEmpty($StackName)) {
    $StackName = "todo-app-$Environment"
}

Write-Info "Starting deployment with parameters:"
Write-Host "  Environment: $Environment"
Write-Host "  Stack Name: $StackName"
Write-Host "  AWS Region: $AwsRegion"
Write-Host "  Google Client ID: $($GoogleClientId.Substring(0, [Math]::Min(20, $GoogleClientId.Length)))..."
Write-Host ""

# Get current directory and set paths
$CurrentDir = Get-Location
$ScriptDir = $CurrentDir
$ProjectRoot = Split-Path -Parent $ScriptDir

# If we're in the infrastructure directory, adjust paths
if ((Split-Path -Leaf $CurrentDir) -eq "infrastructure") {
    $ProjectRoot = Split-Path -Parent $CurrentDir
} else {
    # Assume we're in project root
    $ScriptDir = Join-Path $CurrentDir "infrastructure"
}

$Paths = @{
    ScriptDir = $ScriptDir
    ProjectRoot = $ProjectRoot
    BackendDir = Join-Path $ProjectRoot "backend"
    FrontendDir = Join-Path $ProjectRoot "frontend"
    LambdaDir = Join-Path $ProjectRoot "backend\lambda"
    TemplateFile = Join-Path $ScriptDir "cloudformation.yaml"
    LambdaZip = Join-Path $ScriptDir "lambda-functions.zip"
}

Write-Info "Using paths:"
Write-Host "  Script Dir: $($Paths.ScriptDir)"
Write-Host "  Project Root: $($Paths.ProjectRoot)"
Write-Host "  Template: $($Paths.TemplateFile)"
Write-Host ""

# Check if template exists
if (-not (Test-Path $Paths.TemplateFile)) {
    Write-Error "CloudFormation template not found: $($Paths.TemplateFile)"
    Write-Host "Make sure you're running this script from the infrastructure directory or project root"
    exit 1
}

# Check AWS CLI
Write-Info "Checking AWS CLI..."
try {
    $null = aws --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI not found" }
    Write-Success "AWS CLI is available"
} catch {
    Write-Error "AWS CLI is not installed or not in PATH"
    exit 1
}

# Check AWS credentials
Write-Info "Checking AWS credentials..."
try {
    $null = aws sts get-caller-identity 2>$null
    if ($LASTEXITCODE -ne 0) { throw "AWS credentials not configured" }
    Write-Success "AWS credentials are configured"
} catch {
    Write-Error "AWS credentials are not configured. Run 'aws configure' first."
    exit 1
}

# Validate CloudFormation template
Write-Info "Validating CloudFormation template..."
try {
    $ValidationResult = aws cloudformation validate-template --template-body "file://$($Paths.TemplateFile)" --region $AwsRegion 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "CloudFormation template is valid"
    } else {
        Write-Error "CloudFormation template validation failed:"
        Write-Host $ValidationResult -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Error "Failed to validate template: $_"
    exit 1
}

# Create Lambda package
Write-Info "Creating Lambda deployment package..."
try {
    # Create temp directory
    $TempDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
    
    # Copy Lambda files
    if (Test-Path $Paths.LambdaDir) {
        Copy-Item -Path "$($Paths.LambdaDir)\*" -Destination $TempDir -Recurse -Force
        Write-Success "Lambda files copied"
    } else {
        Write-Error "Lambda directory not found: $($Paths.LambdaDir)"
        exit 1
    }
    
    # Install dependencies if package.json exists
    $PackageJson = Join-Path $Paths.BackendDir "package.json"
    if (Test-Path $PackageJson) {
        Write-Info "Installing Lambda dependencies..."
        Copy-Item -Path $PackageJson -Destination $TempDir -Force
        
        $PackageLock = Join-Path $Paths.BackendDir "package-lock.json"
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
    if (Test-Path $Paths.LambdaZip) {
        Remove-Item $Paths.LambdaZip -Force
    }
    
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($TempDir, $Paths.LambdaZip)
    
    $ZipSize = [math]::Round((Get-Item $Paths.LambdaZip).Length / 1MB, 2)
    Write-Success "Lambda package created ($ZipSize MB)"
    
} catch {
    Write-Error "Failed to create Lambda package: $_"
    exit 1
} finally {
    if (Test-Path $TempDir) {
        Remove-Item $TempDir -Recurse -Force
    }
}

# Deploy CloudFormation stack
Write-Info "Deploying CloudFormation stack..."
Write-Warning "This may take several minutes..."
try {
    $DeployArgs = @(
        "cloudformation", "deploy",
        "--template-file", $Paths.TemplateFile,
        "--stack-name", $StackName,
        "--parameter-overrides", "Environment=$Environment", "GoogleClientId=$GoogleClientId",
        "--capabilities", "CAPABILITY_NAMED_IAM",
        "--region", $AwsRegion,
        "--no-fail-on-empty-changeset"
    )
    
    & aws @DeployArgs
    if ($LASTEXITCODE -eq 0) {
        Write-Success "CloudFormation stack deployed successfully"
    } else {
        Write-Error "CloudFormation deployment failed"
        exit 1
    }
} catch {
    Write-Error "Failed to deploy CloudFormation stack: $_"
    exit 1
}

# Get stack outputs
Write-Info "Retrieving stack outputs..."
function Get-StackOutput {
    param([string]$OutputKey)
    try {
        $Result = aws cloudformation describe-stacks --stack-name $StackName --region $AwsRegion --query "Stacks[0].Outputs[?OutputKey=='$OutputKey'].OutputValue" --output text 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($Result)) {
            return $Result.Trim()
        }
    } catch { }
    return $null
}

$Outputs = @{
    ApiUrl = Get-StackOutput "ApiGatewayUrl"
    CloudFrontUrl = Get-StackOutput "CloudFrontUrl"
    S3Bucket = Get-StackOutput "S3BucketName"
    DistributionId = Get-StackOutput "CloudFrontDistributionId"
    TableName = Get-StackOutput "DynamoDBTableName"
}

# Update Lambda functions
Write-Info "Updating Lambda function code..."
$Functions = @("getTasks", "createTask", "updateTask", "deleteTask", "syncTasks")
foreach ($func in $Functions) {
    $FunctionName = "$func-$Environment"
    try {
        aws lambda update-function-code --function-name $FunctionName --zip-file "fileb://$($Paths.LambdaZip)" --region $AwsRegion --no-cli-pager 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$FunctionName updated"
        } else {
            Write-Warning "Failed to update $FunctionName"
        }
    } catch {
        Write-Warning "Failed to update $FunctionName"
    }
}

# Update frontend configuration
Write-Info "Updating frontend configuration..."
$ConfigFile = Join-Path $Paths.FrontendDir "config.js"
if (Test-Path $ConfigFile) {
    try {
        # Read the config file
        $ConfigContent = Get-Content $ConfigFile -Raw
        
        # Replace placeholders based on environment
        $ApiUrlPlaceholder = "YOUR_${Environment.ToUpper()}_API_URL"
        $ClientIdPlaceholder = "YOUR_${Environment.ToUpper()}_GOOGLE_CLIENT_ID"
        
        $ConfigContent = $ConfigContent -replace $ApiUrlPlaceholder, $Outputs.ApiUrl
        $ConfigContent = $ConfigContent -replace $ClientIdPlaceholder, $GoogleClientId
        
        # Write back to file
        Set-Content -Path $ConfigFile -Value $ConfigContent -NoNewline
        Write-Success "Frontend configuration updated"
    } catch {
        Write-Warning "Failed to update frontend configuration: $_"
    }
} else {
    Write-Warning "Config file not found at $ConfigFile"
}

# Deploy frontend
if ($Outputs.S3Bucket) {
    Write-Info "Deploying frontend to S3..."
    try {
        aws s3 sync $Paths.FrontendDir "s3://$($Outputs.S3Bucket)/" --exclude "*.test.js" --exclude "*.md" --exclude ".git/*" --exclude "node_modules/*" --exclude "package*.json" --region $AwsRegion --delete
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Frontend deployed to S3"
        } else {
            Write-Warning "Frontend deployment to S3 failed"
        }
    } catch {
        Write-Warning "Frontend deployment failed: $_"
    }
}

# Invalidate CloudFront
if ($Outputs.DistributionId) {
    Write-Info "Invalidating CloudFront cache..."
    try {
        $InvalidationId = aws cloudfront create-invalidation --distribution-id $Outputs.DistributionId --paths "/*" --region $AwsRegion --query 'Invalidation.Id' --output text 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "CloudFront invalidation created: $InvalidationId"
        }
    } catch {
        Write-Warning "CloudFront invalidation failed"
    }
}

# Clean up
Write-Info "Cleaning up..."
if (Test-Path $Paths.LambdaZip) {
    Remove-Item $Paths.LambdaZip -Force
}

# Display results
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Success "DEPLOYMENT COMPLETE"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Stack Name:        $StackName"
Write-Host "Environment:       $Environment"
Write-Host "Region:            $AwsRegion"
Write-Host ""

if ($Outputs.CloudFrontUrl) { Write-Host "Frontend URL:      $($Outputs.CloudFrontUrl)" -ForegroundColor Green }
if ($Outputs.ApiUrl) { Write-Host "API URL:           $($Outputs.ApiUrl)" -ForegroundColor Green }
if ($Outputs.S3Bucket) { Write-Host "S3 Bucket:         $($Outputs.S3Bucket)" }
if ($Outputs.TableName) { Write-Host "DynamoDB Table:    $($Outputs.TableName)" }
if ($Outputs.DistributionId) { Write-Host "Distribution ID:   $($Outputs.DistributionId)" }

Write-Host ""
Write-Info "Next Steps:"
Write-Host "  1. Update Google OAuth redirect URIs to include: $($Outputs.CloudFrontUrl)" -ForegroundColor Yellow
Write-Host "  2. Update frontend/config.js with the API URL" -ForegroundColor Yellow
Write-Host "  3. Test the application at: $($Outputs.CloudFrontUrl)" -ForegroundColor Yellow
Write-Host ""