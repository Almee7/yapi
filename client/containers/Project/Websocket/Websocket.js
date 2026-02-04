import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { useParams, useHistory } from 'react-router-dom';
import { message as antdMessage, Modal, Input } from 'antd';
import './Websocket.scss';

// localStorage key for saved messages
const SAVED_MESSAGES_KEY = 'ws_saved_messages';

export default function WebsocketDetail() {
    const { connectionId, id } = useParams(); // 从路由参数获取 connectionId 和项目 id
    const history = useHistory();
    const [tab, setTab] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [savedMessages, setSavedMessages] = useState([]);
    const wsRef = useRef(null);
    
    // 备注弹窗状态
    const [remarkModalVisible, setRemarkModalVisible] = useState(false);
    const [remarkText, setRemarkText] = useState('');
    const [pendingSaveData, setPendingSaveData] = useState(null); // { content, msgType }

    // 加载已保存的消息
    useEffect(() => {
        try {
            const saved = localStorage.getItem(SAVED_MESSAGES_KEY);
            if (saved) {
                setSavedMessages(JSON.parse(saved));
            }
        } catch (e) {
            console.error('加载已保存消息失败', e);
        }
    }, []);
    


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
                        newMessages.push({ content: data.message, type: 'received' });
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
        // 判断URL是否已包含查询参数，避免重复拼接
        const urlHasQuery = tab.url && tab.url.includes('?');
        const res = await axios.post('/api/ws-test/connect', {
            url: tab.url,
            headers: tab.headers || {},
            query: urlHasQuery ? {} : (tab.query || {}),  // URL已含参数则不传query
            caseId: tab.caseId || null,      // 保留用例关联
            caseName: tab.caseName || ''     // 保留用例名称
        });
        
        // 重连成功后会生成新的 connectionId，需要跳转到新的详情页
        const newConnectionId = res.data && res.data.body && res.data.body.connectionId;
        if (newConnectionId) {
            antdMessage.success('重连成功', 1.5);
            // 先设置 loading，然后柔和跳转
            setLoading(true);
            setTab(null);
            history.replace(`/project/${id}/websocket/${newConnectionId}`);
        } else {
            setTab(prev => prev ? { ...prev, status: 'open' } : prev);
        }
    } catch (err) {
        const errorMsg = err.response && err.response.data && err.response.data.body && err.response.data.body.tips 
            ? err.response.data.body.tips 
            : err.message;
        antdMessage.error('重新连接失败: ' + errorMsg, 1.5);
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
    setTab(prev => prev ? { ...prev, messages: [...(prev.messages || []), { content: message, type: 'sent' }] } : prev);
    setMessage('');
};

// 发送消息并保存
const sendAndSave = () => {
    if (!message.trim() || !tab) return;
    // 先发送消息
    if (wsRef.current) {
        wsRef.current.send(JSON.stringify({ connectionId, message }));
    }
    setTab(prev => prev ? { ...prev, messages: [...(prev.messages || []), { content: message, type: 'sent' }] } : prev);
    
    // 检查是否已存在相同内容
    const exists = savedMessages.some(item => item.content === message);
    if (exists) {
        antdMessage.warning('该消息已保存过，无需重复保存', 1.5);
        setMessage('');
        return;
    }
    
    // 保存消息到本地存储
    const newSaved = {
        id: Date.now(),
        content: message,
        time: new Date().toLocaleString(),
        url: tab.url
    };
    const updated = [newSaved, ...savedMessages].slice(0, 50); // 最多保存50条
    setSavedMessages(updated);
    try {
        localStorage.setItem(SAVED_MESSAGES_KEY, JSON.stringify(updated));
        antdMessage.success('消息已保存', 1.5);
    } catch (e) {
        console.error('保存消息失败', e);
    }
    setMessage('');
};

// 复制消息到剪贴板
const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        antdMessage.success('已复制到剪贴板', 1.5);
    }).catch(err => {
        console.error('复制失败', err);
        antdMessage.error('复制失败', 1.5);
    });
};

// 使用已保存的消息（填充到输入框）
const useMessage = (text) => {
    setMessage(text);
};

// 删除已保存的消息
const deleteSavedMessage = (msgId) => {
    const updated = savedMessages.filter(m => m.id !== msgId);
    setSavedMessages(updated);
    try {
        localStorage.setItem(SAVED_MESSAGES_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error('删除消息失败', e);
    }
};

// 打开备注弹窗（保存到用例前）
const openRemarkModal = (content, msgType = 'log') => {
    if (!tab || !tab.caseId) {
        antdMessage.warning('该连接未关联测试用例', 1.5);
        return;
    }
    setPendingSaveData({ content, msgType });
    setRemarkText('');
    setRemarkModalVisible(true);
};

// 确认保存（带备注）
const confirmSaveToCase = async () => {
    if (!pendingSaveData) return;
    
    try {
        const res = await axios.post('/api/col/add_ws_message', {
            id: Number(tab.caseId),
            content: pendingSaveData.content,
            type: pendingSaveData.msgType,
            remark: remarkText.trim()
        });
        if (res.data.errcode) {
            if (res.data.errmsg.includes('已存在')) {
                antdMessage.warning('该内容已存在于用例中，无需重复保存', 1.5);
            } else {
                antdMessage.error(res.data.errmsg, 1.5);
            }
        } else {
            antdMessage.success(`已保存到用例 [${tab.caseName || tab.caseId}]`, 1.5);
        }
    } catch (err) {
        console.error('保存到用例失败', err);
        antdMessage.error('保存失败: ' + (err.message || '未知错误'), 1.5);
    }
    
    setRemarkModalVisible(false);
    setPendingSaveData(null);
    setRemarkText('');
};

// 保存消息到关联用例（弹出备注输入框）
const saveToCase = (content, msgType = 'log') => {
    openRemarkModal(content, msgType);
};

// 未找到连接时自动返回管理中心
useEffect(() => {
    if (!loading && !tab) {
        const timer = setTimeout(() => {
            history.push(`/project/${id}/websocket`);
        }, 2000); // 2秒后自动返回
        return () => clearTimeout(timer);
    }
}, [loading, tab, history, id]);

if (loading) return <div className="empty">加载中...</div>;
if (!tab) return (
  <div className="empty">
    <div>未找到该连接，2秒后自动返回管理中心...</div>
  </div>
);

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
          <div className="info-value">{tab.headers.cookieId || '-'}</div>
        </div>
        {tab.caseId && (
          <div className="info-card case-card">
            <div className="info-label">关联用例</div>
            <div className="info-value">
              <span className="case-name">{tab.caseName || `用例 ${tab.caseId}`}</span>
              <span className="case-id">Key: {tab.caseId}</span>
            </div>
          </div>
        )}
        <div className="info-card status-card">
          <div className="info-label">连接状态</div>
          <div className="status-row">
            <div className={`status-badge ${tab.status === 'open' ? 'connected' : 'disconnected'}`}>
              {tab.status === 'open' ? '已连接' : '已断开'}
            </div>
            {tab.status === 'open' ? (
              <button className="control-btn disconnect" onClick={disconnect}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
                断开
              </button>
            ) : (
              <button className="control-btn connect" onClick={connect}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                重连
              </button>
            )}
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
            [...(tab.messages || [])].reverse().map((msg, idx) => {
              // 兼容旧格式（纯字符串）和新格式（对象）
              const isObject = typeof msg === 'object' && msg !== null;
              const content = isObject ? msg.content : msg;
              const msgType = isObject ? msg.type : 'received';
              return (
                <div key={idx} className={`log-item ${msgType}`}>
                  <div className="log-main">
                    <span className="log-index">[{(tab.messages || []).length - idx}]</span>
                    <span className="log-content">{content}</span>
                  </div>
                  <div className="log-actions">
                    <button className="log-action-btn" onClick={() => copyToClipboard(content)} title="复制">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                      </svg>
                    </button>
                    {tab.caseId && (
                      <button className="log-action-btn save-case" onClick={() => saveToCase(content, msgType)} title="保存到用例">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
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
            <div className="btn-group">
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
              <button 
                className="send-btn save-btn" 
                onClick={sendAndSave}
                disabled={!message.trim() || tab.status !== 'open'}
                title="发送消息并保存到本地，方便下次复用"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                </svg>
                发送并保存
              </button>
            </div>
          </div>
        </div>

        {/* 已保存的消息 */}
        <div className="saved-box">
          <div className="section-title">已保存的消息 <span className="count">({savedMessages.length})</span></div>
          <div className="saved-list">
            {savedMessages.length === 0 ? (
              <div className="empty-saved">暂无保存的消息</div>
            ) : (
              savedMessages.map(item => (
                <div key={item.id} className="saved-item">
                  <div className="saved-content" title={item.content}>
                    {item.content.length > 50 ? item.content.slice(0, 50) + '...' : item.content}
                  </div>
                  <div className="saved-actions">
                    <button className="action-btn use" onClick={() => useMessage(item.content)} title="使用此消息">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                      </svg>
                    </button>
                    <button className="action-btn copy" onClick={() => copyToClipboard(item.content)} title="复制">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                      </svg>
                    </button>
                    {tab.caseId && (
                      <button className="action-btn save-case" onClick={() => saveToCase(item.content, 'sent')} title="保存到用例">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                        </svg>
                      </button>
                    )}
                    <button className="action-btn delete" onClick={() => deleteSavedMessage(item.id)} title="删除">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>

    {/* 备注输入弹窗 */}
    <Modal
      title="保存到用例"
      visible={remarkModalVisible}
      onOk={confirmSaveToCase}
      onCancel={() => {
        setRemarkModalVisible(false);
        setPendingSaveData(null);
        setRemarkText('');
      }}
      okText="保存"
      cancelText="取消"
      width={500}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 8, color: '#666' }}>消息内容：</div>
        <div style={{ 
          background: '#f5f5f5', 
          padding: '8px 12px', 
          borderRadius: 4, 
          maxHeight: 120, 
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: 12,
          wordBreak: 'break-all'
        }}>
          {pendingSaveData && pendingSaveData.content}
        </div>
      </div>
      <div>
        <div style={{ marginBottom: 8, color: '#666' }}>备注（可选）：</div>
        <Input.TextArea
          placeholder="输入备注信息，方便后续查看..."
          value={remarkText}
          onChange={e => setRemarkText(e.target.value)}
          rows={3}
          maxLength={200}
          showCount
        />
      </div>
    </Modal>
  </div>
);


}

// PropTypes 声明
WebsocketDetail.propTypes = {
    match: PropTypes.object
};
