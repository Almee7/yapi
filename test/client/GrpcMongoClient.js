const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

class GrpcMongoClient {
    /**
     * @param {object} options
     * @param {string} [options.address] - gRPC服务器地址，默认 localhost:50051
     * @param {string} [options.protoPath] - proto文件路径，默认 ../proto/db.proto
     * @param {number} [options.timeout] - 单次请求超时ms，默认10000ms
     * @param {(info:string)=>void} [options.logger] - 可选日志函数
     */
    constructor({
                    address = 'localhost:50051',
                    protoPath = path.join(__dirname, '../proto/db.proto'),
                    timeout = 10000,
                    logger = null
                } = {}) {
        const packageDefinition = protoLoader.loadSync(protoPath);
        const dbProto = grpc.loadPackageDefinition(packageDefinition).db;
        this.client = new dbProto.MongoService(address, grpc.credentials.createInsecure());
        this.timeout = timeout;
        this.logger = logger;
    }

    _log(msg) {
        if (this.logger) this.logger(msg);
    }

    /**
     * 内部请求包装，带超时和日志
     * @param {string} operation
     * @param {string} collection
     * @param {object|string} data
     * @returns {Promise<any>}
     */
    _request(operation, collection, data = {}) {

        if (typeof data !== 'string') data = JSON.stringify(data);
        this._log(`[GrpcMongoClient] Request: op=${operation}, collection=${collection}, data=${data}`);

        return new Promise((resolve, reject) => {
            const deadline = new Date(Date.now() + this.timeout);
            this.client.Execute({
                operation,
                collection,
                data
            }, { deadline }, (err, res) => {
                if (err) {
                    this._log(`[GrpcMongoClient] gRPC Error: ${err.message}`);
                    return reject(err);
                }
                if (!res.success) {
                    this._log(`[GrpcMongoClient] Operation failed: ${res.message}`);
                    return reject(new Error(res.message));
                }
                try {
                    const result = JSON.parse(res.result);
                    this._log(`[GrpcMongoClient] Response success, result count: ${Array.isArray(result) ? result.length : 1}`);
                    resolve(result);
                } catch (e) {
                    this._log(`[GrpcMongoClient] JSON parse error: ${e.message}`);
                    reject(new Error('响应 JSON 解析失败: ' + e.message));
                }
            });
        });
    }

    // ==== 基础CRUD ====

    /**
     * 查询多条，支持分页排序
     * @param {string} collection
     * @param {object} query - 查询条件，支持正则
     * @param {object} [options] - { skip, limit, sort }
     */
    async find(collection, query = {}, options = {}) {
        const { skip = 0, limit = 0, sort = {} } = options;

        // 传给服务端的data结构
        const payload = {
            query,
            options: {
                skip,
                limit,
                sort
            }
        };

        // 这里假设服务端扩展了支持复杂查询结构
        return this._request('find', collection, payload);
    }

    /**
     * 查询单条
     * @param {string} collection
     * @param {object} query
     */
    async findOne(collection, query = {}) {
        const results = await this.find(collection, query, { limit: 1 });
        return results[0] || null;
    }

    /**
     * 插入单条文档
     * @param {string} collection
     * @param {object} doc
     */
    async insert(collection, doc = {}) {
        return this._request('insert', collection, doc);
    }

    /**
     * 批量插入多条文档
     * @param {string} collection
     * @param {Array<object>} docs
     */
    async bulkInsert(collection, docs = []) {
        if (!Array.isArray(docs)) throw new Error('docs必须是数组');
        return this._request('bulkInsert', collection, docs);
    }

    /**
     * 更新文档（部分字段），支持多条
     * @param {string} collection
     * @param {object} filter - 查询过滤条件
     * @param {object} update - 更新操作，如 { $set: { a: 1 } }
     * @param {object} [options] - 可扩展，比如 upsert, multi
     */
    async update(collection, filter = {}, update = {}, options = {}) {
        const payload = { filter, update, options };
        return this._request('update', collection, payload);
    }

    /**
     * 删除文档
     * @param {string} collection
     * @param {object} filter
     * @param {object} [options] - 可扩展，比如 justOne
     */
    async remove(collection, filter = {}, options = {}) {
        const payload = { filter, options };
        return this._request('remove', collection, payload);
    }

    /**
     * 聚合查询，参数为 MongoDB 聚合管道数组
     * @param {string} collection
     * @param {Array<object>} pipeline
     */
    async aggregate(collection, pipeline = []) {
        if (!Array.isArray(pipeline)) throw new Error('pipeline必须是数组');
        return this._request('aggregate', collection, pipeline);
    }

    // 新增：获取自增序列
    async getNextSequence(counterName) {
        if (!counterName) throw new Error('counterName不能为空');
        const res = await this._request('getNextSequence', 'collection', { counterName });
        return res.seq;
    }

    // 新增：插入时自动带自增字段
    async insertWithAutoIncrement(collection, doc = {}, counterField, counterName) {
        if (!counterField || !counterName) {
            throw new Error('insertWithAutoIncrement 需要 counterField 和 counterName');
        }
        const seq = await this.getNextSequence(counterName);
        doc[counterField] = seq;
        return this.insert(collection, doc);
    }
}

module.exports = GrpcMongoClient;
