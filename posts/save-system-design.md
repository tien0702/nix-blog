---
title: "Xây Dựng Save System Linh Hoạt Với JSON Serialization"
date: 2026-04-10
tags: [unity, kỹ-thuật, architecture]
thumbnail: ""
summary: "Thiết kế save system scalable dùng interface ISaveable — thêm object mới không cần sửa core."
featured: true
draft: false
---

## Yêu cầu ban đầu

Save system cần xử lý: vị trí player, inventory, trạng thái world (cửa đã mở, enemy đã chết...), và game settings. Tất cả phải hoạt động ngay cả khi có thêm feature mới.

## Architecture: SaveableEntity Pattern

Mỗi object muốn được save thì implement interface `ISaveable`:

- `CaptureState()` — trả về object chứa data cần lưu
- `RestoreState(object state)` — nhận data và khôi phục

**GameDataManager** collect tất cả ISaveable trong scene, serialize ra JSON, và ghi file.

## Tại sao approach này tốt?

Scalable theo đúng nghĩa: thêm NPC mới chỉ cần implement ISaveable — không động vào GameDataManager. Đây là *Open/Closed Principle* trong thực tế.

## Lưu ý

- Dùng `JsonUtility` của Unity cho simple data, `Newtonsoft.Json` nếu cần nested object
- Đặt unique ID cho mỗi SaveableEntity — dùng GUID
- Backup save file trước khi ghi đè
