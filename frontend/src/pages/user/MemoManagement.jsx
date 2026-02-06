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
  ClockCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import api from '../../config/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

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
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkReserveModalVisible, setBulkReserveModalVisible] = useState(false);
  const [bulkReserveAccountId, setBulkReserveAccountId] = useState(null);
  const [bulkReserveLoading, setBulkReserveLoading] = useState(false);
  const [singleReserveRecord, setSingleReserveRecord] = useState(null);
  const [singleReserveModalVisible, setSingleReserveModalVisible] = useState(false);
  const [singleReserveAccountId, setSingleReserveAccountId] = useState(null);
  const [singleReserveLoading, setSingleReserveLoading] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

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

  const handleBulkReserve = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Select at least one memo commit');
      return;
    }
    setBulkReserveAccountId(accounts.find(a => a.isActive)?.id ?? null);
    setBulkReserveModalVisible(true);
  };

  const handleBulkReserveConfirm = async () => {
    if (!bulkReserveAccountId) {
      message.error('Select an account');
      return;
    }
    const commitIds = selectedRowKeys.map(key => {
      const row = memoCommits.find(m => m.id === key);
      return row?.commitId ?? row?.commit_id;
    }).filter(Boolean);
    if (commitIds.length === 0) {
      message.error('No valid commits selected');
      return;
    }
    setBulkReserveLoading(true);
    try {
      const res = await api.post('/reservations/bulk', {
        account_id: bulkReserveAccountId,
        commit_ids: commitIds,
      });
      const { reserved, failed, results } = res.data;
      message.success(res.data.message || `Reserved ${reserved} of ${commitIds.length}`);
      setBulkReserveModalVisible(false);
      setSelectedRowKeys([]);
      fetchMemoCommits();
      if (failed > 0 && results?.failed?.length) {
        const firstFew = results.failed.slice(0, 3).map(f => f.error).join('; ');
        message.warning(`${failed} failed: ${firstFew}${results.failed.length > 3 ? '...' : ''}`);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Bulk reserve failed');
    } finally {
      setBulkReserveLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Select at least one memo item');
      return;
    }
    setBulkDeleteLoading(true);
    try {
      const res = await api.delete('/memo/bulk', { data: { ids: selectedRowKeys } });
      message.success(res.data.message || `Removed ${res.data.deleted} from memo`);
      setSelectedRowKeys([]);
      fetchMemoCommits();
    } catch (err) {
      message.error(err.response?.data?.error || 'Bulk delete failed');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleSingleReserve = (record) => {
    setSingleReserveRecord(record);
    setSingleReserveAccountId(accounts.find(a => a.isActive)?.id ?? null);
    setSingleReserveModalVisible(true);
  };

  const handleSingleReserveConfirm = async () => {
    if (!singleReserveRecord || !singleReserveAccountId) {
      message.error('Select an account');
      return;
    }
    const commitId = singleReserveRecord.commitId ?? singleReserveRecord.commit_id;
    if (!commitId) {
      message.error('Invalid commit');
      return;
    }
    setSingleReserveLoading(true);
    try {
      await api.post('/reservations', { commit_id: commitId, account_id: singleReserveAccountId });
      message.success('Reservation created');
      setSingleReserveModalVisible(false);
      setSingleReserveRecord(null);
      fetchMemoCommits();
    } catch (err) {
      message.error(err.response?.data?.error || 'Reserve failed');
    } finally {
      setSingleReserveLoading(false);
    }
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

  const handleExportJSON = () => {
    // Create a map of habitat_repo_id to cutoff_date
    const repoCutoffMap = new Map();
    repos.forEach(repo => {
      if (repo.cutoffDate && repo.habitatRepoId) {
        repoCutoffMap.set(repo.habitatRepoId, dayjs(repo.cutoffDate).startOf('day'));
      }
    });

    // Filter commits above each repo's cutoff date
    const exportData = memoCommits
      .filter(memo => {
        // If repo has no habitat_repo_id or no cutoff date, include the commit
        if (!memo.habitat_repo_id || !repoCutoffMap.has(memo.habitat_repo_id)) {
          return true;
        }

        // If commit has no commit_date, exclude it
        if (!memo.commit_date) {
          return false;
        }

        // Include if commit_date is after cutoff_date (above means strictly greater)
        const cutoffDate = repoCutoffMap.get(memo.habitat_repo_id);
        const commitDate = dayjs(memo.commit_date).startOf('day');
        return commitDate.isAfter(cutoffDate);
      })
      .map(memo => ({
        habitat_repo_id: memo.habitat_repo_id,
        repo_name: memo.repo_name,
        base_commit: memo.base_commit,
        merged_commit: memo.merged_commit,
        status: memo.displayStatus || 'available',
      }));

    // Create JSON blob and download
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `memo-export-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    message.success(`Exported ${exportData.length} commits to JSON`);
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

  const getStatusColor = (status) => {
    const map = {
      available: 'success',
      reserved: 'processing',
      already_reserved: 'error',
      unavailable: 'default',
      too_easy: 'warning',
      paid_out: 'purple',
      pending_admin_approval: 'blue',
      failed: 'error',
      error: 'error',
      in_distribution: 'blue',
    };
    return map[status] || 'default';
  };

  const getStatusText = (status) => {
    const map = {
      available: 'Available',
      reserved: 'Reserved',
      already_reserved: 'Already Reserved',
      unavailable: 'Unavailable',
      too_easy: 'Too Easy',
      paid_out: 'Paid Out',
      pending_admin_approval: 'Pending Approval',
      failed: 'Failed',
      error: 'Error',
      in_distribution: 'In Distribution',
    };
    return map[status] || (status || 'Available');
  };

  const columns = [
    {
      title: (
        <Tooltip title="Click the lightning button to apply it.">
          <span style={{ cursor: 'help' }}>Priority</span>
        </Tooltip>
      ),
      dataIndex: 'priority',
      key: 'priority',
      width: 180,
      fixed: 'left',
      align: 'center',
      sorter: (a, b) => (a.priority || 0) - (b.priority || 0),
      render: (priority, record) => {
        const current = priority ?? 0;
        const suggested = record.suggestedPriority;
        const isApplying = priorityUpdating[record.id];
        const matchesSuggested = suggested != null && suggested === current;
        return (
          <Space size="small" direction="vertical" align="center" style={{ margin: 0, display: 'flex', justifyContent: 'center', flexDirection: 'row' }}>
            <Tag color={current >= 50 ? 'red' : current >= 20 ? 'orange' : 'default'}>
              {current}
            </Tag>
            {suggested != null && (
              matchesSuggested ? (
                <Tooltip title="Matches auto-suggested value">
                  <Space size="small">
                    <CheckCircleOutlined style={{ color: 'var(--ant-color-success)' }} />
                  </Space>
                </Tooltip>
              ) : (
                <Tooltip title={`Apply suggested priority (${suggested})`}>
                  <Space size="small">
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
                  </Space>
                </Tooltip>
              )
            )}
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'displayStatus',
      key: 'displayStatus',
      width: 140,
      fixed: 'left',
      sorter: (a, b) => (a.displayStatus || '').localeCompare(b.displayStatus || ''),
      render: (_, record) => {
        const status = record.displayStatus || 'available';
        const expiresAt = record.expiresAt;
        return (
          <Space direction="vertical" size={0}>
            <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
            {expiresAt && (
              <Tooltip title={dayjs(expiresAt).format('YYYY-MM-DD HH:mm')}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {dayjs(expiresAt).fromNow()}
                </Text>
              </Tooltip>
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
      width: 140,
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
          <Tooltip title="Reserve this commit">
            <Button
              type="text"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleSingleReserve(record)}
              style={{ color: '#52c41a', padding: '4px 8px' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(82, 196, 26, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            />
          </Tooltip>
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
            <Space wrap>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleBulkReserve}
                disabled={selectedRowKeys.length === 0}
              >
                Reserve selected ({selectedRowKeys.length})
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleBulkDelete}
                disabled={selectedRowKeys.length === 0}
                loading={bulkDeleteLoading}
              >
                Delete selected ({selectedRowKeys.length})
              </Button>
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
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExportJSON}
              >
                Export JSON
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
          rowSelection={{
            selectedRowKeys: selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
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
          scroll={{
            x: 'max-content',
            y: 'calc(60vh)',
          }}
          sticky={{
            offsetHeader: 0,
          }}
          style={{
            background: '#1e293b',
          }}
        />
      </Card>

      <Modal
        title="Reserve selected commits"
        open={bulkReserveModalVisible}
        onOk={handleBulkReserveConfirm}
        onCancel={() => setBulkReserveModalVisible(false)}
        okText="Reserve"
        confirmLoading={bulkReserveLoading}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Account to use for reservation:</Text>
          <Select
            placeholder="Select account"
            style={{ width: '100%' }}
            value={bulkReserveAccountId}
            onChange={setBulkReserveAccountId}
            options={accounts.filter(a => a.isActive).map(a => ({ value: a.id, label: a.accountName }))}
          />
          <Text type="secondary">{selectedRowKeys.length} commit(s) selected.</Text>
        </Space>
      </Modal>

      <Modal
        title="Reserve this commit"
        open={singleReserveModalVisible}
        onOk={handleSingleReserveConfirm}
        onCancel={() => { setSingleReserveModalVisible(false); setSingleReserveRecord(null); }}
        okText="Reserve"
        confirmLoading={singleReserveLoading}
      >
        {singleReserveRecord && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text><strong>Repo:</strong> {singleReserveRecord.repo_name || '—'}</Text>
            <Text><strong>Base commit:</strong> <code>{(singleReserveRecord.base_commit || '').slice(0, 8)}</code></Text>
            <Text>Account to use:</Text>
            <Select
              placeholder="Select account"
              style={{ width: '100%' }}
              value={singleReserveAccountId}
              onChange={setSingleReserveAccountId}
              options={accounts.filter(a => a.isActive).map(a => ({ value: a.id, label: a.accountName }))}
            />
          </Space>
        )}
      </Modal>

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
                  <Text type="secondary">Suggested: {currentEditItem.suggestedPriority}</Text>
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
