import React, { Component } from 'react';
import { Button } from 'antd';
import PropTypes from 'prop-types';
import './DraggableReportModal.scss';

class DraggableReportModal extends Component {
  static propTypes = {
    visible: PropTypes.bool,
    initialPosition: PropTypes.object,
    title: PropTypes.string,
    width: PropTypes.number,
    height: PropTypes.number,
    showExecuteButton: PropTypes.bool,
    isExecuting: PropTypes.bool,
    reportData: PropTypes.object,
    expandedCase: PropTypes.any,
    onExecute: PropTypes.func,
    onCancel: PropTypes.func,
    onOk: PropTypes.func,
    onViewReportList: PropTypes.func,
    onViewReportDetail: PropTypes.func,
    onToggleExpand: PropTypes.func,
    children: PropTypes.node
  };

  constructor(props) {
    super(props);
    
    this.state = {
      visible: props.visible !== undefined ? props.visible : false,
      position: props.initialPosition || { x: 100, y: 100 },
      dragging: false,
      dragStart: { x: 0, y: 0 }
    };
    
    this.headerRef = React.createRef();
  }

  static defaultProps = {
    title: '测试报告',
    width: 600,
    height: 600,
    initialPosition: { x: 100, y: 100 },
    reportData: null,
    expandedCase: null,
    onExecute: () => {},
    onCancel: () => {},
    onOk: () => {},
    onViewReportList: () => {},
    onViewReportDetail: () => {},
    onToggleExpand: () => {},
    children: null
  };

  componentDidMount() {
    try {
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
    } catch (error) {
      console.error('Error adding event listeners:', error);
    }
  }

  componentWillUnmount() {
    try {
      document.removeEventListener('mousemove', this.handleMouseMove);
      document.removeEventListener('mouseup', this.handleMouseUp);
    } catch (error) {
      console.error('Error removing event listeners:', error);
    }
  }

  handleMouseDown = (e) => {
    try {
      if (e && this.headerRef.current && (e.target === this.headerRef.current || this.headerRef.current.contains(e.target))) {
        this.setState({
          dragging: true,
          dragStart: {
            x: e.clientX - (this.state.position.x || 0),
            y: e.clientY - (this.state.position.y || 0)
          }
        });
      }
    } catch (error) {
      console.error('Error in handleMouseDown:', error);
    }
  };

  handleMouseMove = (e) => {
    try {
      if (this.state.dragging && e) {
        const x = e.clientX - (this.state.dragStart.x || 0);
        const y = e.clientY - (this.state.dragStart.y || 0);
        
        this.setState({
          position: { x, y }
        });
      }
    } catch (error) {
      console.error('Error in handleMouseMove:', error);
    }
  };

  handleMouseUp = () => {
    try {
      this.setState({ dragging: false });
    } catch (error) {
      console.error('Error in handleMouseUp:', error);
    }
  };

  handleCancel = () => {
    // 如果有props控制visible，优先调用props的onCancel
    if (this.props.onCancel) {
      this.props.onCancel();
    } else {
      // 否则更新内部状态
      this.setState({ visible: false });
    }
  };

  handleOk = () => {
    if (this.props.onOk) {
      this.props.onOk();
    }
  };

  renderContent = () => {
    const { reportData, expandedCase } = this.props;
    
    if (!reportData) {
      return <div>暂无报告数据</div>;
    }

    if (reportData.type === 'list') {
      // 渲染报告列表
      return (
        <div>
          <h4>测试报告列表</h4>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {reportData.list && reportData.list.length > 0 ? (
              reportData.list.map((report, index) => (
                <div 
                  key={report._id} 
                  style={{ 
                    padding: '12px', 
                    borderBottom: '1px solid #e8e8e8', 
                    cursor: 'pointer',
                    backgroundColor: index % 2 === 0 ? '#fafafa' : '#fff'
                  }}
                  onClick={() => this.props.onViewReportDetail && this.props.onViewReportDetail(report._id)}
                >
                  <div><strong>执行时间:</strong> {report.add_time ? new Date(report.add_time * 1000).toLocaleString() : 'N/A'}</div>
                  <div><strong>执行用户:</strong> {report.username || 'N/A'}</div>
                  <div><strong>环境:</strong> {report.env_name || 'N/A'}</div>
                  <div><strong>结果:</strong> 总数: {report.total || 0}, 成功: {report.success || 0}, 失败: {report.failed || 0}</div>
                </div>
              ))
            ) : (
              <div>暂无历史报告</div>
            )}
          </div>
        </div>
      );
    } else if (reportData.type === 'detail') {
      // 渲染报告详情
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>报告详情</h4>
              <Button size="small" onClick={() => this.props.onViewReportList && this.props.onViewReportList()}>
                返回列表
              </Button>
            </div>
            <div><strong>场景名称:</strong> {reportData.col_name || 'N/A'}</div>
            <div><strong>执行环境:</strong> {reportData.env_name || 'N/A'}</div>
            <div><strong>执行时间:</strong> {reportData.add_time ? new Date(reportData.add_time * 1000).toLocaleString() : 'N/A'}</div>
            <div><strong>总执行时间:</strong> {reportData.run_time || 'N/A'}</div>
            <div><strong>结果:</strong> 总数: {reportData.total || 0}, 成功: {reportData.success || 0}, 失败: {reportData.failed || 0}</div>
          </div>
          
          <h5>测试用例结果:</h5>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
            {reportData.testResult && Array.isArray(reportData.testResult) && reportData.testResult.length > 0 ? (
              reportData.testResult.map((result, index) => {
                if (!result) return null; // 防止空结果导致错误
                
                let statusText = '未知';
                let statusColor = '#999';
                if (result.code === 0) {
                  statusText = '成功';
                  statusColor = '#52c41a';
                } else if (result.code === 1) {
                  statusText = '验证失败';
                  statusColor = '#faad14';
                } else {
                  statusText = '请求异常';
                  statusColor = '#f5222d';
                }
                
                return (
                  <div key={result.id || index} style={{ padding: '8px', borderBottom: '1px solid #e8e8e8' }}>
                    <div 
                      style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                      onClick={() => {
                        // 切换展开状态
                        try {
                          this.props.onToggleExpand && this.props.onToggleExpand(result.id || index);
                        } catch (error) {
                          console.error('切换展开状态失败', error);
                        }
                      }}
                    >
                      <span><strong>{result.name || result.casename || '未知用例'}</strong></span>
                      <span style={{ color: statusColor }}>{statusText}</span>
                    </div>
                    {result.executionTime && (
                      <div>执行时间: {result.executionTime}</div>
                    )}
                    {/* 展开的详细信息 */}
                    {expandedCase === (result.id || index) && (
                      <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                        <h5>请求信息:</h5>
                        <pre style={{ fontSize: '12px', maxHeight: '100px', overflow: 'auto' }}>
                          {JSON.stringify({
                            url: result.url || 'N/A',
                            method: result.method || 'N/A',
                            headers: result.req_headers || {},
                            params: result.req_query || {},
                            body: result.req_body_other || 'N/A'
                          }, null, 2)}
                        </pre>
                        
                        <h5>响应信息:</h5>
                        <pre style={{ fontSize: '12px', maxHeight: '100px', overflow: 'auto' }}>
                          {JSON.stringify({
                            status: result.status || 'N/A',
                            statusText: result.statusText || 'N/A',
                            headers: result.res_header || {},
                            body: result.res_body || 'N/A'
                          }, null, 2)}
                        </pre>
                        
                        <h5>断言结果:</h5>
                        <div>
                          {result.validRes && Array.isArray(result.validRes) && result.validRes.length > 0 ? (
                            result.validRes.map((valid, idx) => {
                              if (!valid) return null; // 防止空验证结果导致错误
                              return (
                                <div key={idx} style={{ padding: '4px 0' }}>
                                  <span style={{ 
                                    color: valid && valid.message && (valid.message.includes('通过') || valid.message === 0 || valid.message === 2) ? '#52c41a' : '#f5222d',
                                    fontWeight: 'bold'
                                  }}>
                                    {valid && valid.message ? valid.message : '无验证信息'}
                                  </span>
                                  {valid && valid.data && (
                                    <pre style={{ fontSize: '12px', marginLeft: '10px' }}>
                                      {JSON.stringify(valid.data, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div>无验证结果</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }).filter(Boolean) // 过滤掉null元素
            ) : (
              <div>暂无测试结果</div>
            )}
          </div>
        </div>
      );
    } else {
      // 默认渲染CaseReport
      return this.props.children || <div>报告内容</div>;
    }
  };

  render() {
    try {
      const { visible, position } = this.state;
      const { title, width, height, showExecuteButton } = this.props;

      if (!visible) {
        return null;
      }

      const modalStyle = {
        position: 'absolute',
        top: `${position.y || 100}px`,
        left: `${position.x || 100}px`,
        width: `${width || 600}px`,
        height: `${height || 600}px`,
        zIndex: 1000,
        margin: 0,
        padding: 0
      };

      return (
        <div 
          className="draggable-report-modal" 
          style={modalStyle}
          onMouseDown={this.handleMouseDown}
        >
          <div 
            className="draggable-header" 
            ref={this.headerRef}
            style={{
              padding: '10px 16px',
              background: '#f0f0f0',
              cursor: 'move',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #d9d9d9'
            }}
          >
            <div style={{ fontWeight: 'bold' }}>{title || '测试报告'}</div>
            <div>
              {showExecuteButton && (
                <Button 
                  size="small" 
                  type="primary" 
                  onClick={() => {
                    try {
                      this.props.onExecute && this.props.onExecute();
                    } catch (error) {
                      console.error('执行测试失败', error);
                    }
                  }}
                  style={{ marginRight: '8px' }}
                >
                  {this.props.isExecuting ? '执行中...' : '开始执行'}
                </Button>
              )}
              <Button 
                size="small" 
                onClick={this.handleCancel}
              >
                关闭
              </Button>
            </div>
          </div>
          <div 
            className="draggable-body" 
            style={{
              height: `calc(100% - 44px)`,
              overflow: 'auto',
              padding: '16px',
              backgroundColor: 'white',
              borderBottomLeftRadius: '4px',
              borderBottomRightRadius: '4px'
            }}
          >
            {this.renderContent()}
          </div>
        </div>
      );
    } catch (error) {
      console.error('渲染弹窗失败', error);
      return <div>组件渲染错误</div>;
    }
  }
}

export default DraggableReportModal;