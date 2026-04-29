---
title: "Bài Học Đắt Giá: Scope Creep Giết Chết Dự Án Như Thế Nào"
date: 2026-04-18
tags: [gamedev, bài-học, production]
thumbnail: ""
summary: "Hai tuần đi lạc vì thêm feature không cần thiết. Câu chuyện thật và cách mình thoát ra khỏi vòng lặp đó."
featured: true
draft: false
---

## Chuyện gì xảy ra

Mình mất 2 tuần implement crafting system — một feature hoàn toàn không nằm trong design doc ban đầu. Kết quả: system hoạt động, nhưng không *fit* với core loop của game. Cuối cùng phải cắt bỏ toàn bộ.

## Tại sao lại xảy ra?

Lý do đơn giản đến ngượng ngùng: **mình thấy nó thú vị**. Không phải vì game cần, mà vì mình muốn làm. Đây là cái bẫy kinh điển của solo dev — không có ai để kéo bạn lại.

## Lesson

Mỗi feature mới phải trả lời được: *"Feature này serve core loop như thế nào?"*. Nếu câu trả lời mơ hồ — đừng làm.

Bây giờ mình dùng một file `SCOPE.md` như một contract với bản thân. Mỗi khi muốn thêm gì, phải viết vào đó và đợi 24 giờ mới quyết định.

## Takeaway

- Viết design doc trước, dù ngắn
- Dùng SCOPE.md như checklist
- Đặt câu hỏi: game có *cần* cái này không, hay chỉ mình *muốn*?
