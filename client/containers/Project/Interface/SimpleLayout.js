import React from 'react';
import PropTypes from 'prop-types';
import { Layout } from 'antd';

const { Content } = Layout;

const SimpleLayout = ({ children }) => {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Layout>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: '#fff',
            minHeight: 800
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

SimpleLayout.propTypes = {
  children: PropTypes.node
};

export default SimpleLayout;