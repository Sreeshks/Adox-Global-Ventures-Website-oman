declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CMS_AUTH_MODE?: string;
    BUCKET?: R2Bucket;
  }
}
