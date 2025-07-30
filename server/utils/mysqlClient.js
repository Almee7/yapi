// yap/server/utils/mysqlClient.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../../proto/mysql_service.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const dbProto = grpc.loadPackageDefinition(packageDefinition).db;

const client = new dbProto.MySQLService('localhost:50052', grpc.credentials.createInsecure());

/**
 * 执行 SQL，返回 Promise 解析结果数组
 * @param {string} sql
 * @returns {Promise<Array>}
 */
function execSql(sql) {
    return new Promise((resolve, reject) => {
        client.Execute({ sql }, (err, res) => {
            if (err) return reject(err);

            const raw = res && res.result;

            console.log('🟡 执行 SQL：', sql);
            console.log('🟡 gRPC 返回结果：', raw);

            try {
                if (!raw || typeof raw !== 'string' || raw.trim() === '') {
                    throw new Error('gRPC 返回了空或非法 JSON');
                }

                const parsed = JSON.parse(raw);

                if (!Array.isArray(parsed) || parsed.length === 0) {
                    throw new Error('SQL 返回为空数组');
                }

                const row = parsed[0];
                if (typeof row !== 'object') {
                    throw new Error('SQL 行数据格式非法');
                }

                const values = Object.values(row); // ✅ 提取 value 数组
                console.log('✅ SQL 返回值：', values);
                resolve(values); // ✅ 返回纯值数组

            } catch (e) {
                console.error('❌ SQL 结果解析失败:', e.message);
                reject(e);
            }
        });
    });
}

module.exports = {
    execSql
};