// api/config.js
export default function handler(req, res) {
  res.status(200).json({
    url: process.env.SUPABASE_URL,
    anon: process.env.SUPABASE_ANON_KEY,
  });
}