import type { Client } from "discord.js";
import type { Player, PlayerManager, Track } from "ziplayer";
import { createPlayerUi } from "../ui/playerUi";
import { clearLeaveTimer, startLeaveTimer } from "./voiceStateUpdate";

export type VoltPlayer = Player & {
  id: string;
  data: Record<string, any>;
};

// Map lưu trữ interval cập nhật thanh tiến trình theo guildId
const progressIntervals = new Map<string, NodeJS.Timeout>();

/**
 * Hàm dọn dẹp interval cập nhật tiến trình của guild
 */
export function clearProgressInterval(guildId: string) {
  const timer = progressIntervals.get(guildId);
  if (timer) {
    clearInterval(timer);
    progressIntervals.delete(guildId);
  }
}

/**
 * Khởi chạy interval tự động cập nhật thanh tiến trình an toàn rate limit (mỗi 5s)
 */
export function startProgressInterval(player: VoltPlayer, msg: any) {
  clearProgressInterval(player.id);
  let isUpdating = false;
  const timer = setInterval(async () => {
    // Nếu hết bài hoặc không còn phát nhạc, tự hủy interval
    if (!player.isPlaying || !player.currentTrack) {
      clearProgressInterval(player.id);
      return;
    }
    if (player.isPaused || isUpdating) return;
    isUpdating = true;
    try {
      const ui = createPlayerUi(player);
      await msg.edit(ui);
    } catch (err: any) {
      // nếu tin nhắn bị xóa (10008) hoặc không tìm thấy kênh (10003) thì dọn interval
      if (err?.code === 10008 || err?.code === 10003) {
        clearProgressInterval(player.id);
      }
    } finally {
      isUpdating = false;
    }
  }, 5000);
  progressIntervals.set(player.id, timer);
}

/**
 * Chuẩn hóa player để đảm bảo luôn có thuộc tính id và data
 */
function normalizePlayer(player: Player): VoltPlayer {
  const p = player as VoltPlayer;
  if (!p.id) {
    p.id = (player as any).guildId;
  }
  if (!p.data) {
    p.data = {};
  }
  return p;
}

/**
 * Lấy kênh văn bản từ cache hoặc fetch nếu chưa có trong cache
 */
async function getTextChannel(client: Client, channelId?: string) {
  if (!channelId) return null;
  let channel = client.channels.cache.get(channelId);
  if (!channel) {
    try {
      channel = (await client.channels.fetch(channelId)) ?? undefined;
    } catch {
      channel = undefined;
    }
  }
  return channel && channel.isTextBased() ? channel : null;
}

/**
 * Đăng ký các sự kiện phát nhạc của ZiPlayer
 */
export function registerPlayerEvents(client: Client, manager: PlayerManager): void {
  // 1. trackStart: Khi bắt đầu phát bài hát
  manager.on("trackStart", async (rawPlayer: Player, _track: Track) => {
    const player = normalizePlayer(rawPlayer);
    clearLeaveTimer(player.id);
    clearProgressInterval(player.id);

    setTimeout(async () => {
      const channel = await getTextChannel(client, player.data.textChannelId);
      if (!channel) return;

      // Dọn tin nhắn Now Playing cũ nếu còn tồn tại
      if (player.data.nowPlayingMessageId) {
        try {
          const oldMsg = await (channel as any).messages.fetch(player.data.nowPlayingMessageId);
          if (oldMsg) await oldMsg.delete();
        } catch {}
        player.data.nowPlayingMessageId = undefined;
      }

      try {
        const ui = createPlayerUi(player);
        const msg = await (channel as any).send(ui);
        player.data.nowPlayingMessageId = msg.id;

        startProgressInterval(player, msg);
      } catch (err) {
        console.error(`[trackStart] Không thể gửi giao diện Now Playing (Guild: ${player.id}):`, err);
      }
    }, 400);
  });

  // 2. trackEnd: Khi kết thúc một bài hát
  manager.on("trackEnd", async (rawPlayer: Player, _track: Track) => {
    const player = normalizePlayer(rawPlayer);
    clearProgressInterval(player.id);
    if (player.data.nowPlayingMessageId) {
      const channel = await getTextChannel(client, player.data.textChannelId);
      if (channel) {
        try {
          const oldMsg = await (channel as any).messages.fetch(player.data.nowPlayingMessageId);
          if (oldMsg) await oldMsg.delete();
        } catch {}
      }
      player.data.nowPlayingMessageId = undefined;
    }
  });

  // 3. queueEnd: Khi toàn bộ hàng đợi phát xong
  manager.on("queueEnd", async (rawPlayer: Player) => {
    const player = normalizePlayer(rawPlayer);
    clearProgressInterval(player.id);
    clearLeaveTimer(player.id);
    const channel = await getTextChannel(client, player.data.textChannelId);
    if (channel) {
      try {
        await (channel as any).send("⏹️ Hàng đợi bài hát đã kết thúc!");
      } catch {}
    }

    startLeaveTimer(
      player.id,
      async () => {
        if (!player.isPlaying && !player.currentTrack && (!player.queue || player.queue.size === 0)) {
          try {
            await player.destroy();
          } catch (err) {
            console.error(`[queueEnd] Lỗi khi destroy player cho guild ${player.id}:`, err);
          }
        }
      },
      10000
    );
  });

  // 4. playerPause: Khi tạm dừng phát nhạc
  manager.on("playerPause", (rawPlayer: Player) => {
    const player = normalizePlayer(rawPlayer);
    clearProgressInterval(player.id);
  });

  // 5. playerResume: Khi tiếp tục phát nhạc
  manager.on("playerResume", async (rawPlayer: Player) => {
    const player = normalizePlayer(rawPlayer);
    const channel = await getTextChannel(client, player.data.textChannelId);
    if (!channel || !player.data.nowPlayingMessageId) return;

    try {
      const msg = await (channel as any).messages.fetch(player.data.nowPlayingMessageId);
      if (msg) {
        const ui = createPlayerUi(player);
        await msg.edit(ui);
        if (!progressIntervals.has(player.id)) {
          startProgressInterval(player, msg);
        }
      }
    } catch {
      clearProgressInterval(player.id);
    }
  });

  // 6. playerError: Khi xảy ra lỗi phát nhạc
  manager.on("playerError", async (rawPlayer: Player, arg1: any, arg2?: any) => {
    const player = normalizePlayer(rawPlayer);
    clearProgressInterval(player.id);
    clearLeaveTimer(player.id);
    let error: any;
    let track: Track | undefined;

    if (arg1 instanceof Error || (arg1 && arg1.message && !arg1.title)) {
      error = arg1;
      track = arg2;
    } else {
      track = arg1;
      error = arg2;
    }

    console.error(
      `[PlayerError] Guild: ${player.id}, Track: ${track?.title || "Unknown"}, Error: ${error?.message || error}`
    );

    const channel = await getTextChannel(client, player.data.textChannelId);
    if (channel) {
      try {
        await (channel as any).send(
          `⚠️ Đã xảy ra lỗi khi phát bài hát ${track?.title ? `**${track.title}**` : ""}: ${error?.message || "Lỗi không xác định"}`
        );
      } catch {}
    }
  });

  // 7. connectionError: Khi gặp lỗi kết nối voice
  manager.on("connectionError", async (rawPlayer: Player, error: any) => {
    const player = normalizePlayer(rawPlayer);
    clearProgressInterval(player.id);
    clearLeaveTimer(player.id);
    console.error(`[ConnectionError] Guild: ${player.id}, Error: ${error?.message || error}`);

    const channel = await getTextChannel(client, player.data.textChannelId);
    if (channel) {
      try {
        await (channel as any).send(
          `❌ Lỗi kết nối kênh thoại: ${error?.message || "Mất kết nối hoặc không thể kết nối"}`
        );
      } catch {}
    }
  });

  // 8. playerDestroy: Khi player bị hủy
  manager.on("playerDestroy", (rawPlayer: Player) => {
    const player = normalizePlayer(rawPlayer);
    clearProgressInterval(player.id);
    clearLeaveTimer(player.id);
  });
}
