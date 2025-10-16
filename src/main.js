const { checkNetworkStatus } = require('./module/check');
const auth = require('./module/auth');
const getCampusAuthInfo = require('./module/campus');
const encrypt = require('./module/encrypt');
const config = require('./module/config');
/**
 * 工作函数，用于认证网络，仅仅负责单次认证过程，管理用户配置，管理定时执行都放到了electron
 * @param {Object} userConfig - 用户自定义配置，可选
 * @returns {Promise<Object>} - 包含认证结果的 Promise 对象
 */
async function work(userConfig = null) {
    try {
        if (userConfig) {
            config.setConfigFromParams(userConfig);
        }
        const isOnline = await checkNetworkStatus();
        if (isOnline) {
            return { success: true, message: '网络正常' };
        }
        const authInfo = await getCampusAuthInfo();
        const encryptedAuthData = encrypt.prepareEncryptedAuthData(authInfo);
        let success = await auth(encryptedAuthData);
        if (success) {
            return { success: true, message: '认证成功' };
        } else {
            return { success: false, message: '认证失败' };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
}
module.exports = {
    work
};