# API Gateway REST API

resource "aws_api_gateway_rest_api" "todo_api" {
  name        = "todo-api-${var.environment}"
  description = "Todo App REST API with Google OAuth"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = local.common_tags
}

# API Gateway Resources
resource "aws_api_gateway_resource" "tasks" {
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  parent_id   = aws_api_gateway_rest_api.todo_api.root_resource_id
  path_part   = "tasks"
}

resource "aws_api_gateway_resource" "task_id" {
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  parent_id   = aws_api_gateway_resource.tasks.id
  path_part   = "{taskId}"
}

resource "aws_api_gateway_resource" "sync" {
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  parent_id   = aws_api_gateway_resource.tasks.id
  path_part   = "sync"
}

# API Gateway Methods and Integrations
locals {
  api_methods = {
    # GET /tasks
    get_tasks = {
      resource_id   = aws_api_gateway_resource.tasks.id
      http_method   = "GET"
      function_name = "getTasks"
    }
    # POST /tasks
    create_task = {
      resource_id   = aws_api_gateway_resource.tasks.id
      http_method   = "POST"
      function_name = "createTask"
    }
    # PUT /tasks/{taskId}
    update_task = {
      resource_id   = aws_api_gateway_resource.task_id.id
      http_method   = "PUT"
      function_name = "updateTask"
    }
    # DELETE /tasks/{taskId}
    delete_task = {
      resource_id   = aws_api_gateway_resource.task_id.id
      http_method   = "DELETE"
      function_name = "deleteTask"
    }
    # POST /tasks/sync
    sync_tasks = {
      resource_id   = aws_api_gateway_resource.sync.id
      http_method   = "POST"
      function_name = "syncTasks"
    }
  }

  cors_methods = {
    tasks_options = {
      resource_id     = aws_api_gateway_resource.tasks.id
      allowed_methods = "GET,POST,OPTIONS"
    }
    task_id_options = {
      resource_id     = aws_api_gateway_resource.task_id.id
      allowed_methods = "PUT,DELETE,OPTIONS"
    }
    sync_options = {
      resource_id     = aws_api_gateway_resource.sync.id
      allowed_methods = "POST,OPTIONS"
    }
  }
}

# API Gateway Methods
resource "aws_api_gateway_method" "methods" {
  for_each = local.api_methods

  rest_api_id   = aws_api_gateway_rest_api.todo_api.id
  resource_id   = each.value.resource_id
  http_method   = each.value.http_method
  authorization = "NONE"
}

# API Gateway Integrations
resource "aws_api_gateway_integration" "integrations" {
  for_each = local.api_methods

  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  resource_id = each.value.resource_id
  http_method = aws_api_gateway_method.methods[each.key].http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.functions[each.value.function_name].invoke_arn
}

# API Gateway Method Responses
resource "aws_api_gateway_method_response" "responses" {
  for_each = local.api_methods

  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  resource_id = each.value.resource_id
  http_method = aws_api_gateway_method.methods[each.key].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

# CORS OPTIONS Methods
resource "aws_api_gateway_method" "cors_methods" {
  for_each = local.cors_methods

  rest_api_id   = aws_api_gateway_rest_api.todo_api.id
  resource_id   = each.value.resource_id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_integrations" {
  for_each = local.cors_methods

  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  resource_id = each.value.resource_id
  http_method = aws_api_gateway_method.cors_methods[each.key].http_method

  type = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cors_responses" {
  for_each = local.cors_methods

  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  resource_id = each.value.resource_id
  http_method = aws_api_gateway_method.cors_methods[each.key].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "cors_integration_responses" {
  for_each = local.cors_methods

  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  resource_id = each.value.resource_id
  http_method = aws_api_gateway_method.cors_methods[each.key].http_method
  status_code = aws_api_gateway_method_response.cors_responses[each.key].status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'${each.value.allowed_methods}'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  response_templates = {
    "application/json" = ""
  }
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "deployment" {
  depends_on = [
    aws_api_gateway_method.methods,
    aws_api_gateway_integration.integrations,
    aws_api_gateway_method.cors_methods,
    aws_api_gateway_integration.cors_integrations,
  ]

  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  stage_name  = var.environment

  # Force redeployment when configuration changes
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.tasks.id,
      aws_api_gateway_resource.task_id.id,
      aws_api_gateway_resource.sync.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Lambda Permissions for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  for_each = local.api_methods

  statement_id  = "AllowExecutionFromAPIGateway-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions[each.value.function_name].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.todo_api.execution_arn}/*/*/*"
}