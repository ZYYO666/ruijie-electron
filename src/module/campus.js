const config = require('./config');
const { postRequest, getRequest } = require('./network');
const { parseRedirectUrl } = require('./utils');
/**
 * 获取校园网认证页面信息
 * @returns {Promise<Object>} - 返回认证信息对象
 * @throws {Error} - 获取认证信息失败时抛出错误
 */
async function getCampusAuthInfo() {
    try {
        // 访问百度来检测是否被重定向到认证页面
        const response = await getRequest(config.networkTestUrl, {
            maxRedirects: 0,
            validateStatus: function (status) {
                return true;
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const content = response.data.toString();
        // 解析重定向链接


        const redirectUrl = parseRedirectUrl(content);
        if (!redirectUrl) {
            throw new Error('未检测到校园网认证页面重定向');
        }
        // 提取并编码queryString
        const url = new URL(redirectUrl);
        const queryString = url.search.substring(1);
        const encodedQueryString = encodeURIComponent(queryString);
        // 访问pageInfo接口获取JSON信息
        const pageInfoResponse = await postRequest(config.serverUrl, config.pageInfoPath, {
            queryString: encodedQueryString
        });
        const pageInfoData = JSON.parse(pageInfoResponse);
        return {
            pageInfo: pageInfoData,
            encodedQueryString: encodedQueryString,
            // 加密所需的参数信息
            encryptionParams: {
                publicKeyExponent: pageInfoData.publicKeyExponent || '',
                publicKeyModulus: pageInfoData.publicKeyModulus || ''
            }
        };
    } catch (error) {
        if (error.message === '未检测到校园网认证页面重定向') {
            throw error;
        }
        throw new Error(`获取校园网认证信息失败: ${error.message}`);
    }
}
module.exports = getCampusAuthInfo;