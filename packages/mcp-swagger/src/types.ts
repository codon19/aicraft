export interface ApiEndpoint {
  method: string;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  operationId: string;
  parameters: ParameterInfo[];
  requestBody: string;
  responses: Record<string, string>;
  groupName: string;
}

export interface ParameterInfo {
  name: string;
  in: string;
  required: boolean;
  type: string;
  description: string;
}

export interface SwaggerResource {
  name: string;
  url: string;
  location: string;
}

export interface ResourceFingerprint {
  url: string;
  groupName: string;
  etag?: string;
  lastModified?: string;
  contentHash?: string;
}

export type JsonRpcMessage = {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: Record<string, unknown>;
};
