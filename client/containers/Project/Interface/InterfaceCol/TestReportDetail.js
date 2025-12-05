import React, { PureComponent as Component } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import PropTypes from 'prop-types';
import { Button, message, Spin, Card, Row, Col, Tag, Divider, Tabs } from 'antd';
import axios from 'axios';
import moment from 'moment';
import './TestReportDetail.scss';

const { TabPane } = Tabs;

@connect(
  state => {
    return {
      currProject: state.project.currProject
    };
  }
)
@withRouter
export default class TestReportDetail extends Component {
  static propTypes = {
    match: PropTypes.object,
    history: PropTypes.object,
    currProject: PropTypes.object
  };

  state = {
    loading: true,
    report: null,
    testResult: [] // 改为数组以保持顺序
  };

  componentDidMount() {
    this.fetchReportDetail();
  }

  fetchReportDetail = async () => {
    const reportId = this.props.match.params.reportId;
    
    try {
      const res = await axios.get('/api/test_report/get', {
        params: { id: reportId }
      });

      if (res.data.errcode === 0) {
        const report = res.data.data;
        let testResult = [];
        try {
          const parsedResult = typeof report.test_result === 'string' 
            ? JSON.parse(report.test_result) 
            : report.test_result;
          
          // 判断是数组还是对象
          if (Array.isArray(parsedResult)) {
            // 已经是数组，直接使用
            testResult = parsedResult;
          } else {
            // 是对象，转换为数组（为了向后兼容）
            testResult = Object.keys(parsedResult).map(key => ({
              id: key,
              ...parsedResult[key]
            }));
          }
        } catch (e) {
          console.error('解析测试结果失败', e);
        }

        this.setState({
          report,
          testResult,
          loading: false
        });
      } else {
        message.error(res.data.errmsg);
        this.setState({ loading: false });
      }
    } catch (e) {
      message.error('获取报告详情失败');
      this.setState({ loading: false });
    }
  };

  goBack = () => {
    this.props.history.goBack();
  };

  renderTestCaseResult = (result, index) => {
    console.log('result', index, result)
    if (!result) return null;

    const getStatusColor = code => {
      if (code === 0) return 'green';
      if (code === 1) return 'orange';
      return 'red';
    };

    const getStatusText = code => {
      if (code === 0) return '成功';
      if (code === 1) return '验证失败';
      return '请求异常';
    };

    return (
      <Card 
        key={result.id || index} 
        size="small" 
        style={{ marginBottom: 16 }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{result.name || result.casename || '测试用例'}</span>
            <Tag color={getStatusColor(result.code)}>
              {getStatusText(result.code)}
            </Tag>
          </div>
        }
      >
        <Tabs defaultActiveKey="1" size="small">
          <TabPane tab="基本信息" key="1">
            <Row gutter={16}>
              <Col span={12}>
                <p><strong>请求路径:</strong> {result.path || result.url}</p>
                <p><strong>请求方法:</strong> {result.method}</p>
                <p><strong>HTTP状态码:</strong> {result.status}</p>
              </Col>
              <Col span={12}>
                <p><strong>状态文本:</strong> {result.statusText}</p>
                {result.executionTime && (
                  <p><strong>执行时间:</strong> {result.executionTime}</p>
                )}
              </Col>
            </Row>
          </TabPane>
          
          <TabPane tab="请求信息" key="2">
            {result.headers && (
              <div style={{ marginBottom: 16 }}>
                <strong>请求头:</strong>
                <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 8 }}>
                  {JSON.stringify(result.headers, null, 2)}
                </pre>
              </div>
            )}
            {result.data && (
              <div>
                <strong>请求体:</strong>
                <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 8 }}>
                  {typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </TabPane>

          <TabPane tab="响应信息" key="3">
            {result.res_header && (
              <div style={{ marginBottom: 16 }}>
                <strong>响应头:</strong>
                <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 8 }}>
                  {typeof result.res_header === 'string' ? result.res_header : JSON.stringify(result.res_header, null, 2)}
                </pre>
              </div>
            )}
            {result.res_body && (
              <div>
                <strong>响应体:</strong>
                <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 8, maxHeight: 400, overflow: 'auto' }}>
                  {typeof result.res_body === 'string' ? result.res_body : JSON.stringify(result.res_body, null, 2)}
                </pre>
              </div>
            )}
          </TabPane>

          <TabPane tab="验证结果" key="4">
            {result.validRes && result.validRes.length > 0 ? (
              result.validRes.map((valid, index) => (
                <div key={index} style={{ marginBottom: 8 }}>
                  <Tag color={valid.message && valid.message.indexOf('通过') > -1 ? 'green' : 'red'}>
                    {valid.message || '验证结果'}
                  </Tag>
                  {valid.data && <pre style={{ marginTop: 8 }}>{JSON.stringify(valid.data, null, 2)}</pre>}
                </div>
              ))
            ) : (
              <p>无验证结果</p>
            )}
          </TabPane>
        </Tabs>
      </Card>
    );
  };

  render() {
    console.log("测试报告", this.state);
    const { loading, report, testResult } = this.state;

    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" />
        </div>
      );
    }

    if (!report) {
      return <div style={{ padding: 24 }}>报告不存在</div>;
    }

    return (
      <div className="test-report-detail">
        <div className="report-header">
          <div>
            <h2>测试报告详情</h2>
            <p style={{ color: '#666', marginBottom: 0 }}>
              {moment(report.add_time * 1000).format('YYYY-MM-DD HH:mm:ss')}
            </p>
          </div>
          <Button onClick={this.goBack}>返回</Button>
        </div>

        <Card className="summary-card">
          <Row gutter={24}>
            <Col span={6}>
              <div className="summary-item">
                <div className="summary-label">执行用户</div>
                <div className="summary-value">{report.username}</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="summary-item">
                <div className="summary-label">场景名称</div>
                <div className="summary-value">{report.col_name}</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="summary-item">
                <div className="summary-label">执行环境</div>
                <div className="summary-value">{report.env_name}</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="summary-item">
                <div className="summary-label">执行时间</div>
                <div className="summary-value">{report.run_time}</div>
              </div>
            </Col>
          </Row>
          
          <Divider />
          
          <Row gutter={24}>
            <Col span={6}>
              <div className="summary-item">
                <div className="summary-label">总数</div>
                <div className="summary-value" style={{ fontSize: 24, fontWeight: 'bold' }}>
                  {report.total}
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div className="summary-item">
                <div className="summary-label">成功</div>
                <div className="summary-value" style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                  {report.success}
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div className="summary-item">
                <div className="summary-label">失败</div>
                <div className="summary-value" style={{ fontSize: 24, fontWeight: 'bold', color: '#f5222d' }}>
                  {report.failed}
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div className="summary-item">
                <div className="summary-label">状态</div>
                <div className="summary-value">
                  <Tag color={report.status === 'success' ? 'green' : 'red'} style={{ fontSize: 16 }}>
                    {report.status === 'success' ? '成功' : '失败'}
                  </Tag>
                </div>
              </div>
            </Col>
          </Row>
        </Card>

        <div className="test-cases-section">
          <h3>测试用例详情</h3>
          {testResult && testResult.length > 0 ? (
            testResult.map((result, index) => 
              this.renderTestCaseResult(result, index)
            )
          ) : (
            <Card>
              <p>无测试结果数据</p>
            </Card>
          )}
        </div>
      </div>
    );
  }
}
