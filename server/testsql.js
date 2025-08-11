const { execSql } = require('./utils/mysqlClient');

async function runAssert(context, body) {
    // 执行 SQL
    const result = await execSql('SELECT userName FROM user WHERE userId = "444"');
    // 取值并存变量
    context.vars = context.vars || {};
    context.vars.userName = result?.[0]?.userName;

    // 断言接口返回值和数据库一致
    assert.equal(body.userName, context.vars.userName);
}

module.exports = { runAssert };
