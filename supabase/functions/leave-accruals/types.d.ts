// Type declarations for Deno runtime in Supabase Edge Functions
// These types are available at runtime but TypeScript doesn't recognize them in Node.js context

declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined
  }
}

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

