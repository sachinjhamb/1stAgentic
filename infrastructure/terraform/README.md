# Todo App - Terraform Infrastructure

This directory contains Terraform configuration for deploying the Todo App infrastructure to AWS.

## Prerequisites

### Required Tools

1. **Terraform** (version >= 1.0)
   ```bash
   # Install on macOS
   brew install terraform
   
   # Install on Windows
   choco install terraform
   
   # Or download from: https://www.terraform.io/downloads
   ```

2. **AWS CLI** (version 2.x or later)
   ```bash
   # Configure credentials
   aws configure
   ```

3. **Node.js and npm** (for Lambda packaging)
   ```bash
   node --version
   npm --version
   ```

### AWS Permissions

Your AWS user/role needs permissions for:
- S3 (create buckets, upload objects)
- CloudFront (create distributions)
- Lambda (create functions, update code)
- API Gateway (create APIs)
- DynamoDB (create tables)
- IAM (create roles and policies)
- CloudWatch Logs (create log groups)

## Quick Start

### 1. Configure Variables

Copy the example variables file:
```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:
```hcl
environment      = "dev"
google_client_id = "your-google-client-id"
aws_region       = "us-east-1"
```

### 2. Deploy Infrastructure

Using PowerShell (Windows):
```powershell
.\deploy.ps1 -Environment dev -GoogleClientId "your-google-client-id"
```

Using Terraform directly:
```bash
terraform init
terraform plan
terraform apply
```

### 3. Deploy Frontend

After infrastructure is deployed:
```powershell
.\deploy-frontend.ps1 -Environment dev -GoogleClientId "your-google-client-id"
```

## File Structure

```
terraform/
├── main.tf                 # Main configuration and providers
├── variables.tf            # Input variables
├── outputs.tf             # Output values
├── s3.tf                  # S3 bucket for frontend hosting
├── cloudfront.tf          # CloudFront distribution
├── dynamodb.tf            # DynamoDB table
├── iam.tf                 # IAM roles and policies
├── lambda.tf              # Lambda functions
├── api_gateway.tf         # API Gateway configuration
├── deploy.ps1             # PowerShell deployment script
├── deploy-frontend.ps1    # Frontend deployment script
├── terraform.tfvars.example # Example variables file
└── README.md              # This file
```

## Deployment Scripts

### Main Deployment Script (`deploy.ps1`)

Deploys the complete infrastructure:

```powershell
# Basic deployment
.\deploy.ps1 -Environment dev -GoogleClientId "your-client-id"

# Auto-approve (no interactive prompts)
.\deploy.ps1 -Environment dev -GoogleClientId "your-client-id" -AutoApprove

# Show plan only (don't apply)
.\deploy.ps1 -Environment dev -GoogleClientId "your-client-id" -Plan

# Destroy infrastructure
.\deploy.ps1 -Environment dev -GoogleClientId "your-client-id" -Destroy
```

### Frontend Deployment Script (`deploy-frontend.ps1`)

Updates frontend configuration and deploys to S3:

```powershell
.\deploy-frontend.ps1 -Environment dev -GoogleClientId "your-client-id"
```

This script:
1. Gets deployment outputs from Terraform
2. Updates `frontend/config.js` with API URL and Google Client ID
3. Syncs frontend files to S3
4. Invalidates CloudFront cache

## Manual Terraform Commands

### Initialize
```bash
terraform init
```

### Plan
```bash
terraform plan -var="environment=dev" -var="google_client_id=your-client-id"
```

### Apply
```bash
terraform apply -var="environment=dev" -var="google_client_id=your-client-id"
```

### Destroy
```bash
terraform destroy -var="environment=dev" -var="google_client_id=your-client-id"
```

### Show Outputs
```bash
terraform output
```

## Configuration Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `environment` | Deployment environment (dev/staging/prod) | Yes | - |
| `google_client_id` | Google OAuth Client ID | Yes | - |
| `aws_region` | AWS region | No | us-east-1 |
| `lambda_zip_path` | Path to Lambda deployment package | No | ../lambda-functions.zip |
| `frontend_path` | Path to frontend files | No | ../../frontend |
| `cloudwatch_log_retention_days` | Log retention in days | No | 14 |
| `lambda_timeout` | Lambda timeout in seconds | No | 30 |
| `lambda_memory_size` | Lambda memory in MB | No | 256 |

## Outputs

After deployment, Terraform provides these outputs:

- `cloudfront_url`: Frontend application URL
- `api_gateway_url`: API Gateway endpoint URL
- `s3_bucket_name`: S3 bucket name for frontend
- `dynamodb_table_name`: DynamoDB table name
- `cloudfront_distribution_id`: CloudFront distribution ID
- `lambda_function_arns`: Lambda function ARNs
- `deployment_info`: Summary of deployment information

## State Management

### Local State (Default)
Terraform state is stored locally in `terraform.tfstate`. For production deployments, consider using remote state.

### Remote State (Recommended for Production)
Add to `main.tf`:

```hcl
terraform {
  backend "s3" {
    bucket = "your-terraform-state-bucket"
    key    = "todo-app/terraform.tfstate"
    region = "us-east-1"
  }
}
```

## Multi-Environment Deployment

Deploy to different environments using workspaces:

```bash
# Create and switch to dev workspace
terraform workspace new dev
terraform workspace select dev

# Deploy to dev
terraform apply -var="environment=dev" -var="google_client_id=dev-client-id"

# Create and switch to prod workspace
terraform workspace new prod
terraform workspace select prod

# Deploy to prod
terraform apply -var="environment=prod" -var="google_client_id=prod-client-id"
```

## Troubleshooting

### Common Issues

1. **Lambda packaging fails**
   - Ensure Node.js is installed
   - Check that `backend/lambda/` directory exists
   - Verify `backend/package.json` is present

2. **Terraform init fails**
   - Check internet connectivity
   - Verify Terraform version compatibility
   - Clear `.terraform/` directory and retry

3. **AWS permissions errors**
   - Verify AWS credentials: `aws sts get-caller-identity`
   - Check IAM permissions for required services
   - Ensure region is correct

4. **Frontend deployment fails**
   - Run infrastructure deployment first
   - Check that S3 bucket exists
   - Verify AWS CLI has S3 permissions

### Debugging

Enable Terraform debug logging:
```bash
export TF_LOG=DEBUG
terraform apply
```

View Terraform state:
```bash
terraform show
terraform state list
```

## Cost Optimization

- Use `terraform destroy` to clean up resources when not needed
- Monitor AWS costs in the AWS Console
- Consider using smaller Lambda memory sizes for development
- Set appropriate CloudWatch log retention periods

## Security Best Practices

1. **Never commit sensitive values**
   - Add `terraform.tfvars` to `.gitignore`
   - Use environment variables for secrets
   - Consider AWS Secrets Manager for production

2. **Use least-privilege IAM policies**
   - Review and minimize IAM permissions
   - Use separate AWS accounts for different environments

3. **Enable resource encryption**
   - DynamoDB encryption is enabled by default
   - S3 bucket encryption can be added if needed

4. **Regular security audits**
   - Use AWS Config and Security Hub
   - Review CloudTrail logs
   - Keep Terraform and providers updated

## Comparison with CloudFormation

| Feature | Terraform | CloudFormation |
|---------|-----------|----------------|
| **Syntax** | HCL (more readable) | YAML/JSON |
| **State Management** | Explicit state file | Implicit in AWS |
| **Multi-cloud** | Yes | AWS only |
| **Modularity** | Excellent | Good |
| **Community** | Large ecosystem | AWS-focused |
| **Learning Curve** | Moderate | Easier for AWS users |

## Migration from CloudFormation

If migrating from the existing CloudFormation template:

1. **Import existing resources** (if any):
   ```bash
   terraform import aws_s3_bucket.frontend your-bucket-name
   ```

2. **Compare configurations** to ensure feature parity

3. **Test thoroughly** in a development environment

4. **Plan the migration** to minimize downtime

## Cleanup

To safely delete all AWS resources created by Terraform:

### PowerShell Cleanup
```powershell
# Dry run to see what would be deleted
.\cleanup.ps1 -Environment dev -DryRun

# Delete all resources (with confirmation)
.\cleanup.ps1 -Environment dev

# Force delete without confirmation
.\cleanup.ps1 -Environment dev -Force

# Verify cleanup completed successfully
.\verify-cleanup.ps1 -Environment dev
```

### Bash Cleanup (Linux/Mac)
```bash
# Dry run to see what would be deleted
./cleanup.sh -e dev -d

# Delete all resources (with confirmation)
./cleanup.sh -e dev

# Force delete without confirmation
./cleanup.sh -e dev -f
```

### Manual Cleanup (if scripts fail)
If the automated cleanup fails, you can manually run:

```bash
# Terraform destroy
terraform destroy -var="environment=dev" -var="google_client_id=placeholder"

# Clean up local files
rm -f terraform.tfvars lambda-functions.zip lambda-placeholder.zip
```

### Cleanup Safety Features

The cleanup scripts include several safety features:
- **Dry run mode**: See what would be deleted without actually deleting
- **Confirmation prompts**: Requires typing "DESTROY" to confirm
- **Resource verification**: Checks what resources exist before deletion
- **Proper deletion order**: Empties S3 bucket before destroying infrastructure
- **Error handling**: Continues cleanup even if some steps fail
- **Verification script**: Confirms all resources were deleted
- **State checking**: Verifies Terraform state before attempting cleanup

## Support

For issues:
1. Check Terraform documentation: https://www.terraform.io/docs
2. Review AWS provider documentation: https://registry.terraform.io/providers/hashicorp/aws
3. Check the main project README.md
4. Review CloudWatch logs for runtime issues