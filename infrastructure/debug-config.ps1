# Debug Configuration Script
# This script helps debug why authentication isn't working

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

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "AUTHENTICATION DEBUG TOOL" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory and paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$ConfigFile = Join-Path $ProjectRoot "frontend\config.js"

Write-Info "Environment: $Environment"
Write-Info "Config file: $ConfigFile"
Write-Host ""

# Step 1: Check if config file exists and read it
Write-Info "Step 1: Checking frontend configuration..."
if (Test-Path $ConfigFile) {
    Write-Success "Config file exists"
    
    # Read and analyze config
    $ConfigContent = Get-Content $ConfigFile -Raw
    
    # Check for placeholders
    $ApiUrlPlaceholder = "YOUR_${Environment.ToUpper()}_API_URL"
    $ClientIdPlaceholder = "YOUR_${Environment.ToUpper()}_GOOGLE_CLIENT_ID"
    
    $HasApiPlaceholder = $ConfigContent -match $ApiUrlPlaceholder
    $HasClientIdPlaceholder = $ConfigContent -match $ClientIdPlaceholder
    
    if ($HasApiPlaceholder -or $HasClientIdPlaceholder) {
        Write-Error "❌ Configuration contains placeholders!"
        if ($HasApiPlaceholder) {
            Write-Host "  - Missing API URL for $Environment environment" -ForegroundColor Red
        }
        if ($HasClientIdPlaceholder) {
            Write-Host "  - Missing Google Client ID for $Environment environment" -ForegroundColor Red
        }
        Write-Host ""
        Write-Warning "This means the deployment script didn't update the configuration properly."
    } else {
        Write-Success "✅ Configuration appears to be updated (no placeholders found)"
        
        # Try to extract actual values
        $Lines = $ConfigContent -split "`n"
        $InEnvironmentSection = $false
        $CurrentEnv = ""
        
        foreach ($Line in $Lines) {
            if ($Line -match "^\s*(\w+):\s*\{") {
                $CurrentEnv = $Matches[1]
                $InEnvironmentSection = ($CurrentEnv -eq $Environment)
            }
            
            if ($InEnvironmentSection) {
                if ($Line -match "apiBaseUrl:\s*['""]([^'""]+)['""]") {
                    Write-Host "  API URL: $($Matches[1])" -ForegroundColor Green
                }
                if ($Line -match "googleClientId:\s*['""]([^'""]+)['""]") {
                    $ClientId = $Matches[1]
                    $MaskedClientId = $ClientId.Substring(0, [Math]::Min(20, $ClientId.Length)) + "..."
                    Write-Host "  Google Client ID: $MaskedClientId" -ForegroundColor Green
                }
            }
        }
    }
} else {
    Write-Error "❌ Config file not found!"
    exit 1
}

Write-Host ""

# Step 2: Check what environment the app would detect
Write-Info "Step 2: Testing environment detection..."

# Simulate different hostnames
$TestHostnames = @{
    "localhost" = "local"
    "127.0.0.1" = "local"
    "d1234567890123.cloudfront.net" = "production"
    "dev.example.com" = "development"
    "staging.example.com" = "staging"
    "example-dev.com" = "development"
}

Write-Host "Environment detection test:"
foreach ($hostname in $TestHostnames.Keys) {
    $expectedEnv = $TestHostnames[$hostname]
    Write-Host "  $hostname → $expectedEnv" -ForegroundColor $(if ($expectedEnv -eq $Environment) { "Green" } else { "Yellow" })
}

Write-Host ""
Write-Warning "Your CloudFront URL will likely be detected as 'production' environment"
Write-Host "Make sure your Google Client ID is set for the 'production' environment in config.js"

Write-Host ""

# Step 3: Check if window.APP_CONFIG would be set
Write-Info "Step 3: Checking global configuration setup..."
if ($ConfigContent -match "window\.APP_CONFIG\s*=\s*getConfig\(\)") {
    Write-Success "✅ Global APP_CONFIG setup found"
} else {
    Write-Error "❌ Global APP_CONFIG setup missing!"
    Write-Host "The app.js file expects window.APP_CONFIG to be available" -ForegroundColor Red
}

Write-Host ""

# Step 4: Check deployment outputs (if available)
Write-Info "Step 4: Checking deployment outputs..."

# Check CloudFormation first
try {
    $StackName = "todo-app-$Environment"
    $ApiUrl = aws cloudformation describe-stacks --stack-name $StackName --region $AwsRegion --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" --output text 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($ApiUrl)) {
        Write-Success "✅ CloudFormation stack found"
        Write-Host "  API URL: $ApiUrl" -ForegroundColor Green
        
        $CloudFrontUrl = aws cloudformation describe-stacks --stack-name $StackName --region $AwsRegion --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" --output text 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($CloudFrontUrl)) {
            Write-Host "  CloudFront URL: $CloudFrontUrl" -ForegroundColor Green
        }
    }
} catch {
    Write-Info "No CloudFormation stack found"
}

# Check Terraform
$TerraformDir = Join-Path $ScriptDir "terraform"
if (Test-Path $TerraformDir) {
    Push-Location $TerraformDir
    try {
        $TerraformOutputs = terraform output -json 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($TerraformOutputs)) {
            Write-Success "✅ Terraform state found"
            $Outputs = $TerraformOutputs | ConvertFrom-Json
            if ($Outputs.api_gateway_url -and $Outputs.api_gateway_url.value) {
                Write-Host "  API URL: $($Outputs.api_gateway_url.value)" -ForegroundColor Green
            }
            if ($Outputs.cloudfront_url -and $Outputs.cloudfront_url.value) {
                Write-Host "  CloudFront URL: $($Outputs.cloudfront_url.value)" -ForegroundColor Green
            }
        }
    } catch {
        Write-Info "No Terraform state found"
    } finally {
        Pop-Location
    }
}

Write-Host ""

# Step 5: Provide recommendations
Write-Info "Step 5: Recommendations..."

if ($HasApiPlaceholder -or $HasClientIdPlaceholder) {
    Write-Host "🔧 IMMEDIATE FIXES NEEDED:" -ForegroundColor Red
    Write-Host ""
    Write-Host "1. Update your configuration manually:" -ForegroundColor Yellow
    Write-Host "   Edit frontend/config.js and replace:" -ForegroundColor Yellow
    if ($HasApiPlaceholder) {
        Write-Host "   - $ApiUrlPlaceholder with your actual API Gateway URL" -ForegroundColor Yellow
    }
    if ($HasClientIdPlaceholder) {
        Write-Host "   - $ClientIdPlaceholder with your actual Google Client ID" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "2. Re-deploy the frontend:" -ForegroundColor Yellow
    Write-Host "   aws s3 sync frontend/ s3://your-bucket-name/ --delete" -ForegroundColor Yellow
    Write-Host "   aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths '/*'" -ForegroundColor Yellow
} else {
    Write-Host "🔍 DEBUGGING STEPS:" -ForegroundColor Green
    Write-Host ""
    Write-Host "1. Open your CloudFront URL in browser" -ForegroundColor Yellow
    Write-Host "2. Open browser Developer Tools (F12)" -ForegroundColor Yellow
    Write-Host "3. Check Console tab for JavaScript errors" -ForegroundColor Yellow
    Write-Host "4. In Console, type: window.APP_CONFIG" -ForegroundColor Yellow
    Write-Host "5. Verify it shows your Google Client ID and API URL" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "If window.APP_CONFIG is undefined or has placeholder values," -ForegroundColor Yellow
    Write-Host "the configuration file wasn't deployed properly." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "DEBUG COMPLETE" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan