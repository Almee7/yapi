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
export default class InterfaceColContent extends Component {
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
      groupData:{},
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
    this.isComponentMounted = true; // 添加组件挂载状态标识
    this.onRow = this.onRow.bind(this);
    this.onMoveRow = this.onMoveRow.bind(this);
  }

  handleColIdChange = async (newColId) => {
    // 获取当前集合信息以确定是否为 ref 类型
    const currentCol = this.props.interfaceColList.find(col => col._id === +newColId);

    // 如果是 ref 类型集合，使用其 source_id
    const targetColId = (currentCol && currentCol.type === 'ref' && currentCol.source_id)
      ? currentCol.source_id
      : newColId;

    this.props.setColData({
      currColId: +newColId,
      isShowCol: true,
      isRander: false
    });
    let result = await this.props.fetchCaseList(targetColId);
    if (result.payload.data.errcode === 0) {
      this.reports = handleReport(result.payload.data.colData.test_report);
      this.setState({
        groupData: result.payload.data.groupData,
        commonSetting:{
          ...this.state.commonSetting,
          ...result.payload.data.colData
        }
      })
    }

    // 注意：这里应该使用 targetColId 而不是重复调用
    // await this.props.fetchCaseList(targetColId);
    await this.props.fetchCaseEnvList(targetColId);
    this.changeCollapseClose();
    // 使用从接口获取的 currCaseList 来更新数据
    this.handleColdata(this.props.currCaseList);
  }

  async componentWillMount() {
    const result = await this.props.fetchInterfaceColList(this.props.match.params.id);
    await this.props.getToken(this.props.match.params.id);
    let { currColId } = this.props;
    const params = this.props.match.params;
    const { actionId } = params;
    this.currColId = currColId = +actionId || result.payload.data.data[0]._id;
    this.props.history.push('/project/' + params.id + '/interface/col/' + currColId);
    if (currColId && currColId != 0) {
      await this.handleColIdChange(currColId)
    }

    this._crossRequestInterval = initCrossRequest(hasPlugin => {
      this.setState({ hasPlugin: hasPlugin });
    });

    // 移除事件监听器相关代码，因为我们将使用 Redux 状态管理
  }

    componentWillUnmount() {
        clearInterval(this._crossRequestInterval);
        this.isComponentMounted = false; // 设置组件挂载状态为false
        // 取消所有未完成的请求
        Object.values(this.cancelTokens).forEach(source => {
            source.cancel('组件已卸载');
        });
        this.cancelTokens = {};
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


  // 保存测试报告到数据库
  saveTestReport = async (startTime, endTime, executionOrder) => {
    const reports = this.reports;
    
    // 统计总数、成功数、失败数
    let total = 0;
    let success = 0;
    let failed = 0;
    
    Object.values(reports).forEach(report => {
      total++;
      if (report.code === 0) {
        success++;
      } else {
        failed++;
      }
    });
    
    // 获取当前集合信息
    const colData = this.props.interfaceColList.find(col => col._id === this.props.currColId);
    console.log('colData:', colData);
    const col_name = colData ? colData.name : '未知集合';
    
    // 获取环境名称 - 修复环境获取逻辑
    const envNames = [];
    const currColEnvObj = this.state.currColEnvObj;
    // 遍历每个项目的环境配置
    Object.keys(currColEnvObj).forEach(projectId => {
      const envId = currColEnvObj[projectId];
      if (envId) {
        // 查找对应项目的环境列表
        const projectEnv = this.props.envList.find(env => env._id == projectId);
        if (projectEnv && projectEnv.env) {
          // 在环境列表中查找选中的环境
          const selectedEnv = projectEnv.env.find(e => e.name === envId);
          if (selectedEnv) {
            envNames.push(selectedEnv.name);
          }
        }
      }
    });

    const env_name = envNames.length > 0 ? envNames.join(', ') : '默认环境';
    
    // 计算总执行时间
    const run_time = ((endTime - startTime) / 1000).toFixed(2) + 's';
    
    // 按照执行顺序构建有序的测试结果数组
    const orderedTestResults = executionOrder.map(id => ({
      id,
      ...reports[id]
    })).filter(item => item.code !== undefined); // 过滤掉没有结果的用例
    
    try {
      await axios.post('/api/test_report/save', {
        col_id: this.props.currColId,
        col_name,
        project_id: this.props.match.params.id,
        env_name,
        total,
        success,
        failed,
        run_time,
        test_result: orderedTestResults // 保存为有序数组
      });
    } catch (e) {
      console.error('保存测试报告失败', e);
    }
  };

  // 查看报告记录列表
  viewReportList = () => {
    const projectId = this.props.match.params.id;
    const colId = this.props.currColId;
    const url = `/project/${projectId}/interface/col/${colId}/report-list?standalone=true`;
    window.open(url, '_blank');
  };

  //开始测试入口
  executeTests = async () => {
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
    console.log('selectedIds:', selectedIds);
    if (!selectedIds.length) {
      message.warning("请先选择用例");
      return;
    }
    console.log("开始测试时的集合参数", this.state)
    // 记录开始时间
    const startTime = Date.now();

    // 开始测试前清空状态
    this.setState({
      loading: true,
      rows: this.state.rows.map(row => ({ ...row, loading: '' }))
    });
    this.reports = {};
    
    // 清空变量存储，确保每次测试都是全新的开始
    scriptVars = {};
    
    await Promise.resolve(); // 让 React 立即渲染按钮状态

    const rows_w = {};
    const asyncTasks = []; // 存放异步 case 的 Promise
    const executionOrder = []; // 记录执行顺序

    // 处理分组循环执行逻辑
    let executionRows = [];
    const groupData = this.state.groupData; // 从 this.state.groupData 获取分组数据

    // 检查是否有循环组
    const hasLoopGroups = Array.isArray(groupData) && groupData.length > 0 && groupData.some(group => group.repeatCount >= 1);

    
    if (hasLoopGroups) {
      // 有循环组数据，需要循环执行
      const loopGroups = groupData.filter(group => group.repeatCount >= 1);
      // 创建循环组映射：group_id -> repeatCount
      const loopGroupMap = {};
      loopGroups.forEach(group => {
        loopGroupMap[group._id] = group.repeatCount;
      });
      
      // 收集循环组中的所有用例，并按group_id和index分组
      const loopGroupCases = {};
      this.state.rows.forEach(row => {
        if (row.group_id && loopGroupMap[row.group_id]) {
          if (!loopGroupCases[row.group_id]) {
            loopGroupCases[row.group_id] = [];
          }
          loopGroupCases[row.group_id].push(row);
        }
      });
      
      // 确保循环组内的用例按index排序
      Object.keys(loopGroupCases).forEach(groupId => {
        loopGroupCases[groupId].sort((a, b) => a.index - b.index);
      });
      
      // 按照原始顺序处理用例
      for (let i = 0; i < this.state.rows.length; i++) {
        const row = this.state.rows[i];
        
        // 只处理选中的用例
        if (!selectedIds.includes(row._id)) {
          continue;
        }
        
        // 检查该用例是否属于循环组
        const repeatCount = loopGroupMap[row.group_id];
        
        if (typeof repeatCount !== 'undefined' && repeatCount >= 1) {
          // 属于循环组，检查是否是该组的第一个用例
          const groupCases = loopGroupCases[row.group_id] || [];
          const isFirstInGroup = groupCases.length > 0 && groupCases[0]._id === row._id;
          
          if (isFirstInGroup) {
            // 是循环组的第一个用例，展开整个组
            for (let loopIndex = 0; loopIndex < repeatCount; loopIndex++) {
              groupCases.forEach(caseRow => {
                if (loopIndex === 0) {
                  // 第一次循环使用原始ID
                  executionRows.push({ ...caseRow, repeatIndex: 0 });
                } else {
                  // 后续循环使用带后缀的ID
                  executionRows.push({ 
                    ...caseRow, 
                    _id: `${caseRow._id}-${loopIndex}`,
                    repeatIndex: loopIndex,
                    originalId: caseRow._id
                  });
                }
              });
            }
          }
          // 如果不是第一个用例，在第一次循环时已经被处理过了，所以跳过
        } else {
          // 不属于循环组，直接添加
          executionRows.push({ ...row });
        }
      }
    } else {
      // 没有循环组数据，按正常流程执行
      executionRows = this.state.rows.filter(row => selectedIds.includes(row._id));
    }
    // 执行测试用例
    for (let i = 0; i < executionRows.length; i++) {
      if (!this.state.loading || !this.isComponentMounted) break; // 已取消或组件已卸载

      const curRow = executionRows[i];
      rows_w[curRow._id] = curRow;
      // 记录执行顺序
      executionOrder.push(curRow._id);

      const envItem = _.find(this.props.envList, item => item._id === curRow.project_id);

      const curitem = {
        ...curRow,
        env: envItem.env,
        pre_script: this.props.currProject.pre_script,
        after_script: this.props.currProject.after_script,
        test_status: 'loading'
      };
      
      // 更新 UI 状态
      const originalIndex = this.state.rows.findIndex(r => r._id === (curRow.originalId || curRow._id));
      if (originalIndex !== -1) {
        // 检查组件是否仍然挂载
        if (this.isComponentMounted) {
          this.setState(prev => {
            const newRows = [...prev.rows];
            newRows[originalIndex] = { ...curitem, test_status: curitem.test_status };
            return { rows: newRows };
          });
        }
      }

      // 根据 enable_async 决定是否 await
      if (curitem.enable_async) {
        asyncTasks.push(this.runCase(curitem, originalIndex)); // 异步收集 Promise
      } else {
        await this.runCase(curitem, originalIndex); // 同步阻塞
        
        // 检查组件是否仍然挂载
        if (!this.isComponentMounted) {
          break; // 组件已卸载，停止执行
        }

        // 添加步骤间隔时间延迟（除了最后一个用例）
        if (this.state.commonSetting.intervalTime > 0 && i < executionRows.length - 1) {
          await new Promise(resolve => setTimeout(resolve, this.state.commonSetting.intervalTime));
        }
      }
      let reportsId = curitem._id;
      let resultCode = this.reports[reportsId] ? this.reports[reportsId].code : undefined;
      if(this.state.commonSetting.stopFail && resultCode !== 0) break; //是否终止执行
    }
    // 等待所有异步 case 完成
    if (asyncTasks.length) {
      // 使用 Promise.allSettled 确保即使有错误也继续执行
      const results = await Promise.allSettled(asyncTasks);
      // 检查是否有未处理的错误
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`异步任务 ${index} 失败:`, result.reason);
        }
      });
    }

    // 记录结束时间
    const endTime = Date.now();

    // 检查组件是否仍然挂载
    if (!this.isComponentMounted) {
      return;
    }

    // 全部接口执行完再上传报告
    if (this.state.loading) {
      await axios.post('/api/col/up_col', {
        col_id: this.props.currColId,
        test_report: JSON.stringify(this.reports)
      });
      // 保存测试报告到数据库，传入开始和结束时间以及执行顺序
      await this.saveTestReport(startTime, endTime, executionOrder);
    }

    // 检查组件是否仍然挂载
    if (this.isComponentMounted) {
      this.setState({ loading: false });
    }
    this.cancelTokens = {}; // 清理 cancelTokens
  };


  // 统一用例执行方法
  runCase = async (curitem, index) => {
    console.log("runCase", curitem)
    let result, status = 'error';
    // 创建 cancelToken
    let source = axios.CancelToken.source();
    this.cancelTokens[curitem._id] = source;

    // 记录开始时间
    const caseStartTime = Date.now();

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

    // 记录结束时间并计算执行时间
    const caseEndTime = Date.now();
    const executionTime = (caseEndTime - caseStartTime) + 'ms';

    delete this.cancelTokens[curitem._id];

    // 检查组件是否仍然挂载
    if (!this.isComponentMounted) {
      return;
    }

    // 更新 reports / records，添加执行时间和用例名称
    this.reports[curitem._id] = {
      ...result,
      casename: curitem.casename, // 添加用例名称
      name: curitem.casename, // 兼容两种字段名
      executionTime // 添加执行时间
    };
    this.records[curitem._id] = {
      status: result.status,
      params: result.params,
      body: result.res_body
    };

    // 检查组件是否仍然挂载
    if (this.isComponentMounted) {
      // 更新 UI 状态
      const newRows = [...this.state.rows];
      newRows[index] = { ...curitem, test_status: status };
      this.setState({ rows: newRows });
    }
  };


  handleWSTest = async interfaceData => {
    let result = {
      code: 400,
      msg: '数据异常',
      validRes: []
    };
    let requestParams = {};
    let options = await handleParams(interfaceData, this.handleValue, requestParams);
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
    let options = await handleParams(interfaceData, this.handleValue, requestParams);
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

    let env = interfaceData.case_env
    const getGlobalMap = (envs, envName) => {
      const target = envs.find(e => e.name === envName);
      if (!target || !target.global) return {};
      return Object.fromEntries(target.global.map(({ name, value }) => [name, value]));
    };
    const globalArr = getGlobalMap(interfaceData.env, env);
    const scripts = {
      enable: interfaceData.enable_script,
      content: interfaceData.test_script
    };
    // ✅ 判断是否启用测试脚本
    // 检查用例脚本是否启用
    if (!interfaceData.enable_script && (!interfaceData.test_script || interfaceData.test_script.trim() === '')) {
      // 还需要检查全局脚本
      const hasGlobalScript = this.state.commonSetting && 
                             this.state.commonSetting.checkScript && 
                             this.state.commonSetting.checkScript.enable && 
                             this.state.commonSetting.checkScript.content && 
                             this.state.commonSetting.checkScript.content.trim() !== '';
      
      // 如果既没有启用的用例脚本也没有启用的全局脚本，则标记为无脚本
      if (!hasGlobalScript) {
        validRes.push({ message: 2 });
        return;
      }
    }
    try {
      let test = await axios.post('/api/col/run_script', {
        response: response,
        records: this.records,
        scripts: scripts,
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
    // 确保 scriptVars 和 records 都被包含在上下文中
    let context = Object.assign({}, { global: globalValue, vars: scriptVars }, this.records);
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
    
    // 检查是否是case路由
    const isCaseRoute = nextProps.match.params.action === 'case';
    
    // 检测 colId 变化或者 isRander 标志
    if (!isCaseRoute && newColId && ((this.currColId && newColId !== this.currColId) || nextProps.isRander)) {
      this.currColId = newColId;
      this.handleColIdChange(newColId)
    }
    // 当 currCaseList 更新时,同步更新表格数据
    else if (nextProps.currCaseList !== this.props.currCaseList) {
      this.handleColdata(nextProps.currCaseList, this.state.currColEnvObj);
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

    // 获取当前集合信息以确定是否为 ref 类型
    const currentCol = this.props.interfaceColList.find(col => col._id === +currColId);

    // 如果是 ref 类型集合，使用其 source_id
    const targetColId = (currentCol && currentCol.type === 'ref' && currentCol.source_id)
      ? currentCol.source_id
      : currColId;

    this.props.setColData({
      currColId: +currColId,
      isShowCol: true,
      isRander: false
    });
    await this.props.fetchCaseList(targetColId);
    await this.props.fetchCaseEnvList(targetColId);

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
    const params = {
      id: id,
      enable_async: checked
    }
    try {
      let result = await axios.post('/api/col/up_case', params);
      if (result.data.errcode === 0) {
        message.success('修改成功')
        // 获取当前集合信息以确定是否为 ref 类型
        const currentCol = this.props.interfaceColList.find(col => col._id === +colId);

        // 如果是 ref 类型集合，使用其 source_id
        const targetColId = (currentCol && currentCol.type === 'ref' && currentCol.source_id)
          ? currentCol.source_id
          : colId;

        await this.props.fetchCaseList(targetColId);
        await this.props.fetchCaseEnvList(targetColId);
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
                <Link 
                  to={'/project/' + this.props.currProject._id + '/interface/case/' + record._id}
                  onClick={() => {
                    // 强制更新左侧菜单的选中状态
                    // 更新 Redux 状态，这将触发 InterfaceColMenu 组件的更新
                    this.props.setColData({
                      currCaseId: record._id,
                      isRander: false
                    });
                  }}
                >
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
                  <Link
                    to={`/project/${record.project_id}/interface/api/${record.interface_id}`}
                  >
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
              <Col className="col-item" span="4">
                <label>遇到失败时停止:&nbsp;
                  <Tooltip title="如果开启，接口失败会中断集合执行">
                    <Icon type="question-circle-o" style={{ width: '10px' }} />
                  </Tooltip>
                </label>
              </Col>
              <Col className="col-item"  span="18">
                <Switch onChange={e=>{
                  let {commonSetting} = this.state;
                  this.setState({
                    commonSetting :{
                      ...commonSetting,
                      stopFail: e
                    }
                  })
                }} checked={this.state.commonSetting.stopFail}  checkedChildren="开" unCheckedChildren="关" />
              </Col>
            </Row>

            {/* 添加间隔时间设置 */}
            <Row className="setting-item">
              <Col className="col-item" span="4">
                <label>步骤间隔时间:&nbsp;
                  <Tooltip title="每个测试步骤执行完成后等待的时间（毫秒），0表示不等待">
                    <Icon type="question-circle-o" style={{ width: '10px' }} />
                  </Tooltip>
                </label>
              </Col>
              <Col className="col-item" span="18">
                <Input
                  type="number"
                  min="0"
                  value={this.state.commonSetting.intervalTime || 0}
                  onChange={e => {
                    let value = parseInt(e.target.value) || 0;
                    let {commonSetting} = this.state;
                    this.setState({
                      commonSetting: {
                        ...commonSetting,
                        intervalTime: value
                      }
                    });
                  }}
                  addonAfter="毫秒"
                  style={{ width: '120px' }}
                />
              </Col>
            </Row>

            <Row className="setting-item">
              <Col className="col-item  " span="4">
                <label>全局测试脚本:&nbsp;<Tooltip title={'在跑自动化测试时，优先调用全局脚本，只有全局脚本通过测试，才会开始跑case自定义的测试脚本'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col className="col-item" span="14">
                <div><Switch
                    onChange={e => {
                      this.setState(prevState => ({
                        commonSetting: {
                          ...prevState.commonSetting,
                          checkScript: {
                            ...prevState.commonSetting.checkScript, // ✅ 保留原有内容
                            enable: e
                          }
                        }
                      }))
                    }}
                    checked={this.state.commonSetting.checkScript.enable}
                    checkedChildren="开"
                    unCheckedChildren="关"
                /></div>

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
              测试集合&nbsp;<a
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
                  <div style={{ display: 'inline-block' }}>
                    <Tooltip title="查看测试报告历史记录">
                      <Button
                              style={{
                                marginRight: '8px'
                              }}
                              onClick={this.viewReportList}
                          >
                        报告记录
                      </Button>
                    </Tooltip>
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
                  </div>
                  )}
                <Button
                      onClick={this.openCommonSetting}
                      style={{
                        marginRight: '8px'
                      }}
                  >
                  通用规则配置
                </Button>
                  &nbsp;
                <Button
                      type="primary"
                      onClick={this.executeTests}
                      disabled={!hasPlugin}
                      style={{ marginLeft: 10 }}
                      icon={loading ? 'loading' : ''}
                  >
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

        {/* 修改表格容器，添加固定高度和内部滚动 */}
        <div className="table-container" style={{
          height: 'calc(100vh - 220px)',
          overflow: 'auto',
          border: '1px solid #e8e8e8',
          borderRadius: '4px'
        }}>
          <style>{`
            .interface-col-table-body tr:nth-child(even) {
              background-color: #f5f5f5;
            }
            .interface-col-table-body tr:nth-child(odd) {
              background-color: #ffffff;
            }
          `}</style>
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
        </div>

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

// export default InterfaceColContent;
