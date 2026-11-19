import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  type Message,
} from "discord.js";
import { getManager, getPlayer, type AudioFilter } from "ziplayer";
import { createPlayerUi, formatDuration, formatTime } from "../ui/playerUi.js";

/**
 * Chuyển đổi mm:ss hoặc số giây sang milliseconds
 */
function parseTimeToMs(input: string): number | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map(Number);
    if (parts.some((n) => isNaN(n) || n < 0)) return null;
    if (parts.length === 2) {
      const [m, s] = parts;
      return (m * 60 + s) * 1000;
    } else if (parts.length === 3) {
      const [h, m, s] = parts;
      return (h * 3600 + m * 60 + s) * 1000;
    }
    return null;
  }
  const sec = Number(trimmed);
  if (isNaN(sec) || sec < 0) return null;
  return Math.floor(sec * 1000);
}

/**
 * Lệnh !skip (hoặc !s, !next, !n): Bỏ qua bài hát hiện tại
 */
export async function handleSkip(message: Message, _args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player || (!player.currentTrack && (player.queue?.size ?? 0) === 0)) {
    await message.reply("❌ Hiện không có bài hát nào đang phát để bỏ qua!");
    return;
  }

  try {
    const currentTitle = player.currentTrack?.title || "bài hát hiện tại";
    await player.skip();
    await message.reply(`⏭️ Đã bỏ qua: **${currentTitle}**!`);
  } catch (error) {
    console.error("Lỗi khi bỏ qua bài hát:", error);
    await message.reply("❌ Đã xảy ra lỗi khi bỏ qua bài hát!");
  }
}

/**
 * Lệnh !pause: Tạm dừng phát nhạc
 */
export async function handlePause(message: Message, _args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player || (!player.currentTrack && (player.queue?.size ?? 0) === 0)) {
    await message.reply("❌ Hiện không có bài hát nào đang phát để tạm dừng!");
    return;
  }

  if (player.isPaused) {
    await message.reply("⚠️ Trình phát nhạc đã ở trạng thái tạm dừng từ trước!");
    return;
  }

  try {
    await player.pause();
    await message.reply("⏸️ Đã tạm dừng phát nhạc!");
  } catch (error) {
    console.error("Lỗi khi tạm dừng phát nhạc:", error);
    await message.reply("❌ Đã xảy ra lỗi khi tạm dừng phát nhạc!");
  }
}

/**
 * Lệnh !resume: Tiếp tục phát nhạc
 */
export async function handleResume(message: Message, _args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player || (!player.currentTrack && (player.queue?.size ?? 0) === 0)) {
    await message.reply("❌ Hiện không có bài hát nào trong trình phát để tiếp tục!");
    return;
  }

  if (!player.isPaused) {
    await message.reply("⚠️ Trình phát nhạc đang phát bình thường, không ở trạng thái tạm dừng!");
    return;
  }

  try {
    await player.resume();
    await message.reply("▶️ Đã tiếp tục phát nhạc!");
  } catch (error) {
    console.error("Lỗi khi tiếp tục phát nhạc:", error);
    await message.reply("❌ Đã xảy ra lỗi khi tiếp tục phát nhạc!");
  }
}

/**
 * Lệnh !stop: Xóa queue và dừng phát nhạc
 */
export async function handleStop(message: Message, _args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player || (!player.currentTrack && (player.queue?.size ?? 0) === 0)) {
    await message.reply("❌ Hiện không có bài hát nào đang phát để dừng!");
    return;
  }

  try {
    player.queue?.clear();
    await player.stop();
    await message.reply("⏹️ Đã xóa hàng đợi và dừng phát nhạc!");
  } catch (error) {
    console.error("Lỗi khi dừng phát nhạc:", error);
    await message.reply("❌ Đã xảy ra lỗi khi dừng phát nhạc!");
  }
}

/**
 * Tạo Embed hiển thị hàng đợi phân trang (10 bài/trang)
 */
export function buildQueueEmbed(player: any, page: number): EmbedBuilder {
  const current = player.currentTrack;
  const tracks = (player.queue?.tracksList ||
    player.queue?.getTracks?.() ||
    player.queue?.tracks ||
    []) as any[];

  const totalPages = Math.max(1, Math.ceil(tracks.length / 10));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📜 Hàng đợi phát nhạc")
    .setTimestamp();

  let desc = "";
  if (current) {
    const duration = current.isLive ? "🔴 Live" : formatDuration(current.duration);
    const req = current.requestedBy ? ` • Yêu cầu bởi: <@${current.requestedBy}>` : "";
    desc += `**🎵 Đang phát:**\n[**${current.title || "Không rõ tiêu đề"}**](${current.url || ""}) \`[${duration}]\`${req}\n\n`;
  } else {
    desc += "**🎵 Đang phát:** Không có bài hát nào\n\n";
  }

  const loopMode =
    player.queue?.loopMode || player.queue?.getLoopMode?.() || "off";
  let loopDisplay = "Tắt";
  if (loopMode === "track") loopDisplay = "1 bài (track)";
  else if (loopMode === "queue") loopDisplay = "Hàng đợi (queue)";

  const isAutoplay = Boolean(
    player.data?.autoplay ??
    player.queue?.isAutoPlay ??
    player.queue?.autoPlayMode
  );
  const autoplayDisplay = isAutoplay ? "Bật" : "Tắt";

  desc += `**🔁 Loop:** \`${loopDisplay}\` • **📻 AutoPlay:** \`${autoplayDisplay}\` • **📊 Hàng đợi:** \`${tracks.length}\` bài\n\n`;

  if (tracks.length === 0) {
    desc += "*Không có bài hát nào tiếp theo trong hàng đợi.*";
  } else {
    desc += `**📋 Danh sách chờ (Trang ${safePage}/${totalPages}):**\n`;
    const startIndex = (safePage - 1) * 10;
    const pageTracks = tracks.slice(startIndex, startIndex + 10);
    pageTracks.forEach((track, index) => {
      const dur = track.isLive ? "🔴 Live" : formatDuration(track.duration);
      const req = track.requestedBy ? ` • <@${track.requestedBy}>` : "";
      desc += `\`${startIndex + index + 1}.\` [${track.title || "Không rõ"}](${track.url || ""}) \`[${dur}]\`${req}\n`;
    });
  }

  embed.setDescription(desc);
  embed.setFooter({
    text: `Trang ${safePage}/${totalPages} • Tổng ${tracks.length} bài trong hàng đợi`,
  });

  return embed;
}

/**
 * Tạo 2 nút phân trang hàng đợi
 */
export function buildQueueButtons(
  page: number,
  totalPages: number,
  forceDisable = false
): ActionRowBuilder<ButtonBuilder> {
  const disableAll = forceDisable || totalPages <= 1;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("queue_page_prev")
      .setLabel("◀ Trang trước")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disableAll || page <= 1),
    new ButtonBuilder()
      .setCustomId("queue_page_next")
      .setLabel("Trang sau ▶")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disableAll || page >= totalPages)
  );
}

/**
 * Lệnh !queue (hoặc !q): Hiển thị hàng đợi bài hát có phân trang và nút điều hướng
 */
export async function handleQueue(message: Message, _args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player || (!player.currentTrack && (player.queue?.size ?? 0) === 0)) {
    await message.reply("❌ Hàng đợi hiện đang trống và không có bài hát nào đang phát!");
    return;
  }

  const tracks = (player.queue?.tracksList ||
    player.queue?.getTracks?.() ||
    player.queue?.tracks ||
    []) as any[];

  const totalPages = Math.max(1, Math.ceil(tracks.length / 10));
  let currentPage = 1;
  if (_args[0] && !isNaN(Number(_args[0]))) {
    const requestedPage = parseInt(_args[0], 10);
    if (requestedPage >= 1 && requestedPage <= totalPages) {
      currentPage = requestedPage;
    }
  }

  const embed = buildQueueEmbed(player, currentPage);
  const row = buildQueueButtons(currentPage, totalPages);

  const msg = await message.reply({
    embeds: [embed],
    components: [row],
  });

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== message.author.id) {
      await i.reply({
        content: "❌ Chỉ người dùng đã gõ lệnh mới có thể chuyển trang!",
        ephemeral: true,
      }).catch(() => {});
      return;
    }

    const currentTracks = (player.queue?.tracksList ||
      player.queue?.getTracks?.() ||
      player.queue?.tracks ||
      []) as any[];
    const currentTotalPages = Math.max(1, Math.ceil(currentTracks.length / 10));

    if (i.customId === "queue_page_prev") {
      if (currentPage > 1) {
        currentPage--;
      }
    } else if (i.customId === "queue_page_next") {
      if (currentPage < currentTotalPages) {
        currentPage++;
      }
    }
    currentPage = Math.min(currentPage, currentTotalPages);

    const updatedEmbed = buildQueueEmbed(player, currentPage);
    const updatedRow = buildQueueButtons(currentPage, currentTotalPages);

    await i.update({
      embeds: [updatedEmbed],
      components: [updatedRow],
    }).catch(() => {});
  });

  collector.on("end", async () => {
    const currentTracks = (player.queue?.tracksList ||
      player.queue?.getTracks?.() ||
      player.queue?.tracks ||
      []) as any[];
    const currentTotalPages = Math.max(1, Math.ceil(currentTracks.length / 10));
    const disabledRow = buildQueueButtons(currentPage, currentTotalPages, true);
    await msg.edit({ components: [disabledRow] }).catch(() => {});
  });
}

/**
 * Lệnh !vol <0-100>: Xem hoặc chỉnh âm lượng (khóa trần 100 chống vỡ tiếng)
 */
export async function handleVolume(message: Message, args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player) {
    await message.reply("❌ Trình phát nhạc chưa được khởi tạo trên máy chủ này!");
    return;
  }

  if (!args || args.length === 0 || !args[0] || isNaN(Number(args[0]))) {
    await message.reply(`🔊 Âm lượng hiện tại: **${player.volume ?? 80}%** (Cú pháp chỉnh: \`!vol <0-100>\`)`);
    return;
  }

  const raw = parseInt(args[0], 10);
  const val = Math.min(100, Math.max(0, raw));

  try {
    await player.setVolume(val);
    await message.reply(`🔊 Đã chỉnh âm lượng thành: **${val}%** (tối đa 100% để chống rè tiếng)`);
  } catch (error) {
    console.error("Lỗi khi chỉnh âm lượng:", error);
    await message.reply("❌ Đã xảy ra lỗi khi điều chỉnh âm lượng!");
  }
}

/**
 * Lệnh !loop <off|track|queue|1>: Cài đặt chế độ lặp
 */
export async function handleLoop(message: Message, args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player || (!player.currentTrack && (player.queue?.size ?? 0) === 0)) {
    await message.reply("❌ Hiện không có bài hát nào đang phát để cài đặt chế độ lặp!");
    return;
  }

  const sub = args[0]?.toLowerCase().trim();

  if (sub === "1" || sub === "track") {
    player.queue.loop("track");
    await message.reply("🔂 Đã bật chế độ lặp: **1 bài** (`track`)");
    return;
  }

  if (sub === "queue") {
    player.queue.loop("queue");
    await message.reply("🔁 Đã bật chế độ lặp: **toàn bộ hàng đợi** (`queue`)");
    return;
  }

  if (sub === "off" || sub === "none" || sub === "0") {
    player.queue.loop("off");
    await message.reply("➡️ Đã **tắt** chế độ lặp (`off`)");
    return;
  }

  const currentMode = player.queue.getLoopMode?.() || "off";
  let nextMode: "off" | "track" | "queue" = "off";
  let messageText = "";

  if (currentMode === "off") {
    nextMode = "track";
    messageText = "🔂 Đã chuyển sang lặp **1 bài** (`track`)! Cú pháp: `!loop <off|track|queue|1>`";
  } else if (currentMode === "track") {
    nextMode = "queue";
    messageText = "🔁 Đã chuyển sang lặp **toàn bộ hàng đợi** (`queue`)! Cú pháp: `!loop <off|track|queue|1>`";
  } else {
    nextMode = "off";
    messageText = "➡️ Đã **tắt** chế độ lặp (`off`)! Cú pháp: `!loop <off|track|queue|1>`";
  }

  player.queue.loop(nextMode);
  await message.reply(messageText);
}

/**
 * Lệnh !previous (hoặc !prev, !back): Quay lại bài hát trước đó
 */
export async function handlePrevious(message: Message, _args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player) {
    await message.reply("❌ Trình phát nhạc chưa được khởi tạo trên máy chủ này!");
    return;
  }

  try {
    const success = await player.previous();
    if (!success) {
      await message.reply("❌ Không có bài hát nào trước đó trong lịch sử!");
      return;
    }
    await message.reply("⏮️ Đã quay lại bài hát trước đó!");
  } catch (error) {
    console.error("Lỗi khi quay lại bài hát trước:", error);
    await message.reply("❌ Đã xảy ra lỗi khi quay lại bài hát trước!");
  }
}

/**
 * Lệnh !seek (hoặc !tua): Tua đến mốc thời gian (mm:ss hoặc số giây)
 */
export async function handleSeek(message: Message, args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player || !player.currentTrack) {
    await message.reply("❌ Hiện không có bài hát nào đang phát để tua!");
    return;
  }

  if (player.currentTrack.isLive) {
    await message.reply("⚠️ Không thể tua luồng phát sóng trực tiếp (Livestream)!");
    return;
  }

  const raw = args[0];
  if (!raw) {
    await message.reply("💡 Vui lòng nhập thời gian cần tua (ví dụ: `!seek 1:30` hoặc `!seek 90`). Cú pháp: `!seek <mm:ss|giây>`");
    return;
  }

  const ms = parseTimeToMs(raw);
  if (ms === null) {
    await message.reply("⚠️ Định dạng thời gian không hợp lệ! Vui lòng nhập kiểu `mm:ss` (ví dụ `1:45`) hoặc số giây (ví dụ `90`).");
    return;
  }

  const durationMs = player.currentTrack.duration ? player.currentTrack.duration * 1000 : 0;
  if (durationMs > 0 && ms > durationMs) {
    await message.reply(`⚠️ Thời gian tua vượt quá tổng thời lượng bài hát (${formatDuration(player.currentTrack.duration)})!`);
    return;
  }

  try {
    await player.seek(ms);
    const targetStr = formatTime(Math.floor(ms / 1000));
    await message.reply(`⏩ Đã tua đến mốc **${targetStr}**!`);
  } catch (error) {
    console.error("Lỗi khi tua bài hát:", error);
    await message.reply("❌ Đã xảy ra lỗi khi tua bài hát!");
  }
}

/**
 * Lệnh !playnext (hoặc !pn): Chèn bài hát lên đầu hàng đợi để phát kế tiếp
 */
export async function handlePlayNext(message: Message, args: string[] = []): Promise<void> {
  if (!message.guild || !message.guildId) return;

  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    await message.reply("⚠️ Bạn cần tham gia một kênh thoại trước khi dùng lệnh chèn bài hát!");
    return;
  }

  if (!args || args.length === 0 || !args.join(" ").trim()) {
    await message.reply("💡 Vui lòng nhập tên bài hát hoặc link. Cú pháp: `!playnext <tên bài hoặc URL>` (hoặc `!pn <tên bài>`)");
    return;
  }

  const query = args.join(" ").trim();

  // Gửi ngay tin nhắn phản hồi tức thì (<200ms)
  const loadingMsg = await message.reply("⚡ Đang tải...");

  const manager = getManager();
  if (!manager) {
    await loadingMsg.edit("❌ Trình quản lý nhạc chưa được khởi tạo!");
    return;
  }

  let player = getPlayer(message.guildId);
  if (!player) {
    player = await manager.create(message.guildId, {
      leaveOnEmpty: false,
      leaveOnEnd: false,
      volume: 80,
      preload: true,
    } as any);
  }

  if (!player.connection) {
    try {
      await player.connect(voiceChannel as any);
    } catch (error) {
      console.error("Lỗi khi kết nối kênh thoại:", error);
      await loadingMsg.edit("❌ Bot không thể kết nối vào kênh thoại của bạn!");
      return;
    }
  }

  if (!(player as any).data) (player as any).data = {};
  (player as any).data.textChannelId = message.channelId;

  try {
    if (!player.currentTrack && !player.isPlaying) {
      const res = await player.play(query, message.author.id);
      if (!res) {
        await loadingMsg.edit("❌ Không tìm thấy bài hát hoặc xảy ra lỗi khi tìm nạp nhạc!");
        return;
      }
      // Bài mới phát ngay, trackStart sẽ gửi Now Playing, xóa loadingMsg
      await loadingMsg.delete().catch(() => {});
      return;
    }

    const res = await player.insert(query, 0, message.author.id);
    if (!res) {
      await loadingMsg.edit("❌ Không tìm thấy bài hát để chèn vào đầu hàng đợi!");
      return;
    }

    await loadingMsg.edit("⏭️ Đã chèn bài hát lên **đầu hàng đợi** (sẽ phát ngay sau bài hiện tại)!");
  } catch (error) {
    console.error("Lỗi khi chèn bài hát:", error);
    await loadingMsg.edit("❌ Đã xảy ra lỗi khi chèn bài hát vào hàng đợi!").catch(async () => {
      await message.reply("❌ Đã xảy ra lỗi khi chèn bài hát vào hàng đợi!");
    });
  }
}

/**
 * Lệnh !shuffle (hoặc !tron): Xáo trộn danh sách bài hát trong hàng đợi
 */
export async function handleShuffle(message: Message, _args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player || (player.queue?.size ?? 0) <= 1) {
    await message.reply("⚠️ Hàng đợi cần ít nhất 2 bài hát để thực hiện trộn ngẫu nhiên!");
    return;
  }

  try {
    player.queue.shuffle();
    await message.reply(`🔀 Đã trộn ngẫu nhiên **${player.queue.size}** bài hát trong hàng đợi!`);
  } catch (error) {
    console.error("Lỗi khi trộn hàng đợi:", error);
    await message.reply("❌ Đã xảy ra lỗi khi trộn hàng đợi!");
  }
}

/**
 * Lệnh !autoplay (hoặc !ap): Bật/tắt chế độ tự động phát bài liên quan khi hết hàng đợi
 */
export async function handleAutoPlay(message: Message, _args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player) {
    await message.reply("❌ Trình phát nhạc chưa được khởi tạo trên máy chủ này!");
    return;
  }

  const currentAutoPlay = Boolean(
    (player.queue as any).autoPlayEnabled ??
    (player.queue as any).isAutoPlay ??
    (player as any).data?.autoplay ??
    player.queue?.autoPlay?.()
  );
  const nextAutoPlay = !currentAutoPlay;

  try {
    player.queue.autoPlay(nextAutoPlay);
    (player.queue as any).isAutoPlay = nextAutoPlay;
    if (!(player as any).data) (player as any).data = {};
    (player as any).data.autoplay = nextAutoPlay;

    await message.reply(
      nextAutoPlay
        ? "📻 Đã **bật** chế độ tự động phát bài liên quan (`AutoPlay`)!"
        : "⏹️ Đã **tắt** chế độ tự động phát bài liên quan (`AutoPlay`)!"
    );
  } catch (error) {
    console.error("Lỗi khi toggle autoplay:", error);
    await message.reply("❌ Đã xảy ra lỗi khi bật/tắt chế độ tự động phát nhạc!");
  }
}

/**
 * Lệnh !remove (hoặc !xoa): Xóa bài hát khỏi hàng đợi theo số thứ tự (1-based)
 */
export async function handleRemove(message: Message, args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player || (player.queue?.size ?? 0) === 0) {
    await message.reply("❌ Hàng đợi hiện đang trống!");
    return;
  }

  const rawIndex = args[0] ? parseInt(args[0], 10) : NaN;
  const queueSize = player.queue.size;

  if (isNaN(rawIndex) || rawIndex < 1 || rawIndex > queueSize) {
    await message.reply(`⚠️ Vui lòng nhập số thứ tự hợp lệ (từ 1 đến ${queueSize}). Cú pháp: \`!remove <vị trí>\``);
    return;
  }

  try {
    const removedTrack = player.queue.remove(rawIndex - 1);
    if (removedTrack) {
      await message.reply(`🗑️ Đã xóa khỏi hàng đợi: **${removedTrack.title || `Vị trí #${rawIndex}`}**!`);
    } else {
      await message.reply(`🗑️ Đã xóa bài hát ở vị trí #${rawIndex} khỏi hàng đợi!`);
    }
  } catch (error) {
    console.error("Lỗi khi xóa bài hát khỏi hàng đợi:", error);
    await message.reply("❌ Đã xảy ra lỗi khi xóa bài hát khỏi hàng đợi!");
  }
}

/**
 * Lệnh !move: Di chuyển vị trí bài hát trong hàng đợi (1-based)
 */
export async function handleMove(message: Message, args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player || (player.queue?.size ?? 0) === 0) {
    await message.reply("❌ Hàng đợi hiện đang trống!");
    return;
  }

  const from = args[0] ? parseInt(args[0], 10) : NaN;
  const to = args[1] ? parseInt(args[1], 10) : NaN;
  const queueSize = player.queue.size;

  if (isNaN(from) || isNaN(to) || from < 1 || from > queueSize || to < 1 || to > queueSize) {
    await message.reply(`⚠️ Vui lòng nhập vị trí bắt đầu và đích hợp lệ (1-${queueSize}). Cú pháp: \`!move <từ> <đến>\``);
    return;
  }

  try {
    const success = player.queue.move(from - 1, to - 1);
    if (success) {
      await message.reply(`🔀 Đã di chuyển bài hát từ vị trí **#${from}** sang vị trí **#${to}**!`);
    } else {
      await message.reply("❌ Không thể di chuyển bài hát trong hàng đợi!");
    }
  } catch (error) {
    console.error("Lỗi khi di chuyển bài hát:", error);
    await message.reply("❌ Đã xảy ra lỗi khi di chuyển bài hát!");
  }
}

/**
 * Lệnh !clear: Xóa toàn bộ bài hát trong hàng đợi
 */
export async function handleClear(message: Message, _args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player || (player.queue?.size ?? 0) === 0) {
    await message.reply("❌ Hàng đợi hiện đã trống!");
    return;
  }

  try {
    const count = player.queue.size;
    player.queue.clear();
    await message.reply(`🧹 Đã xóa toàn bộ **${count}** bài hát trong hàng đợi!`);
  } catch (error) {
    console.error("Lỗi khi xóa hàng đợi:", error);
    await message.reply("❌ Đã xảy ra lỗi khi xóa hàng đợi!");
  }
}

/**
 * Lệnh !np (hoặc !nowplaying): Hiển thị thông tin bài hát đang phát
 */
export async function handleNowPlaying(message: Message, _args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player || !player.currentTrack) {
    await message.reply("❌ Hiện không có bài hát nào đang phát!");
    return;
  }

  try {
    const { embeds, components } = createPlayerUi(player);
    await message.reply({ embeds, components });
  } catch (error) {
    console.error("Lỗi khi tạo giao diện Now Playing:", error);
    await message.reply("❌ Đã xảy ra lỗi khi hiển thị bài hát đang phát!");
  }
}

/**
 * Lệnh !filter: Cài đặt bộ lọc âm thanh EQ (off|bassboost|bass|nightcore|vaporwave|crystal|lofi|karaoke)
 */
export async function handleFilter(message: Message, args: string[] = []): Promise<void> {
  if (!message.guildId) return;

  const player = getPlayer(message.guildId);
  if (!player || !player.currentTrack) {
    await message.reply("❌ Hiện không có bài hát nào đang phát để cài đặt bộ lọc âm thanh!");
    return;
  }

  const raw = args[0]?.toLowerCase().trim();
  if (!raw) {
    const currentEq = (player as any).data?.eq || "off";
    await message.reply(
      `🎛️ Bộ lọc hiện tại: **${currentEq}**\nCác bộ lọc khả dụng: \`off\`, \`bassboost\`, \`bass\`, \`nightcore\`, \`vaporwave\`, \`crystal\`, \`lofi\`, \`karaoke\`\nCú pháp: \`!filter <tên bộ lọc>\``
    );
    return;
  }

  const validFilters = [
    "off",
    "none",
    "bassboost",
    "bass",
    "nightcore",
    "vaporwave",
    "crystal",
    "lofi",
    "karaoke",
  ];

  if (!validFilters.includes(raw)) {
    await message.reply(
      "⚠️ Tên bộ lọc không hợp lệ! Vui lòng chọn một trong các bộ lọc sau:\n`off`, `bassboost`, `bass`, `nightcore`, `vaporwave`, `crystal`, `lofi`, `karaoke`"
    );
    return;
  }

  try {
    if (!(player as any).data) (player as any).data = {};

    if (raw === "off" || raw === "none") {
      (player as any).data.eq = "off";
      if (player.filter && typeof player.filter.clearAll === "function") {
        await player.filter.clearAll();
      } else if (typeof (player as any).clearFilters === "function") {
        await (player as any).clearFilters();
      }
      await message.reply("🛡️ Đã **tắt** bộ lọc âm thanh, quay về phát trực tiếp (Normal / Flat)!");
      return;
    }

    // Khi bật filter: nếu volume > 75 thì hạ về 75 để chống rè âm thanh
    if (player.volume > 75) {
      await player.setVolume(75);
    }

    // Xóa filter cũ trước khi áp dụng filter mới
    if (player.filter && typeof player.filter.clearAll === "function") {
      await player.filter.clearAll();
    }

    if (raw === "crystal") {
      (player as any).data.eq = "crystal";
      const crystalFilter: AudioFilter = {
        name: "crystal",
        ffmpegFilter: "treble=g=5,equalizer=f=2000:t=q:w=1:g=3",
        description: "Crystal Clear",
      };
      if (player.filter && typeof player.filter.applyFilter === "function") {
        await player.filter.applyFilter(crystalFilter);
      }
      await message.reply(
        "🎛️ Đã kích hoạt bộ lọc: **crystal** (Crystal Clear ✨)! (Âm lượng tự động tối ưu ≤75% để chống rè)"
      );
    } else if (raw === "bass" || raw === "bassboost") {
      (player as any).data.eq = "bass";
      if (player.filter && typeof player.filter.applyFilter === "function") {
        await player.filter.applyFilter("bassboost");
      }
      await message.reply(
        "🎛️ Đã kích hoạt bộ lọc: **bass** (BassBoost nhẹ 💥)! (Âm lượng tự động tối ưu ≤75% để chống rè)"
      );
    } else {
      (player as any).data.eq = raw;
      if (player.filter && typeof player.filter.applyFilter === "function") {
        await player.filter.applyFilter(raw);
      }
      await message.reply(
        `🎛️ Đã kích hoạt bộ lọc: **${raw}**! (Âm lượng tự động tối ưu ≤75% để chống rè)`
      );
    }
  } catch (error) {
    console.error("Lỗi khi áp dụng bộ lọc:", error);
    await message.reply("❌ Đã xảy ra lỗi khi áp dụng bộ lọc âm thanh!");
  }
}

// Aliases
export const handleVol = handleVolume;
export const handlePrev = handlePrevious;
export const handleBack = handlePrevious;
export const handleTua = handleSeek;
export const handlePn = handlePlayNext;
export const handleTron = handleShuffle;
export const handleAp = handleAutoPlay;
export const handleXoa = handleRemove;
export const handleNp = handleNowPlaying;

export const controlsCommands = {
  skip: handleSkip,
  s: handleSkip,
  next: handleSkip,
  n: handleSkip,
  pause: handlePause,
  resume: handleResume,
  stop: handleStop,
  queue: handleQueue,
  q: handleQueue,
  vol: handleVolume,
  volume: handleVolume,
  loop: handleLoop,
  previous: handlePrevious,
  prev: handlePrevious,
  back: handlePrevious,
  seek: handleSeek,
  tua: handleSeek,
  playnext: handlePlayNext,
  pn: handlePlayNext,
  shuffle: handleShuffle,
  tron: handleShuffle,
  autoplay: handleAutoPlay,
  ap: handleAutoPlay,
  remove: handleRemove,
  xoa: handleRemove,
  move: handleMove,
  clear: handleClear,
  nowplaying: handleNowPlaying,
  np: handleNowPlaying,
  filter: handleFilter,
};
