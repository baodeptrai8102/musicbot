import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { Player } from "ziplayer";

/**
 * Hằng số UI IDs dùng chung cho tất cả Button, SelectMenu value, Modal
 */
export const UI_IDS = {
  // Buttons - Hàng 1
  BUTTON_PAUSE: "player_pause",
  BUTTON_RESUME: "player_resume",
  BUTTON_SKIP: "player_skip",
  BUTTON_STOP: "player_stop",

  // Buttons - Hàng 2
  BUTTON_PREV: "player_prev",
  BUTTON_LOOP_TRACK: "player_loop_track",
  BUTTON_SHUFFLE: "player_shuffle",
  BUTTON_AUTOPLAY: "player_autoplay",

  // Buttons - Hàng 3 (Tua nhạc)
  BUTTON_SEEK_BACK_30: "player_seek_back_30",
  BUTTON_SEEK_MODAL: "player_seek_modal",
  BUTTON_SEEK_FORWARD_30: "player_seek_forward_30",

  // Select Menu
  SELECT_MENU: "player_menu",

  // Dropdown Menu options
  MENU_QUEUE: "menu_queue",
  MENU_LOOP_TRACK: "menu_loop_track",
  MENU_LOOP_QUEUE: "menu_loop_queue",
  MENU_LOOP_OFF: "menu_loop_off",
  MENU_VOL_100: "menu_vol_100",
  MENU_VOL_80: "menu_vol_80",
  MENU_VOL_60: "menu_vol_60",
  MENU_EQ_OFF: "menu_eq_off",
  MENU_EQ_BASS: "menu_eq_bass",
  MENU_EQ_NIGHTCORE: "menu_eq_nightcore",
  MENU_EQ_VAPORWAVE: "menu_eq_vaporwave",
  MENU_EQ_CRYSTAL: "menu_eq_crystal",
  MENU_EQ_LOFI: "menu_eq_lofi",
  MENU_EQ_KARAOKE: "menu_eq_karaoke",

  // Modal
  MODAL_SEEK: "modal_seek",
  MODAL_SEEK_INPUT: "seek_time_input",
} as const;

/**
 * Format số giây thành mm:ss hoặc hh:mm:ss
 */
export function formatTime(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "00:00";
  const s = Math.floor(seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const remSeconds = s % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remSeconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${remSeconds.toString().padStart(2, "0")}`;
}

/**
 * Format thời lượng (ms hoặc seconds) sang dạng mm:ss hoặc hh:mm:ss (giữ tương thích)
 */
export function formatDuration(duration?: number): string {
  if (!duration || isNaN(duration) || duration <= 0) return "00:00";
  const totalSeconds = duration > 10000 ? Math.floor(duration / 1000) : Math.floor(duration);
  return formatTime(totalSeconds);
}

/**
 * Lấy nhãn hiển thị cho chế độ Loop
 */
function getLoopLabel(loopMode?: string): string {
  switch (loopMode) {
    case "track":
      return "1 bài";
    case "queue":
      return "Hàng đợi";
    case "off":
    default:
      return "Tắt";
  }
}

/**
 * Lấy nhãn hiển thị cho chế độ EQ
 */
function getEqLabel(eqName?: string): string {
  switch (eqName) {
    case "bass":
    case "bassboost":
      return "💥 BassBoost nhẹ";
    case "nightcore":
      return "⚡ Nightcore";
    case "vaporwave":
      return "🌊 Vaporwave";
    case "crystal":
      return "✨ Crystal Clear";
    case "lofi":
      return "☕ Lo-Fi";
    case "karaoke":
      return "🎤 Karaoke";
    case "off":
    default:
      return "🛡️ Tắt (Normal / Inline Opus)";
  }
}

/**
 * Nhận diện nguồn phát từ Track
 */
function getSourceName(track: any): string {
  const raw = (track?.sourceName || track?.source || "").toLowerCase();
  if (raw.includes("spotify") || track?.url?.includes("spotify")) return "Spotify";
  if (raw.includes("soundcloud") || track?.url?.includes("soundcloud")) return "SoundCloud";
  if (raw.includes("youtube") || track?.url?.includes("youtube") || track?.url?.includes("youtu.be")) return "YouTube";
  return track?.sourceName || track?.source || "Trực tiếp / Khác";
}

/**
 * Tạo thanh tiến trình 12 ký tự nằm gọn trên 1 dòng kèm đúng 1 cặp mốc thời gian [01:23 / 03:45]
 */
export function createProgressBar(posSec: number, durSec: number, isLive: boolean = false): string {
  if (isLive) {
    return "🔘─────────── [🔴 Trực tiếp]";
  }

  const total = Math.max(durSec, 0);
  const current = Math.min(Math.max(posSec, 0), total || posSec);
  const currentStr = formatTime(current);
  const totalStr = total > 0 ? formatTime(total) : "--:--";

  const barLength = 12;
  const progress = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0;
  const circleIndex = Math.min(Math.floor(progress * barLength), barLength - 1);

  const bar = "─".repeat(circleIndex) + "🔘" + "─".repeat(barLength - 1 - circleIndex);

  if (total > 0) {
    const remainingMs = Math.max(0, (total - current) * 1000);
    const endTimestamp = Math.floor((Date.now() + remainingMs) / 1000);
    return `${bar} [${currentStr} / ${totalStr}]\n⏳ Kết thúc: <t:${endTimestamp}:R>`;
  }

  return `${bar} [${currentStr} / ${totalStr}]`;
}

/**
 * Tạo giao diện Now Playing gồm Embed, 3 hàng nút bấm và 1 Dropdown Menu
 */
export function createPlayerUi(player: Player | any): {
  embeds: EmbedBuilder[];
  components: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[];
} {
  const track = player?.currentTrack;
  const loopMode = player?.queue?.loopMode || "off";
  const volume = player?.volume ?? 80;
  const currentEq = player?.data?.eq || "off";
  const queueLength = player?.queue?.tracks?.length ?? player?.queue?.size ?? 0;
  const isAutoplay = Boolean(player?.data?.autoplay ?? player?.queue?.autoPlayMode ?? player?.autoPlay);

  // Tính toán thời gian
  const rawPos = player?.position ?? player?.playbackTime ?? 0;
  const posSec = Math.floor(rawPos / 1000);
  const durSec = track?.duration
    ? (track.duration > 10000 ? Math.floor(track.duration / 1000) : Math.floor(track.duration))
    : 0;

  const progressBar = createProgressBar(posSec, durSec, Boolean(track?.isLive));
  const authorName = track?.author || track?.channel || "Không rõ";
  const statusIcon = player?.isPaused ? "⏸️" : "▶️";
  const statusLabel = player?.isPaused ? "Tạm dừng" : "Đang phát";
  const requester = track?.requestedBy ? `<@${track.requestedBy}>` : authorName;
  const sourceName = getSourceName(track);

  // 1. Tạo Embed VOLT Music
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(track?.title ? `🎵 ${track.title}` : "🎵 VOLT Music")
    .setTimestamp();

  if (track?.url) {
    embed.setURL(track.url);
  }

  if (track?.thumbnail) {
    embed.setThumbnail(track.thumbnail);
  }

  if (track) {
    embed.setDescription(
      `👤 **Tác giả:** ${authorName}\n` +
      `📊 **Trạng thái:** ${statusIcon} ${statusLabel} • 🔊 **Âm lượng:** ${volume}%\n` +
      `🔁 **Lặp lại:** ${getLoopLabel(loopMode)} • 🎛️ **Bộ lọc EQ:** ${getEqLabel(currentEq)}\n\n` +
      `${progressBar}`
    );

    embed.addFields(
      { name: "👤 Yêu cầu bởi", value: requester, inline: true },
      { name: "📑 Hàng đợi", value: `${queueLength} bài`, inline: true },
      { name: "🌐 Nguồn phát", value: sourceName, inline: true }
    );
  } else {
    embed.setDescription("Hiện không có bài hát nào đang phát.");
  }

  const clientUser = player?.client?.user;
  if (clientUser?.displayAvatarURL) {
    embed.setFooter({ text: "VOLT Music", iconURL: clientUser.displayAvatarURL() });
  } else {
    embed.setFooter({ text: "VOLT Music" });
  }

  // 2. Tạo 2 Hàng nút (components)
  // Hàng nút 1: 4 nút trực tiếp (Tạm dừng, Tiếp tục, Bỏ qua, Dừng)
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(UI_IDS.BUTTON_PAUSE)
      .setLabel("Tạm dừng")
      .setEmoji("⏸️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(Boolean(player?.isPaused)),
    new ButtonBuilder()
      .setCustomId(UI_IDS.BUTTON_RESUME)
      .setLabel("Tiếp tục")
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!player?.isPaused),
    new ButtonBuilder()
      .setCustomId(UI_IDS.BUTTON_SKIP)
      .setLabel("Bỏ qua")
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(UI_IDS.BUTTON_STOP)
      .setLabel("Dừng")
      .setEmoji("⏹️")
      .setStyle(ButtonStyle.Danger)
  );

  // Hàng nút 2: 4 nút mở rộng (Lùi bài, Lặp 1 bài, Trộn bài, AutoPlay)
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(UI_IDS.BUTTON_PREV)
      .setLabel("Lùi bài")
      .setEmoji("⏮️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(UI_IDS.BUTTON_LOOP_TRACK)
      .setLabel("Lặp 1 bài")
      .setEmoji("🔂")
      .setStyle(loopMode === "track" ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(UI_IDS.BUTTON_SHUFFLE)
      .setLabel("Trộn bài")
      .setEmoji("🔀")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(UI_IDS.BUTTON_AUTOPLAY)
      .setLabel("AutoPlay")
      .setEmoji("📻")
      .setStyle(isAutoplay ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  // Hàng nút 3: 3 nút tua nhạc (-30s, Tua đến..., +30s)
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(UI_IDS.BUTTON_SEEK_BACK_30)
      .setLabel("-30s")
      .setEmoji("⏪")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(UI_IDS.BUTTON_SEEK_MODAL)
      .setLabel("Tua đến...")
      .setEmoji("🎯")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(UI_IDS.BUTTON_SEEK_FORWARD_30)
      .setLabel("+30s")
      .setEmoji("⏩")
      .setStyle(ButtonStyle.Secondary)
  );

  // Xác định placeholder cho Dropdown Menu dựa trên trạng thái EQ hiện tại
  let eqPlaceholder = "⚙️ Tùy chọn điều khiển phát nhạc & Âm thanh...";
  switch (currentEq) {
    case "off":
      eqPlaceholder = "🛡️ Tắt EQ (Normal / Flat)";
      break;
    case "bass":
    case "bassboost":
      eqPlaceholder = "💥 Đang bật: EQ BassBoost nhẹ";
      break;
    case "nightcore":
      eqPlaceholder = "⚡ Đang bật: EQ Nightcore";
      break;
    case "vaporwave":
      eqPlaceholder = "🌊 Đang bật: EQ Vaporwave";
      break;
    case "crystal":
      eqPlaceholder = "✨ Đang bật: EQ Crystal Clear";
      break;
    case "lofi":
      eqPlaceholder = "☕ Đang bật: EQ Lo-Fi";
      break;
    case "karaoke":
      eqPlaceholder = "🎤 Đang bật: EQ Karaoke";
      break;
    default:
      eqPlaceholder = "⚙️ Tùy chọn điều khiển phát nhạc & Âm thanh...";
  }

  // 3. Tạo Menu Dropdown (StringSelectMenuBuilder, customId: player_menu)
  const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(UI_IDS.SELECT_MENU)
      .setPlaceholder(eqPlaceholder)
      .addOptions(
        {
          label: "Xem danh sách phát (Queue)",
          value: UI_IDS.MENU_QUEUE,
          description: "Hiển thị danh sách các bài hát trong hàng đợi",
          emoji: "📜",
        },
        {
          label: "Bật/Tắt lặp lại bài hát (Loop: Track)",
          value: UI_IDS.MENU_LOOP_TRACK,
          description: "Lặp lại bài hát hiện tại",
          emoji: "🔂",
        },
        {
          label: "Lặp toàn hàng đợi (Loop: Queue)",
          value: UI_IDS.MENU_LOOP_QUEUE,
          description: "Lặp lại toàn bộ danh sách bài hát",
          emoji: "🔁",
        },
        {
          label: "Tắt lặp lại (Loop: Off)",
          value: UI_IDS.MENU_LOOP_OFF,
          description: "Tắt toàn bộ chế độ lặp lại",
          emoji: "❌",
        },
        {
          label: "Âm lượng 100% (Tối đa trần - Chống rè)",
          value: UI_IDS.MENU_VOL_100,
          description: "Mức âm lượng tối đa (khóa trần chống vỡ tiếng)",
          emoji: "📢",
        },
        {
          label: "Âm lượng 80% (Mặc định chuẩn)",
          value: UI_IDS.MENU_VOL_80,
          description: "Mức âm lượng chuẩn khuyên dùng",
          emoji: "🔊",
        },
        {
          label: "Âm lượng 60% (Vừa vặn)",
          value: UI_IDS.MENU_VOL_60,
          description: "Mức âm lượng êm dịu, vừa phải",
          emoji: "🔉",
        },
        {
          label: "Tắt EQ (Normal / Flat)",
          value: UI_IDS.MENU_EQ_OFF,
          description: "Normal / Inline Opus (nhẹ CPU, không rè)",
          emoji: "🛡️",
        },
        {
          label: "EQ: BassBoost nhẹ",
          value: UI_IDS.MENU_EQ_BASS,
          description: "Tăng cường âm bass trầm ấm",
          emoji: "💥",
        },
        {
          label: "EQ: Nightcore",
          value: UI_IDS.MENU_EQ_NIGHTCORE,
          description: "Tăng tốc độ phát và cao độ bài hát",
          emoji: "⚡",
        },
        {
          label: "EQ: Vaporwave",
          value: UI_IDS.MENU_EQ_VAPORWAVE,
          description: "Làm chậm và tăng độ sâu âm hưởng",
          emoji: "🌊",
        },
        {
          label: "EQ: Crystal Clear",
          value: UI_IDS.MENU_EQ_CRYSTAL,
          description: "Âm thanh trong trẻo, sắc nét",
          emoji: "✨",
        },
        {
          label: "EQ: Lo-Fi",
          value: UI_IDS.MENU_EQ_LOFI,
          description: "Âm thanh ấm áp, thư giãn chill",
          emoji: "☕",
        },
        {
          label: "EQ: Karaoke",
          value: UI_IDS.MENU_EQ_KARAOKE,
          description: "Giảm vocal để hát karaoke",
          emoji: "🎤",
        }
      )
  );

  return {
    embeds: [embed],
    components: [row1, row2, row3, menuRow],
  };
}

/**
 * Tạo Modal nhập mốc thời gian tua bài hát
 */
export function createSeekModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(UI_IDS.MODAL_SEEK)
    .setTitle("Tua nhạc đến mốc thời gian");

  const seekInput = new TextInputBuilder()
    .setCustomId(UI_IDS.MODAL_SEEK_INPUT)
    .setLabel("Mốc thời gian (mm:ss, hh:mm:ss hoặc giây)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ví dụ: 01:30, 02:45:10, hoặc 90")
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(seekInput);

  modal.addComponents(row);
  return modal;
}
