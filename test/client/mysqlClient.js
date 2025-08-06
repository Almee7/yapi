const axios = require('axios');
const assert = require('assert');
const yapi = require('../../server/yapi');

const testScript = [
    {
        dataSourceType: "NEO4J",
        fields: ["count"],
        query: 'MATCH (o:organize {id:"668525845e3aa161ce5fb244"}) RETURN o.count as count',
        expect: 15
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
    let baseUrl = yapi.WEBCONFIG.sqlServer
    const url = baseUrl + '/internal/loadAssertData'; // 请替换成你的接口地址
    console.log("url",url);
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
