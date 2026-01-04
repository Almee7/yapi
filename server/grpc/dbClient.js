// client.js
const grpc = require('@grpc/grpc-js');
const { GrpcAgentServiceClient } = require('./mysql_service_grpc_pb');
const { AgentRequest } = require('./mysql_service_pb');
const yapi = require('../yapi.js');


class GrpcAgentClient {
    /**
     * @param {string} serverName - 前端传入的 serverName，例如 'okr' 或 'xpa'
     */
    constructor(serverName) {
        this.serverName = serverName;
        if (!serverName) {
            throw new Error('serverName 必须传入');
        }
        // 根据 serverName 选择不同配置
        let address;
        if (serverName.includes('okr')) {
            address = yapi.WEBCONFIG.okrServer;
        } else if (serverName.includes('xpa')) {
            address = yapi.WEBCONFIG.xpaServer;
        } else {
            throw new Error(`未知 serverName: ${serverName}`);
        }
        if (!address) {
            throw new Error(`未配置对应的 gRPC 地址: ${serverName}`);
        }
        this.address = address;
        console.log(`gRPC 服务器地址: ${this.address}`)
        this.client = new GrpcAgentServiceClient(
            this.address,
            grpc.credentials.createInsecure()
        );
        const deadline = Date.now() + 5000; // 5 秒超时
        this.client.waitForReady(deadline, (err) => {
            if (err) {
                console.error(
                    `❌ [gRPC] 连接失败: ${this.address}`,
                    err.message
                );
            } else {
                console.log(
                    `✅ [gRPC] 连接成功: ${this.address}`
                );
            }
        });
    }

    /**
     * 发送请求调用 invoke 方法
     * @param {Object|Array} paramsObj - 要传递的参数对象或数组，内部自动序列化为 JSON 字符串并转 Buffer
     * @returns {Promise<Object|string>} - 解析后的 JSON 对象或字符串结果
     */
    invoke(paramsObj) {
        console.log('🛰️ gRPC invoke 入参:', paramsObj);

        return new Promise((resolve, reject) => {
            const request = new AgentRequest();

            // 去掉 expect 字段
            const newParamsObj = Array.isArray(paramsObj)
                ? paramsObj.map(({expect, ...rest}) => {
                    // eslint-disable-next-line no-unused-vars
                    const _ = expect; // Mark expect as intentionally unused
                    return rest;
                })
                : (() => {
                    // eslint-disable-next-line no-unused-vars
                    const {expect, ...rest} = paramsObj;
                    return rest;
                })();

            const paramsBuffer = Buffer.from(JSON.stringify(newParamsObj));
            request.setParams(paramsBuffer);

            // 请求路径
            const urlPath = '/internal/loadAssertData';
            request.setUrl(urlPath);
            request.setMethodtype('POST');

            // ✅ 打印完整请求 URL
            const fullUrl = `${this.address}${urlPath}`;
            console.log(`🚀 [GrpcAgentClient.invoke] 请求 URL: ${fullUrl}`);
            console.log(`📦 请求 Method: POST`);
            console.log(`📨 请求 Body:`, JSON.stringify(newParamsObj, null, 2));

            this.client.invoke(request, (error, response) => {
                if (error) {
                    console.error('❌ gRPC 调用失败:', error);
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
                        console.log('✅ gRPC 响应(JSON):', dataJson);
                        resolve(dataJson);
                    } catch (e) {
                        console.log('✅ gRPC 响应(字符串):', dataStr);
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
