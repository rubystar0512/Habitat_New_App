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
} from 'antd';
import {
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import api from '../../config/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({
    role: null,
    isApproved: null,
  });
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch all users when filters are active, otherwise use pagination
      const hasFilters = searchText || filters.role || filters.isApproved !== null;
      const params = hasFilters
        ? { limit: 1000, offset: 0 } // Fetch all for filtering
        : {
            limit: pagination.pageSize,
            offset: (pagination.current - 1) * pagination.pageSize,
          };

      const response = await api.get('/users', { params });
      let filteredData = response.data.users || [];
      
      // Apply frontend filters
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        filteredData = filteredData.filter(user =>
          user.username.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
        );
      }
      if (filters.role) {
        filteredData = filteredData.filter(user => user.role === filters.role);
      }
      if (filters.isApproved !== null) {
        filteredData = filteredData.filter(user => user.isApproved === filters.isApproved);
      }
      
      // Apply pagination to filtered results
      if (hasFilters) {
        const start = (pagination.current - 1) * pagination.pageSize;
        const end = start + pagination.pageSize;
        setUsers(filteredData.slice(start, end));
        setTotal(filteredData.length);
      } else {
        setUsers(filteredData);
        setTotal(response.data.total || 0);
      }
    } catch (error) {
      message.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
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
      await api.post('/users', values);
      message.success('User created successfully');
      setCreateModalVisible(false);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to create user');
    }
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    editForm.setFieldsValue({
      username: user.username,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async (values) => {
    try {
      await api.patch(`/users/${selectedUser.id}`, values);
      message.success('User updated successfully');
      setEditModalVisible(false);
      setSelectedUser(null);
      editForm.resetFields();
      fetchUsers();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to update user');
    }
  };

  const handleApprove = async (userId, approve) => {
    try {
      if (approve) {
        await api.patch(`/users/${userId}/approve`);
        message.success('User approved successfully');
      } else {
        await api.patch(`/users/${userId}`, { isApproved: false });
        message.success('User unapproved successfully');
      }
      fetchUsers();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to update approval status');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      message.success('User role updated successfully');
      fetchUsers();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to update role');
    }
  };

  const handleDelete = async (userId) => {
    try {
      await api.delete(`/users/${userId}`);
      message.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      sorter: true,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role) => (
        <Tag color={role === 'admin' ? 'green' : 'blue'}>{role.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isApproved',
      key: 'isApproved',
      width: 120,
      render: (isApproved) => (
        <Badge
          status={isApproved ? 'success' : 'default'}
          text={isApproved ? 'Approved' : 'Pending'}
        />
      ),
    },
    {
      title: 'Reservations',
      dataIndex: 'totalReservations',
      key: 'totalReservations',
      width: 120,
      align: 'center',
    },
    {
      title: 'Success Rate',
      key: 'successRate',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const total = (record.successfulTasks || 0) + (record.failedTasks || 0);
        if (total === 0) return '-';
        const rate = ((record.successfulTasks || 0) / total * 100).toFixed(1);
        return `${rate}%`;
      },
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      width: 180,
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : 'Never',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          {!record.isApproved ? (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleApprove(record.id, true)}
            >
              Approve
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => handleApprove(record.id, false)}
            >
              Unapprove
            </Button>
          )}
          <Select
            size="small"
            value={record.role}
            style={{ width: 80 }}
            onChange={(value) => handleRoleChange(record.id, value)}
          >
            <Option value="user">User</Option>
            <Option value="admin">Admin</Option>
          </Select>
          <Popconfirm
            title="Are you sure you want to delete this user?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              Delete
            </Button>
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
              User Management
            </Title>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              Create User
            </Button>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={10}>
            <Input
              size="large"
              placeholder="Search by username or email"
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
              placeholder="Filter by role"
              style={{ width: '100%' }}
              allowClear
              value={filters.role}
              onChange={(value) => handleFilterChange('role', value)}
            >
              <Option value="admin">Admin</Option>
              <Option value="user">User</Option>
            </Select>
          </Col>
          <Col span={6}>
            <Select
              size="large"
              placeholder="Filter by status"
              style={{ width: '100%' }}
              allowClear
              value={filters.isApproved}
              onChange={(value) => handleFilterChange('isApproved', value)}
            >
              <Option value={true}>Approved</Option>
              <Option value={false}>Pending</Option>
            </Select>
          </Col>
          <Col span={2}>
            <Button
              size="large"
              icon={<ReloadOutlined />}
              onClick={fetchUsers}
              style={{ width: '100%' }}
            >
              Refresh
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} users`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={handleTableChange}
          scroll={{ x: 'max-content' }}
          style={{
            background: '#1e293b',
          }}
        />
      </Card>

      {/* Create User Modal */}
      <Modal
        title="Create New User"
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
            name="username"
            label="Username"
            rules={[
              { required: true, message: 'Please input username' },
              { min: 3, message: 'Username must be at least 3 characters' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Username" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please input email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input placeholder="Email" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please input password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password placeholder="Password" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            initialValue="user"
          >
            <Select>
              <Option value="user">User</Option>
              <Option value="admin">Admin</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="isApproved"
            label="Approved"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create User
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

      {/* Edit User Modal */}
      <Modal
        title="Edit User"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedUser(null);
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
            name="username"
            label="Username"
            rules={[
              { required: true, message: 'Please input username' },
              { min: 3, message: 'Username must be at least 3 characters' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Username" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please input email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input placeholder="Email" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password (leave empty to keep current)"
          >
            <Input.Password placeholder="New password" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
          >
            <Select>
              <Option value="user">User</Option>
              <Option value="admin">Admin</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="isApproved"
            label="Approved"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Update User
              </Button>
              <Button onClick={() => {
                setEditModalVisible(false);
                setSelectedUser(null);
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

export default UserManagement;
