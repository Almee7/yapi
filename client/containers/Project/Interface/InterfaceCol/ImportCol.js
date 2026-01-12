import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import { Table, Select, Input, Icon } from 'antd';
import { connect } from 'react-redux';
import { fetchInterfaceColList } from '../../../../reducer/modules/interfaceCol';
import { fetchProjectList } from '../../../../reducer/modules/project';

const { Option } = Select;

@connect(
    state => ({
        projectList: state.project.projectList,
        list: state.interfaceCol.interfaceColList,
        curProject: state.project.currProject // 添加当前项目信息
    }),
    { fetchInterfaceColList, fetchProjectList }
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
            list: props.list ? [...props.list] : [],
            expandedRowKeys: [],
            tableFilters: {}
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
        const groupId = this.props.curProject ? this.props.curProject.group_id : null;
        if (groupId) {
            await this.props.fetchProjectList(groupId);
        }
        await this.props.fetchInterfaceColList(this.props.currProjectId);
        const filteredList = this.props.list ? this.props.list.filter(item => item.type === 'folder') : [];
        this.setState({ list: [...filteredList] });
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
        const filteredList = this.props.list ? this.props.list.filter(item => item.type === 'folder') : [];
        this.setState({ list: [...filteredList] });
    };

    handleSearch = filter => {
        const { list } = this.props;

        if (!filter.trim()) {
            this.setState({
                searchList: [],
                expandedRowKeys: [],
                filter: '',
                list: [...list]
            });
            return;
        }

        const expandedRowKeys = [];
        const colList = list.filter(item => item.type === 'folder');

        const groupedCols = {};
        colList.forEach(item => {
            const parentId = item.parent_id || 0;
            if (!groupedCols[parentId]) {
                groupedCols[parentId] = [];
            }
            groupedCols[parentId].push(item);
        });

        const searchTreeData = (parentId = 0, depth = 0) => {
            if (depth >= 5) return [];

            const items = groupedCols[parentId] || [];
            return items
                .map(col => {
                    const isCurrentMatch = col.name.toLowerCase().includes(filter.toLowerCase());
                    const subItems = searchTreeData(col._id, depth + 1);
                    const hasMatchingChildren = subItems.length > 0;

                    if (isCurrentMatch || hasMatchingChildren) {
                        if (isCurrentMatch) {
                            expandedRowKeys.push('category_' + col._id);
                        }
                        return {
                            _id: col._id,
                            name: col.name,
                            desc: col.desc,
                            list: isCurrentMatch ? groupedCols[col._id] || [] : subItems
                        };
                    }
                    return null;
                })
                .filter(Boolean);
        };

        const filteredList = searchTreeData(0);

        const convertTreeToTableData = (treeData, parentPath = []) => {
            let result = [];
            treeData.forEach(item => {
                const currentPath = [...parentPath, item._id];
                const tableItem = {
                    key: 'category_' + item._id,
                    name: item.name,
                    desc: item.desc,
                    _id: item._id,
                    isCategory: true,
                    categoryLength: item.list ? item.list.length : 0,
                    categoryKey:
                        parentPath.length > 0 ? 'category_' + parentPath[parentPath.length - 1] : null
                };
                if (item.list && item.list.length > 0) {
                    tableItem.children = convertTreeToTableData(item.list, currentPath);
                }
                result.push(tableItem);
            });
            return result;
        };

        this.setState({
            searchList: convertTreeToTableData(filteredList),
            expandedRowKeys,
            filter
        });
    };

    handleTableChange = (pagination, filters) => {
        this.setState({ tableFilters: filters });
    };

    clearSearch = () => {
        this.setState({
            filter: '',
            searchList: [],
            expandedRowKeys: [],
            list: this.props.list ? [...this.props.list.filter(item => item.type === 'folder')] : []
        });
    };

    render() {
        const { projectList } = this.props;
        const { list, expandedRowKeys, filter } = this.state;

        const colList = list.filter(item => item.type === 'folder');
        const groupedCols = {};
        colList.forEach(item => {
            const parentId = item.parent_id || 0;
            if (!groupedCols[parentId]) groupedCols[parentId] = [];
            groupedCols[parentId].push(item);
        });

        const buildTreeData = (parentId = 0, depth = 0) => {
            if (depth >= 5) return [];
            const items = groupedCols[parentId] || [];
            return items.map(col => ({
                _id: col._id,
                name: col.name,
                desc: col.desc,
                list: buildTreeData(col._id, depth + 1)
            }));
        };

        const rootData = buildTreeData(0);

        const convertTreeToTableData = (treeData, parentPath = []) => {
            let result = [];
            treeData.forEach(item => {
                const currentPath = [...parentPath, item._id];
                const tableItem = {
                    key: 'category_' + item._id,
                    name: item.name,
                    desc: item.desc,
                    _id: item._id,
                    isCategory: true,
                    categoryLength: item.list ? item.list.length : 0,
                    categoryKey:
                        parentPath.length > 0 ? 'category_' + parentPath[parentPath.length - 1] : null
                };
                if (item.list && item.list.length > 0) {
                    tableItem.children = convertTreeToTableData(item.list, currentPath);
                }
                result.push(tableItem);
            });
            return result;
        };

        const data = convertTreeToTableData(rootData);
        const self = this;

        const rowSelection = {
            onSelect: (record, selected) => {
                const oldSelecteds = self.state.selectedRowKeys;
                const categoryCount = self.state.categoryCount;
                const categoryKey = record.categoryKey;
                const categoryLength = record.categoryLength;
                let selectedRowKeys = [];

                if (record.isCategory) {
                    let allChildIds = [];
                    const collectAllChildIds = item => {
                        if (item.children && item.children.length > 0) {
                            item.children.forEach(child => {
                                allChildIds.push(child._id);
                                collectAllChildIds(child);
                            });
                        }
                    };
                    collectAllChildIds(record);
                    selectedRowKeys = allChildIds.concat(record.key);
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
                        categoryCount[categoryKey] = categoryCount[categoryKey]
                            ? categoryCount[categoryKey] + 1
                            : 1;
                        if (categoryCount[categoryKey] === record.categoryLength) {
                            selectedRowKeys.push(categoryKey);
                        }
                    } else {
                        selectedRowKeys = oldSelecteds.filter(id => id !== record._id);
                        if (categoryCount[categoryKey]) categoryCount[categoryKey] -= 1;
                        selectedRowKeys = selectedRowKeys.filter(id => id !== categoryKey);
                    }
                }

                self.setState({ selectedRowKeys, categoryCount });

                const actualColIds = [];
                selectedRowKeys.forEach(id => {
                    if (('' + id).indexOf('category') === -1) {
                        actualColIds.push(id);
                    } else {
                        actualColIds.push(parseInt(id.replace('category_', '')));
                    }
                });

                self.props.selectCol(actualColIds, self.state.project);
            },
            onSelectAll: selected => {
                let selectedRowKeys = [];
                let categoryCount = self.state.categoryCount;

                const collectAllIds = items => {
                    let ids = [];
                    items.forEach(item => {
                        ids.push(item.key);
                        if (item._id && ('' + item.key).indexOf('category') === 0) ids.push(item._id);
                        if (item.children && item.children.length > 0) ids = ids.concat(collectAllIds(item.children));
                    });
                    return ids;
                };

                if (selected) {
                    selectedRowKeys = collectAllIds(filter.trim() ? self.state.searchList : data);
                } else {
                    categoryCount = {};
                    selectedRowKeys = [];
                }

                self.setState({ selectedRowKeys, categoryCount });

                const actualColIds = [];
                selectedRowKeys.forEach(id => {
                    if (('' + id).indexOf('category') === -1) {
                        actualColIds.push(id);
                    } else {
                        const categoryData = data.find(item => item.key === id);
                        if (categoryData) actualColIds.push(categoryData._id);
                    }
                });

                self.props.selectCol(actualColIds, self.state.project);
            },
            selectedRowKeys: self.state.selectedRowKeys
        };

        const columns = [
            { title: '集合名称', dataIndex: 'name', width: '30%' },
            { title: '描述', dataIndex: 'desc', width: '40%', render: text => text || '-' },
            { title: '类型', dataIndex: 'type', render: () => '文件夹' }
        ];

        return (
          <div>
            <div
                    className="select-project"
                    style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 16 }}
                >
              <span>选择要导入的项目：</span>
              <Select value={this.state.project} style={{ width: 200 }} onChange={this.onChange}>
                {projectList.map(item =>
                            item.projectname ? null : (
                              <Option value={item._id} key={item._id}>
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
                    dataSource={filter.trim() ? this.state.searchList : data}
                    pagination={false}
                    expandedRowKeys={expandedRowKeys}
                    onExpandedRowsChange={expandedRowKeys => this.setState({ expandedRowKeys })}
                    onChange={this.handleTableChange}
                />
          </div>
        );
    }
}
