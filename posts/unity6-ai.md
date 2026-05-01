---
title: "Làm Chủ AI On-Device Với Unity Sentis: Tương Lai Hay Chỉ Là Trend?"
date: 2026-05-05
tags: [ai, unity-sentis, innovation]
summary: "Cách mình tích hợp model AI vào game mà không cần tốn một xu chi phí server hay lo ngại về độ trễ."
---

Lâu nay chúng ta thường nghĩ AI trong game là cái gì đó phải gọi qua API của OpenAI hoặc chạy trên những server khủng khiếp. Nhưng với **Unity Sentis**, mọi thứ đã thay đổi.

### Sức mạnh của Inference ngay trên thiết bị
Sentis cho phép bạn chạy các model AI (định dạng ONNX) trực tiếp trên phần cứng của người chơi (GPU/CPU). Điều này mở ra những khả năng chưa từng có:
1. **NPC thông minh:** Thay vì dùng cây hành vi (Behavior Tree) cứng nhắc, NPC có thể phản ứng dựa trên các model học máy.
2. **Xử lý ngôn ngữ/hình ảnh:** Nhận diện giọng nói hoặc cử chỉ vẽ tay của người chơi để tung chiêu thức.
3. **Tối ưu hóa:** AI có thể tự dự đoán và load trước các tài nguyên dựa trên hành vi người dùng.

### Cái bẫy của những tính năng "ngầu"
Khi mới tiếp cận Sentis, mình đã suýt nữa sa lầy vào việc thiết kế một hệ thống hội thoại cực kỳ phức tạp. Nhưng rồi mình chợt nhớ đến bài học về **Scope Creep**[cite: 1]. Mình đã từng mất 2 tuần để code một tính năng hoàn toàn không nằm trong design doc ban đầu chỉ vì thấy nó hay[cite: 1].

Kết quả là tính năng đó chẳng giúp ích gì cho trải nghiệm cốt lõi của người chơi cả[cite: 1]. Vì vậy, với Sentis, lời khuyên của mình là: **Chỉ làm những gì game thực sự cần**[cite: 1]. Nếu một NPC đơn giản là đủ, đừng cố nhét một bộ não AI vào chỉ để khoe công nghệ.

**Kế hoạch triển khai:**
- Viết Design Doc cho tính năng AI trước khi bắt đầu code[cite: 1].
- Luôn đặt câu hỏi: Game có thực sự *cần* cái này không, hay chỉ mình *muốn* làm?[cite: 1]