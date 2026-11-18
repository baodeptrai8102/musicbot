---
name: automation
description: Tự động đọc work.md và giao từng đầu việc chưa xong cho subagent coder-worker thực thi liên tục
---

// turbo-all

Chạy vòng lặp tự động xử lý file `work.md`:

1. Đọc `work.md` và lấy dòng đầu tiên có trạng thái `[ ]`.
2. Nếu không còn dòng `[ ]` nào, dừng vòng lặp và báo tổng kết ngắn.
3. Ủy quyền đúng 1 task đó cho subagent `coder-worker` code và chạy lệnh test. Tuyệt đối không tự viết code trực tiếp ở phiên chat chính.
4. Nhận báo cáo từ `coder-worker` và cập nhật ngay `work.md`:
   - PASS: đổi `[ ]` thành `[x]`.
   - FAIL sau 2 lần thử: đổi `[ ]` thành `[!]`, ghi ngắn lỗi vào mục Nhật ký dừng rồi chuyển sang task tiếp theo.
5. Không dừng hỏi người dùng giữa các task. Lập tức quay lại Bước 1 cho đến khi xong toàn bộ `work.md`.