import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import { Table, Select, Input, Icon } from 'antd';
import { connect } from 'react-redux';
import { fetchInterfaceColList } from '../../../../reducer/modules/interfaceCol';
import { fetchProjectList } from '../../../../reducer/modules/project';

const Option = Select.Option;

@connect(
    state => {
        return {
            projectList: state.project.projectList,
            list: state.interfaceCol.interfaceColList,
            curProject: state.project.currProject // 添加当前项目信息
        };
    },
    {
        fetchInterfaceColList,
        fetchProjectList
    }
)
export default class ImportCol extends Component {
    constructor(props) {
        super(props);
        this.state = {
            selectedRowKeys: [],
            categoryCount: {},
            project: this.props.currProjectId,
            filter: '',
            searchList: [],
            list: props.list ? [...props.list] : [], // 初始显示全部数据
            expandedRowKeys: [],  //自动展开有匹配集合的分类
            tableFilters: {} // 存储表格的筛选状态
        };
    }

    static propTypes = {
        list: PropTypes.array,
        selectCol: PropTypes.func,
        projectList: PropTypes.array,
        currProjectId: PropTypes.string,
        fetchInterfaceColList: PropTypes.func,
        fetchProjectList: PropTypes.func,
        curProject: PropTypes.object,
        searchList: PropTypes.array
    };

    async componentDidMount() {
        // 获取项目列表
        const groupId = this.props.curProject ? this.props.curProject.group_id : null;
        if (groupId) {
            await this.props.fetchProjectList(groupId);
        }
        
        await this.props.fetchInterfaceColList(this.props.currProjectId);
        this.setState({
            list: [...this.props.list]
        });
    }

    // 切换项目
    onChange = async val => {
        this.setState({
            project: val,
            selectedRowKeys: [],
            categoryCount: {},
            filter: '',
            searchList: [],
            expandedRowKeys: [],
            tableFilters: {}
        });
        await this.props.fetchInterfaceColList(val);
        const newList = this.props.list || [];
        this.setState({
            list: [...newList]
        });
    };

    handleSearch = (filter) => {
        const { list } = this.props;

        // ✅ 输入为空时，恢复完整数据
        if (!filter.trim()) {
            this.setState({
                searchList: [],
                expandedRowKeys: [],
                filter: '',
                list: [...list]  // 重置为初始数据
            });
            return;
        }

        const expandedRowKeys = [];
        // 只过滤出 folder 类型，排除 case、group 和 ref 类型
        const colList = list.filter(item => item.type === 'folder');

        // 按 parent_id 分组集合
        const groupedCols = {};
        colList.forEach(item => {
            const parentId = item.parent_id || 0;
            if (!groupedCols[parentId]) {
                groupedCols[parentId] = [];
            }
            groupedCols[parentId].push(item);
        });

        // 处理根目录集合（parent_id 为 0）
        const rootCols = groupedCols[0] || [];

        // 处理子目录集合
        const subDirs = {};
        Object.keys(groupedCols).forEach(parentId => {
            if (parentId !== '0') {
                subDirs[parentId] = groupedCols[parentId];
            }
        });

        // 创建根目录数据结构
        const rootData = rootCols.map(col => {
            return {
                _id: col._id,
                name: col.name,
                list: subDirs[col._id] || [] // 该集合下的子集合
            };
        });

        const filteredList = rootData.map(item => {
            const matchedChildren = item.list
                ? item.list.filter(
                    col =>
                        col.name.toLowerCase().includes(filter.toLowerCase())
                )
                : [];

            if (item.name.toLowerCase().includes(filter.toLowerCase()) || matchedChildren.length > 0) {
                expandedRowKeys.push('category_' + item._id);
                return {
                    ...item,
                    list: item.name.toLowerCase().includes(filter.toLowerCase())
                        ? item.list // 分类匹配，显示全部子节点
                        : matchedChildren // 子节点匹配，只显示匹配的子节点
                };
            }

            return null;
        }).filter(Boolean);

        this.setState({
            searchList: filteredList,
            expandedRowKeys,
            filter
        });
    };

    // 处理表格筛选变化
    handleTableChange = (pagination, filters) => {
        this.setState({ tableFilters: filters });
    };

    // 清空搜索框
    clearSearch = () => {
        this.setState({
            filter: '',
            searchList: [],
            expandedRowKeys: [],
            list: [...this.props.list] // ✅ 同样恢复初始数据
        });
    };

    render() {
        const { projectList } = this.props;
        const { list, expandedRowKeys, filter } = this.state;
        
        // 只过滤出 folder 类型，排除 case、group 和 ref 类型
        const colList = list.filter(item => item.type === 'folder');

        // 按 parent_id 分组集合
        const groupedCols = {};
        colList.forEach(item => {
            const parentId = item.parent_id || 0;
            if (!groupedCols[parentId]) {
                groupedCols[parentId] = [];
            }
            groupedCols[parentId].push(item);
        });

        // 处理根目录集合（parent_id 为 0）
        const rootCols = groupedCols[0] || [];

        // 处理子目录集合
        const subDirs = {};
        Object.keys(groupedCols).forEach(parentId => {
            if (parentId !== '0') {
                subDirs[parentId] = groupedCols[parentId];
            }
        });

        // 创建根目录数据结构
        const rootData = rootCols.map(col => {
            return {
                _id: col._id,
                name: col.name,
                list: subDirs[col._id] || [] // 该集合下的子集合
            };
        });

        // 转换为表格所需格式
        const data = rootData.map(item => {
            return {
                key: 'category_' + item._id,
                name: item.name, // 使用 name 作为表格显示字段
                _id: item._id, // 添加 _id 以便在选择时使用
                isCategory: true,
                children: item.list
                    ? item.list.map(e => {
                        e.key = e._id;
                        e.categoryKey = 'category_' + item._id;
                        e.categoryLength = item.list.length;
                        return e;
                    })
                    : []
            };
        });

        const self = this;
        const rowSelection = {
            onSelect: (record, selected) => {
                const oldSelecteds = self.state.selectedRowKeys;
                const categoryCount = self.state.categoryCount;
                const categoryKey = record.categoryKey;
                const categoryLength = record.categoryLength;
                let selectedRowKeys = [];
                if (record.isCategory) {
                    // 选择分类时，同时选择分类本身和其子项
                    const childIds = record.children.map(item => item._id);
                    selectedRowKeys = childIds.concat(record.key);
                    if (selected) {
                        selectedRowKeys = selectedRowKeys
                            .filter(id => oldSelecteds.indexOf(id) === -1)
                            .concat(oldSelecteds);
                        categoryCount[categoryKey] = categoryLength;
                    } else {
                        selectedRowKeys = oldSelecteds.filter(id => selectedRowKeys.indexOf(id) === -1);
                        categoryCount[categoryKey] = 0;
                    }
                } else {
                    if (selected) {
                        selectedRowKeys = oldSelecteds.concat(record._id);
                        if (categoryCount[categoryKey]) {
                            categoryCount[categoryKey] += 1;
                        } else {
                            categoryCount[categoryKey] = 1;
                        }
                        if (categoryCount[categoryKey] === record.categoryLength) {
                            selectedRowKeys.push(categoryKey);
                        }
                    } else {
                        selectedRowKeys = oldSelecteds.filter(id => id !== record._id);
                        if (categoryCount[categoryKey]) {
                            categoryCount[categoryKey] -= 1;
                        }
                        selectedRowKeys = selectedRowKeys.filter(id => id !== categoryKey);
                    }
                }
                self.setState({ selectedRowKeys, categoryCount });
                console.log('selectedRowKeys', selectedRowKeys);
                // 获取实际的集合ID
                const actualColIds = [];
                selectedRowKeys.forEach(id => {
                    if (('' + id).indexOf('category') === -1) {
                        // 直接选择的集合ID
                        actualColIds.push(id);
                    } else {
                        // 通过选择分类间接选择的集合
                        const categoryData = data.find(item => item.key === id);
                        if (categoryData) {
                            // 添加分类本身的ID
                            actualColIds.push(categoryData._id);
                        }
                    }
                });
                self.props.selectCol(
                    actualColIds,
                    self.state.project
                );
            },
            onSelectAll: selected => {
                let selectedRowKeys = [];
                let categoryCount = self.state.categoryCount;
                if (selected) {
                    data.forEach(item => {
                        if (item.children) {
                            categoryCount['category_' + item._id] = item.children.length;
                            selectedRowKeys = selectedRowKeys.concat(item.children.map(item => item._id));
                        }
                    });
                    selectedRowKeys = selectedRowKeys.concat(data.map(item => item.key));
                } else {
                    categoryCount = {};
                    selectedRowKeys = [];
                }
                self.setState({ selectedRowKeys, categoryCount });
                
                // 获取实际的集合ID
                const actualColIds = [];
                selectedRowKeys.forEach(id => {
                    if (('' + id).indexOf('category') === -1) {
                        // 直接选择的集合ID
                        actualColIds.push(id);
                    } else {
                        // 通过选择分类间接选择的集合
                        const categoryData = data.find(item => item.key === id);
                        if (categoryData) {
                            // 添加分类本身的ID
                            actualColIds.push(categoryData._id);
                        }
                    }
                });

                self.props.selectCol(
                    actualColIds,
                    self.state.project
                );
            },
            selectedRowKeys: self.state.selectedRowKeys
        };

        const columns = [
            {
                title: '集合名称',
                dataIndex: 'name',
                width: '30%'
            },
            {
                title: '描述',
                dataIndex: 'desc',
                width: '40%',
                render: (text) => text || '-'
            },
            {
                title: '类型',
                dataIndex: 'type',
                render: () => {
                    // 由于只显示 folder 类型，始终返回 '文件夹'
                    return '文件夹';
                }
            }
        ];

        return (
          <div>
            <div className="select-project" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 16 }}>
              <span>选择要导入的项目：</span>
              <Select value={this.state.project} style={{ width: 200 }} onChange={this.onChange}>
                {projectList.map(item =>
                            item.projectname ? null : (
                              <Option value={`${item._id}`} key={item._id}>
                                {item.name}
                              </Option>
                            )
                        )}
              </Select>

              <div className="interface-filter" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Input
                            value={filter}
                            placeholder="搜索集合"
                            style={{ width: 200 }}
                            onChange={e => this.handleSearch(e.target.value)}
                            suffix={
                                filter ? (
                                  <Icon
                                        type="close-circle"
                                        onClick={this.clearSearch}
                                        style={{ cursor: 'pointer', color: 'rgba(0,0,0,.45)' }}
                                    />
                                ) : null
                            }
                        />
              </div>
            </div>
            <Table
                    columns={columns}
                    rowSelection={rowSelection}
                    dataSource={data}
                    pagination={false}
                    expandedRowKeys={expandedRowKeys}
                    onExpandedRowsChange={expandedRowKeys => this.setState({ expandedRowKeys })}
                    onChange={this.handleTableChange}
                />
          </div>
        );
    }
}