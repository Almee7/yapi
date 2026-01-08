import React, { PureComponent as Component } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import PropTypes from 'prop-types';
import {
  fetchInterfaceColList,
  fetchInterfaceCaseList,
  setColData,
  fetchCaseList,
  fetchCaseData
} from '../../../../reducer/modules/interfaceCol';
import { fetchProjectList } from '../../../../reducer/modules/project';
import axios from 'axios';
import ImportInterface from './ImportInterface';
import ImportCol from './ImportCol';
import { Input, Icon, Button, Modal, message, Tooltip, Tree, Form ,Dropdown,Menu} from 'antd';

// eslint-disable-next-line no-unused-vars
import { arrayChangeIndex } from '../../../../common.js';
// import _ from 'underscore'

const TreeNode = Tree.TreeNode;
// const FormItem = Form.Item;
const confirm = Modal.confirm;
const headHeight = 180; // menu顶部到网页顶部部分的高度

import './InterfaceColMenu.scss';
import '../interface.scss';  // 引入接口模块的通用样式，包括 .anticon-ellipsis 的旋转样式

const ColModalForm = Form.create()(props => {
  const { visible, onCancel, onCreate, form, modalType, isSubDir } = props;
  const { getFieldDecorator } = form;

  const title = modalType === 'group'
      ? '循环组'
      : isSubDir
          ? '子目录'
          : '集合';

  return (
    <Modal visible={visible} title={`${title}`} onCancel={onCancel} onOk={onCreate}>
      <Form layout="vertical">
        <Form.Item label={title + '名称'}>
          {getFieldDecorator('colName', {
              rules: [{ required: true, message: `请输入${title}名称！` }]
            })(<Input />)}
        </Form.Item>

        {modalType !== 'group' && !isSubDir && (
          <Form.Item label="简介">{getFieldDecorator('colDesc')(<Input.TextArea />)}</Form.Item>
          )}

        {modalType === 'group' && (
          <Form.Item label="循环次数">
            {getFieldDecorator('repeatCount', {
                  initialValue: 1,
                  rules: [{ required: true, message: '请输入循环次数' }]
                })(<Input type="number" min={1} />)}
          </Form.Item>
          )}
      </Form>
    </Modal>
  );
});

@connect(
    state => {
      return {
        interfaceColList: state.interfaceCol.interfaceColList,
        currCase: state.interfaceCol.currCase,
        isRander: state.interfaceCol.isRander,
        currCaseId: state.interfaceCol.currCaseId,
        curProject: state.project.currProject
      };
    },
    {
      fetchInterfaceColList,
      fetchInterfaceCaseList,
      fetchCaseData,
      fetchCaseList,
      setColData,
      fetchProjectList
    }
)
@withRouter
export default class InterfaceColMenu extends Component {
  static propTypes = {
    match: PropTypes.object,
    interfaceColList: PropTypes.array,
    fetchInterfaceColList: PropTypes.func,
    fetchInterfaceCaseList: PropTypes.func,
    fetchCaseList: PropTypes.func,
    fetchCaseData: PropTypes.func,
    setColData: PropTypes.func,
    currCaseId: PropTypes.number,
    history: PropTypes.object,
    isRander: PropTypes.bool,
    currCase: PropTypes.object,
    curProject: PropTypes.object,
    fetchProjectList: PropTypes.func,
    location: PropTypes.object
  };

  state = {
    colModalType: '',
    colModalVisible: false,
    editColId: 0,
    filterValue: '',
    importInterVisible: false,
    importInterIds: [],
    importColVisible: false,
    importColList: [],
    importColId: 0,
    expands: null,
    list: [],
    delIcon: null,
    selectedProject: null,
    parentColId: null,
    isSubDir: false,
    selectedKeys: null,
    markedCollections: {} // 存储已标记的集合ID
  };

  constructor(props) {
    super(props);
    // 在构造函数中初始化 markedCollections
    this.state = {
      ...this.state,
      markedCollections: this.loadMarkedCollections()
    };
  }

  async componentDidMount() {
    await this.getList();
    // Set initial selection based on route
    const { match, currCase } = this.props;
    let selectedKeys = [];
    
    if (match && match.params) {
      if (match.params.action === 'case') {
        if (currCase && currCase._id) {
          selectedKeys = ['case_' + currCase._id];
        }
      } else if (match.params.actionId) {
        selectedKeys = ['col_' + match.params.actionId];
      }
    } else {
      const firstCol = this.findFirstCol(this.state.list);
      if (firstCol) {
        selectedKeys = ['col_' + firstCol._id];
      }
    }

    if (selectedKeys.length > 0) {
      this.setState({ selectedKeys });
    }

  }



  componentDidUpdate(prevProps) {
      // If the route has changed, update the selected keys
      // 但只有在不是通过自定义事件触发的情况下才更新
      if (prevProps.location !== this.props.location) {
      // Extract the selected key from the route
      const { match } = this.props;
      if (match && match.params) {
          if (match.params.action === 'case' && match.params.actionId) {
              // 检查是否是通过自定义事件设置的，如果是则不覆盖
              const expectedSelectedKey = 'case_' + match.params.actionId;
              if (!this.state.selectedKeys || !this.state.selectedKeys.includes(expectedSelectedKey)) {
                  this.setState({ selectedKeys: ['case_' + match.params.actionId] });
              }
          } else if (match.params.actionId) {
              const expectedSelectedKey = 'col_' + match.params.actionId;
              if (!this.state.selectedKeys || !this.state.selectedKeys.includes(expectedSelectedKey)) {
                  this.setState({ selectedKeys: ['col_' + match.params.actionId] });
              }
          }
      } else {
          this.setState({ selectedKeys: null });
      }
    }
    
    // Also check if currCaseId has changed (when navigating from table)
    // Or if we're on a case route but selectedKeys doesn't match
    const { match } = this.props;
    if (match && match.params && match.params.action === 'case' && match.params.actionId) {
        const expectedSelectedKey = 'case_' + match.params.actionId;
        if (!this.state.selectedKeys || !this.state.selectedKeys.includes(expectedSelectedKey)) {
            this.setState({ selectedKeys: [expectedSelectedKey] });
        }
    } else if (prevProps.currCaseId !== this.props.currCaseId && this.props.currCaseId) {
        const expectedSelectedKey = 'case_' + this.props.currCaseId;
        if (!this.state.selectedKeys || !this.state.selectedKeys.includes(expectedSelectedKey)) {
            this.setState({ selectedKeys: [expectedSelectedKey] });
            // 当 currCaseId 发生变化且不是通过路由参数匹配时，展开父节点
            this.expandParentNodesForCase(this.props.currCaseId);
        }
    }

    // If isRander changes and is true, refresh the list but maintain selection
    if (prevProps.isRander !== this.props.isRander && this.props.isRander) {
        // Preserve current selection and expansion state before refreshing
        const preservedSelection = this.state.selectedKeys;
        const preservedExpands = this.state.expands;  // 保存当前展开状态
        this.getList().then(() => {
            // 在下一个渲染周期恢复状态，确保 DOM 已经更新
            setTimeout(() => {
                // Restore selection and expansion state after refresh
                if (preservedSelection) {
                    this.setState({ selectedKeys: preservedSelection });
                }
                
                // 恢复展开状态，但只恢复仍然有效的键
                if (preservedExpands && preservedExpands.length > 0) {
                    // 过滤掉不再存在于列表中的展开键
                    const validExpands = preservedExpands.filter(key => {
                        // 检查键是否仍然有效 (格式为 "type_id")
                        const parts = key.split('_');
                        if (parts.length !== 2) return false;
                        
                        const [type, id] = parts;
                        const validTypes = ['folder', 'group', 'ref'];
                        if (!validTypes.includes(type)) return false;
                        
                        // 检查是否存在对应 ID 的节点
                        return this.props.interfaceColList.some(item => 
                            item._id == id && (item.type === 'folder' || item.type === 'group' || item.type === 'ref')
                        );
                    });
                    
                    // 如果是将用例拖入循环组，则确保循环组及其父级保持展开
                    let finalExpands = [...validExpands];
                    if (this.isDropToGroup && this.dropTargetNode) {
                        // 添加目标循环组的展开键
                        const targetGroupKey = `group_${this.dropTargetNode._id}`;
                        if (!finalExpands.includes(targetGroupKey)) {
                            finalExpands.push(targetGroupKey);
                        }
                        
                        // 添加目标循环组的父级路径
                        if (this.dropTargetNode.parent_id && this.dropTargetNode.parent_id !== 0) {
                            const parentKeys = this.findParentKeys(this.dropTargetNode.parent_id, []);
                            parentKeys.forEach(key => {
                                if (!finalExpands.includes(key)) {
                                    finalExpands.push(key);
                                }
                            });
                        }
                    }
                    
                    this.setState({ expands: finalExpands });  // 恢复有效的展开状态
                    
                    // 清除标志
                    delete this.isDropToGroup;
                    delete this.dropTargetNode;
                }
            }, 0);
        });
        this.props.setColData({ isRander: false });
    }
  }

  // 根据 case ID 展开父节点
  expandParentNodesForCase = (caseId) => {
    // Find the case in the interfaceColList
    const caseItem = this.props.interfaceColList.find(item => item._id == caseId && item.type === 'case');
    if (caseItem) {
      // Find all parent nodes that need to be expanded
      const expandedKeys = this.findParentKeys(caseItem.parent_id, []);
      // Update both expanded keys and selected keys
      this.setState({
        selectedKeys: ['case_' + caseId],
        expands: expandedKeys
      });
    } else {
    }
  };

  async getList() {
    console.log("11111--getList",this.props.match.params.id)
    let r = await this.props.fetchInterfaceColList(this.props.match.params.id);
    const listData = r.payload.data.data;
    this.setState({
      list: listData,
      // 构建包含子级接口的数据
      allColsWithChildren: this.buildAllColsWithChildren(listData)
    });
    return r;
  }

  // 获取集合及其所有子级集合的接口
  getAllCasesFromColAndChildren = (colId, list) => {
    const allCases = [];

    // 首先检查是否为 ref 类型集合，如果是，使用其 source_id
    const currentCol = list.find(item => item._id === colId);
    const targetId = (currentCol && currentCol.type === 'ref' && currentCol.source_id)
      ? currentCol.source_id
      : colId;

    // 1. 获取所有子级目录（递归）
    const collectChildren = (parentId, result, visited = new Set()) => {
      // 防止无限递归
      if (visited.has(parentId)) {
        console.warn(`检测到循环引用，ID: ${parentId}`);
        return;
      }
      visited.add(parentId);

      list.forEach(item => {
        if ((item.type === 'folder' || item.type === 'group' || item.type === 'ref') && item.parent_id === parentId) {
          // 对于 ref 类型集合，添加其 source_id
          if (item.type === 'ref' && item.source_id) {
            result.push(item.source_id);
          } else {
            result.push(item._id);
          }
          collectChildren(item._id, result, new Set(visited)); // 使用新的visited集合
        }
      });
    };

    const subIds = [targetId];
    collectChildren(targetId, subIds);

    // 2. 找出所有 case，其 col_id 在上述所有目录 ID 中
    list.forEach(item => {
      if (item.type === 'case' && subIds.includes(item.col_id)) {
        allCases.push(item);
      }
    });

    return allCases;
  };


  // 构建包含所有子级接口的集合数据
  buildAllColsWithChildren = (list) => {
    return list.map(col => {
      const allCases = this.getAllCasesFromColAndChildren(col._id, list);
      return {
        ...col,
        allCases // 包含所有子级接口
      };
    });
  };

  addorEditCol = async () => {
    const { colName: name, colDesc: desc, repeatCount } = this.form.getFieldsValue();
    const { colModalType, editColId: col_id, parentColId, modalType } = this.state;
    const project_id = this.props.match.params.id;
    let res = {};

    if (colModalType === 'add') {
      res = await axios.post('/api/col/add_col', {
        name,
        desc: desc || '',
        project_id,
        parent_id: parentColId || 0,
        type: modalType, // folder 或 group
        repeatCount: modalType === 'group' ? repeatCount : undefined
      });
    } else if (colModalType === 'edit') {
      res = await axios.post('/api/col/up_col', {
        name,
        desc,
        col_id,
        repeatCount: modalType === 'group' ? repeatCount : undefined
      });
    }

    if (!res.data.errcode) {
      this.setState({
        colModalVisible: false,
        parentColId: null
      });
      message.success(colModalType === 'edit' ? '修改成功' : '添加成功');
      this.getList();
    } else {
      message.error(res.data.errmsg);
    }
  };


  onExpand = keys => {
    this.setState({ expands: keys });
  };

  onSelect = (keys) => {
    if (keys.length) {
      const type = keys[0].split('_')[0];
      const id = keys[0].split('_')[1];
      const project_id = this.props.match.params.id;

      if (type === 'folder' || type === 'group' || type === 'ref') {
        const allColsWithChildren = this.state.allColsWithChildren || [];
        this.props.setColData({
          isRander: false,
          // 设置当前选中的集合ID和所有子级接口
          currColId: id,
          currColWithChildren: allColsWithChildren.find(col => col._id === id)
        });
        this.props.history.push('/project/' + project_id + '/interface/col/' + id);
      } else {
        this.props.setColData({
          isRander: false,
          currCaseId: id // 确保设置当前用例ID
        });
        this.props.history.push('/project/' + project_id + '/interface/case/' + id);
      }
      // Update the selection state to maintain highlight
      this.setState({
        selectedKeys: keys
      });
    }
  };

  showDelCaseConfirm = caseId => {
    let that = this;
    const params = this.props.match.params;
    confirm({
      title: '您确认删除此测试用例',
      content: '温馨提示：用例删除后无法恢复',
      okText: '确认',
      cancelText: '取消',
      async onOk() {
        const deletedCase = that.props.interfaceColList.find(item => item._id == caseId && item.type === 'case');
        const res = await axios.get('/api/col/del_case?caseid=' + caseId);
        if (!res.data.errcode) {
          message.success('删除用例成功');
          await that.getList();
          // 获取被删除的用例信息，以确定其所属集合ID
          if (deletedCase && deletedCase.parent_id) {
            await that.props.fetchCaseList(deletedCase.parent_id);
          }
          // 如果删除当前选中 case，切换路由到集合
          if (+caseId === +that.props.currCaseId) {
            that.props.history.push('/project/' + params.id + '/interface/col/');
          } else {
            that.props.setColData({ isRander: true });
          }
        } else {
          message.error(res.data.errmsg);
        }
      }
    });
  };

  showDelColConfirm = colId => {
    let that = this;
    const params = this.props.match.params;
    confirm({
      title: '您确认删除此测试集合',
      content: '温馨提示：该操作会删除该集合下所有测试用例和子集合，删除后无法恢复',
      okText: '确认',
      cancelText: '取消',
      async onOk() {
        // 在删除之前获取当前集合信息
        const deletedCol = that.props.interfaceColList.find(item => item._id == colId);
        console.log("deletedCol是否为子集",deletedCol);
        const res = await axios.get('/api/col/del_col?col_id=' + colId);
        if (!res.data.errcode) {
          message.success('删除成功');
          const result = await that.getList();
          if (deletedCol.parent_id !== 0) {
            // 删除的是子集合，重定向到父级集合
              that.props.history.push('/project/' + params.id + '/interface/col/' + deletedCol.parent_id);
              // 更新用例列表
              await that.props.fetchCaseList(deletedCol.parent_id);
          } else {
            // 删除的是根目录集合，重定向到第一个集合
            const firstCol = that.findFirstCol(result.payload.data.data);
            that.props.history.push('/project/' + params.id + '/interface/col/' + firstCol._id);
            // 更新用例列表
            await that.props.fetchCaseList(firstCol._id);
          }
        } else {
          message.error(res.data.errmsg);
        }
      }
    });
  };
  // 查找第一个顶级集合
  findFirstCol = (list) => {
    for (let item of list) {
      if (!item.parent_id || item.parent_id === 0) {
        return item;
      }
    }
    return list[0];
  };

  // 查找父级集合
  // findParentCol = (colId, list) => {
  //   const targetCol = list.find(item => item._id == colId);
  //   if (targetCol && targetCol.parent_id && targetCol.parent_id !== 0) {
  //     // 如果有父级ID，查找对应的父级集合
  //     return list.find(item => item._id == targetCol.parent_id);
  //   }
  //   return null; // 没有父级，说明是根目录集合
  // };

  // 复制测试用例
  copyInterface = async item => {
    if (this._copyInterfaceSign === true) {
      return;
    }
    this._copyInterfaceSign = true;
    const { desc, project_id, _id: col_id, parent_id } = item;
    let { name } = item;
    name = `${name} copy`;

    // 添加用例
    const add_col_res = await axios.post('/api/col/add_col', {
      name,
      desc,
      project_id,
      parent_id,
      type: 'folder'
    });

    if (add_col_res.data.errcode) {
      message.error(add_col_res.data.errmsg);
      return;
    }

    const new_col_id = add_col_res.data.data._id;

    // 克隆用例
    const add_case_list_res = await axios.post('/api/col/clone_case_list', {
      new_col_id,
      col_id,
      project_id,
      parent_id
    });
    this._copyInterfaceSign = false;

    if (add_case_list_res.data.errcode) {
      message.error(add_case_list_res.data.errmsg);
      return;
    }

    this.getList();
    this.props.setColData({ isRander: true });
    message.success('克隆用例成功');
  };

  // 从 localStorage 加载标记的集合
  loadMarkedCollections = () => {
    try {
      const saved = localStorage.getItem('markedCollections');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('加载标记集合失败', e);
      return {};
    }
  };

  // 保存标记的集合到 localStorage
  saveMarkedCollections = (markedCollections) => {
    try {
      localStorage.setItem('markedCollections', JSON.stringify(markedCollections));
    } catch (e) {
      console.error('保存标记集合失败', e);
    }
  };

  // 标记/取消标记集合
  toggleCollectionMark = (colId) => {
    this.setState(prevState => {
      const markedCollections = { ...prevState.markedCollections };
      if (markedCollections[colId]) {
        delete markedCollections[colId]; // 取消标记
      } else {
        markedCollections[colId] = true; // 标记
      }
      // 保存到 localStorage
      this.saveMarkedCollections(markedCollections);
      return { markedCollections };
    });
  };

  caseCopy = async caseId=> {
    let that = this;
    let caseData = await that.props.fetchCaseData(caseId);
    let data = caseData.payload.data.data;
    data = JSON.parse(JSON.stringify(data));
    data.casename=`${data.casename}_copy`
    delete data._id
    const res = await axios.post('/api/col/add_case',data);
    if (!res.data.errcode) {
      message.success('克隆用例成功');
      let colId = res.data.data.col_id;
      let projectId=res.data.data.project_id;
      await this.getList();
      // 刷新当前集合的用例列表
      await this.props.fetchCaseList(colId);
      this.props.history.push('/project/' + projectId + '/interface/col/' + colId);
      this.setState({
        visible: false
      });
    } else {
      message.error(res.data.errmsg);
    }
  };

  showColModal = (type, col, isSubDir = false, parentColId = null) => {
    const editCol =
        type === 'edit' ? { colName: col.name, colDesc: col.desc, repeatCount: col.repeatCount || 1 } : { colName: '', colDesc: '', repeatCount: 1 };
    this.setState({
      colModalVisible: true,
      colModalType: type || 'add',
      editColId: col && col._id,
      parentColId,
      isSubDir,
      modalType: 'folder' // 普通子目录/集合
    });
    this.form.setFieldsValue(editCol);
  };

  showGroupModal = (type, col, isSubDir = false, parentColId = null) => {
    const editGroup =
        type === 'edit' ? { colName: col.name, repeatCount: col.repeatCount || 1 } : { colName: '', repeatCount: 1 };
    this.setState({
      colModalVisible: true,
      colModalType: type || 'add',
      editColId: col && col._id,
      parentColId,
      isSubDir,
      modalType: 'group' // 循环组
    });
    this.form.setFieldsValue(editGroup);
  };


  saveFormRef = form => {
    this.form = form;
  };

  selectInterface = (importInterIds, selectedProject) => {
    this.setState({ importInterIds, selectedProject });
  };

  selectCol = (importColList, selectedProjectId) => {
    this.setState({ importColList, selectedProjectId });
  };

  showImportInterfaceModal = async colId => {
    const groupId = this.props.curProject.group_id;
    await this.props.fetchProjectList(groupId);
    this.setState({ importInterVisible: true, importColId: colId });
  };

  showImportColModal = async colId => {
    this.setState({ importColVisible: true, importColId: colId });
  };

  handleImportOk = async () => {
    const project_id = this.props.match.params.id || this.state.selectedProject;
    const { importColId, importInterIds } = this.state;
    
    // 检查当前导入的目标是否为 group 类型
    const targetCol = this.props.interfaceColList.find(col => col._id == importColId);
    const groupId = targetCol && targetCol.type === 'group' ? importColId : null;
    
    const res = await axios.post('/api/col/add_case_list', {
      interface_list: importInterIds,
      col_id: importColId,
      group_id: groupId,  // 如果是 group 类型，则传递 group_id
      project_id
    });
    if (!res.data.errcode) {
      this.setState({ importInterVisible: false });
      message.success('导入接口成功');
      await this.getList();
      // 刷新当前集合的用例列表
      await this.props.fetchCaseList(importColId);
      this.props.setColData({ isRander: true });
    } else {
      message.error(res.data.errmsg);
    }
  };

  handleImportColOk = async () => {
    const { importColId, importColList } = this.state;
    const project_id = this.props.match.params.id;

    const res = await axios.post('/api/col/add_col_list', {
      col_list: importColList,
      col_id: importColId,
      project_id
    });
    if (!res.data.errcode) {
      this.setState({ importColVisible: false });
      message.success('导入集合成功');
      await this.getList();
      // 刷新当前集合的用例列表
      await this.props.fetchCaseList(importColId);
      this.props.setColData({ isRander: true });
    } else {
      message.error(res.data.errmsg);
    }
  };

  handleImportCancel = () => {
    this.setState({ importInterVisible: false });
  };

  handleImportColCancel = () => {
    this.setState({ importColVisible: false });
  };

  filterCol = e => {
    const value = e.target.value;
    this.setState({
      filterValue: value,
      list: JSON.parse(JSON.stringify(this.props.interfaceColList))
    });
  };

  onDrop = async e => {
    const { interfaceColList, setColData } = this.props;

    const dragNode = e.dragNode.props.dataRef;
    const dropNode = e.node.props.dataRef;

    /* =========================
     * 1️⃣ 语义层：一次性翻译拖拽语义
     * ========================= */
    const isDropOnGap = e.dropToGap;
    const isDropOnNode = !e.dropToGap;
    const isTargetContainer = ['folder', 'group'].includes(dropNode.type);
    const isDropToGroup = dropNode.type === 'group';

    /* =========================
     * 2️⃣ 计算 targetParentId（保持原行为）
     * ========================= */
    let targetParentId;
    if (isDropOnNode) {
      targetParentId = dropNode.parent_id;
    } else {
      targetParentId = isTargetContainer
          ? dropNode._id
          : dropNode.parent_id || 0;
    }

    /* =========================
     * 3️⃣ 校验规则（不动）
     * ========================= */
    if (dragNode.type === 'case' && targetParentId === 0) {
      return message.error('接口不能直接移动到根目录');
    }

    if (dragNode.type === 'group') {
      const parentNode = interfaceColList.find(n => n._id === targetParentId);
      if (!parentNode || parentNode.type !== 'folder') {
        return message.error('分组只能放在文件夹下');
      }
    }

    const isCrossFolder = dragNode.parent_id !== targetParentId;

    /* =========================
     * 4️⃣ siblings 选择逻辑（核心修复点，保留）
     * ========================= */
    const originSiblings = interfaceColList
        .filter(n => n.parent_id === dragNode.parent_id)
        .sort((a, b) => a.index - b.index);

    const isEnterGroup =
        dropNode.type === 'group' && targetParentId === dropNode._id;

    const targetSiblings = isEnterGroup
        ? interfaceColList
            .filter(n => n.group_id === dropNode._id)
            .sort((a, b) => a.index - b.index)
        : interfaceColList
            .filter(n => n.parent_id === targetParentId)
            .sort((a, b) => a.index - b.index);

    /* =========================
     * 5️⃣ 构建 dragNode 副本并更新归属
     * ========================= */
    const dragNodeCopy = { ...dragNode };
    dragNodeCopy.parent_id = targetParentId;

    if (isDropOnGap) {
      if (dropNode.type === 'folder') {
        dragNodeCopy.col_id = dropNode._id;
        dragNodeCopy.group_id = null;
      } else if (dropNode.type === 'group') {
        dragNodeCopy.col_id = dropNode._id;
        dragNodeCopy.group_id = dropNode._id;
      } else {
        dragNodeCopy.col_id = targetParentId;
        dragNodeCopy.group_id = dropNode.group_id || null;
      }
    } else {
      dragNodeCopy.col_id = targetParentId;
      dragNodeCopy.group_id = isEnterGroup
          ? dropNode._id
          : dropNode.group_id || null;
    }

    /* =========================
     * 6️⃣ 计算插入位置并更新 index
     * ========================= */
    const reIndex = list => list.forEach((n, i) => (n.index = i));

    if (isCrossFolder) {
      const fromIndex = originSiblings.findIndex(n => n._id === dragNode._id);
      if (fromIndex > -1) originSiblings.splice(fromIndex, 1);
      reIndex(originSiblings);

      let insertIndex;
      if (isDropOnNode) {
        insertIndex = targetSiblings.length;
      } else {
        const dropIndex = targetSiblings.findIndex(n => n._id === dropNode._id);
        insertIndex =
            isEnterGroup && dropIndex === -1
                ? 0
                : dropIndex + (e.dropPosition > 0 ? 1 : 0);
      }

      targetSiblings.splice(insertIndex, 0, dragNodeCopy);
      reIndex(targetSiblings);
    } else {
      const fromIndex = originSiblings.findIndex(n => n._id === dragNode._id);
      originSiblings.splice(fromIndex, 1);

      let insertIndex;
      if (isDropOnNode) {
        const dropIndex = originSiblings.findIndex(n => n._id === dropNode._id);
        insertIndex = dropIndex + 1;
      } else {
        const dropIndex = originSiblings.findIndex(n => n._id === dropNode._id);
        insertIndex =
            isEnterGroup && dropIndex === -1
                ? 0
                : dropIndex + (e.dropPosition > 0 ? 1 : 0);
      }

      originSiblings.splice(insertIndex, 0, dragNodeCopy);
      reIndex(originSiblings);
    }

    /* =========================
     * 7️⃣ 合并更新列表并提交
     * ========================= */
    const allNodes = isCrossFolder
        ? [...originSiblings, ...targetSiblings]
        : [...originSiblings];

    const updates = Array.from(
        new Map(allNodes.map(n => [n._id, n])).values()
    ).map(n => ({
      id: n._id,
      index: n.index,
      type: n.type,
      parent_id: n.parent_id,
      col_id: n.col_id,
      group_id: n.group_id || null
    }));

    try {
      await axios.post('/api/col/up_index', { list: updates });
      message.success('顺序更新成功');

      setColData(
          isCrossFolder
              ? { isRander: true, keepExpandedFolderId: targetParentId, isCrossFolder }
              : { isRander: true }
      );

      this.isDropToGroup = isDropToGroup;
      this.dropTargetNode = dropNode;
      this.getList();
    } catch (err) {
      console.error('拖拽更新失败', err);
      message.error('顺序更新失败');
    }
  };


  enterItem = id => {
    this.setState({ delIcon: id });
  };

  leaveItem = () => {
    this.setState({ delIcon: null });
  };
  // 移除 handleCaseSelected 方法，因为我们现在使用 Redux 状态管理
  // 保留 expandParentNodesForCase 方法，因为它仍然被需要
  // Helper function to recursively find parent keys
  findParentKeys = (parentId, keys) => {
    if (!parentId || parentId === 0) {
      return keys;
    }

    // Find the parent item in the list
    const parentItem = this.props.interfaceColList.find(item =>
      item._id == parentId && (item.type === 'folder' || item.type === 'group')
    );

    if (parentItem) {
      const parentKey = `${parentItem.type}_${parentItem._id}`;
      keys.push(parentKey);

      return this.findParentKeys(parentItem.parent_id, keys);
    }

    return keys;
  };

  // Get parent expand keys for a node
  getParentExpandKeys = (node) => {
    const keys = [`${node.type}_${node._id}`]; // Include the node itself if it's a container
    if (node.parent_id && node.parent_id !== 0) {
      // Add parent chain
      const parentKeys = this.findParentKeys(node.parent_id, []);
      return [...keys, ...parentKeys];
    }
    return keys;
  };

  // 递归构建树节点（平铺列表生成，可支持 case 和 folder/group 混排）
  buildTreeNodes = (data, parentId = 0, visited = new Set()) => {
    // 防止循环引用导致的无限递归
    if (visited.has(parentId)) {
      console.warn(`检测到循环引用，父ID: ${parentId}`);
      return [];
    }
    // 将当前父ID添加到访问记录中
    const newVisited = new Set(visited);
    newVisited.add(parentId);

    // 1. 当前层级的目录（folder/group/ref）
    const subDirs = data.filter(
        item => (item.type === 'folder' || item.type === 'group' || item.type === 'ref') && item.parent_id === parentId
    );

    // 2. 当前层级的用例（case 的 parent_id 指向父目录）
    const cases = data.filter(item => item.type === 'case' && item.parent_id === parentId);

    // 3. 合并并按 index 排序
    const combined = [...subDirs, ...cases].sort((a, b) => (a.index || 0) - (b.index || 0));

    // 4. 遍历渲染
    return combined.map(item => {
      if (item.type === 'folder' || item.type === 'group' || item.type === 'ref') {
        const children = this.buildTreeNodes(data, item._id, newVisited);
        return (
          <TreeNode
                key={`${item.type}_${item._id}`}
                dataRef={item}
                title={this.renderColTitle(item)}
            >
            {children.length > 0 ? children : null}
          </TreeNode>
        );
      } else {
        return this.itemInterfaceColCreate(item);
      }
    });
  };

  renderColTitle = col => {
    // 为非ref类型集合创建完整菜单
    const fullMenu = (
      <Menu
            onClick={({ key, domEvent }) => {
              domEvent.stopPropagation();

              switch (key) {
                case 'delete':
                  this.showDelColConfirm(col._id);
                  break;
                case 'mark':
                  this.toggleCollectionMark(col._id);
                  break;
                case 'edit':
                  col.type === 'group'
                      ? this.showGroupModal('edit', col)
                      : this.showColModal('edit', col);
                  break;
                case 'import':
                  this.showImportInterfaceModal(col._id);
                  break;
                case 'import-col':
                  this.showImportColModal(col._id);
                  break;
                case 'add-child':
                  this.showColModal('add', null, true, col._id);
                  break;
                case 'add-group':
                  this.showGroupModal('add', null, true, col._id);
                  break;
                case 'copy':
                  this.copyInterface(col);
                  break;

                default:
                  break;
              }
            }}
        >
        <Menu.Item key="edit">
          <Icon type="edit" style={{ marginRight: 8 }} />
          {col.type === 'group' ? '编辑循环组' : '编辑集合'}
        </Menu.Item>

        <Menu.Item key="import">
          <Icon type="plus" style={{ marginRight: 8 }} />
          导入接口
        </Menu.Item>

        <Menu.Item key="import-col">
          <Icon type="fork" style={{ marginRight: 8 }} />
          导入集合
        </Menu.Item>

        <Menu.Item key="add-child">
          <Icon type="folder-add" style={{ marginRight: 8 }} />
          添加子目录
        </Menu.Item>

        <Menu.Item key="add-group">
          <Icon type="sync" style={{ marginRight: 8 }} />
          添加循环组
        </Menu.Item>

        <Menu.Item key="copy">
          <Icon type="copy" style={{ marginRight: 8 }} />
          克隆集合
        </Menu.Item>

        <Menu.Item key="mark">
          <Icon type="star" style={{ marginRight: 8 }} />
          {this.state.markedCollections[col._id] ? '取消标记' : '标记集合'}
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item key="delete" danger>
          <Icon type="delete" style={{ marginRight: 8 }} />
          删除集合
        </Menu.Item>
      </Menu>
    );

    // 为ref类型集合创建仅包含删除的菜单
    const refMenu = (
      <Menu
            onClick={({ key, domEvent }) => {
              domEvent.stopPropagation();

              switch (key) {
                case 'delete':
                  this.showDelColConfirm(col._id);
                  break;
                default:
                  break;
              }
            }}
        >
        <Menu.Item key="delete" danger>
          <Icon type="delete" style={{ marginRight: 8 }} />
          删除引用
        </Menu.Item>
      </Menu>
    );

    return (
      <div className="menu-title">
        {col.type === 'group' ? (
          <Icon type="sync" style={{ marginRight: 6, color: '#00a854' }} />
          ) : col.type === 'ref' ? (
            <Icon type="fork" style={{ marginRight: 6, color: '#f5222d' }} />
          ) : (
            <Icon type="folder-open" style={{ marginRight: 6, color: '#1890ff' }} />
          )}

        <span
          className={col.type === 'group' ? 'group-title col-name' : 'col-name'}
          title={col.name}
          style={{ color: this.state.markedCollections[col._id] ? 'red' : 'inherit' }}
        >
          {col.name}
        </span>

        {col.type === 'group' && (
          <span className="group-repeat-count">
            [{col.repeatCount || 1}]
          </span>
          )}

        <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
          ({this.getAllCasesFromColAndChildren(col._id, this.props.interfaceColList || []).length})
        </span>

        {/* 右侧更多按钮 - ref类型只显示删除 */}
        <Dropdown overlay={col.type === 'ref' ? refMenu : fullMenu} trigger={['click']}>
          <div 
            className="horizontal-ellipsis"
            onClick={e => e.stopPropagation()}
          >
            <span></span>
          </div>
        </Dropdown>

      </div>
    );
  };


  // 渲染单个用例节点 pre
  itemInterfaceColCreate = interfaceCase => {
    return (
      <TreeNode
            style={{ width: '100%' }}
            key={'case_' + interfaceCase._id}
            dataRef={interfaceCase}
            title={
              <div
                  className="menu-title"
                  onMouseEnter={() => this.enterItem(interfaceCase._id)}
                  onMouseLeave={this.leaveItem}
                  title={interfaceCase.casename}
              >
                <span className="casename">{interfaceCase.casename}</span>
                <span className="caseId" style={{ marginLeft: 'auto' }}>{interfaceCase._id}</span>

                <div className="btns">
                  <Tooltip title="删除用例">
                    <Icon
                        type="delete"
                        className="interface-delete-icon"
                        onClick={e => {
                          e.stopPropagation();
                          this.showDelCaseConfirm(interfaceCase._id);
                        }}
                        style={{ display: this.state.delIcon === interfaceCase._id ? 'block' : 'none' }}
                    />
                  </Tooltip>
                  <Tooltip title="克隆用例">
                    <Icon
                        type="copy"
                        className="interface-delete-icon"
                        onClick={e => {
                          e.stopPropagation();
                          this.caseCopy(interfaceCase._id);
                        }}
                        style={{ display: this.state.delIcon === interfaceCase._id ? 'block' : 'none' }}
                    />
                  </Tooltip>
                </div>
              </div>
            }
        />
    );
  };

  render() {
    const { colModalType, colModalVisible, importInterVisible, isSubDir } = this.state;
    const currProjectId = this.props.match.params.id;

    const defaultExpandedKeys = () => {
      const { match, currCase, interfaceColList } = this.props;
      const rNull = { expands: [], selects: [] };

      if (interfaceColList.length === 0) {
        return rNull;
      }

      // Use state.selectedKeys if available, otherwise calculate default selection
      let selects = this.state.selectedKeys || [];
      
      // Only calculate default selection if state.selectedKeys is not set
      if (selects.length === 0) {
        // Build router-like object from match props
        const router = {
          params: {
            action: match.params.action,
            actionId: match.params.actionId
          }
        };
        
        if (router) {
          if (router.params.action === 'case') {
            if (currCase && currCase._id) {
              selects = ['case_' + currCase._id];
            }
          } else if (router.params.actionId) {
            selects = ['col_' + router.params.actionId];
          }
        } else {
          const firstCol = this.findFirstCol(interfaceColList);
          if (firstCol) {
            selects = ['col_' + firstCol._id];
          }
        }
        
        // Set the initial selected keys in state if not already set
        if (!this.state.selectedKeys && selects.length > 0) {
          setTimeout(() => {
            this.setState({ selectedKeys: selects });
          }, 0);
        }
      } else {
        // 如果已有selectedKeys，使用现有值而不是重新计算
        selects = this.state.selectedKeys;
      }

      return {
        expands: this.state.expands ? this.state.expands : [],
        selects: selects
      };
    };

    let currentKes = defaultExpandedKeys();
    // 优先使用 state.selectedKeys，如果不存在则使用计算出的默认值
    const selectedKeys = this.state.selectedKeys && this.state.selectedKeys.length > 0 ? this.state.selectedKeys : currentKes.selects;


    return (
      <div>
        <div className="interface-filter">
          <Input placeholder="搜索测试集合" onChange={this.filterCol} />
          <Tooltip placement="bottom" title="添加集合">
            <Button
                  type="primary"
                  style={{ marginLeft: '16px' }}
                  onClick={() => this.showColModal('add')}
                  className="btn-filter"
              >
              添加集合
            </Button>
          </Tooltip>
        </div>
        <div className="tree-wrapper" style={{ height: 'calc(100vh - ' + headHeight + 'px)', overflowY: 'auto' }}>
          <Tree
                className="col-list-tree"
                defaultExpandedKeys={currentKes.expands}
                expandedKeys={currentKes.expands}
                selectedKeys={selectedKeys}
                onSelect={this.onSelect}
                autoExpandParent={true}
                draggable
                onExpand={this.onExpand}
                onDrop={this.onDrop}
            >
            {this.buildTreeNodes(this.props.interfaceColList)}
          </Tree>
        </div>
        <ColModalForm
              ref={this.saveFormRef}
              type={colModalType}
              visible={colModalVisible}
              isSubDir={isSubDir}
              modalType={this.state.modalType}
              onCancel={() => {
                this.setState({
                  colModalVisible: false,
                  parentColId: null,
                  isSubDir: false
                });
              }}
              onCreate={this.addorEditCol}
          />
        <Modal
              title="导入接口到集合"
              visible={importInterVisible}
              onOk={this.handleImportOk}
              onCancel={this.handleImportCancel}
              className="import-case-modal"
              width={800}
              destroyOnClose={true}
          >
          <ImportInterface
                key={this.state.importColId}
                currProjectId={currProjectId}
                selectInterface={this.selectInterface}
            />
        </Modal>
        <Modal
              title="导入集合到集合"
              visible={this.state.importColVisible}
              onOk={this.handleImportColOk}
              onCancel={this.handleImportColCancel}
              className="import-col-modal"
              width={800}
              destroyOnClose={true}
          >
          <ImportCol
                key={this.state.importColId}
                currProjectId={this.props.match.params.id}
                selectCol={this.selectCol}
            />
        </Modal>
      </div>
    );
  }
}