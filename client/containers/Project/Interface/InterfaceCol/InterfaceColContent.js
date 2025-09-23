import React, { PureComponent as Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { Link } from 'react-router-dom';
//import constants from '../../../../constants/variable.js'
import { Tooltip, Icon,Input, Button, Row, Col, Spin, Modal, message, Select, Switch  } from 'antd';
import {
  fetchInterfaceColList,
  fetchCaseList,
  setColData,
  fetchCaseEnvList
} from '../../../../reducer/modules/interfaceCol';
import HTML5Backend from 'react-dnd-html5-backend';
import { getToken, getEnv } from '../../../../reducer/modules/project';
import { DragDropContext } from 'react-dnd';
import AceEditor from 'client/components/AceEditor/AceEditor';
import * as Table from 'reactabular-table';
import * as dnd from 'reactabular-dnd';
import * as resolve from 'table-resolver';
import axios from 'axios';
import CaseReport from './CaseReport.js';
import _ from 'underscore';
import { initCrossRequest } from 'client/components/Postman/CheckCrossInstall.js';
// import produce from 'immer';
import {InsertCodeMap} from 'client/components/Postman/Postman.js'

const plugin = require('client/plugin.js');
const {
  handleParams,
  crossRequest,
  handleCurrDomain,
  checkNameIsExistInArray
} = require('common/postmanLib.js');
const { handleParamsValue, json_parse, ArrayToObject } = require('common/utils.js');
import CaseEnv from 'client/components/CaseEnv';
import Label from '../../../../components/Label/Label.js';

const Option = Select.Option;
const createContext = require('common/createContext')

import copy from 'copy-to-clipboard';

export let scriptVars = {};

const defaultModalStyle = {
  top: 10
}

function handleReport(json) {
  try {
    return JSON.parse(json);
  } catch (e) {
    return {};
  }
}

@connect(
    state => {
      return {
        interfaceColList: state.interfaceCol.interfaceColList,
        currColId: state.interfaceCol.currColId,
        currCaseId: state.interfaceCol.currCaseId,
        isShowCol: state.interfaceCol.isShowCol,
        isRander: state.interfaceCol.isRander,
        currCaseList: state.interfaceCol.currCaseList,
        currProject: state.project.currProject,
        token: state.project.token,
        envList: state.interfaceCol.envList,
        curProjectRole: state.project.currProject.role,
        projectEnv: state.project.projectEnv,
        curUid: state.user.uid
      };
    },
    {
      fetchInterfaceColList,
      fetchCaseList,
      setColData,
      getToken,
      getEnv,
      fetchCaseEnvList
    }
)
@withRouter
@DragDropContext(HTML5Backend)
class InterfaceColContent extends Component {
  static propTypes = {
    match: PropTypes.object,
    interfaceColList: PropTypes.array,
    fetchInterfaceColList: PropTypes.func,
    fetchCaseList: PropTypes.func,
    setColData: PropTypes.func,
    history: PropTypes.object,
    currCaseList: PropTypes.array,
    currColId: PropTypes.number,
    currCaseId: PropTypes.number,
    isShowCol: PropTypes.bool,
    isRander: PropTypes.bool,
    currProject: PropTypes.object,
    getToken: PropTypes.func,
    token: PropTypes.string,
    curProjectRole: PropTypes.string,
    getEnv: PropTypes.func,
    projectEnv: PropTypes.object,
    fetchCaseEnvList: PropTypes.func,
    envList: PropTypes.array,
    curUid: PropTypes.number
  };

  constructor(props) {
    super(props);
    this.reports = {};
    this.records = {};
    this.state = {
      rows: [],
      reports: {},
      selectedIds: [],
      visible: false,
      loading: false,
      curCaseid: null,
      hasPlugin: false,
      advVisible: false,
      curScript: '',
      enableScript: false,
      autoVisible: false,
      mode: 'html',
      email: false,
      download: false,
      currColEnvObj: {},
      collapseKey: '1',
      commonSettingModalVisible: false,
      expandedRows: [], // 存储已展开的行ID
      commonSetting: {
        checkHttpCodeIs200: false,
        checkResponseField: {
          name: 'code',
          value: '0',
          enable: false
        },
        checkResponseSchema: false,
        checkScript:{
          enable: false,
          content: ''
        }
      },
      results: []
    };
    this.cancelTokens = {} // 用于取消异步请求
    this.onRow = this.onRow.bind(this);
    this.onMoveRow = this.onMoveRow.bind(this);
  }

  async handleColIdChange(newColId){
    this.props.setColData({
      currColId: +newColId,
      isShowCol: true,
      isRander: false
    });
    let result = await this.props.fetchCaseList(newColId);
    if (result.payload.data.errcode === 0) {
      this.reports = handleReport(result.payload.data.colData.test_report);
      this.setState({
        commonSetting:{
          ...this.state.commonSetting,
          ...result.payload.data.colData
        }
      })
    }

    await this.props.fetchCaseList(newColId);
    await this.props.fetchCaseEnvList(newColId);
    this.changeCollapseClose();
    this.handleColdata(this.props.currCaseList);
  }

  async componentWillMount() {
    const result = await this.props.fetchInterfaceColList(this.props.match.params.id);
    await this.props.getToken(this.props.match.params.id);
    let { currColId } = this.props;
    const params = this.props.match.params;
    const { actionId } = params;
    this.currColId = currColId = +actionId || result.payload.data.data[0]._id;
    // this.props.history.push('/project/' + params.id + '/interface/col/' + currColId);
    if (currColId && currColId != 0) {
      await this.handleColIdChange(currColId)
    }

    this._crossRequestInterval = initCrossRequest(hasPlugin => {
      this.setState({ hasPlugin: hasPlugin });
    });
  }

  componentWillUnmount() {
    clearInterval(this._crossRequestInterval);
  }

  // 更新分类简介
  handleChangeInterfaceCol = (desc, name) => {
    let params = {
      col_id: this.props.currColId,
      name: name,
      desc: desc
    };

    axios.post('/api/col/up_col', params).then(async res => {
      if (res.data.errcode) {
        return message.error(res.data.errmsg);
      }
      let project_id = this.props.match.params.id;
      await this.props.fetchInterfaceColList(project_id);
      message.success('接口集合简介更新成功');
    });
  };

  // 整合header信息
  handleReqHeader = (project_id, req_header, case_env) => {
    let envItem = _.find(this.props.envList, item => {
      return item._id === project_id;
    });

    let currDomain = handleCurrDomain(envItem && envItem.env, case_env);
    let header = currDomain.header;
    header.forEach(item => {
      if (!checkNameIsExistInArray(item.name, req_header)) {
        // item.abled = true;
        item = {
          ...item,
          abled: true
        };
        req_header.push(item);
      }
    });
    return req_header;
  };

  handleColdata = (rows, currColEnvObj = {}) => {
    let that = this;
    let newRows =  rows || []
    newRows.forEach(item => {
      item.id = item._id;
      item._test_status = item.test_status;

      if (currColEnvObj[item.project_id]) {
        item.case_env = currColEnvObj[item.project_id];
      }
      item.req_headers = that.handleReqHeader(item.project_id, item.req_headers, item.case_env);
    })
    this.setState({ rows: newRows });
  };

  //开始测试入口
  executeTests = async () => {
    console.log("开始测试", this.state);

    // 点击取消
    if (this.state.loading) {
      this.setState({ loading: false });
      Object.values(this.cancelTokens).forEach(source => {
        source.cancel('用户取消了请求');
      });
      this.cancelTokens = {};
      return;
    }

    const selectedIds = this.state.selectedIds;
    if (!selectedIds.length) {
      message.warning("请先选择用例");
      return;
    }

    // 开始测试前清空状态
    this.setState({
      loading: true,
      rows: this.state.rows.map(row => ({ ...row, loading: '' }))
    });
    this.reports = {};
    await Promise.resolve(); // 让 React 立即渲染按钮状态

    const rows_w = {};
    const asyncTasks = []; // 存放异步 case 的 Promise

    for (let i = 0; i < this.state.rows.length; i++) {
      if (!this.state.loading) break; // 已取消

      const curRow = this.state.rows[i];
      if (!selectedIds.includes(curRow._id)) continue;

      rows_w[curRow._id] = curRow;

      const envItem = _.find(this.props.envList, item => item._id === curRow.project_id);

      const curitem = {
        ...curRow,
        env: envItem.env,
        pre_script: this.props.currProject.pre_script,
        after_script: this.props.currProject.after_script,
        test_status: 'loading'
      };

      // 更新 UI 状态
      this.setState(prev => {
        const newRows = [...prev.rows];
        newRows[i] = curitem;
        return { rows: newRows };
      });

      // 根据 enable_async 决定是否 await
      if (curitem.enable_async) {
        asyncTasks.push(this.runCase(curitem, i)); // 异步收集 Promise
      } else {
        await this.runCase(curitem, i); // 同步阻塞
      }
    }

    // 等待所有异步 case 完成
    if (asyncTasks.length) {
      await Promise.all(asyncTasks);
    }

    // 全部接口执行完再上传报告
    if (this.state.loading) {
      await axios.post('/api/col/up_col', {
        col_id: this.props.currColId,
        test_report: JSON.stringify(this.reports)
      });
    }

    this.setState({ loading: false });
    this.cancelTokens = {}; // 清理 cancelTokens
  };


  // 统一用例执行方法
  runCase = async (curitem, index) => {
    let result, status = 'error';
    // 创建 cancelToken
    let source = axios.CancelToken.source();
    this.cancelTokens[curitem._id] = source;

    try {
      if (curitem.method === 'WS') {
        result = await this.handleWSTest(curitem, source.token);
      } else {
        // crossRequest / handleTest 内部需支持 cancelToken
        result = await this.handleTest({
          ...curitem,
          cancelToken: source.token
        });
      }

      if (!this.state.loading) {
        // 用户点击取消
        result = { code: 1, msg: '用户取消' };
        status = 'invalid';
      } else if (result.code === 0) {
        status = 'ok';
      } else if (result.code === 1) {
        status = 'invalid';
      }

    } catch (e) {
      if (axios.isCancel(e)) {
        result = { code: 1, msg: '用户取消' };
        status = 'invalid';
      } else {
        console.error(e);
        result = e;
      }
    }

    delete this.cancelTokens[curitem._id];

    // 更新 reports / records
    this.reports[curitem._id] = result;
    this.records[curitem._id] = {
      status: result.status,
      params: result.params,
      body: result.res_body
    };

    // 更新 UI 状态
    const newRows = [...this.state.rows];
    newRows[index] = { ...curitem, test_status: status };
    this.setState({ rows: newRows });
  };


  handleWSTest = async interfaceData => {
    let result = {
      code: 400,
      msg: '数据异常',
      validRes: []
    };
    let requestParams = {};
    let options = handleParams(interfaceData, this.handleValue, requestParams);
    try {
      const postData = {
        url: options.url,              // ws:// or wss://
        query: options.query || {},   // 如果有 query 参数
        headers: options.headers || {} // headers 里可能有 cookieId 等
      };

      // 调用后端接口
      const res = await fetch('/api/ws-test/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
      });

      if (!res.ok) {
        throw new Error(`后端接口请求失败，状态码 ${res.status}`);
      }
      const data = await res.json();

      // data 格式示例:
      // { header: {}, body: "...", status: 101, statusText: 'WebSocket连接关闭', messages: [...] }
      result = result = {
        ...options,
        header: data.header,
        body: data.body,
        status: 200,
        statusText: data.message
      };

      let responseData = Object.assign(
          {},
          {
            status: 200,
            body: data.body,
            header: data.header,
            statusText: data.statusText
          }
      );

      let validRes = [];

      // 断言测试
      await this.handleScriptTest(interfaceData, responseData, validRes, requestParams, scriptVars);
      if ([0, 2].includes(validRes[0].message)) {
        validRes[0].message = validRes[0].message === 0 ? "验证通过" : "无脚本";
        result.code = 0;
        result.validRes = validRes.slice(0, 1)
      } else {
        validRes[0].message = "验证失败";
        result.code = 1;
        validRes.splice(1, 1)
        result.validRes = validRes
      }

    } catch (e) {
      result = {
        header: {},
        body: null,
        status: null,
        statusText: 'WebSocket请求异常',
        error: e.message,
        messages: []
      };
    }

    return result
  }

  handleTest = async interfaceData => {
    let requestParams = {};
    let options = handleParams(interfaceData, this.handleValue, requestParams);
    options.vars = scriptVars
    let result = {
      code: 400,
      msg: '数据异常',
      validRes: []
    };

    await plugin.emitHook('before_col_request', Object.assign({}, options, {
      type: 'col',
      caseId: options.caseId,
      projectId: interfaceData.project_id,
      interfaceId: interfaceData.interface_id
    }));
    try {
      let data = await crossRequest(options, interfaceData.pre_script, interfaceData.after_script,interfaceData.pre_request_script, createContext(
          this.props.curUid,
          this.props.match.params.id,
          interfaceData.interface_id
      ));
      options.taskId = this.props.curUid;
      let res = (data.res.body = json_parse(data.res.body));
      result = {
        ...options,
        ...result,
        res_header: data.res.header,
        res_body: res,
        status: data.res.status,
        statusText: data.res.statusText
      };

      await plugin.emitHook('after_col_request', result, {
        type: 'col',
        caseId: options.caseId,
        projectId: interfaceData.project_id,
        interfaceId: interfaceData.interface_id
      });

      if (options.data && typeof options.data === 'object') {
        requestParams = {
          ...requestParams,
          ...options.data
        };
      }

      let validRes = [];

      let responseData = Object.assign(
          {},
          {
            status: data.res.status,
            body: res,
            header: data.res.header,
            statusText: data.res.statusText
          }
      );

      // 断言测试
      await this.handleScriptTest(interfaceData, responseData, validRes, requestParams, scriptVars);
      if ([0, 2].includes(validRes[0].message)) {
        validRes[0].message = validRes[0].message === 0 ? "验证通过" : "无脚本";
        result.code = 0;
        result.validRes = validRes.slice(0, 1)
      } else {
        validRes[0].message = "验证失败";
        result.code = 1;
        validRes.splice(1, 1)
        result.validRes = validRes
      }
    } catch (data) {
      result = {
        ...options,
        ...result,
        res_header: data.header,
        res_body: data.body || data.message,
        status: 0,
        statusText: data.message,
        code: 400,
        validRes: [
          {
            message: data.message
          }
        ]
      };
    }

    result.params = requestParams;
    return result;
  };

  //response, validRes
  // 断言测试
  handleScriptTest = async (interfaceData, response, validRes, requestParams, scriptVars) => {
    // ✅ 判断是否启用测试脚本
    let env = interfaceData.case_env
    const getGlobalMap = (envs, envName) => {
      const target = envs.find(e => e.name === envName);
      if (!target || !target.global) return {};
      return Object.fromEntries(target.global.map(({ name, value }) => [name, value]));
    };

    // 使用示例
    const globalArr = getGlobalMap(interfaceData.env, env);
    console.log('globalArr', globalArr)
    if (!interfaceData.enable_script) {
      validRes.push({ message: 2 });
      return
    }
    try {
      let test = await axios.post('/api/col/run_script', {
        response: response,
        records: this.records,
        script: interfaceData.test_script,
        params: requestParams,
        col_id: this.props.currColId,
        interface_id: interfaceData.interface_id,
        vars: scriptVars,
        global: globalArr
      });
      validRes.push({message : test.data.errcode})
      test.data.data.logs.forEach(item => {
        validRes.push({ message: item });
      });
      // ✅ 变量注入到 scriptVars（引用类型）
      Object.assign(scriptVars, test.data.data.vars || {});
    } catch (err) {
      validRes.push({
        message: 'Error: ' + err.message
      });
    }
  };
  // val 请求体的每个值 替换值
  handleValue = (val, global) => {
    let globalValue = ArrayToObject(global);
    let context = Object.assign({}, { global: globalValue }, this.records);
    return handleParamsValue(val, context);
  };

  arrToObj = (arr, requestParams) => {
    arr = arr || [];
    const obj = {};
    arr.forEach(item => {
      if (item.name && item.enable && item.type !== 'file') {
        obj[item.name] = this.handleValue(item.value);
        if (requestParams) {
          requestParams[item.name] = obj[item.name];
        }
      }
    });
    return obj;
  };

  onRow(row) {
    return { rowId: row.id, onMove: this.onMoveRow, onDrop: this.onDrop };
  }

  onDrop = () => {
    let changes = [];
    this.state.rows.forEach((item, index) => {
      changes.push({ id: item._id, index: index });
    });
    axios.post('/api/col/up_case_index', changes).then(() => {
      this.props.fetchInterfaceColList(this.props.match.params.id);
    });
  };
  onMoveRow({ sourceRowId, targetRowId }) {
    let rows = dnd.moveRows({ sourceRowId, targetRowId })(this.state.rows);

    if (rows) {
      this.setState({ rows });
    }
  }

  onChangeTest = d => {

    this.setState({
      commonSetting: {
        ...this.state.commonSetting,
        checkScript: {
          ...this.state.commonSetting.checkScript,
          content: d.text
        }
      }
    });
  };

  handleInsertCode = code => {
    this.aceEditor.editor.insertCode(code);
  };

  async componentWillReceiveProps(nextProps) {
    let newColId = !isNaN(nextProps.match.params.actionId) ? +nextProps.match.params.actionId : 0;

    if (newColId && ((this.currColId && newColId !== this.currColId) || nextProps.isRander)) {
      this.currColId = newColId;
      this.handleColIdChange(newColId)
    }
  }

  // 测试用例环境面板折叠
  changeCollapseClose = key => {
    if (key) {
      this.setState({
        collapseKey: key
      });
    } else {
      this.setState({
        collapseKey: '1',
        currColEnvObj: {}
      });
    }
  };

  openReport = id => {
    if (!this.reports[id]) {
      return message.warn('还没有生成报告');
    }
    this.setState({ visible: true, curCaseid: id });
  };

  openAdv = id => {
    let findCase = _.find(this.props.currCaseList, item => item.id === id);

    this.setState({
      enableScript: findCase.enable_script,
      curScript: findCase.test_script,
      advVisible: true,
      curCaseid: id
    });
  };

  handleScriptChange = d => {
    this.setState({ curScript: d.text });
  };

  handleAdvCancel = () => {
    this.setState({ advVisible: false });
  };

  handleAdvOk = async () => {
    const { curCaseid, enableScript, curScript } = this.state;
    const res = await axios.post('/api/col/up_case', {
      id: curCaseid,
      test_script: curScript,
      enable_script: enableScript
    });
    if (res.data.errcode === 0) {
      message.success('更新成功');
    }
    this.setState({ advVisible: false });
    let currColId = this.currColId;
    this.props.setColData({
      currColId: +currColId,
      isShowCol: true,
      isRander: false
    });
    await this.props.fetchCaseList(currColId);

    this.handleColdata(this.props.currCaseList);
  };

  handleCancel = () => {
    this.setState({ visible: false });
  };

  currProjectEnvChange = (envName, project_id) => {
    let currColEnvObj = {
      ...this.state.currColEnvObj,
      [project_id]: envName
    };
    this.setState({ currColEnvObj });
    // this.handleColdata(this.props.currCaseList, envName, project_id);
    this.handleColdata(this.props.currCaseList,currColEnvObj);
  };

  autoTests = () => {
    this.setState({ autoVisible: true, currColEnvObj: {}, collapseKey: '' });
  };

  handleAuto = () => {
    this.setState({
      autoVisible: false,
      email: false,
      download: false,
      mode: 'html',
      currColEnvObj: {},
      collapseKey: ''
    });
  };

  copyUrl = url => {
    copy(url);
    message.success('已经成功复制到剪切板');
  };

  modeChange = mode => {
    this.setState({ mode });
  };

  emailChange = email => {
    this.setState({ email });
  };

  downloadChange = download => {
    this.setState({ download });
  };

  handleColEnvObj = envObj => {
    let str = '';
    for (let key in envObj) {
      str += envObj[key] ? `&env_${key}=${envObj[key]}` : '';
    }
    return str;
  };

  handleCommonSetting = ()=>{
    let setting = this.state.commonSetting;

    let params = {
      col_id: this.props.currColId,
      ...setting

    };

    axios.post('/api/col/up_col', params).then(async res => {
      if (res.data.errcode) {
        return message.error(res.data.errmsg);
      }
      message.success('配置测试集成功');
    });

    this.setState({
      commonSettingModalVisible: false
    })
  }

  cancelCommonSetting = ()=>{
    this.setState({
      commonSettingModalVisible: false
    })
  }

  openCommonSetting = ()=>{
    this.setState({
      commonSettingModalVisible: true
    })
  }

  changeCommonFieldSetting = (key)=>{
    return (e)=>{
      let value = e;
      if(typeof e === 'object' && e){
        value = e.target.value;
      }
      let {checkResponseField} = this.state.commonSetting;
      this.setState({
        commonSetting: {
          ...this.state.commonSetting,
          checkResponseField: {
            ...checkResponseField,
            [key]: value
          }
        }
      })
    }
  }
  isAllSelected = () => {
    const { rows } = this.state;
    return rows.length > 0 && rows.every(row => this.state.selectedIds.includes(row._id));
  };

  // 处理全选点击事件
  handleSelectAll = () => {
    const { rows } = this.state;
    const allSelected = this.isAllSelected();
    const selectedIds = allSelected ? [] : rows.map(row => row._id);
    this.setState({ selectedIds });
  };

  // 处理单个选择事件
  handleSelectRow = (id) => {
    const { selectedIds } = this.state;
    const next = selectedIds.includes(id)
        ? selectedIds.filter(item => item !== id)
        : [...selectedIds, id];
    this.setState({ selectedIds: next });
  };

  // 切换启用状态
  handleToggleEnableScript = async (id, checked) => {
    // 更新数据的方法，例如：
    const prevRows = [...this.state.rows];
    let colId = prevRows[0].col_id
    const newRows = this.state.rows.map(item =>
        item._id === id ? {...item, enable_async: checked} : item
    );
    this.setState({rows: newRows});
    console.log("查看开关的参数", id, checked);
    const params = {
      id: id,
      enable_async: checked
    }
    try {
      let result = await axios.post('/api/col/up_case', params);
      if (result.data.errcode === 0) {
        message.success('修改成功')
        await this.props.fetchCaseList(colId);
      } else {
        message.error(result.data.errmsg || '修改失败');
        this.setState({ rows: prevRows });
      }
    } catch (error) {
      message.error('网络异常，请稍后重试');
      console.log(error)
      this.setState({ rows: prevRows });
    }
  };


  render() {
    const {
      loading,
      hasPlugin
    } = this.state;
    const currProjectId = this.props.currProject._id;
    const columns = [
      {
        header: {
          label: (
            <input
                  type="checkbox"
                  checked={this.isAllSelected()}
                  onChange={this.handleSelectAll}
                  style={{
                    accentColor: 'green' // ✅ 现代浏览器支持自定义 checkbox 颜色
                  }}
              />
          )
        },
        cell: {
          formatters: [
            (text, { rowData }) => {
              return (
                <input
                      type="checkbox"
                      checked={this.state.selectedIds.includes(rowData._id)}
                      onChange={() => this.handleSelectRow(rowData._id)}
                      style={{
                        accentColor: 'green'  // ✅ 现代浏览器支持自定义 checkbox 颜色
                      }}
                  />
              );
            }
          ]
        },
        props: {
          style: { width: '50px' }
        }
      },
      {
        property: 'casename',
        header: {
          label: '用例名称'
        },
        props: {
          style: {
            width: '250px'
          }
        },
        cell: {
          formatters: [
            (text, { rowData }) => {
              let record = rowData;
              return (
                <Link to={'/project/' + currProjectId + '/interface/case/' + record._id}>
                  {record.casename && record.casename.length > 23
                        ? record.casename.substr(0, 20) + '...'
                        : record.casename}
                </Link>
              );
            }
          ]
        }
      },
      {
        header: {
          label: 'key',
          formatters: [
            () => {
              return (
                <Tooltip
                      title={
                        <span>
                          {' '}
                          每个用例都有唯一的key，用于获取所匹配接口的响应数据，例如使用{' '}
                          <a
                              href="https://hellosean1025.github.io/yapi/documents/case.html#%E7%AC%AC%E4%BA%8C%E6%AD%A5%EF%BC%8C%E7%BC%96%E8%BE%91%E6%B5%8B%E8%AF%95%E7%94%A8%E4%BE%8B"
                              className="link-tooltip"
                              target="blank"
                          >
                            {' '}
                            变量参数{' '}
                          </a>{' '}
                          功能{' '}
                        </span>
                      }
                  >
                  Key
                </Tooltip>
              );
            }
          ]
        },
        props: {
          style: {
            width: '350px'
          }
        },
        cell: {
          formatters: [
            (value, { rowData }) => {
              return <span>{rowData._id}</span>;
            }
          ]
        }
      },
      {
        property: 'test_status',
        header: {
          label: '状态'
        },
        props: {
          style: {
            width: '350px'
          }
        },
        cell: {
          formatters: [
            (value, { rowData }) => {
              let id = rowData._id;
              let code = this.reports[id] ? this.reports[id].code : undefined;
              if (rowData.test_status === 'loading') {
                return (
                  <div>
                    <Spin />
                  </div>
                );
              }
              if (code === undefined || code === null) {
                return <div style={{ minHeight: 16 }} />;
              }

              switch (code) {
                case 0:
                  return (
                    <div>
                      <Tooltip title="Pass">
                        <Icon
                              style={{
                                color: '#00a854'
                              }}
                              type="check-circle"
                          />
                      </Tooltip>
                    </div>
                  );
                case 400:
                  return (
                    <div>
                      <Tooltip title="请求异常">
                        <Icon
                              type="info-circle"
                              style={{
                                color: '#f04134'
                              }}
                          />
                      </Tooltip>
                    </div>
                  );
                case 1:
                  return (
                    <div>
                      <Tooltip title="验证失败">
                        <Icon
                              type="exclamation-circle"
                              style={{
                                color: '#ffbf00'
                              }}
                          />
                      </Tooltip>
                    </div>
                  );
                default:
                  return (
                    <div>
                      <Icon
                            style={{
                              color: '#00a854'
                            }}
                            type="check-circle"
                        />
                    </div>
                  );
              }
            }
          ]
        }
      },
      {
        property: 'path',
        header: {
          label: '接口路径'
        },
        props: {
          style: {
            width: '350px',
            textAlign: 'center'
          }
        },
        cell: {
          formatters: [
            (text, { rowData }) => {
              let record = rowData;
              return (
                <Tooltip title="跳转到对应接口">
                  <Link to={`/project/${record.project_id}/interface/api/${record.interface_id}`}>
                    {record.path && record.path.length > 23 ? record.path + '...' : record.path}
                  </Link>
                </Tooltip>
              );
            }
          ]
        }
      },
      {
        property: 'enable_async',
        header: {
          label: '是否异步'
        },
        props: {
          style: {
            width: '350px',
            textAlign: 'center'
          }
        },
        cell: {
          formatters: [
            (value, { rowData }) => {
              return (
                <Switch
                      checked={rowData.enable_async}
                      onChange={(checked) => {
                        console.log('切换开关', rowData._id, '为', checked);
                        // 在此处调用修改方法，例如传入 rowData._id 与新值 checked
                        this.handleToggleEnableScript(rowData._id, checked);
                      }}
                  />
              );
            }
          ]
        }
      },
      {
        header: {
          label: '测试报告'
        },
        props: {
          style: {
            width: '200px'
          }
        },
        cell: {
          formatters: [
            (text, { rowData }) => {
              let reportFun = () => {
                if (!this.reports[rowData.id]) {
                  return null;
                }
                return <Button onClick={() => this.openReport(rowData.id)}>测试报告</Button>;
              };
              return <div className="interface-col-table-action">{reportFun()}</div>;
            }
          ]
        }
      }
    ];
    const { rows } = this.state;
    const components = {
      header: {
        cell: dnd.Header
      },
      body: {
        row: dnd.Row
      }
    };
    const resolvedColumns = resolve.columnChildren({ columns });
    const resolvedRows = resolve.resolve({ columns: resolvedColumns, method: resolve.nested })(
        rows
    );

    const localUrl =
        location.protocol +
        '//' +
        location.hostname +
        (location.port !== '' ? ':' + location.port : '');
    let currColEnvObj = this.handleColEnvObj(this.state.currColEnvObj);
    const autoTestsUrl = `/api/open/run_auto_test?id=${this.props.currColId}&token=${
        this.props.token
    }${currColEnvObj ? currColEnvObj : ''}&mode=${this.state.mode}&email=${
        this.state.email
    }&download=${this.state.download}`;

    let col_name = '';
    let col_desc = '';

    for (var i = 0; i < this.props.interfaceColList.length; i++) {
      if (this.props.interfaceColList[i]._id === this.props.currColId) {
        col_name = this.props.interfaceColList[i].name;
        col_desc = this.props.interfaceColList[i].desc;
        break;
      }
    }

    return (
      <div className="interface-col">
        <Modal
              title="通用规则配置"
              visible={this.state.commonSettingModalVisible}
              onOk={this.handleCommonSetting}
              onCancel={this.cancelCommonSetting}
              width={'1000px'}
              style={defaultModalStyle}
          >
          <div className="common-setting-modal">
            <Row className="setting-item">
              <Col className="col-item" span="4">
                <label>检查HttpCode:&nbsp;<Tooltip title={'检查 http code 是否为 200'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col className="col-item"  span="18">
                <Switch onChange={e=>{
                    let {commonSetting} = this.state;
                    this.setState({
                      commonSetting :{
                        ...commonSetting,
                        checkHttpCodeIs200: e
                      }
                    })
                  }} checked={this.state.commonSetting.checkHttpCodeIs200}  checkedChildren="开" unCheckedChildren="关" />
              </Col>
            </Row>

            <Row className="setting-item">
              <Col className="col-item"  span="4">
                <label>检查返回json:&nbsp;<Tooltip title={'检查接口返回数据字段值，比如检查 code 是不是等于 0'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col  className="col-item" span="6">
                <Input value={this.state.commonSetting.checkResponseField.name} onChange={this.changeCommonFieldSetting('name')} placeholder="字段名"  />
              </Col>
              <Col  className="col-item" span="6">
                <Input  onChange={this.changeCommonFieldSetting('value')}  value={this.state.commonSetting.checkResponseField.value}   placeholder="值"  />
              </Col>
              <Col  className="col-item" span="6">
                <Switch  onChange={this.changeCommonFieldSetting('enable')}  checked={this.state.commonSetting.checkResponseField.enable}  checkedChildren="开" unCheckedChildren="关"  />
              </Col>
            </Row>

            <Row className="setting-item">
              <Col className="col-item" span="4">
                <label>检查返回数据结构:&nbsp;<Tooltip title={'只有 response 基于 json-schema 方式定义，该检查才会生效'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col className="col-item"  span="18">
                <Switch onChange={e=>{
                    let {commonSetting} = this.state;
                    this.setState({
                      commonSetting :{
                        ...commonSetting,
                        checkResponseSchema: e
                      }
                    })
                  }} checked={this.state.commonSetting.checkResponseSchema}  checkedChildren="开" unCheckedChildren="关" />
              </Col>
            </Row>

            <Row className="setting-item">
              <Col className="col-item  " span="4">
                <label>全局测试脚本:&nbsp;<Tooltip title={'在跑自动化测试时，优先调用全局脚本，只有全局脚本通过测试，才会开始跑case自定义的测试脚本'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col className="col-item" span="14">
                <div><Switch onChange={e=>{
                    let {commonSetting} = this.state;
                    this.setState({
                      commonSetting :{
                        ...commonSetting,
                        checkScript: {
                          ...this.state.checkScript,
                          enable: e
                        }
                      }
                    })
                  }} checked={this.state.commonSetting.checkScript.enable}  checkedChildren="开" unCheckedChildren="关"  /></div>

                <AceEditor
                      onChange={this.onChangeTest}
                      className="case-script"
                      data={this.state.commonSetting.checkScript.content}
                      ref={aceEditor => {
                        this.aceEditor = aceEditor;
                      }}
                  />
              </Col>
              <Col span="6">
                <div className="insert-code">
                  {InsertCodeMap.map(item => {
                      return (
                        <div
                              style={{ cursor: 'pointer' }}
                              className="code-item"
                              key={item.title}
                              onClick={() => {
                                this.handleInsertCode('\n' + item.code);
                              }}
                          >
                          {item.title}
                        </div>
                      );
                    })}
                </div>
              </Col>
            </Row>


          </div>
        </Modal>
        <Row type="flex" justify="center" align="top">
          <Col span={5}>
            <h2
                  className="interface-title"
                  style={{
                    display: 'inline-block',
                    margin: '8px 20px 16px 0px'
                  }}
              >
              测试集合 <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://hellosean1025.github.io/yapi/documents/case.html"
              >
                <Tooltip title="点击查看文档">
                  <Icon type="question-circle-o" />
                </Tooltip>
              </a>
            </h2>
          </Col>
          <Col span={10}>
            <CaseEnv
                  envList={this.props.envList}
                  currProjectEnvChange={this.currProjectEnvChange}
                  envValue={this.state.currColEnvObj}
                  collapseKey={this.state.collapseKey}
                  changeClose={this.changeCollapseClose}
              />
          </Col>
          <Col span={9}>
            {this.state.hasPlugin ? (
              <div
                      style={{
                        float: 'right',
                        paddingTop: '8px'
                      }}
                  >
                {this.props.curProjectRole !== 'guest' && (
                <Tooltip title="在 YApi 服务端跑自动化测试，测试环境不能为私有网络，请确保 YApi 服务器可以访问到自动化测试环境domain">
                  <Button
                              style={{
                                marginRight: '8px'
                              }}
                              onClick={this.autoTests}
                          >
                    服务端测试
                  </Button>
                </Tooltip>
                    )}
                <Button onClick={this.openCommonSetting} style={{
                      marginRight: '8px'
                    }} >通用规则配置</Button>
                    &nbsp;
                <Button
                        type="primary"
                        onClick={this.executeTests}      // 原来的方法
                        disabled={!hasPlugin}            // 根据条件禁用
                        style={{ marginLeft: 10 }}       // 样式
                        icon={loading ? 'loading' : ''} // 图标，loading 时显示加载
                    >
                  {/*根据 loading 状态切换*/}
                  {loading ? '取消' : '开始测试'}
                </Button>
              </div>
              ) : (
                <Tooltip title="请安装 cross-request Chrome 插件">
                  <Button
                        disabled
                        type="primary"
                        style={{
                          float: 'right',
                          marginTop: '8px'
                        }}
                    >
                    开始测试
                  </Button>
                </Tooltip>
              )}
          </Col>
        </Row>

        <div className="component-label-wrapper">
          <Label onChange={val => this.handleChangeInterfaceCol(val, col_name)} desc={col_desc} />
        </div>

        <Table.Provider
              components={components}
              columns={resolvedColumns}
              style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}
          >
          <Table.Header
                className="interface-col-table-header"
                headerRows={resolve.headerRows({ columns })}
            />

          <Table.Body
                className="interface-col-table-body"
                rows={resolvedRows}
                rowKey="_id"
                onRow={this.onRow}
            />
        </Table.Provider>
        <Modal
              title="测试报告"
              width="900px"
              style={{
                minHeight: '500px'
              }}
              visible={this.state.visible}
              onCancel={this.handleCancel}
              footer={null}
          >
          <CaseReport {...this.reports[this.state.curCaseid]} />
        </Modal>

        <Modal
              title="自定义测试脚本"
              width="660px"
              style={{
                minHeight: '500px'
              }}
              visible={this.state.advVisible}
              onCancel={this.handleAdvCancel}
              onOk={this.handleAdvOk}
              maskClosable={false}
          >
          <h3>
            是否开启:
            <Switch
                  checked={this.state.enableScript}
                  onChange={e => this.setState({ enableScript: e })}
              />
          </h3>
          <AceEditor
                className="case-script"
                data={this.state.curScript}
                onChange={this.handleScriptChange}
            />
        </Modal>
        {this.state.autoVisible && (
          <Modal
                  title="服务端自动化测试"
                  width="780px"
                  style={{
                    minHeight: '500px'
                  }}
                  visible={this.state.autoVisible}
                  onCancel={this.handleAuto}
                  className="autoTestsModal"
                  footer={null}
              >
            <Row type="flex" justify="space-around" className="row" align="top">
              <Col span={3} className="label" style={{ paddingTop: '16px' }}>
                选择环境
                <Tooltip title="默认使用测试用例选择的环境">
                  <Icon type="question-circle-o" />
                </Tooltip>
                    &nbsp;：
              </Col>
              <Col span={21}>
                <CaseEnv
                        envList={this.props.envList}
                        currProjectEnvChange={this.currProjectEnvChange}
                        envValue={this.state.currColEnvObj}
                        collapseKey={this.state.collapseKey}
                        changeClose={this.changeCollapseClose}
                    />
              </Col>
            </Row>
            <Row type="flex" justify="space-around" className="row" align="middle">
              <Col span={3} className="label">
                输出格式：
              </Col>
              <Col span={21}>
                <Select value={this.state.mode} onChange={this.modeChange}>
                  <Option key="html" value="html">
                    html
                  </Option>
                  <Option key="json" value="json">
                    json
                  </Option>
                </Select>
              </Col>
            </Row>
            <Row type="flex" justify="space-around" className="row" align="middle">
              <Col span={3} className="label">
                消息通知
                <Tooltip title={'测试不通过时，会给项目组成员发送消息通知'}>
                  <Icon
                          type="question-circle-o"
                          style={{
                            width: '10px'
                          }}
                      />
                </Tooltip>
                    &nbsp;：
              </Col>
              <Col span={21}>
                <Switch
                        checked={this.state.email}
                        checkedChildren="开"
                        unCheckedChildren="关"
                        onChange={this.emailChange}
                    />
              </Col>
            </Row>
            <Row type="flex" justify="space-around" className="row" align="middle">
              <Col span={3} className="label">
                下载数据
                <Tooltip title={'开启后，测试数据将被下载到本地'}>
                  <Icon
                          type="question-circle-o"
                          style={{
                            width: '10px'
                          }}
                      />
                </Tooltip>
                    &nbsp;：
              </Col>
              <Col span={21}>
                <Switch
                        checked={this.state.download}
                        checkedChildren="开"
                        unCheckedChildren="关"
                        onChange={this.downloadChange}
                    />
              </Col>
            </Row>
            <Row type="flex" justify="space-around" className="row" align="middle">
              <Col span={21} className="autoTestUrl">
                <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={localUrl + autoTestsUrl} >
                  {autoTestsUrl}
                </a>
              </Col>
              <Col span={3}>
                <Button className="copy-btn" onClick={() => this.copyUrl(localUrl + autoTestsUrl)}>
                  复制
                </Button>
              </Col>
            </Row>
            <div className="autoTestMsg">
              注：访问该URL，可以测试所有用例，请确保YApi服务器可以访问到环境配置的 domain
            </div>
          </Modal>
          )}
      </div>
    );
  }
}

export default InterfaceColContent;
