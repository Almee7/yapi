const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.resolve(__dirname, '../../proto/db.proto');

// 加载 proto 文件
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const dbProto = grpc.loadPackageDefinition(packageDefinition).DatabaseService;

// 创建 gRPC 客户端（服务端运行在 50051 端口）
const client = new dbProto('localhost:50051', grpc.credentials.createInsecure());

/**
 * 执行 SQL 并返回结果
 * @param {string} sql SQL语句
 * @param {Array<string>} params 参数
 * @returns {Promise<Object>} 响应数据
 */
function executeSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        client.ExecuteSQL({ sql, params }, (error, response) => {
            if (error) {
                return reject(error);
            }
            if (!response.success) {
                return reject(new Error(response.message || 'SQL 执行失败'));
            }
            try {
                const data = response.dataJson ? JSON.parse(response.dataJson) : null;
                resolve(data);
            } catch (e) {
                reject(new Error('返回数据无法解析'));
            }
        });
    });
}

// 示例方法：初始化时清表
async function truncateTableIfExists(tableName) {
    const checkSql = `SHOW TABLES LIKE ?`;
    const result = await executeSQL(checkSql, [tableName]);
    if (result.length > 0) {
        await executeSQL(`TRUNCATE TABLE \`${tableName}\``);
    }
}

module.exports = {
    executeSQL,
    truncateTableIfExists
};
