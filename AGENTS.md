# Luật cốt lõi - VOLT Music Bot
- Chỉ đọc và chỉnh sửa đúng file được nêu trong task hoặc tag bằng @filename. Không tự quét toàn bộ dự án.
- Đọc code hiện có trước khi sửa; tuyệt đối không đoán tên hàm, đường dẫn import hay kiểu dữ liệu.
- Zero-regression: Chỉ sửa đúng phần liên quan, không xóa hoặc viết lại logic cũ đang chạy ổn.
- Giữ nguyên toàn bộ lệnh prefix `!`, không tạo hay chuyển sang slash command.
- Phanh chống vòng lặp: Nếu chạy lệnh build hoặc sửa cùng 1 lỗi thất bại 2 lần liên tiếp, DỪNG NGAY, ghi nguyên nhân gốc và báo cáo.
- Báo cáo sau mỗi lượt tối đa 5 dòng, ngắn gọn.