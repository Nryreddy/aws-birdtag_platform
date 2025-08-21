import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const uploadBucket = "birdtag-bucket154";
const URL_EXPIRATION_SECONDS = 300;

const getFileExtension = (filename) => {
  const parts = filename.split(".");
  if (parts.length < 2) {
    return { name: filename, extension: "" };
  }

  const extension = "." + parts.pop();
  const name = parts.join(".");
  return { name, extension };
};

export const handler = async (event) => {
  try {
    const queryParams = event.queryStringParameters || {};
    const originalFilename = queryParams.filename;

    if (!originalFilename) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Filename is required" }),
      };
    }

    const { name, extension } = getFileExtension(originalFilename);
    const folderName = "raw_uploads";
    const Key = `${folderName}/${name}-${Date.now()}-${Math.floor(
      Math.random() * 1000000
    )}${extension}`;

    const post = await createPresignedPost(s3, {
      Bucket: uploadBucket,
      Key,
      Expires: URL_EXPIRATION_SECONDS,
      Conditions: [
        ["content-length-range", 0, 104857600], // Limit: 100MB
      ],
      Fields: {
        key: Key,
      },
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify(post),
    };
  } catch (error) {
    console.error("Error generating presigned POST URL:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
1;
