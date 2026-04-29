---
title: "Pixel Art Workflow: Tool, Palette, và Quy Trình Của Mình"
date: 2026-03-15
tags: [art, pixel-art, workflow]
thumbnail: ""
summary: "Chia sẻ toàn bộ quy trình tự vẽ asset cho game — từ chọn tool đến quản lý palette và animation."
featured: false
draft: false
---

## Tool

**Aseprite** cho tất cả pixel art. Giá khoảng $20, đáng từng đồng. Workflow frame-by-frame cực kỳ mượt, shortcut được thiết kế riêng cho pixel art.

Alternative miễn phí: **Libresprite** (fork của Aseprite cũ) hoặc **Pixelorama** nếu bạn thích open-source.

## Constraint palette: 16 màu

Giới hạn palette thực ra là một creative constraint tốt. Nó buộc bạn phải dùng màu thông minh hơn, và kết quả là visual identity nhất quán hơn tự nhiên.

Mình dùng **Lospec** để tìm và test palette trước khi commit.

## Animation breakdown

Mỗi character: idle (4f) · walk (6f) · run (8f) · attack (5f) · hurt (3f) · die (8f). Tổng cộng khá nhiều, nhưng có thể reuse frame giữa các animation để tiết kiệm thời gian.

## Export workflow

- Export spritesheet thay vì từng frame riêng
- Dùng Aseprite CLI để auto-export khi save (tích hợp vào Unity build)
- Đặt tên theo convention: `char_player_idle.png`
