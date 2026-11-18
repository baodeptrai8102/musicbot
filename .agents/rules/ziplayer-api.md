---
trigger: glob
globs: "src/**/*.ts"
description: Chuẩn Public API của thư viện ziplayer khi viết code bot nhạc
---

# ZiPlayer Public API (Bản rút gọn cho Bot)

## Khởi tạo Singleton
- Yêu cầu Node.js >= 20.3. Chỉ tạo `new PlayerManager({ plugins, autoCleanup: true })` đúng 1 lần trong src/index.ts.
- Trong mọi file lệnh và sự kiện, luôn lấy lại qua `getManager()` và `getPlayer(guildId)`. Không tạo `PlayerManager` mới theo từng server và không gắn vào Discord client.
- Khi `getPlayer(guildId)` trả về `undefined`, tạo bằng `await manager.create(guildId, options)`.

## Điều khiển phát nhạc & Âm thanh chống rè
- Mọi hàm đều bất đồng bộ, bắt buộc `await` và kiểm tra kết quả `false` hoặc bắt lỗi: `player.connect(voiceChannel)`, `player.play(query, { requestedBy })`, `player.insert(query, index, userId)`, `player.pause()`, `player.resume()`, `player.skip()`, `player.previous()`, `player.seek(ms)`, `player.stop()`, `player.destroy()`.
- `player.setVolume(value)` đặt mặc định 80 và khóa trần tối đa 100 để tránh vỡ tiếng.
- Inline Opus volume của `ziplayer` không cần FFmpeg; mặc định tắt toàn bộ EQ/filter để nhẹ CPU và không rè tiếng, chỉ bật khi người dùng chọn trong menu.

## Hàng đợi & Sự kiện
- Đọc đồng bộ: `player.currentTrack`, `player.connection`, `player.isPlaying`, `player.isPaused`, `player.isIdle`, `player.volume`, `player.queue`.
- Thao tác queue: `player.queue.add(track)` chỉ nhận `Track` đã resolve (không truyền chuỗi tìm kiếm thô), `remove(i)`, `move(from, to)`, `shuffle()`, `clear()`, `loop("off" | "track" | "queue")`, `autoPlay(bool)`.
- Dữ liệu riêng theo từng player lưu trong `player.data` (không ghi đè các key bắt đầu bằng `@ziplayer/`).
- Đăng ký sự kiện qua `manager.on()`: `trackStart`, `trackEnd`, `queueEnd`, `playerError`, `connectionError`, `queueAdd`, `queueAddList`, `playerPause`, `playerResume`, `playerDestroy`.
- Tuyệt đối không dùng `Bus`, controller nội bộ hay chạy lệnh test thư mục `core/`.