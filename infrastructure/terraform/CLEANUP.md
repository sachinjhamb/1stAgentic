# Terraform Cleanup Guide

This guide explains how to safely clean up AWS resources created by the Terraform deployment.

## Available Cleanup Scripts

### 1. PowerShell Cleanup Script (`cleanup.ps1`)
**Recommended for Windows users**

```powershell
# Show what would be deleted (safe preview)
.\cleanup.ps1 -Environment dev -DryRun

# Interactive cleanup with confirmation
.\cleanup.ps1 -Environment dev

# Automated cleanup (no prompts)
.\cleanup.ps1 -Environment dev -Force
```

### 2. Bash Cleanup Script (`cleanup.sh`)
**For Linux/Mac users**

```bash
# Make executable (first time only)
chmod +x cleanup.sh

# Show what would be deleted (safe preview)
./cleanup.sh -e dev -d

# Interactive cleanup with confirmation
./cleanup.sh -e dev

# Automated cleanup (no prompts)
./cleanup.sh -e dev -f
```

### 3. Verification Script (`verify-cleanup.ps1`)
**Confirms all resources were deleted**

```powershell
.\verify-cleanup.ps1 -Environment dev
```

## What Gets Cleaned Up

The cleanup scripts will remove:

### AWS Resources
- **Lambda Functions**: All 5 functions (getTasks, createTask, updateTask, deleteTask, syncTasks)
- **API Gateway**: REST API with all methods and deployments
- **S3 Bucket**: Frontend hosting bucket (emptied first, then deleted)
- **CloudFront Distribution**: CDN distribution (disabled then deleted)
- **DynamoDB Table**: Task storage table with all data
- **CloudWatch Log Groups**: All Lambda function logs
- **IAM Role**: Lambda execution role and policies

### Local Files
- `terraform.tfvars` - Your deployment variables
- `lambda-functions.zip` - Lambda deployment package
- `lambda-placeholder.zip` - Temporary placeholder package
- `destroy.tfvars` - Temporary destroy variables

## Safety Features

### 🛡️ **Multiple Safety Layers**

1. **Dry Run Mode**: Preview what would be deleted without actually deleting anything
2. **Confirmation Prompts**: Must type "DESTROY" to confirm deletion
3. **Resource Verification**: Checks what resources exist before attempting deletion
4. **Proper Order**: Empties S3 bucket before attempting to delete it
5. **Error Handling**: Continues cleanup even if some steps fail
6. **State Validation**: Verifies Terraform state exists before cleanup

### 🔍 **Pre-Cleanup Checks**

The scripts verify:
- Terraform is installed and available
- AWS CLI is configured with valid credentials
- Terraform state exists and contains resources
- Current resource information (if available)

### 📋 **Resource Preview**

Before deletion, the scripts show:
- Current S3 bucket name and object count
- CloudFront distribution ID
- DynamoDB table name and approximate item count
- Lambda function names
- Terraform plan preview (when possible)

## Usage Examples

### Safe Exploration
```powershell
# See what resources exist without deleting anything
.\cleanup.ps1 -Environment dev -DryRun
```

### Standard Cleanup
```powershell
# Interactive cleanup with all safety prompts
.\cleanup.ps1 -Environment dev
```

### Automated Cleanup (CI/CD)
```powershell
# For automated environments where prompts aren't possible
.\cleanup.ps1 -Environment dev -Force
```

### Verification
```powershell
# Confirm everything was deleted
.\verify-cleanup.ps1 -Environment dev
```

## Troubleshooting

### Common Issues

**1. "No Terraform state found"**
- This is normal if resources were already cleaned up
- The script will exit safely with no action needed

**2. "S3 bucket not empty" errors**
- The script automatically empties S3 buckets before deletion
- If this fails, manually empty the bucket in AWS Console

**3. "CloudFront distribution cannot be deleted"**
- CloudFront distributions must be disabled before deletion
- This can take 15-20 minutes; wait and retry

**4. "Some resources still exist" after cleanup**
- Run the verification script to see what remains
- Some resources (like CloudFront) take time to fully delete
- Wait a few minutes and verify again

### Manual Cleanup

If scripts fail, you can manually clean up:

```bash
# 1. Empty S3 bucket
aws s3 rm s3://your-bucket-name --recursive

# 2. Run Terraform destroy
terraform destroy -var="environment=dev" -var="google_client_id=placeholder"

# 3. Clean up local files
rm -f terraform.tfvars lambda-functions.zip
```

### Recovery

If cleanup is interrupted:

1. **Check what remains**: Run `.\verify-cleanup.ps1 -Environment dev`
2. **Resume cleanup**: Run the cleanup script again
3. **Manual intervention**: Delete remaining resources in AWS Console if needed

## Best Practices

### 🎯 **Before Cleanup**
- [ ] Backup any important data from DynamoDB
- [ ] Note down any custom configurations
- [ ] Ensure you're cleaning up the correct environment
- [ ] Run with `-DryRun` first to preview changes

### ⚡ **During Cleanup**
- [ ] Don't interrupt the process once started
- [ ] Monitor the output for any errors
- [ ] Be patient - some resources take time to delete

### ✅ **After Cleanup**
- [ ] Run verification script to confirm completion
- [ ] Check AWS Console to verify no unexpected charges
- [ ] Remove any local configuration files if needed

## Cost Implications

Cleanup will stop all charges for:
- Lambda function invocations
- API Gateway requests
- DynamoDB read/write operations
- CloudFront data transfer
- S3 storage and requests

**Note**: Some resources may have minimal charges for a few hours after deletion (like CloudFront distributions).

## Environment-Specific Cleanup

Clean up different environments independently:

```powershell
# Clean up development
.\cleanup.ps1 -Environment dev

# Clean up staging  
.\cleanup.ps1 -Environment staging

# Clean up production (be extra careful!)
.\cleanup.ps1 -Environment prod -DryRun  # Preview first!
.\cleanup.ps1 -Environment prod          # Then cleanup
```

## Integration with CI/CD

For automated pipelines:

```yaml
# Example GitHub Actions step
- name: Cleanup AWS Resources
  run: |
    cd infrastructure/terraform
    ./cleanup.ps1 -Environment ${{ env.ENVIRONMENT }} -Force
  shell: pwsh
```

## Support

If you encounter issues:
1. Check the main Terraform README.md
2. Review AWS Console for resource status
3. Check CloudWatch logs for detailed error messages
4. Use the verification script to identify remaining resources