import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import * as fs from "fs";

export const handler = async (event, context) => {
  console.log(JSON.stringify(event));
  const s3 = new S3Client();
  const sqs = new SQSClient();

  // Check S3 for result, return it, if found
  if (
    event.queryStringParameters &&
    event.queryStringParameters.wowToken &&
    event.requestContext.http.method === "GET"
  ) {
    const token = event.queryStringParameters.wowToken;

    try {
      // Check if data has finished processing
      await s3.send(
        new HeadObjectCommand({
          Bucket: process.env.WOW_EMOJI_DATA_S3_BUCKET,
          Key: token,
        })
      );

      // If call above doesn't fail, get data
      const dataBuffer = Buffer.concat(
        await (
          await s3.send(
            new GetObjectCommand({
              Bucket: process.env.WOW_EMOJI_DATA_S3_BUCKET,
              Key: token,
            })
          )
        ).Body.toArray()
      );

      // Delete object after retrieval
      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.WOW_EMOJI_DATA_S3_BUCKET,
          Key: token,
        })
      );

      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.WOW_EMOJI_DATA_S3_BUCKET,
          Key: `${token}-input`,
        })
      );

      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.WOW_EMOJI_DATA_S3_BUCKET,
          Key: `${token}-input-rembg`,
        })
      );

      return {
        cookies: [],
        isBase64Encoded: false,
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: dataBuffer.toString(),
      };
    } catch (e) {
      console.log(JSON.stringify(e));

      return {
        cookies: [],
        isBase64Encoded: false,
        statusCode: 404, // Processing
        headers: {},
        body: "",
      };
    }
  }

  // Otherwise, check for image data to submit to SQS and return token to poll with
  else if (event.body && event.requestContext.http.method === "PUT") {
    const token = uuidv4();
    let requestedBackground = "";

    // Check if we're even adding something normal to begin with
    // TODO

    // Choose a background gif
    if (
      event.queryStringParameters &&
      event.queryStringParameters.backgroundId
    ) {
      requestedBackground = event.queryStringParameters.backgroundId;
    } else {
      const gifIds = (
        await s3.send(
          new ListObjectsV2Command({
            Bucket: process.env.WOW_EMOJI_GIFS_S3_BUCKET,
          })
        )
      ).Contents.map((c) => c.Key.split("-")[0]).sort();

      requestedBackground = gifIds[Math.floor(Math.random() * gifIds.length)];
    }

    // Normalize input file before saving to S3
    const normalizedFileBuffer = await sharp(Buffer.from(event.body, "base64"))
      .rotate()
      .resize({
        width: 500,
        height: 500,
      })
      .png()
      .toBuffer();

    try {
      // Send message to SQS with content to be processed and token
      console.log(`Adding message to queue: ${token}`);

      // Add normalized input file to S3
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.WOW_EMOJI_DATA_S3_BUCKET,
          Key: `${token}-input`,
          Body: normalizedFileBuffer,
          ContentType: "image/png",
        })
      );

      // Put message on queue for processing
      await sqs.send(
        new SendMessageCommand({
          MessageBody: JSON.stringify({
            token: token,
            requestedBackground: requestedBackground,
          }),
          QueueUrl: process.env.WOW_EMOJI_REMBG_INPUT_QUEUE,
        })
      );

      return {
        cookies: [],
        isBase64Encoded: false,
        statusCode: 202,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token }),
      };
    } catch (e) {
      console.log(JSON.stringify(e));

      return {
        cookies: [],
        isBase64Encoded: false,
        statusCode: 500,
        headers: {},
        body: "",
      };
    }
  } else if (
    event.queryStringParameters &&
    event.queryStringParameters.thumbnails &&
    event.requestContext.http.method === "GET"
  ) {
    try {
      const ret = JSON.parse(fs.readFileSync("./thumbnails.json").toString());

      return {
        cookies: [],
        isBase64Encoded: false,
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ret),
      };
    } catch (e) {
      console.log(JSON.stringify(e));

      return {
        cookies: [],
        isBase64Encoded: false,
        statusCode: 500,
        headers: {},
        body: "",
      };
    }
  }
};
