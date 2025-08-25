const axios = require('axios');
const assert = require('assert');

const testScript = [
    {
        "dataSourceType": "POSTGRES",
        "fields": [
            "user_name"
        ],
        "dataSourceName": "xpa-postgres",
        "query": "select user_name from \"user\" where user_id = '007'"
    }
];

async function runTestScript() {
    const url = 'http://196.168.1.143:3399/internal/loadAssertData';
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
        testScript.forEach((testItem, index) => {
            const actualRows = resultData[index];
            const expect = testItem.expect;
            const query = testItem.query;

            try {
                if (Array.isArray(expect)) {
                    // 多行多字段断言
                    actualRows.forEach(row => {
                        testItem.fields.forEach(field => {
                            console.log(`字段 ${field} 类型:`, typeof row[field], row[field] instanceof String);
                        });
                    });
                    const actualFlat = actualRows.map(row =>
                        testItem.fields.map(f => row[f])
                    );
                    console.log(actualFlat,typeof actualFlat)
                    console.log(expect,typeof expect)
                    assert.deepStrictEqual(actualFlat, expect);
                    console.log(`✅ 断言通过: ${JSON.stringify(expect)} == ${JSON.stringify(actualFlat)}`);
                } else {
                    // 单字段断言
                    const actualValue = actualRows[0][testItem.fields[0]];
                    assert.strictEqual(actualValue, expect);
                    console.log(`✅ 断言通过: "${expect}" == "${actualValue}"`);
                }
            } catch (error) {
                if (Array.isArray(expect)) {
                    const actualFlat = actualRows.map(row =>
                        testItem.fields.map(f => row[f])
                    );
                    console.error(`❌ 断言失败: ${JSON.stringify(expect)} == ${JSON.stringify(actualFlat)}`);
                } else {
                    const actualValue = actualRows[0][testItem.fields[0]];
                    console.error(`❌ 断言失败: ${expect} == ${actualValue}`);
                }
                console.error(`执行语句：[${query}]\n`);
            }
        });
    } catch (err) {
        console.error('❌ 请求失败:', err.message);
    }
}

runTestScript();
