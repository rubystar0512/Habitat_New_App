import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Card,
  Button,
  Tag,
  Space,
  Typography,
  Input,
  InputNumber,
  message,
  Select,
  Tooltip,
  Skeleton,
  Row,
  Col,
  Popconfirm,
  Checkbox,
} from 'antd';
import {
  ReloadOutlined,
  CopyOutlined,
  LinkOutlined,
  FilterOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import api from '../../config/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Option } = Select;

const ReservationsTable = () => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [releasing, setReleasing] = useState({});
  const [stats, setStats] = useState({ total: 0, released: 0 });
  const [filters, setFilters] = useState({
    status: 'reserved', // default: show only reserved, not released
    account: '',
    repo: undefined,
    merged_commit: '',
    base_commit: '',
    pr_number: ''
  });
  const [showOnlyReserved, setShowOnlyReserved] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0
  });
  const [sortConfig, setSortConfig] = useState({
    field: 'reservedAt',
    order: 'DESC'
  });
  const [repoWinRates, setRepoWinRates] = useState([]);
  const [priorityUpdating, setPriorityUpdating] = useState({});

  useEffect(() => {
    fetchReservations();
  }, [pagination.current, pagination.pageSize, filters.status, sortConfig.field, sortConfig.order]);

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

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
        ...(filters.status && { status: filters.status }),
        ...(sortConfig.field && { sortBy: sortConfig.field }),
        ...(sortConfig.order && { sortOrder: sortConfig.order })
      };
      const response = await api.get('/reservations', { params });
      setReservations(response.data.reservations || []);
      setPagination(prev => ({ ...prev, total: response.data.total || 0 }));
    } catch (err) {
      console.error('Failed to fetch reservations:', err);
      message.error(err.response?.data?.error || 'Failed to fetch reservations');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await api.post('/reservations/sync');
      const { synced, updated, errors } = response.data;
      
      let messageText = '';
      if (synced > 0 || updated > 0) {
        messageText = `Synced ${synced} new reservations`;
        if (updated > 0) {
          messageText += `, updated ${updated} existing reservations`;
        }
        message.success(messageText);
      } else {
        message.info('No new reservations to sync');
      }
      
      if (errors && errors.length > 0) {
        console.warn('Sync errors:', errors);
        message.warning(`${errors.length} error(s) occurred during sync. Check console for details.`);
      }
      
      await fetchReservations();
    } catch (err) {
      console.error('Failed to sync reservations:', err);
      message.error(err.response?.data?.error || 'Failed to sync reservations');
    } finally {
      setSyncing(false);
    }
  };

  const handleRelease = async (reservation) => {
    setReleasing(prev => ({ ...prev, [reservation.id]: true }));
    try {
      await api.delete(`/reservations/${reservation.id}`);
      message.success('Reservation released successfully');
      await fetchReservations();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to release reservation');
    } finally {
      setReleasing(prev => ({ ...prev, [reservation.id]: false }));
    }
  };

  const handlePriorityChange = async (reservationId, value) => {
    if (value == null || value === '') return;
    setPriorityUpdating(prev => ({ ...prev, [reservationId]: true }));
    try {
      await api.patch(`/reservations/${reservationId}`, { priority: value });
      message.success('Priority updated');
      await fetchReservations();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to update priority');
    } finally {
      setPriorityUpdating(prev => ({ ...prev, [reservationId]: false }));
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
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleResetFilters = () => {
    setFilters({
      status: showOnlyReserved ? 'reserved' : undefined,
      account: '',
      repo: undefined,
      merged_commit: '',
      base_commit: '',
      pr_number: ''
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleShowOnlyReservedChange = (e) => {
    const checked = e.target.checked;
    setShowOnlyReserved(checked);
    handleFilterChange('status', checked ? 'reserved' : undefined);
  };

  // Get unique accounts and repos for filters
  const accounts = useMemo(() => {
    const unique = new Set();
    reservations.forEach(r => {
      if (r.account_name) unique.add(r.account_name);
    });
    return Array.from(unique).sort();
  }, [reservations]);

  const repos = useMemo(() => {
    const unique = new Set();
    reservations.forEach(r => {
      if (r.repo_name) unique.add(r.repo_name);
    });
    return Array.from(unique).sort();
  }, [reservations]);

  // Filter reservations (client-side for text search)
  const filteredReservations = useMemo(() => {
    let filtered = reservations;

    if (filters.account) {
      filtered = filtered.filter(r => 
        (r.account_name || '').toLowerCase().includes(filters.account.toLowerCase())
      );
    }

    if (filters.repo) {
      filtered = filtered.filter(r => 
        (r.repo_name || '').toLowerCase().includes(filters.repo.toLowerCase())
      );
    }

    if (filters.merged_commit) {
      filtered = filtered.filter(r => 
        (r.merged_commit || '').toLowerCase().includes(filters.merged_commit.toLowerCase())
      );
    }

    if (filters.base_commit) {
      filtered = filtered.filter(r => 
        (r.base_commit || '').toLowerCase().includes(filters.base_commit.toLowerCase())
      );
    }

    if (filters.pr_number) {
      filtered = filtered.filter(r => 
        String(r.pr_number || '').includes(filters.pr_number)
      );
    }

    return filtered;
  }, [reservations, filters]);

  const repoWinRateMap = useMemo(
    () => new Map((repoWinRates || []).map(r => [r.repoId, r])),
    [repoWinRates]
  );

  const columns = [
    {
      title: (
        <Tooltip title="Edit 0–100. Suggested value is auto-calculated from habitate, suitability, difficulty, and pattern (single-file 200+, multi-file 300+).">
          <span style={{ cursor: 'help' }}>Priority</span>
        </Tooltip>
      ),
      dataIndex: 'priority',
      key: 'priority',
      width: 160,
      fixed: 'left',
      sorter: true,
      render: (val, record) => {
        const current = val != null ? val : 0;
        const suggested = record.suggestedPriority;
        const isApplying = priorityUpdating[record.id];
        const matchesSuggested = suggested != null && suggested === current;
        return (
          <Space size="small" wrap={false}>
            <InputNumber
              min={0}
              max={100}
              value={current}
              size="small"
              style={{ width: 60 }}
              loading={isApplying}
              onChange={(v) => {
                if (v != null && !Number.isNaN(v)) handlePriorityChange(record.id, v);
              }}
            />
            {suggested != null && (
              matchesSuggested ? (
                <Tooltip title="Your priority matches the auto-suggested value">
                  <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                    <CheckCircleOutlined style={{ marginRight: 4, color: 'var(--ant-color-success)' }} />
                    Auto
                  </Text>
                </Tooltip>
              ) : (
                <Tooltip title={`Apply suggested priority (${suggested}) from scores + pattern`}>
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    icon={<ThunderboltOutlined />}
                    loading={isApplying}
                    onClick={() => handlePriorityChange(record.id, suggested)}
                    style={{ minWidth: 32, padding: '0 6px' }}
                  >
                    {suggested}
                  </Button>
                </Tooltip>
              )
            )}
          </Space>
        );
      }
    },
    {
      title: 'Repo',
      dataIndex: 'repo_name',
      key: 'repo_name',
      width: 220,
      fixed: 'left',
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
                      fontSize: 12
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
      }
    },
    {
      title: 'Merged Commit',
      dataIndex: 'merged_commit',
      key: 'merged_commit',
      width: 150,
      fixed: 'left',
      render: (text, record) => {
        if (!text) return <Text type="secondary">-</Text>;
        const repoName = record.repo_name;
        const commitUrl = repoName ? `https://github.com/${repoName}/commit/${text}` : null;
        return (
          <Space>
            <Text 
              style={{ 
                color: 'rgb(148, 163, 184)', 
                fontSize: 12,
                fontFamily: 'monospace'
              }}
            >
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
            {commitUrl && (
              <Tooltip title={`Open commit ${text.substring(0, 8)} on GitHub`}>
                <Button
                  type="text"
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(commitUrl, '_blank');
                  }}
                  style={{ 
                    color: 'rgb(148, 163, 184)',
                    padding: '0 4px',
                    height: 'auto',
                    fontSize: 12
                  }}
                />
              </Tooltip>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Base Commit',
      dataIndex: 'base_commit',
      key: 'base_commit',
      width: 150,
      fixed: 'left',
      render: (text, record) => {
        if (!text) return <Text type="secondary">-</Text>;
        const repoName = record.repo_name;
        const commitUrl = repoName ? `https://github.com/${repoName}/commit/${text}` : null;
        return (
          <Space>
            <Text 
              style={{ 
                color: 'rgb(148, 163, 184)', 
                fontSize: 12,
                fontFamily: 'monospace'
              }}
            >
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
            {commitUrl && (
              <Tooltip title={`Open commit ${text.substring(0, 8)} on GitHub`}>
                <Button
                  type="text"
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(commitUrl, '_blank');
                  }}
                  style={{ 
                    color: 'rgb(148, 163, 184)',
                    padding: '0 4px',
                    height: 'auto',
                    fontSize: 12
                  }}
                />
              </Tooltip>
            )}
          </Space>
        );
      }
    },
    {
      title: 'PR #',
      dataIndex: 'pr_number',
      key: 'pr_number',
      width: 100,
      fixed: 'left',
      render: (prNumber, record) => {
        if (!prNumber) return <Text type="secondary">-</Text>;
        const repoName = record.repo_name;
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
                  style={{ 
                    color: 'rgb(148, 163, 184)',
                    padding: '0 4px',
                    height: 'auto',
                    fontSize: 12
                  }}
                />
              </Tooltip>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Account',
      dataIndex: 'account_name',
      key: 'account_name',
      width: 150,
      sorter: true,
      render: (text) => (
        <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12 }}>
          {text || '-'}
        </Text>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      sorter: true,
      render: (status) => {
        if (status === 'reserved') {
          return (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              Reserved
            </Tag>
          );
        } else if (status === 'failed') {
          return (
            <Tag color="red" icon={<CloseCircleOutlined />}>
              Failed
            </Tag>
          );
        } else if (status === 'released') {
          return (
            <Tag color="default">
              Released
            </Tag>
          );
        } else if (status === 'expired') {
          return (
            <Tag color="orange" icon={<ClockCircleOutlined />}>
              Expired
            </Tag>
          );
        }
        return <Tag>{status || '-'}</Tag>;
      }
    },
    {
      title: 'Expires At',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 180,
      sorter: true,
      render: (date, record) => {
        if (!date) return <Text type="secondary">-</Text>;
        const isExpired = dayjs(date).isBefore(dayjs());
        const isExpiringSoon = dayjs(date).diff(dayjs(), 'hours') < 24;
        return (
          <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
            <Text 
              style={{ 
                color: isExpired ? '#ef4444' : isExpiringSoon ? '#f59e0b' : 'rgb(148, 163, 184)', 
                fontSize: 12 
              }}
            >
              {isExpired ? 'Expired' : dayjs(date).fromNow()}
            </Text>
          </Tooltip>
        );
      }
    },
    {
      title: 'Reserved At',
      dataIndex: 'reservedAt',
      key: 'reservedAt',
      width: 180,
      sorter: true,
      defaultSortOrder: 'descend',
      render: (date) => (
        <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12 }}>
          {date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Text>
      )
    },
    {
      title: 'Released At',
      dataIndex: 'cancelledAt',
      key: 'cancelledAt',
      width: 180,
      sorter: true,
      render: (date) => (
        <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12 }}>
          {date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Text>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => {
        const isReleasing = releasing[record.id];
        const canRelease = record.status === 'reserved' || record.status === 'failed';
        
        return (
          <Space>
            {canRelease && (
              <Popconfirm
                title="Release Reservation"
                description={`Are you sure you want to release this reservation? This will delete it from both local and remote database.`}
                onConfirm={() => handleRelease(record)}
                okText="Yes"
                cancelText="No"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Release reservation">
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    loading={isReleasing}
                    disabled={isReleasing}
                    danger
                    style={{ 
                      color: '#ef4444',
                      fontSize: 12,
                      padding: '0 4px'
                    }}
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
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={3} style={{ color: 'rgb(241, 245, 249)', margin: 0 }}>
              Reservations
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
              <Tooltip title="Refresh">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchReservations}
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
        {/* Stats - Total Reservations & Total Released + Show only reserved checkbox */}
        <Row align="middle" style={{ marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
          <Space size="middle" wrap>
            <Checkbox
              checked={showOnlyReserved}
              onChange={handleShowOnlyReservedChange}
              style={{ color: 'rgb(241, 245, 249)' }}
            >
              Show only reserved
            </Checkbox>
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
              Total Reservations: {stats.total}
            </span>
            <span
              style={{
                background: 'rgba(148, 163, 184, 0.2)',
                color: '#94a3b8',
                padding: '4px 12px',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Total Released: {stats.released}
            </span>
          </Space>
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
                  Status
                </Text>
                <Select
                  placeholder="All Status"
                  allowClear
                  style={{ width: '100%' }}
                  size="large"
                  value={filters.status}
                  onChange={(value) => {
                    setShowOnlyReserved(value === 'reserved');
                    handleFilterChange('status', value);
                    fetchReservations();
                  }}
                >
                  <Option value="reserved">Reserved</Option>
                  <Option value="failed">Failed</Option>
                  <Option value="released">Released</Option>
                  <Option value="expired">Expired</Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Account
                </Text>
                <Input
                  placeholder="Search account"
                  size="large"
                  value={filters.account}
                  onChange={(e) => handleFilterChange('account', e.target.value)}
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Merged Commit
                </Text>
                <Input
                  placeholder="Search merged commit"
                  size="large"
                  value={filters.merged_commit}
                  onChange={(e) => handleFilterChange('merged_commit', e.target.value)}
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Base Commit
                </Text>
                <Input
                  placeholder="Search base commit"
                  size="large"
                  value={filters.base_commit}
                  onChange={(e) => handleFilterChange('base_commit', e.target.value)}
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                  PR Number
                </Text>
                <Input
                  placeholder="Search PR number"
                  size="large"
                  value={filters.pr_number}
                  onChange={(e) => handleFilterChange('pr_number', e.target.value)}
                  allowClear
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
            dataSource={filteredReservations}
            rowKey="id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: filteredReservations.length,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} reservations`,
              onChange: (page, pageSize) => {
                setPagination(prev => ({ ...prev, current: page, pageSize }));
              },
              pageSizeOptions: ['10', '20', '50', '100']
            }}
            scroll={{ x: 'max-content' }}
            onChange={(pagination, filters, sorter) => {
              if (sorter.field) {
                setSortConfig({
                  field: sorter.field,
                  order: sorter.order === 'ascend' ? 'ASC' : 'DESC'
                });
                setPagination(prev => ({ ...prev, current: 1 }));
              }
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default ReservationsTable;
