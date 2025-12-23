const fs = require('fs-extra');
const path = require('path');
const yapi = require('../yapi.js');
const sha1 = require('sha1');
const logModel = require('../models/log.js');
const projectModel = require('../models/project.js');
const interfaceColModel = require('../models/interfaceCol.js');
const interfaceCaseModel = require('../models/interfaceCase.js');
const interfaceModel = require('../models/interface.js');
const userModel = require('../models/user.js');
const json5 = require('json5');
const _ = require('underscore');
const Ajv = require('ajv')
const Mock = require('mockjs');
const sandboxFn = require('./sandbox')
const ejs = require('easy-json-schema');
const jsf = require('json-schema-faker');
const { schemaValidator } = require('../../common/utils');
const http = require('http');
const { GrpcAgentClient } = require('../grpc/dbClient.js')
const ExtraAssert = require('../../common/extraAssert.js');
const assert = require("assert");
const WsTestController = require("../controllers/wsTest");
const vm = require('vm');
// const {validate} = require("compare-versions");
jsf.extend('mock', function () {
    return {
        mock: function (xx) {
            return Mock.mock(xx);
        }
    };
});

const defaultOptions = {
    failOnInvalidTypes: false,
    failOnInvalidFormat: false
};

exports.schemaToJson = function (schema, options = {}) {
    Object.assign(options, defaultOptions);

    jsf.option(options);
    let result;
    try {
        result = jsf.generate(schema);
    } catch (err) {
        result = err.message;
    }
    jsf.option(defaultOptions);
    return result;
};

exports.resReturn = (data, num, errmsg) => {
    num = num || 0;

    return {
        errcode: num,
        errmsg: errmsg || '成功！',
        data: data
    };
};

exports.log = (msg, type) => {
    if (!msg) {
        return;
    }

    type = type || 'log';

    let f;

    switch (type) {
        case 'log':
            f = console.log; // eslint-disable-line
            break;
        case 'warn':
            f = console.warn; // eslint-disable-line
            break;
        case 'error':
            f = console.error; // eslint-disable-line
            break;
        default:
            f = console.log; // eslint-disable-line
            break;
    }

    f(type + ':', msg);

    let date = new Date();
    let year = date.getFullYear();
    let month = date.getMonth() + 1;

    let logfile = path.join(yapi.WEBROOT_LOG, year + '-' + month + '.log');

    if (typeof msg === 'object') {
        if (msg instanceof Error) msg = msg.message;
        else msg = JSON.stringify(msg);
    }

    // let data = (new Date).toLocaleString() + '\t|\t' + type + '\t|\t' + msg + '\n';
    let data = `[ ${new Date().toLocaleString()} ] [ ${type} ] ${msg}\n`;

    fs.writeFileSync(logfile, data, {
        flag: 'a'
    });
};

exports.fileExist = filePath => {
    try {
        return fs.statSync(filePath).isFile();
    } catch (err) {
        return false;
    }
};

exports.time = () => {
    return Date.parse(new Date()) / 1000;
};

exports.fieldSelect = (data, field) => {
    if (!data || !field || !Array.isArray(field)) {
        return null;
    }

    var arr = {};

    field.forEach(f => {
        typeof data[f] !== 'undefined' && (arr[f] = data[f]);
    });

    return arr;
};

exports.rand = (min, max) => {
    return Math.floor(Math.random() * (max - min) + min);
};

exports.json_parse = json => {
    try {
        return json5.parse(json);
    } catch (e) {
        return json;
    }
};

exports.randStr = () => {
    return Math.random()
        .toString(36)
        .substr(2);
};
exports.getIp = ctx => {
    let ip;
    try {
        ip = ctx.ip.match(/\d+.\d+.\d+.\d+/) ? ctx.ip.match(/\d+.\d+.\d+.\d+/)[0] : 'localhost';
    } catch (e) {
        ip = null;
    }
    return ip;
};

exports.generatePassword = (password, passsalt) => {
    return sha1(password + sha1(passsalt));
};

exports.expireDate = day => {
    let date = new Date();
    date.setTime(date.getTime() + day * 86400000);
    return date;
};

exports.sendMail = (options, cb) => {
    if (!yapi.mail) return false;
    options.subject = options.subject ? options.subject + '-YApi 平台' : 'YApi 平台';

    cb =
        cb ||
        function (err) {
            if (err) {
                yapi.commons.log('send mail ' + options.to + ' error,' + err.message, 'error');
            } else {
                yapi.commons.log('send mail ' + options.to + ' success');
            }
        };

    try {
        yapi.mail.sendMail(
            {
                from: yapi.WEBCONFIG.mail.from,
                to: options.to,
                subject: options.subject,
                html: options.contents
            },
            cb
        );
    } catch (e) {
        yapi.commons.log(e.message, 'error');
        console.error(e.message); // eslint-disable-line
    }
};

exports.validateSearchKeyword = keyword => {
    if (/^\*|\?|\+|\$|\^|\\|\.$/.test(keyword)) {
        return false;
    }

    return true;
};

exports.filterRes = (list, rules) => {
    return list.map(item => {
        let filteredRes = {};

        rules.forEach(rule => {
            if (typeof rule == 'string') {
                filteredRes[rule] = item[rule];
            } else if (typeof rule == 'object') {
                filteredRes[rule.alias] = item[rule.key];
            }
        });

        return filteredRes;
    });
};

exports.handleVarPath = (pathname, params) => {
    function insertParams(name) {
        if (!_.find(params, { name: name })) {
            params.push({
                name: name,
                desc: ''
            });
        }
    }

    if (!pathname) return;
    if (pathname.indexOf(':') !== -1) {
        let paths = pathname.split('/'),
            name,
            i;
        for (i = 1; i < paths.length; i++) {
            if (paths[i] && paths[i][0] === ':') {
                name = paths[i].substr(1);
                insertParams(name);
            }
        }
    }
    pathname.replace(/\{(.+?)\}/g, function (str, match) {
        insertParams(match);
    });
};

/**
 * 验证一个 path 是否合法
 * path第一位必需为 /, path 只允许由 字母数字-/_:.{}= 组成
 */
exports.verifyPath = path => {
    // if (/^\/[a-zA-Z0-9\-\/_:!\.\{\}\=]*$/.test(path)) {
    //   return true;
    // } else {
    //   return false;
    // }
    return /^\/[a-zA-Z0-9\-\/_:!\.\{\}\=]*$/.test(path);
};

// 变量替换，支持表达式和数组转字符串
function replaceVars(template, vars) {
    return template.replace(/\$\{([^}]+)\}/g, (_, expr) => {
        try {
            const fn = new Function('vars', `with(vars) { return ${expr}; }`);
            const val = fn(vars);
            if (Array.isArray(val)) {
                return val.join(',');
            }
            return val;
        } catch(e) {
            return '';
        }
    });
}


//执行sql
async function executeQuery(params = [], vars = {}, serverName) {
    const client = new GrpcAgentClient(serverName);
    // 替换变量，构造新数组，避免修改原始 asserts
    const replacedAsserts = params.map(item => {
        const replacedQuery = replaceVars(item.query, vars);
        return { ...item, query: replacedQuery };
    });
    return client.invoke(replacedAsserts);
}

//执行断言
function assertResult(actualResult, params) {
    for (let i = 0; i < params.length; i++) {
        const testItem = params[i];
        const expect = testItem.expect;
        const fields = testItem.fields;
        const query = testItem.query;
        const actualRows = actualResult[i];
        if (Array.isArray(expect)) {
            if (!actualRows || !Array.isArray(actualRows)) {
                throw new Error(`断言失败：返回结果为空或格式不正确，SQL: ${query}`);
            }
            const actualFlat = actualRows.map(row =>
                fields.map(f => row[f])
            );
            if (actualFlat.length === 0) {
                throw new Error(`断言失败：没有查询到数据，SQL: ${query}`);
            }
            try {
                assert.deepStrictEqual(actualFlat[0], expect);
                console.log(`✅ 断言通过: ${JSON.stringify(expect)} == ${JSON.stringify(actualFlat[0])}`);
            } catch (e) {
                const errMsg = `❌ 断言失败: ${JSON.stringify(expect)} != ${JSON.stringify(actualFlat[0])}\nSQL: ${query}`;
                throw new Error(errMsg);
            }
        } else {
            const actualValue = actualRows && actualRows[0] ? actualRows[0][fields[0]] : undefined;
            try {
                assert.strictEqual(actualValue, expect);
                console.log(`✅ 断言通过: "${expect}" == "${actualValue}"`);
            } catch (e) {
                const Error = `❌ 断言失败: ${expect} != ${actualValue}\nSQL: ${query}`;
                throw new Error(Error);
            }
        }
    }
}

//替换变量
function replaceVarsInScript(scriptStr, vars = {}, global = {}) {
    if (!scriptStr || typeof scriptStr !== 'string') return scriptStr;

    vars = vars || {};
    global = global || {};

    // 匹配 {{xxx}} 或 {{global.xxx}}
    const variableRegexp = /\{\{\s*([^}]+?)\s*\}\}/g;

    return scriptStr.replace(variableRegexp, (raw, key) => {
        key = key.trim();
        let value;

        // 判断是 global 变量还是普通 vars
        if (key.startsWith('global.')) {
            const realKey = key.slice(7);
            value = global[realKey];
        } else {
            value = vars[key];
        }

        // 找不到值返回标记字符串
        if (value === undefined || value === null) {
            return `"{{__NOT_FOUND__${key}}}"`;
        }

        // 字符串加双引号，其他类型直接返回
        if (typeof value === 'string') {
            return `"${value}"`;
        } else {
            return value;
        }
    });
}
/**
 * 沙盒执行 js 代码
 * @sandbox Object context
 * @script String script
 * @return sandbox
 *
 * @example let a = sandbox({a: 1}, 'a=2')
 * a = {a: 2}
 */
// 把 ExtraAssert 的静态方法挂到 assert 上
Object.keys(ExtraAssert).forEach(fn => {
    assert[fn] = ExtraAssert[fn];
});

exports.sandbox = async (sandbox, script) => {
    try {
        let serverName = sandbox.body.serverName;
        sandbox = sandbox || {};
        // ✅ 注入默认变量
        sandbox.vars = sandbox.vars || {};
        sandbox.global = sandbox.global || {};
        sandbox.sqlAssert = sandbox.sqlAssert || [];
        sandbox.sql = sandbox.sql || [];
        sandbox.console = console;
        sandbox.assert = assert;
        script = replaceVarsInScript(script, sandbox.vars, sandbox.global)
        const context = vm.createContext(sandbox);
        // 检查是否有 readWS 调用
        const regex = /readWS\s*\(\s*["']([^"']+)["']\s*\)/;
        const match = script.match(regex);
        if (match) {
            const connectionId = context.body && context.body.connectionId;
            sandbox.readWS = async () => {
                const msg = await WsTestController.readws(connectionId);
                sandbox.wsLog = msg;     // 👈 把结果挂到 sandbox
                return msg;              // 👈 同时返回，脚本里也能接收
            };
        }
        let wrapped;
        if (match) {
            wrapped = new vm.Script(`(async () => {${script}})()`);
        } else {
            wrapped= new vm.Script(script);
        }
        // ✅ 统一执行脚本，支持 async/await
        await wrapped.runInContext(context);
        // 如果有 sqlAssert，执行断言
        if (Array.isArray(sandbox.sqlAssert) && sandbox.sqlAssert.length > 0) {
            const actualValue = await executeQuery(sandbox.sqlAssert, sandbox.vars, serverName);
            assertResult(actualValue, sandbox.sqlAssert);
            sandbox.wsLog = null; // 保证有 wsLog 字段
        }
        return sandbox; // 👈 统一一个 return
    } catch (err) {
        err.__sandboxFailed = true;
        throw err;
    }
};

function trim(str) {
    if (!str) {
        return str;
    }

    str = str + '';

    return str.replace(/(^\s*)|(\s*$)/g, '');
}

function ltrim(str) {
    if (!str) {
        return str;
    }

    str = str + '';

    return str.replace(/(^\s*)/g, '');
}

function rtrim(str) {
    if (!str) {
        return str;
    }

    str = str + '';

    return str.replace(/(\s*$)/g, '');
}

exports.trim = trim;
exports.ltrim = ltrim;
exports.rtrim = rtrim;

/**
 * 处理请求参数类型，String 字符串去除两边空格，Number 使用parseInt 转换为数字
 * @params Object {a: ' ab ', b: ' 123 '}
 * @keys Object {a: 'string', b: 'number'}
 * @return Object {a: 'ab', b: 123}
 */
exports.handleParams = (params, keys) => {
    if (!params || typeof params !== 'object' || !keys || typeof keys !== 'object') {
        return false;
    }

    for (var key in keys) {
        var filter = keys[key];
        if (params[key]) {
            switch (filter) {
                case 'string':
                    params[key] = trim(params[key] + '');
                    break;
                case 'number':
                    params[key] = !isNaN(params[key]) ? parseInt(params[key], 10) : 0;
                    break;
                default:
                    params[key] = trim(params + '');
            }
        }
    }

    return params;
};

exports.validateParams = (schema2, params) => {
    const flag = schema2.closeRemoveAdditional;
    const ajv = new Ajv({
        allErrors: true,
        coerceTypes: true,
        useDefaults: true,
        removeAdditional: !flag
    });

    var localize = require('ajv-i18n');
    delete schema2.closeRemoveAdditional;

    const schema = ejs(schema2);

    schema.additionalProperties = flag;
    const validate = ajv.compile(schema);
    let valid = validate(params);

    let message = '请求参数 ';
    if (!valid) {
        localize.zh(validate.errors);
        message += ajv.errorsText(validate.errors, { separator: '\n' });
    }

    return {
        valid: valid,
        message: message
    };
};

exports.saveLog = logData => {
    try {
        let logInst = yapi.getInst(logModel);
        let data = {
            content: logData.content,
            type: logData.type,
            uid: logData.uid,
            username: logData.username,
            typeid: logData.typeid,
            data: logData.data
        };

        logInst.save(data).then();
    } catch (e) {
        yapi.commons.log(e, 'error'); // eslint-disable-line
    }
};

/**
 *
 * @param {*} router router
 * @param {*} baseurl base_url_path
 * @param {*} routerController controller
 * @param {*} path  routerPath
 * @param {*} method request_method , post get put delete ...
 * @param {*} action controller action_name
 * @param {*} ws enable ws
 */
exports.createAction = (router, baseurl, routerController, action, path, method, ws) => {
    router[method](baseurl + path, async ctx => {
        let inst = new routerController(ctx);
        try {
            await inst.init(ctx);
            ctx.params = Object.assign({}, ctx.request.query, ctx.request.body, ctx.params);
            if (inst.schemaMap && typeof inst.schemaMap === 'object' && inst.schemaMap[action]) {

                let validResult = yapi.commons.validateParams(inst.schemaMap[action], ctx.params);

                if (!validResult.valid) {
                    return (ctx.body = yapi.commons.resReturn(null, 400, validResult.message));
                }
            }
            if (inst.$auth === true) {
                await inst[action].call(inst, ctx);
            } else {
                if (ws === true) {
                    ctx.ws.send('请登录...');
                } else {
                    ctx.body = yapi.commons.resReturn(null, 40011, '请登录...');
                }
            }
        } catch (err) {
            ctx.body = yapi.commons.resReturn(null, 40011, '服务器出错...');
            yapi.commons.log(err, 'error');
        }
    });
};

/**
 *
 * @param {*} params 接口定义的参数
 * @param {*} val  接口case 定义的参数值
 */
function handleParamsValue(params, val) {
    let value = {};
    // 深拷贝 params，避免修改原始params
    params = JSON.parse(JSON.stringify(params))
    try {
        params = params.toObject();
    } catch (e) { }
    if (params.length === 0 || val.length === 0) {
        return params;
    }
    val.forEach(item => {
        value[item.name] = item;
    });
    params.forEach((item, index) => {
        if (!value[item.name] || typeof value[item.name] !== 'object') return null;
        params[index].value = value[item.name].value;
        if (!_.isUndefined(value[item.name].enable)) {
            params[index].enable = value[item.name].enable;
        }
    });
    return params
}

async function flattenCases(colId, allCols, allCases, memo = new Map()) {
    // 使用记忆化避免重复计算
    const cacheKey = `${colId}`;
    if (memo.has(cacheKey)) {
        return memo.get(cacheKey);
    }
    
    // 使用 Map 提高查找效率
    const colsMap = new Map(allCols.map(c => [c._id.toString(), c]));
    const casesByColId = new Map();
    const casesByGroupId = new Map();
    
    // 预处理 cases，按 col_id 和 group_id 分组
    for (const c of allCases) {
        // 按 col_id 分组
        const colIdKey = c.col_id ? c.col_id.toString() : undefined;
        if (colIdKey) {
            if (!casesByColId.has(colIdKey)) {
                casesByColId.set(colIdKey, []);
            }
            casesByColId.get(colIdKey).push(c);
        }
        
        // 按 group_id 分组
        const groupIdKey = c.group_id ? c.group_id.toString() : undefined;
        if (groupIdKey) {
            if (!casesByGroupId.has(groupIdKey)) {
                casesByGroupId.set(groupIdKey, []);
            }
            casesByGroupId.get(groupIdKey).push(c);
        }
    }

    const result = [];

    // 找当前 col
    const col = colsMap.get(colId.toString());
    if (!col) {
        memo.set(cacheKey, result);
        return result;
    }
    
    // 当前是 group，直接返回 group 内 case 按 index 排序
    if (col.type === 'group') {
        const groupCases = casesByGroupId.get(col._id.toString()) || [];
        // 预先排序以避免重复排序
        const sortedResult = groupCases.slice().sort((a, b) => a.index - b.index);
        memo.set(cacheKey, sortedResult);
        return sortedResult;
    }
    
    // 当前 col 下的普通 case（group_id=null）
    const folderCases = (casesByColId.get(colId.toString()) || [])
        .filter(c => !c.group_id);
    
    // 对 folderCases 进行原地排序
    folderCases.sort((a, b) => a.index - b.index);
        
    // 当前 col 下的 group，按 index 排序
    const childGroups = [];
    for (const c of allCols) {
        if (c.parent_id && c.parent_id.toString() === colId.toString() && c.type === 'group') {
            childGroups.push(c);
        }
    }
    childGroups.sort((a, b) => a.index - b.index);
        
    // 预先排序所有 group cases 以避免重复排序
    const sortedGroupCasesMap = new Map();
    for (const g of childGroups) {
        const groupCases = casesByGroupId.get(g._id.toString()) || [];
        // 创建副本并排序
        const sortedCases = [];
        for (const gc of groupCases) {
            sortedCases.push(gc);
        }
        sortedCases.sort((a, b) => a.index - b.index);
        sortedGroupCasesMap.set(g._id.toString(), sortedCases);
    }

    // 构建一个完整的排序算法，考虑容器层级关系
    // 首先获取当前容器的所有直接子元素（包括 case、group 和 folder），按 index 排序
    
    // 收集当前容器的所有子元素
    const directChildren = [];
    
    // 添加当前容器的普通 case
    for (const c of folderCases) {
        directChildren.push({
            type: 'case',
            index: c.index,
            element: c
        });
    }
    
    // 添加当前容器的 groups
    for (const g of childGroups) {
        directChildren.push({
            type: 'group',
            index: g.index,
            element: g
        });
    }
    
    // 添加当前容器的 folders
    const childFolders = [];
    for (const f of allCols) {
        if (f.parent_id && f.parent_id.toString() === colId.toString() && f.type === 'folder') {
            childFolders.push(f);
        }
    }
    childFolders.sort((a, b) => a.index - b.index);
    
    for (const f of childFolders) {
        directChildren.push({
            type: 'folder',
            index: f.index,
            element: f
        });
    }
    
    // 按 index 排序直接子元素
    directChildren.sort((a, b) => a.index - b.index);
    
    // 按排序后的顺序处理每个子元素
    for (const child of directChildren) {
        if (child.type === 'case') {
            // 直接添加 case
            result.push(child.element);
        } else if (child.type === 'group') {
            // 添加 group 内的所有 case
            const groupCases = sortedGroupCasesMap.get(child.element._id.toString()) || [];
            result.push(...groupCases);
        } else if (child.type === 'folder') {
            // 递归获取 folder 的所有 case，传递 memoization map
            const subCases = await flattenCases(child.element._id, allCols, allCases, memo);
            result.push(...subCases);
        }
    }
    
    // 缓存结果
    memo.set(cacheKey, result);
    return result;
}
exports.handleParamsValue = handleParamsValue;

exports.getCaseList = async function getCaseList(id) {
    // 添加参数验证
    if (!id) {
        throw new Error('Collection ID is required');
    }
    
    const caseInst = yapi.getInst(interfaceCaseModel);
    const colInst = yapi.getInst(interfaceColModel);
    const projectInst = yapi.getInst(projectModel);
    const interfaceInst = yapi.getInst(interfaceModel);

    // 1️⃣ 并行执行数据库查询以提高性能
    const [colIds, colData] = await Promise.all([
        colInst.getParentId(id),
        colInst.get(id)
    ]);
    
    // 如果没有 colIds，直接返回空结果
    if (!colIds || colIds.length === 0) {
        return yapi.commons.resReturn([]);
    }
    
    // 2️⃣ 并行获取所有 col 和 case 数据
    const [allCols, allCases] = await Promise.all([
        colInst.allColList(colIds,'all'),
        caseInst.newList(colIds, 'all')
    ]);

    // 3️⃣ 获取到排序后的caseList
    // 使用共享的 memoization cache 来提高性能
    let resultList = await flattenCases(id, allCols, allCases, new Map());
    
    // 如果没有结果，直接返回
    if (resultList.length === 0) {
        const ctxBody = yapi.commons.resReturn(resultList);
        ctxBody.colData = colData;
        const groups = allCols.filter(item => item.type === 'group');
        if (groups.length > 0) {
            ctxBody.groupData = groups;
        }
        return ctxBody;
    }
    
    // 4️⃣ 提取需要的 IDs
    const interfaceIds = resultList.map(c => c.interface_id).filter(id => id != null);
    
    // 5️⃣ 并行获取 interface 和 project 数据
    let interfaceList = [];
    let projectList = [];
    
    if (interfaceIds.length > 0) {
        interfaceList = await interfaceInst.getByIds(interfaceIds);
        const projectIds = [...new Set(interfaceList.map(i => i.project_id))].filter(id => id != null);
        if (projectIds.length > 0) {
            projectList = await projectInst.getBaseInfoByIds(projectIds);
        }
    }

    // 6️⃣ 建立 Map 便于快速查找
    const interfaceMap = new Map();
    interfaceList.forEach(i => {
        if (i && i._id) {
            interfaceMap.set(i._id.toString(), i);
        }
    });

    const projectMap = new Map();
    projectList.forEach(p => {
        if (p && p._id) {
            projectMap.set(p._id.toString(), p);
        }
    });

    // 7️⃣ 遍历每个 case，组合接口和项目路径 (使用 for 循环优化)
    const casesToDelete = [];
    for (let i = 0; i < resultList.length; i++) {
        const result = resultList[i];
        if (!result.interface_id) continue;
        
        const data = interfaceMap.get(result.interface_id.toString());
        if (!data) {
            casesToDelete.push(result._id);
            continue;
        }
        const projectData = projectMap.get(data.project_id.toString());
        if (!projectData) {
            casesToDelete.push(result._id);
            continue;
        }
        result.path = projectData.basepath + data.path;
        result.method = data.method;
        result.title = data.title;
        result.req_body_type = data.req_body_type;
        result.res_body_type = data.res_body_type;
        result.req_headers = handleParamsValue(data.req_headers, result.req_headers)
        result.req_body_form = handleParamsValue(data.req_body_form, result.req_body_form)
        result.req_query = handleParamsValue(data.req_query, result.req_query)
        result.req_params = handleParamsValue(data.req_params, result.req_params)
    }
    
    // 批量删除无效的 cases
    if (casesToDelete.length > 0) {
        await Promise.all(casesToDelete.map(caseId => caseInst.del(caseId)));
    }
    
    // 8️⃣ 返回结果
    const ctxBody = yapi.commons.resReturn(resultList);
    ctxBody.colData = colData;
    const groups = allCols.filter(item => item.type === 'group');
    if (groups.length > 0) {
        ctxBody.groupData = groups;
    }
    return ctxBody;
};


function convertString(variable) {
    if (variable instanceof Error) {
        return variable.name + ': ' + variable.message;
    }
    try {
        if (variable && typeof variable === 'string') {
            return variable;
        }
        return JSON.stringify(variable, null, '   ');
    } catch (err) {
        return variable || '';
    }
}



exports.runCaseScript = async function runCaseScript(params, colId, interfaceId) {
    const colInst = yapi.getInst(interfaceColModel);
    let colData = await colInst.get(colId);
    const logs = [];
    const context = {
        assert: require('assert'),
        status: params.response.status,
        body: params.response.body,
        header: params.response.header,
        records: params.records,
        params: params.params,
        vars: params.vars || {},
        global: params.global,
        sqlAssert: [],
        log: msg => {
            logs.push('log: ' + convertString(msg));
        }
    };
    let result = {};
    try {

        if (colData.checkHttpCodeIs200) {
            let status = +params.response.status;
            if (status !== 200) {
                throw ('Http status code 不是 200，请检查(该规则来源于于 [测试集->通用规则配置] )')
            }
        }

        if (colData.checkResponseField.enable) {
            if (params.response.body[colData.checkResponseField.name] != colData.checkResponseField.value) {
                throw (`返回json ${colData.checkResponseField.name} 值不是${colData.checkResponseField.value}，请检查(该规则来源于于 [测试集->通用规则配置] )`)
            }
        }

        if (colData.checkResponseSchema) {
            const interfaceInst = yapi.getInst(interfaceModel);
            let interfaceData = await interfaceInst.get(interfaceId);
            if (interfaceData.res_body_is_json_schema && interfaceData.res_body) {
                let schema = JSON.parse(interfaceData.res_body);
                let result = schemaValidator(schema, context.body)
                if (!result.valid) {
                    throw (`返回Json 不符合 response 定义的数据结构,原因: ${result.message}数据结构如下：${JSON.stringify(schema, null, 2)}`)
                }
            }
        }
        let hasGlobalScript = false;
        let hasCaseScript = false;
                
        if (colData.checkScript.enable) {
            let globalScript = colData.checkScript.content;
            // script 是断言
            if (globalScript) {
                hasGlobalScript = true;
                logs.push('执行全局断言脚本：' + globalScript)
                result = await yapi.commons.sandbox(context, globalScript);
                result.vars = context.vars;
            }
        }
                
        let script = params.scriptArr;
        // script 是断言
        if (params.scripts.enable) {
            script = params.scripts.content;
            hasCaseScript = true;
            logs.push('执行脚本:' + script)
            result = await yapi.commons.sandbox(context, script);
            result.vars = context.vars;
        }
                
        // 如果既没有全局脚本也没有用例脚本，则添加无脚本标识
        if (!hasGlobalScript && !hasCaseScript) {
            logs.push('无脚本');
            // 返回特殊的错误码表示无脚本
            return yapi.commons.resReturn(result, 2, '无脚本');
        }
        result.logs = logs;
        return yapi.commons.resReturn(result);
    } catch (err) {
        logs.push(convertString(err));
        result.logs = logs;
        return yapi.commons.resReturn(result, 400, err.name + ': ' + err.message);
    }
};

exports.getUserdata = async function getUserdata(uid, role) {
    role = role || 'dev';
    let userInst = yapi.getInst(userModel);
    let userData = await userInst.findById(uid);
    if (!userData) {
        return null;
    }
    return {
        role: role,
        uid: userData._id,
        username: userData.username,
        email: userData.email
    };
};

// 处理mockJs脚本
exports.handleMockScript = async function (script, context) {
    let sandbox = {
        header: context.ctx.header,
        query: context.ctx.query,
        body: context.ctx.request.body,
        mockJson: context.mockJson,
        params: Object.assign({}, context.ctx.query, context.ctx.request.body),
        resHeader: context.resHeader,
        httpCode: context.httpCode,
        delay: context.httpCode,
        Random: Mock.Random
    };
    sandbox.cookie = {};

    context.ctx.header.cookie &&
    context.ctx.header.cookie.split(';').forEach(function (Cookie) {
        var parts = Cookie.split('=');
        sandbox.cookie[parts[0].trim()] = (parts[1] || '').trim();
    });
    sandbox = await sandboxFn(sandbox, script);
    sandbox.delay = isNaN(sandbox.delay) ? 0 : +sandbox.delay;

    context.mockJson = sandbox.mockJson;
    context.resHeader = sandbox.resHeader;
    context.httpCode = sandbox.httpCode;
    context.delay = sandbox.delay;
};



exports.createWebAPIRequest = function (ops) {
    return new Promise(function (resolve, reject) {
        let req = '';
        let http_client = http.request(
            {
                host: ops.hostname,
                method: 'GET',
                port: ops.port,
                path: ops.path
            },
            function (res) {
                res.on('error', function (err) {
                    reject(err);
                });
                res.setEncoding('utf8');
                if (res.statusCode != 200) {
                    reject({ message: 'statusCode != 200' });
                } else {
                    res.on('data', function (chunk) {
                        req += chunk;
                    });
                    res.on('end', function () {
                        resolve(req);
                    });
                }
            }
        );
        http_client.on('error', (e) => {
            reject({ message: `request error: ${e.message}` });
        });
        http_client.end();
    });
}

