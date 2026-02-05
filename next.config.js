/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
    META_AD_ACCOUNT_ID: process.env.META_AD_ACCOUNT_ID,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
}

module.exports = nextConfig
