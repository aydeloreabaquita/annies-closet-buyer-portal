export interface Env {
  DB: D1Database;
  RECEIPTS: R2Bucket;
  ASSETS: Fetcher;
  APP_URL: string;
  META_PAGE_ACCESS_TOKEN: string;
  META_VERIFY_TOKEN: string;
  META_APP_SECRET: string;
  META_GRAPH_VERSION: string;
  SESSION_HOURS: string;
  OTP_MINUTES: string;
}
