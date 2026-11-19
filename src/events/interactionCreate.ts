import {
  ComponentType,
  EmbedBuilder,
  type GuildMember,
  type Interaction,
} from "discord.js";
import { getPlayer, type AudioFilter } from "ziplayer";
import { buildQueueButtons, buildQueueEmbed } from "../commands/controls.js";
import {
  createPlayerUi,
  createSeekModal,
  formatDuration,
  UI_IDS,
} from "../ui/playerUi.js";

// Cooldown đổi bộ lọc EQ theo từng máy chủ (tối thiểu 2000ms để chống rè & lag)
const eqCooldowns = new Map<string, number>();

// Cooldown thao tác tua nhạc theo từng máy chủ (tối thiểu 3000ms để chống spam làm đứt stream FFmpeg)
const seekCooldowns = new Map<string, number>();

/**
 * Phân tích cú pháp chuỗi thời gian: ss, mm:ss, hoặc hh:mm:ss sang mili-giây (ms)
 */
function parseTimeToMs(input: string): number | null {
  if (!input) return null;
  const parts = input.split(":").map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p))) {
    return null;
  }
  if (parts.length === 1) {
    const sec = Number(parts[0]);
    return isNaN(sec) ? null : sec * 1000;
  }
  if (parts.length === 2) {
    const min = Number(parts[0]);
    const sec = Number(parts[1]);
    if (isNaN(min) || isNaN(sec) || sec >= 60) return null;
    return (min * 60 + sec) * 1000;
  }
  if (parts.length === 3) {
    const hour = Number(parts[0]);
    const min = Number(parts[1]);
    const sec = Number(parts[2]);
    if (isNaN(hour) || isNaN(min) || isNaN(sec) || min >= 60 || sec >= 60) return null;
    return (hour * 3600 + min * 60 + sec) * 1000;
  }
  return null;
}

/**
 * Xử lý tương tác nút bấm, Menu Dropdown và Modal từ giao diện điều khiển nhạc
 */
export async function handleInteraction(interaction: Interaction): Promise<void> {
  // 1. Chỉ xử lý Button, StringSelectMenu và ModalSubmit trong Guild
  if (
    !interaction.inGuild() ||
    (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit())
  ) {
    return;
  }

  // Ghi log interaction ra terminal để dễ kiểm tra và debug
  if (interaction.isButton()) {
    console.log(`[Interaction] Button: ${interaction.customId} | Guild: ${interaction.guildId}`);
  } else if (interaction.isStringSelectMenu()) {
    console.log(`[Interaction] SelectMenu: ${interaction.customId} (values: ${interaction.values.join(", ")}) | Guild: ${interaction.guildId}`);
  } else if (interaction.isModalSubmit()) {
    console.log(`[Interaction] ModalSubmit: ${interaction.customId} | Guild: ${interaction.guildId}`);
  }

  // Nút phân trang queue do collector riêng quản lý
  if (
    interaction.isButton() &&
    (interaction.customId === "queue_page_prev" || interaction.customId === "queue_page_next")
  ) {
    return;
  }

  try {
    // 2. Lấy player theo guildId
    const player = getPlayer(interaction.guildId);
    if (!player || (!player.currentTrack && (player.queue?.size ?? 0) === 0)) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Hiện không có bài hát nào đang phát trên máy chủ!",
          ephemeral: true,
        });
      }
      return;
    }

    // 3. Kiểm tra voice channel của người dùng
    const member = interaction.member as GuildMember | null;
    const memberVoiceChannelId = member?.voice?.channelId;
    const botVoiceChannelId = interaction.guild?.members.me?.voice.channelId;

    if (!memberVoiceChannelId) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "⚠️ Bạn cần tham gia một kênh thoại để điều khiển trình phát nhạc!",
          ephemeral: true,
        });
      }
      return;
    }

    if (botVoiceChannelId && memberVoiceChannelId !== botVoiceChannelId) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "⚠️ Bạn cần ở trong cùng kênh thoại với bot để điều khiển trình phát nhạc!",
          ephemeral: true,
        });
      }
      return;
    }

    // 3.1. Thao tác nút 🎯 Tua đến... (hiển thị modal nhập thời gian)
    // TUYỆT ĐỐI không gọi deferUpdate() trước showModal() để tránh lỗi Discord
    if (interaction.isButton() && interaction.customId === UI_IDS.BUTTON_SEEK_MODAL) {
      const modal = createSeekModal();
      await interaction.showModal(modal);
      return;
    }

    // 3.2. Thao tác Modal submit (tua nhạc đến mốc thời gian)
    if (interaction.isModalSubmit()) {
      if (interaction.customId === UI_IDS.MODAL_SEEK) {
        const timeInput = interaction.fields.getTextInputValue(UI_IDS.MODAL_SEEK_INPUT).trim();
        const duration = player.currentTrack?.duration
          ? (player.currentTrack.duration > 10000
              ? player.currentTrack.duration
              : player.currentTrack.duration * 1000)
          : 0;

        const ms = parseTimeToMs(timeInput);
        if (ms === null || isNaN(ms) || ms < 0 || (duration > 0 && ms >= duration) || duration === 0) {
          await interaction.reply({
            content: `❌ Mốc thời gian không hợp lệ! Vui lòng nhập đúng định dạng (\`ss\`, \`mm:ss\`, hoặc \`hh:mm:ss\`) và nhỏ hơn thời lượng bài hát (${formatDuration(duration)}).`,
            ephemeral: true,
          });
          return;
        }

        const now = Date.now();
        const lastSeek = seekCooldowns.get(interaction.guildId) ?? 0;
        if (now - lastSeek < 3000) {
          await interaction.reply({
            content: "⚠️ Vui lòng đợi 3 giây giữa các lần tua nhạc để tránh gián đoạn âm thanh!",
            ephemeral: true,
          });
          return;
        }
        seekCooldowns.set(interaction.guildId, now);

        const res = await player.seek(ms);
        if (res === false) {
          await interaction.reply({
            content: "❌ Không thể tua bài hát này (có thể do stream trực tiếp hoặc không hỗ trợ)!",
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          content: `⏩ Đã tua đến **${formatDuration(ms)}**!`,
          ephemeral: true,
        });

        // Cập nhật ngay tin nhắn Now Playing
        const ui = createPlayerUi(player);
        if (interaction.message) {
          await interaction.message.edit(ui).catch(() => {});
        } else if ((player as any).data?.nowPlayingMessageId) {
          const channel = interaction.channel;
          if (channel && channel.isTextBased()) {
            const msg = await (channel as any).messages.fetch((player as any).data.nowPlayingMessageId).catch(() => null);
            if (msg) {
              await msg.edit(ui).catch(() => {});
            }
          }
        }
      }
      return;
    }

    // Mọi nút bấm và dropdown còn lại: gọi deferUpdate() ngay dòng đầu tiên
    await interaction.deferUpdate().catch(() => {});

    // 4. Xử lý Dropdown xem hàng đợi (menu_queue): followUp ẩn riêng biệt kèm phân trang
    if (interaction.isStringSelectMenu() && interaction.customId === UI_IDS.SELECT_MENU) {
      const selectedValue = interaction.values[0];

      if (selectedValue === UI_IDS.MENU_QUEUE) {
        const tracks = (player.queue?.tracksList ||
          player.queue?.getTracks?.() ||
          (player.queue as any)?.tracks ||
          []) as any[];
        const totalPages = Math.max(1, Math.ceil(tracks.length / 10));
        let currentPage = 1;

        const queueEmbed = buildQueueEmbed(player, currentPage);
        const queueRow = buildQueueButtons(currentPage, totalPages);

        const queueMsg = await interaction.followUp({
          embeds: [queueEmbed],
          components: [queueRow],
          ephemeral: true,
        }).catch(() => null);

        if (queueMsg && totalPages > 1) {
          const collector = queueMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000,
          });

          collector.on("collect", async (i) => {
            if (i.user.id !== interaction.user.id) {
              await i.reply({
                content: "❌ Bạn không thể thao tác trên menu này!",
                ephemeral: true,
              }).catch(() => {});
              return;
            }

            const currentTracks = (player.queue?.tracksList ||
              player.queue?.getTracks?.() ||
              (player.queue as any)?.tracks ||
              []) as any[];
            const currentTotalPages = Math.max(1, Math.ceil(currentTracks.length / 10));

            if (i.customId === "queue_page_prev") {
              if (currentPage > 1) currentPage--;
            } else if (i.customId === "queue_page_next") {
              if (currentPage < currentTotalPages) currentPage++;
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
              (player.queue as any)?.tracks ||
              []) as any[];
            const currentTotalPages = Math.max(1, Math.ceil(currentTracks.length / 10));
            const disabledRow = buildQueueButtons(currentPage, currentTotalPages, true);
            await queueMsg.edit({ components: [disabledRow] }).catch(() => {});
          });
        }
        return;
      }
    }

    let feedbackMessage: string | null = null;

    // 5. Xử lý các nút bấm trực tiếp (Hàng 1, Hàng 2 & Hàng 3)
    if (interaction.isButton()) {
      switch (interaction.customId) {
        case UI_IDS.BUTTON_PAUSE:
          if (!player.isPaused) {
            await player.pause();
            feedbackMessage = "Đã tạm dừng phát nhạc!";
          } else {
            feedbackMessage = "Trình phát nhạc đã ở trạng thái tạm dừng từ trước!";
          }
          break;

        case UI_IDS.BUTTON_RESUME:
          if (player.isPaused) {
            await player.resume();
            feedbackMessage = "Đã tiếp tục phát nhạc!";
          } else {
            feedbackMessage = "Trình phát nhạc đang phát bình thường!";
          }
          break;

        case "player_pause_resume":
          if (player.isPaused) {
            await player.resume();
            feedbackMessage = "Đã tiếp tục phát nhạc!";
          } else {
            await player.pause();
            feedbackMessage = "Đã tạm dừng phát nhạc!";
          }
          break;

        case UI_IDS.BUTTON_SKIP:
          await player.skip();
          feedbackMessage = "Đã bỏ qua bài hát hiện tại!";
          break;

        case UI_IDS.BUTTON_STOP:
          await player.stop();
          feedbackMessage = "Đã dừng phát nhạc!";
          break;

        case UI_IDS.BUTTON_PREV:
          if (typeof (player as any).previous === "function") {
            await (player as any).previous();
            feedbackMessage = "Đã quay lại bài hát trước đó!";
          }
          break;

        case UI_IDS.BUTTON_LOOP_TRACK: {
          const currentLoop =
            (player.queue as any)?.loopMode || player.queue?.getLoopMode?.() || "off";
          if (currentLoop === "track") {
            player.queue.loop("off");
            feedbackMessage = "Đã tắt lặp lại bài hát!";
          } else {
            player.queue.loop("track");
            feedbackMessage = "Đã bật lặp lại bài hát hiện tại!";
          }
          break;
        }

        case UI_IDS.BUTTON_SHUFFLE:
          player.queue.shuffle();
          feedbackMessage = "Đã xáo trộn danh sách phát!";
          break;

        case UI_IDS.BUTTON_AUTOPLAY: {
          const currentAutoplay = Boolean(
            (player as any).data?.autoplay ??
            (player.queue as any)?.isAutoPlay ??
            (player.queue as any)?.autoPlayMode
          );
          const nextAutoplay = !currentAutoplay;
          if (typeof (player.queue as any)?.autoPlay === "function") {
            (player.queue as any).autoPlay(nextAutoplay);
          }
          if (!(player as any).data) (player as any).data = {};
          (player as any).data.autoplay = nextAutoplay;
          feedbackMessage = nextAutoplay ? "Đã bật chế độ AutoPlay!" : "Đã tắt chế độ AutoPlay!";
          break;
        }

        case UI_IDS.BUTTON_SEEK_BACK_30: {
          const now = Date.now();
          const lastSeek = seekCooldowns.get(interaction.guildId) ?? 0;
          if (now - lastSeek < 3000) {
            await interaction.followUp({
              content: "⚠️ Vui lòng đợi 3 giây giữa các lần tua nhạc để tránh gián đoạn âm thanh!",
              ephemeral: true,
            }).catch(() => {});
            return;
          }
          seekCooldowns.set(interaction.guildId, now);

          const currentPos =
            (player as any).position ?? (player as any).playbackTime ?? 0;
          const target = Math.max(0, currentPos - 30000);
          await player.seek(target);
          feedbackMessage = "Đã tua lùi 30 giây (-30s)!";
          break;
        }

        case UI_IDS.BUTTON_SEEK_FORWARD_30: {
          const now = Date.now();
          const lastSeek = seekCooldowns.get(interaction.guildId) ?? 0;
          if (now - lastSeek < 3000) {
            await interaction.followUp({
              content: "⚠️ Vui lòng đợi 3 giây giữa các lần tua nhạc để tránh gián đoạn âm thanh!",
              ephemeral: true,
            }).catch(() => {});
            return;
          }
          seekCooldowns.set(interaction.guildId, now);

          const currentPos =
            (player as any).position ?? (player as any).playbackTime ?? 0;
          const duration = player.currentTrack?.duration
            ? (player.currentTrack.duration > 10000
                ? player.currentTrack.duration
                : player.currentTrack.duration * 1000)
            : 0;
          const target = Math.min(Math.max(0, duration - 2000), currentPos + 30000);
          await player.seek(target);
          feedbackMessage = "Đã tua tiến 30 giây (+30s)!";
          break;
        }

        default:
          return;
      }
    }

    // 6. Xử lý Menu Dropdown (player_menu)
    if (interaction.isStringSelectMenu() && interaction.customId === UI_IDS.SELECT_MENU) {
      const selectedValue = interaction.values[0];

      // Xử lý chế độ Loop
      if (selectedValue === UI_IDS.MENU_LOOP_OFF) {
        player.queue.loop("off");
        feedbackMessage = "Đã tắt chế độ lặp lại!";
      } else if (selectedValue === UI_IDS.MENU_LOOP_TRACK) {
        player.queue.loop("track");
        feedbackMessage = "Đã bật lặp lại bài hát hiện tại!";
      } else if (selectedValue === UI_IDS.MENU_LOOP_QUEUE) {
        player.queue.loop("queue");
        feedbackMessage = "Đã bật lặp lại toàn bộ hàng đợi!";
      }

      // Xử lý âm lượng (khóa trần tối đa 100, không bị ép ngược lại)
      else if (selectedValue === UI_IDS.MENU_VOL_60) {
        await player.setVolume(60);
        feedbackMessage = "Đã chỉnh âm lượng về 60%!";
      } else if (selectedValue === UI_IDS.MENU_VOL_80) {
        await player.setVolume(80);
        feedbackMessage = "Đã chỉnh âm lượng về 80% (chuẩn khuyên dùng)!";
      } else if (selectedValue === UI_IDS.MENU_VOL_100) {
        await player.setVolume(100);
        feedbackMessage = "Đã chỉnh âm lượng lên 100% (mức tối đa trần chống rè)!";
      }

      // Xử lý EQ / Audio Filters (có cooldown 2s & chống rè âm thanh)
      else if (
        selectedValue === UI_IDS.MENU_EQ_OFF ||
        selectedValue === UI_IDS.MENU_EQ_BASS ||
        selectedValue === UI_IDS.MENU_EQ_NIGHTCORE ||
        selectedValue === UI_IDS.MENU_EQ_VAPORWAVE ||
        selectedValue === UI_IDS.MENU_EQ_CRYSTAL ||
        selectedValue === UI_IDS.MENU_EQ_LOFI ||
        selectedValue === UI_IDS.MENU_EQ_KARAOKE ||
        selectedValue.startsWith("menu_eq_")
      ) {
        const lastEqTime = eqCooldowns.get(interaction.guildId) ?? 0;
        const now = Date.now();
        if (now - lastEqTime < 2000) {
          await interaction.followUp({
            content: "⚠️ Vui lòng đợi 2 giây giữa các lần đổi bộ lọc EQ để tránh lag âm thanh!",
            ephemeral: true,
          }).catch(() => {});
          return;
        }
        eqCooldowns.set(interaction.guildId, now);

        if (selectedValue === UI_IDS.MENU_EQ_OFF) {
          // Khi tắt EQ: đặt player.data.eq = "off" và xóa sạch filter
          if (!(player as any).data) (player as any).data = {};
          (player as any).data.eq = "off";
          try {
            if (player.filter && typeof player.filter.clearAll === "function") {
              await player.filter.clearAll();
            } else if (typeof (player as any).clearFilters === "function") {
              await (player as any).clearFilters();
            }
          } catch (filterError) {
            console.warn("Lỗi khi xóa filter/EQ:", filterError);
          }
          feedbackMessage = "Đã tắt bộ lọc EQ (Normal / Flat)!";
        } else {
          // Quy tắc chống rè: khi bật bất kỳ EQ nào khác "off", nếu volume > 75 thì tự hạ về 75
          if (player.volume > 75) {
            await player.setVolume(75);
          }

          // Xóa filter cũ trước khi áp dụng mới
          try {
            if (player.filter && typeof player.filter.clearAll === "function") {
              await player.filter.clearAll();
            }
          } catch (clearErr) {
            console.warn("Lỗi khi xóa bộ lọc cũ:", clearErr);
          }

          const rawEq = selectedValue.replace("menu_eq_", "");
          if (!(player as any).data) (player as any).data = {};
          (player as any).data.eq = rawEq;

          try {
            if (selectedValue === UI_IDS.MENU_EQ_CRYSTAL || rawEq === "crystal") {
              const crystalFilter: AudioFilter = {
                name: "crystal",
                ffmpegFilter: "treble=g=5,equalizer=f=2000:t=q:w=1:g=3",
                description: "Crystal Clear",
              };
              if (player.filter && typeof player.filter.applyFilter === "function") {
                await player.filter.applyFilter(crystalFilter);
              }
              feedbackMessage = "Đã kích hoạt EQ Crystal Clear ✨ (Âm lượng tự động tối ưu ≤75%)!";
            } else if (selectedValue === UI_IDS.MENU_EQ_BASS || rawEq === "bass") {
              if (player.filter && typeof player.filter.applyFilter === "function") {
                await player.filter.applyFilter("bassboost");
              }
              feedbackMessage = "Đã kích hoạt EQ BassBoost nhẹ 💥 (Âm lượng tự động tối ưu ≤75%)!";
            } else {
              // nightcore, vaporwave, lofi, karaoke
              if (player.filter && typeof player.filter.applyFilter === "function") {
                await player.filter.applyFilter(rawEq);
              }
              const eqLabels: Record<string, string> = {
                nightcore: "Nightcore ⚡",
                vaporwave: "Vaporwave 🌊",
                lofi: "Lo-Fi ☕",
                karaoke: "Karaoke 🎤",
              };
              const label = eqLabels[rawEq] || rawEq;
              feedbackMessage = `Đã kích hoạt EQ ${label} (Âm lượng tự động tối ưu ≤75%)!`;
            }
          } catch (filterError) {
            console.warn(`Lỗi khi áp dụng filter/EQ ${rawEq}:`, filterError);
          }
        }
      }
    }

    // 7. Cập nhật lại UI sau thao tác (nút bấm hoặc dropdown) và gửi followUp xác nhận
    const ui = createPlayerUi(player);
    await interaction.editReply(ui).catch(async () => {
      await interaction.message.edit(ui).catch(() => {});
    });

    if (feedbackMessage) {
      await interaction.followUp({
        content: `✅ ${feedbackMessage}`,
        ephemeral: true,
      }).catch(() => {});
    }
  } catch (error: any) {
    // Tránh crash bot khi tương tác hết hạn (Unknown interaction / code 10062)
    if (error?.code === 10062 || error?.message?.includes("Unknown interaction")) {
      console.warn("Tương tác Discord đã hết hạn trước khi kịp phản hồi.");
      return;
    }
    console.error("Lỗi khi xử lý tương tác phát nhạc:", error);
  }
}
