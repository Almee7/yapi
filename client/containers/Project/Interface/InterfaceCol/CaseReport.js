import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Tabs, Input } from 'antd';
const TabPane = Tabs.TabPane;
const { Search } = Input;

function jsonFormat(json) {
  // console.log('json',json)
  if (json && typeof json === 'object') {
    return JSON.stringify(json, null, '   ');
  }
  return json;
}

// 高亮显示搜索结果的组件
const HighlightText = ({ text, searchKeyword }) => {
  if (!searchKeyword) {
    return <span>{text}</span>;
  }

  const regex = new RegExp(`(${searchKeyword})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} style={{ backgroundColor: '#ff0', padding: '2px 4px', borderRadius: '3px' }}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

HighlightText.propTypes = {
  text: PropTypes.string.isRequired,
  searchKeyword: PropTypes.string
};

class CaseReport extends Component {
  constructor(props) {
    super(props);
    this.state = {
      resBodySearchKeyword: '',
      resHeaderSearchKeyword: '',
      requestSearchKeyword: ''
    };
  }

  handleSearch = (value, type) => {
    this.setState({ [type]: value });
  };

  render() {
    const { resBodySearchKeyword, resHeaderSearchKeyword, requestSearchKeyword } = this.state;
    let params = jsonFormat(this.props.data);
    let headers = jsonFormat(this.props.headers, null, '   ');
    let res_header = jsonFormat(this.props.res_header, null, '   ');
    let res_body = jsonFormat(this.props.res_body);
    let httpCode = this.props.status;
    let validRes;
    if (this.props.validRes && Array.isArray(this.props.validRes)) {
      validRes = this.props.validRes.map((item, index) => {
        return <div key={index}>{item.message}</div>;
      })
    }

    return (
      <div className="report">
        <Tabs defaultActiveKey="request">
          <TabPane className="case-report-pane" tab="Request" key="request">
            <Row className="case-report">
              <Col className="case-report-title" span="6">
                Url
              </Col>
              <Col span="18">{this.props.url}</Col>
            </Row>
            {this.props.query ? (
              <Row className="case-report">
                <Col className="case-report-title" span="6">
                  Query
                </Col>
                <Col span="18">{this.props.query}</Col>
              </Row>
            ) : null}

            {this.props.headers ? (
              <Row className="case-report">
                <Col className="case-report-title" span="6">
                  Headers
                </Col>
                <Col span="18">
                  <div style={{ marginBottom: '10px' }}>
                    <Search
                      placeholder="在 Headers 中搜索..."
                      onSearch={value => this.handleSearch(value, 'requestSearchKeyword')}
                      style={{ width: 300 }}
                      size="small"
                    />
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    <HighlightText text={headers} searchKeyword={requestSearchKeyword} />
                  </pre>
                </Col>
              </Row>
            ) : null}

            {params ? (
              <Row className="case-report">
                <Col className="case-report-title" span="6">
                  Body
                </Col>
                <Col span="18">
                  <div style={{ marginBottom: '10px' }}>
                    <Search
                      placeholder="在 Body 中搜索..."
                      onSearch={value => this.handleSearch(value, 'requestSearchKeyword')}
                      style={{ width: 300 }}
                      size="small"
                    />
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    <HighlightText text={params} searchKeyword={requestSearchKeyword} />
                  </pre>
                </Col>
              </Row>
            ) : null}
          </TabPane>
          <TabPane className="case-report-pane" tab="Response" key="response">
            <Row  className="case-report">
              <Col className="case-report-title" span="6">
                HttpCode
              </Col>
              <Col span="18">
                <pre>{httpCode}</pre>
              </Col>
            </Row>
            {this.props.res_header ? (
              <Row className="case-report">
                <Col className="case-report-title" span="6">
                  Headers
                </Col>
                <Col span="18">
                  <div style={{ marginBottom: '10px' }}>
                    <Search
                      placeholder="在 Headers 中搜索..."
                      onSearch={value => this.handleSearch(value, 'resHeaderSearchKeyword')}
                      style={{ width: 300 }}
                      size="small"
                    />
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    <HighlightText text={res_header} searchKeyword={resHeaderSearchKeyword} />
                  </pre>
                </Col>
              </Row>
            ) : null}
            {this.props.res_body ? (
              <Row className="case-report">
                <Col className="case-report-title" span="6">
                  Body
                </Col>
                <Col span="18">
                  <div style={{ marginBottom: '10px' }}>
                    <Search
                      placeholder="在 Response Body 中搜索..."
                      onSearch={value => this.handleSearch(value, 'resBodySearchKeyword')}
                      style={{ width: 300 }}
                      size="small"
                    />
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    <HighlightText text={res_body} searchKeyword={resBodySearchKeyword} />
                  </pre>
                </Col>
              </Row>
            ) : null}
          </TabPane>
          <TabPane className="case-report-pane" tab="验证结果" key="valid">
            {this.props.validRes ? (
              <Row className="case-report">
                <Col className="case-report-title" span="6">
                  验证结果
                </Col>
                <Col span="18"><pre>
                  {validRes}  
                </pre></Col>
              </Row>
            ) : null}
          </TabPane>
        </Tabs>
      </div>
    );
  }
}

CaseReport.propTypes = {
  url: PropTypes.string,
  data: PropTypes.any,
  headers: PropTypes.object,
  res_header: PropTypes.object,
  res_body: PropTypes.any,
  query: PropTypes.string,
  validRes: PropTypes.array,
  status: PropTypes.number
};

export default CaseReport;