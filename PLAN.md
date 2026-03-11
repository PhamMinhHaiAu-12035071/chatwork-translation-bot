## Mục tiêu

Triển khai cơ chế **fail-fast thống nhất** cho cả `bun run dev` và `bun run dev:dataset`:

- Bất kỳ service/package nào fail quan trọng (startup, runtime hard-fail, abort/timeout) sẽ dừng ngay toàn bộ stack local.
- Log lỗi phải chi tiết để debug nhanh theo kiểu root-cause trace.
- Dừng sạch toàn bộ tiến trình do script khởi chạy (bao gồm `zrok`, `webhook-logger`, `translator`, `dataset-runner`, `cursor-proxy` nếu local).

## Tóm tắt quyết định đã khóa

- Áp dụng fail-fast cho cả 2 lệnh `dev` và `dev:dataset` (không tách biệt).
- Hard-stop khi: service container fail exit non-zero; timeout ACK của dataset, callback thất bại khó hồi phục, translator không thể gọi được API/abort, lỗi translation non-recoverable.
- Giữ lại artifacts (`output`, `input/failed`, `input/state`) khi dừng để replay/re-run đúng dòng lỗi.
- Mặc định bật chế độ fail-fast, nhưng có thể tắt bằng flag môi trường (đề xuất `DEV_DATASET_FAIL_FAST=1`, hoặc đổi thành biến tên trung tính như `DEV_FAIL_FAST=true` cho cả hai lệnh).
- Log fail gồm: stack trace + context metadata đã sanitize (dataset file/item/line, sourceMessageId, request/room ids, retry count, timeout config, env snapshot không có secret), kèm summary block có 3 lệnh gợi ý khắc phục.

## Thay đổi chính

1. Orchestrator shell (`scripts/dev.sh`, `scripts/dev-dataset.sh`)

- Dùng cơ chế wrapper theo dõi container lifecycle:
  - `docker compose ... up --abort-on-container-exit` hoặc equivalent.
  - `trap` bắt exit để gọi `down` và cleanup `cursor-proxy` local + `zrok` nếu đang chạy.
- Bổ sung log fail summary rõ ràng, đồng thời ghi thêm `dev-dataset-fail.log` có timestamp.
- Nếu cần giữ hành vi restart cũ cho các profile khác, thêm override:
  - tắt restart chỉ khi chạy dataset/dev mode fail-fast để tránh mask lỗi.

2. Webhook pipeline behavior (`packages/webhook-logger`)

- Sửa route forward để chặn fail nhanh:
  - bắt buộc `await` `fetch` tới translator.
  - trả `5xx` nếu translator không reachable hoặc không 2xx.
- Đảm bảo lỗi forward được phản chiếu ngay thay vì luôn trả `200`.

3. Dataset runner hard-stop (`packages/dataset-runner`)

- Bổ sung cấu hình fail-fast mode:
  - khi gặp `CHATWORK_API` retry exhaustion / `CALLBACK_TIMEOUT` / `ack.status = failed` (trong các trường hợp đã chọn hard-stop), raise lỗi ngoài để làm process exit non-zero.
- Giữ `markRecordFailed` để ghi chứng cứ, sau đó trigger stop toàn stack qua container exit.
- Khi `DEV_FAIL_FAST` tắt, giữ hành vi mềm như hiện tại (tiếp tục chạy và ghi failed item).

4. Translator fail-path hardening (`packages/translator`)

- Giữ/đảm bảo callback ACK failure có log chi tiết và trả về lỗi rõ ràng.
- Với origin automation: khi request không hoàn thành do lỗi API/abort, `translation_request_failed`/`translation_request_aborted` phải đủ metadata để stack trace nhanh.
- Nếu cần, add guard để không swallow lỗi mà gây “hủy im lặng” trong luồng dataset.

5. Logging/observability

- Chuẩn hóa error event thêm field: service, event, exitCode (nếu có), dataset context, retry/timeout config, request IDs.
- Khi fail-fast kích hoạt, in 1 “red-flag summary block” trước khi terminate với:
  - tên service, container, thời điểm, lý do, exit status, stack, command gợi ý tiếp theo.

## Kiểm thử

- Unit
  - `packages/webhook-logger`: test route trả `5xx` khi fetch translator fail/timeout.
  - `packages/dataset-runner`: test hard-stop path cho timeout ACK và chatwork send failure theo mode.
  - `packages/translator`: kiểm tra callback failed vẫn ghi đủ error metadata (đã có test gần mới, cần mở rộng nếu còn rỗng).
- Integration
  - Test script runner giả lập dừng service một node rồi xác nhận toàn stack `down` sạch.
  - Kiểm tra `dev` và `dev:dataset` đều dừng theo cùng một cơ chế.
- Lint/Type
  - `bun test && bun run typecheck && bun run lint`.

## Giả định/mặc định

- Mặc định fail-fast ON khi chạy local dev, có thể tắt bằng biến env.
- Không thay đổi semantic nghiệp vụ core translation.
- Không xoá artifacts khi fail; chỉ viết thêm cơ chế dừng + log.
- Không thêm dependency mới ngoài các module nội bộ hiện có.
