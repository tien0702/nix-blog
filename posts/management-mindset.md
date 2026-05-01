---
title: "Nhật ký xương máu: Khi sự sáng tạo trở thành kẻ thù của tiến độ"
date: 2026-05-01
tags: [production, gamedev, mindset]
summary: "Tại sao một tính năng 'thú vị' lại có thể suýt chút nữa nhấn chìm dự án của mình? Đây là cách mình dùng SCOPE.md để tự cứu lấy chính mình."
featured: true
---

Chào mọi người, tuần vừa qua mình vừa rút ra một bài học cực kỳ đắt giá mà mình tin là bất kỳ dev nào cũng từng mắc phải: **Scope Creep**.

### Cái bẫy của sự "Thú vị"
Mọi chuyện bắt đầu khi mình nảy ra ý tưởng thêm hệ thống Crafting vào game, dù nó không hề có trong thiết kế ban đầu[cite: 1]. Mình đã dành trọn 2 tuần ròng rã để thiết kế UI và viết logic, nhưng cuối cùng nhận ra nó hoàn toàn không ăn nhập với Core Loop của game[cite: 1]. Kết quả là mình đã phải cắt bỏ toàn bộ 14 ngày làm việc đó[cite: 1].

Lý do đơn giản đến mức ngượng ngùng: Mình làm vì mình thấy nó thú vị, chứ không phải vì game thực sự cần[cite: 1]. Đây là cái bẫy kinh điển của solo dev – khi không có ai để kéo bạn lại, bạn rất dễ sa đà vào những tính năng phụ[cite: 1].

### Quy tắc 24 giờ và file SCOPE.md
Để tự cứu lấy mình, mình đã thiết lập một quy trình mới gọi là `SCOPE.md` – một bản hợp đồng với chính bản thân[cite: 1]:

1. **Viết vào SCOPE.md:** Ghi lại mọi ý tưởng mới và trả lời câu hỏi: "Feature này phục vụ Core Loop như thế nào?"[cite: 1].
2. **Đợi đúng 24 giờ:** Tuyệt đối không chạm vào code trong vòng một ngày để xem xét lại tính logic của nó[cite: 1].
3. **Checklist thực tế:** Luôn đặt câu hỏi: Game có thực sự *cần* cái này không, hay chỉ mình *muốn* làm vì nó vui?[cite: 1].

Đừng để sự ngẫu hứng làm chệch hướng con tàu của bạn. Hãy luôn bám sát Design Doc, dù là bản ngắn nhất[cite: 1].