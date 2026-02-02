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
  DatePicker,
  Switch,
  message,
  Typography,
  Row,
  Col,
  Badge,
  Tooltip,
  Collapse,
  Checkbox,
  Modal,
  Popconfirm,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  ClearOutlined,
  StarOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  LinkOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import api from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

const CommitsTable = () => {
  const { isAdmin } = useAuth();
  const [commits, setCommits] = useState([]);
  const [repos, setRepos] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
  });
  const [sortField, setSortField] = useState(() => {
    // Default sort field based on user role
    return isAdmin() ? 'habitate_score' : 'commit_date';
  });
  const [sortOrder, setSortOrder] = useState('DESC');
  const [reserveModalVisible, setReserveModalVisible] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [columnCustomizeVisible, setColumnCustomizeVisible] = useState(false);
  const [myStats, setMyStats] = useState(null); // { reservations: { total, active }, memoCommits: { total } }
  // Commit chain (admin): base commit -> merge commits tree
  const [chainBaseCommit, setChainBaseCommit] = useState('');
  const [chainRepoId, setChainRepoId] = useState(undefined);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainTree, setChainTree] = useState(null);
  const [chainTotalNodes, setChainTotalNodes] = useState(0);
  
  // Column visibility state - load from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('commitsTable_visibleColumns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure required columns are always visible
        parsed.actions = true;
        parsed.status = true;
        return parsed;
      } catch (e) {
        // If parsing fails, use defaults
      }
    }
    // Default: all columns visible
    return {
      id: true,
      repo: true,
      baseCommit: true,
      mergedCommit: true,
      prNumber: true,
      fileChanges: true,
      additions: true,
      deletions: true,
      habitateScore: isAdmin(),
      difficultyScore: isAdmin(),
      suitabilityScore: isAdmin(),
      flags: true,
      status: true,
      actions: true,
      message: true,
    };
  });

  const [filters, setFilters] = useState({
    repo_ids: [],
    min_habitate_score: null,
    max_habitate_score: null,
    min_difficulty_score: null,
    max_difficulty_score: null,
    min_suitability_score: null,
    max_suitability_score: null,
    min_additions: null,
    max_additions: null,
    min_deletions: null,
    max_deletions: null,
    min_file_changes: null,
    max_file_changes: null,
    is_merge: null,
    author: '',
    merged_commit: '',
    base_commit: '',
    pr_number: '',
    message: '',
    date_range: null,
    has_dependency_changes: false, // Default to false (must be false)
    is_unsuitable: null,
    is_behavior_preserving_refactor: null,
    single_file_200plus: false,
    multi_file_300plus: false,
    status: null, // Filter by status: available, reserved, already_reserved, unavailable, too_easy, paid_out, etc.
  });

  useEffect(() => {
    fetchRepos();
    fetchAccounts();
  }, []);

  const fetchMyStats = async () => {
    try {
      const res = await api.get('/stats/my-stats');
      setMyStats(res.data);
    } catch (e) {
      // Non-blocking; stats are optional
    }
  };

  useEffect(() => {
    fetchMyStats();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounts', { params: { limit: 1000 } });
      setAccounts(response.data.accounts || []);
    } catch (error) {
      message.error('Failed to fetch accounts');
    }
  };

  useEffect(() => {
    fetchCommits();
  }, [pagination.current, pagination.pageSize, sortField, sortOrder, filters]);

  const fetchRepos = async () => {
    try {
      const response = await api.get('/repos', { params: { limit: 1000 } });
      setRepos(response.data.repos || []);
    } catch (error) {
      message.error('Failed to fetch repositories');
    }
  };

  const fetchCommits = async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
        sort_field: sortField,
        sort_order: sortOrder,
      };

      // Add all filters (except status, which is filtered client-side)
      Object.keys(filters).forEach(key => {
        const value = filters[key];
        if (key === 'repo_ids') return; // handled below
        if (value !== null && value !== '' && value !== false && key !== 'status') {
          if (key === 'date_range' && value && value.length === 2) {
            params.date_from = value[0].format('YYYY-MM-DD');
            params.date_to = value[1].format('YYYY-MM-DD');
          } else if (key !== 'date_range') {
            params[key] = value;
          }
        }
      });
      if (filters.repo_ids && filters.repo_ids.length > 0) {
        params.repo_ids = filters.repo_ids;
      }

      // If status filter is active, fetch more records for client-side filtering
      if (filters.status) {
        params.limit = 10000; // Fetch large number for client-side filtering
        params.offset = 0;
      }

      const response = await api.get('/commits', { params });
      let commitsData = response.data.commits || [];
      
      // Client-side filtering by status (since status is computed from multiple sources)
      if (filters.status) {
        commitsData = commitsData.filter(commit => {
          const displayStatus = commit.displayStatus || 'available';
          return displayStatus === filters.status;
        });
        // Update total for client-side filtered results
        setTotal(commitsData.length);
        // Apply pagination to filtered results
        const start = (pagination.current - 1) * pagination.pageSize;
        const end = start + pagination.pageSize;
        commitsData = commitsData.slice(start, end);
      } else {
        setTotal(response.data.total || 0);
      }
      
      setCommits(commitsData);
    } catch (error) {
      message.error('Failed to fetch commits');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommitChain = async () => {
    const base = (chainBaseCommit || '').trim();
    if (!base || base.length < 7) {
      message.warning('Enter a base commit (min 7 characters)');
      return;
    }
    setChainLoading(true);
    try {
      const params = { base_commit: base };
      if (chainRepoId) params.repo_id = chainRepoId;
      const res = await api.get('/commits/commit-chain', { params });
      setChainTree(res.data.tree || null);
      setChainTotalNodes(res.data.totalNodes || 0);
      if (!res.data.tree?.children?.length) {
        message.info('No merge commits found for this base commit');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to load commit chain');
      setChainTree(null);
      setChainTotalNodes(0);
    } finally {
      setChainLoading(false);
    }
  };

  // Flatten chain tree into list of commits with scores (for bar chart)
  const chainCommitsForChart = useMemo(() => {
    if (!chainTree || !chainTree.children?.length) return [];
    const list = [];
    function walk(node) {
      if (!node) return;
      if (node.commitId != null) {
        const short = (node.mergedCommit || node.name || '').toString().substring(0, 8);
        list.push({
          id: node.commitId,
          label: `${short} (${node.commitId})`,
          habitateScore: node.habitateScore != null ? Number(node.habitateScore) : null,
          suitabilityScore: node.suitabilityScore != null ? Number(node.suitabilityScore) : null,
          difficultyScore: node.difficultyScore != null ? Number(node.difficultyScore) : null,
        });
      }
      (node.children || []).forEach(walk);
    }
    chainTree.children.forEach(walk);
    return list;
  }, [chainTree]);

  const handleTableChange = (newPagination, newFilters, newSorter) => {
    if (newSorter && newSorter.field) {
      // Map frontend field names to backend field names
      const fieldMap = {
        'baseCommit': 'base_commit',
        'mergedCommit': 'merged_commit',
        'commitDate': 'commit_date',
        'fileChanges': 'file_changes',
        'habitateScore': 'habitate_score',
        'difficultyScore': 'difficulty_score',
        'suitabilityScore': 'suitability_score',
        'prNumber': 'pr_number',
      };
      const backendField = fieldMap[newSorter.field] || newSorter.field;
      setSortField(backendField);
      setSortOrder(newSorter.order === 'ascend' ? 'ASC' : 'DESC');
    } else {
      // Reset to default if no sorter
      setSortField(isAdmin() ? 'habitate_score' : 'commit_date');
      setSortOrder('DESC');
    }
    setPagination(newPagination);
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, current: 1 });
  };

  const handleClearFilters = () => {
    setFilters({
      repo_ids: [],
      min_habitate_score: null,
      max_habitate_score: null,
      min_difficulty_score: null,
      max_difficulty_score: null,
      min_suitability_score: null,
      max_suitability_score: null,
      min_additions: null,
      max_additions: null,
      min_deletions: null,
      max_deletions: null,
      min_file_changes: null,
      max_file_changes: null,
      is_merge: null,
      author: '',
      merged_commit: '',
      base_commit: '',
      pr_number: '',
      message: '',
      date_range: null,
      has_dependency_changes: false,
      is_unsuitable: null,
      is_behavior_preserving_refactor: null,
      single_file_200plus: false,
      multi_file_300plus: false,
      status: null,
    });
    setPagination({ ...pagination, current: 1 });
  };

  const getScoreColor = (score, maxScore = 100) => {
    if (!score) return 'default';
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'success';
    if (percentage >= 50) return 'warning';
    return 'error';
  };

  const getStatusColor = (status) => {
    const statusMap = {
      'available': 'success',
      'reserved': 'processing',
      'already_reserved': 'error',
      'unavailable': 'default',
      'too_easy': 'warning',
      'paid_out': 'purple',
      'pending_admin_approval': 'blue',
      'failed': 'error',
      'error': 'error',
    };
    return statusMap[status] || 'default';
  };

  const getStatusText = (status) => {
    const textMap = {
      'available': 'Available',
      'reserved': 'Reserved',
      'already_reserved': 'Already Reserved',
      'unavailable': 'Unavailable',
      'too_easy': 'Too Easy',
      'paid_out': 'Paid Out',
      'pending_admin_approval': 'Pending Approval',
      'failed': 'Failed',
      'error': 'Error',
    };
    return textMap[status] || status;
  };

  const handleMemo = async (commitId, isInMemo, memoedBy) => {
    // Prevent memoing if already memoed by another user
    if (!isInMemo && memoedBy) {
      message.warning(`This commit is already in ${memoedBy.username || 'another team member'}'s memo`);
      return;
    }

    setActionLoading({ ...actionLoading, [`memo-${commitId}`]: true });
    try {
      if (isInMemo) {
        await api.delete(`/commits/${commitId}/memo`);
        message.success('Removed from memo');
      } else {
        await api.post(`/commits/${commitId}/memo`);
        message.success('Added to memo');
      }
      fetchCommits();
      fetchMyStats();
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to update memo';
      if (error.response?.status === 409) {
        // Conflict - already memoed by another user
        message.warning(errorMsg);
      } else {
        message.error(errorMsg);
      }
    } finally {
      setActionLoading({ ...actionLoading, [`memo-${commitId}`]: false });
    }
  };

  const handleReserve = (commit) => {
    setSelectedCommit(commit);
    setSelectedAccountId(null);
    setReserveModalVisible(true);
  };

  const handleReserveConfirm = async () => {
    if (!selectedAccountId) {
      message.error('Please select an account');
      return;
    }
    setActionLoading({ ...actionLoading, [`reserve-${selectedCommit.id}`]: true });
    try {
      await api.post(`/commits/${selectedCommit.id}/reserve`, {
        account_id: selectedAccountId
      });
      message.success('Commit reserved successfully');
      setReserveModalVisible(false);
      fetchCommits();
      fetchMyStats();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to reserve commit');
    } finally {
      setActionLoading({ ...actionLoading, [`reserve-${selectedCommit.id}`]: false });
    }
  };

  const handleCancelReserve = async (commitId) => {
    setActionLoading({ ...actionLoading, [`cancel-${commitId}`]: true });
    try {
      await api.delete(`/commits/${commitId}/reserve`);
      message.success('Reservation cancelled');
      fetchCommits();
      fetchMyStats();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to cancel reservation');
    } finally {
      setActionLoading({ ...actionLoading, [`cancel-${commitId}`]: false });
    }
  };

  const handleMarkUnsuitable = async (commitId, isUnsuitable) => {
    setActionLoading({ ...actionLoading, [`unsuitable-${commitId}`]: true });
    try {
      if (isUnsuitable) {
        await api.post(`/commits/${commitId}/unmark-unsuitable`);
        message.success('Commit unmarked as unsuitable');
      } else {
        await api.post(`/commits/${commitId}/mark-unsuitable`);
        message.success('Commit marked as unsuitable');
      }
      fetchCommits();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to update unsuitable status');
    } finally {
      setActionLoading({ ...actionLoading, [`unsuitable-${commitId}`]: false });
    }
  };

  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 80,
        sorter: true,
      },
      {
        title: 'Repository',
        key: 'repo',
        width: 180,
        fixed: 'left',
        sorter: false,
        render: (_, record) => record.repo?.fullName || record.repo?.repoName || '-',
      },
      {
        title: 'Base Commit',
        dataIndex: 'baseCommit',
        key: 'baseCommit',
        width: 180,
        fixed: 'left',
        sorter: true,
        render: (hash, record) => {
          if (!hash) return '-';
          const repoUrl = record.repo?.fullName ? `https://github.com/${record.repo.fullName}` : '';
          const commitUrl = repoUrl ? `${repoUrl}/commit/${hash}` : '';
          const handleCopy = async (e) => {
            e.stopPropagation();
            try {
              await navigator.clipboard.writeText(hash);
              message.success('Commit hash copied!');
            } catch (err) {
              // Fallback for older browsers
              const textArea = document.createElement('textarea');
              textArea.value = hash;
              textArea.style.position = 'fixed';
              textArea.style.opacity = '0';
              document.body.appendChild(textArea);
              textArea.select();
              try {
                document.execCommand('copy');
                message.success('Commit hash copied!');
              } catch (err2) {
                message.error('Failed to copy hash');
              }
              document.body.removeChild(textArea);
            }
          };
          return (
            <Space size="small">
              <code style={{ fontSize: 11 }}>{hash.substring(0, 8)}</code>
              <Tooltip title="Copy full hash">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={handleCopy}
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
        dataIndex: 'mergedCommit',
        key: 'mergedCommit',
        width: 180,
        fixed: 'left',
        sorter: true,
        render: (hash, record) => {
          if (!hash) return '-';
          const repoUrl = record.repo?.fullName ? `https://github.com/${record.repo.fullName}` : '';
          const commitUrl = repoUrl ? `${repoUrl}/commit/${hash}` : '';
          const handleCopy = async (e) => {
            e.stopPropagation();
            try {
              await navigator.clipboard.writeText(hash);
              message.success('Commit hash copied!');
            } catch (err) {
              // Fallback for older browsers
              const textArea = document.createElement('textarea');
              textArea.value = hash;
              textArea.style.position = 'fixed';
              textArea.style.opacity = '0';
              document.body.appendChild(textArea);
              textArea.select();
              try {
                document.execCommand('copy');
                message.success('Commit hash copied!');
              } catch (err2) {
                message.error('Failed to copy hash');
              }
              document.body.removeChild(textArea);
            }
          };
          return (
            <Space size="small">
              <code style={{ fontSize: 11 }}>{hash.substring(0, 8)}</code>
              <Tooltip title="Copy full hash">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={handleCopy}
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
        dataIndex: 'prNumber',
        key: 'prNumber',
        width: 120,
        fixed: 'left',
        align: 'center',
        sorter: true,
        render: (num, record) => {
          if (!num) return '-';
          const repoUrl = record.repo?.fullName ? `https://github.com/${record.repo.fullName}` : '';
          const prUrl = repoUrl ? `${repoUrl}/pull/${num}` : '';
          return (
            <Space size="small">
              <span>{num}</span>
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
        title: 'Files',
        dataIndex: 'fileChanges',
        key: 'fileChanges',
        width: 80,
        align: 'center',
        sorter: true,
      },
      {
        title: 'Additions',
        dataIndex: 'additions',
        key: 'additions',
        width: 100,
        align: 'center',
        sorter: true,
        render: (val) => <span style={{ color: '#52c41a' }}>+{val || 0}</span>,
      },
      {
        title: 'Deletions',
        dataIndex: 'deletions',
        key: 'deletions',
        width: 100,
        align: 'center',
        sorter: true,
        render: (val) => <span style={{ color: '#ff4d4f' }}>-{val || 0}</span>,
      },
    ];

    // Add score columns only for admins
    if (isAdmin()) {
      baseColumns.push(
        {
          title: 'Habitat Score',
          dataIndex: 'habitateScore',
          key: 'habitateScore',
          width: 120,
          align: 'center',
          sorter: true,
          render: (score) => (
            <Tag color={getScoreColor(score, 150)}>{score || 0}</Tag>
          ),
        },
        {
          title: 'Difficulty',
          dataIndex: 'difficultyScore',
          key: 'difficultyScore',
          width: 100,
          align: 'center',
          sorter: true,
          render: (score) => score ? (
            <Tag color={getScoreColor(score, 100)}>{parseFloat(score).toFixed(1)}</Tag>
          ) : '-',
        },
        {
          title: 'Suitability',
          dataIndex: 'suitabilityScore',
          key: 'suitabilityScore',
          width: 100,
          align: 'center',
          sorter: true,
          render: (score) => score ? (
            <Tag color={getScoreColor(score, 100)}>{parseFloat(score).toFixed(1)}</Tag>
          ) : '-',
        }
      );
    }

    // Add remaining columns
    baseColumns.push(
      {
        title: 'Flags',
        key: 'flags',
        width: 200,
        render: (_, record) => (
          <Space size="small" wrap>
            {record.isMerge && <Tag color="blue">Merge</Tag>}
            {record.hasDependencyChanges && <Tag color="error">Deps</Tag>}
            {record.isBehaviorPreservingRefactor && <Tag color="warning">Refactor</Tag>}
            {record.isUnsuitable && <Tag color="error">Unsuitable</Tag>}
            {record.testCoverageScore && (
              <Tag color="success">Test: {(parseFloat(record.testCoverageScore) * 100).toFixed(0)}%</Tag>
            )}
          </Space>
        ),
      },
      {
        title: 'Status',
        key: 'status',
        width: 150,
        fixed: 'right',
        render: (_, record) => {
          const status = record.displayStatus || 'available';
          const expiresAt = record.expiresAt;
          return (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Tag color={getStatusColor(status)}>
                {getStatusText(status)}
              </Tag>
              {expiresAt && (
                <Tooltip title={`Expires: ${dayjs(expiresAt).format('YYYY-MM-DD HH:mm')}`}>
                  <Tag color="default" icon={<ClockCircleOutlined />}>
                    {dayjs(expiresAt).fromNow()}
                  </Tag>
                </Tooltip>
              )}
            </Space>
          );
        },
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 200,
        fixed: 'right',
        render: (_, record) => {
          const isReserved = record.userReservation && record.userReservation.status === 'reserved';
          const isInMemo = record.isInMemo;
          const memoedBy = record.memoedBy; // Info about who else has memoed this commit
          const isUnsuitable = record.isUnsuitable;
          const canMemo = !memoedBy || isInMemo; // Can only memo if not memoed by another user or already in own memo
          
          const memoTooltip = isInMemo 
            ? 'Remove from memo' 
            : memoedBy 
              ? `Already in ${memoedBy.username || 'another team member'}'s memo`
              : 'Add to memo';
          
          return (
            <Space size="small">
              <Tooltip title={memoTooltip}>
                <Button
                  type="text"
                  size="small"
                  icon={<BookOutlined />}
                  onClick={() => handleMemo(record.id, isInMemo, memoedBy)}
                  loading={actionLoading[`memo-${record.id}`]}
                  disabled={!canMemo && !isInMemo}
                  style={{
                    color: isInMemo ? '#faad14' : memoedBy ? '#ff4d4f' : '#8c8c8c',
                    padding: '4px 8px',
                    opacity: (!canMemo && !isInMemo) ? 0.5 : 1,
                    cursor: (!canMemo && !isInMemo) ? 'not-allowed' : 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (canMemo || isInMemo) {
                      e.currentTarget.style.background = 'rgba(250, 173, 20, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                />
              </Tooltip>
              {isReserved ? (
                <Popconfirm
                  title="Cancel reservation?"
                  onConfirm={() => handleCancelReserve(record.id)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Tooltip title="Cancel reservation">
                    <Button
                      type="text"
                      size="small"
                      icon={<CloseCircleOutlined />}
                      loading={actionLoading[`cancel-${record.id}`]}
                      style={{
                        color: '#52c41a',
                        padding: '4px 8px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(82, 196, 26, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    />
                  </Tooltip>
                </Popconfirm>
              ) : (
                <Tooltip title="Reserve commit">
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleReserve(record)}
                    loading={actionLoading[`reserve-${record.id}`]}
                    disabled={record.displayStatus === 'already_reserved' || record.displayStatus === 'unavailable'}
                    style={{
                      color: '#1890ff',
                      padding: '4px 8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(24, 144, 255, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  />
                </Tooltip>
              )}
              <Tooltip title={isUnsuitable ? 'Unmark as unsuitable' : 'Mark as unsuitable'}>
                <Button
                  type="text"
                  size="small"
                  icon={<ExclamationCircleOutlined />}
                  onClick={() => handleMarkUnsuitable(record.id, isUnsuitable)}
                  loading={actionLoading[`unsuitable-${record.id}`]}
                  style={{
                    color: isUnsuitable ? '#ff4d4f' : '#8c8c8c',
                    padding: '4px 8px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isUnsuitable ? 'rgba(255, 77, 79, 0.1)' : 'rgba(140, 140, 140, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                />
              </Tooltip>
            </Space>
          );
        },
      },
      {
        title: 'Message',
        dataIndex: 'message',
        key: 'message',
        width: 300,
        ellipsis: true,
        render: (msg) => msg ? (
          <Tooltip title={msg}>
            <span>{msg.substring(0, 50)}{msg.length > 50 ? '...' : ''}</span>
          </Tooltip>
        ) : '-',
      }
    );

    // Filter columns based on visibility settings
    return baseColumns.filter(col => {
      const key = col.key;
      // Always show actions and status (required columns)
      if (key === 'actions' || key === 'status') {
        return true;
      }
      // Check visibility for other columns
      return visibleColumns[key] !== false;
    });
  }, [isAdmin, visibleColumns]);

  // Save visible columns to localStorage when changed
  useEffect(() => {
    localStorage.setItem('commitsTable_visibleColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Column definitions for customization modal
  const columnDefinitions = useMemo(() => [
    { key: 'id', label: 'ID', defaultVisible: true },
    { key: 'repo', label: 'Repository', defaultVisible: true },
    { key: 'baseCommit', label: 'Base Commit', defaultVisible: true },
    { key: 'mergedCommit', label: 'Merged Commit', defaultVisible: true },
    { key: 'prNumber', label: 'PR #', defaultVisible: true },
    { key: 'fileChanges', label: 'Files', defaultVisible: true },
    { key: 'additions', label: 'Additions', defaultVisible: true },
    { key: 'deletions', label: 'Deletions', defaultVisible: true },
    { key: 'habitateScore', label: 'Habitat Score', defaultVisible: isAdmin() },
    { key: 'difficultyScore', label: 'Difficulty', defaultVisible: isAdmin() },
    { key: 'suitabilityScore', label: 'Suitability', defaultVisible: isAdmin() },
    { key: 'flags', label: 'Flags', defaultVisible: true },
    { key: 'status', label: 'Status', defaultVisible: true },
    { key: 'actions', label: 'Actions', defaultVisible: true },
    { key: 'message', label: 'Message', defaultVisible: true },
  ], [isAdmin]);

  const handleColumnVisibilityChange = (key, checked) => {
    setVisibleColumns(prev => ({
      ...prev,
      [key]: checked
    }));
  };

  const handleResetColumns = () => {
    const defaults = {};
    columnDefinitions.forEach(col => {
      defaults[col.key] = col.defaultVisible;
    });
    setVisibleColumns(defaults);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    Object.keys(filters).forEach(key => {
      const value = filters[key];
      if (key === 'repo_ids') {
        if (value && value.length > 0) count++;
        return;
      }
      if (value !== null && value !== '' && value !== false) {
        if (key === 'date_range' && value && value.length === 2) {
          count++;
        } else if (key !== 'date_range') {
          count++;
        }
      }
    });
    return count;
  }, [filters]);

  const filterLabelStyle = { color: 'rgb(148, 163, 184)', fontSize: 12, display: 'block', marginBottom: 4 };
  const filterBlockStyle = { marginBottom: 12 };

  return (
    <div>
      <Row gutter={16} wrap={false} style={{ alignItems: 'flex-start' }}>
        {/* Left sidebar: filters - always visible */}
        <Col
          flex="0 0 280px"
          style={{
            position: 'sticky',
            top: 0,
           
          }}
        >
          <Card
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              maxHeight: 'calc(88vh)',
              overflowY: 'auto',
            }}
          >
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Text strong style={{ color: 'rgb(241, 245, 249)', fontSize: 14 }}>
                Filters {activeFiltersCount > 0 && <Tag color="blue">{activeFiltersCount}</Tag>}
              </Text>
              <Space size="small">
                <Button
                  type="link"
                  size="small"
                  icon={<ClearOutlined />}
                  onClick={handleClearFilters}
                  disabled={activeFiltersCount === 0}
                  style={{ padding: 0, color: 'rgb(148, 163, 184)' }}
                >
                  Clear
                </Button>
              </Space>
            </div>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* Repository (multi-select) */}
              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>Repository</Text>
                <Select
                  mode="multiple"
                  placeholder="All Repositories"
                  style={{ width: '100%' }}
                  allowClear
                  value={filters.repo_ids || []}
                  onChange={(value) => handleFilterChange('repo_ids', value)}
                >
                  {repos.map(repo => (
                    <Option
                      key={repo.id}
                      value={repo.id}
                      style={{
                        backgroundColor: repo.isActive ? 'rgba(22, 163, 74, 0.1)' : 'transparent',
                        fontWeight: repo.isActive ? 600 : 'normal',
                      }}
                    >
                      {repo.fullName}
                      {repo.isActive && <Tag color="success" style={{ marginLeft: 8, fontSize: 10 }}>Active</Tag>}
                    </Option>
                  ))}
                </Select>
              </div>

              {isAdmin() && (
                <>
                  <div style={filterBlockStyle}>
                    <Text style={filterLabelStyle}>Habitat Score</Text>
                    <Input.Group compact>
                      <InputNumber placeholder="Min" style={{ width: '50%' }} min={0} max={150} value={filters.min_habitate_score} onChange={(v) => handleFilterChange('min_habitate_score', v)} />
                      <InputNumber placeholder="Max" style={{ width: '50%' }} min={0} max={150} value={filters.max_habitate_score} onChange={(v) => handleFilterChange('max_habitate_score', v)} />
                    </Input.Group>
                  </div>
                  <div style={filterBlockStyle}>
                    <Text style={filterLabelStyle}>Difficulty Score</Text>
                    <Input.Group compact>
                      <InputNumber placeholder="Min" style={{ width: '50%' }} min={0} max={100} step={0.1} value={filters.min_difficulty_score} onChange={(v) => handleFilterChange('min_difficulty_score', v)} />
                      <InputNumber placeholder="Max" style={{ width: '50%' }} min={0} max={100} step={0.1} value={filters.max_difficulty_score} onChange={(v) => handleFilterChange('max_difficulty_score', v)} />
                    </Input.Group>
                  </div>
                  <div style={filterBlockStyle}>
                    <Text style={filterLabelStyle}>Suitability Score</Text>
                    <Input.Group compact>
                      <InputNumber placeholder="Min" style={{ width: '50%' }} min={0} max={100} step={0.1} value={filters.min_suitability_score} onChange={(v) => handleFilterChange('min_suitability_score', v)} />
                      <InputNumber placeholder="Max" style={{ width: '50%' }} min={0} max={100} step={0.1} value={filters.max_suitability_score} onChange={(v) => handleFilterChange('max_suitability_score', v)} />
                    </Input.Group>
                  </div>
                </>
              )}

              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>Additions</Text>
                <Input.Group compact>
                  <InputNumber placeholder="Min" style={{ width: '50%' }} min={0} value={filters.min_additions} onChange={(v) => handleFilterChange('min_additions', v)} />
                  <InputNumber placeholder="Max" style={{ width: '50%' }} min={0} value={filters.max_additions} onChange={(v) => handleFilterChange('max_additions', v)} />
                </Input.Group>
              </div>
              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>Deletions</Text>
                <Input.Group compact>
                  <InputNumber placeholder="Min" style={{ width: '50%' }} min={0} value={filters.min_deletions} onChange={(v) => handleFilterChange('min_deletions', v)} />
                  <InputNumber placeholder="Max" style={{ width: '50%' }} min={0} value={filters.max_deletions} onChange={(v) => handleFilterChange('max_deletions', v)} />
                </Input.Group>
              </div>
              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>File Changes</Text>
                <Input.Group compact>
                  <InputNumber placeholder="Min" style={{ width: '50%' }} min={0} value={filters.min_file_changes} onChange={(v) => handleFilterChange('min_file_changes', v)} />
                  <InputNumber placeholder="Max" style={{ width: '50%' }} min={0} value={filters.max_file_changes} onChange={(v) => handleFilterChange('max_file_changes', v)} />
                </Input.Group>
              </div>

              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>Author</Text>
                <Input placeholder="Search author" value={filters.author} onChange={(e) => handleFilterChange('author', e.target.value)} allowClear />
              </div>
              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>Base Commit</Text>
                <Input placeholder="Search base commit" value={filters.base_commit} onChange={(e) => handleFilterChange('base_commit', e.target.value)} allowClear />
              </div>
              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>Merged Commit</Text>
                <Input placeholder="Search merged commit" value={filters.merged_commit} onChange={(e) => handleFilterChange('merged_commit', e.target.value)} allowClear />
              </div>
              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>PR Number</Text>
                <InputNumber placeholder="PR #" style={{ width: '100%' }} min={1} value={filters.pr_number} onChange={(v) => handleFilterChange('pr_number', v)} />
              </div>
              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>Message</Text>
                <Input placeholder="Search in message" value={filters.message} onChange={(e) => handleFilterChange('message', e.target.value)} allowClear />
              </div>
              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>Commit Date</Text>
                <RangePicker style={{ width: '100%' }} value={filters.date_range} onChange={(dates) => handleFilterChange('date_range', dates)} format="YYYY-MM-DD" />
              </div>

              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>Is Merge</Text>
                <Select placeholder="All" style={{ width: '100%' }} allowClear value={filters.is_merge} onChange={(v) => handleFilterChange('is_merge', v)}>
                  <Option value={true}>Yes</Option>
                  <Option value={false}>No</Option>
                </Select>
              </div>
              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>Unsuitable</Text>
                <Select placeholder="All" style={{ width: '100%' }} allowClear value={filters.is_unsuitable} onChange={(v) => handleFilterChange('is_unsuitable', v)}>
                  <Option value={true}>Yes</Option>
                  <Option value={false}>No</Option>
                </Select>
              </div>
              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>Behavior Preserving Refactor</Text>
                <Select placeholder="All" style={{ width: '100%' }} allowClear value={filters.is_behavior_preserving_refactor} onChange={(v) => handleFilterChange('is_behavior_preserving_refactor', v)}>
                  <Option value={true}>Yes</Option>
                  <Option value={false}>No</Option>
                </Select>
              </div>
              <div style={filterBlockStyle}>
                <Text style={filterLabelStyle}>Status</Text>
                <Select placeholder="All Status" style={{ width: '100%' }} allowClear value={filters.status} onChange={(v) => handleFilterChange('status', v)}>
                  <Option value="available">Available</Option>
                  <Option value="reserved">Reserved</Option>
                  <Option value="already_reserved">Already Reserved</Option>
                  <Option value="unavailable">Unavailable</Option>
                  <Option value="too_easy">Too Easy</Option>
                  <Option value="paid_out">Paid Out</Option>
                  <Option value="pending_admin_approval">Pending Approval</Option>
                  <Option value="failed">Failed</Option>
                  <Option value="error">Error</Option>
                </Select>
              </div>

              <div style={filterBlockStyle}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Checkbox checked={filters.has_dependency_changes === false} onChange={(e) => handleFilterChange('has_dependency_changes', !e.target.checked ? null : false)}>No Dependency Changes</Checkbox>
                  <Checkbox checked={filters.single_file_200plus} onChange={(e) => handleFilterChange('single_file_200plus', e.target.checked)}>Single File 200+ Additions</Checkbox>
                  <Checkbox checked={filters.multi_file_300plus} onChange={(e) => handleFilterChange('multi_file_300plus', e.target.checked)}>Multi File 300+ Additions</Checkbox>
                </Space>
              </div>
            </Space>
          </Card>
        </Col>

        {/* Right: table area */}
        <Col flex="1" style={{ minWidth: 0 }}>
          <Card
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              height: 'calc(88vh)',
              overflowY: 'auto',
            }}
          >
            <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
              <Col>
                <Title level={2} style={{ color: 'rgb(241, 245, 249)', margin: 0 }}>
                  Commits
                </Title>
              </Col>
              <Col>
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={fetchCommits}>
                    Refresh
                  </Button>
                  <Button icon={<SettingOutlined />} onClick={() => setColumnCustomizeVisible(true)} title="Customize Columns">
                    Columns
                  </Button>
                </Space>
              </Col>
            </Row>
            {/* Reservations & Memo counts - highlighted */}
            <Row align="middle" style={{ marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
              <Space size="middle" wrap>
                <span
                  style={{
                    background: 'rgba(22, 163, 74, 0.2)',
                    color: '#4ade80',
                    padding: '4px 12px',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Reservations: {myStats?.reservations?.total ?? '—'} {myStats?.reservations?.active != null && `(${myStats.reservations.active} active)`}
                </span>
                <span
                  style={{
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#fbbf24',
                    padding: '4px 12px',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Memo: {myStats?.memoCommits?.total ?? '—'}
                </span>
              </Space>
            </Row>

            {/* Admin: Commit Chain tree (base -> merge commits, for paid_out chain) */}
            {isAdmin() && (
              <Collapse style={{ marginBottom: 16, background: '#1e293b', border: '1px solid #334155' }}>
                <Panel
                  header={
                    <Space>
                      <Text strong style={{ color: 'rgb(241, 245, 249)' }}>Commit Chain (Admin)</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>Base commit → merge commits tree (paid_out chain)</Text>
                    </Space>
                  }
                  key="commit-chain"
                >
                  <Row gutter={[16, 16]} align="middle">
                    <Col>
                      <Input
                        placeholder="Base commit hash (min 7 chars)"
                        value={chainBaseCommit}
                        onChange={(e) => setChainBaseCommit(e.target.value)}
                        style={{ width: 280 }}
                        allowClear
                      />
                    </Col>
                    <Col>
                      <Select
                        placeholder="Repo (optional)"
                        allowClear
                        value={chainRepoId}
                        onChange={setChainRepoId}
                        style={{ width: 220 }}
                      >
                        {repos.map((r) => (
                          <Option key={r.id} value={r.id}>{r.fullName || r.repoName}</Option>
                        ))}
                      </Select>
                    </Col>
                    <Col>
                      <Button type="primary" loading={chainLoading} onClick={fetchCommitChain}>
                        Load chain
                      </Button>
                    </Col>
                    {chainTotalNodes > 0 && (
                      <Col>
                        <Text style={{ color: 'rgb(148, 163, 184)' }}>Chain: {chainTotalNodes} node(s)</Text>
                      </Col>
                    )}
                  </Row>
                  {chainTree && (
                    <Row gutter={16} style={{ marginTop: 16, minHeight: 400 }}>
                      <Col xs={24} lg={14}>
                        <div style={{ minHeight: 450 }}>
                          <ReactECharts
                            option={{
                              title: {
                                text: 'Commit chain',
                                left: 'center',
                                textStyle: { color: 'rgb(241, 245, 249)', fontSize: 14 }
                              },
                              tooltip: {
                                trigger: 'item',
                                formatter: (params) => {
                                  const d = params.data;
                                  if (!d) return params.name;
                                  let s = `<strong>${params.name}</strong>`;
                                  if (d.baseCommit) s += `<br/>Base: ${d.baseCommit.substring(0, 12)}...`;
                                  if (d.mergedCommit) s += `<br/>Merged: ${d.mergedCommit.substring(0, 12)}...`;
                                  if (d.status) s += `<br/>Status: ${d.status}`;
                                  if (d.habitateScore != null) s += `<br/>Habitat: ${d.habitateScore}`;
                                  if (d.suitabilityScore != null) s += `<br/>Suitability: ${d.suitabilityScore}`;
                                  if (d.difficultyScore != null) s += `<br/>Difficulty: ${d.difficultyScore}`;
                                  if (d.repoName) s += `<br/>Repo: ${d.repoName}`;
                                  return s;
                                }
                              },
                              series: [
                                {
                                  type: 'tree',
                                  data: [chainTree],
                                  left: '2%',
                                  right: '2%',
                                  top: '15%',
                                  bottom: '8%',
                                  orient: 'TB',
                                  symbol: 'roundRect',
                                  symbolSize: 10,
                                  edgeShape: 'polyline',
                                  edgeForkPosition: '50%',
                                  initialTreeDepth: -1,
                                  lineStyle: { color: '#334155', width: 1.5 },
                                  itemStyle: {
                                    color: '#16a34a',
                                    borderColor: '#334155',
                                    borderWidth: 1
                                  },
                                  label: {
                                    position: 'left',
                                    verticalAlign: 'middle',
                                    align: 'right',
                                    color: 'rgb(241, 245, 249)',
                                    fontSize: 12
                                  },
                                  leaves: {
                                    label: { position: 'left', verticalAlign: 'middle', align: 'right' }
                                  },
                                  expandAndCollapse: true,
                                  animationDuration: 550,
                                  animationDurationUpdate: 750
                                }
                              ],
                              backgroundColor: 'transparent'
                            }}
                            style={{ height: Math.max(450, (chainTotalNodes || 1) * 55), width: '100%' }}
                            opts={{ renderer: 'svg' }}
                          />
                        </div>
                      </Col>
                      <Col xs={24} lg={10}>
                        {chainCommitsForChart.length > 0 ? (
                          <div style={{ minHeight: 450 }}>
                            <ReactECharts
                              option={{
                                title: {
                                  text: 'Scores by commit',
                                  left: 'center',
                                  textStyle: { color: 'rgb(241, 245, 249)', fontSize: 14 }
                                },
                                tooltip: {
                                  trigger: 'axis',
                                  axisPointer: { type: 'shadow' },
                                  backgroundColor: 'rgba(30, 41, 59, 0.95)',
                                  borderColor: '#334155',
                                  textStyle: { color: 'rgb(241, 245, 249)' }
                                },
                                legend: {
                                  data: ['Habitat', 'Suitability', 'Difficulty'],
                                  top: 28,
                                  textStyle: { color: 'rgb(148, 163, 184)' }
                                },
                                grid: {
                                  left: '3%',
                                  right: '4%',
                                  bottom: '3%',
                                  top: 60,
                                  containLabel: true
                                },
                                xAxis: {
                                  type: 'value',
                                  name: 'Score',
                                  nameTextStyle: { color: 'rgb(148, 163, 184)' },
                                  axisLabel: { color: 'rgb(148, 163, 184)' },
                                  splitLine: { lineStyle: { color: '#334155' } }
                                },
                                yAxis: {
                                  type: 'category',
                                  data: chainCommitsForChart.map(c => c.label),
                                  axisLabel: {
                                    color: 'rgb(148, 163, 184)',
                                    fontSize: 11,
                                    width: 80,
                                    overflow: 'truncate',
                                    ellipsis: '...'
                                  }
                                },
                                series: [
                                  {
                                    name: 'Habitat',
                                    type: 'bar',
                                    data: chainCommitsForChart.map(c => c.habitateScore != null ? Number(c.habitateScore) : null),
                                    itemStyle: { color: '#16a34a' }
                                  },
                                  {
                                    name: 'Suitability',
                                    type: 'bar',
                                    data: chainCommitsForChart.map(c => c.suitabilityScore != null ? Number(c.suitabilityScore) : null),
                                    itemStyle: { color: '#3b82f6' }
                                  },
                                  {
                                    name: 'Difficulty',
                                    type: 'bar',
                                    data: chainCommitsForChart.map(c => c.difficultyScore != null ? Number(c.difficultyScore) : null),
                                    itemStyle: { color: '#f59e0b' }
                                  }
                                ],
                                backgroundColor: 'transparent'
                              }}
                              style={{ height: 450, width: '100%' }}
                              opts={{ renderer: 'svg' }}
                            />
                          </div>
                        ) : (
                          <div style={{ padding: 24, textAlign: 'center', color: 'rgb(148, 163, 184)', minHeight: 450 }}>
                            <Text type="secondary">No score data for chain commits</Text>
                          </div>
                        )}
                      </Col>
                    </Row>
                  )}
                </Panel>
              </Collapse>
            )}

        <Table
          columns={columns}
          dataSource={commits}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} commits`,
            pageSizeOptions: ['10', '20', '50', '100', '200'],
          }}
          onChange={handleTableChange}
          scroll={{ 
            x: 'max-content',
            y: 'calc(51vh)'
          }}
          sticky={{
            offsetHeader: 0
          }}
          style={{
            background: '#1e293b',
          }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Reserve Commit"
        open={reserveModalVisible}
        onOk={handleReserveConfirm}
        onCancel={() => setReserveModalVisible(false)}
        okText="Reserve"
        cancelText="Cancel"
        confirmLoading={selectedCommit && actionLoading[`reserve-${selectedCommit.id}`]}
      >
        {selectedCommit && (
          <div>
            <p><strong>Repository:</strong> {selectedCommit.repo?.fullName}</p>
            <p><strong>Base Commit:</strong> <code>{selectedCommit.baseCommit?.substring(0, 8)}</code></p>
            <p style={{ marginBottom: 16 }}>
              <strong>Select Account:</strong>
            </p>
            <Select
              size="large"
              style={{ width: '100%' }}
              placeholder="Select an account"
              value={selectedAccountId}
              onChange={setSelectedAccountId}
            >
              {accounts
                .filter(acc => acc.isActive && acc.accountHealth !== 'exhausted' && acc.accountHealth !== 'error')
                .map(account => (
                  <Option key={account.id} value={account.id}>
                    {account.accountName} ({account.remainingReversals || 0} remaining)
                  </Option>
                ))}
            </Select>
          </div>
        )}
      </Modal>

      {/* Column Customization Modal */}
      <Modal
        title="Customize Columns"
        open={columnCustomizeVisible}
        onCancel={() => setColumnCustomizeVisible(false)}
        onOk={() => setColumnCustomizeVisible(false)}
        okText="Done"
        cancelButtonProps={{ style: { display: 'none' } }}
        width={500}
        style={{ top: 100 }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>Select columns to display:</Text>
            <Button type="link" size="small" onClick={handleResetColumns}>
              Reset to Defaults
            </Button>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {columnDefinitions.map(col => (
                <Checkbox
                  key={col.key}
                  checked={visibleColumns[col.key] !== false}
                  onChange={(e) => handleColumnVisibilityChange(col.key, e.target.checked)}
                  disabled={col.key === 'actions' || col.key === 'status'} // Always show actions and status
                >
                  {col.label}
                  {col.key === 'actions' || col.key === 'status' ? (
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>(Required)</Text>
                  ) : null}
                </Checkbox>
              ))}
            </Space>
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default CommitsTable;
