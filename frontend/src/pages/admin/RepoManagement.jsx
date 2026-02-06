import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  Switch,
  DatePicker,
  message,
  Popconfirm,
  Typography,
  Row,
  Col,
  Badge,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import api from '../../config/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

const RepoManagement = () => {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({
    isActive: null,
    fetchStatus: null,
  });
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [syncing, setSyncing] = useState(false);

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const hasFilters = searchText || filters.isActive !== null || filters.fetchStatus;
      const params = hasFilters
        ? { limit: 1000, offset: 0 }
        : {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
        };

      if (filters.isActive !== null) {
        params.is_active = filters.isActive;
      }

      const response = await api.get('/repos', { params });
      let filteredData = response.data.repos || [];

      // Apply frontend filters
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        filteredData = filteredData.filter(
          repo =>
            repo.repoName.toLowerCase().includes(searchLower) ||
            repo.fullName.toLowerCase().includes(searchLower) ||
            (repo.habitatRepoId && repo.habitatRepoId.toLowerCase().includes(searchLower))
        );
      }
      if (filters.fetchStatus) {
        filteredData = filteredData.filter(repo => repo.fetchStatus === filters.fetchStatus);
      }

      // Apply pagination to filtered results
      if (hasFilters) {
        const start = (pagination.current - 1) * pagination.pageSize;
        const end = start + pagination.pageSize;
        setRepos(filteredData.slice(start, end));
        setTotal(filteredData.length);
      } else {
        setRepos(filteredData);
        setTotal(response.data.total || 0);
      }
    } catch (error) {
      message.error('Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, [pagination.current, pagination.pageSize, filters, searchText]);

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleSearch = () => {
    setPagination({ current: 1, pageSize: pagination.pageSize });
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    setPagination({ ...pagination, current: 1 });
  };

  const handleCreate = async (values) => {
    try {
      const payload = {
        ...values,
        cutoffDate: values.cutoffDate ? values.cutoffDate.format('YYYY-MM-DD') : null,
      };
      await api.post('/repos', payload);
      message.success('Repository created successfully');
      setCreateModalVisible(false);
      form.resetFields();
      fetchRepos();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to create repository');
    }
  };

  const handleEdit = (repo) => {
    setSelectedRepo(repo);
    editForm.setFieldsValue({
      repoName: repo.repoName,
      fullName: repo.fullName,
      habitatRepoId: repo.habitatRepoId,
      defaultBranch: repo.defaultBranch,
      cutoffDate: repo.cutoffDate ? dayjs(repo.cutoffDate) : null,
      isActive: repo.isActive,
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async (values) => {
    try {
      const payload = {
        ...values,
        cutoffDate: values.cutoffDate ? values.cutoffDate.format('YYYY-MM-DD') : null,
      };
      await api.patch(`/repos/${selectedRepo.id}`, payload);
      message.success('Repository updated successfully');
      setEditModalVisible(false);
      setSelectedRepo(null);
      editForm.resetFields();
      fetchRepos();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to update repository');
    }
  };

  const handleToggleActive = async (repoId, isActive) => {
    try {
      await api.patch(`/repos/${repoId}`, { isActive: !isActive });
      message.success(`Repository ${!isActive ? 'activated' : 'deactivated'} successfully`);
      fetchRepos();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to update repository status');
    }
  };

  const handleDelete = async (repoId) => {
    try {
      await api.delete(`/repos/${repoId}`);
      message.success('Repository deleted successfully');
      fetchRepos();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to delete repository');
    }
  };

  const handleSyncFromHabitat = async () => {
    setSyncing(true);
    try {
      const response = await api.post('/repos/sync-from-habitat');
      const { created, updated, total, errors } = response.data;
      
      let messageText = `Sync completed: ${created} created, ${updated} updated out of ${total} repos`;
      if (errors && errors.length > 0) {
        messageText += ` (${errors.length} errors)`;
        message.warning(messageText);
      } else {
        message.success(messageText);
      }
      
      await fetchRepos();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to sync repositories from Habitat API');
    } finally {
      setSyncing(false);
    }
  };

  const getFetchStatusTag = (status) => {
    const statusMap = {
      idle: { color: 'success', text: 'Idle' },
      fetching: { color: 'processing', text: 'Fetching' },
      error: { color: 'error', text: 'Error' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: 'Repository Name',
      dataIndex: 'repoName',
      key: 'repoName',
      width: 150,
      sorter: (a, b) => a.repoName.localeCompare(b.repoName),
    },
    {
      title: 'Full Name',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 200,
      sorter: (a, b) => a.fullName.localeCompare(b.fullName),
    },
    {
      title: 'Habitat Repo ID',
      dataIndex: 'habitatRepoId',
      key: 'habitatRepoId',
      width: 200,
      sorter: (a, b) => {
        const aId = a.habitatRepoId || '';
        const bId = b.habitatRepoId || '';
        return aId.localeCompare(bId);
      },
      render: (id) => id || '-',
    },
    {
      title: 'Default Branch',
      dataIndex: 'defaultBranch',
      key: 'defaultBranch',
      width: 120,
      sorter: (a, b) => (a.defaultBranch || '').localeCompare(b.defaultBranch || ''),
    },
    {
      title: 'Cutoff Date',
      dataIndex: 'cutoffDate',
      key: 'cutoffDate',
      width: 120,
      sorter: (a, b) => {
        if (!a.cutoffDate && !b.cutoffDate) return 0;
        if (!a.cutoffDate) return 1;
        if (!b.cutoffDate) return -1;
        return new Date(a.cutoffDate) - new Date(b.cutoffDate);
      },
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      sorter: (a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? 1 : -1),
      render: (isActive) => (
        <Badge
          status={isActive ? 'success' : 'default'}
          text={isActive ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      title: 'Fetch Status',
      dataIndex: 'fetchStatus',
      key: 'fetchStatus',
      width: 120,
      sorter: (a, b) => {
        const statusOrder = { idle: 0, fetching: 1, error: 2 };
        return (statusOrder[a.fetchStatus] || 99) - (statusOrder[b.fetchStatus] || 99);
      },
      render: (status) => getFetchStatusTag(status),
    },
    {
      title: 'Commits Fetched',
      dataIndex: 'totalCommitsFetched',
      key: 'totalCommitsFetched',
      width: 130,
      align: 'center',
      sorter: (a, b) => (a.totalCommitsFetched || 0) - (b.totalCommitsFetched || 0),
      render: (count) => count || 0,
    },
    {
      title: 'Last Fetched',
      dataIndex: 'lastFetchedAt',
      key: 'lastFetchedAt',
      width: 180,
      sorter: (a, b) => {
        if (!a.lastFetchedAt && !b.lastFetchedAt) return 0;
        if (!a.lastFetchedAt) return 1;
        if (!b.lastFetchedAt) return -1;
        return new Date(a.lastFetchedAt) - new Date(b.lastFetchedAt);
      },
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit Repository">
            <Button
              type="text"
              size="middle"
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
          <Tooltip title={record.isActive ? 'Deactivate Repository' : 'Activate Repository'}>
            <Button
              type="text"
              size="middle"
              icon={record.isActive ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              onClick={() => handleToggleActive(record.id, record.isActive)}
              style={{
                color: record.isActive ? '#faad14' : '#52c41a',
                padding: '4px 8px',
              }}
              onMouseEnter={(e) => {
                const color = record.isActive ? 'rgba(250, 173, 20, 0.1)' : 'rgba(82, 196, 26, 0.1)';
                const textColor = record.isActive ? '#ffc53d' : '#73d13d';
                e.currentTarget.style.background = color;
                e.currentTarget.style.color = textColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = record.isActive ? '#faad14' : '#52c41a';
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this repository?"
            description="This will also delete all associated commits."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete Repository">
              <Button
                type="text"
                size="middle"
                danger
                icon={<DeleteOutlined />}
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
              Repository Management
            </Title>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<SyncOutlined />}
                onClick={handleSyncFromHabitat}
                loading={syncing}
              >
                Sync from Habitat
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                Add Repository
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={10}>
            <Input
              size="large"
              placeholder="Search by name or Habitat ID"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col span={6}>
            <Select
              size="large"
              placeholder="Filter by status"
              style={{ width: '100%' }}
              allowClear
              value={filters.isActive}
              onChange={(value) => handleFilterChange('isActive', value)}
            >
              <Option value={true}>Active</Option>
              <Option value={false}>Inactive</Option>
            </Select>
          </Col>
          <Col span={6}>
            <Select
              size="large"
              placeholder="Filter by fetch status"
              style={{ width: '100%' }}
              allowClear
              value={filters.fetchStatus}
              onChange={(value) => handleFilterChange('fetchStatus', value)}
            >
              <Option value="idle">Idle</Option>
              <Option value="fetching">Fetching</Option>
              <Option value="error">Error</Option>
            </Select>
          </Col>
          <Col span={2}>
            <Button
              size="large"
              icon={<ReloadOutlined />}
              onClick={fetchRepos}
              style={{ width: '100%' }}
            >
              Refresh
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={repos}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} repositories`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={handleTableChange}
          scroll={{ x: 'max-content', y: '54vh' }}
          style={{
            background: '#1e293b',
          }}
        />
      </Card>

      {/* Create Repository Modal */}
      <Modal
        title="Add New Repository"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            name="repoName"
            label="Repository Name"
            rules={[{ required: true, message: 'Please input repository name' }]}
          >
            <Input size="large" placeholder="e.g., angr" />
          </Form.Item>

          <Form.Item
            name="fullName"
            label="Full Name (org/repo)"
            rules={[{ required: true, message: 'Please input full name' }]}
          >
            <Input size="large" placeholder="e.g., angr/angr" />
          </Form.Item>

          <Form.Item
            name="habitatRepoId"
            label="Habitat Repository ID"
          >
            <Input size="large" placeholder="Optional: Habitat repository UUID" />
          </Form.Item>

          <Form.Item
            name="defaultBranch"
            label="Default Branch"
            initialValue="main"
          >
            <Select size="large">
              <Option value="main">main</Option>
              <Option value="master">master</Option>
              <Option value="develop">develop</Option>
              <Option value="dev">dev</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="cutoffDate"
            label="Cutoff Date"
          >
            <DatePicker
              size="large"
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              placeholder="Select cutoff date"
            />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Active"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create Repository
              </Button>
              <Button onClick={() => {
                setCreateModalVisible(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Repository Modal */}
      <Modal
        title="Edit Repository"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedRepo(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdate}
        >
          <Form.Item
            name="repoName"
            label="Repository Name"
            rules={[{ required: true, message: 'Please input repository name' }]}
          >
            <Input size="large" placeholder="e.g., angr" />
          </Form.Item>

          <Form.Item
            name="fullName"
            label="Full Name (org/repo)"
            rules={[{ required: true, message: 'Please input full name' }]}
          >
            <Input size="large" placeholder="e.g., angr/angr" />
          </Form.Item>

          <Form.Item
            name="habitatRepoId"
            label="Habitat Repository ID"
          >
            <Input size="large" placeholder="Optional: Habitat repository UUID" />
          </Form.Item>

          <Form.Item
            name="defaultBranch"
            label="Default Branch"
          >
            <Select size="large">
              <Option value="main">main</Option>
              <Option value="master">master</Option>
              <Option value="develop">develop</Option>
              <Option value="dev">dev</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="cutoffDate"
            label="Cutoff Date"
          >
            <DatePicker
              size="large"
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              placeholder="Select cutoff date"
            />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Active"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Update Repository
              </Button>
              <Button onClick={() => {
                setEditModalVisible(false);
                setSelectedRepo(null);
                editForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RepoManagement;
