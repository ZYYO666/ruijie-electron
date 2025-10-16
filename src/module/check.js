const config = require('./config');
const { getRequest } = require('./network');
/**
 * 检测网络状态函数：检查当前是否在线
 * @returns {Promise<boolean>} - 返回是否在线状态
 * @throws {Error} - 网络检测失败时抛出错误
 */
async function checkNetworkStatus() {
    try {
        const checkUrl = `http://${config.serverUrl}/eportal/redirectortosuccess.jsp`;
        const response = await getRequest(checkUrl, {
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400; // 接受重定向状态码
            }
        });

        // 检查响应头中的Location字段
        const location = response.headers.location || response.headers.Location || '';

        // 如果location包含success.jsp，说明已认证
        return location.includes('success.jsp') ? true : false;
    } catch (error) {
        throw new Error(`网络状态检测失败: ${error.message}`);
    }
}
module.exports = {
    checkNetworkStatus
};