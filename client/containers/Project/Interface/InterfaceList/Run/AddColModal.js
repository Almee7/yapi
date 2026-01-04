import React, { PureComponent as Component } from 'react';
import { connect } from 'react-redux';
import { Modal, Collapse, Row, Col, Input, message, Button, Icon, Tree } from 'antd';
import PropTypes from 'prop-types';
import axios from 'axios';
import { withRouter } from 'react-router';
import { fetchInterfaceColList } from '../../../../../reducer/modules/interfaceCol';

const { TextArea } = Input;
const Panel = Collapse.Panel;
const TreeNode = Tree.TreeNode;

@connect(
  state => ({
    interfaceColList: state.interfaceCol.interfaceColList
  }),
  {
    fetchInterfaceColList
  }
)
@withRouter
export default class AddColModal extends Component {
  static propTypes = {
    visible: PropTypes.bool,
    interfaceColList: PropTypes.array,
    fetchInterfaceColList: PropTypes.func,
    match: PropTypes.object,
    onOk: PropTypes.func,
    onCancel: PropTypes.func,
    caseName: PropTypes.string
  };

  state = {
    visible: false,
    addColName: '',
    addColDesc: '',
    id: 0,
    caseName: '',
    expandedKeys: [],
    autoExpandParent: true
  };

  constructor(props) {
    super(props);
  }

  componentWillMount() {
    this.props.fetchInterfaceColList(this.props.match.params.id);
    this.setState({ caseName: this.props.caseName });
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      id: nextProps.interfaceColList[0] ? nextProps.interfaceColList[0]._id : 0
    });
    this.setState({ caseName: nextProps.caseName });
  }

  addCol = async () => {
    const { addColName: name, addColDesc: desc } = this.state;
    const project_id = this.props.match.params.id;
    const res = await axios.post('/api/col/add_col', { name, desc, project_id });
    if (!res.data.errcode) {
      message.success('添加集合成功');
      await this.props.fetchInterfaceColList(project_id);

      this.setState({ id: res.data.data._id });
    } else {
      message.error(res.data.errmsg);
    }
  };

  select = id => {
    this.setState({ id });
  };
  
  onExpand = expandedKeys => {
    this.setState({
      expandedKeys,
      autoExpandParent: false
    });
  };
  
  // 递归构建树形结构的集合列表
  buildTreeNodes = (data, parentId = 0) => {
    const items = data.filter(item => 
      (item.type === 'folder' || item.type === 'group') && 
      Number(item.parent_id) === Number(parentId)
    );
    
    return items.map(item => {
      const children = this.buildTreeNodes(data, item._id);
      
      return (
        <TreeNode
          key={item._id}
          title={
            <span
              onClick={() => this.select(item._id)}
              className={`col-item ${item._id === this.state.id ? 'selected' : ''}`}
            >
              <Icon type="folder-open" style={{ marginRight: 6 }} />
              <span>{item.name}</span>
            </span>
          }
        >
          {children.length > 0 ? children : null}
        </TreeNode>
      );
    });
  };

  render() {
    let { interfaceColList = [] } = this.props;
    const ColList = interfaceColList.filter(item => item.type === 'folder' || item.type === 'group');
    const { id, expandedKeys, autoExpandParent } = this.state;
    
    // 构建树形结构的集合列表
    const treeNodes = this.buildTreeNodes(ColList);
    
    return (
      <Modal
        className="add-col-modal"
        title="添加到集合"
        visible={this.props.visible}
        onOk={() => this.props.onOk(id, this.state.caseName)}
        onCancel={this.props.onCancel}
      >
        <Row gutter={6} className="modal-input">
          <Col span="5">
            <div className="label">接口用例名：</div>
          </Col>
          <Col span="15">
            <Input
              placeholder="请输入接口用例名称"
              value={this.state.caseName}
              onChange={e => this.setState({ caseName: e.target.value })}
            />
          </Col>
        </Row>
        <p>请选择添加到的集合：</p>
        <div className="col-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {treeNodes.length > 0 ? (
            <Tree
              onExpand={this.onExpand}
              expandedKeys={expandedKeys}
              autoExpandParent={autoExpandParent}
            >
              {treeNodes}
            </Tree>
          ) : (
            <span>暂无集合，请添加！</span>
          )}
        </div>
        <Collapse>
          <Panel header="添加新集合">
            <Row gutter={6} className="modal-input">
              <Col span="5">
                <div className="label">集合名：</div>
              </Col>
              <Col span="15">
                <Input
                  placeholder="请输入集合名称"
                  value={this.state.addColName}
                  onChange={e => this.setState({ addColName: e.target.value })}
                />
              </Col>
            </Row>
            <Row gutter={6} className="modal-input">
              <Col span="5">
                <div className="label">简介：</div>
              </Col>
              <Col span="15">
                <TextArea
                  rows={3}
                  placeholder="请输入集合描述"
                  value={this.state.addColDesc}
                  onChange={e => this.setState({ addColDesc: e.target.value })}
                />
              </Col>
            </Row>
            <Row type="flex" justify="end">
              <Button style={{ float: 'right' }} type="primary" onClick={this.addCol}>
                添 加
              </Button>
            </Row>
          </Panel>
        </Collapse>
      </Modal>
    );
  }
}