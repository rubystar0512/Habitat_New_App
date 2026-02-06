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
  CheckCircleOutlined,
  CloseCircleOutlined,
  SafetyOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import api from '../../config/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

const AccountManagement = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({
    isActive: null,
    accountHealth: null,
  });
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState({});
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const hasFilters = searchText || filters.isActive !== null || filters.accountHealth;
      const params = hasFilters
        ? { limit: 1000, offset: 0 }
        : {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
        };

      const response = await api.get('/accounts', { params });
      let filteredData = response.data.accounts || [];

      // Apply frontend filters
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        filteredData = filteredData.filter(
          account =>
            account.accountName.toLowerCase().includes(searchLower) ||
            (account.apiUrl && account.apiUrl.toLowerCase().includes(searchLower))
        );
      }
      if (filters.accountHealth) {
        filteredData = filteredData.filter(account => account.accountHealth === filters.accountHealth);
      }

      // Apply pagination to filtered results
      if (hasFilters) {
        const start = (pagination.current - 1) * pagination.pageSize;
        const end = start + pagination.pageSize;
        setAccounts(filteredData.slice(start, end));
        setTotal(filteredData.length);
      } else {
        setAccounts(filteredData);
        setTotal(response.data.total || 0);
      }
    } catch (error) {
      message.error('Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
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
      await api.post('/accounts', values);
      message.success('Account created successfully');
      setCreateModalVisible(false);
      form.resetFields();
      fetchAccounts();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to create account');
    }
  };

  const handleEdit = (account) => {
    setSelectedAccount(account);
    editForm.setFieldsValue({
      accountName: account.accountName,
      apiToken: account.apiToken,
      isActive: account.isActive,
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async (values) => {
    try {
      await api.patch(`/accounts/${selectedAccount.id}`, values);
      message.success('Account updated successfully');
      setEditModalVisible(false);
      setSelectedAccount(null);
      editForm.resetFields();
      fetchAccounts();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to update account');
    }
  };

  const handleToggleActive = async (accountId, isActive) => {
    try {
      await api.patch(`/accounts/${accountId}`, { isActive: !isActive });
      message.success(`Account ${!isActive ? 'activated' : 'deactivated'} successfully`);
      fetchAccounts();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to update account status');
    }
  };

  const handleDelete = async (accountId) => {
    try {
      await api.delete(`/accounts/${accountId}`);
      message.success('Account deleted successfully');
      fetchAccounts();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to delete account');
    }
  };

  const handleCheckHealth = async (accountId) => {
    setCheckingHealth({ ...checkingHealth, [accountId]: true });
    try {
      const response = await api.post(`/accounts/${accountId}/check-health`);
      if (response.data.success) {
        message.success(
          `Account health: ${response.data.health}. ` +
          `Remaining reversals: ${response.data.remainingReversals}/${response.data.reverseLimit}`
        );
      } else {
        message.warning(`Health check failed: ${response.data.error}`);
      }
      fetchAccounts();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to check account health');
    } finally {
      setCheckingHealth({ ...checkingHealth, [accountId]: false });
    }
  };

  const getHealthTag = (health) => {
    const healthMap = {
      healthy: { color: 'success', icon: <SafetyOutlined />, text: 'Healthy' },
      warning: { color: 'warning', icon: <WarningOutlined />, text: 'Warning' },
      error: { color: 'error', icon: <ExclamationCircleOutlined />, text: 'Error' },
      unknown: { color: 'default', icon: <QuestionCircleOutlined />, text: 'Unknown' },
      exhausted: { color: 'error', icon: <ExclamationCircleOutlined />, text: 'Exhausted' },
    };
    const config = healthMap[health] || healthMap.unknown;
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const columns = [
    {
      title: 'Account Name',
      dataIndex: 'accountName',
      key: 'accountName',
      width: 150,
      sorter: (a, b) => a.accountName.localeCompare(b.accountName),
    },
    {
      title: 'Reverse Limit',
      dataIndex: 'reverseLimit',
      key: 'reverseLimit',
      width: 120,
      align: 'center',
      sorter: (a, b) => (a.reverseLimit || 0) - (b.reverseLimit || 0),
    },
    {
      title: 'Remaining',
      dataIndex: 'remainingReversals',
      key: 'remainingReversals',
      width: 120,
      align: 'center',
      sorter: (a, b) => {
        const aVal = a.remainingReversals !== null ? a.remainingReversals : -1;
        const bVal = b.remainingReversals !== null ? b.remainingReversals : -1;
        return aVal - bVal;
      },
      render: (count) => count !== null ? count : '-',
    },
    {
      title: 'Total Reservations',
      dataIndex: 'totalReservationsMade',
      key: 'totalReservationsMade',
      width: 150,
      align: 'center',
      sorter: (a, b) => (a.totalReservationsMade || 0) - (b.totalReservationsMade || 0),
    },
    {
      title: 'Health',
      dataIndex: 'accountHealth',
      key: 'accountHealth',
      width: 120,
      sorter: (a, b) => {
        const healthOrder = { healthy: 0, warning: 1, error: 2, exhausted: 3, unknown: 4 };
        return (healthOrder[a.accountHealth] || 99) - (healthOrder[b.accountHealth] || 99);
      },
      render: (health) => getHealthTag(health),
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
      title: 'Health Checked',
      dataIndex: 'healthLastChecked',
      key: 'healthLastChecked',
      width: 180,
      sorter: (a, b) => {
        if (!a.healthLastChecked && !b.healthLastChecked) return 0;
        if (!a.healthLastChecked) return 1;
        if (!b.healthLastChecked) return -1;
        return new Date(a.healthLastChecked) - new Date(b.healthLastChecked);
      },
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Check Health">
            <Button
              type="text"
              size="middle"
              icon={<SyncOutlined />}
              onClick={() => handleCheckHealth(record.id)}
              loading={checkingHealth[record.id]}
              style={{
                color: '#722ed1',
                padding: '4px 8px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(114, 46, 209, 0.1)';
                e.currentTarget.style.color = '#9254de';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#722ed1';
              }}
            />
          </Tooltip>
          <Tooltip title="Edit Account">
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
          <Tooltip title={record.isActive ? 'Deactivate Account' : 'Activate Account'}>
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
            title="Are you sure you want to delete this account?"
            description="This will also delete all associated reservations."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete Account">
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
              Habitat Accounts Management
            </Title>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              Add Account
            </Button>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={10}>
            <Input
              size="large"
              placeholder="Search by account name"
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
              placeholder="Filter by health"
              style={{ width: '100%' }}
              allowClear
              value={filters.accountHealth}
              onChange={(value) => handleFilterChange('accountHealth', value)}
            >
              <Option value="healthy">Healthy</Option>
              <Option value="warning">Warning</Option>
              <Option value="error">Error</Option>
              <Option value="exhausted">Exhausted</Option>
              <Option value="unknown">Unknown</Option>
            </Select>
          </Col>
          <Col span={2}>
            <Button
              size="large"
              icon={<ReloadOutlined />}
              onClick={fetchAccounts}
              style={{ width: '100%' }}
            >
              Refresh
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={accounts}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} accounts`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={handleTableChange}
          scroll={{ x: 'max-content', y: '54vh' }}
          style={{
            background: '#1e293b',
          }}
        />
      </Card>

      {/* Create Account Modal */}
      <Modal
        title="Add New Habitat Account"
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
            name="accountName"
            label="Account Name"
            rules={[{ required: true, message: 'Please input account name' }]}
          >
            <Input size="large" placeholder="e.g., My Habitat Account" />
          </Form.Item>

          <Form.Item
            name="apiToken"
            label="API Token"
            rules={[{ required: true, message: 'Please input API token' }]}
          >
            <Input.Password size="large" placeholder="Enter Habitat API token" />
          </Form.Item>

          <Form.Item
            name="apiUrl"
            label="API URL (Optional)"
          >
            <Input size="large" placeholder="Leave empty to use default" />
          </Form.Item>

          <Form.Item
            name="reverseLimit"
            label="Reverse Limit"
            initialValue={7}
          >
            <Input size="large" type="number" placeholder="Default: 7" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create Account
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

      {/* Edit Account Modal */}
      <Modal
        title="Edit Habitat Account"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedAccount(null);
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
            name="accountName"
            label="Account Name"
            rules={[{ required: true, message: 'Please input account name' }]}
          >
            <Input size="large" placeholder="e.g., My Habitat Account" />
          </Form.Item>

          <Form.Item
            name="apiToken"
            label="API Token"
            rules={[{ required: true, message: 'Please input API token' }]}
          >
            <Input.Password size="large" placeholder="Enter Habitat API token" />
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
                Update Account
              </Button>
              <Button onClick={() => {
                setEditModalVisible(false);
                setSelectedAccount(null);
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

export default AccountManagement;
