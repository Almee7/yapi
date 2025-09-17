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
import { Input, Icon, Button, Modal, message, Tooltip, Tree, Form } from 'antd';
// eslint-disable-next-line no-unused-vars
import { arrayChangeIndex } from '../../../../common.js';
import _ from 'underscore'

const TreeNode = Tree.TreeNode;
const FormItem = Form.Item;
const confirm = Modal.confirm;
const headHeight = 240; // menu顶部到网页顶部部分的高度

import './InterfaceColMenu.scss';

const ColModalForm = Form.create()(props => {
  const { visible, onCancel, onCreate, form, title, isSubDir } = props;
  const { getFieldDecorator } = form;
  return (
    <Modal visible={visible} title={title} onCancel={onCancel} onOk={onCreate}>
      <Form layout="vertical">
        <FormItem label={isSubDir ? "子目录名" : "集合名"}>
          {getFieldDecorator('colName', {
              rules: [{ required: true, message: isSubDir ? '请输入子目录命名！' : '请输入集合命名！' }]
            })(<Input />)}
        </FormItem>
        {!isSubDir && (
          <FormItem label="简介">{getFieldDecorator('colDesc')(<Input type="textarea" />)}</FormItem>
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
    router: PropTypes.object,
    currCase: PropTypes.object,
    curProject: PropTypes.object,
    fetchProjectList: PropTypes.func
  };

  state = {
    colModalType: '',
    colModalVisible: false,
    editColId: 0,
    filterValue: '',
    importInterVisible: false,
    importInterIds: [],
    importColId: 0,
    expands: null,
    list: [],
    delIcon: null,
    selectedProject: null,
    parentColId: null,
    isSubDir: false,
    // 新增状态：存储所有集合的完整数据（包括子级接口）
    allColsWithChildren: []
  };

  constructor(props) {
    super(props);
  }

  componentWillMount() {
    this.getList();
  }

  async getList() {
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
    const col = list.find(item => item._id === colId);

    if (col && col.caseList) {
      allCases.push(...col.caseList);
    }

    // 递归获取所有子级集合的接口
    const getChildCases = (parentId) => {
      list.forEach(item => {
        if (item.parent_id === parentId) {
          if (item.caseList) {
            allCases.push(...item.caseList);
          }
          getChildCases(item._id); // 递归获取子级的子级
        }
      });
    };

    getChildCases(colId);
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
    const { colName: name, colDesc: desc } = this.form.getFieldsValue();
    const { colModalType, editColId: col_id, parentColId } = this.state;
    const project_id = this.props.match.params.id;
    let res = {};

    if (colModalType === 'add') {
      res = await axios.post('/api/col/add_col', {
        name,
        desc: desc || '',
        project_id,
        parent_id: parentColId || 0
      });
    } else if (colModalType === 'edit') {
      res = await axios.post('/api/col/up_col', { name, desc, col_id });
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

  onSelect = _.debounce(keys => {
    if (keys.length) {
      const type = keys[0].split('_')[0];
      const id = keys[0].split('_')[1];
      const project_id = this.props.match.params.id;

      if (type === 'col') {
        this.props.setColData({
          isRander: false,
          // 设置当前选中的集合ID和所有子级接口
          currColId: id,
          currColWithChildren: this.state.allColsWithChildren.find(col => col._id === id)
        });
        this.props.history.push('/project/' + project_id + '/interface/col/' + id);
      } else {
        this.props.setColData({
          isRander: false
        });
        this.props.history.push('/project/' + project_id + '/interface/case/' + id);
      }
    }
    this.setState({
      expands: null
    });
  }, 500);

  showDelColConfirm = colId => {
    let that = this;
    const params = this.props.match.params;
    confirm({
      title: '您确认删除此测试集合',
      content: '温馨提示：该操作会删除该集合下所有测试用例和子集合，删除后无法恢复',
      okText: '确认',
      cancelText: '取消',
      async onOk() {
        const res = await axios.get('/api/col/del_col?col_id=' + colId);
        if (!res.data.errcode) {
          message.success('删除成功');
          const result = await that.getList();

          // 重定向到第一个集合
          if (result.payload.data.data.length > 0) {
            const firstCol = that.findFirstCol(result.payload.data.data);
            that.props.history.push('/project/' + params.id + '/interface/col/' + firstCol._id);
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

  // 复制测试集合
  copyInterface = async item => {
    if (this._copyInterfaceSign === true) {
      return;
    }
    this._copyInterfaceSign = true;
    const { desc, project_id, _id: col_id, parent_id } = item;
    let { name } = item;
    name = `${name} copy`;

    // 添加集合
    const add_col_res = await axios.post('/api/col/add_col', {
      name,
      desc,
      project_id,
      parent_id
    });

    if (add_col_res.data.errcode) {
      message.error(add_col_res.data.errmsg);
      return;
    }

    const new_col_id = add_col_res.data.data._id;

    // 克隆集合
    const add_case_list_res = await axios.post('/api/col/clone_case_list', {
      new_col_id,
      col_id,
      project_id
    });
    this._copyInterfaceSign = false;

    if (add_case_list_res.data.errcode) {
      message.error(add_case_list_res.data.errmsg);
      return;
    }

    this.getList();
    this.props.setColData({ isRander: true });
    message.success('克隆测试集成功');
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
      this.props.history.push('/project/' + projectId + '/interface/col/' + colId);
      this.setState({
        visible: false
      });
    } else {
      message.error(res.data.errmsg);
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
        const res = await axios.get('/api/col/del_case?caseid=' + caseId);
        if (!res.data.errcode) {
          message.success('删除用例成功');
          that.getList();
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

  showColModal = (type, col, isSubDir = false, parentColId = null) => {
    const editCol =
        type === 'edit' ? { colName: col.name, colDesc: col.desc } : { colName: '', colDesc: '' };
    this.setState({
      colModalVisible: true,
      colModalType: type || 'add',
      editColId: col && col._id,
      parentColId,
      isSubDir
    });
    this.form.setFieldsValue(editCol);
  };

  saveFormRef = form => {
    this.form = form;
  };

  selectInterface = (importInterIds, selectedProject) => {
    this.setState({ importInterIds, selectedProject });
  };

  showImportInterfaceModal = async colId => {
    const groupId = this.props.curProject.group_id;
    await this.props.fetchProjectList(groupId);
    this.setState({ importInterVisible: true, importColId: colId });
  };

  handleImportOk = async () => {
    const project_id = this.state.selectedProject || this.props.match.params.id;
    const { importColId, importInterIds } = this.state;
    const res = await axios.post('/api/col/add_case_list', {
      interface_list: importInterIds,
      col_id: importColId,
      project_id
    });
    if (!res.data.errcode) {
      this.setState({ importInterVisible: false });
      message.success('导入集合成功');
      this.getList();
      this.props.setColData({ isRander: true });
    } else {
      message.error(res.data.errmsg);
    }
  };

  handleImportCancel = () => {
    this.setState({ importInterVisible: false });
  };

  filterCol = e => {
    const value = e.target.value;
    this.setState({
      filterValue: value,
      list: JSON.parse(JSON.stringify(this.props.interfaceColList))
    });
  };

  onDrop = async e => {
    const { interfaceColList } = this.props;
    const dragKey = e.dragNode.props.eventKey;
    const dropKey = e.node.props.eventKey;

    // 集合拖拽
    if (dragKey.startsWith('col_')) {
      const dragColId = dragKey.split('_')[1];
      let parentId = 0;
      if (dropKey.startsWith('col_') && e.dropPosition - Number(e.node.props.pos.split('-').pop()) === 0) {
        parentId = dropKey.split('_')[1];
      }

      try {
        const res = await axios.post('/api/col/up_col', { col_id: dragColId, parent_id: parentId });
        if (!res.data.errcode) {
          message.success('集合移动成功');
          this.getList();
        } else {
          message.error(res.data.errmsg);
        }
      } catch (err) {
        console.error('集合拖拽更新失败:', err);
        message.error('集合移动失败');
      }
      return;
    }

    // 用例拖拽
    const dragNodeData = e.dragNode.props.dataRef || {};
    const caseId = dragKey.split('_')[1];
    const dragColId = dragNodeData.col_id || dragNodeData._id;

    try {
      let dropColId = dragColId;
      let targetCaseList = [];

      if (dropKey.startsWith('case_')) {
        // 拖到另一个用例上
        const dropCaseId = dropKey.split('_')[1];
        const dropCol = interfaceColList.find(col =>
            col.caseList && col.caseList.some(c => String(c._id) === String(dropCaseId))
        );
        dropColId = dropCol ? dropCol._id : dragColId;
        targetCaseList = dropCol ? dropCol.caseList : [];

        if (dragColId !== dropColId) {
          // 跨集合，更新 col_id
          await axios.post('/api/col/up_case', { id: caseId, col_id: dropColId });
        }
      } else if (dropKey.startsWith('col_')) {
        // 拖到集合节点，放到最后
        dropColId = (e.node.props.dataRef && e.node.props.dataRef._id) || dropKey.split('_')[1];
        const dropCol = interfaceColList.find(col => col._id === dropColId);
        targetCaseList = dropCol ? dropCol.caseList : [];
        await axios.post('/api/col/up_case', { id: caseId, col_id: dropColId });
      }

      // 计算拖拽的 index
      const dragPos = e.dragNode.props.pos.split('-');
      const dragIndex = Number(dragPos[dragPos.length - 1]);
      const dropPos = e.node.props.pos.split('-');
      const dropIndex = Number(dropPos[dropPos.length - 1]);

      // 更新顺序
      if (targetCaseList.length) {
        const changes = arrayChangeIndex(targetCaseList, dragIndex, dropIndex);
        if (changes.length) {
          await axios.post('/api/col/up_case_index', changes);
        }
      }
      this.getList();
      this.props.setColData({ isRander: true });
    } catch (err) {
      console.error('用例拖拽更新失败:', err);
      message.error('用例移动失败');
    }
  };


  enterItem = id => {
    this.setState({ delIcon: id });
  };

  leaveItem = () => {
    this.setState({ delIcon: null });
  };

  // 递归构建树节点
  buildTreeNodes = (data, parentId = 0) => {
    return data
        .filter(item => item.parent_id === parentId)
        .map(col => {
          const children = this.buildTreeNodes(data, col._id);

          return (
            <TreeNode
                  key={'col_' + col._id}
                  title={
                    <div className="menu-title">
                      <span>
                        <Icon type="folder-open" style={{ marginRight: 5 }} />
                        <span>{col.name}</span>
                        {/* 显示接口数量（包含子级） */}
                        <span style={{ marginLeft: 8, color: '#999', fontSize: '12px' }}>
                          ({this.getAllCasesFromColAndChildren(col._id, data).length})
                        </span>
                      </span>
                      <div className="btns">
                        <Tooltip title="删除集合">
                          <Icon
                              type="delete"
                              className="interface-delete-icon"
                              onClick={() => {
                                this.showDelColConfirm(col._id);
                              }}
                          />
                        </Tooltip>
                        <Tooltip title="编辑集合">
                          <Icon
                              type="edit"
                              className="interface-delete-icon"
                              onClick={e => {
                                e.stopPropagation();
                                this.showColModal('edit', col);
                              }}
                          />
                        </Tooltip>
                        <Tooltip title="导入接口">
                          <Icon
                              type="plus"
                              className="interface-delete-icon"
                              onClick={e => {
                                e.stopPropagation();
                                this.showImportInterfaceModal(col._id);
                              }}
                          />
                        </Tooltip>
                        <Tooltip title="添加子目录">
                          <Icon
                              type="folder-add"
                              className="interface-delete-icon"
                              onClick={e => {
                                e.stopPropagation();
                                this.showColModal('add', null, true, col._id);
                              }}
                          />
                        </Tooltip>
                        <Tooltip title="克隆集合">
                          <Icon
                              type="copy"
                              className="interface-delete-icon"
                              onClick={e => {
                                e.stopPropagation();
                                this.copyInterface(col);
                              }}
                          />
                        </Tooltip>
                      </div>
                    </div>
                  }
              >
              {children}
              {col.caseList && col.caseList.map(this.itemInterfaceColCreate)}
            </TreeNode>
          );
        });
  };

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
                <span className="caseId">{interfaceCase._id}</span>

                <div className="btns">
                  <Tooltip title="删除用例">
                    <Icon
                        type="delete"
                        className="interface-delete-icon"
                        onClick={e => {
                          e.stopPropagation();
                          this.showDelCaseConfirm(interfaceCase._id);
                        }}
                        style={{ display: this.state.delIcon == interfaceCase._id ? 'block' : 'none' }}
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
                        style={{ display: this.state.delIcon == interfaceCase._id ? 'block' : 'none' }}
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
      const { router, currCase, interfaceColList } = this.props;
      const rNull = { expands: [], selects: [] };

      if (interfaceColList.length === 0) {
        return rNull;
      }

      if (router) {
        if (router.params.action === 'case') {
          if (!currCase || !currCase._id) {
            return rNull;
          }
          return {
            expands: this.state.expands ? this.state.expands : ['col_' + currCase.col_id],
            selects: ['case_' + currCase._id + '']
          };
        } else {
          let col_id = router.params.actionId;
          return {
            expands: this.state.expands ? this.state.expands : ['col_' + col_id],
            selects: ['col_' + col_id]
          };
        }
      } else {
        const firstCol = this.findFirstCol(interfaceColList);
        return {
          expands: this.state.expands ? this.state.expands : ['col_' + firstCol._id],
          selects: ['col_' + firstCol._id]
        };
      }
    };

    let currentKes = defaultExpandedKeys();
    // let list = this.props.interfaceColList;
    //
    // if (this.state.filterValue) {
    //   // 过滤逻辑保持不变
    //   list = list.filter(item => {
    //     item.caseList = item.caseList.filter(inter => {
    //       if (inter.casename.indexOf(this.state.filterValue) === -1
    //           && inter.path.indexOf(this.state.filterValue) === -1
    //       ) {
    //         return false;
    //       }
    //       return true;
    //     });
    //     return true;
    //   });
    // }

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
        <div className="tree-wrapper" style={{ maxHeight: parseInt(document.body.clientHeight) - headHeight + 'px'}}>
          <Tree
                className="col-list-tree"
                defaultExpandedKeys={currentKes.expands}
                defaultSelectedKeys={currentKes.selects}
                expandedKeys={currentKes.expands}
                selectedKeys={currentKes.selects}
                onSelect={this.onSelect}
                autoExpandParent
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
      </div>
    );
  }
}