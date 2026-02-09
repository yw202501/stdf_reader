import axios from 'axios';

const api = axios.create({
  baseURL: '/api/stdf',
  timeout: 60000,
});

/** 获取 STDF 文件列表 */
export const getFileList = () => api.get('/files');

/** 上传 STDF 文件 */
export const uploadFile = (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) {
        return;
      }
      const percent = Math.round((event.loaded * 100) / event.total);
      onProgress(percent);
    },
  });
};

/** 获取文件摘要 */
export const getFileSummary = (filename) => api.get(`/summary/${filename}`);

/** 启动解析任务 */
export const startParse = (filename) => api.post(`/parse/${filename}`);

/** 获取解析进度 */
export const getParseProgress = (jobId) => api.get(`/progress/${jobId}`);

/** 获取测试结果 */
export const getTestResults = (filename, params = {}) =>
  api.get(`/results/${filename}`, { params });

/** 获取 Wafer Map 数据 */
export const getWaferMap = (filename) => api.get(`/wafermap/${filename}`);

/** 获取测试项列表 */
export const getTestList = (filename) => api.get(`/test-list/${filename}`);

export default api;
