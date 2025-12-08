# Todo App AWS Infrastructure

This directory contains the AWS infrastructure as code (CloudFormation) and deployment scripts for the Todo application with Google OAuth authentication.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [AWS Resources](#aws-resources)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Updating Deployments](#updating-deployments)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
- [Cost Estimates](#cost-estimates)
- [Resource Cleanup](#resource-cleanup)

## Architecture Overview

The application uses the following AWS services:

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Frontend (S3 + CloudFront)                            │ │
│  │  - Static HTML/CSS/JS                                  │ │
│  │  - Google OAuth Client                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS Cloud                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  CloudFront CDN (HTTPS/SSL)                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Gateway (REST API)                                │ │
│  │  - /tasks (GET, POST)                                  │ │
│  │  - /tasks/{id} (PUT, DELETE)                           │ │
│  │  - /tasks/sync (POST)                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Lambda Functions                                      │ │
│  │  - getTasks, createTask, updateTask                    │ │
│  │  - deleteTask, syncTasks                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  DynamoDB                                              │ │
│  │  Table: TodoTasks-{environment}                        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Required Tools

1. **AWS CLI** (version 2.x or later)
   ```bash
   # Install on macOS
   brew install awscli
   
   # Install on Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Install on Windows
   # Download and run: https://awscli.amazonaws.com/AWSCLIV2.msi
   
   # Verify installation
   aws --version
   ```

2. **Node.js and npm** (version 18.x or later)
   ```bash
   # Check version
   node --version
   npm --version
   ```

3. **zip utility** (usually pre-installed on Unix systems)
   ```bash
   # Verify
   zip --version
   ```

### AWS Account Setup

1. **AWS Account**: You need an active AWS account with appropriate permissions

2. **AWS Credentials**: Configure AWS CLI with your credentials
   ```bash
   aws configure
   ```
   
   You'll need:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region (e.g., `us-east-1`)
   - Default output format (e.g., `json`)

3. **Required IAM Permissions**: Your AWS user/role needs permissions for:
   - CloudFormation (create/update/delete stacks)
   - S3 (create buckets, upload objects)
   - CloudFront (create distributions, invalidate cache)
   - Lambda (create functions, update code)
   - API Gateway (create APIs, deploy stages)
   - DynamoDB (create tables)
   - IAM (create roles and policies)
   - CloudWatch Logs (create log groups)

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen
6. Create OAuth 2.0 Client ID for "Web application"
7. Add authorized JavaScript origins:
   - `http://localhost:8000` (for local testing)
   - Your CloudFront URL (after deployment)
8. Add authorized redirect URIs:
   - `http://localhost:8000` (for local testing)
   - Your CloudFront URL (after deployment)
9. Save the Client ID for deployment

## AWS Resources

The CloudFormation template creates the following resources:

### Frontend Resources
- **S3 Bucket**: Hosts static frontend files (HTML, CSS, JS)
- **CloudFront Distribution**: CDN for global content delivery with HTTPS
- **Bucket Policy**: Allows public read access to frontend files

### Backend Resources
- **API Gateway**: REST API with CORS support
- **Lambda Functions** (5 total):
  - `getTasks-{env}`: Retrieve user's tasks
  - `createTask-{env}`: Create new task
  - `updateTask-{env}`: Update existing task
  - `deleteTask-{env}`: Delete task
  - `syncTasks-{env}`: Batch sync operations
- **IAM Role**: Lambda execution role with DynamoDB permissions
- **CloudWatch Log Groups**: One per Lambda function (14-day retention)

### Data Storage
- **DynamoDB Table**: `TodoTasks-{environment}`
  - Partition Key: `userId` (String)
  - Sort Key: `taskId` (String)
  - Billing: On-demand (pay per request)
  - Features: Point-in-time recovery, encryption at rest

## Deployment

### Initial Deployment

1. **Navigate to the infrastructure directory**:
   ```bash
   cd infrastructure
   ```

2. **Make the deployment script executable** (Unix/Linux/macOS):
   ```bash
   chmod +x deploy.sh
   ```

3. **Run the deployment script**:
   ```bash
   ./deploy.sh -e <environment> -c <google-client-id>
   ```
   
   Example:
   ```bash
   ./deploy.sh -e dev -c 123456789-abc.apps.googleusercontent.com
   ```

4. **Optional parameters**:
   ```bash
   ./deploy.sh -e dev \
               -c 123456789-abc.apps.googleusercontent.com \
               -r us-west-2 \
               -s my-custom-stack-name
   ```

### Deployment Options

| Option | Description | Required | Default |
|--------|-------------|----------|---------|
| `-e` | Environment (dev, staging, prod) | Yes | - |
| `-c` | Google OAuth Client ID | Yes | - |
| `-r` | AWS Region | No | us-east-1 |
| `-s` | CloudFormation Stack Name | No | todo-app-{env} |
| `-h` | Display help message | No | - |

### What the Deployment Script Does

1. ✓ Validates CloudFormation template
2. ✓ Packages Lambda functions with dependencies
3. ✓ Deploys CloudFormation stack
4. ✓ Updates Lambda function code
5. ✓ Deploys frontend files to S3
6. ✓ Invalidates CloudFront cache
7. ✓ Displays deployment outputs

### Post-Deployment Steps

After deployment completes:

1. **Note the outputs** displayed by the script:
   - Frontend URL (CloudFront)
   - API Gateway URL
   - S3 Bucket name
   - DynamoDB Table name

2. **Update Google OAuth settings**:
   - Add the CloudFront URL to authorized JavaScript origins
   - Add the CloudFront URL to authorized redirect URIs

3. **Update frontend configuration**:
   ```bash
   cd ../frontend
   # Edit config.js to add production environment
   ```
   
   Update the production config:
   ```javascript
   production: {
     apiBaseUrl: 'https://xxxxx.execute-api.us-east-1.amazonaws.com/prod',
     googleClientId: 'your-google-client-id'
   }
   ```

4. **Re-deploy frontend** (if config was updated):
   ```bash
   aws s3 sync ../frontend s3://your-bucket-name/ \
     --exclude "*.test.js" \
     --exclude "*.md" \
     --delete
   
   aws cloudfront create-invalidation \
     --distribution-id YOUR_DISTRIBUTION_ID \
     --paths "/*"
   ```

5. **Test the application**:
   - Open the CloudFront URL in your browser
   - Test Google OAuth sign-in
   - Create, update, and delete tasks
   - Verify data persistence

## Configuration

### Environment Variables

The Lambda functions use the following environment variables (automatically set by CloudFormation):

- `GOOGLE_CLIENT_ID`: Google OAuth Client ID
- `DYNAMODB_TABLE_NAME`: DynamoDB table name
- `ENVIRONMENT`: Deployment environment (dev/staging/prod)

### Frontend Configuration

Update `frontend/config.js` with environment-specific settings:

```javascript
const config = {
  local: {
    apiBaseUrl: 'http://localhost:3000',
    googleClientId: 'YOUR_LOCAL_CLIENT_ID'
  },
  development: {
    apiBaseUrl: 'https://xxxxx.execute-api.us-east-1.amazonaws.com/dev',
    googleClientId: 'YOUR_DEV_CLIENT_ID'
  },
  staging: {
    apiBaseUrl: 'https://xxxxx.execute-api.us-east-1.amazonaws.com/staging',
    googleClientId: 'YOUR_STAGING_CLIENT_ID'
  },
  production: {
    apiBaseUrl: 'https://xxxxx.execute-api.us-east-1.amazonaws.com/prod',
    googleClientId: 'YOUR_PROD_CLIENT_ID'
  }
}

// Auto-detect environment based on hostname
const environment = window.location.hostname === 'localhost' ? 'local' :
                   window.location.hostname.includes('staging') ? 'staging' :
                   window.location.hostname.includes('dev') ? 'development' :
                   'production'

export default config[environment]
```

## Updating Deployments

### Updating Lambda Functions Only

If you only changed Lambda function code:

```bash
# Package Lambda functions
cd backend/lambda
zip -r ../../infrastructure/lambda-functions.zip .
cd ../../infrastructure

# Update each function
aws lambda update-function-code \
  --function-name getTasks-dev \
  --zip-file fileb://lambda-functions.zip

# Repeat for other functions: createTask, updateTask, deleteTask, syncTasks
```

### Updating Frontend Only

If you only changed frontend files:

```bash
# Get bucket name from stack outputs
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name todo-app-dev \
  --query "Stacks[0].Outputs[?OutputKey=='S3BucketName'].OutputValue" \
  --output text)

# Sync frontend files
aws s3 sync frontend/ s3://$BUCKET_NAME/ \
  --exclude "*.test.js" \
  --exclude "*.md" \
  --delete

# Get distribution ID
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name todo-app-dev \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"
```

### Updating Infrastructure

If you changed the CloudFormation template:

```bash
# Re-run the deployment script
./deploy.sh -e dev -c YOUR_GOOGLE_CLIENT_ID
```

CloudFormation will automatically detect and apply only the changes.

### Full Redeployment

To redeploy everything:

```bash
./deploy.sh -e dev -c YOUR_GOOGLE_CLIENT_ID
```

## Rollback Procedures

### Rollback CloudFormation Stack

If a deployment fails or causes issues:

```bash
# List stack events to identify the issue
aws cloudformation describe-stack-events \
  --stack-name todo-app-dev \
  --max-items 20

# Rollback to previous version
aws cloudformation rollback-stack \
  --stack-name todo-app-dev
```

### Rollback Lambda Functions

Lambda automatically keeps previous versions:

```bash
# List function versions
aws lambda list-versions-by-function \
  --function-name getTasks-dev

# Update to specific version
aws lambda update-function-configuration \
  --function-name getTasks-dev \
  --environment Variables={...}
```

### Rollback Frontend

S3 versioning is enabled, so you can restore previous versions:

```bash
# List object versions
aws s3api list-object-versions \
  --bucket your-bucket-name \
  --prefix index.html

# Restore specific version
aws s3api copy-object \
  --bucket your-bucket-name \
  --copy-source your-bucket-name/index.html?versionId=VERSION_ID \
  --key index.html
```

### Emergency Rollback

If you need to quickly rollback everything:

1. Delete the current stack:
   ```bash
   aws cloudformation delete-stack --stack-name todo-app-dev
   ```

2. Redeploy the previous working version:
   ```bash
   git checkout <previous-commit>
   ./deploy.sh -e dev -c YOUR_GOOGLE_CLIENT_ID
   ```

## Monitoring and Troubleshooting

### CloudWatch Logs

View Lambda function logs:

```bash
# List log streams
aws logs describe-log-streams \
  --log-group-name /aws/lambda/getTasks-dev \
  --order-by LastEventTime \
  --descending

# Tail logs in real-time
aws logs tail /aws/lambda/getTasks-dev --follow
```

### CloudWatch Metrics

Monitor key metrics:

```bash
# Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=getTasks-dev \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum

# API Gateway requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=todo-api-dev \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### Common Issues

#### Issue: Lambda function timeout

**Symptoms**: 502 Bad Gateway errors, timeout errors in logs

**Solution**:
```bash
# Increase timeout (max 900 seconds)
aws lambda update-function-configuration \
  --function-name getTasks-dev \
  --timeout 60
```

#### Issue: DynamoDB throttling

**Symptoms**: 400 errors, "ProvisionedThroughputExceededException"

**Solution**: The table uses on-demand billing, so this shouldn't happen. If it does, check for:
- Excessive request rates
- Hot partition keys
- Consider using batch operations

#### Issue: CORS errors

**Symptoms**: Browser console shows CORS errors

**Solution**:
- Verify API Gateway CORS configuration
- Check that OPTIONS methods are configured
- Ensure Lambda functions return proper CORS headers

#### Issue: Authentication failures

**Symptoms**: 401 Unauthorized errors

**Solution**:
- Verify Google Client ID is correct in Lambda environment variables
- Check that the token is being sent in Authorization header
- Verify Google OAuth redirect URIs are configured correctly

### Debugging Tips

1. **Enable detailed CloudWatch logging**:
   ```javascript
   // Add to Lambda functions
   console.log('Event:', JSON.stringify(event, null, 2));
   console.log('Context:', JSON.stringify(context, null, 2));
   ```

2. **Test Lambda functions directly**:
   ```bash
   aws lambda invoke \
     --function-name getTasks-dev \
     --payload '{"headers":{"Authorization":"Bearer test-token"}}' \
     response.json
   ```

3. **Check API Gateway logs**:
   ```bash
   aws logs tail /aws/apigateway/todo-api-dev --follow
   ```

## Cost Estimates

### Monthly Cost Breakdown (Approximate)

**Development Environment (Low Traffic)**:
- CloudFront: $1-5 (first 1TB free tier)
- S3: $0.50-2 (storage + requests)
- API Gateway: $3.50 per million requests
- Lambda: $0.20 per million requests (first 1M free)
- DynamoDB: $1.25 per million write requests (on-demand)
- CloudWatch Logs: $0.50-2 (first 5GB free)

**Total: ~$5-15/month** for development with minimal traffic

**Production Environment (Moderate Traffic)**:
- Assuming 100K requests/month
- CloudFront: $5-10
- S3: $2-5
- API Gateway: $0.35
- Lambda: $0.02
- DynamoDB: $1-5 (depends on data size)
- CloudWatch: $2-5

**Total: ~$10-30/month** for production with moderate traffic

### Cost Optimization Tips

1. **Use CloudFront caching** to reduce API Gateway and Lambda invocations
2. **Enable S3 lifecycle policies** to archive old data
3. **Use DynamoDB on-demand billing** for variable workloads
4. **Set CloudWatch log retention** to 7-14 days
5. **Delete unused stacks** in development environments
6. **Use AWS Cost Explorer** to monitor and optimize costs

### Free Tier Benefits

AWS Free Tier includes (for 12 months):
- Lambda: 1M requests/month
- DynamoDB: 25GB storage, 25 read/write capacity units
- CloudFront: 50GB data transfer out
- S3: 5GB storage, 20K GET requests, 2K PUT requests
- API Gateway: 1M API calls/month (12 months)

## Resource Cleanup

### Delete Entire Stack

To completely remove all AWS resources:

```bash
# Delete CloudFormation stack
aws cloudformation delete-stack --stack-name todo-app-dev

# Wait for deletion to complete
aws cloudformation wait stack-delete-complete --stack-name todo-app-dev
```

**Note**: This will delete:
- All Lambda functions
- API Gateway
- DynamoDB table (and all data!)
- CloudWatch log groups
- IAM roles

### Manual Cleanup

Some resources may need manual deletion:

1. **S3 Bucket**: Must be emptied before deletion
   ```bash
   # Empty bucket
   aws s3 rm s3://your-bucket-name --recursive
   
   # Delete bucket
   aws s3 rb s3://your-bucket-name
   ```

2. **CloudFront Distribution**: Must be disabled first
   ```bash
   # Disable distribution
   aws cloudfront update-distribution \
     --id YOUR_DIST_ID \
     --if-match ETAG \
     --distribution-config file://disabled-config.json
   
   # Wait for deployment
   aws cloudfront wait distribution-deployed --id YOUR_DIST_ID
   
   # Delete distribution
   aws cloudfront delete-distribution \
     --id YOUR_DIST_ID \
     --if-match NEW_ETAG
   ```

### Verify Cleanup

```bash
# Check for remaining resources
aws cloudformation list-stacks \
  --stack-status-filter DELETE_COMPLETE

aws s3 ls | grep todo-app

aws lambda list-functions | grep todo
```

## Additional Resources

- [AWS CloudFormation Documentation](https://docs.aws.amazon.com/cloudformation/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Amazon API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [Amazon DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)

## Support

For issues or questions:
1. Check CloudWatch logs for error messages
2. Review the troubleshooting section above
3. Consult AWS documentation
4. Check the main project README.md

## Security Best Practices

1. **Never commit AWS credentials** to version control
2. **Use IAM roles** with least-privilege permissions
3. **Enable CloudTrail** for audit logging
4. **Rotate Google OAuth credentials** regularly
5. **Enable MFA** on AWS root account
6. **Use AWS Secrets Manager** for sensitive configuration
7. **Enable DynamoDB encryption** at rest (enabled by default)
8. **Use HTTPS only** for all communications
9. **Implement rate limiting** on API Gateway
10. **Regular security audits** using AWS Security Hub
