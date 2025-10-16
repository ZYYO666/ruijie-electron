const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

// 引入main模块
const campusAuth = require('./src/main');

let mainWindow;
let tray;
let isQuitting = false;

let monitoringInterval = null;

let runtimeData = {
    isMonitoring: false,
    lastStatus: null,
    config: {
        username: '',
        password: '',
        serverUrl: '172.16.200.101',
        checkInterval: 10
    },
    logs: []
};

const configFilePath = path.join(os.homedir(), '.xiaoyuanwang-config.json');

// 管理员权限检查函数
const isAdmin = () => {
    return new Promise((resolve) => {
        if (process.platform === 'win32') {
            exec('openfiles', (err) => {
                if (err) {
                    resolve(false); // 不是管理员
                } else {
                    resolve(true); // 是管理员
                }
            });
        } else {
            resolve(false); // 非Windows系统暂不支持
        }
    });
};

function loadRuntimeConfig() {
    try {
        if (fs.existsSync(configFilePath)) {
            const savedConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
            runtimeData.config = { ...runtimeData.config, ...savedConfig };

            if (runtimeData.config.username && runtimeData.config.password) {
                return true;
            }
        }
    } catch (error) {
        console.warn('配置加载失败，使用默认配置:', error.message);
    }
    return false;
}

function saveRuntimeConfig() {
    try {
        fs.writeFileSync(configFilePath, JSON.stringify(runtimeData.config, null, 2), 'utf8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 设置开机自启
function setAutoStart(enable) {
    if (process.platform === 'win32') {
        return setWindowsAutoStart(enable);
    } else {
        return new Promise((resolve) => {
            app.setLoginItemSettings({
                openAtLogin: enable
            });
            resolve({ success: true });
        });
    }
}

function setWindowsAutoStart(enable) {
    const { exec } = require('child_process');
    const taskName = 'XiaoYuanWang_HighPriority';
    // 在开发模式下需要传递应用目录给 electron.exe
    const appExecutable = process.execPath;
    const appArg = (!app.isPackaged) ? ` \"${path.resolve(__dirname)}\"` : '';

    return new Promise((resolve) => {
        if (enable) {
            // 使用 onlogon 触发，确保在用户登录后启动，且具备最高权限
            const createTaskCommand = `schtasks /create /tn "${taskName}" /tr "\"${appExecutable}\"${appArg}" /sc onlogon /rl highest /f`;

            exec(createTaskCommand, { encoding: 'utf8' }, (error, stdout, stderr) => {
                if (error) {
                    console.error('创建任务计划程序任务失败:', error);
                    // 回退到普通权限的用户登录触发任务
                    const fallbackCommand = `schtasks /create /tn "${taskName}" /tr "\"${appExecutable}\"${appArg}" /sc onlogon /f`;
                    exec(fallbackCommand, { encoding: 'utf8' }, (fallbackError, fallbackStdout, fallbackStderr) => {
                        if (fallbackError) {
                            resolve({ success: false, error: `任务计划程序操作失败: ${fallbackError.message}` });
                        } else {
                            resolve({ success: true, warning: '已创建普通权限的开机自启任务' });
                        }
                    });
                } else {
                    resolve({ success: true });
                }
            });
        } else {
            // 删除任务计划程序任务
            const deleteTaskCommand = `schtasks /delete /tn "${taskName}" /f`;

            exec(deleteTaskCommand, { encoding: 'utf8' }, (error, stdout, stderr) => {
                if (error) {
                    // 如果任务不存在，也算成功
                    const errorMsg = error.message || '';
                    const stderrMsg = stderr || '';

                    if (errorMsg.includes('cannot find') ||
                        stderrMsg.includes('cannot find') ||
                        errorMsg.includes('系统找不到指定的文件') ||
                        stderrMsg.includes('系统找不到指定的文件') ||
                        error.code === 1) {
                        resolve({ success: true });
                    } else {
                        console.error('删除任务计划程序任务失败:', error);
                        resolve({ success: false, error: `任务计划程序操作失败: ${error.message}` });
                    }
                } else {
                    resolve({ success: true });
                }
            });
        }
    });
}

// 获取开机自启状态
function getAutoStartStatus() {
    try {
        if (process.platform === 'win32') {
            return getWindowsAutoStartStatus();
        } else {
            const settings = app.getLoginItemSettings();
            return { success: true, enabled: settings.openAtLogin };
        }
    } catch (error) {
        console.error('获取开机自启状态失败:', error);
        return { success: false, error: error.message };
    }
}

// Windows任务计划程序开机自启状态检查
function getWindowsAutoStartStatus() {
    const { exec } = require('child_process');
    const taskName = 'XiaoYuanWang_HighPriority';

    return new Promise((resolve) => {
        const queryCommand = `schtasks /query /tn "${taskName}" /fo csv`;

        exec(queryCommand, { encoding: 'utf8' }, (error, stdout, stderr) => {
            if (error) {
                // 检查是否是任务不存在的错误
                const errorMsg = error.message || '';
                const stderrMsg = stderr || '';

                if (errorMsg.includes('cannot find') ||
                    stderrMsg.includes('cannot find') ||
                    errorMsg.includes('系统找不到指定的文件') ||
                    stderrMsg.includes('系统找不到指定的文件') ||
                    error.code === 1) {
                    // 任务不存在，说明未设置开机自启
                    resolve({ success: true, enabled: false });
                } else {
                    console.error('查询任务计划程序开机自启状态失败:', error);
                    resolve({ success: false, error: `任务计划程序查询失败: ${error.message}` });
                }
            } else {
                // 任务存在就说明已启用，因为我们创建的任务默认就是启用状态
                // 不依赖状态文本，因为可能存在编码问题
                resolve({ success: true, enabled: true });
            }
        });
    });
}

// 添加日志到运行时数据
function addLog(message) {
    const now = new Date();
    const timestamp = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
    const logEntry = `${timestamp} ${message}`;
    runtimeData.logs.push(logEntry);

    if (runtimeData.logs.length > 1000) {
        runtimeData.logs = runtimeData.logs.slice(-1000);
    }

    console.log(logEntry);

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('log-message', logEntry);
    }
}



function createWindow() {
    const windowOptions = {
        width: 650,
        height: 500,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, 'public', 'assets', 'icon.png'),
        title: '校园网认证工具',
        show: false,
        frame: false
    };

    // 在 macOS 上完全隐藏标题栏
    if (process.platform === 'darwin') {
        windowOptions.titleBarStyle = 'customButtonsOnHover';
        windowOptions.titleBarOverlay = false;
        windowOptions.trafficLightPosition = { x: -100, y: -100 }; // 将红绿灯移到不可见位置
    }

    mainWindow = new BrowserWindow(windowOptions);

    mainWindow.loadFile('public/index.html');

    // 窗口准备好后不自动显示，只在用户主动打开时显示

    // 窗口关闭时隐藏到系统托盘
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createTray() {
    const iconPath = path.join(__dirname, 'public', 'assets', 'tray-icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath);

    // 调整托盘图标大小，适配系统托盘
    trayIcon.setTemplateImage(true); // 在 macOS 上使用模板图像
    const resizedIcon = trayIcon.resize({ width: 16, height: 16 }); // 设置为标准托盘图标大小

    tray = new Tray(resizedIcon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示窗口',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: runtimeData.isMonitoring ? '停止监控' : '开始监控',
            click: async () => {
                if (runtimeData.isMonitoring) {
                    handleStopMonitoring();
                } else {
                    await handleStartMonitoring();
                }
                // 更新托盘菜单
                updateTrayMenu();
            }
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip('校园网认证工具');

    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// 更新托盘菜单
function updateTrayMenu() {
    if (!tray) return;

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示窗口',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: runtimeData.isMonitoring ? '停止监控' : '开始监控',
            click: async () => {
                if (runtimeData.isMonitoring) {
                    handleStopMonitoring();
                } else {
                    await handleStartMonitoring();
                }
                // 递归更新托盘菜单
                updateTrayMenu();
            }
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
}

// 验证配置是否完整
function validateConfig(config) {
    const errors = [];

    if (!config.username || config.username.trim() === '') {
        errors.push('用户名不能为空');
    }

    if (!config.password || config.password.trim() === '') {
        errors.push('密码不能为空');
    }

    if (!config.serverUrl || config.serverUrl.trim() === '') {
        errors.push('服务器地址不能为空');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// 显示系统级确认对话框
async function showSystemDialog(title, message, type = 'error') {
    const options = {
        type: type,
        title: title,
        message: message,
        buttons: ['确定']
    };

    if (mainWindow && !mainWindow.isDestroyed()) {
        return await dialog.showMessageBox(mainWindow, options);
    } else {
        return await dialog.showMessageBox(options);
    }
}

// 处理开始监控
async function handleStartMonitoring() {
    try {
        if (runtimeData.isMonitoring) {
            return { success: false, message: '监控已在运行中' };
        }

        // 验证配置
        const validation = validateConfig(runtimeData.config);
        if (!validation.isValid) {
            const errorMessage = validation.errors.join('\n');
            addLog(`启动监控失败: ${errorMessage}`);

            // 显示系统级确认对话框
            await showSystemDialog('配置错误', `请先完善以下配置项：\n\n${errorMessage}`, 'warning');

            return { success: false, message: `配置错误: ${errorMessage}` };
        }

        addLog('开始监测网络状态...');

        runtimeData.isMonitoring = true;

        // 立即执行一次
        performSingleCheck();

        // 设置定时器，使用用户配置的检测间隔
        const intervalMs = (runtimeData.config.checkInterval || 10) * 1000;
        monitoringInterval = setInterval(() => {
            performSingleCheck();
        }, intervalMs);

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('monitoring-status-changed', {
                isMonitoring: runtimeData.isMonitoring,
                message: '监控已启动'
            });
        }

        // 更新托盘菜单状态
        updateTrayMenu();

        runtimeData.lastStatus = { success: true, message: '监控已启动' };
        return { success: true, message: '监控已启动' };
    } catch (error) {
        const errorResult = { success: false, message: `启动监控失败: ${error.message}` };
        runtimeData.lastStatus = errorResult;
        addLog(errorResult.message);
        return errorResult;
    }
}

// 处理停止监控
function handleStopMonitoring() {
    try {
        if (!runtimeData.isMonitoring) {
            return { success: false, message: '监控未在运行' };
        }

        if (monitoringInterval) {
            clearInterval(monitoringInterval);
            monitoringInterval = null;
        }

        runtimeData.isMonitoring = false;
        addLog('监控已停止');

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('monitoring-status-changed', {
                isMonitoring: runtimeData.isMonitoring,
                message: '监控已停止'
            });
        }

        // 更新托盘菜单状态
        updateTrayMenu();

        runtimeData.lastStatus = { success: true, message: '监控已停止' };
        return { success: true, message: '监控已停止' };
    } catch (error) {
        const errorResult = { success: false, message: `停止监控失败: ${error.message}` };
        runtimeData.lastStatus = errorResult;
        addLog(errorResult.message);
        return errorResult;
    }
}

// 执行单次检查
let isCheckInProgress = false;
async function performSingleCheck() {
    // 防止并发执行
    if (isCheckInProgress) {
        return;
    }

    isCheckInProgress = true;
    try {
        // 验证必要参数是否为空
        const { username, password, serverUrl } = runtimeData.config;

        // 检查关键参数是否为空
        if (!username || username.trim() === '') {
            const errorMsg = '用户名不能为空，请先配置用户名';
            addLog(errorMsg);
            runtimeData.lastStatus = { success: false, message: errorMsg };

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('monitoring-status-changed', {
                    isMonitoring: runtimeData.isMonitoring,
                    lastStatus: runtimeData.lastStatus
                });
            }
            return;
        }

        if (!password || password.trim() === '') {
            const errorMsg = '密码不能为空，请先配置密码';
            addLog(errorMsg);
            runtimeData.lastStatus = { success: false, message: errorMsg };

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('monitoring-status-changed', {
                    isMonitoring: runtimeData.isMonitoring,
                    lastStatus: runtimeData.lastStatus
                });
            }
            return;
        }

        if (!serverUrl || serverUrl.trim() === '') {
            const errorMsg = '服务器地址不能为空，请先配置服务器地址';
            addLog(errorMsg);
            runtimeData.lastStatus = { success: false, message: errorMsg };

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('monitoring-status-changed', {
                    isMonitoring: runtimeData.isMonitoring,
                    lastStatus: runtimeData.lastStatus
                });
            }
            return;
        }

        // 将配置参数传递给work函数
        const result = await campusAuth.work(runtimeData.config);
        runtimeData.lastStatus = result;

        if (result.success) {
            addLog(result.message);
        } else {
            addLog(`检查失败: ${result.message}`);
        }

        // 只发送状态变化，不重复发送消息
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('monitoring-status-changed', {
                isMonitoring: runtimeData.isMonitoring,
                message: null // 不重复发送消息，避免日志重复
            });
        }
    } catch (error) {
        const errorMessage = `检查过程中发生错误: ${error.message}`;
        addLog(errorMessage);
        runtimeData.lastStatus = { success: false, message: errorMessage };
    } finally {
        isCheckInProgress = false;
    }
}

// 确保应用单实例
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // 如果获取不到锁，说明已经有实例在运行
    // 在退出前显示通知提示用户
    app.whenReady().then(() => {

        if (Notification.isSupported()) {
            const notification = new Notification({
                title: '校园网认证工具',
                body: '程序已在运行中，请在系统托盘中查看',
                icon: path.join(__dirname, 'public', 'assets', 'icon.png')
            });

            notification.on('show', () => {
                // 通知显示后延迟退出，确保用户能看到
                setTimeout(() => {
                    app.quit();
                }, 100);
            });

            notification.on('failed', () => {
                app.quit();
            });

            notification.show();
        } else {
            app.quit();
        }
    });
} else {
    // 当第二个实例尝试启动时，第一个实例会收到这个事件
    app.on('second-instance', (event, commandLine, workingDirectory) => {

        // 可以选择显示主窗口或者什么都不做
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        // 加载配置
        const hasValidConfig = loadRuntimeConfig();

        // 创建主窗口
        createWindow();

        // 创建系统托盘
        createTray();

        // 显示应用启动通知
        if (Notification.isSupported()) {
            new Notification({
                title: '校园网认证工具',
                body: '应用已启动，可通过系统托盘进行控制',
                icon: path.join(__dirname, 'public', 'assets', 'icon.png')
            }).show();
        }

        // 如果有有效配置，则自动开始监控
        if (hasValidConfig) {
            await handleStartMonitoring();
        }
    });
}

app.on('window-all-closed', () => {
    // 在 macOS 上，保持应用运行
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
});

// IPC 处理程序
ipcMain.handle('start-monitoring', async () => {
    return await handleStartMonitoring();
});

ipcMain.handle('stop-monitoring', () => {
    return handleStopMonitoring();
});

ipcMain.handle('save-config', (event, config) => {
    try {
        // 验证检测间隔
        if (config.checkInterval !== undefined) {
            config.checkInterval = Math.max(5, Math.min(300, parseInt(config.checkInterval) || 10));
        }

        // 更新运行时数据
        runtimeData.config = { ...runtimeData.config, ...config };

        // 保存到文件
        const result = saveRuntimeConfig();
        if (result.success) {
            addLog('配置已保存');
        }
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-config', () => {
    try {
        return {
            success: true,
            config: runtimeData.config
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-runtime-data', () => {
    return {
        success: true,
        data: {
            isMonitoring: runtimeData.isMonitoring,
            lastStatus: runtimeData.lastStatus,
            config: runtimeData.config,
            logs: runtimeData.logs.slice(-100) // 返回最新100条日志
        }
    };
});

// 窗口控制IPC处理器
ipcMain.handle('minimize-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.minimize();
    }
});

ipcMain.handle('close-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide(); // 隐藏到系统托盘而不是完全关闭
    }
});

// 开机自启IPC处理器
ipcMain.handle('set-auto-start', async (event, enable) => {
    try {
        // 检查管理员权限
        const hasAdminRights = await isAdmin();

        if (!hasAdminRights) {
            // 显示权限不足提示
            const result = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: '权限不足',
                message: '设置开机自启需要管理员权限',
                detail: '请彻底退出应用程序后，右键点击应用图标选择"以管理员身份运行"。\n\n这是因为修改系统启动项需要管理员权限才能操作注册表。',
                buttons: ['确定'],
                defaultId: 0
            });

            addLog('设置开机自启失败: 权限不足，需要管理员权限');
            return { success: false, error: '权限不足，需要管理员权限' };
        }

        const result = await setAutoStart(enable);
        if (result.success) {
            addLog(`开机自启已${enable ? '开启' : '关闭'}`);
        } else {
            addLog(`设置开机自启失败: ${result.error}`);
        }
        return result;
    } catch (error) {
        console.error('设置开机自启失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-auto-start', async () => {
    return await getAutoStartStatus();
});