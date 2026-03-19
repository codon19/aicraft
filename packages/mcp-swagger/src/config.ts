export const BASE_URL = process.env.SWAGGER_BASE_URL;
if (!BASE_URL) {
  process.stderr.write(
    "Error: SWAGGER_BASE_URL environment variable is required.\n",
  );
  process.exit(1);
}

export const EMBEDDING_API_KEY = process.env.OPENAI_API_KEY || "";
export const EMBEDDING_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "text-embedding-3-small";
