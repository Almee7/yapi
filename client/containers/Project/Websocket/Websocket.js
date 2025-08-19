import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Websocket.scss';

export default function WebsocketManager() {
    const [tabs, setTabs] = useState([]);
    const [activeTab, setActiveTab] = useState(null);
    const [loading, setLoading] = useState(true);
    const wsRef = useRef(null); // Node.js 代理 WS
    const messagesEndRef = useRef(null);

    // 自动滚动到底部
    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // 初始化加载连接列表 & 建立前端 WS 代理连接
    useEffect(() => {
        const fetchList = async () => {
            try {
                const res = await axios.get('/api/ws-test/list');
                let list = (res && res.data && res.data.body && res.data.body.list) || [];

                // 去重（按 url）
                const uniqueList = [];
                const seenUrls = new Set();
                for (let item of list) {
                    if (!seenUrls.has(item.url)) {
                        seenUrls.add(item.url);
                        item.messages = [];
                        uniqueList.push(item);
                    }
                }

                setTabs(uniqueList);
                if (uniqueList.length > 0) {
                    setActiveTab(uniqueList[0].connectionId);
                }
            } catch (err) {
                console.error('获取连接列表失败', err);
            } finally {
                setLoading(false);
            }
        };

        fetchList();

        // 连接 Node.js 代理 WS
        const ws = new WebSocket('ws://localhost:3000/api/ws-test/frontend');

        ws.onopen = () => console.log('已连接到 Node.js 代理 WS');

        ws.onmessage = (event) => {
            try {
                const { connectionId, data } = JSON.parse(event.data);

                setTabs(prev =>
                    prev.map(tab => {
                        if (tab.connectionId === connectionId) {
                            if (!tab.messages) tab.messages = [];
                            if (data.type === 'message') {
                                if (JSON.parse(data.message).data.text !== 'pong') {
                                    tab.messages.push(data.message);
                                }
                            }
                            if (data.type === 'status') {
                                tab.status = data.status;
                            }
                        }
                        return { ...tab };
                    })
                );
            } catch (err) {
                console.error('解析 WS 消息失败', err);
            }
        };

        ws.onclose = () => console.log('前端代理 WS 已关闭');

        wsRef.current = ws;

        // 卸载时关闭 WS
        return () => {
            ws.close();
        };
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [tabs, activeTab]);

    // 断开连接
    const disconnect = async (connectionId) => {
        try {
            await axios.post('/api/ws-test/disconnect', { connectionId });

            setTabs(prev => {
                const newTabs = prev.filter(tab => tab.connectionId !== connectionId);
                if (activeTab === connectionId) {
                    const nextTab = newTabs.length > 0 ? newTabs[0].connectionId : null;
                    setActiveTab(nextTab);
                }
                return newTabs;
            });
        } catch (err) {
            console.error('断开连接失败', err);
        }
    };

    const activeTabData = tabs.find(tab => tab.connectionId === activeTab);

    return (
      <div className="ws-manager">
        {loading ? (
          <div className="empty">加载中...</div>
            ) : tabs.length === 0 ? (
              <div className="empty">暂无数据</div>
            ) : (
              <div className="container">
                <div className="sidebar">
                  <div className="tabs">
                    {tabs.map(tab => (
                      <div
                                    key={tab.connectionId}
                                    className={`tab ${tab.connectionId === activeTab ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.connectionId)}
                                >
                        {tab.url}
                        <span className={`status ${tab.status || 'closed'}`}>
                          {tab.status || 'closed'}
                        </span>
                      </div>
                            ))}
                  </div>
                </div>
                <div className="content">
                  {activeTabData ? (
                    <div className="tab-content">
                      <div className="connection-info">
                        <div><strong>URL:</strong> {activeTabData.url}</div>
                        <div><strong>Headers:</strong> {JSON.stringify(activeTabData.headers)}</div>
                        <div className="disconnect-btn">
                          <button onClick={() => disconnect(activeTabData.connectionId)}>Disconnect</button>
                        </div>
                      </div>
                      <div className="messages-wrapper">
                        <div className="messages">
                          {(activeTabData.messages || []).map((msg, idx) => (
                            <div key={idx} className="message">{msg}</div>
                                        ))}
                          <div ref={messagesEndRef}></div>
                        </div>
                      </div>
                    </div>
                        ) : (
                          <div className="empty">Select a connection to view details</div>
                        )}
                </div>
              </div>
            )}
      </div>
    );
}
