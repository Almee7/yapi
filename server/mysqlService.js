const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const mysql = require('mysql2/promise');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../proto/mysql_service.proto');

// 加载 proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const dbProto = grpc.loadPackageDefinition(packageDefinition).db;

// 创建 MySQL 连接池
const pool = mysql.createPool({
    host: '192.168.6.203',
    user: 'xiaoming',
    password: 'one.2013',
    database: 'okr',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function execute(call, callback) {
    const { sql, params } = call.request;
    console.log('call.request', call.request);

    try {
        const [rows] = await pool.execute(sql, params);
        const resultStr = JSON.stringify(rows);
        callback(null, { success: true, result: resultStr, message: 'OK' });
    } catch (err) {
        callback(null, { success: false, result: '', message: err.message });
    }
}

function startServer() {
    const server = new grpc.Server();
    server.addService(dbProto.MySQLService.service, { Execute: execute });
    server.bindAsync('0.0.0.0:50052', grpc.ServerCredentials.createInsecure(), () => {
        console.log('✅ MySQL gRPC Server running at 0.0.0.0:50052');
        server.start();
    });
}

startServer();
