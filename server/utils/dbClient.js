const assert = require('assert');
const axios = require("axios");
const yapi = require('../yapi.js');

async function runTestScript(testScript) {
    let baseUrl = yapi.WEBCONFIG.sqlServer
    const url = baseUrl + '/internal/loadAssertData'; // 请替换成你的接口地址
    console.log(url)
    // 构造请求体，去掉 expect 字段
    const payload = testScript.map(item => ({
        dataSourceType: item.dataSourceType,
        dataSourceName: item.dataSourceName,
        fields: item.fields,
        query: item.query
    }));
    try {
        const res = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        const resultData = res.data;

        for (let index = 0; index < testScript.length; index++) {
            const testItem = testScript[index];
            const actualRows = resultData[index];
            const expect = testItem.expect;
            const query = testItem.query;
            if (Array.isArray(expect)) {

                // 多行多字段断言
                const actualFlat = actualRows.map(row =>
                    testItem.fields.map(f => row[f])
                );
                console.log("actualFlat---------", resultData, testItem, actualFlat[0], expect[0])
                try {
                    assert.deepStrictEqual(actualFlat[0], expect);
                    console.log(`✅ 断言通过: ${JSON.stringify(expect)} == ${JSON.stringify(actualFlat[0])}`);
                } catch (e) {
                    throw new Error(`❌ 数据库断言失败: ${JSON.stringify(expect[0])} == ${JSON.stringify(actualFlat[0])} \nSQL: ${query}`);
                }

            } else {
                // 单字段断言
                const actualValue = actualRows && actualRows[0] ? actualRows[0][testItem.fields[0]] : undefined;

                try {
                    assert.strictEqual(actualValue, expect);
                    console.log(`✅ 断言通过: "${expect}" == "${actualValue}"`);
                } catch (e) {
                    throw new Error(`❌ 数据库断言失败: ${expect} == ${actualValue} \nSQL: ${query}}`);
                }
            }
        }
    } catch (err) {
        // ❗注意：这里既包括 HTTP 请求失败，也包括断言失败抛出的 Error
        throw err;
    }
}

module.exports = {
    runTestScript
};
