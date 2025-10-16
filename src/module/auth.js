const config = require('./config');
const { postRequest } = require('./network');
/**
 * 校园网认证函数
 * @param {Object} encryptedAuthData - 包含加密后的认证数据
 * @param {string} encryptedAuthData.username - 用户名
 * @param {string} encryptedAuthData.encryptedPassword - 加密后的密码
 * @param {Object} encryptedAuthData.authInfo - 认证信息对象
 * @returns {Promise<boolean>} - 返回认证是否成功
 * @throws {Error} - 认证失败时抛出错误
 */
async function auth(encryptedAuthData) {
    try {
        if (!encryptedAuthData) {
            throw new Error('认证数据不能为空');
        }
        // 构建登录数据
        const dataLogin = {
            'userId': encryptedAuthData.username, // 用户名
            'password': encryptedAuthData.encryptedPassword, // 加密后的密码
            'service': '', // 选择网络接入方式，在post请求中有
            'queryString': encryptedAuthData.encodedQueryString || '', // 直接从encryptedAuthData获取
            'operatorPwd': '', // 不用填
            'operatorUserId': '', // 不用填
            'validcode': '', // 不用填
            'passwordEncrypt': 'true', // 密码已加密
            'userIndex': '' // 填写post请求中的对应字段
        };
        const loginContent = await postRequest(config.serverUrl, config.loginPath, dataLogin);

        const resultIndexLogin = loginContent.indexOf('"result":"');
        if (resultIndexLogin === -1) {
            throw new Error('认证响应格式异常');
        }
        const loginResult = loginContent.substring(resultIndexLogin + 10, resultIndexLogin + 17);
        return loginResult === 'success';
    } catch (error) {
        if (error.message === '认证数据不能为空' || error.message === '认证响应格式异常') {
            throw error;
        }
        throw new Error(`校园网认证失败: ${error.message}`);
    }
}
module.exports = auth;