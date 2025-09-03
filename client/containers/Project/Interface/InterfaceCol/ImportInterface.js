import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import {Table, Select, Tooltip, Icon, Input} from 'antd';
import variable from '../../../../constants/variable';
import { connect } from 'react-redux';
const Option = Select.Option;
import { fetchInterfaceListMenu } from '../../../../reducer/modules/interface.js';

@connect(
    state => {
        return {
            projectList: state.project.projectList,
            list: state.inter.list
        };
    },
    {
        fetchInterfaceListMenu
    }
)
export default class ImportInterface extends Component {
    constructor(props) {
        super(props);
        this.state = {
            selectedRowKeys: [],
            categoryCount: {},
            project: this.props.currProjectId,
            filter: '',
            searchList: [],
            list: props.list ? [...props.list] : [], // 初始显示全部数据
            expandedRowKeys: [],  //自动展开有匹配接口的分类
            tableFilters: {} // 存储表格的筛选状态
        };
    }

    static propTypes = {
        list: PropTypes.array,
        selectInterface: PropTypes.func,
        projectList: PropTypes.array,
        currProjectId: PropTypes.string,
        fetchInterfaceListMenu: PropTypes.func,
        searchList: PropTypes.array
    };

    async componentDidMount() {
        await this.props.fetchInterfaceListMenu(this.props.currProjectId);
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
        await this.props.fetchInterfaceListMenu(val);
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

        const filteredList = list
            .map(item => {
                // 搜索分类名称
                const isCategoryMatch = item.name.toLowerCase().includes(filter.toLowerCase());

                // 搜索子节点
                const matchedChildren = item.list
                    ? item.list.filter(
                        inter =>
                            inter.title.toLowerCase().includes(filter.toLowerCase()) ||
                            inter.path.toLowerCase().includes(filter.toLowerCase())
                    )
                    : [];

                if (isCategoryMatch || matchedChildren.length > 0) {
                    expandedRowKeys.push('category_' + item._id);
                    return {
                        ...item,
                        list: isCategoryMatch ? item.list : matchedChildren
                    };
                }
                return null;
            })
            .filter(Boolean);

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
        const { projectList} = this.props;
        const { searchList, list, expandedRowKeys, filter, tableFilters } = this.state;
        const displayList = searchList.length > 0 || filter.trim() ? searchList : list;

        const data = displayList.map(item => {
            return {
                key: 'category_' + item._id,
                title: item.name,
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
                    selectedRowKeys = record.children.map(item => item._id).concat(record.key);
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
                self.props.selectInterface(
                    selectedRowKeys.filter(id => ('' + id).indexOf('category') === -1),
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
                self.props.selectInterface(
                    selectedRowKeys.filter(id => ('' + id).indexOf('category') === -1),
                    self.state.project
                );
            },
            selectedRowKeys: self.state.selectedRowKeys
        };

        const columns = [
            {
                title: '接口名称',
                dataIndex: 'title',
                width: '30%'
            },
            {
                title: '接口路径',
                dataIndex: 'path',
                width: '40%'
            },
            {
                title: '请求方法',
                dataIndex: 'method',
                render: item => {
                    let methodColor = variable.METHOD_COLOR[item ? item.toLowerCase() : 'get'];
                    return (
                      <span
                            style={{
                                color: methodColor.color,
                                backgroundColor: methodColor.bac,
                                borderRadius: 4
                            }}
                            className="colValue"
                        >
                        {item}
                      </span>
                    );
                }
            },
            {
                title: (
                  <span>
                    状态{' '}
                    <Tooltip title="筛选满足条件的接口集合">
                      <Icon type="question-circle-o" />
                    </Tooltip>
                  </span>
                ),
                dataIndex: 'status',
                render: text => {
                    return (
                        text &&
                        (text === 'done' ? (
                          <span className="tag-status done">已完成</span>
                        ) : (
                          <span className="tag-status undone">未完成</span>
                        ))
                    );
                },
                filters: [
                    {
                        text: '已完成',
                        value: 'done'
                    },
                    {
                        text: '未完成',
                        value: 'undone'
                    }
                ],
                filteredValue: tableFilters.status || null,
                onFilter: (value, record) => {
                    let arr = record.children.filter(item => {
                        return item.status.indexOf(value) === 0;
                    });
                    return arr.length > 0;
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
                            placeholder="搜索接口"
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