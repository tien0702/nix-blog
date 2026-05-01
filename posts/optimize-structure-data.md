---
title: "ScriptableObjects & Object Pooling: Bộ đôi cứu cánh cho hiệu năng Unity"
date: 2026-05-03
tags: [unity, technical, optimization]
summary: "Muốn game chạy mượt và code dễ mở rộng? Hãy bắt đầu bằng việc tách rời dữ liệu và tái sử dụng object."
---

Trong phát triển game, đặc biệt là giai đoạn đầu tập trung vào gameplay mechanics, việc tổ chức code khoa học là cực kỳ quan trọng.

### Tại sao nên dùng ScriptableObjects?
Thay vì hard-code các chỉ số như tốc độ chạy hay máu trực tiếp vào script, mình sử dụng ScriptableObjects để lưu trữ dữ liệu dưới dạng tài sản (Asset) độc lập.

* **Tách biệt dữ liệu:** Bạn có thể thay đổi chỉ số ngay khi game đang chạy mà không sợ mất dữ liệu.
* **Tính linh hoạt:** Designer có thể trực tiếp tinh chỉnh các file này trong Editor mà không cần đụng vào code.
* **Trường hợp:** Cực kỳ hữu ích cho hệ thống Item, Stats nhân vật hoặc cấu hình Level.

### Đừng Instantiate nữa, hãy dùng Pooling!
Việc tạo và hủy Object (`Instantiate`/`Destroy`) liên tục là nguyên nhân hàng đầu gây lag do bộ thu gom rác (Garbage Collector) bị kích hoạt.

* **Giải pháp:** Object Pooling. Chúng ta tạo sẵn một "bể" chứa các object và tái sử dụng chúng bằng cách bật/tắt (Activate/Deactivate).
* **Kết quả:** Giảm tải đáng kể cho CPU, đặc biệt là với các hệ thống đạn hoặc hiệu ứng cháy nổ trong game casual.

Tối ưu hóa không phải là việc làm sau cùng, mà nó phải nằm trong tư duy thiết kế ngay từ đầu để xây dựng một portfolio chuyên nghiệp.