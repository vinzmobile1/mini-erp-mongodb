import app from "../server";
import { initDatabase } from "../server/db";

export default async function handler(req: any, res: any) {
  try {
    await initDatabase();
  } catch (err) {
    console.error("Vercel DB init error:", err);
  }
  return app(req, res);
}
