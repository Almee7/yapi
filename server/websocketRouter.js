// websocketRouter.js
const Router = require('koa-router');
const WsTestController = require('./controllers/wsTest'); // 你的 WS 控制器

// 注意 koa-websocket 会在 ctx.websocket 注入 websocket 对象
const wsRouter = new Router({ prefix: '/api/ws-test' });

/**
 * 前端 WS 接口
 * 浏览器访问：ws://localhost:3000/api/ws-test/frontend
 */
wsRouter.get('/frontend', async (ctx, next) => {
    WsTestController.frontendWs(ctx);
    await next();
});


module.exports = wsRouter;
