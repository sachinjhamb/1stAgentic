# Outputs

output "cloudfront_url" {
  description = "CloudFront Distribution URL"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "api_gateway_url" {
  description = "API Gateway Endpoint URL"
  value       = "https://${aws_api_gateway_rest_api.todo_api.id}.execute-api.${local.region}.amazonaws.com/${var.environment}"
}

output "dynamodb_table_name" {
  description = "DynamoDB Table Name"
  value       = aws_dynamodb_table.todo_tasks.name
}

output "s3_bucket_name" {
  description = "S3 Bucket Name for Frontend"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "lambda_function_arns" {
  description = "Lambda Function ARNs"
  value = {
    for name, func in aws_lambda_function.functions : name => func.arn
  }
}

output "lambda_function_names" {
  description = "Lambda Function Names"
  value = {
    for name, func in aws_lambda_function.functions : name => func.function_name
  }
}

output "api_gateway_id" {
  description = "API Gateway REST API ID"
  value       = aws_api_gateway_rest_api.todo_api.id
}

output "deployment_info" {
  description = "Deployment information"
  value = {
    environment  = var.environment
    region       = local.region
    account_id   = local.account_id
    frontend_url = "https://${aws_cloudfront_distribution.frontend.domain_name}"
    api_url      = "https://${aws_api_gateway_rest_api.todo_api.id}.execute-api.${local.region}.amazonaws.com/${var.environment}"
  }
}