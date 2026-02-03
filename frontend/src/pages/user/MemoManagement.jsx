import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Space,
  Tag,
  Select,
  InputNumber,
  message,
  Typography,
  Row,
  Col,
  Tooltip,
  Popconfirm,
  Modal,
  Form,
} from 'antd';
import {
  ReloadOutlined,
  CopyOutlined,
  LinkOutlined,
  FilterOutlined,
  DeleteOutlined,
  EditOutlined,
  BookOutlined,
  ClearOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import api from '../../config/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const MemoManagement = () => {
  const [memoCommits, setMemoCommits] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentEditItem, setCurrentEditItem] = useState(null);
  const [editForm] = Form.useForm();
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
  });

  const [filters, setFilters] = useState({
    repo_id: null,
    priority_min: null,
    priority_max: null,
  });
  const [memoLimit, setMemoLimit] = useState(null);
  const [repoWinRates, setRepoWinRates] = useState([]);
  const [priorityUpdating, setPriorityUpdating] = useState({});

  useEffect(() => {
    fetchMemoCommits();
    fetchAccounts();
    fetchRepos();
  }, []);

  useEffect(() => {
    const fetchWinRates = async () => {
      try {
        const res = await api.get('/stats/repo-win-rates');
        setRepoWinRates(res.data.repoWinRates || []);
      } catch (err) {
        console.error('Failed to fetch repo win rates:', err);
      }
    };
    fetchWinRates();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounts', { params: { limit: 1000 } });
      setAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  };

  const fetchRepos = async () => {
    try {
      const response = await api.get('/repos', { params: { limit: 1000 } });
      setRepos(response.data.repos || []);
    } catch (error) {
      console.error('Failed to fetch repos:', error);
    }
  };

  const fetchMemoCommits = async () => {
    setLoading(true);
    try {
      const response = await api.get('/memo', { params: { limit: 10000 } });
      setMemoCommits(response.data.memoCommits || []);
      if (response.data.memoLimit != null) setMemoLimit(response.data.memoLimit);
    } catch (error) {
      message.error('Failed to fetch memo commits');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (memo) => {
    try {
      await api.delete(`/memo/${memo.id}`);
      message.success('Commit removed from memo');
      fetchMemoCommits();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to remove from memo');
    }
  };

  const handleApplySuggestedPriority = async (memo) => {
    const suggested = memo.suggestedPriority;
    if (suggested == null) return;
    setPriorityUpdating(prev => ({ ...prev, [memo.id]: true }));
    try {
      await api.patch(`/memo/${memo.id}`, { priority: suggested });
      message.success('Priority updated to suggested value');
      fetchMemoCommits();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to update priority');
    } finally {
      setPriorityUpdating(prev => ({ ...prev, [memo.id]: false }));
    }
  };

  const handleEdit = (memo) => {
    setCurrentEditItem(memo);
    editForm.setFieldsValue({
      priority: memo.priority || 0,
      notes: memo.notes || '',
    });
    setEditModalVisible(true);
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      await api.patch(`/memo/${currentEditItem.id}`, values);
      message.success('Memo updated successfully');
      setEditModalVisible(false);
      setCurrentEditItem(null);
      editForm.resetFields();
      fetchMemoCommits();
    } catch (error) {
      if (error.errorFields) {
        return; // Form validation errors
      }
      message.error(error.response?.data?.error || 'Failed to update memo');
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
      // Fallback for older browsers
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
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, current: 1 });
  };

  const handleClearFilters = () => {
    setFilters({
      repo_ids: [],
      priority_min: null,
      priority_max: null,
    });
    setPagination({ ...pagination, current: 1 });
  };

  // Filter memo commits
  const filteredMemoCommits = useMemo(() => {
    let filtered = memoCommits;

    if (filters.repo_id) {
      filtered = filtered.filter(m => m.repo_id === filters.repo_id);
    }

    if (filters.priority_min !== undefined && filters.priority_min !== null) {
      filtered = filtered.filter(m => (m.priority || 0) >= filters.priority_min);
    }

    if (filters.priority_max !== undefined && filters.priority_max !== null) {
      filtered = filtered.filter(m => (m.priority || 0) <= filters.priority_max);
    }

    return filtered;
  }, [memoCommits, filters]);

  // Paginate filtered results
  const paginatedData = useMemo(() => {
    const start = (pagination.current - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredMemoCommits.slice(start, end);
  }, [filteredMemoCommits, pagination]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.repo_ids && filters.repo_ids.length > 0) count++;
    if (filters.priority_min !== null && filters.priority_min !== undefined) count++;
    if (filters.priority_max !== null && filters.priority_max !== undefined) count++;
    return count;
  }, [filters]);

  const repoWinRateMap = useMemo(
    () => new Map((repoWinRates || []).map(r => [r.repoId, r])),
    [repoWinRates]
  );

  const columns = [
    {
      title: (
        <Tooltip title="Your priority (0–100). Suggested value is auto-calculated from scores and pattern. Click the lightning button to apply it.">
          <span style={{ cursor: 'help' }}>Priority</span>
        </Tooltip>
      ),
      dataIndex: 'priority',
      key: 'priority',
      width: 160,
      fixed: 'left',
      align: 'center',
      sorter: (a, b) => (a.priority || 0) - (b.priority || 0),
      render: (priority, record) => {
        const current = priority ?? 0;
        const suggested = record.suggestedPriority;
        const isApplying = priorityUpdating[record.id];
        const matchesSuggested = suggested != null && suggested === current;
        return (
          <Space size="small" direction="vertical" align="center" style={{ margin: 0 }}>
            <Tag color={current >= 50 ? 'red' : current >= 20 ? 'orange' : 'default'}>
              {current}
            </Tag>
            {suggested != null && (
              matchesSuggested ? (
                <Tooltip title="Matches auto-suggested value">
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    <CheckCircleOutlined style={{ marginRight: 4, color: 'var(--ant-color-success)' }} />
                    Auto
                  </Text>
                </Tooltip>
              ) : (
                <Tooltip title={`Apply suggested priority (${suggested})`}>
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    icon={<ThunderboltOutlined />}
                    loading={isApplying}
                    onClick={() => handleApplySuggestedPriority(record)}
                    style={{ minWidth: 32 }}
                  >
                    {suggested}
                  </Button>
                </Tooltip>
              )
            )}
          </Space>
        );
      },
    },
    {
      title: 'Repo',
      dataIndex: 'repo_name',
      key: 'repo_name',
      width: 220,
      fixed: 'left',
      sorter: (a, b) => (a.repo_name || '').localeCompare(b.repo_name || ''),
      render: (text, record) => {
        const repoName = text || '-';
        const repoUrl = repoName !== '-' ? `https://github.com/${repoName}` : null;
        const winInfo = record.repo_id ? repoWinRateMap.get(record.repo_id) : null;
        return (
          <Space direction="vertical" size={0}>
            <Space>
              <Text style={{ color: 'rgb(241, 245, 249)', fontSize: 13 }}>{repoName}</Text>
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
                    style={{
                      color: 'rgb(148, 163, 184)',
                      padding: '0 4px',
                      height: 'auto',
                    }}
                  />
                </Tooltip>
              )}
            </Space>
            {winInfo != null && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                This repo: {winInfo.winRate}% team win rate
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Base Commit',
      dataIndex: 'base_commit',
      key: 'base_commit',
      width: 180,
      fixed: 'left',
      sorter: (a, b) => (a.base_commit || '').localeCompare(b.base_commit || ''),
      render: (text, record) => {
        if (!text) return <Text type="secondary">-</Text>;
        const repoName = record.repo_name;
        const commitUrl = repoName ? `https://github.com/${repoName}/commit/${text}` : null;
        return (
          <Space size="small">
            <code style={{ fontSize: 11, color: 'rgb(148, 163, 184)' }}>{text?.substring(0, 8)}</code>
            <Tooltip title="Copy full hash">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={(e) => handleCopy(text, 'Base commit', e)}
                style={{ padding: '0 4px', height: 'auto' }}
              />
            </Tooltip>
            {commitUrl && (
              <Tooltip title="Open on GitHub">
                <Button
                  type="text"
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(commitUrl, '_blank');
                  }}
                  style={{ padding: '0 4px', height: 'auto' }}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Merged Commit',
      dataIndex: 'merged_commit',
      key: 'merged_commit',
      width: 180,
      fixed: 'left',
      sorter: (a, b) => (a.merged_commit || '').localeCompare(b.merged_commit || ''),
      render: (text, record) => {
        if (!text) return <Text type="secondary">-</Text>;
        const repoName = record.repo_name;
        const commitUrl = repoName ? `https://github.com/${repoName}/commit/${text}` : null;
        return (
          <Space size="small">
            <code style={{ fontSize: 11, color: 'rgb(148, 163, 184)' }}>{text?.substring(0, 8)}</code>
            <Tooltip title="Copy full hash">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={(e) => handleCopy(text, 'Merged commit', e)}
                style={{ padding: '0 4px', height: 'auto' }}
              />
            </Tooltip>
            {commitUrl && (
              <Tooltip title="Open on GitHub">
                <Button
                  type="text"
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(commitUrl, '_blank');
                  }}
                  style={{ padding: '0 4px', height: 'auto' }}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'PR #',
      dataIndex: 'pr_number',
      key: 'pr_number',
      width: 120,
      fixed: 'left',
      sorter: (a, b) => {
        if (!a.pr_number && !b.pr_number) return 0;
        if (!a.pr_number) return 1;
        if (!b.pr_number) return -1;
        return a.pr_number - b.pr_number;
      },
      render: (prNumber, record) => {
        if (!prNumber) return <Text type="secondary">-</Text>;
        const repoName = record.repo_name;
        const prUrl = repoName ? `https://github.com/${repoName}/pull/${prNumber}` : null;
        return (
          <Space size="small">
            <span>{prNumber}</span>
            {prUrl && (
              <Tooltip title="Open PR on GitHub">
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
      },
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      width: 250,
      ellipsis: {
        showTitle: false,
      },
      render: (notes) => (
        <Tooltip title={notes || 'No notes'}>
          <Text style={{ color: notes ? 'rgb(148, 163, 184)' : 'rgb(100, 116, 139)', fontSize: 12 }}>
            {notes || '-'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      sorter: (a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(a.createdAt) - new Date(b.createdAt);
      },
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit Memo">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              style={{
                color: '#1890ff',
                padding: '4px 8px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(24, 144, 255, 0.1)';
                e.currentTarget.style.color = '#40a9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#1890ff';
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Remove from Memo"
            description="Are you sure you want to remove this commit from memo?"
            onConfirm={() => handleDelete(record)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Remove from Memo">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                danger
                style={{
                  padding: '4px 8px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 77, 79, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
        }}
      >
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={2} style={{ color: 'rgb(241, 245, 249)', margin: 0 }}>
              Memo Management
            </Title>
            {memoLimit != null && (
              <Text type="secondary" style={{ fontSize: 13 }}>
                Limit: {memoCommits.length} / {memoLimit}
              </Text>
            )}
          </Col>
          <Col>
            <Space>
              <Button
                icon={<FilterOutlined />}
                onClick={() => setShowFilters(!showFilters)}
                type={showFilters ? 'primary' : 'default'}
              >
                Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              </Button>
              <Button
                icon={<ClearOutlined />}
                onClick={handleClearFilters}
                disabled={activeFiltersCount === 0}
              >
                Clear
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchMemoCommits}
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>

        {showFilters && (
          <Card
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              marginBottom: 16,
            }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Repository
                </Text>
                <Select
                  size="large"
                  placeholder="All Repositories"
                  style={{ width: '100%' }}
                  allowClear
                  value={filters.repo_id}
                  onChange={(value) => handleFilterChange('repo_id', value)}
                >
                  {repos.map(repo => (
                    <Option key={repo.id} value={repo.id}>{repo.fullName}</Option>
                  ))}
                </Select>
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Priority Range
                </Text>
                <Input.Group compact>
                  <InputNumber
                    size="large"
                    placeholder="Min"
                    style={{ width: '50%' }}
                    min={0}
                    max={100}
                    value={filters.priority_min}
                    onChange={(value) => handleFilterChange('priority_min', value)}
                  />
                  <InputNumber
                    size="large"
                    placeholder="Max"
                    style={{ width: '50%' }}
                    min={0}
                    max={100}
                    value={filters.priority_max}
                    onChange={(value) => handleFilterChange('priority_max', value)}
                  />
                </Input.Group>
              </Col>
            </Row>
          </Card>
        )}

        <Table
          columns={columns}
          dataSource={paginatedData}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            total: filteredMemoCommits.length,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} memo commits`,
            pageSizeOptions: ['10', '20', '50', '100', '200'],
          }}
          onChange={(newPagination) => setPagination(newPagination)}
          scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
          sticky={{
            offsetHeader: 0
          }}
          style={{
            background: '#1e293b',
          }}
        />
      </Card>

      <Modal
        title="Edit Memo"
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => {
          setEditModalVisible(false);
          setCurrentEditItem(null);
          editForm.resetFields();
        }}
        okText="Update"
        cancelText="Cancel"
      >
        <Form
          form={editForm}
          layout="vertical"
        >
          <Form.Item
            label="Priority"
            name="priority"
            rules={[{ type: 'number', min: 0, max: 100 }]}
            extra={
              currentEditItem?.suggestedPriority != null && (
                <Space size="small" style={{ marginTop: 4 }}>
                  <Text type="secondary">Suggested (auto): {currentEditItem.suggestedPriority}</Text>
                  <Button
                    type="link"
                    size="small"
                    icon={<ThunderboltOutlined />}
                    onClick={() => editForm.setFieldValue('priority', currentEditItem.suggestedPriority)}
                  >
                    Use suggested
                  </Button>
                </Space>
              )
            }
          >
            <InputNumber
              size="large"
              style={{ width: '100%' }}
              min={0}
              max={100}
              placeholder="Priority (0-100)"
            />
          </Form.Item>

          <Form.Item
            label="Notes"
            name="notes"
          >
            <TextArea
              size="large"
              rows={4}
              placeholder="Add notes about this commit..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MemoManagement;
