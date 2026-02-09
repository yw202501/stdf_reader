import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Tabs, Spin, Button, message, Progress } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getFileSummary, getWaferMap, startParse, getParseProgress } from '../services/api';
import TestSummary from '../components/TestSummary';
import TestResults from '../components/TestResults';
import WaferMap from '../components/WaferMap';

function FileDetail() {
  const { filename } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [summary, setSummary] = useState(null);
  const [waferData, setWaferData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [parsePercent, setParsePercent] = useState(0);
  const [parseStatus, setParseStatus] = useState('idle');
  const jobIdFromState = location.state?.jobId;

  useEffect(() => {
    if (!filename) return;

    let timerId;
    let stopped = false;

    const loadData = async () => {
      setLoading(true);
      try {
        const [summaryRes, waferRes] = await Promise.all([
          getFileSummary(filename),
          getWaferMap(filename),
        ]);
        if (!stopped) {
          setSummary(summaryRes.data);
          setWaferData(waferRes.data);
        }
      } catch (err) {
        if (!stopped) {
          message.error(`加载文件数据失败: ${err.message}`);
        }
      } finally {
        if (!stopped) {
          setLoading(false);
        }
      }
    };

    const pollProgress = async (jobId) => {
      try {
        const progressRes = await getParseProgress(jobId);
        if (stopped) {
          return;
        }
        const { status, percent, error } = progressRes.data;
        setParsePercent(percent || 0);

        if (status === 'done') {
          setParseStatus('done');
          setParsePercent(100);
          if (timerId) {
            clearInterval(timerId);
          }
          await loadData();
        }

        if (status === 'error') {
          setParseStatus('error');
          if (timerId) {
            clearInterval(timerId);
          }
          message.error(`解析失败: ${error || '未知错误'}`);
          setLoading(false);
        }
      } catch (err) {
        if (timerId) {
          clearInterval(timerId);
        }
        message.error(`解析进度获取失败: ${err.message}`);
        setLoading(false);
      }
    };

    const startJob = async () => {
      setLoading(true);
      setParseStatus('running');
      setParsePercent(0);

      try {
        let jobId = jobIdFromState;
        if (!jobId) {
          const startRes = await startParse(filename);
          jobId = startRes.data.job_id;
        }
        timerId = setInterval(() => pollProgress(jobId), 500);
        await pollProgress(jobId);
      } catch (err) {
        message.error(`启动解析失败: ${err.message}`);
        setLoading(false);
        setParseStatus('error');
      }
    };

    startJob();

    return () => {
      stopped = true;
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [filename, jobIdFromState]);

  const tabItems = [
    {
      key: 'summary',
      label: '摘要信息',
      children: <TestSummary summary={summary} />,
    },
    {
      key: 'results',
      label: '测试结果',
      children: <TestResults filename={filename} />,
    },
    {
      key: 'wafermap',
      label: 'Wafer Map',
      children: <WaferMap waferData={waferData} />,
    },
  ];

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        style={{ marginBottom: 16 }}
        onClick={() => navigate('/')}
      >
        返回文件列表
      </Button>

      {parseStatus === 'running' ? (
        <div style={{ marginBottom: 16, background: '#1a3a52', padding: 12, borderRadius: 8, border: '1px solid rgba(0, 212, 255, 0.2)', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)' }}>
          <div style={{ marginBottom: 8, color: '#00d4ff', fontWeight: 'bold' }}>正在解析文件...</div>
          <Progress percent={parsePercent} status="active" strokeColor={{ from: '#00d4ff', to: '#0d5a7f' }} />
        </div>
      ) : null}

      <Spin spinning={loading}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
          style={{ background: '#1a3a52', padding: '16px 24px', borderRadius: 8, border: '1px solid rgba(0, 212, 255, 0.2)', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)' }}
        />
      </Spin>
    </div>
  );
}

export default FileDetail;
