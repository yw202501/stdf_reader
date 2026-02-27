import React from 'react';
import { Layout, Typography } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

function AppLayout({ children }) {
  return (
    <Layout className="apple-layout">
      <Header className="apple-header">
        <Link to="/" className="apple-brand-link">
          <ExperimentOutlined className="apple-brand-icon" />
          <Title level={4} className="apple-brand-title">
            STDF Reader
          </Title>
        </Link>
      </Header>
      <Content className="apple-content">
        <div className="app-content">{children}</div>
      </Content>
      <Footer className="apple-footer">STDF Reader ©2026</Footer>
    </Layout>
  );
}

export default AppLayout;
