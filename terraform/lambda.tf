// API Handler
resource "aws_lambda_function" "api" {
  function_name = "wow-emoji-api"
  filename      = "${path.module}/dummy-node-lambda-package/lambda.zip" // Simple hello world application
  handler       = "index.handler"
  role          = aws_iam_role.instance.arn
  timeout       = 30  // seconds
  memory_size   = 512 // MB
  runtime       = "nodejs22.x"

  environment {
    variables = {
      WOW_EMOJI_REMBG_INPUT_QUEUE = aws_sqs_queue.rembg_input.url
      WOW_EMOJI_DATA_S3_BUCKET    = aws_s3_bucket.data.bucket
      WOW_EMOJI_GIFS_S3_BUCKET    = aws_s3_bucket.gifs.bucket
    }
  }

  ephemeral_storage {
    size = 4096 # Min 512 MB and the Max 10240 MB
  }

  // CI/CD will deploy updates to the Lambda functions outside of Terraform, so ignore future changes
  // Since CI/CD will deploy this application externally, these do not need to be tracked after creation
  lifecycle {
    ignore_changes = [
      source_code_hash,
    ]
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${aws_lambda_function.api.function_name}"
  retention_in_days = 30 // days
}

// Image background remover
resource "aws_lambda_function" "rembg" {
  function_name = "wow-emoji-rembg"
  image_uri     = "foo:bar"
  role          = aws_iam_role.instance.arn
  timeout       = 180   // seconds
  memory_size   = 10240 // MB
  package_type  = "Image"

  environment {
    variables = {
      WOW_EMOJI_REMBG_INPUT_QUEUE    = aws_sqs_queue.rembg_input.url
      WOW_EMOJI_COMBINER_INPUT_QUEUE = aws_sqs_queue.combiner_input.url
      WOW_EMOJI_DATA_S3_BUCKET       = aws_s3_bucket.data.bucket
    }
  }

  ephemeral_storage {
    size = 4096 # Min 512 MB and the Max 10240 MB
  }

  // CI/CD will deploy updates to the Lambda functions outside of Terraform, so ignore future changes
  // Since CI/CD will deploy this application externally, these do not need to be tracked after creation
  lifecycle {
    ignore_changes = [
      image_uri
    ]
  }
}

resource "aws_cloudwatch_log_group" "rembg" {
  name              = "/aws/lambda/${aws_lambda_function.rembg.function_name}"
  retention_in_days = 30 // days
}

// Image combiner
resource "aws_lambda_function" "combiner" {
  function_name = "wow-emoji-combiner"
  filename      = "${path.module}/dummy-node-lambda-package/lambda.zip" // Simple hello world application
  handler       = "index.handler"
  role          = aws_iam_role.instance.arn
  timeout       = 30  // seconds
  memory_size   = 512 // MB
  runtime       = "nodejs22.x"

  environment {
    variables = {
      WOW_EMOJI_COMBINER_INPUT_QUEUE = aws_sqs_queue.combiner_input.url
      WOW_EMOJI_DATA_S3_BUCKET       = aws_s3_bucket.data.bucket
      WOW_EMOJI_GIFS_S3_BUCKET       = aws_s3_bucket.gifs.bucket
    }
  }

  ephemeral_storage {
    size = 4096 # Min 512 MB and the Max 10240 MB
  }

  // CI/CD will deploy updates to the Lambda functions outside of Terraform, so ignore future changes
  // Since CI/CD will deploy this application externally, these do not need to be tracked after creation
  lifecycle {
    ignore_changes = [
      source_code_hash,
    ]
  }
}

resource "aws_cloudwatch_log_group" "combiner" {
  name              = "/aws/lambda/${aws_lambda_function.combiner.function_name}"
  retention_in_days = 30 // days
}
