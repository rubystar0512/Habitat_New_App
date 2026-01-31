import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Card,
  Button,
  Tag,
  Space,
  Typography,
  Input,
  message,
  Select,
  Tooltip,
  Skeleton,
  Row,
  Col,
  Modal,
  Form,
  InputNumber,
  Popconfirm,
  Descriptions,
  Tabs,
  Divider,
  AutoComplete
} from 'antd';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import {
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  LinkOutlined,
  FilterOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const SuccessfulTasks = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({
    repo_id: undefined,
    min_ai_success_rate: undefined
  });
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0
  });
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [submitForm] = Form.useForm();
  const [approveLoading, setApproveLoading] = useState({});
  const [rejectLoading, setRejectLoading] = useState({});
  const [basePatchValue, setBasePatchValue] = useState('');
  const [goldenPatchValue, setGoldenPatchValue] = useState('');
  const [testPatchValue, setTestPatchValue] = useState('');

  useEffect(() => {
    fetchTasks();
  }, [pagination.current, pagination.pageSize, filters.repo_id, filters.min_ai_success_rate]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
        ...(filters.repo_id && { repo_id: filters.repo_id }),
        ...(filters.min_ai_success_rate && { min_ai_success_rate: filters.min_ai_success_rate })
      };
      const response = await api.get('/successful-tasks', { params });
      setTasks(response.data.tasks || []);
      setPagination(prev => ({ ...prev, total: response.data.total || 0 }));
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      message.error(err.response?.data?.error || 'Failed to fetch successful tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    // Validate required fields
    if (!values.gitBaseCommit || !values.mergeCommit) {
      message.error('Please enter both Git Base Commit and Merge Commit');
      return;
    }

    // Validate required patches
    if (!goldenPatchValue || !testPatchValue) {
      message.error('Please enter both Golden Patch and Test Patch');
      return;
    }

    setSubmitting(true);
    try {
      // Convert camelCase to snake_case for backend
      const payload = {
        task_name: values.taskName,
        task_description: values.taskDescription,
        git_base_commit: values.gitBaseCommit,
        merge_commit: values.mergeCommit,
        pr_number: values.prNumber,
        hints: values.hints,
        base_patch: basePatchValue,
        golden_patch: goldenPatchValue,
        test_patch: testPatchValue,
        ai_success_rate: values.aiSuccessRate,
        payout_amount: values.payoutAmount
      };
      
      console.log('Submitting task with payload:', { ...payload, base_patch: basePatchValue ? '...' : '', golden_patch: goldenPatchValue ? '...' : '', test_patch: testPatchValue ? '...' : '' });
      
      if (editingTaskId) {
        // Update existing task
        await api.patch(`/successful-tasks/${editingTaskId}`, payload);
        message.success('Task updated successfully');
      } else {
        // Create new task
        await api.post('/successful-tasks', payload);
        message.success('Task submitted successfully and is now visible to all team members.');
      }
      setSubmitModalVisible(false);
      setEditingTaskId(null);
      submitForm.resetFields();
      setBasePatchValue('');
      setGoldenPatchValue('');
      setTestPatchValue('');
      await fetchTasks();
    } catch (err) {
      console.error('Failed to submit task:', err);
      const errorData = err.response?.data || {};
      const errorMsg = errorData.error || 'Failed to submit task';
      const errorMessage = errorData.message || errorMsg;
      
      message.error(errorMessage);
      
      // If commit not found, provide more helpful information
      if (errorMsg.includes('Commit not found')) {
        const gitBaseCommit = errorData.git_base_commit || values.gitBaseCommit;
        const mergeCommit = errorData.merge_commit || values.mergeCommit;
        message.warning({
          content: `No commit found with base_commit="${gitBaseCommit?.substring(0, 8)}..." and merge_commit="${mergeCommit?.substring(0, 8)}...". Please verify the commit hashes.`,
          duration: 8
        });
      } else if (errorMsg.includes('does not match')) {
        // Show detailed mismatch information
        if (errorData.expected && errorData.provided) {
          message.warning({
            content: `${errorMessage}. Expected: ${errorData.expected.substring(0, 8)}..., Provided: ${errorData.provided.substring(0, 8)}...`,
            duration: 8
          });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (taskId) => {
    setApproveLoading(prev => ({ ...prev, [taskId]: true }));
    try {
      await api.patch(`/successful-tasks/${taskId}/approve`);
      message.success('Task approved successfully');
      await fetchTasks();
    } catch (err) {
      console.error('Failed to approve task:', err);
      message.error(err.response?.data?.error || 'Failed to approve task');
    } finally {
      setApproveLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleReject = async (taskId, reason) => {
    setRejectLoading(prev => ({ ...prev, [taskId]: true }));
    try {
      await api.patch(`/successful-tasks/${taskId}/reject`, { rejectionReason: reason });
      message.success('Task rejected');
      await fetchTasks();
    } catch (err) {
      console.error('Failed to reject task:', err);
      message.error(err.response?.data?.error || 'Failed to reject task');
    } finally {
      setRejectLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleEdit = (task) => {
    // Open edit modal with task data
    setEditingTaskId(task.id);
    setSubmitModalVisible(true);
    submitForm.setFieldsValue({
      taskName: task.taskName,
      taskDescription: task.taskDescription,
      gitBaseCommit: task.gitBaseCommit,
      mergeCommit: task.mergeCommit,
      prNumber: task.prNumber,
      hints: task.hints,
      aiSuccessRate: task.aiSuccessRate,
      payoutAmount: task.payoutAmount
    });
    setBasePatchValue(task.basePatch || '');
    setGoldenPatchValue(task.goldenPatch || '');
    setTestPatchValue(task.testPatch || '');
  };

  const handleDelete = async (taskId) => {
    try {
      await api.delete(`/successful-tasks/${taskId}`);
      message.success('Task deleted successfully');
      await fetchTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
      message.error(err.response?.data?.error || 'Failed to delete task');
    }
  };

  const handleViewDetails = async (taskId) => {
    try {
      const response = await api.get(`/successful-tasks/${taskId}`);
      setSelectedTask(response.data.task);
      setDetailModalVisible(true);
    } catch (err) {
      console.error('Failed to fetch task details:', err);
      message.error(err.response?.data?.error || 'Failed to fetch task details');
    }
  };

  const handleCopy = async (text, label, e) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      await navigator.clipboard.writeText(text);
      message.success(`${label} copied to clipboard`);
    } catch (error) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        message.success(`${label} copied to clipboard`);
      } catch (err) {
        message.error('Failed to copy to clipboard');
      }
    }
  };


  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleResetFilters = () => {
    setFilters({
      status: isAdmin ? undefined : 'approved',
      repo_id: undefined,
      min_ai_success_rate: undefined
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // Get unique repos for filter
  const repos = useMemo(() => {
    const unique = new Set();
    tasks.forEach(t => {
      if (t.commit?.repo?.fullName) unique.add({ id: t.commit.repo.id, name: t.commit.repo.fullName });
    });
    return Array.from(unique).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const columns = [
    {
      title: 'Task Name',
      dataIndex: 'taskName',
      key: 'taskName',
      width: 250,
      fixed: 'left',
      render: (text, record) => (
        <Text style={{ color: 'rgb(241, 245, 249)', fontSize: 13, fontWeight: 500 }}>
          {text}
        </Text>
      )
    },
    {
      title: 'Repository',
      dataIndex: ['commit', 'repo', 'fullName'],
      key: 'repo',
      width: 200,
      render: (text, record) => {
        const repoName = text || '-';
        const repoUrl = repoName !== '-' ? `https://github.com/${repoName}` : null;
        return (
          <Space>
            <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12 }}>{repoName}</Text>
            {repoUrl && (
              <Tooltip title={`Open ${repoName} on GitHub`}>
                <Button
                  type="text"
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(repoUrl, '_blank');
                  }}
                  style={{ padding: '0 4px', height: 'auto' }}
                />
              </Tooltip>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Base Commit',
      dataIndex: ['commit', 'baseCommit'],
      key: 'baseCommit',
      width: 120,
      render: (text) => {
        if (!text) return <Text type="secondary">-</Text>;
        return (
          <Space>
            <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12, fontFamily: 'monospace' }}>
              {text?.substring(0, 8)}
            </Text>
            <Tooltip title="Copy full hash">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={(e) => handleCopy(text, 'Base commit', e)}
                style={{ padding: '0 4px', height: 'auto' }}
              />
            </Tooltip>
          </Space>
        );
      }
    },
    {
      title: 'Merged Commit',
      dataIndex: ['commit', 'mergedCommit'],
      key: 'mergedCommit',
      width: 120,
      render: (text) => {
        if (!text) return <Text type="secondary">-</Text>;
        return (
          <Space>
            <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12, fontFamily: 'monospace' }}>
              {text?.substring(0, 8)}
            </Text>
            <Tooltip title="Copy full hash">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={(e) => handleCopy(text, 'Merged commit', e)}
                style={{ padding: '0 4px', height: 'auto' }}
              />
            </Tooltip>
          </Space>
        );
      }
    },
    {
      title: 'PR #',
      dataIndex: 'prNumber',
      key: 'prNumber',
      width: 100,
      render: (prNumber, record) => {
        if (!prNumber) return <Text type="secondary">-</Text>;
        const repoName = record.commit?.repo?.fullName;
        const prUrl = repoName ? `https://github.com/${repoName}/pull/${prNumber}` : null;
        return (
          <Space>
            <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12 }}>
              #{prNumber}
            </Text>
            {prUrl && (
              <Tooltip title={`Open PR #${prNumber} on GitHub`}>
                <Button
                  type="text"
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(prUrl, '_blank');
                  }}
                  style={{ padding: '0 4px', height: 'auto' }}
                />
              </Tooltip>
            )}
          </Space>
        );
      }
    },
    {
      title: 'AI Success Rate',
      dataIndex: 'aiSuccessRate',
      key: 'aiSuccessRate',
      width: 130,
      render: (rate) => (
        <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12 }}>
          {rate ? `${rate}%` : '-'}
        </Text>
      )
    },
    {
      title: 'Payout',
      dataIndex: 'payoutAmount',
      key: 'payoutAmount',
      width: 100,
      render: (amount) => (
        <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: 500 }}>
          {amount ? `$${amount}` : '-'}
        </Text>
      )
    },
    {
      title: 'Submitted By',
      dataIndex: ['submitter', 'username'],
      key: 'submitter',
      width: 150,
      render: (text) => (
        <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12 }}>
          {text || '-'}
        </Text>
      )
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => (
        <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12 }}>
          {date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Text>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => {
        const canEdit = record.userId === user?.id; // Can edit own tasks
        const canDelete = record.userId === user?.id || isAdmin; // Members can delete own tasks, admins can delete any
        
        return (
          <Space>
            <Tooltip title="View Details">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetails(record.id)}
                style={{ padding: '0 4px', height: 'auto' }}
              />
            </Tooltip>
            {canEdit && (
              <Tooltip title="Edit">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(record)}
                  style={{ padding: '0 4px', height: 'auto' }}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Delete Task"
                description="Are you sure you want to delete this task? This action cannot be undone."
                onConfirm={() => handleDelete(record.id)}
                okText="Yes"
                cancelText="No"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Delete">
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    style={{ padding: '0 4px', height: 'auto', color: '#ef4444' }}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 12
        }}
        bodyStyle={{ padding: '24px' }}
      >
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={3} style={{ color: 'rgb(241, 245, 249)', margin: 0 }}>
              Successful Tasks
            </Title>
          </Col>
          <Col>
            <Space>
              <Tooltip title="Show/Hide Filters">
                <Button
                  icon={<FilterOutlined />}
                  onClick={() => setShowFilters(!showFilters)}
                  style={{
                    background: showFilters ? '#16a34a' : '#334155',
                    borderColor: showFilters ? '#16a34a' : '#334155',
                    color: 'rgb(241, 245, 249)',
                    height: 40
                  }}
                >
                  {showFilters ? 'Hide Filters' : 'Filters'}
                </Button>
              </Tooltip>
              <Tooltip title="Submit New Task">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setSubmitModalVisible(true)}
                  style={{ height: 40 }}
                >
                  Submit Task
                </Button>
              </Tooltip>
              <Tooltip title="Refresh">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchTasks}
                  loading={loading}
                  style={{
                    background: '#334155',
                    borderColor: '#334155',
                    color: 'rgb(241, 245, 249)',
                    height: 40,
                    width: 40
                  }}
                />
              </Tooltip>
            </Space>
          </Col>
        </Row>

        {/* Filters */}
        {showFilters && (
          <Card
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 12,
              marginBottom: 24
            }}
            bodyStyle={{ padding: '16px' }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Min AI Success Rate
                </Text>
                <InputNumber
                  placeholder="Min success rate"
                  style={{ width: '100%' }}
                  size="large"
                  min={0}
                  max={100}
                  value={filters.min_ai_success_rate}
                  onChange={(value) => handleFilterChange('min_ai_success_rate', value)}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Button
                  onClick={handleResetFilters}
                  style={{
                    marginTop: 24,
                    background: '#334155',
                    borderColor: '#334155',
                    color: 'rgb(241, 245, 249)',
                    height: 40
                  }}
                >
                  Reset Filters
                </Button>
              </Col>
            </Row>
          </Card>
        )}

        {/* Table */}
        {loading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : (
          <Table
            columns={columns}
            dataSource={tasks}
            rowKey="id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} tasks`,
              onChange: (page, pageSize) => {
                setPagination(prev => ({ ...prev, current: page, pageSize }));
              },
              pageSizeOptions: ['10', '20', '50', '100']
            }}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>

      {/* Submit Task Modal */}
      <Modal
        title={editingTaskId ? 'Edit Task' : 'Submit Successful Task'}
        open={submitModalVisible}
        onCancel={() => {
          setSubmitModalVisible(false);
          setEditingTaskId(null);
          submitForm.resetFields();
          setBasePatchValue('');
          setGoldenPatchValue('');
          setTestPatchValue('');
        }}
        footer={null}
        width={1000}
      >
        <Form
          form={submitForm}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="taskName"
            label="Task Name"
            rules={[{ required: true, message: 'Please enter task name' }]}
          >
            <Input size="large" placeholder="Task name" />
          </Form.Item>

          <Form.Item
            name="taskDescription"
            label={
              <div>
                <Text style={{ color: 'rgb(241, 245, 249)' }}>Task Description</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Markdown supported. Use # for headers, ``` for code blocks, etc.
                </Text>
              </div>
            }
            rules={[{ required: true, message: 'Please enter task description' }]}
          >
            <TextArea rows={6} size="large" placeholder="Detailed task description (Markdown supported)" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="gitBaseCommit"
                label="Git Base Commit"
                rules={[{ required: true, message: 'Please enter base commit hash' }]}
              >
                <Input 
                  size="large" 
                  placeholder="Base commit hash"
                  onChange={async (e) => {
                    const hash = e.target.value.trim();
                    if (hash && /^[a-f0-9]{7,40}$/i.test(hash)) {
                      // Search for commit by this hash
                      try {
                        const response = await api.get('/commits', {
                          params: {
                            limit: 1,
                            offset: 0,
                            search: hash
                          }
                        });
                        const commits = response.data.commits || [];
                        const matchingCommit = commits.find(c => 
                          c.baseCommit === hash || 
                          c.mergedCommit === hash || 
                          c.sourceSha === hash
                        );
                        if (matchingCommit) {
                          // If mergeCommit is empty, auto-fill it
                          const currentMergeCommit = submitForm.getFieldValue('mergeCommit');
                          if (!currentMergeCommit && matchingCommit.mergedCommit) {
                            submitForm.setFieldsValue({ mergeCommit: matchingCommit.mergedCommit });
                          }
                        }
                      } catch (err) {
                        console.error('Failed to search commit by hash:', err);
                      }
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="mergeCommit"
                label="Merge Commit"
                rules={[{ required: true, message: 'Please enter merge commit hash' }]}
              >
                <Input 
                  size="large" 
                  placeholder="Merge commit hash"
                  onChange={async (e) => {
                    const hash = e.target.value.trim();
                    if (hash && /^[a-f0-9]{7,40}$/i.test(hash)) {
                      // Search for commit by this hash
                      try {
                        const response = await api.get('/commits', {
                          params: {
                            limit: 1,
                            offset: 0,
                            search: hash
                          }
                        });
                        const commits = response.data.commits || [];
                        const matchingCommit = commits.find(c => 
                          c.baseCommit === hash || 
                          c.mergedCommit === hash || 
                          c.sourceSha === hash
                        );
                        if (matchingCommit) {
                          // If gitBaseCommit is empty, auto-fill it
                          const currentBaseCommit = submitForm.getFieldValue('gitBaseCommit');
                          if (!currentBaseCommit && matchingCommit.baseCommit) {
                            submitForm.setFieldsValue({ gitBaseCommit: matchingCommit.baseCommit });
                          }
                        }
                      } catch (err) {
                        console.error('Failed to search commit by hash:', err);
                      }
                    }
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="prNumber"
                label="PR Number (Optional)"
              >
                <InputNumber style={{ width: '100%' }} size="large" placeholder="PR number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="payoutAmount"
                label="Payout Amount (Optional)"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  size="large"
                  min={0}
                  step={0.01}
                  placeholder="1200.00"
                  prefix="$"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="aiSuccessRate"
                label="AI Success Rate % (Optional)"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  size="large"
                  min={0}
                  max={100}
                  placeholder="25.0"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="hints"
            label="Hints (Optional)"
          >
            <TextArea rows={3} size="large" placeholder="Optional hints that helped achieve success" />
          </Form.Item>

          <Form.Item
            label="Base Patch (Optional)"
            validateStatus={basePatchValue ? '' : undefined}
          >
            <div style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
              <Editor
                height="200px"
                defaultLanguage="diff"
                theme="vs-dark"
                value={basePatchValue}
                onChange={(val) => setBasePatchValue(val || '')}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  automaticLayout: true
                }}
              />
            </div>
          </Form.Item>

          <Form.Item
            label="Golden Patch (Required)"
            required
            validateStatus={goldenPatchValue ? '' : 'error'}
            help={!goldenPatchValue ? 'Please enter golden patch' : ''}
          >
            <div style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
              <Editor
                height="250px"
                defaultLanguage="diff"
                theme="vs-dark"
                value={goldenPatchValue}
                onChange={(val) => setGoldenPatchValue(val || '')}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  automaticLayout: true
                }}
              />
            </div>
          </Form.Item>

          <Form.Item
            label="Test Patch (Required)"
            required
            validateStatus={testPatchValue ? '' : 'error'}
            help={!testPatchValue ? 'Please enter test patch' : ''}
          >
            <div style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
              <Editor
                height="250px"
                defaultLanguage="diff"
                theme="vs-dark"
                value={testPatchValue}
                onChange={(val) => setTestPatchValue(val || '')}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  automaticLayout: true
                }}
              />
            </div>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={submitting} 
                size="large"
                disabled={!goldenPatchValue || !testPatchValue}
              >
                Submit
              </Button>
              <Button onClick={() => {
                setSubmitModalVisible(false);
                submitForm.resetFields();
                setBasePatchValue('');
                setGoldenPatchValue('');
                setTestPatchValue('');
              }} size="large">
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Task Details Modal */}
      <Modal
        title="Task Details"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedTask(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setDetailModalVisible(false);
            setSelectedTask(null);
          }}>
            Close
          </Button>
        ]}
        width={1000}
      >
        {selectedTask && (
          <div>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Task Name" span={2}>
                {selectedTask.taskName}
              </Descriptions.Item>
              <Descriptions.Item label="Submitted By">
                {selectedTask.submitter?.username || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Repository" span={2}>
                {selectedTask.commit?.repo?.fullName || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Base Commit">
                {selectedTask.gitBaseCommit}
              </Descriptions.Item>
              <Descriptions.Item label="Merge Commit">
                {selectedTask.mergeCommit}
              </Descriptions.Item>
              <Descriptions.Item label="PR Number">
                {selectedTask.prNumber ? `#${selectedTask.prNumber}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Payout Amount">
                {selectedTask.payoutAmount ? `$${selectedTask.payoutAmount}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="AI Success Rate">
                {selectedTask.aiSuccessRate ? `${selectedTask.aiSuccessRate}%` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Created At">
                {selectedTask.createdAt ? dayjs(selectedTask.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              {selectedTask.approvedAt && (
                <Descriptions.Item label="Approved At">
                  {dayjs(selectedTask.approvedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
              {selectedTask.rejectionReason && (
                <Descriptions.Item label="Rejection Reason" span={2}>
                  <Text type="danger">{selectedTask.rejectionReason}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider />

            <Tabs defaultActiveKey="description">
              <TabPane tab="Description" key="description">
                <div style={{
                  background: '#0f172a',
                  padding: '16px',
                  borderRadius: '8px',
                  color: 'rgb(148, 163, 184)',
                  minHeight: '200px'
                }}>
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p style={{ marginBottom: '12px', lineHeight: '1.6' }}>{children}</p>,
                      h1: ({ children }) => <h1 style={{ color: 'rgb(241, 245, 249)', marginBottom: '16px', fontSize: '24px' }}>{children}</h1>,
                      h2: ({ children }) => <h2 style={{ color: 'rgb(241, 245, 249)', marginBottom: '12px', fontSize: '20px' }}>{children}</h2>,
                      h3: ({ children }) => <h3 style={{ color: 'rgb(241, 245, 249)', marginBottom: '8px', fontSize: '16px' }}>{children}</h3>,
                      code: ({ children, className }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code style={{
                            background: '#1e293b',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            color: '#16a34a'
                          }}>{children}</code>
                        ) : (
                          <pre style={{
                            background: '#1e293b',
                            padding: '12px',
                            borderRadius: '6px',
                            overflow: 'auto',
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            marginBottom: '12px'
                          }}><code>{children}</code></pre>
                        );
                      },
                      ul: ({ children }) => <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ marginLeft: '20px', marginBottom: '12px' }}>{children}</ol>,
                      li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                      blockquote: ({ children }) => (
                        <blockquote style={{
                          borderLeft: '3px solid #16a34a',
                          paddingLeft: '12px',
                          marginLeft: 0,
                          marginBottom: '12px',
                          color: 'rgb(148, 163, 184)'
                        }}>{children}</blockquote>
                      ),
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a' }}>
                          {children}
                        </a>
                      )
                    }}
                  >
                    {selectedTask.taskDescription}
                  </ReactMarkdown>
                </div>
              </TabPane>
              {selectedTask.hints && (
                <TabPane tab="Hints" key="hints">
                  <Text style={{ whiteSpace: 'pre-wrap', color: 'rgb(148, 163, 184)' }}>
                    {selectedTask.hints}
                  </Text>
                </TabPane>
              )}
              {selectedTask.basePatch && (
                <TabPane tab="Base Patch" key="basePatch">
                  <Editor
                    height="500px"
                    defaultLanguage="diff"
                    theme="vs-dark"
                    value={selectedTask.basePatch}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 12,
                      wordWrap: 'on',
                      lineNumbers: 'on',
                      automaticLayout: true
                    }}
                  />
                </TabPane>
              )}
              <TabPane tab="Golden Patch" key="goldenPatch">
                <Editor
                  height="500px"
                  defaultLanguage="diff"
                  theme="vs-dark"
                  value={selectedTask.goldenPatch}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    automaticLayout: true
                  }}
                />
              </TabPane>
              <TabPane tab="Test Patch" key="testPatch">
                <Editor
                  height="500px"
                  defaultLanguage="diff"
                  theme="vs-dark"
                  value={selectedTask.testPatch}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    automaticLayout: true
                  }}
                />
              </TabPane>
            </Tabs>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SuccessfulTasks;
