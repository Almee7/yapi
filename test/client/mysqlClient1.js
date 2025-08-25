const assert = require('assert');
const axios = require("axios");

const testScript =  [
    {
        "dataSourceType": "POSTGRES",
        "fields": [
            "user_name"
        ],
        "dataSourceName": "xpa-postgres",
        "query": "select user_name from \"user\" where user_id = '007'"
    }
]
async function runTestScript() {
    const url = 'http://196.168.1.143:3399/internal/loadAssertData'; // 请替换成你的接口地址
    // 构造请求体，去掉 expect 字段
    const payload = testScript.map(item => ({
        dataSourceType: item.dataSourceType,
        dataSourceName: item.dataSourceName,
        fields: item.fields,
        query: item.query
    }));
    console.log("payload",payload)
    try {
        const res = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        const resultData = res.data;
        console.log("resultData",resultData);
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

                try {
                    console.log('actualFlat types:', actualFlat.map(row => row.map(col => typeof col)));
                    console.log('expect types:', expect.map(row => row.map(col => typeof col)));
                    console.error('Expect:', JSON.stringify(expect, null, 2));
                    console.error('Actual:', JSON.stringify(actualFlat, null, 2));
                    assert.deepStrictEqual(actualFlat, expect);
                    console.log(`✅ 断言通过: ${JSON.stringify(expect)} == ${JSON.stringify(actualFlat)}`);
                } catch (e) {

                    throw new Error(`❌ 数据库断言失败: ${expect} == ${actualFlat} \nSQL: ${query}}`);
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

runTestScript();
