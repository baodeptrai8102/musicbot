import ffmpegPath from "ffmpeg-static";
import { generateDependencyReport } from "@discordjs/voice";
import { Client, GatewayIntentBits } from "discord.js";
import { PlayerManager } from "ziplayer";
import { YouTubePlugin, SoundCloudPlugin, SpotifyPlugin } from "@ziplayer/plugin";
import { config } from "./config.js";
import { startServer } from "./server.js";
import { handleInteraction } from "./events/interactionCreate.js";
import { handleVoiceStateUpdate } from "./events/voiceStateUpdate.js";
import { registerPlayerEvents } from "./events/playerEvents.js";
import { execute as handlePlay } from "./commands/play.js";
import {
  handleSkip,
  handlePause,
  handleResume,
  handleStop,
  handleQueue,
  handleVolume,
  handleLoop,
  handlePrevious,
  handleSeek,
  handlePlayNext,
  handleShuffle,
  handleAutoPlay,
  handleRemove,
  handleMove,
  handleClear,
  handleNowPlaying,
  handleFilter,
} from "./commands/controls.js";
import { handleHelp } from "./commands/help.js";

// 1. Thiết lập ffmpeg-static
if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

// 2. Bộ override globalThis.fetch chống 403/timeout trên hosting
const originalFetch = globalThis.fetch;
globalThis.fetch = async function (
  ...args: Parameters<typeof originalFetch>
): Promise<Response> {
  const [input, init] = args;
  let url = "";
  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input && typeof input === "object" && "url" in input) {
    url = (input as { url: string }).url;
  }

  const lowerUrl = url.toLowerCase();
  const hasRangeHeader = Boolean(
    init?.headers &&
      ((typeof (init.headers as any).has === "function" && (init.headers as any).has("range")) ||
        ("range" in (init.headers as Record<string, any>)) ||
        ("Range" in (init.headers as Record<string, any>)) ||
        (Array.isArray(init.headers) && init.headers.some(([k]) => String(k).toLowerCase() === "range")))
  );

  // Tuyệt đối KHÔNG can thiệp hay gán timeout cho bất kỳ luồng audio stream nào (googlevideo, mime=audio, range, stream, cdn...)
  const isAudioStream =
    lowerUrl.includes("googlevideo") ||
    lowerUrl.includes("videoplayback") ||
    lowerUrl.includes("mime=audio") ||
    lowerUrl.includes("audio") ||
    lowerUrl.includes("stream") ||
    lowerUrl.includes("cdn") ||
    lowerUrl.includes("range") ||
    lowerUrl.includes(".m3u8") ||
    lowerUrl.includes(".mp3") ||
    lowerUrl.includes(".ogg") ||
    lowerUrl.includes(".opus") ||
    lowerUrl.includes(".webm") ||
    lowerUrl.includes(".m4a") ||
    hasRangeHeader;

  if (!isAudioStream && (!init || !init.signal)) {
    const signal = AbortSignal.timeout(12000);
    return originalFetch(input, { ...init, signal });
  }

  return originalFetch(...args);
};

// 3. Khởi tạo PlayerManager singleton
const youtubePlugin = new YouTubePlugin(
  config.YOUTUBE_COOKIE ? ({ cookie: config.YOUTUBE_COOKIE } as any) : undefined
);
const soundcloudPlugin = new SoundCloudPlugin();
const spotifyPlugin = new SpotifyPlugin();

export const manager = new PlayerManager({
  plugins: [youtubePlugin, soundcloudPlugin, spotifyPlugin],
  autoCleanup: true,
});

// 4. Khởi tạo Discord Client
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// 5. Gắn các sự kiện
client.once("clientReady", () => {
  console.log(`Bot logged in as ${client.user?.tag}`);
  console.log(generateDependencyReport());
});
client.on("interactionCreate", handleInteraction);
client.on("voiceStateUpdate", handleVoiceStateUpdate);
registerPlayerEvents(client, manager);

// 6. Định tuyến lệnh prefix !
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith(config.PREFIX)) {
    return;
  }

  const args = message.content.slice(config.PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();
  if (!command) return;

  try {
    switch (command) {
      case "play":
      case "p":
        await handlePlay(message, args);
        break;

      case "playnext":
      case "pn":
        await handlePlayNext(message, args);
        break;

      case "skip":
      case "s":
      case "next":
      case "n":
        await handleSkip(message, args);
        break;

      case "previous":
      case "prev":
      case "back":
        await handlePrevious(message, args);
        break;

      case "pause":
        await handlePause(message, args);
        break;

      case "resume":
        await handleResume(message, args);
        break;

      case "stop":
        await handleStop(message, args);
        break;

      case "seek":
      case "tua":
        await handleSeek(message, args);
        break;

      case "shuffle":
      case "tron":
        await handleShuffle(message, args);
        break;

      case "autoplay":
      case "ap":
        await handleAutoPlay(message, args);
        break;

      case "remove":
      case "xoa":
        await handleRemove(message, args);
        break;

      case "move":
        await handleMove(message, args);
        break;

      case "clear":
        await handleClear(message, args);
        break;

      case "nowplaying":
      case "np":
        await handleNowPlaying(message, args);
        break;

      case "filter":
        await handleFilter(message, args);
        break;

      case "queue":
      case "q":
        await handleQueue(message, args);
        break;

      case "vol":
      case "volume":
        await handleVolume(message, args);
        break;

      case "loop":
        await handleLoop(message, args);
        break;

      case "help":
        await handleHelp(message, config.PREFIX);
        break;

      default:
        break;
    }
  } catch (error) {
    console.error(`Error executing command '${command}':`, error);
  }
});

// 7. Khởi động HTTP server
startServer();

// 8. Chống sập bot
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

// 9. Đăng nhập
if (config.DISCORD_TOKEN) {
  client.login(config.DISCORD_TOKEN);
} else {
  console.warn("No DISCORD_TOKEN provided.");
}
