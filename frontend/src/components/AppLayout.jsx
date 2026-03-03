import React from 'react';
import { Layout, Typography } from 'antd';
import { Link } from 'react-router-dom';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

function AppLayout({ children }) {
  return (
    <Layout className="apple-layout">
      <Header className="apple-header">
        <Link to="/" className="apple-brand-link">
          <img src="/chip.svg" alt="OMNIBOT" className="apple-brand-icon" />
          <Title level={4} className="apple-brand-title">
            OMNIBOT
          </Title>
        </Link>
      </Header>
      <Content className="apple-content">
        <div className="app-content">{children}</div>
      </Content>
      <Footer className="apple-footer">OMNIBOT ©2026</Footer>
    </Layout>
  );
}

export default AppLayout;
