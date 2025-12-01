import React, { PureComponent as Component } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import PropTypes from 'prop-types';
import { Table, Button, message, Tag } from 'antd';
import axios from 'axios';
import moment from 'moment';
import './TestReportList.scss';

@connect(
  state => {
    return {
      currProject: state.project.currProject
    };
  }
)
@withRouter
export default class TestReportList extends Component {
  static propTypes = {
    match: PropTypes.object,
    history: PropTypes.object,
    currProject: PropTypes.object
  };

  state = {
    list: [],
    loading: false,
    pagination: {
      current: 1,
      pageSize: 20,
      total: 0
    }
  };

  componentDidMount() {
    this.fetchReportList();
  }

  fetchReportList = async (page = 1) => {
    this.setState({ loading: true });
    const colId = this.props.match.params.actionId;
    
    try {
      const res = await axios.get('/api/test_report/list', {
        params: {
          col_id: colId,
          page,
          limit: this.state.pagination.pageSize
        }
      });

      if (res.data.errcode === 0) {
        this.setState({
          list: res.data.data.list,
          pagination: {
            ...this.state.pagination,
            current: page,
            total: res.data.data.total
          }
        });
      } else {
        message.error(res.data.errmsg);
      }
    } catch (e) {
      message.error('获取报告列表失败');
    } finally {
      this.setState({ loading: false });
    }
  };

  handleTableChange = pagination => {
    this.fetchReportList(pagination.current);
  };

  viewReport = record => {
    const projectId = this.props.match.params.id;
    const colId = this.props.match.params.actionId;
    this.props.history.push(`/project/${projectId}/interface/col/${colId}/report/${record._id}`);
  };

  deleteReport = async record => {
    try {
      const res = await axios.get('/api/test_report/del', {
        params: { id: record._id }
      });

      if (res.data.errcode === 0) {
        message.success('删除成功');
        this.fetchReportList(this.state.pagination.current);
      } else {
        message.error(res.data.errmsg);
      }
    } catch (e) {
      message.error('删除失败');
    }
  };

  goBack = () => {
    this.props.history.goBack();
  };

  render() {
    const columns = [
      {
        title: '执行用户',
        dataIndex: 'username',
        key: 'username',
        width: 120
      },
      {
        title: '场景名称',
        dataIndex: 'col_name',
        key: 'col_name',
        width: 200,
        render: (text, record) => (
          <a onClick={() => this.viewReport(record)}>{text}</a>
        )
      },
      {
        title: '执行环境',
        dataIndex: 'env_name',
        key: 'env_name',
        width: 150
      },
      {
        title: '结果',
        key: 'result',
        width: 300,
        render: (text, record) => (
          <div>
            <span>总数: {record.total}</span>
            <span style={{ marginLeft: 16, color: '#52c41a' }}>成功: {record.success}</span>
            <span style={{ marginLeft: 16, color: '#f5222d' }}>失败: {record.failed}</span>
          </div>
        )
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: status => (
          <Tag color={status === 'success' ? 'green' : 'red'}>
            {status === 'success' ? '成功' : '失败'}
          </Tag>
        )
      },
      {
        title: '执行时间',
        dataIndex: 'run_time',
        key: 'run_time',
        width: 100
      },
      {
        title: '创建时间',
        dataIndex: 'add_time',
        key: 'add_time',
        width: 180,
        render: time => moment(time * 1000).format('YYYY-MM-DD HH:mm:ss')
      },
      {
        title: '操作',
        key: 'action',
        width: 150,
        render: (text, record) => (
          <div>
            <Button type="link" onClick={() => this.viewReport(record)}>
              查看详情
            </Button>
            <Button type="link" onClick={() => this.deleteReport(record)} style={{ color: '#f5222d' }}>
              删除
            </Button>
          </div>
        )
      }
    ];

    return (
      <div className="test-report-list">
        <div className="report-header">
          <h2>测试报告记录</h2>
          <Button onClick={this.goBack}>返回</Button>
        </div>
        <Table
          columns={columns}
          dataSource={this.state.list}
          rowKey="_id"
          loading={this.state.loading}
          pagination={this.state.pagination}
          onChange={this.handleTableChange}
        />
      </div>
    );
  }
}
