import React, { useState, useEffect, useRef } from 'react';
import { Card, Table, Space, Typography, Empty, Spin, Progress, message, Tag, Button } from 'antd';
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
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
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
          {index === 0 && files.length > 0 && <Tag color="cyan">最新</Tag>}
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
    if (parsing) return;

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

  const handleOpenSelectedFiles = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择至少一个文件');
      return;
    }
    const firstFile = selectedRowKeys[0];
    navigate(`/file/${firstFile}`, { state: { filenames: selectedRowKeys } });
  };

  return (
    <div className="home-page">
      <Card className="apple-glass-panel home-toolbar-card">
        <Space className="home-toolbar" wrap>
          <Space>
            <FolderOpenOutlined className="home-folder-icon" />
            <Title level={4} className="home-title">
              STDF 文件管理
            </Title>
          </Space>
          <Space>
            <Button
              type="primary"
              className="apple-primary-btn"
              onClick={handleOpenSelectedFiles}
              disabled={selectedRowKeys.length === 0 || parsing}
            >
              合并查看选中项 ({selectedRowKeys.length})
            </Button>
            <FileUpload onUploadSuccess={loadFiles} />
          </Space>
        </Space>

        {parsing ? (
          <div className="home-parse-progress">
            <div className="home-parse-label">正在解析 {parseFilename}...</div>
            <Progress percent={parsePercent} status="active" />
          </div>
        ) : null}
      </Card>

      <Card className="apple-glass-panel">
        <Spin spinning={loading}>
          {files.length > 0 ? (
            <Table
              className="apple-table"
              columns={columns}
              dataSource={files}
              rowKey="name"
              rowSelection={{
                selectedRowKeys,
                onChange: (newSelectedRowKeys) => setSelectedRowKeys(newSelectedRowKeys),
              }}
              onRow={(record) => ({
                onClick: (event) => {
                  if (event.target.closest('.ant-checkbox-wrapper') || event.target.closest('.ant-checkbox')) {
                    return;
                  }
                  handleOpenFile(record);
                },
                className: 'apple-click-row',
              })}
              pagination={false}
            />
          ) : (
            <Empty description="暂无 STDF 文件，请上传文件或将文件放入 data/ 目录" className="home-empty" />
          )}
        </Spin>
      </Card>
    </div>
  );
}

export default Home;
