// client.js
const grpc = require('@grpc/grpc-js');
const { GrpcAgentServiceClient } = require('./mysql_service_grpc_pb');
const { AgentRequest } = require('./mysql_service_pb');
const yapi = require('../yapi.js');


class GrpcAgentClient {
    /**
     * 构造函数，初始化客户端
     */
    constructor() {
        const address = yapi.WEBCONFIG.sqlServer
        this.client = new GrpcAgentServiceClient(address, grpc.credentials.createInsecure());
    }

    /**
     * 发送请求调用 invoke 方法
     * @param {Object|Array} paramsObj - 要传递的参数对象或数组，内部自动序列化为 JSON 字符串并转 Buffer
     * @returns {Promise<Object|string>} - 解析后的 JSON 对象或字符串结果
     */
    invoke(paramsObj) {
        console.log("paramsObj",paramsObj);
        return new Promise((resolve, reject) => {
            const request = new AgentRequest();
            // 去掉 expect 字段
            const newParamsObj = Array.isArray(paramsObj)
                // eslint-disable-next-line no-unused-vars
                ? paramsObj.map(({ expect, ...rest }) => rest)
                // eslint-disable-next-line no-unused-vars
                : (() => { const { expect, ...rest } = paramsObj; return rest; })();
            const paramsBuffer = Buffer.from(JSON.stringify(newParamsObj));
            request.setParams(paramsBuffer);
            request.setUrl('/internal/loadAssertData');
            request.setMethodtype('POST');

            this.client.invoke(request, (error, response) => {
                if (error) {
                    return reject(error);
                }

                try {
                    const rawData = response.getDatabody();

                    let buffer;
                    if (typeof rawData === 'string') {
                        buffer = Buffer.from(rawData, 'base64');
                    } else if (rawData instanceof Uint8Array) {
                        buffer = Buffer.from(rawData);
                    } else {
                        throw new Error('Unexpected dataBody type');
                    }

                    const dataStr = buffer.toString('utf-8');

                    try {
                        const dataJson = JSON.parse(dataStr);
                        resolve(dataJson);
                    } catch (e) {
                        resolve(dataStr);
                    }
                } catch (e) {
                    reject(new Error('dataBody 解析失败: ' + e.message));
                }
            });
        });
    }
}

module.exports = {
    GrpcAgentClient
};
