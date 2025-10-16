const axios = require('axios');
const config = require('./config');
const { unicodeEscape } = require('./utils');
/**
 * 发送POST请求的通用函数 (使用axios)
 * @param {string} host - 请求的主机名
 * @param {string} path - 请求的路径
 * @param {Object} data - 请求体数据对象
 * @returns {Promise<string>} - 解析为响应字符串的Promise
 */
async function postRequest(host, path, data) {
    try {
        const url = `http://${host}${path}`;
        const response = await axios.post(url, new URLSearchParams(data).toString(), {
            timeout: config.networkTimeout,
            responseType: 'text'
        });
        // 模拟原有的unicode转义处理
        const processedData = unicodeEscape(response.data);
        return processedData;
    } catch (error) {
        throw new Error(`请求失败: ${error.message}`);
    }
}
/**
 * 发送GET请求的通用函数 (使用axios)
 * @param {string} url - 请求的完整URL
 * @param {Object} options - 请求选项
 * @returns {Promise<Object>} - 解析为响应对象的Promise
 */
async function getRequest(url, options = {}) {
    try {
        const response = await axios.get(url, {
            timeout: config.networkTimeout,
            ...options
        });
        return response;
    } catch (error) {
        throw error;
    }
}
module.exports = {
    postRequest,
    getRequest
};