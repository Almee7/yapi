const {filter} = require("./power-string");
const Mock = require("mockjs");

function simpleJsonPathParse(key, json) {
    if (!key || typeof key !== 'string' || key.indexOf('$.') !== 0 || key.length <= 2) {
        return null;
    }
    let keys = key.substr(2).split('.');
    keys = keys.filter(item => {
        return item;
    });
    for (let i = 0, l = keys.length; i < l; i++) {
        try {
            let m = keys[i].match(/(.*?)\[([0-9]+)\]/);
            if (m) {
                json = json[m[1]][m[2]];
            } else {
                json = json[keys[i]];
            }
        } catch (e) {
            json = '';
            break;
        }
    }
    return json;
}

function handleGlobalWord(word, json) {
    if (!word || typeof word !== 'string' || word.indexOf('global.') !== 0) return word;
    let keys = word.split('.');
    keys = keys.filter(item => {
        return item;
    });
    return json[keys[0]][keys[1]] || word;
}

function handleMockWord(word) {
    if (!word || typeof word !== 'string' || word[0] !== '@') return word;
    return Mock.mock(word);
}

function handleValueWithFilter(context) {
    return function(match) {
        if (match[0] === '@') {
            return handleMockWord(match);
        } else if (match.indexOf('$.') === 0) {
            return simpleJsonPathParse(match, context);
        } else if (match.indexOf('global.') === 0) {
            return handleGlobalWord(match, context);
        } else {
            return match;
        }
    };
}

function handleParamsValue(val, context = {}) {
    const variableRegexp = /\{\{\s*([^}]+?)\s*\}\}/g;

    if (!val || typeof val !== 'string') return val;

    val = val.trim();

    // 如果整个值是 @mock 或 $.jsonPath
    if (val[0] === '@' || val.indexOf('$.') === 0 || val.indexOf('global.') === 0) {
        return handleFilter(val, val, context);
    }

    // 如果整个值完全被 {{}} 包裹
    const fullMatch = val.match(/^\{\{\s*([^\}]+?)\s*\}\}$/);
    if (fullMatch) {
        return handleFilter(val, fullMatch[1], context);
    }

    // 部分替换 {{xxx}} 的情况
    return val.replace(variableRegexp, (raw, match) => {
        const result = handleFilter(raw, match, context);
        // 确保返回字符串
        return result !== undefined && result !== null ? String(result) : '';
    });
}

// handleFilter 保证返回字符串
function handleFilter(str, match, context) {
    match = match.trim();
    try {
        const a = filter(match, handleValueWithFilter(context));
        return a !== undefined && a !== null ? String(a) : '';
    } catch (err) {
        return str;
    }
}

const context = { global: { userName: '111' } };

console.log(handleParamsValue("{{global.userName}}", context))
// -> "111"
console.log(handleParamsValue("{{global.userName}}-555", context))

// -> "111-555"
console.log(handleParamsValue("prefix-{{global.userName}}-suffix", context))

// -> "prefix-111-suffix"
