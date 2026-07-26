# Aura AI

Aura AI là gateway chạy cục bộ cho các ứng dụng AI coding agent. Kết nối
Codex, Claude Code, OpenCode, Factory Droid, Cursor, Kiro, Cline, Roo Code,
Continue và các client tương thích OpenAI với nhiều provider qua một dashboard.

![Kiến trúc Aura AI](assets/architecture.png)

## Aura AI làm được gì?

- Thêm OpenAI, Anthropic, Google, xAI, Kimi, OpenRouter, 9Router, Ollama Cloud,
  Azure, DeepSeek, GLM hoặc endpoint OpenAI-compatible tùy chỉnh.
- Tự khám phá model và hiển thị capability: Available, Partial hoặc Planned.
- Gán model cho Planning, Build, Review, Fast task và Fallback.
- Đưa một model, một profile nhiều model hoặc toàn bộ model đã kết nối sang
  Codex, OpenCode, Factory Droid và các coding agent khác.
- Tự cấu hình Codex khi phát hiện được file cấu hình; với client khác, Aura tạo
  endpoint, model id và hướng dẫn manual dạng copy-ready.
- Token Saver có các mức Off, Safe, Lite, Full và Ultra để giảm tool output và
  context dư thừa. Không sửa API key, code được bảo vệ hoặc câu trả lời model.
- Có quota, account pool, cooldown, fallback, route trace, usage và cảnh báo lỗi.

## Cài đặt nhanh

Yêu cầu Node.js 18 trở lên; Bun được package tự động tải kèm.

~~~
npm install -g @tungninh/aura-ai@preview
aura init
aura start
aura gui
~~~

Mở http://127.0.0.1:10100, sau đó:

1. Thêm provider hoặc custom endpoint.
2. Test kết nối và khám phá model.
3. Gán model cho role hoặc chọn routing profile.
4. Chọn coding agent để Aura tự cấu hình hoặc hướng dẫn từng bước.

~~~
aura status
aura doctor
aura sync
aura service install
aura stop
~~~

Lệnh chính là aura và aura-ai. Alias ocx và opencodex vẫn được giữ cho
migration và script cũ.

## Kết nối coding agent

| Client | Cách cấu hình | Model |
| --- | --- | --- |
| Codex App / CLI / SDK | Tự động khi phát hiện được | Toàn bộ catalog/profile |
| Claude Code CLI | Tự động launch integration | Catalog và alias |
| Claude Desktop | Guided 3P setup | Model và tool đã chọn |
| OpenCode | Tự động hoặc manual | Một, nhiều hoặc toàn bộ |
| Factory Droid | Tự động hoặc manual | Một, nhiều hoặc toàn bộ |
| Cursor, Kiro, Cline, Roo Code, Continue, Kilo, Antigravity | Guided manual | Endpoint, model và step-by-step |

Aura không tự sửa file của client không nhận diện được schema. Trước khi apply
cấu hình, Aura hiển thị preview và tạo backup khi cần.

## Routing và Token Saver

Các profile dựng sẵn:

- **Always Sol**: ưu tiên chất lượng cố định.
- **Saver**: ưu tiên model tiết kiệm cho việc thường ngày.
- **Balanced**: cân bằng role, capability và chi phí.
- **Quality**: chọn model mạnh nhất phù hợp.

Aura nhận diện optimizer bên dưới như 9Router RTK để tránh nén trùng. Token
Saver không vượt quota và không can thiệp xác thực provider.

## Hệ điều hành

| Nền tảng | Service |
| --- | --- |
| macOS arm64 / x64 | launchd |
| Linux x64 / arm64 | systemd user service |
| Windows x64 | Task Scheduler |

Windows không cần WSL.

## Mã nguồn và tài liệu

~~~
git clone https://github.com/cudin-etn/Aura-AI.git
cd Aura-AI
bun install --frozen-lockfile
bun run build:gui
~~~

Xem thêm [tài liệu Aura](docs/aura/) và [GitHub repository](https://github.com/cudin-etn/Aura-AI).

Aura AI là dự án độc lập, không liên kết hay được chứng thực bởi OpenAI,
Anthropic, Google, xAI, 9Router, OpenCode, Factory hoặc các provider/client
được nhắc đến.
