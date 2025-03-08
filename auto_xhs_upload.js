#!/usr/bin/env node

/**
 * 小红书自动上传脚本 - JavaScript 版本
 * 使用 Puppeteer 连接到已打开的 Brave 浏览器
 * 
 * 使用方法:
 * 1. 安装依赖: npm install puppeteer clipboardy
 * 2. 手动启动 Brave 浏览器并开启调试端口:
 *    a. 关闭所有 Brave 浏览器窗口
 *    b. 在终端运行: /Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser --remote-debugging-port=9222
 * 3. 运行脚本: node auto_xhs_upload.js [视频文件路径] [话题标签] [额外内容]
 */

const puppeteer = require('puppeteer');
const clipboardy = require('clipboardy');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const util = require('util');
const execPromise = util.promisify(exec);

// 小红书创作者中心 URL
const XHS_CREATOR_URL = 'https://creator.xiaohongshu.com/publish/publish?source=&published=true';

// 默认调试端口
const DEFAULT_DEBUG_PORT = 9222;

// 创建命令行交互界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 使用原生 osascript 命令执行 AppleScript
async function runAppleScript(script) {
  try {
    // 将脚本写入临时文件
    const tempScriptPath = path.join(__dirname, 'temp_script.scpt');
    fs.writeFileSync(tempScriptPath, script);
    
    // 执行脚本
    const { stdout, stderr } = await execPromise(`osascript ${tempScriptPath}`);
    
    // 删除临时文件
    fs.unlinkSync(tempScriptPath);
    
    if (stderr) {
      console.error('AppleScript 执行错误:', stderr);
      return null;
    }
    
    return stdout.trim();
  } catch (error) {
    console.error('执行 AppleScript 时出错:', error);
    return null;
  }
}

// 检查 Brave 浏览器是否正在运行
async function isBraveRunning() {
  const script = `
tell application "System Events"
  set isRunning to exists (processes where name is "Brave Browser")
  return isRunning
end tell
  `;
  
  const result = await runAppleScript(script);
  return result === 'true';
}

// 使用 AppleScript 激活 Brave 浏览器
async function activateBrave() {
  const script = `
tell application "Brave Browser"
  activate
end tell
  `;
  
  await runAppleScript(script);
  console.log('已激活 Brave 浏览器');
  return true;
}

// 使用 AppleScript 打开小红书创作者中心
async function openXhsCreatorWithAppleScript() {
  const script = `
tell application "Brave Browser"
  activate
  open location "${XHS_CREATOR_URL}"
end tell
  `;
  
  await runAppleScript(script);
  console.log('已使用 AppleScript 打开小红书创作者中心');
  return true;
}

// 使用 AppleScript 检查 Brave 浏览器中是否有小红书创作者中心标签页
async function hasXhsCreatorTab() {
  const script = `
tell application "Brave Browser"
  set foundTab to false
  set windowCount to count windows
  repeat with w from 1 to windowCount
    set tabCount to count tabs of window w
    repeat with t from 1 to tabCount
      set tabUrl to URL of tab t of window w
      if tabUrl contains "creator.xiaohongshu.com" then
        set foundTab to true
        exit repeat
      end if
    end repeat
    if foundTab then
      exit repeat
    end if
  end repeat
  return foundTab
end tell
  `;
  
  const result = await runAppleScript(script);
  return result === 'true';
}

// 使用 AppleScript 激活小红书创作者中心标签页
async function activateXhsCreatorTab() {
  const script = `
tell application "Brave Browser"
  set windowIndex to 0
  set tabIndex to 0
  set windowCount to count windows
  repeat with w from 1 to windowCount
    set tabCount to count tabs of window w
    repeat with t from 1 to tabCount
      set tabUrl to URL of tab t of window w
      if tabUrl contains "creator.xiaohongshu.com" then
        set windowIndex to w
        set tabIndex to t
        exit repeat
      end if
    end repeat
    if windowIndex > 0 then
      exit repeat
    end if
  end repeat
  
  if windowIndex > 0 and tabIndex > 0 then
    set index of window windowIndex to 1
    set active tab index of window windowIndex to tabIndex
    return true
  else
    return false
  end if
end tell
  `;
  
  const result = await runAppleScript(script);
  if (result === 'true') {
    console.log('已激活小红书创作者中心标签页');
    return true;
  } else {
    console.log('未找到小红书创作者中心标签页');
    return false;
  }
}

// 获取 Brave 浏览器的调试端口
async function getBraveDebugPort() {
  // 首先尝试使用 lsof 命令查找监听端口
  try {
    console.log('尝试使用 lsof 查找 Brave 浏览器调试端口...');
    const { stdout: lsofOutput } = await execPromise('lsof -i :9222 | grep Brave');
    if (lsofOutput.trim()) {
      console.log('通过 lsof 找到 Brave 浏览器正在使用端口 9222');
      return 9222;
    }
  } catch (error) {
    console.log('lsof 命令未找到 Brave 浏览器调试端口');
  }
  
  // 如果 lsof 失败，尝试使用 ps 命令
  return new Promise((resolve, reject) => {
    // 在 macOS 上查找 Brave 浏览器进程
    exec('ps -ax | grep -i "brave.*--remote-debugging-port" | grep -v grep', (error, stdout, stderr) => {
      if (error) {
        console.log('未找到已启动的 Brave 浏览器调试端口');
        resolve(null);
        return;
      }
      
      // 尝试从进程信息中提取调试端口
      const match = stdout.match(/--remote-debugging-port=(\d+)/);
      if (match && match[1]) {
        console.log(`找到 Brave 浏览器调试端口: ${match[1]}`);
        resolve(parseInt(match[1]));
      } else {
        console.log('未找到 Brave 浏览器调试端口');
        
        // 如果没有找到调试端口，但 Brave 浏览器正在运行，尝试使用默认端口
        exec('ps -ax | grep -i "brave" | grep -v grep', (err, stdoutBrave) => {
          if (!err && stdoutBrave.trim()) {
            console.log('Brave 浏览器正在运行，尝试使用默认端口 9222');
            resolve(9222);
          } else {
            resolve(null);
          }
        });
      }
    });
  });
}

// 检查端口是否可用
async function isPortAvailable(port) {
  try {
    const { stdout, stderr } = await execPromise(`lsof -i:${port}`);
    return stdout.trim() === '';
  } catch (error) {
    // 如果命令失败，通常意味着端口未被使用
    return true;
  }
}

// 启动 Brave 浏览器并设置调试端口
async function launchBrave() {
  console.log('启动 Brave 浏览器...');
  
  // 尝试使用 macOS 上的默认 Brave 路径
  const bravePath = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
  
  // 检查 Brave 是否存在
  if (!fs.existsSync(bravePath)) {
    console.error('未找到 Brave 浏览器，请确保已安装');
    return null;
  }
  
  // 检查默认调试端口是否可用
  const isPortFree = await isPortAvailable(DEFAULT_DEBUG_PORT);
  if (!isPortFree) {
    console.log(`端口 ${DEFAULT_DEBUG_PORT} 已被占用，检查是否是 Brave 浏览器...`);
    
    try {
      const { stdout } = await execPromise(`lsof -i :${DEFAULT_DEBUG_PORT} | grep Brave`);
      if (stdout.trim()) {
        console.log(`端口 ${DEFAULT_DEBUG_PORT} 已被 Brave 浏览器占用，尝试直接使用`);
        return DEFAULT_DEBUG_PORT;
      }
    } catch (error) {
      // 如果 lsof 命令失败或没有找到 Brave，继续尝试其他端口
    }
    
    // 尝试其他端口
    for (let port = 9223; port < 9300; port++) {
      const available = await isPortAvailable(port);
      if (available) {
        console.log(`使用端口 ${port} 启动 Brave 浏览器`);
        exec(`"${bravePath}" --remote-debugging-port=${port}`, (error) => {
          if (error) {
            console.error('启动 Brave 浏览器时出错:', error);
          }
        });
        
        // 等待浏览器启动
        console.log('等待浏览器启动...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        return port;
      }
    }
    
    console.error('无法找到可用的调试端口');
    return null;
  }
  
  // 使用默认端口启动 Brave 浏览器
  console.log(`使用默认端口 ${DEFAULT_DEBUG_PORT} 启动 Brave 浏览器`);
  
  // 使用 open 命令启动 Brave 浏览器，这在 macOS 上更可靠
  try {
    await execPromise(`open -a "Brave Browser" --args --remote-debugging-port=${DEFAULT_DEBUG_PORT}`);
    console.log('使用 open 命令启动 Brave 浏览器成功');
  } catch (error) {
    console.log('使用 open 命令启动失败，尝试直接启动');
    exec(`"${bravePath}" --remote-debugging-port=${DEFAULT_DEBUG_PORT}`, (error) => {
      if (error) {
        console.error('启动 Brave 浏览器时出错:', error);
      }
    });
  }
  
  // 等待浏览器启动
  console.log('等待浏览器启动...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  return DEFAULT_DEBUG_PORT;
}

// 显示如何手动启动带调试端口的 Brave 浏览器的说明
function showManualInstructions() {
  console.log('\n===== 手动启动带调试端口的 Brave 浏览器 =====');
  console.log('1. 关闭所有 Brave 浏览器窗口');
  console.log('2. 打开终端，运行以下命令:');
  console.log('   /Applications/Brave\\ Browser.app/Contents/MacOS/Brave\\ Browser --remote-debugging-port=9222');
  console.log('3. 等待 Brave 浏览器启动');
  console.log('4. 在浏览器中登录小红书');
  console.log('5. 重新运行此脚本');
  console.log('============================================\n');
}

// 查找小红书创作者中心标签页
async function findXhsCreatorTab(browser) {
  const pages = await browser.pages();
  console.log(`浏览器中共有 ${pages.length} 个标签页`);
  
  // 遍历所有标签页，查找小红书创作者中心
  for (const page of pages) {
    try {
      const url = page.url();
      console.log(`检查标签页: ${url}`);
      
      // 检查 URL 是否包含小红书创作者中心
      if (url.includes('creator.xiaohongshu.com')) {
        console.log('找到小红书创作者中心标签页');
        return page;
      }
    } catch (error) {
      console.log('检查标签页时出错:', error.message);
    }
  }
  
  console.log('未找到小红书创作者中心标签页，将创建新标签页');
  return null;
}

// 主函数
async function main() {
  // 获取文件路径
  const filePath = process.argv[2];
  
  // 获取话题标签参数（如果提供）
  const topicsParam = process.argv[3] || '';
  
  // 获取额外内容参数（如果提供）
  const additionalContent = process.argv[4] || '';
  
  // 检查是否提供了文件路径
  if (!filePath) {
    console.error('错误: 未提供文件路径');
    console.log('使用方法: node auto_xhs_upload.js <视频文件路径> [话题标签] [额外内容]');
    console.log('例如: node auto_xhs_upload.js video.mp4 "英语学习打卡,anki" "这是我的英语学习笔记"');
    console.log('注意: 话题标签用逗号分隔，不要包含#号');
    process.exit(1);
  }
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    console.error(`错误: 找不到文件 ${filePath}`);
    process.exit(1);
  }
  
  // 显示正在处理的文件
  console.log(`准备上传文件: ${filePath}`);
  
  // 处理话题标签
  let topics = ['英语学习打卡', 'anki']; // 默认话题
  if (topicsParam) {
    topics = topicsParam.split(',').map(topic => topic.trim());
    console.log(`将使用自定义话题标签: ${topics.join(', ')}`);
  } else {
    console.log(`将使用默认话题标签: ${topics.join(', ')}`);
  }
  
  if (additionalContent) {
    console.log(`将添加额外内容: ${additionalContent}`);
  }
  console.log('脚本将自动:');
  console.log('1. 检查并激活 Brave 浏览器');
  console.log('2. 查找或打开小红书创作者中心');
  console.log('3. 查找并点击上传按钮 (el-button upload-button)');
  console.log('4. 在文件选择对话框中粘贴文件路径');
  console.log('\n请耐心等待，整个过程可能需要10-15秒。');
  
  // 将文件路径复制到剪贴板
  clipboardy.writeSync(filePath);
  console.log('文件路径已复制到剪贴板');
  
  // 检查 Brave 浏览器是否正在运行
  const braveRunning = await isBraveRunning();
  if (!braveRunning) {
    console.log('Brave 浏览器未运行，尝试启动...');
    await launchBrave();
    // 等待浏览器启动
    await new Promise(resolve => setTimeout(resolve, 5000));
  } else {
    console.log('Brave 浏览器已在运行');
    // 激活 Brave 浏览器
    await activateBrave();
  }
  
  // 检查是否有小红书创作者中心标签页
  const hasXhsTab = await hasXhsCreatorTab();
  if (hasXhsTab) {
    console.log('找到小红书创作者中心标签页，尝试激活');
    await activateXhsCreatorTab();
  } else {
    console.log('未找到小红书创作者中心标签页，尝试打开');
    await openXhsCreatorWithAppleScript();
  }
  
  // 等待页面加载
  console.log('等待页面加载...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 尝试连接到已打开的 Brave 浏览器
  let browser;
  let debugPort = await getBraveDebugPort();
  
  if (!debugPort) {
    console.error('无法获取 Brave 浏览器调试端口，无法使用 Puppeteer 进行自动化');
    console.log('请尝试手动启动带调试端口的 Brave 浏览器');
    
    // 显示手动启动说明
    showManualInstructions();
    
    // 询问用户是否要尝试手动启动
    const tryManual = await askQuestion('是否要尝试手动启动带调试端口的 Brave 浏览器? (y/n): ');
    if (tryManual.toLowerCase() === 'y') {
      // 关闭所有 Brave 浏览器窗口
      console.log('尝试关闭所有 Brave 浏览器窗口...');
      await runAppleScript(`
tell application "Brave Browser"
  quit
end tell
      `);
      
      // 等待浏览器完全关闭
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 启动带调试端口的 Brave 浏览器
      const port = await launchBrave();
      if (port) {
        console.log(`成功启动带调试端口 ${port} 的 Brave 浏览器`);
        debugPort = port;
      } else {
        console.error('无法启动带调试端口的 Brave 浏览器');
        console.log('请按照上述说明手动启动，然后重新运行此脚本');
        rl.close();
        return;
      }
    } else {
      console.log('请按照上述说明手动启动，然后重新运行此脚本');
      rl.close();
      return;
    }
  }
  
  // 连接到已打开的 Brave 浏览器
  console.log(`连接到已打开的 Brave 浏览器 (端口: ${debugPort})...`);
  try {
    // 尝试使用 localhost 而不是 127.0.0.1
    browser = await puppeteer.connect({
      browserURL: `http://localhost:${debugPort}`,
      defaultViewport: null
    });
  } catch (error) {
    console.error('使用 localhost 连接失败，尝试使用 127.0.0.1...');
    try {
      browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${debugPort}`,
        defaultViewport: null
      });
    } catch (secondError) {
      console.error('连接到 Brave 浏览器失败:', error);
      console.log('请确保 Brave 浏览器已经启动并开启了调试端口');
      
      // 尝试直接使用 WebSocket URL
      try {
        console.log('尝试直接使用 WebSocket 连接...');
        const { stdout } = await execPromise(`curl -s http://localhost:${debugPort}/json/version`);
        const data = JSON.parse(stdout);
        const wsEndpoint = data.webSocketDebuggerUrl;
        
        if (wsEndpoint) {
          console.log(`找到 WebSocket 端点: ${wsEndpoint}`);
          browser = await puppeteer.connect({
            browserWSEndpoint: wsEndpoint,
            defaultViewport: null
          });
        } else {
          throw new Error('未找到 WebSocket 端点');
        }
      } catch (wsError) {
        console.error('WebSocket 连接失败:', wsError);
        showManualInstructions();
        rl.close();
        return;
      }
    }
  }
  
  try {
    // 查找已打开的小红书创作者中心标签页
    let page = await findXhsCreatorTab(browser);
    
    // 如果没有找到，则打开新标签页
    if (!page) {
      console.log('打开小红书创作者中心...');
      page = await browser.newPage();
    } else {
      console.log('使用已打开的标签页...');
    }
    
    // 直接导航到发布页面
    console.log('导航到小红书创作者中心发布页面...');
    await page.goto(XHS_CREATOR_URL, {
      waitUntil: 'networkidle2'
    });
    
    // 激活标签页
    await page.bringToFront();
    
    // 等待页面完全加载
    console.log('等待页面加载...');
    await page.waitForTimeout(2000);
    
    // 注入日志捕获代码
    await page.evaluate(() => {
      window.browserLogs = [];
      const originalConsoleLog = console.log;
      console.log = function() {
        const args = Array.from(arguments).map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        );
        window.browserLogs.push(args.join(' '));
        originalConsoleLog.apply(console, arguments);
      };
    });
    
    // 分析页面上的按钮
    console.log('分析页面上的按钮...');
    await page.evaluate(() => {
      console.clear();
      console.log('========== 自动上传操作 ==========');
      console.log('页面状态:', document.readyState);
      
      // 分析按钮
      const allButtons = document.querySelectorAll('button');
      console.log('页面上共有 ' + allButtons.length + ' 个按钮');
      
      allButtons.forEach((btn, i) => {
        console.log('按钮 ' + i + ':');
        console.log('- 类名: ' + btn.className);
        console.log('- 文本: ' + btn.textContent.trim());
      });
      
      // 特别查找 el-button upload-button
      const targetButtons = document.querySelectorAll('.el-button.upload-button');
      console.log('找到 ' + targetButtons.length + ' 个 el-button upload-button 元素');
      
      targetButtons.forEach((btn, i) => {
        console.log('目标按钮 ' + i + ':');
        console.log('- 类名: ' + btn.className);
        console.log('- 文本: ' + btn.textContent.trim());
      });
    });
    
    // 查找并点击上传按钮
    console.log('查找并点击上传按钮...');
    const clickResult = await page.evaluate(() => {
      // 查找上传按钮函数
      function findUploadButton() {
        console.log('查找上传按钮...');
        
        // 使用精确的选择器查找上传按钮
        const uploadButton = document.querySelector('.el-button.upload-button');
        if (uploadButton) {
          console.log('通过精确类名 .el-button.upload-button 找到按钮');
          return uploadButton;
        }
        
        console.log('未找到上传按钮');
        return null;
      }
      
      // 查找并点击上传按钮
      const uploadBtn = findUploadButton();
      if (uploadBtn) {
        console.log('找到上传按钮，点击它');
        try {
          uploadBtn.click();
          console.log('点击上传按钮成功');
          return '点击上传按钮成功';
        } catch (error) {
          console.error('点击按钮时出错:', error);
          return '点击上传按钮失败: ' + error.message;
        }
      } else {
        console.error('未找到上传按钮');
        return '未找到上传按钮';
      }
    });
    
    console.log('点击上传按钮结果:', clickResult);
    
    // 等待文件选择对话框出现
    console.log('等待文件选择对话框出现...');
    await page.waitForTimeout(1000);
    
    // 检查是否有文件输入元素
    const hasFileInput = await page.evaluate(() => {
      const fileInputs = document.querySelectorAll('input[type="file"]');
      return fileInputs.length > 0;
    });

    let fileUploaded = false;

    if (hasFileInput) {
      console.log('找到文件输入元素，尝试直接设置文件...');
      
      // 尝试直接设置文件
      try {
        // 查找所有文件输入元素
        const fileInputHandles = await page.$$('input[type="file"]');
        if (fileInputHandles.length > 0) {
          console.log(`找到 ${fileInputHandles.length} 个文件输入元素，尝试上传文件`);
          
          // 只尝试上传到第一个文件输入元素
          try {
            await fileInputHandles[0].uploadFile(filePath);
            console.log('文件上传成功');
            fileUploaded = true;
            
            // 等待上传完成
            console.log('等待文件上传完成...');
            try {
              await page.waitForFunction(
                () => {
                  const pageText = document.body.innerText;
                  return pageText.includes('上传成功') && 
                         (pageText.includes('视频时长') || pageText.includes('视频大小'));
                },
                { timeout: 300000 } // 5分钟超时
              );
              console.log('检测到上传已完成');
              
              // 从文件名中提取日期
              const fileName = path.basename(filePath);
              // 尝试从文件名中提取日期，格式可能是YYYY-MM-DD或YYYYMMDD
              let fileDate = '';
              
              // 尝试匹配YYYY-MM-DD格式
              const dateMatch1 = fileName.match(/(\d{4}-\d{2}-\d{2})/);
              if (dateMatch1) {
                fileDate = dateMatch1[1];
              } else {
                // 尝试匹配YYYYMMDD格式
                const dateMatch2 = fileName.match(/(\d{4})(\d{2})(\d{2})/);
                if (dateMatch2) {
                  fileDate = `${dateMatch2[1]}-${dateMatch2[2]}-${dateMatch2[3]}`;
                } else {
                  // 如果没有找到日期，使用当前日期
                  fileDate = new Date().toISOString().split('T')[0];
                  console.log('文件名中未找到日期，使用当前日期:', fileDate);
                }
              }
              
              console.log('使用日期:', fileDate);
              
              // 填写标题
              console.log('填写标题...');
              await page.evaluate((fileDate) => {
                // 查找标题输入框
                const titleInput = document.querySelector('input.d-text');
                if (titleInput) {
                  console.log('找到标题输入框');
                  titleInput.value = `${fileDate} #英语学习打卡`;
                  // 触发输入事件
                  titleInput.dispatchEvent(new Event('input', { bubbles: true }));
                  return '标题填写成功';
                } else {
                  console.error('未找到标题输入框');
                  return '未找到标题输入框';
                }
              }, fileDate);
              
              // 填写正文描述
              console.log('填写正文描述...');
              await page.evaluate(() => {
                // 查找正文编辑器
                const editor = document.querySelector('#quillEditor .ql-editor');
                if (editor) {
                  console.log('找到正文编辑器');
                  // 清空编辑器并聚焦
                  editor.innerHTML = '<p><br></p>';
                  editor.focus();
                  return '正文编辑器已聚焦';
                } else {
                  console.error('未找到正文编辑器');
                  return '未找到正文编辑器';
                }
              });
              
              // 模拟输入话题标签
              console.log('模拟输入话题标签...');
              
              // 循环添加每个话题
              for (let i = 0; i < topics.length; i++) {
                const topic = topics[i];
                console.log(`添加第 ${i+1} 个话题: #${topic}`);
                
                // 输入话题标签
                await page.type('#quillEditor .ql-editor', '#' + topic, {delay: 100});
                
                // 等待话题建议出现
                console.log(`等待 #${topic} 话题建议出现...`);
                try {
                  // 等待话题建议列表出现
                  await page.waitForSelector('#quill-mention-list', {
                    visible: true,
                    timeout: 5000
                  });
                  
                  // 等待一下确保列表完全加载
                  await page.waitForTimeout(1000);
                  
                  // 点击匹配的建议
                  console.log(`选择 #${topic} 话题建议...`);
                  
                  // 使用键盘导航和回车键选择话题，而不是直接点击
                  // 首先按下回车键选择当前高亮的选项
                  await page.keyboard.press('Enter');
                  
                  // 等待一下确保选择被处理
                  await page.waitForTimeout(500);
                  
                  // 检查是否成功添加了话题
                  const topicAdded = await page.evaluate(() => {
                    const editor = document.querySelector('#quillEditor .ql-editor');
                    const mentions = editor.querySelectorAll('.mention');
                    return {
                      count: mentions.length,
                      text: editor.textContent
                    };
                  });
                  
                  console.log(`当前编辑器内容: ${topicAdded.text}`);
                  console.log(`已添加 ${topicAdded.count} 个话题标签`);
                  
                  // 添加空格，为下一个话题做准备
                  await page.type('#quillEditor .ql-editor', ' ');
                  await page.waitForTimeout(500);
                  
                } catch (error) {
                  console.error(`添加话题 #${topic} 时出错:`, error);
                }
              }
              
              console.log('所有话题标签添加完成');
              
              // 添加额外内容（如果有）
              if (additionalContent) {
                console.log('添加额外内容...');
                await page.type('#quillEditor .ql-editor', ' ' + additionalContent, {delay: 50});
                console.log('额外内容添加完成');
              }
              
              // 如果所有话题都添加失败，尝试直接设置内容
              try {
                const contentCheck = await page.evaluate(() => {
                  const editor = document.querySelector('#quillEditor .ql-editor');
                  return editor ? editor.textContent.trim() : '';
                });
                
                if (!contentCheck) {
                  console.log('话题添加可能失败，尝试直接设置内容...');
                  await page.evaluate(() => {
                    const editor = document.querySelector('#quillEditor .ql-editor');
                    if (editor) {
                      editor.innerHTML = '<p>#英语学习打卡 #anki</p>';
                      editor.dispatchEvent(new Event('input', { bubbles: true }));
                      return '直接设置内容完成';
                    }
                    return '无法设置内容';
                  });
                }
              } catch (error) {
                console.error('检查或设置内容时出错:', error);
              }
              
              console.log('标题和正文填写完成');
              
              // 查找并点击发布按钮
              console.log('查找发布按钮...');
              try {
                // 等待一下确保页面状态稳定
                await page.waitForTimeout(2000);
                
                // 查找发布按钮
                const publishButtonClicked = await page.evaluate(() => {
                  // 尝试多种选择器查找发布按钮
                  const selectors = [
                    // 根据您提供的HTML结构
                    'button.d-button.publishBtn',
                    'button.d-button.red.publishBtn',
                    'button.d-button.custom-button.red.publishBtn',
                    // 更通用的选择器
                    'button.publishBtn',
                    'button[data-impression]',
                    // 根据文本内容
                    'button span.d-text:contains("发布")',
                    // 最后尝试任何包含"发布"文本的按钮
                    'button:contains("发布")'
                  ];
                  
                  // 尝试每个选择器
                  for (const selector of selectors) {
                    try {
                      const buttons = document.querySelectorAll(selector);
                      if (buttons.length > 0) {
                        // 找到按钮，记录信息并点击
                        const button = buttons[0];
                        console.log(`找到发布按钮: ${selector}`);
                        console.log('按钮文本:', button.textContent.trim());
                        button.click();
                        return `点击发布按钮成功: ${selector}`;
                      }
                    } catch (e) {
                      console.error(`选择器 ${selector} 出错:`, e);
                    }
                  }
                  
                  // 如果上面的选择器都失败了，尝试查找任何包含"发布"文本的按钮
                  const allButtons = Array.from(document.querySelectorAll('button'));
                  const publishButton = allButtons.find(btn => 
                    btn.textContent.includes('发布') || 
                    (btn.querySelector('span') && btn.querySelector('span').textContent.includes('发布'))
                  );
                  
                  if (publishButton) {
                    console.log('通过文本内容找到发布按钮');
                    publishButton.click();
                    return '点击发布按钮成功: 通过文本内容';
                  }
                  
                  return '未找到发布按钮';
                });
                
                console.log('发布按钮点击结果:', publishButtonClicked);
                
                // 等待发布完成
                console.log('等待发布完成...');
                await page.waitForTimeout(2000);
                
                console.log('发布操作已完成');
                
                // 查找并点击"立即返回"按钮
                console.log('查找立即返回按钮...');
                try {
                  // 等待立即返回按钮出现
                  await page.waitForTimeout(1000);
                  
                  const returnButtonClicked = await page.evaluate(() => {
                    // 使用btn类和"立即返回"文本内容查找按钮
                    const buttons = document.querySelectorAll('.btn');
                    
                    for (const button of buttons) {
                      if (button.textContent.includes('立即返回')) {
                        console.log('找到立即返回按钮');
                        button.click();
                        return '点击立即返回按钮成功';
                      }
                    }
                    
                    return '未找到立即返回按钮，可能已自动返回或界面已更新';
                  });
                  
                  console.log('立即返回按钮点击结果:', returnButtonClicked);
                  
                  // 等待返回操作完成
                  await page.waitForTimeout(1000);
                  
                  console.log('上传和发布流程全部完成');
                } catch (error) {
                  console.error('点击立即返回按钮时出错:', error);
                  console.log('继续执行，上传和发布可能已经成功');
                }
              } catch (error) {
                console.error('点击发布按钮时出错:', error);
              }
            } catch (error) {
              console.error('等待上传完成或填写内容时出错:', error);
            }
            
            // 等待上传处理
            console.log('等待上传处理...');
            await page.waitForTimeout(2000);
            
            // 尝试关闭可能的对话框
            console.log('尝试关闭可能的对话框...');
            await page.evaluate(() => {
              // 查找可能的关闭按钮
              const closeButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
                const text = btn.textContent.trim().toLowerCase();
                return text.includes('关闭') || 
                       text.includes('取消') || 
                       text.includes('完成') || 
                       text.includes('close') || 
                       text.includes('cancel') || 
                       text.includes('done');
              });
              
              console.log(`找到 ${closeButtons.length} 个可能的关闭按钮`);
              
              // 尝试点击关闭按钮
              if (closeButtons.length > 0) {
                console.log('尝试点击关闭按钮');
                closeButtons[0].click();
                return '点击关闭按钮成功';
              }
              
              // 查找带有关闭图标的元素
              const closeIcons = document.querySelectorAll('.el-icon-close, .close-icon, [class*="close"]');
              if (closeIcons.length > 0) {
                console.log('尝试点击关闭图标');
                closeIcons[0].click();
                return '点击关闭图标成功';
              }
              
              return '未找到关闭按钮或图标';
            });
          } catch (uploadError) {
            console.error('上传文件失败:', uploadError);
          }
        }
      } catch (error) {
        console.error('设置文件时出错:', error);
      }
    }
    
    // 如果自动上传失败，提示用户手动操作
    if (!fileUploaded) {
      console.log('\n自动上传文件失败，请手动操作:');
      console.log('1. 如果文件选择对话框已打开:');
      console.log('   a. 按 Command+Shift+G 打开"前往文件夹"对话框');
      console.log('   b. 按 Command+V 粘贴文件路径（已自动复制）');
      console.log('   c. 按回车键确认路径');
      console.log('   d. 再次按回车键确认选择文件');
      console.log('2. 如果文件选择对话框未打开:');
      console.log('   a. 点击页面上的上传按钮');
      console.log('   b. 然后按照上述步骤操作\n');
      
      // 等待用户确认已完成文件选择
      await askQuestion('完成文件选择后按回车键继续...');
    }
    
    // 等待上传完成
    console.log('等待上传完成...');
    await page.waitForTimeout(2000);
    
    // 检查上传状态
    const uploadStatus = await page.evaluate(() => {
      // 检查是否有上传进度条或成功提示
      const progressBar = document.querySelector('[class*="progress"]');
      const successMsg = document.querySelector('[class*="success"]');
      
      if (progressBar) {
        return '上传中...';
      } else if (successMsg) {
        return '上传成功';
      } else {
        // 尝试查找其他可能的状态指示器
        const uploadedFile = document.querySelector('[class*="file"][class*="name"], [class*="uploaded"]');
        if (uploadedFile) {
          return '文件已上传: ' + uploadedFile.textContent.trim();
        }
        return '上传完成';
      }
    });
    
    console.log('上传状态:', uploadStatus);
    console.log('上传操作已完成');
    
    // 不关闭页面，保持浏览器状态
    console.log('保持页面打开状态');
    
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    // 断开与浏览器的连接，但不关闭浏览器
    if (browser) {
      await browser.disconnect();
      console.log('已断开与浏览器的连接，浏览器保持打开状态');
    }
  }
  
  rl.close();
}

// 辅助函数：询问问题
function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// 运行主函数
main().catch(console.error); 