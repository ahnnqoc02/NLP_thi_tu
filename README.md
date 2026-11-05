# Thi Tứ — chạy giao diện hiện tại bằng Python Flask

## 1. Cấu trúc

- `app.py`: máy chủ Python và API `/api/generate`.
- `templates/index.html`: giữ giao diện HTML hiện tại, chỉ đổi đường dẫn CSS/JS để Flask phục vụ.
- `static/css/nolope.css`: giữ nguyên CSS.
- `static/js/nololpe.js`: giữ nguyên xử lý giao diện, chuyển gọi sinh thơ sang API Python (`USE_MOCK = false`).

## 2. Cài đặt và chạy trên Windows

Mở Terminal/PowerShell tại thư mục `thitu_python`:

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Mở trình duyệt tại: http://127.0.0.1:5000

## 3. Lưu ý về mô hình AI


```json
{"title": "Tên bài thơ", "lines": ["Câu lục...", "Câu bát..."]}
```

Không cần thay đổi giao diện HTML/CSS để tích hợp mô hình.
