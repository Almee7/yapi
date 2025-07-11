const crypto = require('crypto');

function sha1(input) {
    return crypto.createHash('sha1').update(input).digest('hex');
}

function generatePassword(password, salt) {
    return sha1(password + sha1(salt));
}

// 测试数据
const password = 'qwer1234';
const salt = 'f9l1fe19jgk';

const encrypted = generatePassword(password, salt);
console.log(encrypted);
