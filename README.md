# 🌈 Wow Emoji Backend

This repository holds both the Terraform infrastructure as well as the Javascript and Python applications that run inside AWS Lambda.

The core application code is an "image wowing" service that takes an input image, removes the background, and overlays it on top of a colorful gif. This application leverages the [`sharp`](https://sharp.pixelplumbing.com/) library for quick, high-quality image manipulation and [`rembg`](https://github.com/danielgatis/rembg) for background removal

The infrastructure supporting this backend application is an API Gateway that forwards valid requests to the Lambda function.

Depending on the nature of the request, the journey is as follows:

- API

  - Lambda receives a request to enqueue an image for processing, the Lambda will generate a unique token to give back to the client to use to poll the API
  - Lambda will store the original image in S3
  - Lambda will put a message on an SQS queue with the token, indicating it needs to be processed

- rembg

  - The SQS queue will trigger a Lambda invocation upon receiving a message on its queue
  - Lambda will find the image for the corresponding token in S3
  - Lambda will then remove the background, and put the result back in S3
  - Lambda will put a message on a new SQS queue with the token, indicating it needs to be processed
  - Lambda will delete the message from the original SQS if successful

- combiner

  - The SQS queue will trigger a Lambda invocation upon receiving a message on its queue
  - Lambda will find the image for the corresponding token in S3
  - Lambda will then overlay the image on top of a gif, and put the result back in S3

- Client

  - The API will return a `token` for the client to poll the API with
  - If the `token` result is in S3, Lambda will download the result, delete all original content in S3, and return the result to the client

This backend application is used to support the website [https://wowemoji.dev](https://wowemoji.dev) for quick and reliable wowifications.

## Getting Started

This repository leverages [VSCode's devcontainer](https://code.visualstudio.com/docs/remote/containers) feature to ensure all necessary dependencies are available inside the container for development.

### Application

The application code for this repository is contained in the respective directories.

To get started:

#### api

```bash
cd src/api/ && npm install
```

#### combiner

```bash
cd src/combiner/ && npm install
```

#### rembg

```bash
cd src/rembg/ && pip install -r requirements.txt
```

All application deployments are managed via GitHub Actions in the [`./.github/workflows/`](./.github/workflows/) directory.

### Infrastructure

The infrastructure code for this repository is contained in the [`./terraform`](./terraform) directory. The required Terraform version is `1.10.2`. The AWS artifacts managed in this repository are illustrated below.

To get started:

```bash
cd terraform/ && terraform init
```

All infrastructure deployments are managed via GitHub Actions and the [`./.github/workflows/deploy-infrastructure.yml`](./.github/workflows/deploy-infrastructure.yml) workflow.

![](./assets/architecture.svg)
