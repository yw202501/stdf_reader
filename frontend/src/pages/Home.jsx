import React, { useState, useEffect, useRef } from 'react';
import { Card, Table, Space, Typography, Empty, Spin, Progress, message, Tag } from 'antd';
import { FileOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getFileList, startParse, getParseProgress } from '../services/api';
import FileUpload from '../components/FileUpload';

const { Title } = Typography;

function Home() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsePercent, setParsePercent] = useState(0);
  const [parseFilename, setParseFilename] = useState('');
  const parseTimerRef = useRef(null);
  const navigate = useNavigate();

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await getFileList();
      setFiles(res.data.files || []);
    } catch (e) {
      console.error('加载文件列表失败', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    return () => {
      if (parseTimerRef.current) {
        clearInterval(parseTimerRef.current);
      }
    };
  }, []);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (ts) => {
    return new Date(ts * 1000).toLocaleString('zh-CN');
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      render: (name, record, index) => (
        <Space>
          <FileOutlined />
          <a>{name}</a>
          {index === 0 && files.length > 0 && (
            <Tag color="cyan" style={{ marginLeft: 8 }}>最新</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      render: formatSize,
      width: 120,
    },
    {
      title: '修改时间',
      dataIndex: 'modified',
      render: formatDate,
      width: 200,
    },
  ];

  const handleOpenFile = async (record) => {
    if (parsing) {
      return;
    }

    setParsing(true);
    setParseFilename(record.name);
    setParsePercent(0);

    try {
      const startRes = await startParse(record.name);
      const jobId = startRes.data.job_id;

      const poll = async () => {
        try {
          const progressRes = await getParseProgress(jobId);
          const { status, percent, error } = progressRes.data;
          setParsePercent(percent || 0);

          if (status === 'done') {
            if (parseTimerRef.current) {
              clearInterval(parseTimerRef.current);
              parseTimerRef.current = null;
            }
            setParsing(false);
            navigate(`/file/${record.name}`, { state: { jobId } });
          }

          if (status === 'error') {
            if (parseTimerRef.current) {
              clearInterval(parseTimerRef.current);
              parseTimerRef.current = null;
            }
            setParsing(false);
            message.error(`解析失败: ${error || '未知错误'}`);
          }
        } catch (err) {
          if (parseTimerRef.current) {
            clearInterval(parseTimerRef.current);
            parseTimerRef.current = null;
          }
          setParsing(false);
          message.error(`解析进度获取失败: ${err.message}`);
        }
      };

      parseTimerRef.current = setInterval(poll, 500);
      await poll();
    } catch (err) {
      setParsing(false);
      message.error(`启动解析失败: ${err.message}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a1929 0%, #132a4c 100%)', padding: 24 }}>
      <Card style={{ marginBottom: 16, background: '#1a3a52', borderColor: '#0d5a7f', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
        <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <FolderOpenOutlined style={{ fontSize: 24, color: '#00d4ff' }} />
            <Title level={4} style={{ margin: 0, color: '#ffffff' }}>
              STDF 文件管理
            </Title>
          </Space>
          <FileUpload onUploadSuccess={loadFiles} />
        </Space>
        {parsing ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8, color: '#00d4ff', fontWeight: 'bold' }}>正在解析 {parseFilename}...</div>
            <Progress percent={parsePercent} status="active" strokeColor={{ from: '#00d4ff', to: '#0d5a7f' }} />
          </div>
        ) : null}
      </Card>

      <Card style={{ background: '#1a3a52', borderColor: '#0d5a7f', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
        <Spin spinning={loading}>
          {files.length > 0 ? (
            <Table
              columns={columns}
              dataSource={files}
              rowKey="name"
              onRow={(record) => ({
                onClick: () => handleOpenFile(record),
                style: { cursor: 'pointer', transition: 'all 0.3s ease' },
                onMouseEnter: (e) => {
                  e.currentTarget.style.background = 'rgba(13, 90, 127, 0.5)';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 212, 255, 0.3)';
                },
                onMouseLeave: (e) => {
                  e.currentTarget.style.background = '';
                  e.currentTarget.style.boxShadow = '';
                },
              })}
              pagination={false}
            />
          ) : (
            <Empty
              description="暂无 STDF 文件，请上传文件或将文件放入 data/ 目录"
              style={{ padding: 40, color: '#76869f' }}
            />
          )}
        </Spin>
      </Card>

      <style>{`
        .ant-table {
          background: transparent !important;
          color: #e0e0e0 !important;
        }
        .ant-table-thead > tr > th {
          background: rgba(13, 90, 127, 0.3) !important;
          color: #00d4ff !important;
          border-bottom-color: rgba(0, 212, 255, 0.2) !important;
          font-weight: 600 !important;
        }
        .ant-table-tbody > tr {
          background: transparent !important;
          border-bottom-color: rgba(0, 212, 255, 0.1) !important;
        }
        .ant-table-tbody > tr > td {
          color: #e0e0e0 !important;
          border-bottom-color: rgba(0, 212, 255, 0.1) !important;
        }
        .ant-table-tbody > tr:hover > td {
          background: rgba(13, 90, 127, 0.3) !important;
        }
        .ant-empty-description {
          color: #76869f !important;
        }
      `}</style>
    </div>
  );
}

export default Home;
