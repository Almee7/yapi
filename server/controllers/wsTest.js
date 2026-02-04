const baseController = require("./base");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const wsConnections = new Map(); // 后端代理出去的目标 WS 连接
const clients = new Set(); // 前端调试页面的 WS

class WsTestController extends baseController {
    /**
     * 前端 WebSocket 连接（浏览器页面用）
     * ws://localhost:3000/api/ws-test/frontend
     */
    static frontendWs(ctx) {
        clients.add(ctx.websocket);
        
        // 监听前端发来的消息，转发到目标 WebSocket
        ctx.websocket.on("message", (data) => {
            try {
                const { connectionId, message } = JSON.parse(data);
                const conn = wsConnections.get(connectionId);
                
                if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
                    // 转发消息到目标 WebSocket
                    conn.ws.send(message);
                    // 可选：将发送的消息也存储到消息列表中
                    // conn.messages.push(`[发送] ${message}`);
                }
            } catch (err) {
                console.error("转发消息失败:", err);
            }
        });
        
        ctx.websocket.on("close", () => clients.delete(ctx.websocket));
    }

    /**
     * 广播消息给所有前端调试页面
     */
    static broadcastToFrontend(connectionId, data) {
        const payload = JSON.stringify({ connectionId, data });
        clients.forEach(ws => {
            if (ws.readyState === ws.OPEN) {
                ws.send(payload);
            }
        });
    }

    /**
     * 创建/连接到一个目标 WebSocket
     * POST /api/ws-test/connect
     * body: { url, headers, query }
     */
    async connect(ctx) {
        const { url, headers = {}, query = {}, caseId = null, caseName = '' } = ctx.request.body;
        if (!url) {
            ctx.body = this._response(false, {}, { tips: "缺少 url 参数" }, 400, "Bad Request", 0);
            return;
        }

        const connectionId = uuidv4();
        // 检测URL是否已包含查询参数，避免重复拼接
        let wsUrl = url;
        if (Object.keys(query).length) {
            const separator = url.includes('?') ? '&' : '?';
            wsUrl = url + separator + new URLSearchParams(query).toString();
        }
        const ws = new WebSocket(wsUrl, { headers });

        let seq = 1;
        let pingInterval = null;
        let pongTimeout = null;

        const connectionData = {
            ws,
            url: wsUrl,
            headers,
            query,
            messages: [],
            status: "connecting",
            pingInterval,
            pongTimeout,
            caseId,      // 关联的用例 ID
            caseName     // 关联的用例名称
        };

        ws.on("open", () => {
            connectionData.status = "open";
            WsTestController.broadcastToFrontend(connectionId, { type: "status", status: "open" });

            // 定时 ping/pong
            pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    const data = { action: "ping", data: {}, seq: seq++ };
                    ws.send(JSON.stringify(data));
                    // ping 消息不广播到前端，避免干扰
                    // WsTestController.broadcastToFrontend(connectionId, { type: "send", message: JSON.stringify(data) });

                    if (pongTimeout) clearTimeout(pongTimeout);
                    pongTimeout = setTimeout(() => {
                        WsTestController.broadcastToFrontend(connectionId, { type: "status", status: "pong timeout" });
                        ws.terminate();
                    }, 15000);
                }
            }, 5000);
            connectionData.pingInterval = pingInterval;
        });

        ws.on("message", (msg) => {
            const text = msg.toString();
            
            // 过滤 ping/pong 消息，不存储到 messages 中
            let shouldFilter = false;
            try {
                const parsed = JSON.parse(text);
                // 过滤格式: { data: { text: "pong" } } 或 { data: { text: "ping" } }
                if (parsed && parsed.data && (parsed.data.text === "pong" || parsed.data.text === "ping")) {
                    shouldFilter = true;
                    // pong 消息用于清除超时
                    if (parsed.data.text === "pong" && pongTimeout) {
                        clearTimeout(pongTimeout);
                    }
                }
            } catch (_) { /* ignore */ }

            // 只有非 ping/pong 消息才存储和广播
            if (!shouldFilter) {
                connectionData.messages.push(text);
                WsTestController.broadcastToFrontend(connectionId, { type: "message", message: text });
            }
        });

        ws.on("close", () => {
            connectionData.status = "closed";
            WsTestController.broadcastToFrontend(connectionId, { type: "status", status: "closed" });
            cleanup(connectionData);
        });

        ws.on("error", (err) => {
            connectionData.status = "error";
            WsTestController.broadcastToFrontend(connectionId, { type: "status", status: "error", error: err.message });
            cleanup(connectionData);
        });

        wsConnections.set(connectionId, connectionData);

        ctx.body = this._response(true, {}, {
            connectionId,
            url: wsUrl,
            tips: "WebSocket 连接已建立，详细信息可在标签页查看"
        }, 200, "Switching Protocols", 0);
    }

    /**
     * 获取某个连接详情
     * GET /api/ws-test/:connectionId
     */
    async getConnection(ctx) {
        const conn = wsConnections.get(ctx.params.connectionId);
        if (!conn) {
            ctx.body = this._response(false, {}, { tips: "连接不存在" }, 404, "Not Found", 0);
            return;
        }
        ctx.body = this._response(true, {}, {
            connectionId: ctx.params.connectionId,
            url: conn.url,
            headers: conn.headers,
            query: conn.query,
            status: conn.status,
            messages: conn.messages
        }, 200, "OK", 0);
    }

    /**
     * 获取所有连接
     * GET /api/ws-test/list
     */
    async list(ctx) {
        const connectionMap = new Map(); // 用于存储 url+cookieId -> 连接信息

        for (const [id, conn] of wsConnections.entries()) {
            // 从 headers中获取cookie，提取cookieId
            const cookieHeader = conn.headers && conn.headers.cookieId ? conn.headers.cookieId : '';
            const cookieId = cookieHeader || 'no-cookie';
            
            // 组合url和cookieId作为唯一键
            const uniqueKey = `${conn.url}|${cookieId}`;
            
            const existing = connectionMap.get(uniqueKey);
            
            // 如果还没有这个key，或者当前连接是open状态而旧的不是，则替换
            if (!existing || (conn.status === 'open' && existing.status !== 'open')) {
                connectionMap.set(uniqueKey, {
                    connectionId: id,
                    url: conn.url,
                    headers: conn.headers,
                    query: conn.query,
                    status: conn.status,
                    messages: conn.messages,
                    caseId: conn.caseId,
                    caseName: conn.caseName
                });
            }
        }

        const list = Array.from(connectionMap.values());
        ctx.body = this._response(true, {}, { list, tips: "当前连接列表" }, 200, "OK", 0);
    }

    /**
     * 断开某个连接
     * DELETE /api/ws-test/:connectionId
     */
    async disconnect(ctx) {
        const conn = wsConnections.get(ctx.params.connectionId);
        if (!conn) {
            ctx.body = this._response(false, {}, { tips: "连接不存在" }, 404, "Not Found", 0);
            return;
        }
        cleanup(conn);
        conn.ws.close();
        wsConnections.delete(ctx.params.connectionId);
        ctx.body = this._response(true, {}, {
            connectionId: ctx.params.connectionId,
            tips: "WebSocket 连接已断开"
        }, 200, "OK", 0);
    }

    /**
     * 读取 WebSocket 消息日志
     * @param {string} connectionId - 连接ID
     * @param {object} options - 配置选项
     * @param {number} options.count - 返回消息条数，默认1（最新一条），0表示全部
     * @param {string} options.action - 按action类型过滤，如"hello"、"ping"等
     * @param {number} options.delay - 等待延迟（毫秒），默认2000
     * @returns {Promise<Array|Object|null>} 返回消息数组或单条消息或null
     */
    static async readws(connectionId, options = {}) {
        const { count = 1, action = null } = options;
        
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        await wait(2000);
        
        const conn = wsConnections.get(connectionId);
        if (!conn) return null;
        
        let messages = conn.messages || [];
        
        // 按 action 类型过滤
        if (action) {
            messages = messages.filter(msg => {
                try {
                    const parsed = JSON.parse(msg);
                    return parsed.action === action;
                } catch (e) {
                    return false;
                }
            });
        }
        
        // 根据 count 返回对应数量的消息
        if (count === 0) {
            // 返回全部消息
            return messages;
        } else if (count === 1) {
            // 返回最新一条
            return messages.length > 0 ? messages[messages.length - 1] : null;
        } else {
            // 返回最新 N 条
            return messages.slice(-count);
        }
    }

    /**
     * 统一返回格式
     */
    _response(success, header = {}, body = {}, code = 200, statusText = "OK", runTime = 0) {
        return { success, header, body, code, statusText, runTime };
    }
}

/**
 * 清理定时器
 */
function cleanup(conn) {
    if (conn.pingInterval) clearInterval(conn.pingInterval);
    if (conn.pongTimeout) clearTimeout(conn.pongTimeout);
    conn.pingInterval = null;
    conn.pongTimeout = null;
}

module.exports = WsTestController;
