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
            try {
                resolve(JSON.parse(res.result));
            } catch (e) {
                reject(e);
            }
        });
    });
}

module.exports = {
    execSql,
};
