const GrpcMongoClient = require('./GrpcMongoClient');

(async () => {
    const client = new GrpcMongoClient({
        address: 'localhost:50051',
        timeout: 15000,
        logger: console.log
    });

    try {
        const users = await client.find('user', { username: 'admin' });
        console.log('✅ 查询成功:', users);
    } catch (err) {
        console.error('❌ 查询失败:', err.message);
    }
})();
