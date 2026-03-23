terraform {
  required_version = "~> 1.10.2"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.34.0"
    }
  }
  backend "s3" {
    bucket = "xsalazar-terraform-state"
    key    = "wow-emoji/terraform.tfstate"
    region = "us-west-2"
  }
}

provider "aws" {
  region = "us-west-2"
  default_tags {
    tags = {
      CreatedBy = "terraform"
    }
  }
}

output "ecr_repository_name" {
  value = aws_ecr_repository.instance.name
}

output "api_lambda_function" {
  value = aws_lambda_function.api.function_name
}

output "rembg_lambda_function" {
  value = aws_lambda_function.rembg.function_name
}

output "combiner_lambda_function" {
  value = aws_lambda_function.combiner.function_name
}
