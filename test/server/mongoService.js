const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { MongoClient } = require('mongodb');
const path = require('path');

const MONGO_URL = 'mongodb://root:root@127.0.0.1:27017/'; // 改成你自己的
const DB_NAME = 'yapi';

const PROTO_PATH = path.join(__dirname, '../proto/db.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const dbProto = grpc.loadPackageDefinition(packageDefinition).db;


async function getNextSequence(counterName, db) {
    const counters = db.collection('counters');
    const ret = await counters.findOneAndUpdate(
        { _id: counterName },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true }
    );
    return ret.value.seq;
}

async function executeMongo(call, callback) {
    const { operation, collection, data } = call.request;

    let client;
    try {
        client = new MongoClient(MONGO_URL, { useUnifiedTopology: true });
        await client.connect();
        const db = client.db(DB_NAME);
        const col = db.collection(collection);

        let payload = {};
        if (data) {
            try {
                payload = JSON.parse(data);
            } catch (e) {
                return callback(null, {
                    success: false,
                    message: '传入参数 JSON 解析失败: ' + e.message,
                    result: ''
                });
            }
        }

        if (operation === 'getNextSequence') {
            if (!payload.counterName) {
                return callback(null, {
                    success: false,
                    message: 'getNextSequence 需要 counterName 参数',
                    result: ''
                });
            }
            const seq = await getNextSequence(payload.counterName, db);
            return callback(null, {
                success: true,
                message: '获取自增序列成功',
                result: JSON.stringify({ seq })
            });
        }

        let result;

        switch (operation) {
            case 'find': {
                // 支持 { query: {}, options: { skip, limit, sort } }
                const query = payload.query || {};
                const options = payload.options || {};
                const cursor = col.find(query);

                if (options.sort) cursor.sort(options.sort);
                if (options.skip) cursor.skip(options.skip);
                if (options.limit) cursor.limit(options.limit);

                result = await cursor.toArray();
                break;
            }
            case 'insert': {
                // payload 是单个文档
                result = await col.insertOne(payload);
                break;
            }
            case 'bulkInsert': {
                // payload 是文档数组
                if (!Array.isArray(payload)) {
                    return callback(null, {
                        success: false,
                        message: 'bulkInsert 需要数组类型参数',
                        result: ''
                    });
                }
                result = await col.insertMany(payload);
                break;
            }
            case 'update': {
                // payload { filter, update, options }
                if (!payload.filter || !payload.update) {
                    return callback(null, {
                        success: false,
                        message: 'update 需要 filter 和 update 字段',
                        result: ''
                    });
                }
                const options = payload.options || {};
                result = await col.updateMany(payload.filter, payload.update, options);
                break;
            }
            case 'remove': {
                // payload { filter, options }
                if (!payload.filter) {
                    return callback(null, {
                        success: false,
                        message: 'remove 需要 filter 字段',
                        result: ''
                    });
                }
                const options = payload.options || {};
                if (options.justOne) {
                    result = await col.deleteOne(payload.filter);
                } else {
                    result = await col.deleteMany(payload.filter);
                }
                break;
            }
            case 'aggregate': {
                // payload 是聚合管道数组
                if (!Array.isArray(payload)) {
                    return callback(null, {
                        success: false,
                        message: 'aggregate 需要数组类型的聚合管道',
                        result: ''
                    });
                }
                result = await col.aggregate(payload).toArray();
                break;
            }
            default:
                return callback(null, {
                    success: false,
                    message: `不支持的操作类型: ${operation}`,
                    result: ''
                });
        }

        return callback(null, {
            success: true,
            message: '操作成功',
            result: JSON.stringify(result)
        });
    } catch (err) {
        return callback(null, {
            success: false,
            message: '服务端异常: ' + err.message,
            result: ''
        });
    } finally {
        if (client) await client.close();
    }
}

// 启动 gRPC 服务
function main() {
    const server = new grpc.Server();
    server.addService(dbProto.MongoService.service, { Execute: executeMongo });

    const port = '0.0.0.0:50051';
    server.bindAsync(port, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            console.error('gRPC 绑定端口失败:', err);
            return;
        }
        server.start();
        console.log(`✅ MongoDB gRPC 服务启动成功，监听端口: ${port}`);
    });
}

main();
