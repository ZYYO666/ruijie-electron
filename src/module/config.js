// 校园网认证系统配置文件
// 默认配置
let config = {
    // 用户账号密码配置（原文）
    userCredentials: {
        username: '', // 填写校园网账号
        password: ''  // 填写校园网密码（原文，将被加密）
    },
    // 服务器URL配置
    serverUrl: '',
    // API路径配置
    loginPath: '/eportal/InterFace.do?method=login',
    checkStatusPath: '/eportal/InterFace.do?method=getOnlineUserInfo',
    pageInfoPath: '/eportal/InterFace.do?method=pageInfo',
    // 网络检测配置
    networkTestUrl: 'http://www.baidu.com',
    networkTimeout: 10000 // 10秒超时
};

// 更新配置接口（仅内存操作）
function updateConfig(newConfig) {
    try {
        // 深度合并配置，避免引用问题
        if (newConfig.userCredentials) {
            config.userCredentials = { ...config.userCredentials, ...newConfig.userCredentials };
        }
        
        // 更新其他配置项
        Object.keys(newConfig).forEach(key => {
            if (key !== 'userCredentials') {
                config[key] = newConfig[key];
            }
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 获取当前配置
function getConfig() {
    return config;
}

// 通过参数更新配置
function setConfigFromParams(params) {
    if (params) {
        const newConfig = {};

        if (params.username || params.password) {
            newConfig.userCredentials = {
                username: params.username || config.userCredentials.username,
                password: params.password || config.userCredentials.password
            };
        }

        if (params.serverUrl) {
            newConfig.serverUrl = params.serverUrl;
        }

        return updateConfig(newConfig);
    }
    return { success: true };
}

// 导出配置和接口
module.exports = {
    // 配置管理接口
    getConfig,
    updateConfig,
    setConfigFromParams,
    
    // 动态获取配置属性
    get userCredentials() {
        return config.userCredentials;
    },
    get serverUrl() {
        return config.serverUrl;
    },
    get loginPath() {
        return config.loginPath;
    },
    get checkStatusPath() {
        return config.checkStatusPath;
    },
    get pageInfoPath() {
        return config.pageInfoPath;
    },
    get networkTestUrl() {
        return config.networkTestUrl;
    },
    get networkTimeout() {
        return config.networkTimeout;
    },
    get dataCheck() {
        return config.dataCheck;
    }
};