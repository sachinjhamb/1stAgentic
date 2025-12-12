# Todo App Infrastructure - Terraform Configuration
# Google OAuth Authentication with AWS Backend

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Application = "TodoApp"
      ManagedBy   = "Terraform"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Local values
locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
  
  common_tags = {
    Environment = var.environment
    Application = "TodoApp"
    ManagedBy   = "Terraform"
  }

  lambda_functions = {
    getTasks    = "getTasks.handler"
    createTask  = "createTask.handler"
    updateTask  = "updateTask.handler"
    deleteTask  = "deleteTask.handler"
    syncTasks   = "syncTasks.handler"
  }
}