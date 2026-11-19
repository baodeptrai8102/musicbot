import type { Message } from "discord.js";
import { getManager, getPlayer } from "ziplayer";
import { clearLeaveTimer } from "../events/voiceStateUpdate";

export const name = "play";
export const aliases = ["p"];

/**
 * Xử lý lệnh phát nhạc !play hoặc !p
 */
export async function execute(message: Message, args: string[]): Promise<void> {
  // 1. Kiểm tra guild
  if (!message.guild || !message.guildId) return;

  // 2. Kiểm tra voice channel của người dùng
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    await message.reply("⚠️ Bạn cần tham gia một kênh thoại (Voice Channel) trước khi dùng lệnh phát nhạc!");
    return;
  }

  // 3. Kiểm tra tham số đầu vào
  if (!args || args.length === 0) {
    await message.reply("💡 Vui lòng nhập tên bài hát hoặc đường link. Cú pháp: `!play <tên bài hát hoặc URL>` (hoặc `!p <tên bài hát hoặc URL>`)");
    return;
  }

  const query = args.join(" ").trim();
  if (!query) {
    await message.reply("💡 Vui lòng nhập tên bài hát hoặc đường link. Cú pháp: `!play <tên bài hát hoặc URL>`");
    return;
  }

  // Gửi ngay tin nhắn phản hồi tức thì (<200ms)
  const loadingMsg = await message.reply("⚡ Đang tải...");

  // 4. Lấy singleton manager & player từ ziplayer
  const manager = getManager();
  if (!manager) {
    await loadingMsg.edit("❌ Trình quản lý nhạc chưa được khởi tạo!");
    return;
  }

  clearLeaveTimer(message.guildId);

  let player = getPlayer(message.guildId);
  if (!player) {
    player = await manager.create(message.guildId, {
      leaveOnEmpty: false,
      leaveOnEnd: false,
      volume: 80,
      selfDeaf: true,
      quality: "high",
      filters: [],
      preload: { enabled: true },
      antiStuck: { enabled: true },
    } as any);
  }

  // 5. Đảm bảo bot kết nối kênh thoại
  const wasConnected = Boolean(player.connection);
  try {
    await player.connect(voiceChannel as any);
    if (!wasConnected) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  } catch (error) {
    console.error("Lỗi khi kết nối kênh thoại:", error);
    await loadingMsg.edit("❌ Bot không thể kết nối vào kênh thoại của bạn. Vui lòng kiểm tra lại quyền kết nối!");
    return;
  }

  // 6. Xử lý query: giữ nguyên URL nếu là link trực tiếp, ưu tiên YouTube search nếu là từ khóa
  const isDirectUrl = /^https?:\/\//i.test(query);
  const targetQuery = isDirectUrl ? query : query;

  // Lưu trạng thái trước khi phát để thông báo hàng đợi nếu bot đang phát bài khác
  const isAlreadyPlaying = player.isPlaying || Boolean(player.currentTrack);

  // Lưu textChannelId vào player.data để phát sự kiện Now Playing
  if (!(player as any).data) (player as any).data = {};
  (player as any).data.textChannelId = message.channelId;

  // 7. Gọi player.play
  try {
    const res = await player.play(targetQuery, message.author.id);
    if (!res) {
      await loadingMsg.edit("❌ Không tìm thấy bài hát hoặc xảy ra lỗi khi tìm nạp nhạc!");
      return;
    }

    clearLeaveTimer(message.guildId);

    if (isAlreadyPlaying) {
      await loadingMsg.edit("➕ Đã thêm bài hát vào hàng đợi!");
    } else {
      // Nếu là bài phát mới, Embed Now Playing sẽ được gửi qua sự kiện trackStart.
      // Xóa loadingMsg để người dùng có phản hồi tức thì và kênh chat gọn gàng.
      await loadingMsg.delete().catch(() => {});
    }
  } catch (error) {
    console.error("Lỗi khi phát nhạc:", error);
    await loadingMsg.edit("❌ Đã xảy ra lỗi trong quá trình phát nhạc!").catch(async () => {
      await message.reply("❌ Đã xảy ra lỗi trong quá trình phát nhạc!");
    });
  }
}

export const handlePlay = execute;
export default execute;
