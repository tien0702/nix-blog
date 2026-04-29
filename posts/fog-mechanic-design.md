---
title: "Thiết Kế Mechanic Sương Mù — Khi Visibility Trở Thành Gameplay"
date: 2026-03-28
tags: [unity, gameplay, design]
thumbnail: ""
summary: "Sương mù không chỉ là visual effect — nó là core mechanic ảnh hưởng AI, tension, và cách player đưa ra quyết định."
featured: false
draft: false
---

## Ý tưởng gốc

Trong hầu hết game, fog of war là visual trick để che map. Mình muốn làm ngược lại: **sương mù là thứ player phải actively manage**, không phải thứ bị áp đặt.

## Cách nó hoạt động

Fog density thay đổi real-time theo thời gian trong ngày và hành động của player. Khi sương dày, visibility radius giảm xuống 3 tile — áp dụng cho cả player lẫn enemy AI.

Điều này tạo ra tình huống thú vị: ẩn trong sương mù có thể là lợi thế (enemy không thấy bạn) hoặc bẫy (bạn cũng không thấy gì).

## Implementation

- Custom shader blend giữa world và fog texture
- Fog density lưu trong ScriptableObject để dễ tune mà không cần recompile
- Enemy AI có FogAwarenessComponent — điều chỉnh patrol radius theo density hiện tại

## Điều mình học được

Khi một mechanic *constraint* cả player và enemy, nó tạo ra emergent gameplay thú vị hơn là chỉ constraint một phía. Tension đến từ sự **bất định có hệ thống**, không phải random.
