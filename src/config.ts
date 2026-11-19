import "dotenv/config";

export const DISCORD_TOKEN: string = process.env.DISCORD_TOKEN || "";
export const PREFIX: string = process.env.PREFIX || "!";
export const PORT: number = Number(process.env.PORT) || 3000;
export const YOUTUBE_COOKIE: string | undefined = process.env.YOUTUBE_COOKIE || undefined;

export const config = {
  DISCORD_TOKEN,
  PREFIX,
  PORT,
  YOUTUBE_COOKIE,
};

export default config;
