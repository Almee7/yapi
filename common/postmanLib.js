const { isJson5, json_parse, handleJson, joinPath, safeArray, isEmptyString} = require('./utils');
const constants = require('../client/constants/variable.js');
const _ = require('underscore');
const URL = require('url');
const utils = require('./power-string.js').utils;
const HTTP_METHOD = constants.HTTP_METHOD;
const axios = require('axios');
const qs = require('qs');
const CryptoJS = require('crypto-js');
const jsrsasign = require('jsrsasign');
const https = require('' +
    'https');
const isNode = typeof global == 'object' && global.global === global;
const ContentTypeMap = {
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'application/html': 'html',
  'text/html': 'html',
  other: 'text'
};


const getStorage = async (id)=>{
  try{
    if(isNode){
      let storage = global.storageCreator(id);
      let data = await storage.getItem();
      return {
        getItem: (name)=> data[name],
        setItem: (name, value)=>{
          data[name] = value;
          storage.setItem(name, value)
        }
      }
    }else{
      return {
        getItem: (name)=> window.localStorage.getItem(name),
        setItem: (name, value)=>  window.localStorage.setItem(name, value)
      }
    }
  }catch(e){
    console.error(e)
    return {
      getItem: (name)=>{
        console.error(name, e)
      },
      setItem: (name, value)=>{
        console.error(name, value, e)
      }
    }
  }
}

async function httpRequestByNode(options) {
  function handleRes(response) {
    if (!response || typeof response !== 'object') {
      return {
        res: {
          status: 500,
          body: isNode
            ? '请求出错, 内网服务器自动化测试无法访问到，请检查是否为内网服务器！'
            : '请求出错'
        }
      };
    }
    return {
      res: {
        header: response.headers,
        status: response.status,
        body: response.data
      }
    };
  }

  function handleData() {
    let contentTypeItem;
    if (!options) return;
    if (typeof options.headers === 'object' && options.headers) {
      Object.keys(options.headers).forEach(key => {
        if (/content-type/i.test(key)) {
          if (options.headers[key]) {
            contentTypeItem = options.headers[key]
              .split(';')[0]
              .trim()
              .toLowerCase();
          }
        }
        if (!options.headers[key]) delete options.headers[key];
      });

      if (
        contentTypeItem === 'application/x-www-form-urlencoded' &&
        typeof options.data === 'object' &&
        options.data
      ) {
        options.data = qs.stringify(options.data);
      }
    }
  }

  try {
    handleData(options);
    let response = await axios({
      method: options.method,
      url: options.url,
      headers: options.headers,
      timeout: 10000,
      maxRedirects: 0,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      data: options.data
    });
    return handleRes(response);
  } catch (err) {
    if (err.response === undefined) {
      return handleRes({
        headers: {},
        status: null,
        data: err.message
      });
    }
    return handleRes(err.response);
  }
}

function handleContentType(headers) {
  if (!headers || typeof headers !== 'object') return ContentTypeMap.other;
  let contentTypeItem = 'other';
  try {
    Object.keys(headers).forEach(key => {
      if (/content-type/i.test(key)) {
        contentTypeItem = headers[key]
          .split(';')[0]
          .trim()
          .toLowerCase();
      }
    });
    return ContentTypeMap[contentTypeItem] ? ContentTypeMap[contentTypeItem] : ContentTypeMap.other;
  } catch (err) {
    return ContentTypeMap.other;
  }
}

function checkRequestBodyIsRaw(method, reqBodyType) {
  if (
    reqBodyType &&
    reqBodyType !== 'file' &&
    reqBodyType !== 'form' &&
    HTTP_METHOD[method].request_body
  ) {
    return reqBodyType;
  }
  return false;
}

// 判断重复项函数
function checkNameIsExistInArray(name, arr) {
  let isRepeat = false;
  for (let i = 0; i < arr.length; i++) {
    let item = arr[i];
    if (item.name === name) {
      isRepeat = true;
      break;
    }
  }
  return isRepeat;
}
// 根据给定的环境名称从域名配置数组中查找匹配的配置对象
function handleCurrDomain(domains, case_env) {
  let currDomain = _.find(domains, item => item.name === case_env);
  if (!currDomain) {
    currDomain = domains[0];
  }
  return currDomain;
}

function sandboxByNode(sandbox = {}, script) {
  const vm = require('vm');
  script = new vm.Script(script);
  const context = new vm.createContext(sandbox);
  script.runInContext(context, {
    timeout: 10000
  });
  return sandbox;
}

async function  sandbox(context = {}, script) {
  if (isNode) {
    try {
      context.context = context;
      context.console = console;
      context.Promise = Promise;
      context.setTimeout = setTimeout;
      context = sandboxByNode(context, script);
    } catch (err) {
      err.message = `Script: ${script}
      message: ${err.message}`;
      throw err;
    }
  } else {
    context = sandboxByBrowser(context, script);
  }
  if (context.promise && typeof context.promise === 'object' && context.promise.then) {
    try {
      await context.promise;
    } catch (err) {
      err.message = `Script: ${script}
      message: ${err.message}`;
      throw err;
    }
  }
  return context;
}

function replaceWithEnv(obj, env) {
  if (typeof obj === 'string') {
    const templateExpr = /\{\{\s*([^}]+?)\s*\}\}/g;

    // 整个字符串是单独一个模板
    const matchWhole = obj.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
    if (matchWhole) {
      const key = matchWhole[1];
      return env.hasOwnProperty(key) ? env[key] : obj; // 保留原类型
    }

    // 字符串中包含模板，全部替换成字符串
    return obj.replace(templateExpr, (_, key) => {
      if (env.hasOwnProperty(key)) {
        const value = env[key];
        // 拼接时统一转字符串
        return (value !== null && value !== undefined) ? String(value) : '';
      }
      return `{{${key}}}`;
    });
  } else if (Array.isArray(obj)) {
    return obj.map(item => replaceWithEnv(item, env));
  } else if (obj && typeof obj === 'object') {
    const result = {};
    for (const k in obj) {
      result[k] = replaceWithEnv(obj[k], env);
    }
    return result;
  } else {
    // 数字、布尔、null 等原样返回
    return obj;
  }
}


/**
 * 只提取脚本中的第一个 sql = [...] 块并解析成对象数组（支持 JSON 或 JS 表达式）
 * 返回：{ sql: Array|null, sqlMatchStr: string|null }
 */
function extractSqlOnly(script) {
  const result = { sql: null, sqlMatchStr: null };

  // 匹配第一个 sql = [...]，支持换行、末尾可有分号
  const sqlRegex = /sql\s*=\s*(\[[\s\S]*?\])\s*(?:;|\n|$)/m;
  const m = script.match(sqlRegex);
  if (!m) {
    return result;
  }

  let sqlStr = m[1].trim().replace(/;$/, '').trim();
  result.sqlMatchStr = m[0];

  try {
    // 优先尝试 JSON.parse（更安全）
    result.sql = JSON.parse(sqlStr);
    console.log('✅ JSON 解析 sql 成功');
  } catch (jsonErr) {
    try {
      // 回退到 JS 解析（支持单引号等情况）
      result.sql = new Function('return ' + sqlStr)();
      console.log('✅ JS 表达式解析 sql 成功');
    } catch (err) {
      console.error('❌ 解析 sql 失败', err);
      result.sql = null;
    }
  }

  return result;
}

/**
 * 将 SQL 返回的对象（如 { bl1: '破坏者', bl2: '444' }）
 * 转换成 vars.bl1 = "破坏者"; vars.bl2 = "444";
 * 并同步写入 context.vars（如果提供）。
 */
function convertResultRowToVarsScript(row, context) {
  if (!row || typeof row !== 'object') return '';

  const lines = Object.entries(row).map(([k, v]) => {
    // 使用 JSON.stringify 保证字符串安全转义
    return `vars.${k} = ${JSON.stringify(v)};`;
  });

  // 如果提供 context，写入 context.vars 方便后端/前端后续使用（可选，但通常有用）
  if (context && typeof context === 'object') {
    context.vars = context.vars || {};
    Object.entries(row).forEach(([k, v]) => {
      context.vars[k] = v;
    });
  }

  return lines.join('\n');
}

/**
 * 最终 sandboxByBrowser —— 只提取 sql，移除原脚本 sql 段，调用后端，注入 SQL 结果为 vars，执行剩余脚本。
 */
async function sandboxByBrowser(context = {}, script) {
  if (!script || typeof script !== 'string') return context;

  // 确保 context.vars 初始化
  context.vars = context.vars || {};

  // 1) 提取 sql（仅第一个）
  const parsed = extractSqlOnly(script);

  // 2) 如果发现并解析到 sql，则调用后端
  let data = [];
  if (Array.isArray(parsed.sql) && parsed.sql.length > 0) {
    try {
      const res = await axios.post('/api/col/runSql', { sql: parsed.sql });
      data = res && res.data && res.data.data ? res.data.data : [];
      console.log('sandboxByBrowser--SQL 返回数据：', data);
    } catch (err) {
      console.error('❌ runSql 请求失败：', err);
      data = [];
    }
  } else {
    console.log('ℹ️ 脚本中未包含 sql 或解析失败，跳过 runSql 请求');
  }

  // 3) 将后端返回的第一个结果集的第一行转换为 vars 赋值脚本，并写回 context.vars
  let varsFromSqlScript = '';
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0]) && data[0].length > 0) {
    const firstRow = data[0][0];
    varsFromSqlScript = convertResultRowToVarsScript(firstRow, context);
    console.log('✅ 将 SQL 结果转换为 vars 脚本：\n', varsFromSqlScript);
  }

  // 4) 从原脚本中移除匹配到的 sql 段（只移除第一个匹配）
  let scriptWithoutSql = script;
  if (parsed.sqlMatchStr) {
    scriptWithoutSql = script.replace(parsed.sqlMatchStr, '').trim();
  }

  // 5) 合并最终执行脚本：先注入 SQL 返回的 vars，再执行原脚本
  const finalScript = [varsFromSqlScript, scriptWithoutSql].filter(Boolean).join('\n');
  console.log('--- 最终执行脚本 ---\n', finalScript)

  // 6) 执行（保持原有行为：注入 context.vars => 执行 finalScript）
  const beginScript = `var vars = context.vars;\n`;
  try {
    console.log('--- 将执行的 finalScript ---\n', finalScript);
    eval(beginScript + finalScript);
  } catch (err) {
    const message = `
Script:
----CodeBegin----
${beginScript}
${finalScript}
----CodeEnd----
`;
    err.message = `${message}\n错误信息: ${err.message}`;
    throw err;
  }

  return context;
}




/**
 *
 * @param {*} defaultOptions
 * @param {*} preScript
 * @param {*} afterScript
 * @param {*} commonContext  负责传递一些业务信息，crossRequest 不关注具体传什么，只负责当中间人
 * @param {*} pre_request_script
 */
async function crossRequest(defaultOptions, preScript, afterScript, pre_request_script ,commonContext = {}) {
  let options = {
    ...defaultOptions
  }
  const taskId = options.taskId || Math.random() + '';
  let urlObj = URL.parse(options.url, true),
      query = {};
  query = Object.assign(query, urlObj.query);

  let context = {
    isNode,
    get href() {
      return urlObj.href;
    },
    set href(val) {
      throw new Error('context.href 不能被赋值');
    },
    get hostname() {
      return urlObj.hostname;
    },
    set hostname(val) {
      throw new Error('context.hostname 不能被赋值');
    },

    get caseId() {
      return options.caseId;
    },

    set caseId(val) {
      throw new Error('context.caseId 不能被赋值');
    },

    method: options.method,
    pathname: urlObj.pathname,
    query: query,
    requestHeader: options.headers || {},
    requestBody: options.data,
    promise: false,
    storage: await getStorage(taskId),
    vars: defaultOptions.vars || {}
  };
  Object.assign(context, commonContext)

  context.utils = Object.freeze({
    _: _,
    CryptoJS: CryptoJS,
    jsrsasign: jsrsasign,
    base64: utils.base64,
    md5: utils.md5,
    sha1: utils.sha1,
    sha224: utils.sha224,
    sha256: utils.sha256,
    sha384: utils.sha384,
    sha512: utils.sha512,
    unbase64: utils.unbase64,
    axios: axios
  });

  async function runScript(script, updateUrlHeader = false) {
    if (!isEmptyString(script)) {
      context = await sandbox(context, script);

      if (updateUrlHeader) {
        options.url = defaultOptions.url = URL.format({
          protocol: urlObj.protocol,
          host: urlObj.host,
          query: context.query,
          pathname: context.pathname
        });
        options.headers = defaultOptions.headers = context.requestHeader;
      }
    }
    // 变量替换永远执行
    if (context.requestBody) {
      context.requestBody = replaceWithEnv(context.requestBody, context.vars);
    }

    options.data = defaultOptions.data = context.requestBody;
  }

  // ==== 先执行 pre_request_script（不影响 URL/header）====
  await runScript(pre_request_script, false);

  // ==== 再执行 preScript（可能会修改 URL/header）====
  await runScript(preScript, true);

  let data;

  if (isNode) {
    data = await httpRequestByNode(options);
    data.req = options;
  } else {
    data = await new Promise((resolve, reject) => {
      options.error = options.success = function (res, header, data) {
        let message = '';
        if (res && typeof res === 'string') {
          res = json_parse(data.res.body);
          data.res.body = res;
        }
        if (!isNode) message = '请求异常，请检查 chrome network 错误信息... https://juejin.im/post/5c888a3e5188257dee0322af 通过该链接查看教程"）';
        if (isNaN(data.res.status)) {
          reject({
            body: res || message,
            header,
            message
          });
        }
        resolve(data);
      };
      console.log("发送请求前的数据",options)
      window.crossRequest(options);
    });
  }
  if (afterScript) {
    context.responseData = data.res.body;
    context.responseHeader = data.res.header;
    context.responseStatus = data.res.status;
    context.runTime = data.runTime;
    context = await sandbox(context, afterScript);
    data.res.body = context.responseData;
    data.res.header = context.responseHeader;
    data.res.status = context.responseStatus;
    data.runTime = context.runTime;
  }
  return data;
}


function NewFile(fileData) {
  const { name, type, content, lastModified } = fileData;

  // 将 Base64 字符串转换为 Uint8Array
  const byteString = atob(content); // decode base64
  const byteArray = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    byteArray[i] = byteString.charCodeAt(i);
  }

  // 构造 File 对象
  return new File([byteArray], name, {
    type: type || 'application/octet-stream',
    lastModified: lastModified || Date.now()
  });
}
async function handleParams(interfaceData, handleValue, requestParams) {
  let interfaceRunData = Object.assign({}, interfaceData);

  function paramsToObjectWithEnable(arr) {
    const obj = {};
    safeArray(arr).forEach(item => {
      if (item && item.name && (item.enable || item.required === '1')) {
        obj[item.name] = handleValue(item.value, currDomain.global);
        if (requestParams) {
          requestParams[item.name] = obj[item.name];
        }
      }
    });
    return obj;
  }

  function paramsToObjectUnWithEnable(arr) {
    const obj = {};
    safeArray(arr).forEach(item => {
      if (item && item.name) {
        obj[item.name] = handleValue(item.value, currDomain.global);
        if (requestParams) {
          requestParams[item.name] = obj[item.name];
        }
      }
    });
    return obj;
  }

  let { case_env, path, env, _id } = interfaceRunData;
  let currDomain, requestBody, requestOptions;
  currDomain = handleCurrDomain(env, case_env);

  interfaceRunData.req_params = interfaceRunData.req_params || [];
  interfaceRunData.req_params.forEach(item => {
    let val = handleValue(item.value, currDomain.global);
    if (requestParams) {
      requestParams[item.name] = val;
    }
    path = path.replace(`:${item.name}`, val || `:${item.name}`);
    path = path.replace(`{${item.name}}`, val || `{${item.name}}`);
  });

    // 处理 URL 拼接与查询参数的注入
    const urlObj = URL.parse(joinPath(currDomain.domain, path), true);
    const url = URL.format({
      protocol: urlObj.protocol || 'http',
      slashes: urlObj.slashes,
      host: urlObj.host,
      pathname: urlObj.pathname,
      query: Object.assign(urlObj.query, paramsToObjectWithEnable(interfaceRunData.req_query))
    });

  let headers = paramsToObjectUnWithEnable(interfaceRunData.req_headers);
  requestOptions = {
    url,
    caseId: _id,
    method: interfaceRunData.method,
    headers,
    timeout: 82400000
  };

  // 🔹 修正 raw -> form/json
  try {
    if (interfaceRunData.req_body_type === 'raw') {
      if (headers && headers['Content-Type']) {
        if (headers['Content-Type'].includes('application/x-www-form-urlencoded')) {
          interfaceRunData.req_body_type = 'form';
          let reqData = json_parse(interfaceRunData.req_body_other);
          if (reqData && typeof reqData === 'object') {
            interfaceRunData.req_body_form = [];
            Object.keys(reqData).forEach(key => {
              interfaceRunData.req_body_form.push({
                name: key,
                type: 'text',
                value: JSON.stringify(reqData[key]),
                enable: true
              });
            });
          }
        } else if (headers['Content-Type'].includes('application/json')) {
          interfaceRunData.req_body_type = 'json';
        }
      }
    }
  } catch (e) {
    console.error('err', e);
  }

  if (HTTP_METHOD[interfaceRunData.method].request_body) {
    if (interfaceRunData.req_body_type === 'form') {
      requestBody = paramsToObjectWithEnable(
          safeArray(interfaceRunData.req_body_form).filter(item => item.type === 'text')
      );
    } else if (interfaceRunData.req_body_type === 'json') {
      let reqBody = isJson5(interfaceRunData.req_body_other);
      if (reqBody === false) {
        requestBody = interfaceRunData.req_body_other;
      } else {
        if (requestParams) {
          requestParams = Object.assign(requestParams, reqBody);
        }
        requestBody = handleJson(reqBody, val => handleValue(val, currDomain.global));
      }
    } else if (interfaceRunData.req_body_type === 'xml') {
      requestBody = handleValue(interfaceRunData.req_body_other, currDomain.global);
    } else {
      requestBody = interfaceRunData.req_body_other;
    }
    requestOptions.data = requestBody;

    // ✅ 异步处理 formData
    if (interfaceRunData.req_body_type === 'form') {
      const formData = new FormData();
      const formEntries = [];

      // 🔸 FileReader 异步读取
      const readFileAsBase64 = file =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

      const promises = safeArray(interfaceRunData.req_body_form).map(async item => {
        if (item.type === 'file') {
          let  file = item.value;
          if (file && !(file instanceof File) && !(file instanceof Blob)) {
            file = NewFile(file); // 转 File 对象
          }
          if (file && (file instanceof File || file instanceof Blob)) {
            formData.append(item.name || 'file', file, file.name || 'uploaded_file');
            const base64 = await readFileAsBase64(file);
            formEntries.push({
              key: item.name || 'file',
              isFile: true,
              name: file.name,
              type: file.type,
              content: base64
            });
          } else {
            console.warn('⚠️ 文件对象无效:', item.name, file);
            formData.append(item.name || 'file', '');
            formEntries.push({ key: item.name || 'file', value: '' });
          }
        } else {
          formData.append(item.name, item.value || '');
          formEntries.push({ key: item.name, value: item.value || '' });
        }
      });

      await Promise.all(promises);

      // ✅ 输出调试信息
      for (let [k, v] of formData.entries()) {
        if (v instanceof File) {
          console.log("✅ FormData 文件字段：", k, v.name, v.size, v.type);
        } else {
          console.log("✅ FormData 普通字段：", k, v);
        }
      }

      console.log("原始 formData", formData);

      requestOptions.isFormData = true;
      requestOptions.data = { __formData: true, entries: formEntries };

      console.log("序列化后的 requestOptions.data", requestOptions.data);
    }
    else if (interfaceRunData.req_body_type === 'file') {
      const fileItem = safeArray(interfaceRunData.req_body_form).find(item => item.type === 'file');
      requestOptions.data = fileItem ? fileItem.value : null;
    }
  }

  return requestOptions;
}

exports.checkRequestBodyIsRaw = checkRequestBodyIsRaw;
  exports.handleParams = handleParams;
  exports.handleContentType = handleContentType;
  exports.crossRequest = crossRequest;
  exports.handleCurrDomain = handleCurrDomain;
  exports.checkNameIsExistInArray = checkNameIsExistInArray;