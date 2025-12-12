#!/bin/bash

# Todo App AWS Resource Cleanup Script
# This script safely deletes all AWS resources created by the deployment

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

print_dryrun() {
    echo -e "${CYAN}[DRY-RUN]${NC} $1"
}

# Function to display usage
usage() {
    echo "AWS Resource Cleanup Script"
    echo ""
    echo "Usage: $0 -e <environment> [-r <region>] [-s <stack-name>] [-f] [-d]"
    echo ""
    echo "Options:"
    echo "  -e    Environment to clean up (dev, staging, prod) [Required]"
    echo "  -r    AWS Region (default: us-east-1)"
    echo "  -s    CloudFormation Stack Name (default: todo-app-<environment>)"
    echo "  -f    Force deletion without confirmation"
    echo "  -d    Dry run - show what would be deleted without actually deleting"
    echo "  -h    Display this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e dev -d"
    echo "  $0 -e dev -f"
    echo "  $0 -e staging -r us-west-2"
    echo ""
    echo "WARNING: This will permanently delete all resources for the specified environment!"
    exit 1
}

# Parse command line arguments
ENVIRONMENT=""
AWS_REGION="us-east-1"
STACK_NAME=""
FORCE=false
DRY_RUN=false

while getopts "e:r:s:fdh" opt; do
    case $opt in
        e) ENVIRONMENT="$OPTARG" ;;
        r) AWS_REGION="$OPTARG" ;;
        s) STACK_NAME="$OPTARG" ;;
        f) FORCE=true ;;
        d) DRY_RUN=true ;;
        h) usage ;;
        *) usage ;;
    esac
done

# Validate required parameters
if [ -z "$ENVIRONMENT" ]; then
    print_error "Environment is required"
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

echo ""
echo -e "${RED}==========================================${NC}"
echo -e "${RED}AWS RESOURCE CLEANUP${NC}"
echo -e "${RED}==========================================${NC}"
echo ""
print_warning "This will DELETE all AWS resources for:"
echo -e "  Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "  Stack Name: ${YELLOW}$STACK_NAME${NC}"
echo -e "  AWS Region: ${YELLOW}$AWS_REGION${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "  Mode: ${CYAN}DRY RUN (no actual deletion)${NC}"
fi
echo ""

# Check AWS CLI
print_info "Checking AWS CLI..."
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials are not configured. Run 'aws configure' first."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
print_success "Connected to AWS Account: $ACCOUNT_ID"

# Function to check if stack exists
check_stack_exists() {
    aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" &> /dev/null
}

# Function to get stack output
get_stack_output() {
    local output_key="$1"
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text 2>/dev/null || echo ""
}

# Function to empty S3 bucket
empty_s3_bucket() {
    local bucket_name="$1"
    
    if [ -z "$bucket_name" ]; then
        print_warning "S3 bucket name not found, skipping S3 cleanup"
        return
    fi
    
    print_info "Checking S3 bucket: $bucket_name"
    
    # Check if bucket exists
    if ! aws s3api head-bucket --bucket "$bucket_name" --region "$AWS_REGION" &> /dev/null; then
        print_warning "S3 bucket $bucket_name does not exist or is not accessible"
        return
    fi
    
    # Check if bucket has objects
    local object_count=$(aws s3api list-objects-v2 --bucket "$bucket_name" --region "$AWS_REGION" --query 'length(Contents)' --output text 2>/dev/null || echo "0")
    
    if [ "$object_count" != "0" ] && [ "$object_count" != "None" ]; then
        print_warning "Found $object_count objects in S3 bucket"
        
        if [ "$DRY_RUN" = true ]; then
            print_dryrun "Would empty S3 bucket: $bucket_name"
        else
            print_info "Emptying S3 bucket: $bucket_name"
            aws s3 rm "s3://$bucket_name" --recursive --region "$AWS_REGION"
            print_success "S3 bucket emptied"
        fi
    else
        print_info "S3 bucket is already empty"
    fi
}

# Function to check CloudFront distribution
check_cloudfront_distribution() {
    local distribution_id="$1"
    
    if [ -z "$distribution_id" ]; then
        print_warning "CloudFront distribution ID not found, skipping CloudFront cleanup"
        return
    fi
    
    print_info "Checking CloudFront distribution: $distribution_id"
    
    if aws cloudfront get-distribution --id "$distribution_id" --region "$AWS_REGION" &> /dev/null; then
        if [ "$DRY_RUN" = true ]; then
            print_dryrun "Would disable CloudFront distribution: $distribution_id"
        else
            print_info "CloudFront distribution will be disabled during stack deletion"
        fi
    else
        print_warning "CloudFront distribution $distribution_id not found"
    fi
}

# Function to check DynamoDB table
check_dynamodb_table() {
    local table_name="$1"
    
    if [ -z "$table_name" ]; then
        print_warning "DynamoDB table name not found, skipping DynamoDB check"
        return
    fi
    
    print_info "Checking DynamoDB table: $table_name"
    
    if aws dynamodb describe-table --table-name "$table_name" --region "$AWS_REGION" &> /dev/null; then
        local item_count=$(aws dynamodb describe-table --table-name "$table_name" --region "$AWS_REGION" --query 'Table.ItemCount' --output text 2>/dev/null || echo "unknown")
        print_info "DynamoDB table exists with approximately $item_count items"
        
        if [ "$DRY_RUN" = true ]; then
            print_dryrun "Would delete DynamoDB table: $table_name (with ~$item_count items)"
        else
            print_warning "DynamoDB table will be deleted by CloudFormation (with ~$item_count items)"
        fi
    else
        print_info "DynamoDB table does not exist"
    fi
}

# Function to delete CloudFormation stack
delete_cloudformation_stack() {
    print_info "Preparing to delete CloudFormation stack: $STACK_NAME"
    
    if [ "$DRY_RUN" = true ]; then
        print_dryrun "Would delete CloudFormation stack: $STACK_NAME"
        print_dryrun "This would delete all resources managed by the stack:"
        print_dryrun "  - Lambda functions (getTasks, createTask, updateTask, deleteTask, syncTasks)"
        print_dryrun "  - API Gateway REST API"
        print_dryrun "  - CloudWatch Log Groups"
        print_dryrun "  - IAM Role for Lambda execution"
        print_dryrun "  - S3 bucket (after emptying)"
        print_dryrun "  - CloudFront distribution"
        print_dryrun "  - DynamoDB table"
        return
    fi
    
    print_warning "Deleting CloudFormation stack..."
    aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$AWS_REGION"
    
    print_success "CloudFormation stack deletion initiated"
    print_info "Waiting for stack deletion to complete..."
    print_warning "This may take several minutes..."
    
    # Wait for stack deletion
    if aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" --region "$AWS_REGION"; then
        print_success "CloudFormation stack deleted successfully"
    else
        print_warning "Stack deletion may still be in progress. Check AWS Console for status."
    fi
}

# Main execution
if ! check_stack_exists; then
    print_warning "CloudFormation stack '$STACK_NAME' does not exist in region '$AWS_REGION'"
    print_info "Nothing to clean up."
    exit 0
fi

print_success "Found CloudFormation stack: $STACK_NAME"

# Get stack outputs
print_info "Retrieving stack information..."
S3_BUCKET=$(get_stack_output "S3BucketName")
DISTRIBUTION_ID=$(get_stack_output "CloudFrontDistributionId")
TABLE_NAME=$(get_stack_output "DynamoDBTableName")

print_info "Stack resources found:"
[ -n "$S3_BUCKET" ] && echo "  S3 Bucket: $S3_BUCKET"
[ -n "$DISTRIBUTION_ID" ] && echo "  CloudFront Distribution: $DISTRIBUTION_ID"
[ -n "$TABLE_NAME" ] && echo "  DynamoDB Table: $TABLE_NAME"
echo ""

# Confirmation prompt (unless Force or DryRun)
if [ "$FORCE" != true ] && [ "$DRY_RUN" != true ]; then
    echo ""
    print_warning "This will PERMANENTLY DELETE all resources listed above!"
    echo -e "${RED}Type 'DELETE' to confirm, or anything else to cancel: ${NC}"
    read -r confirmation
    
    if [ "$confirmation" != "DELETE" ]; then
        print_info "Cleanup cancelled by user"
        exit 0
    fi
    echo ""
fi

# Step 1: Empty S3 bucket (required before stack deletion)
[ -n "$S3_BUCKET" ] && empty_s3_bucket "$S3_BUCKET"

# Step 2: Check CloudFront distribution
[ -n "$DISTRIBUTION_ID" ] && check_cloudfront_distribution "$DISTRIBUTION_ID"

# Step 3: Check DynamoDB table
[ -n "$TABLE_NAME" ] && check_dynamodb_table "$TABLE_NAME"

# Step 4: Delete CloudFormation stack
delete_cloudformation_stack

# Summary
echo ""
echo -e "${GREEN}==========================================${NC}"
if [ "$DRY_RUN" = true ]; then
    print_success "DRY RUN COMPLETE"
    echo -e "${CYAN}No resources were actually deleted.${NC}"
    echo -e "${YELLOW}Run without -d to perform actual cleanup.${NC}"
else
    print_success "CLEANUP COMPLETE"
    echo -e "${GREEN}All AWS resources for environment '$ENVIRONMENT' have been deleted.${NC}"
fi
echo -e "${GREEN}==========================================${NC}"
echo ""