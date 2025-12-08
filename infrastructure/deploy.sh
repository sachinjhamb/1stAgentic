#!/bin/bash

# Todo App AWS Deployment Script
# This script deploys the Todo application to AWS using CloudFormation

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if required tools are installed
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v zip &> /dev/null; then
        print_error "zip command is not available. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials are not configured. Run 'aws configure' first."
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Function to display usage
usage() {
    echo "Usage: $0 -e <environment> -c <google-client-id> [-r <region>] [-s <stack-name>]"
    echo ""
    echo "Options:"
    echo "  -e    Environment (dev, staging, prod)"
    echo "  -c    Google OAuth Client ID"
    echo "  -r    AWS Region (default: us-east-1)"
    echo "  -s    CloudFormation Stack Name (default: todo-app-<environment>)"
    echo "  -h    Display this help message"
    echo ""
    echo "Example:"
    echo "  $0 -e dev -c 123456789-abc.apps.googleusercontent.com"
    exit 1
}

# Parse command line arguments
ENVIRONMENT=""
GOOGLE_CLIENT_ID=""
AWS_REGION="us-east-1"
STACK_NAME=""

while getopts "e:c:r:s:h" opt; do
    case $opt in
        e) ENVIRONMENT="$OPTARG" ;;
        c) GOOGLE_CLIENT_ID="$OPTARG" ;;
        r) AWS_REGION="$OPTARG" ;;
        s) STACK_NAME="$OPTARG" ;;
        h) usage ;;
        *) usage ;;
    esac
done

# Validate required parameters
if [ -z "$ENVIRONMENT" ] || [ -z "$GOOGLE_CLIENT_ID" ]; then
    print_error "Environment and Google Client ID are required"
    usage
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    print_error "Environment must be one of: dev, staging, prod"
    exit 1
fi

# Set default stack name if not provided
if [ -z "$STACK_NAME" ]; then
    STACK_NAME="todo-app-${ENVIRONMENT}"
fi

print_info "Deployment Configuration:"
echo "  Environment: $ENVIRONMENT"
echo "  Stack Name: $STACK_NAME"
echo "  AWS Region: $AWS_REGION"
echo "  Google Client ID: ${GOOGLE_CLIENT_ID:0:20}..."
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
LAMBDA_DIR="$BACKEND_DIR/lambda"
TEMPLATE_FILE="$SCRIPT_DIR/cloudformation.yaml"
LAMBDA_ZIP="$SCRIPT_DIR/lambda-functions.zip"

# Step 1: Validate CloudFormation template
print_info "Validating CloudFormation template..."
if aws cloudformation validate-template \
    --template-body file://"$TEMPLATE_FILE" \
    --region "$AWS_REGION" > /dev/null 2>&1; then
    print_success "CloudFormation template is valid"
else
    print_error "CloudFormation template validation failed"
    exit 1
fi

# Step 2: Package Lambda functions
print_info "Packaging Lambda functions..."

# Create temporary directory for packaging
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy Lambda function files
cp -r "$LAMBDA_DIR"/* "$TEMP_DIR/"

# Install dependencies in temp directory
if [ -f "$BACKEND_DIR/package.json" ]; then
    print_info "Installing Lambda dependencies..."
    cd "$TEMP_DIR"
    
    # Copy package.json and package-lock.json
    cp "$BACKEND_DIR/package.json" .
    if [ -f "$BACKEND_DIR/package-lock.json" ]; then
        cp "$BACKEND_DIR/package-lock.json" .
    fi
    
    # Install production dependencies only
    npm install --production --silent
    
    cd "$SCRIPT_DIR"
fi

# Create deployment zip
print_info "Creating deployment package..."
cd "$TEMP_DIR"
zip -r "$LAMBDA_ZIP" . -q
cd "$SCRIPT_DIR"

if [ -f "$LAMBDA_ZIP" ]; then
    LAMBDA_SIZE=$(du -h "$LAMBDA_ZIP" | cut -f1)
    print_success "Lambda deployment package created ($LAMBDA_SIZE)"
else
    print_error "Failed to create Lambda deployment package"
    exit 1
fi

# Step 3: Deploy CloudFormation stack
print_info "Deploying CloudFormation stack..."
print_warning "This may take several minutes..."

aws cloudformation deploy \
    --template-file "$TEMPLATE_FILE" \
    --stack-name "$STACK_NAME" \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        GoogleClientId="$GOOGLE_CLIENT_ID" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION" \
    --no-fail-on-empty-changeset

if [ $? -eq 0 ]; then
    print_success "CloudFormation stack deployed successfully"
else
    print_error "CloudFormation stack deployment failed"
    exit 1
fi

# Step 4: Get stack outputs
print_info "Retrieving stack outputs..."

get_output() {
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
        --output text
}

API_URL=$(get_output "ApiGatewayUrl")
CLOUDFRONT_URL=$(get_output "CloudFrontUrl")
S3_BUCKET=$(get_output "S3BucketName")
DISTRIBUTION_ID=$(get_output "CloudFrontDistributionId")
TABLE_NAME=$(get_output "DynamoDBTableName")

# Step 5: Update Lambda function code
print_info "Updating Lambda function code..."

LAMBDA_FUNCTIONS=("getTasks" "createTask" "updateTask" "deleteTask" "syncTasks")

for func in "${LAMBDA_FUNCTIONS[@]}"; do
    FUNCTION_NAME="${func}-${ENVIRONMENT}"
    print_info "Updating $FUNCTION_NAME..."
    
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file fileb://"$LAMBDA_ZIP" \
        --region "$AWS_REGION" \
        --no-cli-pager > /dev/null
    
    if [ $? -eq 0 ]; then
        print_success "$FUNCTION_NAME updated"
    else
        print_warning "Failed to update $FUNCTION_NAME"
    fi
done

# Wait for Lambda functions to be ready
print_info "Waiting for Lambda functions to be ready..."
sleep 5

# Step 6: Update frontend configuration
print_info "Updating frontend configuration..."

CONFIG_FILE="$FRONTEND_DIR/config.js"

if [ -f "$CONFIG_FILE" ]; then
    # Create a backup
    cp "$CONFIG_FILE" "${CONFIG_FILE}.backup"
    
    # Update the configuration for the environment
    # Note: This is a simple approach. In production, consider using environment-specific config files
    print_info "Please update $CONFIG_FILE with the following values:"
    echo "  apiBaseUrl: $API_URL"
    echo "  googleClientId: $GOOGLE_CLIENT_ID"
    print_warning "Automatic config update not implemented. Please update manually."
else
    print_warning "Config file not found at $CONFIG_FILE"
fi

# Step 7: Deploy frontend to S3
print_info "Deploying frontend to S3..."

if [ -d "$FRONTEND_DIR" ]; then
    aws s3 sync "$FRONTEND_DIR" "s3://$S3_BUCKET/" \
        --exclude "*.test.js" \
        --exclude "*.md" \
        --exclude ".git/*" \
        --exclude "node_modules/*" \
        --exclude "package*.json" \
        --region "$AWS_REGION" \
        --delete
    
    if [ $? -eq 0 ]; then
        print_success "Frontend deployed to S3"
    else
        print_error "Failed to deploy frontend to S3"
        exit 1
    fi
else
    print_error "Frontend directory not found at $FRONTEND_DIR"
    exit 1
fi

# Step 8: Invalidate CloudFront cache
print_info "Invalidating CloudFront cache..."

INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --region "$AWS_REGION" \
    --query 'Invalidation.Id' \
    --output text)

if [ $? -eq 0 ]; then
    print_success "CloudFront cache invalidation created (ID: $INVALIDATION_ID)"
    print_info "Cache invalidation may take a few minutes to complete"
else
    print_warning "Failed to create CloudFront cache invalidation"
fi

# Step 9: Clean up
print_info "Cleaning up temporary files..."
rm -f "$LAMBDA_ZIP"
print_success "Cleanup complete"

# Display deployment summary
echo ""
echo "=========================================="
print_success "DEPLOYMENT COMPLETE"
echo "=========================================="
echo ""
echo "Stack Name:        $STACK_NAME"
echo "Environment:       $ENVIRONMENT"
echo "Region:            $AWS_REGION"
echo ""
echo "Frontend URL:      $CLOUDFRONT_URL"
echo "API URL:           $API_URL"
echo "S3 Bucket:         $S3_BUCKET"
echo "DynamoDB Table:    $TABLE_NAME"
echo "Distribution ID:   $DISTRIBUTION_ID"
echo ""
echo "=========================================="
echo ""
print_info "Next Steps:"
echo "  1. Update Google OAuth redirect URIs to include: $CLOUDFRONT_URL"
echo "  2. Update frontend/config.js with the API URL and Google Client ID"
echo "  3. Test the application at: $CLOUDFRONT_URL"
echo "  4. Monitor CloudWatch logs for any issues"
echo ""
print_warning "Note: CloudFront distribution may take 15-20 minutes to fully deploy"
echo ""
