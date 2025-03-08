# 小红书自动上传工具

这是一个自动化工具，用于将视频上传到小红书创作者中心并自动填写标题和话题标签。该工具使用 Puppeteer 连接到 Brave 浏览器，模拟用户操作完成上传流程。

## 功能特点

- 自动连接到已打开的 Brave 浏览器
- 自动查找或打开小红书创作者中心
- 自动点击上传按钮并选择视频文件
- 等待视频上传完成
- 自动填写标题（使用当前日期）
- 支持自定义话题标签
- 支持添加自定义正文内容
- 自动点击发布按钮
- 完成发布后自动返回

## 系统要求

- macOS 系统
- Node.js 环境
- Brave 浏览器
- 已登录小红书账号的 Brave 浏览器

## 安装步骤

1. 确保已安装 Node.js 环境
2. 克隆或下载此仓库到本地
3. 在脚本目录下运行以下命令安装依赖：

```bash
npm install
```

主要依赖包括：
- puppeteer
- clipboardy

## 使用方法

### 方法一：使用 Shell 脚本（推荐）

1. 打开终端
2. 运行以下命令：

```bash
# 基本用法（使用默认话题标签）
bash run_js_xhs_upload.sh /path/to/your/video.mp4

# 自定义话题标签
bash run_js_xhs_upload.sh /path/to/your/video.mp4 "英语学习打卡,anki"

# 自定义话题标签和额外正文内容
bash run_js_xhs_upload.sh /path/to/your/video.mp4 "英语学习打卡,anki" "这是我的英语学习笔记"
```

### 方法二：直接运行 JavaScript 脚本

1. 打开终端
2. 运行以下命令：

```bash
# 基本用法（使用默认话题标签）
node auto_xhs_upload.js /path/to/your/video.mp4

# 自定义话题标签
node auto_xhs_upload.js /path/to/your/video.mp4 "英语学习打卡,anki"

# 自定义话题标签和额外正文内容
node auto_xhs_upload.js /path/to/your/video.mp4 "英语学习打卡,anki" "这是我的英语学习笔记"
```

## 浏览器调试模式

此脚本需要 Brave 浏览器开启调试端口才能运行。如果脚本无法连接到浏览器，请按照以下步骤手动启动带调试端口的 Brave 浏览器：

1. 关闭所有 Brave 浏览器窗口
2. 在终端运行以下命令：
```bash
/Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser --remote-debugging-port=9222
```
3. 等待 Brave 浏览器启动并登录小红书
4. 然后重新运行上传脚本

## 自定义话题标签

您可以通过命令行参数自定义话题标签，无需修改代码：

```bash
node auto_xhs_upload.js /path/to/your/video.mp4 "英语学习打卡,anki,学习笔记"
```

话题标签需要用逗号分隔，不要包含 `#` 号。如果不提供话题标签参数，脚本将使用默认的 `英语学习打卡` 和 `anki` 标签。

## 自定义正文内容

除了话题标签外，您还可以在命令行中添加额外的正文内容：

```bash
node auto_xhs_upload.js /path/to/your/video.mp4 "英语学习打卡,anki" "这里是额外的正文内容，将会添加在话题标签之后。"
```

额外内容将会添加在话题标签之后，可以是任何文本，包括表情符号、描述或其他信息。

## 将脚本添加为 Automator 应用程序

您可以将此脚本设置为 macOS 的 Automator 应用程序，以便通过图形界面轻松上传视频到小红书。以下是设置步骤：

1. 打开 Automator 应用程序。
2. 选择“新建文稿”，然后选择“应用程序”。
3. 在左侧的“库”中，选择“实用工具”，然后将“运行 Shell 脚本”拖到右侧的工作区。
4. 将以下 AppleScript 代码粘贴到“运行 Shell 脚本”操作中：

```
on run {input, parameters}
	-- 获取选中的文件
	set selectedFile to choose file with prompt "选择要上传到小红书的视频文件:"
	set filePath to POSIX path of selectedFile
	
	-- 脚本路径
	set scriptPath to "/Users/sam/projects/code123/auto_xhs/run_js_xhs_upload.sh"
	
	-- 可选：询问标签
	set theTags to text returned of (display dialog "输入标签(用逗号分隔):" default answer "英语学习打卡,anki")
	
	-- 可选：询问额外内容
	set theContent to text returned of (display dialog "输入额外内容:" default answer "")
	
	-- 执行脚本
	if theContent is "" then
		if theTags is "" then
			do shell script "\"" & scriptPath & "\" \"" & filePath & "\""
		else
			do shell script "\"" & scriptPath & "\" \"" & filePath & "\" \"" & theTags & "\""
		end if
	else
		do shell script "\"" & scriptPath & "\" \"" & filePath & "\" \"" & theTags & "\" \"" & theContent & "\""
	end if
	
	-- 显示通知
	display notification "小红书上传已开始" with title "小红书上传器"
	
	return input
end run
```

## 故障排除

1. **无法连接到浏览器**：确保 Brave 浏览器已经以调试模式启动，并且端口为 9222。
2. **上传按钮未找到**：脚本会尝试多种方式查找上传按钮，如果仍然失败，可能是小红书界面发生了变化。
3. **话题标签未正确添加**：确保网络连接良好，话题建议能够正常加载。
4. **发布按钮未找到**：同样，可能是小红书界面发生了变化，脚本会尝试多种方式查找发布按钮。

## 注意事项

- 此脚本仅用于个人学习和研究目的
- 请勿用于违反小红书服务条款的活动
- 过度频繁的自动化操作可能导致账号被限制
- 脚本可能因小红书界面更新而失效，需要定期维护

## 许可证

MIT 