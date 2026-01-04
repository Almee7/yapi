import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './WebsocketList.scss';
import { useHistory, useParams, Route, Switch } from 'react-router-dom';
import WebsocketDetail from './Websocket';

export function WebsocketList() {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);

    const history = useHistory();         // 跳转
    const { id } = useParams();           // 获取 /project/:id

    useEffect(() => {
        fetchList();
    }, []);

    /** 获取列表 */
    const fetchList = async () => {
        try {
            const res = await axios.get('/api/ws-test/list');
            const data = res && res.data ? res.data : {};
            const body = data.body || {};
            const safeList = Array.isArray(body.list) ? body.list : [];
            setList(safeList);
        } catch (err) {
            console.error('获取列表失败', err);
            setList([]);
        } finally {
            setLoading(false);
        }
    };

    /** 删除(直接断开并从列表移除) */
    const deleteItem = async (connectionId) => {
        if (!window.confirm('确认删除该连接?')) return;
        try {
            // 调用 disconnect 接口断开连接
            await axios.post('/api/ws-test/disconnect', { connectionId });
            // 从列表中移除
            setList(list.filter(item => item.connectionId !== connectionId));
        } catch (err) {
            console.error('删除失败', err);
            const errorMsg = err.response && err.response.data && err.response.data.body && err.response.data.body.tips 
                ? err.response.data.body.tips 
                : err.message;
            alert('删除失败: ' + errorMsg);
        }
    };

    /** Connect / Disconnect 切换状态 */
    const toggleConnect = async (item) => {
        try {
            if (item.status === 'open' || item.status === 'connected') {
                // 断开连接
                await axios.post('/api/ws-test/disconnect', { connectionId: item.connectionId });
                setList(list.map(row =>
                    row.connectionId === item.connectionId
                        ? { ...row, status: 'closed' }
                        : row
                ));
            } else {
                // 重新连接 - 需要传递 url, headers, query
                const res = await axios.post('/api/ws-test/connect', {
                    url: item.url,
                    headers: item.headers || {},
                    query: item.query || {}
                });
                
                // 重连后会生成新的 connectionId，需要更新列表
                const newConnectionId = res.data && res.data.body && res.data.body.connectionId;
                setList(list.map(row =>
                    row.connectionId === item.connectionId
                        ? { ...row, connectionId: newConnectionId || row.connectionId, status: 'open' }
                        : row
                ));
            }
        } catch (err) {
            console.error('操作失败', err);
            const errorMsg = err.response && err.response.data && err.response.data.body && err.response.data.body.tips 
                ? err.response.data.body.tips 
                : err.message;
            alert('操作失败: ' + errorMsg);
        }
    };

    /** 跳转详情页（加入 projectId） */
    const goToDetail = (connectionId) => {
        history.push(`/project/${id}/websocket/${connectionId}`);
    };

    /** 按钮样式 */
    const getConnectBtn = (status) => {
        if (status === 'open' || status === 'connected') {
            return { text: '断开', className: 'disconnect' };
        }
        return { text: '连接', className: 'connect' };
    };

    return (
      <Switch>
        {/* 详情页路由 */}
        <Route 
          path="/project/:id/websocket/:connectionId" 
          render={(props) => <WebsocketDetail {...props} toggleConnect={toggleConnect} />} 
        />
        
        {/* 列表页路由 */}
        <Route path="/project/:id/websocket">
          <div className="ws-list-page">
            <h2>WebSocket 管理中心</h2>

            <div className="excel-table">
              {/* 表头 */}
              <div className="table-header">
                <div className="cell">URL</div>
                <div className="cell">Cookie</div>
                <div className="cell">connectId</div>
                <div className="cell">连接状态</div>
                <div className="cell">操作</div>
              </div>

              {/* 加载/无数据 */}
              {loading ? (
                <div className="table-row no-data">
                  <div className="cell" style={{ gridColumn: '1 / span 4' }}>
                    加载中...
                  </div>
                </div>
                ) : list.length === 0 ? (
                  <div className="table-row no-data">
                    <div className="cell" style={{ gridColumn: '1 / span 4' }}>
                      暂无数据
                    </div>
                  </div>
                ) : (
                    list.map(item => {
                        const url = item.url || '-';
                        const cookieId = item.headers.cookieId || '-';
                        const status = item.status || '未知';
                        const connectBtn = getConnectBtn(item.status);

                        return (
                          <div className="table-row" key={item.connectionId}>
                            <div className="cell">{url}</div>
                            <div className="cell">{cookieId}</div>
                            <div className="cell">{item.connectionId}</div>
                            <div className="cell">
                              <span className={`status ${status}`}>{status}</span>
                            </div>

                            <div className="cell actions">
                              <button
                                        className="text-btn detail"
                                        onClick={() => goToDetail(item.connectionId)}
                                    >
                                查看详情
                              </button>

                              <button
                                        className="text-btn delete"
                                        onClick={() => deleteItem(item.connectionId)}
                                    >
                                删除
                              </button>

                              <button
                                        className={`text-btn ${connectBtn.className}`}
                                        onClick={() => toggleConnect(item)}
                                    >
                                {connectBtn.text}
                              </button>
                            </div>
                          </div>
                        );
                    })
                )}
            </div>
          </div>
        </Route>
      </Switch>
    );
}
