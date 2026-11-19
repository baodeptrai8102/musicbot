import type { VoiceState } from "discord.js";
import { getPlayer } from "ziplayer";
import { clearProgressInterval } from "./playerEvents";

export const leaveTimers = new Map<string, NodeJS.Timeout>();

/**
 * Xóa bộ hẹn giờ tự động rời phòng của guild nếu có
 * @param guildId ID của server
 */
export function clearLeaveTimer(guildId: string): void {
  const timer = leaveTimers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    leaveTimers.delete(guildId);
  }
}

/**
 * Bắt đầu bộ hẹn giờ tự động rời phòng của guild nếu chưa có timer
 * @param guildId ID của server
 * @param callback Hàm thực thi khi hết thời gian hẹn
 * @param ms Thời gian hẹn (mặc định 10000ms = 10 giây)
 */
export function startLeaveTimer(
  guildId: string,
  callback: () => Promise<void> | void,
  ms = 10000
): void {
  if (leaveTimers.has(guildId)) return;
  const timer = setTimeout(async () => {
    leaveTimers.delete(guildId);
    try {
      await callback();
    } catch (error) {
      console.error(`[leaveTimer] Lỗi khi thực thi callback rời phòng cho guild ${guildId}:`, error);
    }
  }, ms);
  leaveTimers.set(guildId, timer);
}

/**
 * Xử lý sự kiện voiceStateUpdate để tự rời phòng sau 10 giây khi phòng trống
 */
export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  const botVoiceChannel = guild.members.me?.voice.channel;

  // Nếu bot không ở kênh thoại nào (bị kick hoặc disconnect)
  if (!botVoiceChannel) {
    clearLeaveTimer(guild.id);
    clearProgressInterval(guild.id);
    const player = getPlayer(guild.id);
    if (player) {
      try {
        await player.destroy();
      } catch {}
    }
    return;
  }

  // Đếm số thành viên thật (người dùng thật, bỏ qua bot)
  const realMembers = botVoiceChannel.members.filter((m) => !m.user.bot);

  if (realMembers.size === 0) {
    // Đặt timer đúng 10000ms: sau 10s nếu vẫn trống, lấy player, destroy player, xóa timer và gửi thông báo
    startLeaveTimer(
      guild.id,
      async () => {
        const currentBotVoiceChannel = guild.members.me?.voice.channel;
        if (!currentBotVoiceChannel) return;
        const currentRealMembers = currentBotVoiceChannel.members.filter((m) => !m.user.bot);
        if (currentRealMembers.size > 0) return;

        const player = getPlayer(guild.id);
        if (player) {
          try {
            const textChannelId = (player as any).data?.textChannelId;
            if (textChannelId) {
              let textChannel = guild.channels.cache.get(textChannelId);
              if (!textChannel) {
                try {
                  textChannel = (await guild.channels.fetch(textChannelId)) ?? undefined;
                } catch {}
              }
              if (textChannel && textChannel.isTextBased()) {
                await (textChannel as any).send("👋 Kênh thoại trống hơn 10 giây, bot xin phép rời phòng nhé!");
              }
            }
          } catch {}

          try {
            await player.destroy();
          } catch (error) {
            console.error(`[voiceStateUpdate] Lỗi khi destroy player cho guild ${guild.id}:`, error);
          }
        }
      },
      10000
    );
  } else {
    // Có người vào lại hoặc kênh còn người: xóa timer ngay
    clearLeaveTimer(guild.id);
  }
}

export default handleVoiceStateUpdate;
