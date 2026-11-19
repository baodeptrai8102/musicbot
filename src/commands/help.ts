import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Message,
} from "discord.js";

/**
 * Xử lý lệnh !help: hiển thị danh sách lệnh phân nhóm khoa học và nút mời bot
 */
export async function handleHelp(message: Message, prefix: string = "!"): Promise<void> {
  const clientId = message.client.user?.id;
  const inviteUrl = clientId
    ? `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`
    : "https://discord.com";

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🎶 Hướng Dẫn Sử Dụng VOLT Music Bot")
    .setDescription(
      `Chào mừng bạn đến với **VOLT Music Bot**! Trình phát nhạc chất lượng cao, không rè tiếng.\n` +
      `Tiền tố lệnh hiện tại của bot là: \`${prefix}\`\n`
    )
    .addFields(
      {
        name: "🎵 Phát nhạc",
        value:
          `• \`${prefix}play <tên/link>\` *(viết tắt: \`${prefix}p\`)*: Phát nhạc từ YouTube, Spotify, SoundCloud.\n` +
          `• \`${prefix}playnext <tên/link>\` *(viết tắt: \`${prefix}pn\`)*: Chèn bài phát ngay tiếp theo.`,
        inline: false,
      },
      {
        name: "⏯️ Điều khiển & Tua",
        value:
          `• \`${prefix}skip\` / \`${prefix}next\` *(viết tắt: \`${prefix}s\`, \`${prefix}n\`)*: Bỏ qua bài hiện tại.\n` +
          `• \`${prefix}prev\` / \`${prefix}back\`: Lùi về bài hát trước đó.\n` +
          `• \`${prefix}pause\` / \`${prefix}resume\`: Tạm dừng / Tiếp tục phát.\n` +
          `• \`${prefix}seek <mm:ss>\` *(viết tắt: \`${prefix}tua\`)*: Tua đến mốc thời gian bài hát.\n` +
          `• \`${prefix}vol <0-100>\`: Chỉnh âm lượng (khóa trần 100% chống rè).\n` +
          `• \`${prefix}np\`: Xem giao diện Now Playing bài đang phát.\n` +
          `• \`${prefix}stop\`: Dừng phát và xóa hàng đợi.`,
        inline: false,
      },
      {
        name: "📜 Quản lý Hàng đợi",
        value:
          `• \`${prefix}queue\` *(viết tắt: \`${prefix}q\`)*: Xem danh sách phát phân trang (10 bài/trang).\n` +
          `• \`${prefix}shuffle\` *(viết tắt: \`${prefix}tron\`)*: Xáo trộn ngẫu nhiên hàng đợi.\n` +
          `• \`${prefix}remove <số>\` *(viết tắt: \`${prefix}xoa\`)*: Xóa bài theo số thứ tự.\n` +
          `• \`${prefix}move <từ> <đến>\`: Chuyển vị trí bài hát trong hàng đợi.\n` +
          `• \`${prefix}clear\`: Xóa sạch hàng đợi chờ phát.`,
        inline: false,
      },
      {
        name: "🎛️ Hiệu ứng EQ & AutoPlay",
        value:
          `• \`${prefix}loop <off|track|queue|1>\`: Lặp tắt / 1 bài / cả hàng đợi (\`${prefix}loop 1\` hoặc \`${prefix}loop track\`).\n` +
          `• \`${prefix}autoplay\` *(viết tắt: \`${prefix}ap\`)*: Bật/Tắt tự động phát bài tương tự khi hết nhạc.\n` +
          `• \`${prefix}filter <off|bassboost|nightcore|vaporwave|crystal|lofi|karaoke>\`: Bật bộ lọc EQ hoặc tắt về Normal Opus.`,
        inline: false,
      }
    )
    .setFooter({
      text: "VOLT Music Bot • Trải nghiệm âm thanh đỉnh cao",
      iconURL: message.client.user?.displayAvatarURL(),
    })
    .setTimestamp();

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Mời Bot vào Server")
      .setStyle(ButtonStyle.Link)
      .setURL(inviteUrl)
      .setEmoji("🤖")
  );

  await message.reply({
    embeds: [embed],
    components: [buttonRow],
  });
}

export const execute = handleHelp;
export default handleHelp;
