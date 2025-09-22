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
const Ajv = require('ajv');
const Mock = require('mockjs');
const sandboxFn = require('./sandbox')
const ejs = require('easy-json-schema');
const jsf = require('json-schema-faker');
const { schemaValidator } = require('../../common/utils');
const http = require('http');
const { GrpcAgentClient } = require('../grpc/dbClient.js')
const ExtraAssert = require('../../common/extraAssert.js');
console.log("ExtraAssert ===>", ExtraAssert);
const assert = require("assert");
const WsTestController = require("../controllers/wsTest");
const vm = require('vm');
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
async function executeQuery(params = [], vars = {},serverName) {
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
                console.error(`❌ 断言失败: ${JSON.stringify(expect)} != ${JSON.stringify(actualFlat[0])}\nSQL: ${query}`);
                throw e;
            }
        } else {
            const actualValue = actualRows && actualRows[0] ? actualRows[0][fields[0]] : undefined;

            try {
                assert.strictEqual(actualValue, expect);
                console.log(`✅ 断言通过: "${expect}" == "${actualValue}"`);
            } catch (e) {
                throw new Error(`❌ 断言失败: ${expect} != ${actualValue}\nSQL: ${query}`);
            }
        }
    }
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
        sandbox = sandbox || {};
        // ✅ 注入默认变量
        sandbox.vars = sandbox.vars || {};
        sandbox.sqlassert = sandbox.sqlassert || [];
        sandbox.sql = sandbox.sql || [];
        sandbox.console = console;
        sandbox.assert = assert;
        console.log("sandbox=============",sandbox)
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

        // 如果有 sqlAssert，执行断言
        if (Array.isArray(sandbox.sqlAssert) && sandbox.sqlAssert.length > 0) {
            const actualValue = await executeQuery(sandbox.sqlAssert, sandbox.vars);
            assertResult(actualValue, sandbox.sqlAssert);
            sandbox.wsLog = null; // 保证有 wsLog 字段
        }

        // ✅ 统一执行脚本，支持 async/await
        const wrappedScript = new vm.Script(`
      (async () => {
        ${script}
      })()
    `);

        await wrappedScript.runInContext(context);

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
    return params;
}

exports.handleParamsValue = handleParamsValue;

exports.getCaseList = async function getCaseList(id) {
    const caseInst = yapi.getInst(interfaceCaseModel);
    const colInst = yapi.getInst(interfaceColModel);
    const projectInst = yapi.getInst(projectModel);
    const interfaceInst = yapi.getInst(interfaceModel);
    let parentId = await colInst.getParentId(id,"parent_id")
    let resultList = await caseInst.list(parentId, 'all');
    let colData = await colInst.get(id);
    for (let index = 0; index < resultList.length; index++) {
        let result = resultList[index].toObject();
        let data = await interfaceInst.get(result.interface_id);
        if (!data) {
            await caseInst.del(result._id);
            continue;
        }
        let projectData = await projectInst.getBaseInfo(data.project_id);
        result.path = projectData.basepath + data.path;
        result.method = data.method;
        result.title = data.title;
        result.req_body_type = data.req_body_type;
        result.req_headers = handleParamsValue(data.req_headers, result.req_headers);
        result.res_body_type = data.res_body_type;
        result.req_body_form = handleParamsValue(data.req_body_form, result.req_body_form);
        result.req_query = handleParamsValue(data.req_query, result.req_query);
        result.req_params = handleParamsValue(data.req_params, result.req_params);
        resultList[index] = result;
    }
    resultList = resultList.sort((a, b) => {
        return a.index - b.index;
    });
    let ctxBody = yapi.commons.resReturn(resultList);
    ctxBody.colData = colData;
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
                    throw (`返回Json 不符合 response 定义的数据结构,原因: ${result.message}
数据结构如下：
${JSON.stringify(schema, null, 2)}`)
                }
            }
        }

        if (colData.checkScript.enable) {
            let globalScript = colData.checkScript.content;
            // script 是断言
            if (globalScript) {
                logs.push('执行脚本：' + globalScript)
                result = await yapi.commons.sandbox(context, globalScript);
                result.vars = context.vars;
            }
        }

        let script = params.script;
        // script 是断言
        if (script) {
            logs.push('执行脚本:' + script)
            result = await yapi.commons.sandbox(context, script);
            result.vars = context.vars;
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

