#!/bin/bash

# Terraform Todo App Cleanup Script
# This script safely deletes all AWS resources created by Terraform deployment

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
    echo "Terraform AWS Resource Cleanup Script"
    echo ""
    echo "Usage: $0 -e <environment> [-r <region>] [-f] [-d]"
    echo ""
    echo "Options:"
    echo "  -e    Environment to clean up (dev, staging, prod) [Required]"
    echo "  -r    AWS Region (default: us-east-1)"
    echo "  -f    Force deletion without confirmation"
    echo "  -d    Dry run - show what would be deleted without actually deleting"
    echo "  -h    Display this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e dev -d"
    echo "  $0 -e dev -f"
    echo "  $0 -e staging -r us-west-2"
    echo ""
    echo "WARNING: This will permanently delete all Terraform-managed resources!"
    exit 1
}

# Parse command line arguments
ENVIRONMENT=""
AWS_REGION="us-east-1"
FORCE=false
DRY_RUN=false

while getopts "e:r:fdh" opt; do
    case $opt in
        e) ENVIRONMENT="$OPTARG" ;;
        r) AWS_REGION="$OPTARG" ;;
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

echo ""
echo -e "${RED}==========================================${NC}"
echo -e "${RED}TERRAFORM RESOURCE CLEANUP${NC}"
echo -e "${RED}==========================================${NC}"
echo ""
print_warning "This will DELETE all AWS resources for:"
echo -e "  Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "  AWS Region: ${YELLOW}$AWS_REGION${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "  Mode: ${CYAN}DRY RUN (no actual deletion)${NC}"
fi
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check prerequisites
print_info "Checking prerequisites..."

# Check Terraform
if ! command -v terraform &> /dev/null; then
    print_error "Terraform is not installed. Please install it first."
    exit 1
fi
print_success "Terraform is available"

# Check AWS CLI
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

# Check Terraform state
cd "$SCRIPT_DIR"

print_info "Checking Terraform state..."

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
    print_info "Initializing Terraform..."
    terraform init -input=false
    if [ $? -ne 0 ]; then
        print_error "Terraform initialization failed"
        exit 1
    fi
fi

# Check if state file exists and has resources
STATE_LIST=$(terraform state list 2>/dev/null)
if [ $? -ne 0 ] || [ -z "$STATE_LIST" ]; then
    print_warning "No Terraform state found or state is empty"
    print_info "Nothing to clean up."
    exit 0
fi

print_success "Found Terraform state with resources"

# Get current outputs if available
print_info "Retrieving current resource information..."
OUTPUTS_JSON=$(terraform output -json 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$OUTPUTS_JSON" ]; then
    print_info "Current resources:"
    
    # Extract resource information
    S3_BUCKET=$(echo "$OUTPUTS_JSON" | jq -r '.s3_bucket_name.value // empty' 2>/dev/null)
    DISTRIBUTION_ID=$(echo "$OUTPUTS_JSON" | jq -r '.cloudfront_distribution_id.value // empty' 2>/dev/null)
    TABLE_NAME=$(echo "$OUTPUTS_JSON" | jq -r '.dynamodb_table_name.value // empty' 2>/dev/null)
    
    [ -n "$S3_BUCKET" ] && echo "  S3 Bucket: $S3_BUCKET"
    [ -n "$DISTRIBUTION_ID" ] && echo "  CloudFront Distribution: $DISTRIBUTION_ID"
    [ -n "$TABLE_NAME" ] && echo "  DynamoDB Table: $TABLE_NAME"
    
    # Show Lambda functions
    LAMBDA_FUNCTIONS=$(echo "$OUTPUTS_JSON" | jq -r '.lambda_function_names.value // {} | to_entries[] | .value' 2>/dev/null)
    if [ -n "$LAMBDA_FUNCTIONS" ]; then
        echo "$LAMBDA_FUNCTIONS" | while read -r func; do
            [ -n "$func" ] && echo "  Lambda Function: $func"
        done
    fi
    echo ""
else
    print_warning "Could not retrieve resource information, but state exists"
fi

# Function to empty S3 bucket before destruction
empty_s3_bucket() {
    local bucket_name="$1"
    
    if [ -z "$bucket_name" ]; then
        return
    fi
    
    print_info "Checking S3 bucket: $bucket_name"
    
    # Check if bucket exists
    if ! aws s3api head-bucket --bucket "$bucket_name" --region "$AWS_REGION" &> /dev/null; then
        print_info "S3 bucket $bucket_name does not exist or is not accessible"
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

# Pre-cleanup: Empty S3 bucket if it exists
if [ -n "$S3_BUCKET" ]; then
    empty_s3_bucket "$S3_BUCKET"
fi

# Confirmation prompt (unless Force or DryRun)
if [ "$FORCE" != true ] && [ "$DRY_RUN" != true ]; then
    echo ""
    print_warning "This will PERMANENTLY DELETE all Terraform-managed resources!"
    echo -e "${RED}Resources to be destroyed:${NC}"
    
    # Show what would be destroyed
    terraform plan -destroy -input=false \
        -var="environment=$ENVIRONMENT" \
        -var="google_client_id=placeholder" \
        -var="aws_region=$AWS_REGION" 2>/dev/null || print_warning "Could not generate destroy plan preview"
    
    echo ""
    echo -e "${RED}Type 'DESTROY' to confirm, or anything else to cancel: ${NC}"
    read -r confirmation
    
    if [ "$confirmation" != "DESTROY" ]; then
        print_info "Cleanup cancelled by user"
        exit 0
    fi
    echo ""
fi

# Execute Terraform destroy
if [ "$DRY_RUN" = true ]; then
    print_dryrun "Would run: terraform destroy"
    print_dryrun "This would delete all Terraform-managed resources:"
    print_dryrun "  - Lambda functions (getTasks, createTask, updateTask, deleteTask, syncTasks)"
    print_dryrun "  - API Gateway REST API"
    print_dryrun "  - CloudWatch Log Groups"
    print_dryrun "  - IAM Role for Lambda execution"
    print_dryrun "  - S3 bucket (after emptying)"
    print_dryrun "  - CloudFront distribution"
    print_dryrun "  - DynamoDB table"
else
    print_info "Destroying Terraform-managed infrastructure..."
    print_warning "This may take several minutes..."
    
    # Create a minimal tfvars for destroy operation
    TEMP_TFVARS="destroy.tfvars"
    cat > "$TEMP_TFVARS" << EOF
environment      = "$ENVIRONMENT"
google_client_id = "placeholder-for-destroy"
aws_region       = "$AWS_REGION"
EOF
    
    # Execute destroy
    terraform destroy -auto-approve -var-file="$TEMP_TFVARS"
    
    if [ $? -eq 0 ]; then
        print_success "Terraform destroy completed successfully"
    else
        print_error "Terraform destroy failed"
        rm -f "$TEMP_TFVARS"
        exit 1
    fi
    
    # Clean up temp file
    rm -f "$TEMP_TFVARS"
fi

# Clean up local files
print_info "Cleaning up local files..."
FILES_TO_CLEAN=("lambda-functions.zip" "lambda-placeholder.zip" "terraform.tfvars")

for file in "${FILES_TO_CLEAN[@]}"; do
    if [ -f "$file" ]; then
        if [ "$DRY_RUN" = true ]; then
            print_dryrun "Would remove local file: $file"
        else
            rm -f "$file"
            print_info "Removed local file: $file"
        fi
    fi
done

# Summary
echo ""
echo -e "${GREEN}==========================================${NC}"
if [ "$DRY_RUN" = true ]; then
    print_success "DRY RUN COMPLETE"
    echo -e "${CYAN}No resources were actually deleted.${NC}"
    echo -e "${YELLOW}Run without -d to perform actual cleanup.${NC}"
else
    print_success "CLEANUP COMPLETE"
    echo -e "${GREEN}All Terraform-managed resources for environment '$ENVIRONMENT' have been deleted.${NC}"
fi
echo -e "${GREEN}==========================================${NC}"
echo ""