import React from 'react';
import { Layout, Typography } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

function AppLayout({ children }) {
  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0a1929 0%, #0d2a47 100%)',
          padding: '0 24px',
          borderBottom: '2px solid rgba(0, 212, 255, 0.2)',
          boxShadow: '0 2px 20px rgba(0, 0, 0, 0.5)',
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <ExperimentOutlined style={{ fontSize: 24, color: '#00d4ff', marginRight: 12 }} />
          <Title level={4} style={{ color: '#ffffff', margin: 0 }}>
            STDF Reader
          </Title>
        </Link>
      </Header>
      <Content style={{ padding: '24px', background: 'transparent', flex: 1 }}>
        <div className="app-content">{children}</div>
      </Content>
      <Footer style={{ textAlign: 'center', color: '#76869f', background: 'rgba(10, 25, 41, 0.8)', borderTop: '1px solid rgba(0, 212, 255, 0.2)' }}>
        STDF Reader ©2026
      </Footer>
    </Layout>
  );
}

export default AppLayout;
