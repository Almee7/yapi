import React, { PureComponent as Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { message, Tooltip, Input} from 'antd';
import { getEnv } from '../../../../reducer/modules/project';
import {
  fetchInterfaceColList,
  setColData,
  fetchCaseData,
  fetchCaseList
} from '../../../../reducer/modules/interfaceCol';
import { Postman } from '../../../../components';

import './InterfaceCaseContent.scss';

@connect(
  state => {
    return {
      interfaceColList: state.interfaceCol.interfaceColList,
      currColId: state.interfaceCol.currColId,
      currCaseId: state.interfaceCol.currCaseId,
      currCase: state.interfaceCol.currCase,
      isShowCol: state.interfaceCol.isShowCol,
      currProject: state.project.currProject,
      projectEnv: state.project.projectEnv,
      curUid: state.user.uid
    };
  },
  {
    fetchInterfaceColList,
    fetchCaseData,
    setColData,
    fetchCaseList,
    getEnv
  }
)
@withRouter
export default class InterfaceCaseContent extends Component {
  static propTypes = {
    match: PropTypes.object,
    interfaceColList: PropTypes.array,
    fetchInterfaceColList: PropTypes.func,
    fetchCaseData: PropTypes.func,
    setColData: PropTypes.func,
    fetchCaseList: PropTypes.func,
    history: PropTypes.object,
    currColId: PropTypes.number,
    currCaseId: PropTypes.number,
    currCase: PropTypes.object,
    isShowCol: PropTypes.bool,
    currProject: PropTypes.object,
    getEnv: PropTypes.func,
    projectEnv: PropTypes.object,
    curUid: PropTypes.number
  };

  state = {
    isEditingCasename: true,
    editCasename: ''
  };

  constructor(props) {
    super(props);
  }



  async componentWillMount() {
    const params = this.props.match.params;
    const { actionId } = params;
    
    // 直接从路由参数获取caseId
    let currCaseId = +actionId;
    
    if (currCaseId) {
      await this.props.fetchCaseData(currCaseId);
      this.props.setColData({ currCaseId: +currCaseId, isShowCol: false });
      
      // 获取当前case 下的环境变量
      if (this.props.currCase && this.props.currCase.project_id) {
        await this.props.getEnv(this.props.currCase.project_id);
      }
      
      this.setState({ editCasename: this.props.currCase ? this.props.currCase.casename : '' });
    }
  }

  async componentWillReceiveProps(nextProps) {
    const oldCaseId = this.props.match.params.actionId;
    const newCaseId = nextProps.match.params.actionId;
    
    if (oldCaseId !== newCaseId && newCaseId) {
      await this.props.fetchCaseData(newCaseId);
      this.props.setColData({ currCaseId: +newCaseId, isShowCol: false });
      
      if (this.props.currCase && this.props.currCase.project_id) {
        await this.props.getEnv(this.props.currCase.project_id);
      }
      
      this.setState({ editCasename: this.props.currCase ? this.props.currCase.casename : '' });
    }
  }

  savePostmanRef = postman => {
    this.postman = postman;
  };

  updateCase = async () => {
    const {
      case_env,
      req_params,
      req_query,
      req_headers,
      req_body_type,
      req_body_form,
      req_body_other,
      test_script,
      enable_script,
      test_res_body,
      test_res_header,
      pre_request_script

    } = this.postman.state;

    const { editCasename: casename } = this.state;
    const { _id: id } = this.props.currCase;
    let params = {
      id,
      casename,
      case_env,
      req_params,
      req_query,
      req_headers,
      req_body_type,
      req_body_form,
      req_body_other,
      test_script,
      enable_script,
      test_res_body,
      test_res_header,
      pre_request_script
    };

    const res = await axios.post('/api/col/up_case', params);
    if (this.props.currCase.casename !== casename) {
      this.props.fetchInterfaceColList(this.props.match.params.id);
      console.log('✅ 已执行 fetchInterfaceColList');
    }
    if (res.data.errcode) {
      message.error(res.data.errmsg);
    } else {
      message.success('更新成功');
      this.props.fetchCaseData(id);
    }
  };

  triggerEditCasename = () => {
    this.setState({
      isEditingCasename: true,
      editCasename: this.props.currCase.casename
    });
  };
  cancelEditCasename = () => {
    this.setState({
      isEditingCasename: false,
      editCasename: this.props.currCase.casename
    });
  };

  // 删除 WS 消息
  deleteWsMessage = async (msgIndex) => {
    try {
      const res = await axios.post('/api/col/del_ws_message', {
        id: this.props.currCase._id,
        msg_index: msgIndex
      });
      if (res.data.errcode) {
        message.error(res.data.errmsg);
      } else {
        message.success('删除成功');
        this.props.fetchCaseData(this.props.currCase._id);
      }
    } catch (err) {
      message.error('删除失败: ' + err.message);
    }
  };

  // 复制到剪贴板
  copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  render() {
    const { currCase, currProject, projectEnv } = this.props;
    const { isEditingCasename, editCasename } = this.state;

    const data = Object.assign(
      {},
      currCase,
      {
        env: projectEnv.env,
        pre_script: currProject.pre_script,
        after_script: currProject.after_script
      },
      { _id: currCase._id }
    );

    return (
      <div style={{ padding: '6px 0' }} className="case-content">
        <div className="case-title">
          {!isEditingCasename && (
            <Tooltip title="点击编辑" placement="bottom">
              <div className="case-name" onClick={this.triggerEditCasename}>
                {currCase.casename}
              </div>
            </Tooltip>
          )}

          {isEditingCasename && (
            <div className="edit-case-name">
              <Input
                value={editCasename}
                onChange={e => this.setState({ editCasename: e.target.value })}
                style={{ fontSize: 18 }}
              />
            </div>
          )}
          <span className="inter-link" style={{ margin: '0px 8px 0px 6px', fontSize: 12 }}>
            <Link
              className="text"
              to={`/project/${currCase.project_id}/interface/api/${currCase.interface_id}`}
            >
              对应接口
            </Link>
          </span>
        </div>
        <div>
          {Object.keys(currCase).length > 0 && (
            <Postman
              data={data}
              type="case"
              saveTip="更新保存修改"
              save={this.updateCase}
              ref={this.savePostmanRef}
              interfaceId={currCase.interface_id}
              projectId={currCase.project_id}
              curUid={this.props.curUid}
              onWsMessageDelete={() => this.props.fetchCaseData(currCase._id)}
            />
          )}
        </div>
      </div>
    );
  }
}
