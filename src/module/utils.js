/**
 * 模拟Python中 decode("unicode_escape") 的部分效果
 * 注意：这是一个简化处理，Node.js与Python的字符编解码存在差异，此函数旨在处理常见情况。
 * @param {string} str 
 * @returns {string}
 */
function unicodeEscape(str) {
    return str.replace(/\\u([\d\w]{4})/gi, function (match, grp) {
        return String.fromCharCode(parseInt(grp, 16));
    });
}
/**
 * 解析校园网重定向响应中的认证链接
 * @param {string} responseContent - 响应内容
 * @returns {string|null} - 解析出的重定向链接
 */
function parseRedirectUrl(responseContent) {
    try {
        // 匹配 top.self.location.href='...' 或类似的重定向脚本
        const redirectMatch = responseContent.match(/top\.self\.location\.href\s*=\s*['"]([^'"]+)['"]/); 
        if (redirectMatch && redirectMatch[1]) {
            return redirectMatch[1];
        }
        // 匹配其他可能的重定向模式
        const locationMatch = responseContent.match(/location\.href\s*=\s*['"]([^'"]+)['"]/); 
        if (locationMatch && locationMatch[1]) {
            return locationMatch[1];
        }
        // 匹配window.location重定向
        const windowLocationMatch = responseContent.match(/window\.location\s*=\s*['"]([^'"]+)['"]/); 
        if (windowLocationMatch && windowLocationMatch[1]) {
            return windowLocationMatch[1];
        }
        return null;
    } catch (error) {
        return null;
    }
}
module.exports = {
    unicodeEscape,
    parseRedirectUrl
};