#!/bin/bash

# 脚本目录
SCRIPT_DIR="$(pwd)"

# 显示说明
echo "===== 小红书自动上传脚本 ====="
echo "此脚本需要 Brave 浏览器开启调试端口才能运行"
echo "如果脚本无法连接到浏览器，请手动启动带调试端口的 Brave 浏览器:"
echo "1. 关闭所有 Brave 浏览器窗口"
echo "2. 在终端运行: /Applications/Brave\\ Browser.app/Contents/MacOS/Brave\\ Browser --remote-debugging-port=9222"
echo "3. 等待 Brave 浏览器启动并登录小红书"
echo "4. 然后重新运行此脚本"
echo "=============================="
echo ""

# 检查是否提供了文件路径参数
if [ "$#" -lt 1 ]; then
    echo "错误: 未提供视频文件路径"
    echo "使用方法: $0 <视频文件路径> [话题标签] [额外内容]"
    echo "例如: $0 video.mp4 \"英语学习打卡,anki\" \"这是我的英语学习笔记\""
    echo "注意: 话题标签用逗号分隔，不要包含#号"
    exit 1
fi

# 使用提供的文件路径
VIDEO_PATH="$1"
echo "使用视频文件: $VIDEO_PATH"

# 获取话题标签参数（如果提供）
TOPICS=""
if [ "$#" -ge 2 ]; then
    TOPICS="$2"
    echo "将使用自定义话题标签: $TOPICS"
fi

# 获取额外内容参数（如果提供）
ADDITIONAL_CONTENT=""
if [ "$#" -ge 3 ]; then
    ADDITIONAL_CONTENT="$3"
    echo "将添加额外内容: $ADDITIONAL_CONTENT"
fi

# 检查文件是否存在
if [ ! -f "$VIDEO_PATH" ]; then
    echo "错误: 找不到视频文件 $VIDEO_PATH"
    exit 1
fi

# 检查依赖是否已安装
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "首次运行，安装依赖..."
    cd "$SCRIPT_DIR" && npm install
fi

# 运行 JavaScript 脚本
echo "运行上传脚本..."
if [ -z "$TOPICS" ] && [ -z "$ADDITIONAL_CONTENT" ]; then
    # 只有视频路径
    cd "$SCRIPT_DIR" && node auto_xhs_upload.js "$VIDEO_PATH"
elif [ -z "$ADDITIONAL_CONTENT" ]; then
    # 有视频路径和话题标签
    cd "$SCRIPT_DIR" && node auto_xhs_upload.js "$VIDEO_PATH" "$TOPICS"
else
    # 有视频路径、话题标签和额外内容
    cd "$SCRIPT_DIR" && node auto_xhs_upload.js "$VIDEO_PATH" "$TOPICS" "$ADDITIONAL_CONTENT"
fi

echo "脚本执行完成" 