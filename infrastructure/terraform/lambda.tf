# Lambda Functions

# Create placeholder zip file if the actual one doesn't exist
data "archive_file" "lambda_placeholder" {
  type        = "zip"
  output_path = "${path.module}/lambda-placeholder.zip"
  
  source {
    content = <<EOF
exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: 'Placeholder - deploy actual code' })
  };
};
EOF
    filename = "index.js"
  }
}

# Lambda Functions
resource "aws_lambda_function" "functions" {
  for_each = local.lambda_functions

  function_name = "${each.key}-${var.environment}"
  role         = aws_iam_role.lambda_execution.arn
  handler      = each.value
  runtime      = "nodejs18.x"
  timeout      = var.lambda_timeout
  memory_size  = var.lambda_memory_size

  # Use actual zip file if it exists, otherwise use placeholder
  filename         = fileexists(var.lambda_zip_path) ? var.lambda_zip_path : data.archive_file.lambda_placeholder.output_path
  source_code_hash = fileexists(var.lambda_zip_path) ? filebase64sha256(var.lambda_zip_path) : data.archive_file.lambda_placeholder.output_base64sha256

  environment {
    variables = {
      GOOGLE_CLIENT_ID     = var.google_client_id
      DYNAMODB_TABLE_NAME  = aws_dynamodb_table.todo_tasks.name
      ENVIRONMENT          = var.environment
    }
  }

  tags = local.common_tags
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = local.lambda_functions

  name              = "/aws/lambda/${each.key}-${var.environment}"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = local.common_tags
}