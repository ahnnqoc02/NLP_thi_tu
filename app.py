from __future__ import annotations

import os
import random
from datetime import datetime
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
app.config["JSON_AS_ASCII"] = False

# Chế độ demo giúp website chạy được ngay khi chưa có checkpoint mô hình.
# Khi tích hợp mô hình đã huấn luyện, thay hàm generate_with_model() bên dưới.
DEMO_LINES = [
    "Chiều quê nắng đậu bên thềm,",
    "Gió đưa hương lúa êm đềm qua sân.",
    "Mây trôi chầm chậm ngoài ngần,",
    "Tiếng chim gọi nắng trong ngần trời xanh.",
    "Lòng nghe thương nhớ mong manh,",
    "Tình quê còn mãi ngọt lành trong tim.",
    "Con đường in bóng im lìm,",
    "Bước chân nhắc chuyện đi tìm ngày xưa.",
    "Hàng cau đứng đợi nắng mưa,",
    "Mái nhà giữ trọn lời xưa mẹ hiền.",
]


def generate_with_model(topic: str, emotion: str, pairs: int, quality: str) -> dict:
    """Điểm tích hợp mô hình AI.

    Hiện chưa có đường dẫn checkpoint/tokenizer trong các tệp được gửi,
    vì vậy hàm đang dùng dữ liệu demo để kiểm tra luồng giao diện.
    Thay phần thân hàm bằng lệnh inference của mô hình Lục Bát đã huấn luyện.
    Kết quả bắt buộc có dạng {"title": str, "lines": list[str]}.
    """
    lines = DEMO_LINES[: pairs * 2]
    return {"title": topic, "lines": lines}


@app.get("/")
def home():
    return render_template("index.html")


@app.post("/api/generate")
def generate():
    data = request.get_json(silent=True) or {}
    topic = str(data.get("topic", "")).strip()
    emotion = str(data.get("emotion", "nhẹ nhàng, man mác")).strip()
    quality = str(data.get("quality", "Cân bằng")).strip()

    try:
        pairs = int(data.get("pairs", 3))
    except (TypeError, ValueError):
        pairs = 3

    if not topic:
        return jsonify({"error": "Vui lòng nhập chủ đề."}), 400
    if not 2 <= pairs <= 5:
        return jsonify({"error": "Số cặp thơ phải từ 2 đến 5."}), 400

    try:
        result = generate_with_model(topic, emotion, pairs, quality)
        lines = result.get("lines", [])
        if not isinstance(lines, list) or not lines:
            raise ValueError("Mô hình không trả về câu thơ hợp lệ.")
        return jsonify({
            "title": str(result.get("title") or topic),
            "lines": [str(line).strip() for line in lines if str(line).strip()],
            "mode": "demo",
        })
    except Exception as exc:
        app.logger.exception("Poem generation failed")
        return jsonify({"error": str(exc)}), 500


@app.get("/health")
def health():
    return jsonify({"status": "ok", "time": datetime.now().isoformat(timespec="seconds")})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=True)
