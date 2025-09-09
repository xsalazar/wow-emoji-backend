import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { DeleteMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import * as fs from "fs";

export const handler = async (event, context) => {
  console.log(JSON.stringify(event));
  const s3 = new S3Client();
  const sqs = new SQSClient();

  // Check if this was triggered by SQS
  if (event.Records && event.Records.length > 0) {
    // Process each record, and save data to S3
    for (let i = 0; i < event.Records.length; i++) {
      const record = event.Records[i];

      const { body, receiptHandle } = record;

      var parsedBody = JSON.parse(body);
      const token = parsedBody.token;
      console.log(`Processing message: ${token}`);

      // Load rembg data from S3
      const imageBuffer = Buffer.concat(
        await (
          await s3.send(
            new GetObjectCommand({
              Bucket: process.env.WOW_EMOJI_DATA_S3_BUCKET,
              Key: `${token}-input-rembg`,
            })
          )
        ).Body.toArray()
      );

      // Load gif from S3
      var gifId = parsedBody.requestedBackground;
      const gifBuffer = Buffer.concat(
        await (
          await s3.send(
            new GetObjectCommand({
              Bucket: process.env.WOW_EMOJI_GIFS_S3_BUCKET,
              Key: `${gifId}-500.webp`,
            })
          )
        ).Body.toArray()
      );

      console.log("Wowifying");

      // Overlay 500-px image on top of gif
      const wowifiedOriginalSizePath = `/tmp/${uuidv4()}.webp`;
      await sharp(gifBuffer, {
        animated: true,
      })
        .composite([
          {
            input: imageBuffer,
            tile: true,
            top: 0,
            left: 0,
          },
        ])
        .webp()
        .toFile(wowifiedOriginalSizePath);

      // Resize 500-px to 64-px version
      const wowifiedSmallSizePath = `/tmp/${uuidv4()}.webp`;
      await sharp(wowifiedOriginalSizePath, { animated: true })
        .resize({ width: 64, height: 64 })
        .webp({ effort: 6 })
        .toFile(wowifiedSmallSizePath);

      // Generate original and small size data
      const originalSize = (
        await sharp(wowifiedOriginalSizePath, {
          animated: true,
        }).toBuffer()
      ).toString("base64");

      const smallSize = (
        await sharp(wowifiedSmallSizePath, {
          animated: true,
        }).toBuffer()
      ).toString("base64");

      console.log("Cleaning up");
      fs.unlinkSync(wowifiedOriginalSizePath);
      fs.unlinkSync(wowifiedSmallSizePath);

      console.log("Saving data to S3");
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.WOW_EMOJI_DATA_S3_BUCKET,
          Key: token,
          ContentType: "application/json",
          Body: JSON.stringify({
            wowifiedOriginal: originalSize,
            wowifiedSmall: smallSize,
          }),
        })
      );

      console.log(`Deleting message: ${token}`);
      await sqs.send(
        new DeleteMessageCommand({
          QueueUrl: process.env.WOW_EMOJI_COMBINER_INPUT_QUEUE,
          ReceiptHandle: receiptHandle,
        })
      );
    }
  }
};
