---
title: "Clean Code trong Unity: Xây dựng dự án bền vững"
date: 2026-05-05
tags: [cleancode, architecture, unity]
summary: "Code chạy được là tốt, nhưng code mà 3 tháng sau bạn vẫn hiểu được thì mới là tuyệt vời. Khám phá S.O.L.I.D và ASMDEF."
---

Khi dự án phình to, việc quản lý hàng trăm script trở thành một cơn ác mộng. Để xây dựng một nền tảng vững chắc, mình luôn tuân thủ các nguyên tắc thiết kế chuyên nghiệp.

### S.O.L.I.D - Nguyên lý Đơn nhiệm
Nguyên tắc quan trọng nhất là **Single Responsibility** (Đơn nhiệm). Một Script chỉ nên làm một việc duy nhất. Đừng tạo ra những class "siêu nhân" gánh vác quá nhiều logic. Việc chia nhỏ giúp bạn dễ dàng tái sử dụng code và kiểm soát lỗi tốt hơn.

### Assembly Definitions (.asmdef) - Vũ khí bí mật
Bạn có mệt mỏi khi phải chờ Unity biên dịch lại toàn bộ code mỗi khi chỉ sửa một dòng? 

* **Giải pháp:** Chia code thành các module bằng `.asmdef`. 
* **Lợi ích:** Unity sẽ chỉ biên dịch lại module nào có thay đổi, giúp tiết kiệm thời gian phát triển hàng ngày và quản lý sự phụ thuộc giữa các phần code chặt chẽ hơn.

### Tư duy Composition over Inheritance
Thay vì tạo một class "Cha" quá lớn (Inheritance), hãy ưu tiên lắp ghép các Component nhỏ lại với nhau (Composition). Điều này giúp game của bạn linh hoạt và dễ mở rộng hơn rất nhiều.

Hãy nhớ: Code chạy được chỉ là điều kiện cần, code dễ đọc và dễ bảo trì mới là điều kiện đủ để bạn đi xa trong ngành Game Dev.