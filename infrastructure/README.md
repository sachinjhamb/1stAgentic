# AWS Infrastructure Deployment

This guide explains how to deploy the Todo App to AWS using the provided deployment scripts.

## Prerequisites

### 1. AWS CLI
Download and install AWS CLI from: https://aws.amazon.com/cli/

After installation, configure your credentials:
```powershell
aws configure
```

You'll need:
- AWS Access Key ID
- AWS Secret Access Key  
- Default region (e.g., `us-east-1`)
- Default output format (e.g., `json`)

### 2. Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 Client ID credentials
5. Add authorized redirect URIs (you'll update this after deployment)

### 3. Node.js (Optional)
Install Node.js for Lambda dependency management: https://nodejs.org/

## Deployment Scripts

### 1. Check AWS Setup
First, verify your AWS configuration:

```powershell
cd infrastructure
.\check-aws.ps1
```

This script checks:
- AWS CLI installation
- Credential configuration
- Basic permissions
- Node.js availability

### 2. Validate CloudFormation Template
Before deploying, validate the template:

```powershell
.\validate.ps1
```

Optional parameters:
```powershell
.\validate.ps1 -TemplateFile "cloudformation.yaml" -AwsRegion "us-east-1"
```

### 3. Deploy to AWS
Deploy the application:

```powershell
.\deploy.ps1 -Environment dev -GoogleClientId "your-google-client-id"
```

Full parameter list:
```powershell
.\deploy.ps1 -Environment dev -GoogleClientId "123456789-abc.apps.googleusercontent.com" -AwsRegion "us-east-1" -StackName "my-todo-app"
```

Parameters:
- `-Environment`: `dev`, `staging`, or `prod` (required)
- `-GoogleClientId`: Your Google OAuth Client ID (required)
- `-AwsRegion`: AWS region (default: `us-east-1`)
- `-StackName`: CloudFormation stack name (default: `todo-app-{environment}`)

## Deployment Process

The deployment script performs these steps:

1. **Prerequisites Check**: Verifies AWS CLI and credentials
2. **Template Validation**: Validates CloudFormation template
3. **Lambda Packaging**: Creates deployment package with dependencies
4. **CloudFormation Deploy**: Creates/updates AWS infrastructure
5. **Lambda Code Update**: Updates function code
6. **Frontend Deploy**: Uploads frontend files to S3
7. **Cache Invalidation**: Clears CloudFront cache

## Post-Deployment Steps

After successful deployment:

### 1. Update Google OAuth Settings
Add the CloudFront URL to your Google OAuth redirect URIs:
1. Go to Google Cloud Console
2. Navigate to APIs & Services > Credentials
3. Edit your OAuth 2.0 Client ID
4. Add the CloudFront URL to "Authorized JavaScript origins"
5. Add `{CloudFrontURL}/` to "Authorized redirect URIs"

### 2. Frontend Configuration (Automatic)
The deployment script automatically updates `frontend/config.js` with the correct API Gateway URL and Google Client ID for your environment. No manual configuration is needed.

### 3. Test the Application
1. Visit the CloudFront URL
2. Test Google sign-in
3. Create/edit/delete tasks
4. Verify data persistence

## Troubleshooting

### Common Issues

**1. CloudFormation Validation Failed**
- Run `.\validate.ps1` to check for template issues
- Check AWS CLI configuration with `.\check-aws.ps1`

**2. Permission Denied Errors**
- Ensure your AWS user has necessary permissions:
  - CloudFormation full access
  - S3 full access
  - Lambda full access
  - IAM role creation
  - API Gateway full access
  - DynamoDB full access

**3. Lambda Packaging Issues**
- Ensure Node.js is installed
- Check that `backend/package.json` exists
- Verify Lambda function files are in `backend/lambda/`

**4. S3 Bucket Already Exists**
- S3 bucket names must be globally unique
- The template uses `{bucket-name}-{environment}-{account-id}` format
- If still conflicts, change the bucket name in the template

**5. Google OAuth Issues**
- Verify Client ID is correct
- Check redirect URIs include the CloudFront domain
- Ensure Google+ API is enabled

### Debugging Commands

Check stack status:
```powershell
aws cloudformation describe-stacks --stack-name todo-app-dev
```

View stack events:
```powershell
aws cloudformation describe-stack-events --stack-name todo-app-dev
```

Check Lambda logs:
```powershell
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/getTasks"
```

## Cleanup

To safely delete all AWS resources created by the deployment, use the cleanup script:

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
If the automated cleanup fails, you can manually delete resources:

```powershell
# Delete CloudFormation stack
aws cloudformation delete-stack --stack-name todo-app-dev

# Empty and delete S3 bucket
aws s3 rm s3://your-bucket-name --recursive
aws s3 rb s3://your-bucket-name

# Delete CloudWatch log groups
aws logs delete-log-group --log-group-name /aws/lambda/getTasks-dev
aws logs delete-log-group --log-group-name /aws/lambda/createTask-dev
# ... repeat for other functions
```

### Cleanup Safety Features

The cleanup scripts include several safety features:
- **Dry run mode**: See what would be deleted without actually deleting
- **Confirmation prompts**: Requires typing "DELETE" to confirm
- **Resource verification**: Checks what resources exist before deletion
- **Proper deletion order**: Empties S3 bucket before deleting stack
- **Error handling**: Continues cleanup even if some steps fail
- **Verification script**: Confirms all resources were deleted

## Cost Considerations

The deployment creates these AWS resources:
- S3 bucket (minimal cost for static hosting)
- CloudFront distribution (free tier available)
- API Gateway (free tier: 1M requests/month)
- Lambda functions (free tier: 1M requests/month)
- DynamoDB (free tier: 25GB storage)
- CloudWatch logs (free tier: 5GB/month)

Most usage will fall within AWS free tier limits for development/testing.

## Security Notes

- All data transmission uses HTTPS
- API requests require valid Google OAuth tokens
- DynamoDB data is encrypted at rest
- User data is isolated by Google user ID
- S3 bucket blocks public access (served via CloudFront only)

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review AWS CloudFormation events for detailed error messages
3. Verify all prerequisites are met
4. Check AWS service limits and quotas