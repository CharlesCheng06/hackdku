# app.py
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import json
from PIL import Image
import io
import base64
from dotenv import load_dotenv
from zhipuai import ZhipuAI  # 导入智谱 AI SDK
from flask_cors import CORS
# 加载 .env 文件中的环境变量
load_dotenv()

# --- Zhipu AI 配置 ---
ZHIPUAI_API_KEY = os.getenv("ZHIPUAI_API_KEY")
if not ZHIPUAI_API_KEY:
    print("[严重错误] 未在 .env 文件或环境变量中找到 ZHIPUAI_API_KEY！")
    # 在实际应用中，这里可能需要退出或采取其他措施

# 初始化 ZhipuAI 客户端
# 注意：如果 ZhipuAI SDK 初始化方式不同，请参考其官方文档修改
try:
    client = ZhipuAI(api_key=ZHIPUAI_API_KEY)
    print("ZhipuAI Client 初始化成功。")
except Exception as e:
    print(f"[严重错误] ZhipuAI Client 初始化失败: {e}")
    client = None  # 标记为初始化失败

# 选择要使用的模型 (请根据智谱文档确认最新的多模态模型名称)
ZHIPU_MODEL_NAME = "glm-4v"  # 假设的模型名称，很好用！


# --- AI 分析函数 (使用 Zhipu AI) ---
def get_zhipuai_analysis(food_text, image_bytes):
    if not client:
        raise RuntimeError("ZhipuAI Client 未成功初始化。")

    print(f"[智谱 AI 分析] 收到文本: {food_text}")

    try:
        # 检查图片数据是否存在
        image_base64 = None
        if image_bytes:
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            print("[智谱 AI 分析] 图片已成功转换为 Base64 编码")
        else:
            print("[智谱 AI 分析] 未提供图片数据，仅基于文本进行分析")

        # 构造 Prompt
        prompt_messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"你是一位专注于健康饮食分析的助手。用户的描述是：“{food_text if food_text else '无'}”。"
                                "\n\n请分析并给出相关建议。"
                    }
                ]
            }
        ]

        if image_base64:
            prompt_messages[0]["content"].append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{image_base64}"
                }
            })

        # 调用 Zhipu AI API
        print(f"[智谱 AI 分析] 调用模型: {ZHIPU_MODEL_NAME}")
        response = client.chat.completions.create(
            model=ZHIPU_MODEL_NAME,
            messages=prompt_messages,
            max_tokens=400,
            temperature=0.5,
        )

        ai_content = response.choices[0].message.content.strip()
        print(f"[智谱 AI 分析] 收到原始响应: {ai_content}")

        # 尝试解析 JSON
        try:
            if ai_content.startswith("```json"):
                ai_content = ai_content[7:]
            if ai_content.endswith("```"):
                ai_content = ai_content[:-3]
            ai_content = ai_content.strip()
            analysis_result = json.loads(ai_content)  # JSON解析
            return analysis_result
        except json.JSONDecodeError:
            print("[警告] 智谱 AI 返回非 JSON 数据，将直接返回文本结果")
            return {
                "analysis_type": "text",
                "text_result": ai_content,
                "ai_source": "ZhipuAI"
            }

    except Exception as e:
        print(f"[错误] 调用智谱 AI API 时出错: {e}")
        raise RuntimeError(f"调用智谱 AI 分析时出错: {e}")

# --- Flask App 初始化 ---
app = Flask(__name__)
CORS(app)  # 允许跨域请求


# --- Flask API 路由 ---
@app.route('/analyze', methods=['POST'])
def analyze_food():
    food_text = request.form.get('food_text', '')  # 获取食物描述
    image_file = request.files.get('food_image')  # 获取上传图片

    if not food_text and not image_file:
        return jsonify({"error": "请提供食物描述或上传一张食物图片。"}), 400

    image_bytes = None
    if image_file:
        try:
            image_bytes = image_file.read()
        except Exception as e:
            return jsonify({"error": "图片处理失败，请重新上传。"}), 500

    try:
        # 处理仅输入文字或同时上传图片
        analysis_result = get_zhipuai_analysis(food_text, image_bytes)
        return jsonify(analysis_result)
    except RuntimeError as e:
        return jsonify({"error": f"AI 分析出错了: {e}"}), 500


    print(f"[请求处理] 收到 food_text: {food_text}")

    # 检查 ZhipuAI Client 是否成功初始化
    if not client:
        return jsonify({"error": "服务器配置错误：无法初始化 ZhipuAI 客户端。"}), 500

    try:
        # 调用 ZhipuAI 分析函数，根据传入内容选择性处理
        analysis_result = get_zhipuai_analysis(food_text, image_bytes)
        print(f"[请求处理] 成功返回分析结果")
        return jsonify(analysis_result)

    except RuntimeError as e:
        print(f"[错误] AI 分析时发生错误: {e}")
        return jsonify({"error": f"AI 分析出错了: {e}"}), 500
    except Exception as e:
        print(f"[错误] 服务器内部错误: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "哎呀，服务器小哥好像打了个盹... 请稍后再试！"}), 500


# --- 启动服务器 ---
if __name__ == "__main__":
    print("启动 Flask AI 饮食助手后端服务器 (使用 Zhipu AI)...")
    app.run(debug=True, host='0.0.0.0', port=5000)

