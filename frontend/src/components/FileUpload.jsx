import React, { useState } from 'react';
import { Upload, Button, message, Progress } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { uploadFile } from '../services/api';

function FileUpload({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async (options) => {
    const { file } = options;
    setUploading(true);
    setProgress(0);
    try {
      await uploadFile(file, (percent) => setProgress(percent));
      message.success(`${file.name} 上传成功`);
      onUploadSuccess?.();
    } catch (error) {
      message.error(`上传失败: ${error.response?.data?.detail || error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Upload
        customRequest={handleUpload}
        accept=".stdf,.std"
        showUploadList={false}
      >
        <Button type="primary" icon={<UploadOutlined />} loading={uploading}>
          上传 STDF 文件
        </Button>
      </Upload>
      {uploading ? (
        <div style={{ marginTop: 12 }}>
          <Progress percent={progress} status="active" />
        </div>
      ) : null}
    </div>
  );
}

export default FileUpload;
