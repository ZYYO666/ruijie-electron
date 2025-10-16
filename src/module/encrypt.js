// 模拟浏览器环境
if (typeof window === 'undefined') {
    global.window = global;
}
// 引入原网页的RSA实现
require('./rsa.js');
const config = require('./config');
// 加密密码的函数
function encryptedPassword(password, publicKeyExponent, publicKeyModulus) {
    // 字符串反转
    var passwordEncode = password.split("").reverse().join("");
    // 设置最大位数
    RSAUtils.setMaxDigits(130);
    // 创建密钥对
    var key = RSAUtils.getKeyPair(publicKeyExponent, "", publicKeyModulus);
    // 加密
    var result = RSAUtils.encryptedString(key, passwordEncode);
    // 去除空格
    var cleanResult = result.replace(/\s/g, '');
    return cleanResult;
}
// 处理加密认证数据的函数
function prepareEncryptedAuthData(authInfo) {
    // 动态获取用户凭据
    const userCredentials = config.userCredentials;

    let macString = "111111111";
    if (authInfo.encodedQueryString) {
        const decodedQueryString = decodeURIComponent(authInfo.encodedQueryString);
        const macMatch = decodedQueryString.match(/[?&]mac=([^&]*)/);
        if (macMatch && macMatch[1]) {
            macString = macMatch[1];
        }
    }
    const passwordMac = userCredentials.password + ">" + macString;
    const encryptedPass = encryptedPassword(
        passwordMac,
        authInfo.encryptionParams.publicKeyExponent,
        authInfo.encryptionParams.publicKeyModulus
    );
    return {
        username: userCredentials.username,
        encryptedPassword: encryptedPass,
        encodedQueryString: authInfo.encodedQueryString
    };
}
module.exports = {
    encryptedPassword,
    prepareEncryptedAuthData
};