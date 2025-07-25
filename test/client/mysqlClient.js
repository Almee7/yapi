const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../proto/mysql_service.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const dbProto = grpc.loadPackageDefinition(packageDefinition).db;

const client = new dbProto.MySQLService('localhost:50052', grpc.credentials.createInsecure());

client.Execute({ sql: 'SELECT userName FROM user WHERE userId = "444"' }, (err, res) => {
    if (err) return console.error('❌ gRPC Error:', err);

    try {
        const resultArr = JSON.parse(res.result);
        const value = resultArr?.[0]?.userName;
        console.log('✅ userName:', value); // 👈 只输出值，比如：破坏者
    } catch (e) {
        console.error('❌ Parse Error:', e);
    }
});
