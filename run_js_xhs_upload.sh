#!/bin/bash

# 显示系统通知的函数
show_notification() {
    osascript -e "display notification \"$1\" with title \"小红书上传器\""
}

# 获取脚本所在的实际目录，而不是当前工作目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 创建日志目录（如果不存在）
mkdir -p "$SCRIPT_DIR/logs"
LOG_FILE="$SCRIPT_DIR/logs/upload_$(date +%Y%m%d_%H%M%S).log"
echo "脚本目录: $SCRIPT_DIR" >> "$LOG_FILE"

# 将所有输出重定向到日志文件
exec >> "$LOG_FILE" 2>&1

# 设置PATH环境变量，确保能找到node
# 添加常见的Node.js安装位置
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.nvm/versions/node/$(ls -t $HOME/.nvm/versions/node/ 2>/dev/null | head -1)/bin:$HOME/.nodenv/shims:$HOME/.nodenv/bin"

# 如果使用nvm，尝试加载nvm环境
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    echo "加载NVM环境..."
    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh"  # 加载nvm
fi

# 检查node是否可用
if ! command -v node &> /dev/null; then
    echo "错误: 找不到node命令。请确保Node.js已正确安装。" | tee /dev/tty
    show_notification "错误: 找不到node命令，请检查Node.js安装"
    exit 1
fi

# 输出node和npm版本，用于调试
echo "Node版本: $(node -v)"
echo "NPM版本: $(npm -v 2>/dev/null || echo '未找到npm')"

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

# 使用提供的文件路径，转换为绝对路径
if [[ "$1" = /* ]]; then
    # 如果是绝对路径，直接使用
    VIDEO_PATH="$1"
else
    # 如果是相对路径，转换为绝对路径
    VIDEO_PATH="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
fi
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

# 获取node的完整路径
NODE_PATH=$(which node)
echo "使用Node路径: $NODE_PATH"

# 检查auto_xhs_upload.js是否存在
if [ ! -f "$SCRIPT_DIR/auto_xhs_upload.js" ]; then
    echo "错误: 找不到上传脚本 $SCRIPT_DIR/auto_xhs_upload.js" | tee /dev/tty
    show_notification "错误: 找不到上传脚本文件"
    exit 1
fi

# 使用完整路径运行Node.js脚本
cd "$SCRIPT_DIR"
if [ -z "$TOPICS" ] && [ -z "$ADDITIONAL_CONTENT" ]; then
    # 只有视频路径
    echo "执行命令: $NODE_PATH \"$SCRIPT_DIR/auto_xhs_upload.js\" \"$VIDEO_PATH\""
    $NODE_PATH "$SCRIPT_DIR/auto_xhs_upload.js" "$VIDEO_PATH"
elif [ -z "$ADDITIONAL_CONTENT" ]; then
    # 有视频路径和话题标签
    echo "执行命令: $NODE_PATH \"$SCRIPT_DIR/auto_xhs_upload.js\" \"$VIDEO_PATH\" \"$TOPICS\""
    $NODE_PATH "$SCRIPT_DIR/auto_xhs_upload.js" "$VIDEO_PATH" "$TOPICS"
else
    # 有视频路径、话题标签和额外内容
    echo "执行命令: $NODE_PATH \"$SCRIPT_DIR/auto_xhs_upload.js\" \"$VIDEO_PATH\" \"$TOPICS\" \"$ADDITIONAL_CONTENT\""
    $NODE_PATH "$SCRIPT_DIR/auto_xhs_upload.js" "$VIDEO_PATH" "$TOPICS" "$ADDITIONAL_CONTENT"
fi

# 检查脚本执行结果
RESULT=$?
if [ $RESULT -eq 0 ]; then
    echo "脚本执行完成，状态码: $RESULT"
    show_notification "视频上传处理已完成！"
else
    echo "脚本执行失败，状态码: $RESULT" | tee /dev/tty
    show_notification "视频上传处理失败，请查看日志"
fi

echo "日志文件: $LOG_FILE" 