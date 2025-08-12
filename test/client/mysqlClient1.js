const assert = require('assert');
const axios = require("axios");

const testScript = [
    {
        dataSourceType: "NEO4J",
        fields: ["count"],
        query: 'MATCH (o:organize {id:"668525845e3aa161ce5fb244"}) RETURN o.count as count',
        expect: 14
    },
    {
        dataSourceType: "MARIADB",
        dataSourceName: "default",
        fields: ["orgName", "deptName"],
        query: 'SELECT orgName, deptName FROM organize_user WHERE userId="444"',
        expect: [
            ["学员", "第十九期"],
            ["狂派经理", "狂派事业部"]
        ]
    }
];
async function runTestScript() {
    const url = 'http://192.168.6.218:3399/internal/loadAssertData'; // 请替换成你的接口地址

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
