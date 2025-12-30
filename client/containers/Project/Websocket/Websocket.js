import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { useParams, useHistory } from 'react-router-dom';
import './Websocket.scss';

export default function WebsocketDetail() {
    const { connectionId, id } = useParams(); // 从路由参数获取 connectionId 和项目 id
    const history = useHistory();
    const [tab, setTab] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const wsRef = useRef(null);
    


// 初始化加载连接信息 & 建立 WS 代理
useEffect(() => {
    const fetchConnection = async () => {
        try {
            const res = await axios.get('/api/ws-test/list');
            const list = (res && res.data && res.data.body && res.data.body.list) || [];
            const currentTab = list.find(item => item.connectionId === connectionId);
            setTab(currentTab || null);
        } catch (err) {
            console.error('获取连接失败', err);
        } finally {
            setLoading(false);
        }
    };

    fetchConnection();

    const ws = new WebSocket('ws://localhost:3000/api/ws-test/frontend');

    ws.onopen = () => console.log('已连接到 Node.js 代理 WS');

    ws.onmessage = (event) => {
        try {
            const { connectionId: msgId, data } = JSON.parse(event.data);
            if (msgId === connectionId) {
                setTab(prev => {
                    if (!prev) return prev;
                    const newMessages = prev.messages ? [...prev.messages] : [];
                    // 后端已经过滤了 ping/pong，直接添加消息
                    if (data.type === 'message') {
                        newMessages.push(data.message);
                    }
                    return {
                        ...prev,
                        messages: newMessages,
                        status: data.type === 'status' ? data.status : prev.status
                    };
                });
            }
        } catch (err) {
            console.error('解析 WS 消息失败', err);
        }
    };

    ws.onclose = () => console.log('前端代理 WS 已关闭');

    wsRef.current = ws;

    return () => ws.close();
}, [connectionId]);



// 断开连接
const disconnect = async () => {
    try {
        await axios.post('/api/ws-test/disconnect', { connectionId });
        setTab(prev => prev ? { ...prev, status: 'closed' } : prev);
    } catch (err) {
        console.error('断开连接失败', err);
    }
};

// 重新连接
const connect = async () => {
    try {
        if (!tab) return;
        const res = await axios.post('/api/ws-test/connect', {
            url: tab.url,
            headers: tab.headers || {},
            query: tab.query || {}
        });
        
        // 重连成功后会生成新的 connectionId，需要跳转到新的详情页
        const newConnectionId = res.data && res.data.body && res.data.body.connectionId;
        if (newConnectionId) {
            alert('重连成功，将跳转到新连接详情页');
            history.push(`/project/${id}/websocket/${newConnectionId}`);
        } else {
            setTab(prev => prev ? { ...prev, status: 'open' } : prev);
        }
    } catch (err) {
        console.error('重新连接失败', err);
        const errorMsg = err.response && err.response.data && err.response.data.body && err.response.data.body.tips 
            ? err.response.data.body.tips 
            : err.message;
        alert('重新连接失败: ' + errorMsg);
    }
};

// 返回列表页
const goBack = () => {
    history.push(`/project/${id}/websocket`);
};

// 发送消息
const sendMessage = () => {
    if (!message.trim() || !tab) return;
    if (wsRef.current) {
        wsRef.current.send(JSON.stringify({ connectionId, message }));
    }
    setTab(prev => prev ? { ...prev, messages: [...(prev.messages || []), message] } : prev);
    setMessage('');
};

if (loading) return <div className="empty">加载中...</div>;
if (!tab) return <div className="empty">未找到该连接</div>;

return (
  <div className="ws-detail-page">
    {/* 返回按钮 */}
    <div className="back-button-wrapper">
      <button className="back-btn" onClick={goBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        返回管理中心
      </button>
    </div>

    {/* 头部信息区域 */}
    <div className="header-section">
      <h2 className="page-title">WebSocket 连接详情</h2>
      <div className="info-cards">
        <div className="info-card">
          <div className="info-label">连接地址</div>
          <div className="info-value">{tab.url}</div>
        </div>
        <div className="info-card">
          <div className="info-label">Cookie ID</div>
          <div className="info-value">{tab.headers.cookieId}</div>
        </div>
        <div className="info-card">
          <div className="info-label">连接状态</div>
          <div className={`status-badge ${tab.status === 'open' ? 'closed' : 'open'}`}>
            {tab.status === 'open' ? '已连接' : '已断开'}
          </div>
        </div>
      </div>
    </div>

    {/* 参数信息 */}
    <div className="params-section">
      <div className="section-title">连接参数</div>
      <div className="params-content">
        <pre>{JSON.stringify(tab.headers || {}, null, 2)}</pre>
      </div>
    </div>

    {/* 主要内容区域 */}
    <div className="main-content">
      {/* 左侧消息日志 */}
      <div className="logs-section">
        <div className="section-header">
          <span className="section-title">消息日志</span>
          <span className="message-count">{(tab.messages || []).length} 条消息</span>
        </div>
        <div className="logs-container">
          {(tab.messages || []).length === 0 ? (
            <div className="empty-logs">暂无消息</div>
          ) : (
            [...(tab.messages || [])].reverse().map((msg, idx) => (
              <div key={idx} className="log-item">
                <span className="log-index">[{(tab.messages || []).length - idx}]</span>
                <span className="log-content">{msg}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右侧操作区域 */}
      <div className="action-section">
        {/* 发送消息 */}
        <div className="send-box">
          <div className="section-title">发送消息</div>
          <div className="input-group">
            <textarea
              className="message-input"
              placeholder="输入要发送的消息内容..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={4}
            />
            <button 
              className="send-btn" 
              onClick={sendMessage}
              disabled={!message.trim() || tab.status !== 'open'} 
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
              发送消息
            </button>
          </div>
        </div>

        {/* 连接控制 */}
        <div className="control-box">
          <div className="section-title">连接控制</div>
          {tab.status === 'open' ? (
            <button
                className="disconnect-btn"
                onClick={disconnect}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
              断开连接
            </button>
          ) : (
            <button 
              className="connect-btn" 
              onClick={connect}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              重新连接
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);


}

// PropTypes 声明
WebsocketDetail.propTypes = {
    match: PropTypes.object
};
